-- Duration increment remains multiples from zero, as in the approved quote contract.
-- Thus a 90-minute minimum / 60-minute increment has 120 as its first legal duration.
-- Validate future policy inserts; never rewrite historical policy/agreement rows.
create function private.minimum_legal_duration(p public.policy_versions) returns integer
language plpgsql immutable set search_path='' as $$
declare first_minutes integer; upper_minutes integer;
begin
 if p.minimum_minutes is null or p.minimum_minutes not between 1 and 1440
  or p.duration_increment_minutes is null or p.duration_increment_minutes not between 1 and 1440 then
  raise exception 'Unsupported duration configuration: positive minimum/increment must fit the single-day technical bound' using errcode='22023';
 end if;
 first_minutes:=ceil(p.minimum_minutes::numeric/p.duration_increment_minutes)::integer*p.duration_increment_minutes;
 upper_minutes:=least(coalesce(p.max_duration_minutes,1440),1440);
 if first_minutes>upper_minutes then
  raise exception 'Unsupported duration configuration: no legal duration fits the configured maximum and single-day technical bound' using errcode='22023';
 end if;
 return first_minutes;
end $$;
create function private.duration_allowed(p public.policy_versions,p_minutes numeric) returns boolean
language plpgsql immutable set search_path='' as $$
declare first_minutes integer;
begin
 first_minutes:=private.minimum_legal_duration(p);
 return coalesce(p_minutes=trunc(p_minutes) and p_minutes>=first_minutes
  and p_minutes<=least(coalesce(p.max_duration_minutes,1440),1440)
  and p_minutes % p.duration_increment_minutes=0,false);
end $$;
create function private.validate_policy_duration() returns trigger language plpgsql set search_path='' as $$
begin perform private.minimum_legal_duration(new); return new; end $$;
create trigger validate_policy_duration before insert on public.policy_versions
 for each row execute function private.validate_policy_duration();

-- Replace the one-argument RPC with a backward-compatible optional duration argument.
drop function public.availability(date);
create function public.availability(p_day date,p_duration_minutes integer default null)
returns table(court_id uuid,court_number integer,starts_at timestamptz,ends_at timestamptz,status text,timezone text)
language plpgsql security definer set search_path='' as $$
declare c public.courts; club public.club_settings_versions; p public.policy_versions;
 s timestamptz; e timestamptz; q jsonb; selected_minutes integer;
begin
 if p_day is null or p_day<date '2000-01-01' or p_day>date '2100-12-31' then raise exception 'Invalid day' using errcode='22023'; end if;
 perform pg_advisory_xact_lock_shared(842017,1);
 select * into club from public.club_settings_versions where effective_from<=now() order by effective_from desc limit 1;
 select * into p from private.policy_at(clock_timestamp());
 if club.id is null or p.id is null then raise exception 'Configuration unavailable' using errcode='23514'; end if;
 selected_minutes:=coalesce(p_duration_minutes,private.minimum_legal_duration(p));
 if not private.duration_allowed(p,selected_minutes) then
  raise exception 'Selected duration does not satisfy the effective policy and single-day technical bound' using errcode='22023';
 end if;
 for c in select * from public.courts order by number loop
  for s in select generate_series(p_day::timestamp at time zone club.timezone,(p_day+1)::timestamp at time zone club.timezone-interval '1 minute',make_interval(mins=>p.start_increment_minutes)) loop
   e:=s+make_interval(mins=>selected_minutes);
   begin q:=private.quote(c.id,s,e); exception when check_violation then continue; end;
   court_id:=c.id; court_number:=c.number; starts_at:=s; ends_at:=e; timezone:=q->>'timezone';
   status:=case when exists(select 1 from public.court_occupancies o left join public.bookings b on b.id=o.booking_id
    where o.court_id=c.id and o.active and o.occupied_during && tstzrange(s,e,'[)')
    and (o.booking_id is null or b.status<>'held' or b.expires_at>clock_timestamp())) then 'unavailable' else 'available' end;
   return next;
  end loop;
 end loop;
end $$;
revoke all on function public.availability(date,integer) from public,anon,authenticated;
grant execute on function public.availability(date,integer) to anon,authenticated;
revoke all on function private.minimum_legal_duration(public.policy_versions),private.duration_allowed(public.policy_versions,numeric),private.validate_policy_duration() from public,anon,authenticated;

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
 or not private.duration_allowed(p,duration)
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
