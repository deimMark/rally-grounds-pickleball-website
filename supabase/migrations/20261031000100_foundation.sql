-- Single-club foundation. All app writes go through narrow authorized transactions.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create extension if not exists btree_gist with schema extensions;

create table public.staff_profiles (
  user_id uuid primary key references auth.users(id),
  role text not null check (role in ('owner','staff')),
  active boolean not null default true
);
create table public.courts (
  id uuid primary key default gen_random_uuid(),
  number integer not null unique check (number > 0),
  layout_row integer not null check (layout_row > 0),
  layout_column integer not null check (layout_column > 0),
  unique(layout_row,layout_column)
);
create table public.club_settings_versions (
  id uuid primary key default gen_random_uuid(),
  effective_from timestamptz not null unique check (isfinite(effective_from)),
  name text not null check (length(name) between 1 and 120),
  timezone text not null,
  branding jsonb not null default '{}' check (jsonb_typeof(branding)='object'),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  change_note text not null check (length(change_note) between 1 and 500)
);
create table public.policy_versions (
  id uuid primary key default gen_random_uuid(),
  effective_from timestamptz not null unique check (isfinite(effective_from)),
  minimum_minutes integer not null check (minimum_minutes > 0),
  start_increment_minutes integer not null check (start_increment_minutes > 0 and 60 % start_increment_minutes=0),
  duration_increment_minutes integer not null check (duration_increment_minutes > 0 and duration_increment_minutes <= 1440),
  guest_lead_minutes integer not null check (guest_lead_minutes >= 0),
  guest_cutoff_inclusive boolean,
  payment_window_minutes integer not null check (payment_window_minutes > 0),
  payment_cutoff_minutes integer check (payment_cutoff_minutes >= 0),
  no_refund_within_minutes integer not null check (no_refund_within_minutes >= 0),
  partial_refund_bps integer check (partial_refund_bps between 0 and 10000),
  booking_horizon_days integer check (booking_horizon_days > 0),
  max_duration_minutes integer check (max_duration_minutes >= minimum_minutes),
  provisional boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  change_note text not null check (length(change_note) between 1 and 500)
);
create table public.court_config_versions (
  id uuid primary key default gen_random_uuid(),
  court_id uuid not null references public.courts(id),
  effective_from timestamptz not null check (isfinite(effective_from)),
  enabled boolean not null,
  rate_centavos integer not null check (rate_centavos >= 0),
  opening_minute integer not null check (opening_minute between 0 and 1439),
  closing_minute integer not null check (closing_minute between 1 and 1440 and closing_minute > opening_minute),
  provisional boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  change_note text not null check (length(change_note) between 1 and 500),
  unique(court_id,effective_from)
);
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (length(display_name) between 1 and 120),
  contact text,
  created_at timestamptz not null default now()
);
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  reference uuid not null unique default gen_random_uuid(),
  customer_id uuid references public.customers(id),
  estimated_players integer not null check (estimated_players > 0),
  source text not null check (source in ('staff','walk_in','phone','guest_web','reclub')),
  status text not null default 'held' check (status in ('held','cancelled','expired')),
  expires_at timestamptz not null check (isfinite(expires_at)),
  total_centavos integer not null check (total_centavos >= 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create table public.booking_revisions (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id),
  policy_version_id uuid not null references public.policy_versions(id),
  club_version_id uuid not null references public.club_settings_versions(id),
  agreement jsonb not null check (jsonb_typeof(agreement)='object'),
  created_at timestamptz not null default now()
);
create table public.booking_items (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id),
  court_id uuid not null references public.courts(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  check(isfinite(starts_at) and isfinite(ends_at) and ends_at > starts_at),
  unique(booking_id,court_id)
);
create table public.court_occupancies (
  id uuid primary key default gen_random_uuid(),
  court_id uuid not null references public.courts(id),
  booking_id uuid references public.bookings(id),
  kind text not null check(kind in ('reservation','open_play','maintenance')),
  occupied_during tstzrange not null,
  active boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  check ((kind='reservation') = (booking_id is not null)),
  check (not isempty(occupied_during) and not lower_inf(occupied_during) and not upper_inf(occupied_during)
    and isfinite(lower(occupied_during)) and isfinite(upper(occupied_during))
    and lower_inc(occupied_during) and not upper_inc(occupied_during)),
  exclude using gist (court_id with =, occupied_during with &&) where(active)
);
create index occupancies_booking_idx on public.court_occupancies(booking_id);
create table public.idempotency_requests (
  actor_id uuid not null references auth.users(id),
  request_key uuid not null,
  operation text not null,
  payload jsonb not null,
  result jsonb not null,
  primary key(actor_id,request_key)
);
create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}',
  occurred_at timestamptz not null default now()
);

create function private.immutable_record() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Historical record is immutable' using errcode='23514'; end $$;
do $$ declare t text; begin
  foreach t in array array['club_settings_versions','policy_versions','court_config_versions','booking_revisions','booking_items','audit_events','idempotency_requests'] loop
    execute format('create trigger immutable_record before update or delete on public.%I for each row execute function private.immutable_record()',t);
  end loop;
end $$;
create function private.booking_transition() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' or (to_jsonb(new)-'status') is distinct from (to_jsonb(old)-'status')
    or old.status <> 'held' or new.status not in ('expired','cancelled') then
  raise exception 'Invalid booking mutation' using errcode='23514';
 end if;
 return new;
end $$;
create trigger booking_transition before update or delete on public.bookings for each row execute function private.booking_transition();
create function private.occupancy_transition() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' or (to_jsonb(new)-'active') is distinct from (to_jsonb(old)-'active') or not old.active or new.active then
  raise exception 'Occupancy can only be released' using errcode='23514';
 end if;
 return new;
end $$;
create trigger occupancy_transition before update or delete on public.court_occupancies for each row execute function private.occupancy_transition();

create function public.current_staff_role() returns text language sql stable security definer set search_path='' as $$
 select role from public.staff_profiles where user_id=auth.uid() and active
$$;
create function private.require_staff(owner_only boolean default false) returns void language plpgsql security definer set search_path='' as $$
begin
 if public.current_staff_role() is null or (owner_only and public.current_staff_role()<>'owner') then
  raise exception 'Active staff authorization required' using errcode='42501';
 end if;
end $$;
create function private.audit(p_action text,p_type text,p_id uuid,p_metadata jsonb default '{}') returns void language sql security definer set search_path='' as $$
 insert into public.audit_events(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),p_action,p_type,p_id,p_metadata)
$$;

create function private.policy_at(p_at timestamptz) returns public.policy_versions language sql stable security definer set search_path='' as $$
 select p from public.policy_versions p where effective_from<=p_at order by effective_from desc limit 1
$$;

create function private.quote(p_court uuid,p_start timestamptz,p_end timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$
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
   'policy',to_jsonb(p),'timezone',club.timezone,'segments',segments);
end $$;

create function public.quote_reservation(p_court_id uuid,p_start timestamptz,p_end timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform private.require_staff(); return private.quote(p_court_id,p_start,p_end); end $$;

create function private.expire_holds(p_court uuid) returns void language plpgsql security definer set search_path='' as $$
declare b public.bookings;
begin
 for b in select x.* from public.bookings x join public.booking_items i on i.booking_id=x.id
  where i.court_id=p_court and x.status='held' and x.expires_at<=clock_timestamp() order by x.id for update of x loop
  update public.court_occupancies set active=false where booking_id=b.id and active;
  update public.bookings set status='expired' where id=b.id;
  perform private.audit('hold.expired','booking',b.id);
 end loop;
end $$;

create function public.create_reservation(p_court_id uuid,p_start timestamptz,p_end timestamptz,p_players integer,p_source text,
 p_request_key uuid,p_expected_total integer,p_hold_until timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$
declare q jsonb; b public.bookings; payload jsonb; previous public.idempotency_requests; result jsonb;
begin
 perform pg_advisory_xact_lock_shared(842017,1);
 perform private.require_staff();
 if p_request_key is null then raise exception 'Idempotency key required' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_request_key::text,0));
 payload:=jsonb_build_object('court',p_court_id,'start',p_start,'end',p_end,'players',p_players,'source',p_source,'total',p_expected_total,'hold_until',p_hold_until);
 select * into previous from public.idempotency_requests where actor_id=auth.uid() and request_key=p_request_key;
 if found then
  if previous.operation<>'reservation.create' or previous.payload<>payload then raise exception 'Idempotency payload changed' using errcode='22023'; end if;
  return previous.result;
 end if;
 perform 1 from public.courts where id=p_court_id for update;
 if not found then raise exception 'Unknown court' using errcode='22023'; end if;
 perform private.expire_holds(p_court_id);
 q:=private.quote(p_court_id,p_start,p_end);
 if p_start<=clock_timestamp() or p_expected_total is null or p_expected_total<>(q->>'total_centavos')::integer
  or p_hold_until is null or not isfinite(p_hold_until) or p_hold_until<=clock_timestamp() or p_hold_until>p_start
  or p_hold_until>now()+make_interval(mins=>(q->'policy'->>'payment_window_minutes')::integer) then
  raise exception 'Invalid start, agreed total or explicit staff hold deadline' using errcode='22023';
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

create function public.release_reservation(p_booking_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare b public.bookings;
begin
 perform pg_advisory_xact_lock_shared(842017,1); perform private.require_staff();
 perform c.id from public.courts c join public.booking_items i on i.court_id=c.id where i.booking_id=p_booking_id order by c.id for update of c;
 select * into b from public.bookings where id=p_booking_id for update;
 if not found then raise exception 'Unknown booking' using errcode='22023'; end if;
 if b.status<>'held' then return; end if;
 update public.court_occupancies set active=false where booking_id=b.id and active;
 update public.bookings set status=case when b.expires_at<=clock_timestamp() then 'expired' else 'cancelled' end where id=b.id;
 perform private.audit('reservation.released','booking',b.id);
end $$;

create function public.block_courts(p_court_ids uuid[],p_start timestamptz,p_end timestamptz,p_kind text,p_request_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare c uuid; payload jsonb; previous public.idempotency_requests; result jsonb; ids jsonb:='[]'; new_id uuid;
begin
 perform pg_advisory_xact_lock_shared(842017,1); perform private.require_staff();
 if p_court_ids is null or cardinality(p_court_ids) not between 1 and 100 or array_position(p_court_ids,null) is not null
  or p_request_key is null or p_kind not in ('open_play','maintenance') or p_kind is null
  or p_start is null or p_end is null or not isfinite(p_start) or not isfinite(p_end) or p_start<=now() or p_end<=p_start or p_end-p_start>interval '24 hours' then
  raise exception 'Invalid block' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_request_key::text,0));
 payload:=jsonb_build_object('courts',to_jsonb(array(select distinct x from unnest(p_court_ids) x order by x)),'start',p_start,'end',p_end,'kind',p_kind);
 select * into previous from public.idempotency_requests where actor_id=auth.uid() and request_key=p_request_key;
 if found then
  if previous.operation<>'court.block' or previous.payload<>payload then raise exception 'Idempotency payload changed' using errcode='22023'; end if;
  return previous.result;
 end if;
 for c in select distinct x from unnest(p_court_ids) x order by x loop
  perform 1 from public.courts where id=c for update;
  if not found then raise exception 'Unknown court' using errcode='22023'; end if;
  perform private.expire_holds(c);
  insert into public.court_occupancies(court_id,kind,occupied_during,created_by) values(c,p_kind,tstzrange(p_start,p_end,'[)'),auth.uid()) returning id into new_id;
  ids:=ids||jsonb_build_array(new_id);
  perform private.audit('court.blocked','occupancy',new_id,jsonb_build_object('kind',p_kind,'court_id',c));
 end loop;
 result:=jsonb_build_object('occupancy_ids',ids);
 insert into public.idempotency_requests values(auth.uid(),p_request_key,'court.block',payload,result);
 return result;
end $$;

create function public.availability(p_day date) returns table(court_id uuid,court_number integer,starts_at timestamptz,ends_at timestamptz,status text,timezone text) language plpgsql security definer set search_path='' as $$
declare c public.courts; club public.club_settings_versions; p public.policy_versions; s timestamptz; e timestamptz; q jsonb;
begin
 if p_day is null or p_day<date '2000-01-01' or p_day>date '2100-12-31' then raise exception 'Invalid day' using errcode='22023'; end if;
 select * into club from public.club_settings_versions where effective_from<=now() order by effective_from desc limit 1;
 select * into p from private.policy_at(clock_timestamp());
 if club.id is null or p.id is null then raise exception 'Configuration unavailable' using errcode='23514'; end if;
 for c in select * from public.courts order by number loop
  for s in select generate_series(p_day::timestamp at time zone club.timezone,(p_day+1)::timestamp at time zone club.timezone-interval '1 minute',make_interval(mins=>p.start_increment_minutes)) loop
   e:=s+make_interval(mins=>p.minimum_minutes);
   begin q:=private.quote(c.id,s,e); exception when check_violation then continue; end;
   court_id:=c.id; court_number:=c.number; starts_at:=s; ends_at:=e; timezone:=q->>'timezone';
   status:=case when exists(select 1 from public.court_occupancies o left join public.bookings b on b.id=o.booking_id
     where o.court_id=c.id and o.active and o.occupied_during && tstzrange(s,e,'[)') and (o.booking_id is null or b.status<>'held' or b.expires_at>clock_timestamp())) then 'unavailable' else 'available' end;
   return next;
  end loop;
 end loop;
end $$;

create function public.publish_policy(p_effective timestamptz,p_changes jsonb,p_note text) returns uuid language plpgsql security definer set search_path='' as $$
declare base public.policy_versions; v public.policy_versions; result uuid; effective timestamptz:=coalesce(p_effective,now());
begin
 perform pg_advisory_xact_lock(842017,1); perform private.require_staff(true);
 if not isfinite(effective) or effective<now() or p_changes is null or jsonb_typeof(p_changes)<>'object' or
 exists(select 1 from jsonb_object_keys(p_changes) k where k not in ('minimum_minutes','start_increment_minutes','duration_increment_minutes','guest_lead_minutes','guest_cutoff_inclusive','payment_window_minutes','payment_cutoff_minutes','no_refund_within_minutes','partial_refund_bps','booking_horizon_days','max_duration_minutes','provisional')) then
  raise exception 'Invalid policy publication' using errcode='22023'; end if;
 select * into base from public.policy_versions where effective_from<=effective order by effective_from desc limit 1;
 select * into v from jsonb_populate_record(base,p_changes);
 insert into public.policy_versions(effective_from,minimum_minutes,start_increment_minutes,duration_increment_minutes,guest_lead_minutes,guest_cutoff_inclusive,payment_window_minutes,payment_cutoff_minutes,no_refund_within_minutes,partial_refund_bps,booking_horizon_days,max_duration_minutes,provisional,created_by,change_note)
 values(effective,v.minimum_minutes,v.start_increment_minutes,v.duration_increment_minutes,v.guest_lead_minutes,v.guest_cutoff_inclusive,v.payment_window_minutes,v.payment_cutoff_minutes,v.no_refund_within_minutes,v.partial_refund_bps,v.booking_horizon_days,v.max_duration_minutes,v.provisional,auth.uid(),p_note) returning id into result;
 perform private.audit('policy.published','policy_version',result,jsonb_build_object('effective_from',effective)); return result;
end $$;

create function public.publish_court_config(p_court_id uuid,p_effective timestamptz,p_changes jsonb,p_note text) returns uuid language plpgsql security definer set search_path='' as $$
declare base public.court_config_versions; v public.court_config_versions; tz text; result uuid; effective timestamptz:=coalesce(p_effective,now());
begin
 perform pg_advisory_xact_lock(842017,1); perform private.require_staff(true);
 select timezone into tz from public.club_settings_versions where effective_from<=effective order by effective_from desc limit 1;
 if not isfinite(effective) or effective<now() or (p_effective is not null and date_trunc('hour',effective at time zone tz)<>effective at time zone tz)
 or p_changes is null or jsonb_typeof(p_changes)<>'object' or exists(select 1 from jsonb_object_keys(p_changes) k where k not in ('enabled','rate_centavos','opening_minute','closing_minute','provisional')) then
  raise exception 'Invalid court configuration publication' using errcode='22023'; end if;
 select * into base from public.court_config_versions where court_id=p_court_id and effective_from<=effective order by effective_from desc limit 1;
 if base.id is null then raise exception 'Unknown court configuration' using errcode='22023'; end if;
 select * into v from jsonb_populate_record(base,p_changes);
 if exists(select 1 from public.court_occupancies o left join public.bookings b on b.id=o.booking_id where o.court_id=p_court_id and o.active and upper(o.occupied_during)>effective
   and (o.booking_id is null or b.status<>'held' or b.expires_at>clock_timestamp()) and (not v.enabled
    or extract(hour from lower(o.occupied_during) at time zone tz)*60+extract(minute from lower(o.occupied_during) at time zone tz)<v.opening_minute
    or extract(epoch from((upper(o.occupied_during) at time zone tz)-date_trunc('day',lower(o.occupied_during) at time zone tz)))/60>v.closing_minute)) then
  raise exception 'Existing occupancy requires resolution before publication' using errcode='23514'; end if;
 insert into public.court_config_versions(court_id,effective_from,enabled,rate_centavos,opening_minute,closing_minute,provisional,created_by,change_note)
 values(p_court_id,effective,v.enabled,v.rate_centavos,v.opening_minute,v.closing_minute,v.provisional,auth.uid(),p_note) returning id into result;
 perform private.audit('court_config.published','court_config_version',result,jsonb_build_object('court_id',p_court_id,'effective_from',effective)); return result;
end $$;

create function public.publish_club_settings(p_effective timestamptz,p_name text,p_timezone text,p_branding jsonb,p_note text) returns uuid language plpgsql security definer set search_path='' as $$
declare effective timestamptz:=coalesce(p_effective,now()); result uuid; old_tz text;
begin
 perform pg_advisory_xact_lock(842017,1); perform private.require_staff(true);
 if effective<now() or not isfinite(effective) or not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then raise exception 'Invalid club configuration' using errcode='22023'; end if;
 select timezone into old_tz from public.club_settings_versions where effective_from<=effective order by effective_from desc limit 1;
 if old_tz is distinct from p_timezone then
  raise exception 'Deployment timezone changes require a separately reviewed migration' using errcode='23514'; end if;
 insert into public.club_settings_versions(effective_from,name,timezone,branding,created_by,change_note) values(effective,p_name,p_timezone,p_branding,auth.uid(),p_note) returning id into result;
 perform private.audit('club_settings.published','club_settings_version',result); return result;
end $$;

create function public.set_staff_role(p_user_id uuid,p_role text,p_active boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(842017,1); perform private.require_staff(true);
 if exists(select 1 from public.staff_profiles where user_id=p_user_id and role='owner' and active)
 and (p_role is distinct from 'owner' or not p_active or p_active is null)
 and (select count(*) from public.staff_profiles where role='owner' and active)<=1 then raise exception 'Last active owner cannot be removed' using errcode='23514'; end if;
 insert into public.staff_profiles values(p_user_id,p_role,p_active) on conflict(user_id) do update set role=excluded.role,active=excluded.active;
 perform private.audit('staff.role_changed','staff_profile',p_user_id,jsonb_build_object('role',p_role,'active',p_active));
end $$;

-- Tables are never directly writable by app roles. Safe RPCs perform all mutations.
do $$ declare t text; begin
 foreach t in array array['courts','club_settings_versions','policy_versions','court_config_versions','staff_profiles','customers','bookings','booking_revisions','booking_items','court_occupancies','idempotency_requests','audit_events'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  if t='staff_profiles' then
   execute 'create policy staff_profile_read on public.staff_profiles for select to authenticated using(user_id=auth.uid() or public.current_staff_role()=''owner'')';
  elsif t in ('customers','audit_events','idempotency_requests') then
   execute format('create policy owner_read on public.%I for select to authenticated using(public.current_staff_role()=''owner'')',t);
  else
   execute format('create policy staff_read on public.%I for select to authenticated using(public.current_staff_role() is not null)',t);
  end if;
 end loop;
end $$;
revoke all on all functions in schema private from public,anon,authenticated;
revoke all on function public.current_staff_role(),public.quote_reservation(uuid,timestamptz,timestamptz),
 public.create_reservation(uuid,timestamptz,timestamptz,integer,text,uuid,integer,timestamptz),public.release_reservation(uuid),
 public.block_courts(uuid[],timestamptz,timestamptz,text,uuid),public.availability(date),public.publish_policy(timestamptz,jsonb,text),
 public.publish_court_config(uuid,timestamptz,jsonb,text),public.publish_club_settings(timestamptz,text,text,jsonb,text),public.set_staff_role(uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.current_staff_role(),public.quote_reservation(uuid,timestamptz,timestamptz),
 public.create_reservation(uuid,timestamptz,timestamptz,integer,text,uuid,integer,timestamptz),public.release_reservation(uuid),
 public.block_courts(uuid[],timestamptz,timestamptz,text,uuid),public.publish_policy(timestamptz,jsonb,text),
 public.publish_court_config(uuid,timestamptz,jsonb,text),public.publish_club_settings(timestamptz,text,text,jsonb,text),public.set_staff_role(uuid,text,boolean) to authenticated;
grant execute on function public.availability(date) to anon,authenticated;
