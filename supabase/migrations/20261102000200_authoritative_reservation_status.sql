-- An immutable operation receipt is not an authoritative current-state response.
-- Reads derive deadline expiry from database time without rewriting historical receipts.
create function private.reservation_state(p_booking_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare b public.bookings; observed timestamptz;
begin
 select * into b from public.bookings where id=p_booking_id;
 if not found then raise exception 'Unknown booking' using errcode='22023'; end if;
 observed:=clock_timestamp();
 return jsonb_build_object('id',b.id,'status',case when b.status='held' and b.expires_at<=observed then 'expired' else b.status end,
  'expires_at',b.expires_at,'observed_at',observed);
end $$;
create function public.reservation_status(p_booking_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_staff();
 return private.reservation_state(p_booking_id);
end $$;
revoke all on function private.reservation_state(uuid) from public,anon,authenticated;
revoke all on function public.reservation_status(uuid) from public,anon,authenticated;
grant execute on function public.reservation_status(uuid) to authenticated;

create or replace function public.create_reservation(p_court_id uuid,p_start timestamptz,p_end timestamptz,p_players integer,p_source text,
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
  return jsonb_build_object('receipt',previous.result,'current',private.reservation_state((previous.result->>'id')::uuid),'replayed',true);
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
 return jsonb_build_object('receipt',result,'current',private.reservation_state(b.id),'replayed',false);
end $$;
