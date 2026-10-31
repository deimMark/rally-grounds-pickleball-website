-- Creation must match accepted terms as well as price, even when a policy change
-- leaves the total unchanged. Remove the old bypassable RPC signature.
drop function public.create_reservation(uuid,timestamptz,timestamptz,integer,text,uuid,integer,timestamptz);
create or replace function private.quote(p_court uuid,p_start timestamptz,p_end timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 p public.policy_versions; club public.club_settings_versions; c public.court_config_versions;
 cursor_at timestamptz := p_start; stop_at timestamptz; next_version timestamptz;
 local_at timestamp; duration numeric; amount numeric:=0; segments jsonb:='[]';
begin
 if p_start is null or p_end is null or not isfinite(p_start) or not isfinite(p_end) or p_end<=p_start or p_end-p_start > interval '24 hours' then
  raise exception 'Invalid single-day interval' using errcode='22023';
 end if;
 select * into p from private.policy_at(clock_timestamp());
 select * into club from public.club_settings_versions where effective_from<=p_start order by effective_from desc limit 1;
 if p.id is null or club.id is null then raise exception 'Configuration unavailable' using errcode='23514'; end if;
 local_at:=p_start at time zone club.timezone;
 duration:=extract(epoch from (p_end-p_start))/60;
 if extract(second from local_at)<>0 or (extract(hour from local_at)*60+extract(minute from local_at))::int % p.start_increment_minutes<>0
 or duration<p.minimum_minutes or duration % p.duration_increment_minutes<>0 or (p.max_duration_minutes is not null and duration>p.max_duration_minutes)
 or (p_end at time zone club.timezone) > date_trunc('day',local_at)+interval '1 day' then
  raise exception 'Invalid start or duration' using errcode='23514';
 end if;
 while cursor_at<p_end loop
  select * into c from public.court_config_versions where court_id=p_court and effective_from<=cursor_at order by effective_from desc limit 1;
  select min(effective_from) into next_version from public.court_config_versions where court_id=p_court and effective_from>cursor_at;
  stop_at:=least(p_end,date_trunc('hour',cursor_at)+interval '1 hour',coalesce(next_version,p_end));
  local_at:=cursor_at at time zone club.timezone;
  if c.id is null or not c.enabled
   or extract(epoch from(local_at-date_trunc('day',local_at)))/60<c.opening_minute
   or extract(epoch from((stop_at at time zone club.timezone)-date_trunc('day',local_at)))/60>c.closing_minute then
   raise exception 'Court unavailable during requested hours' using errcode='23514';
  end if;
  amount:=amount+c.rate_centavos*extract(epoch from(stop_at-cursor_at))/3600;
  segments:=segments||jsonb_build_array(jsonb_build_object('court_config_version_id',c.id,'starts_at',cursor_at,'ends_at',stop_at,'rate_centavos',c.rate_centavos));
  cursor_at:=stop_at;
 end loop;
 return jsonb_build_object('total_centavos',round(amount)::integer,'policy_version_id',p.id,'club_version_id',club.id,
   'policy',to_jsonb(p),'timezone',club.timezone,'segments',segments,
   'version_context',jsonb_build_object('policy_version_id',p.id,'club_version_id',club.id,'court_versions',segments));
end $$;

create or replace function public.quote_reservation(p_court_id uuid,p_start timestamptz,p_end timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform pg_advisory_xact_lock_shared(842017,1); perform private.require_staff(); return private.quote(p_court_id,p_start,p_end); end $$;

create function public.create_reservation(p_court_id uuid,p_start timestamptz,p_end timestamptz,p_players integer,p_source text,
 p_request_key uuid,p_expected_total integer,p_hold_until timestamptz,p_expected_versions jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare q jsonb; b public.bookings; payload jsonb; previous public.idempotency_requests; result jsonb;
begin
 perform pg_advisory_xact_lock_shared(842017,1);
 perform private.require_staff();
 if p_request_key is null then raise exception 'Idempotency key required' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_request_key::text,0));
 payload:=jsonb_build_object('court',p_court_id,'start',p_start,'end',p_end,'players',p_players,'source',p_source,'total',p_expected_total,'hold_until',p_hold_until,'versions',p_expected_versions);
 select * into previous from public.idempotency_requests where actor_id=auth.uid() and request_key=p_request_key;
 if found then
  if previous.operation<>'reservation.create' or previous.payload<>payload then raise exception 'Idempotency payload changed' using errcode='22023'; end if;
  return previous.result;
 end if;
 perform 1 from public.courts where id=p_court_id for update;
 if not found then raise exception 'Unknown court' using errcode='22023'; end if;
 perform private.expire_holds(p_court_id);
 q:=private.quote(p_court_id,p_start,p_end);
 if p_expected_versions is null or p_expected_versions is distinct from q->'version_context'
  or p_start<=clock_timestamp() or p_expected_total is null or p_expected_total<>(q->>'total_centavos')::integer
  or p_hold_until is null or not isfinite(p_hold_until) or p_hold_until<=clock_timestamp() or p_hold_until>p_start
  or p_hold_until>now()+make_interval(mins=>(q->'policy'->>'payment_window_minutes')::integer) then
  raise exception 'Invalid start, agreed terms/total or explicit staff hold deadline' using errcode='22023';
 end if;
 insert into public.bookings(estimated_players,source,expires_at,total_centavos,created_by)
 values(p_players,p_source,p_hold_until,(q->>'total_centavos')::integer,auth.uid()) returning * into b;
 insert into public.booking_revisions(booking_id,policy_version_id,club_version_id,agreement)
 values(b.id,(q->>'policy_version_id')::uuid,(q->>'club_version_id')::uuid,q);
 insert into public.booking_items(booking_id,court_id,starts_at,ends_at) values(b.id,p_court_id,p_start,p_end);
 insert into public.court_occupancies(court_id,booking_id,kind,occupied_during,created_by)
 values(p_court_id,b.id,'reservation',tstzrange(p_start,p_end,'[)'),auth.uid());
 result:=jsonb_build_object('id',b.id,'reference',b.reference,'status',b.status,'total_centavos',b.total_centavos,'expires_at',b.expires_at);
 insert into public.idempotency_requests values(auth.uid(),p_request_key,'reservation.create',payload,result);
 perform private.audit('reservation.created','booking',b.id,jsonb_build_object('source',p_source,'court_id',p_court_id));
 return result;
end $$;

revoke all on function private.quote(uuid,timestamptz,timestamptz) from public,anon,authenticated;
revoke all on function public.create_reservation(uuid,timestamptz,timestamptz,integer,text,uuid,integer,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.create_reservation(uuid,timestamptz,timestamptz,integer,text,uuid,integer,timestamptz,jsonb) to authenticated;
