-- Local synthetic guest holds. No enabled/live commercial policy is seeded here.
create table private.guest_booking_policies (
 id uuid primary key default gen_random_uuid(),
 effective_from timestamptz not null unique check(isfinite(effective_from)),
 purpose text not null check(purpose='synthetic_local_only'),
 quote_ttl_seconds integer not null check(quote_ttl_seconds between 1 and 3600),
 window_seconds integer not null check(window_seconds between 1 and 86400),
 request_limit integer not null check(request_limit between 1 and 100000),
 intent_request_limit integer not null check(intent_request_limit between 1 and 10000),
 max_quotes integer not null check(max_quotes between 1 and 1000),
 max_pending_requests integer not null check(max_pending_requests between 1 and 1000),
 max_active_holds integer not null check(max_active_holds between 1 and 1000),
 max_players integer not null check(max_players between 1 and 1000),
 minimum_payment_seconds integer not null check(minimum_payment_seconds between 1 and 86400),
 retention_seconds integer not null check(retention_seconds between 3600 and 2592000),
 contact_kind text not null check(contact_kind='synthetic_email'),
 public_terms jsonb not null check(jsonb_typeof(public_terms)='object' and public_terms ? 'notice'
  and public_terms-array['notice','privacy','cancellation','hours']='{}'::jsonb
  and jsonb_typeof(public_terms->'notice')='string')
);
create table private.guest_quotes (
 id uuid primary key default gen_random_uuid(), intent_id uuid not null references private.guest_intents(id),
 court_id uuid not null references public.courts(id), starts_at timestamptz not null, ends_at timestamptz not null,
 duration_minutes integer not null check(duration_minutes between 1 and 1440),
 context jsonb not null, public_terms jsonb not null,
 guest_policy_id uuid not null references private.guest_booking_policies(id),
 created_at timestamptz not null, valid_until timestamptz not null, delete_after timestamptz not null,
 check(isfinite(starts_at) and isfinite(ends_at) and ends_at>starts_at),
 check(valid_until>created_at and delete_after>=valid_until)
);
create index guest_quotes_intent on private.guest_quotes(intent_id);
create table private.guest_booking_requests (
 intent_id uuid not null references private.guest_intents(id),
 operation text not null default 'reservation.create' check(operation='reservation.create'),
 request_key uuid not null, fingerprint text not null check(fingerprint ~ '^[0-9a-f]{64}$'),
 created_at timestamptz not null, delete_after timestamptz not null,
 booking_id uuid unique references public.bookings(id), receipt jsonb,
 primary key(intent_id,operation,request_key),
 check((booking_id is null)=(receipt is null))
);
create table private.guest_operation_buckets (
 bucket_key text not null check(bucket_key ~ '^[0-9a-f]{64}$'),
 operation text not null check(operation in ('availability','quote','create','read')),
 window_start timestamptz not null, hits integer not null check(hits>0), delete_after timestamptz not null,
 primary key(bucket_key,operation,window_start)
);
create index guest_requests_cleanup on private.guest_booking_requests(delete_after);
create index guest_quotes_cleanup on private.guest_quotes(delete_after);
create index guest_operations_cleanup on private.guest_operation_buckets(delete_after);
alter table public.bookings alter column created_by drop not null;
alter table public.bookings add column actor_kind text not null default 'staff' check(actor_kind in ('staff','guest'));
alter table public.bookings add column guest_intent_id uuid unique references private.guest_intents(id);
alter table public.bookings add constraint booking_actor_check check(
 (actor_kind='staff' and created_by is not null and guest_intent_id is null) or
 (actor_kind='guest' and created_by is null and guest_intent_id is not null and customer_id is not null and source='guest_web'));
alter table public.court_occupancies alter column created_by drop not null;
create function private.validate_occupancy_actor() returns trigger language plpgsql set search_path='' as $$
begin
 if new.created_by is null and (new.kind<>'reservation' or not exists(
  select 1 from public.bookings where id=new.booking_id and actor_kind='guest' and created_by is null)) then
  raise exception 'Invalid occupancy actor' using errcode='23514';
 end if;
 return new;
end $$;
create trigger validate_occupancy_actor before insert on public.court_occupancies for each row execute function private.validate_occupancy_actor();
create function private.guest_request_immutable() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' or (to_jsonb(new)-'booking_id'-'receipt') is distinct from (to_jsonb(old)-'booking_id'-'receipt')
 or old.booking_id is not null or new.booking_id is null or new.receipt is null then
  raise exception 'Immutable guest request' using errcode='23514';
 end if;
 return new;
end $$;
create trigger guest_request_immutable before update or delete on private.guest_booking_requests for each row execute function private.guest_request_immutable();
create trigger guest_quote_immutable before update or delete on private.guest_quotes for each row execute function private.immutable_record();
create trigger guest_policy_immutable before update or delete on private.guest_booking_policies for each row execute function private.immutable_record();
do $$ declare t text; begin
 foreach t in array array['guest_booking_policies','guest_quotes','guest_booking_requests','guest_operation_buckets'] loop
  execute format('alter table private.%I enable row level security',t);
  execute format('revoke all on private.%I from public,anon,authenticated,service_role',t);
 end loop;
end $$;

-- Lock order: configuration -> operation bucket(s) -> intent/request -> court -> booking.
-- Every gateway checks the existing local key binding as well as the explicit guest policy.
create function private.guest_booking_policy(p_key text) returns private.guest_booking_policies
language plpgsql set search_path='' as $$
declare c private.guest_security_config; g private.guest_booking_policies; p public.policy_versions;
begin
 perform pg_advisory_xact_lock_shared(842017,1);
 select * into c from private.guest_security_config where singleton for share;
 select * into g from private.guest_booking_policies where effective_from<=clock_timestamp() order by effective_from desc limit 1;
 select * into p from private.policy_at(clock_timestamp());
 if c.singleton is null or not c.enabled or p_key is distinct from c.key_fingerprint or g.id is null
 or p.id is null or p.booking_horizon_days is null or p.max_duration_minutes is null
 or p.guest_cutoff_inclusive is null or p.payment_cutoff_minutes is null
 or (select timezone from public.club_settings_versions where effective_from<=clock_timestamp() order by effective_from desc limit 1) is distinct from 'Asia/Manila' then
  raise exception 'POLICY_NOT_READY' using errcode='P0001';
 end if;
 perform private.minimum_legal_duration(p);
 return g;
end $$;
create function private.guest_budget(p_bucket text,p_operation text,p_limit integer,g private.guest_booking_policies) returns boolean
language plpgsql set search_path='' as $$
declare w timestamptz; n integer;
begin
 if p_bucket is null or p_bucket !~ '^[0-9a-f]{64}$' then raise exception 'INVALID_REQUEST' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('guest.operation:'||p_operation||':'||p_bucket,0));
 w:=to_timestamp(floor(extract(epoch from clock_timestamp())/g.window_seconds)*g.window_seconds);
 insert into private.guest_operation_buckets values(p_bucket,p_operation,w,1,w+make_interval(secs=>g.retention_seconds))
 on conflict(bucket_key,operation,window_start) do update set hits=least(private.guest_operation_buckets.hits+1,p_limit+1)
 returning hits into n;
 return n<=p_limit;
end $$;
create function private.guest_capability(p_id uuid,p_hash text,p_network text) returns private.guest_intents
language plpgsql set search_path='' as $$
declare i private.guest_intents;
begin
 select * into i from private.guest_intents where id=p_id for update;
 if i.id is null or p_hash is null or p_hash !~ '^[0-9a-f]{64}$' or i.credential_hash<>p_hash
 or i.network_key is distinct from p_network or i.revoked_at is not null or i.access_expires_at<=clock_timestamp()
 or i.scope<>'guest_intent' then raise exception 'GUEST_ACCESS_REQUIRED' using errcode='42501'; end if;
 return i;
end $$;
create function private.guest_deadline(p_start timestamptz,g private.guest_booking_policies) returns timestamptz
language plpgsql set search_path='' as $$
declare p public.policy_versions; observed timestamptz:=clock_timestamp(); d timestamptz;
begin
 select * into p from private.policy_at(observed);
 if (p.guest_cutoff_inclusive and p_start<=observed+make_interval(mins=>p.guest_lead_minutes))
 or (not p.guest_cutoff_inclusive and p_start<observed+make_interval(mins=>p.guest_lead_minutes))
 or p_start>observed+make_interval(days=>p.booking_horizon_days) then
  raise exception 'SLOT_UNAVAILABLE' using errcode='P0001';
 end if;
 d:=least(observed+make_interval(mins=>p.payment_window_minutes),p_start-make_interval(mins=>p.payment_cutoff_minutes));
 if d<observed+make_interval(secs=>g.minimum_payment_seconds) then raise exception 'SLOT_UNAVAILABLE' using errcode='P0001'; end if;
 return d;
end $$;
create function public.guest_availability(p_day date,p_duration integer,p_network_key text,p_key_fingerprint text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare g private.guest_booking_policies; p public.policy_versions; slots jsonb:='[]'; r record;
begin
 perform private.require_guest_gateway();
 g:=private.guest_booking_policy(p_key_fingerprint);
 if not private.guest_budget(p_network_key,'availability',g.request_limit,g) then return jsonb_build_object('outcome','rate_limited','retryAfterSeconds',g.window_seconds); end if;
 select * into p from private.policy_at(clock_timestamp());
 if p_duration is null or not private.duration_allowed(p,p_duration) then raise exception 'DURATION_UNSUPPORTED' using errcode='22023'; end if;
 for r in select * from public.availability(p_day,p_duration) loop
  begin
   perform private.guest_deadline(r.starts_at,g);
  exception when sqlstate 'P0001' then continue; end;
  slots:=slots||jsonb_build_array(jsonb_build_object('courtId',r.court_id,'startsAt',r.starts_at,'endsAt',r.ends_at,'status',r.status));
 end loop;
 return jsonb_build_object('outcome','ok','day',p_day,'durationMinutes',p_duration,'timezone','Asia/Manila',
 'courts',(select jsonb_agg(jsonb_build_object('id',id,'number',number,'layoutRow',layout_row,'layoutColumn',layout_column) order by number) from public.courts),'slots',slots);
end $$;
create function public.guest_quote(p_id uuid,p_hash text,p_network_key text,p_key_fingerprint text,p_court uuid,p_start timestamptz,p_duration integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare g private.guest_booking_policies; i private.guest_intents; q jsonb; row private.guest_quotes; e timestamptz; observed timestamptz;
begin
 perform private.require_guest_gateway();g:=private.guest_booking_policy(p_key_fingerprint);
 if not private.guest_budget(p_network_key,'quote',g.request_limit,g) then return jsonb_build_object('outcome','rate_limited','retryAfterSeconds',g.window_seconds); end if;
 begin i:=private.guest_capability(p_id,p_hash,p_network_key);
 exception when insufficient_privilege then return jsonb_build_object('outcome','guest_access_required'); end;
 if not private.guest_budget(i.credential_hash,'quote',g.intent_request_limit,g) then return jsonb_build_object('outcome','rate_limited','retryAfterSeconds',g.window_seconds); end if;
 if i.booking_id is not null then return jsonb_build_object('outcome','intent_already_bound'); end if;
 if i.create_expires_at<=clock_timestamp() then return jsonb_build_object('outcome','intent_expired'); end if;
 if (select count(*) from private.guest_quotes where intent_id=i.id)>=g.max_quotes then return jsonb_build_object('outcome','rate_limited','retryAfterSeconds',g.window_seconds); end if;
 if p_duration is null then raise exception 'DURATION_UNSUPPORTED' using errcode='22023'; end if;
 e:=p_start+make_interval(mins=>p_duration);
 perform private.guest_deadline(p_start,g);
 q:=private.quote(p_court,p_start,e);
 if q->>'timezone'<>'Asia/Manila' then raise exception 'POLICY_NOT_READY' using errcode='P0001'; end if;
 observed:=clock_timestamp();
 insert into private.guest_quotes(intent_id,court_id,starts_at,ends_at,duration_minutes,context,public_terms,guest_policy_id,created_at,valid_until,delete_after)
 values(i.id,p_court,p_start,e,p_duration,q,g.public_terms,g.id,observed,least(observed+make_interval(secs=>g.quote_ttl_seconds),i.create_expires_at),
 observed+make_interval(secs=>g.retention_seconds)) returning * into row;
 return jsonb_build_object('outcome','created','quote',jsonb_build_object('quoteId',row.id,'courtId',row.court_id,'startsAt',row.starts_at,'endsAt',row.ends_at,
 'durationMinutes',row.duration_minutes,'totalCentavos',(q->>'total_centavos')::integer,'currency','PHP','terms',row.public_terms,
 'versionContext',(q->'version_context')||jsonb_build_object('guestPolicyId',g.id),'validUntil',row.valid_until));
end $$;
-- Boundary A: durable request fingerprint and quota. Domain failures cannot roll this back.
create function public.guest_request_admit(p_id uuid,p_hash text,p_network_key text,p_key_fingerprint text,p_request_key uuid,p_fingerprint text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare g private.guest_booking_policies; i private.guest_intents; r private.guest_booking_requests;
begin
 perform private.require_guest_gateway();g:=private.guest_booking_policy(p_key_fingerprint);
 if p_request_key is null or p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{64}$' then raise exception 'INVALID_REQUEST' using errcode='22023'; end if;
 if not private.guest_budget(p_network_key,'create',g.request_limit,g) then return jsonb_build_object('outcome','rate_limited','retryAfterSeconds',g.window_seconds); end if;
 begin i:=private.guest_capability(p_id,p_hash,p_network_key);
 exception when insufficient_privilege then return jsonb_build_object('outcome','guest_access_required'); end;
 if not private.guest_budget(i.credential_hash,'create',g.intent_request_limit,g) then return jsonb_build_object('outcome','rate_limited','retryAfterSeconds',g.window_seconds); end if;
 select * into r from private.guest_booking_requests where intent_id=i.id and operation='reservation.create' and request_key=p_request_key;
 if found then
  if r.fingerprint<>p_fingerprint then return jsonb_build_object('outcome','request_mismatch'); end if;
  return jsonb_build_object('outcome','admitted');
 end if;
 if i.booking_id is not null then return jsonb_build_object('outcome','intent_already_bound'); end if;
 if i.create_expires_at<=clock_timestamp() then return jsonb_build_object('outcome','intent_expired'); end if;
 if (select count(*) from private.guest_booking_requests where intent_id=i.id)>=g.max_pending_requests then return jsonb_build_object('outcome','rate_limited','retryAfterSeconds',g.window_seconds); end if;
 insert into private.guest_booking_requests(intent_id,request_key,fingerprint,created_at,delete_after)
 values(i.id,p_request_key,p_fingerprint,clock_timestamp(),clock_timestamp()+make_interval(secs=>g.retention_seconds));
 return jsonb_build_object('outcome','admitted');
end $$;
create function private.guest_current(p_booking uuid) returns jsonb language sql set search_path='' as $$
 select jsonb_build_object('status',case when status='held' and expires_at<=clock_timestamp() then 'expired' else status end,
 'expiresAt',expires_at,'observedAt',clock_timestamp()) from public.bookings where id=p_booking
$$;
-- Boundary B: any error rolls back the entire domain, but not the already committed admission.
create function public.guest_reservation_create(p_id uuid,p_hash text,p_network_key text,p_key_fingerprint text,p_request_key uuid,p_fingerprint text,
 p_quote_id uuid,p_name text,p_contact text,p_players integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare g private.guest_booking_policies; i private.guest_intents; r private.guest_booking_requests; q private.guest_quotes;
 fresh jsonb; b public.bookings; customer uuid; deadline timestamptz; v_receipt jsonb;
begin
 perform private.require_guest_gateway();g:=private.guest_booking_policy(p_key_fingerprint);
 i:=private.guest_capability(p_id,p_hash,p_network_key);
 select * into r from private.guest_booking_requests where intent_id=i.id and operation='reservation.create' and request_key=p_request_key for update;
 if r.intent_id is null or r.fingerprint is distinct from p_fingerprint then raise exception 'REQUEST_MISMATCH' using errcode='P0001'; end if;
 if r.booking_id is not null then
  return jsonb_build_object('receipt',r.receipt,'current',private.guest_current(r.booking_id),'replayed',true);
 end if;
 if i.booking_id is not null then raise exception 'INTENT_ALREADY_BOUND' using errcode='P0001'; end if;
 if i.create_expires_at<=clock_timestamp() then raise exception 'INTENT_EXPIRED' using errcode='P0001'; end if;
 select * into q from private.guest_quotes where id=p_quote_id and intent_id=i.id;
 if q.id is null or q.valid_until<=clock_timestamp() or q.guest_policy_id<>g.id then raise exception 'QUOTE_REVIEW_REQUIRED' using errcode='P0001'; end if;
 if p_name is null or length(p_name) not between 1 and 120 or p_name<>btrim(p_name) or p_name ~ '[[:cntrl:]]'
 or p_contact is null or length(p_contact)>254 or p_contact !~ '^[A-Za-z0-9.!#$%&''*+/=?^_`{|}~-]+@example[.]invalid$'
 or p_players is null or p_players not between 1 and g.max_players then raise exception 'INVALID_REQUEST' using errcode='22023'; end if;
 -- Serialize the shared local active-hold budget BEFORE taking court locks.
 -- All guest intents share this network lock; staff operations need only court->booking locks.
 perform pg_advisory_xact_lock(hashtextextended('guest.holds:'||p_network_key,0));
 if (select count(*) from public.bookings x join private.guest_intents gi on gi.id=x.guest_intent_id
  where gi.network_key=p_network_key and x.status='held' and x.expires_at>clock_timestamp())>=g.max_active_holds then
  raise exception 'RATE_LIMITED' using errcode='P0001',detail=g.window_seconds::text;
 end if;
 perform 1 from public.courts where id=q.court_id for update;
 perform private.expire_holds(q.court_id);
 begin fresh:=private.quote(q.court_id,q.starts_at,q.ends_at);
 exception when check_violation or invalid_parameter_value then
  raise exception 'QUOTE_REVIEW_REQUIRED' using errcode='P0001';
 end;
 if fresh is distinct from q.context then raise exception 'QUOTE_REVIEW_REQUIRED' using errcode='P0001'; end if;
 if i.create_expires_at<=clock_timestamp() or i.access_expires_at<=clock_timestamp() then raise exception 'INTENT_EXPIRED' using errcode='P0001'; end if;
 if q.valid_until<=clock_timestamp() or g.id<>(select id from private.guest_booking_policies where effective_from<=clock_timestamp() order by effective_from desc limit 1) then
  raise exception 'QUOTE_REVIEW_REQUIRED' using errcode='P0001';
 end if;
 deadline:=private.guest_deadline(q.starts_at,g);
 insert into public.customers(display_name,contact) values(p_name,p_contact) returning id into customer;
 insert into public.bookings(customer_id,estimated_players,source,expires_at,total_centavos,created_by,actor_kind,guest_intent_id,created_at)
 values(customer,p_players,'guest_web',deadline,(fresh->>'total_centavos')::integer,null,'guest',i.id,clock_timestamp()) returning * into b;
 insert into public.booking_revisions(booking_id,policy_version_id,club_version_id,agreement)
 values(b.id,(fresh->>'policy_version_id')::uuid,(fresh->>'club_version_id')::uuid,fresh||jsonb_build_object('guest_policy_version_id',g.id,'accepted_public_terms',q.public_terms));
 insert into public.booking_items(booking_id,court_id,starts_at,ends_at) values(b.id,q.court_id,q.starts_at,q.ends_at);
 insert into public.court_occupancies(court_id,booking_id,kind,occupied_during,created_by)
 values(q.court_id,b.id,'reservation',tstzrange(q.starts_at,q.ends_at,'[)'),null);
 v_receipt:=jsonb_build_object('reference',b.reference,'createdAt',b.created_at,'totalCentavos',b.total_centavos,'currency','PHP','expiresAt',b.expires_at,'stateAtCreation','held');
 update private.guest_booking_requests set booking_id=b.id,receipt=v_receipt where intent_id=i.id and operation='reservation.create' and request_key=p_request_key;
 update private.guest_intents set booking_id=b.id where id=i.id;
 insert into public.audit_events(actor_id,action,entity_type,entity_id,metadata)
 values(null,'guest.reservation_created','booking',b.id,jsonb_build_object('actor_kind','guest','intent_id',i.id,'court_id',q.court_id));
 return jsonb_build_object('receipt',v_receipt,'current',private.guest_current(b.id),'replayed',false);
end $$;
create function public.guest_reservation_status(p_id uuid,p_hash text,p_network_key text,p_key_fingerprint text,p_reference uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare g private.guest_booking_policies; i private.guest_intents; r private.guest_booking_requests; terms jsonb;
begin
 perform private.require_guest_gateway();g:=private.guest_booking_policy(p_key_fingerprint);
 if not private.guest_budget(p_network_key,'read',g.request_limit,g) then return jsonb_build_object('outcome','rate_limited','retryAfterSeconds',g.window_seconds); end if;
 begin i:=private.guest_capability(p_id,p_hash,p_network_key);
 exception when insufficient_privilege then return jsonb_build_object('outcome','access_unavailable'); end;
 if not private.guest_budget(i.credential_hash,'read',g.intent_request_limit,g) then return jsonb_build_object('outcome','rate_limited','retryAfterSeconds',g.window_seconds); end if;
 select r0.* into r from private.guest_booking_requests r0 join public.bookings b on b.id=r0.booking_id
 where r0.intent_id=i.id and b.id=i.booking_id and b.guest_intent_id=i.id and b.reference=p_reference;
 if r.booking_id is null then return jsonb_build_object('outcome','access_unavailable'); end if;
 select agreement->'accepted_public_terms' into terms from public.booking_revisions where booking_id=r.booking_id;
 return jsonb_build_object('outcome','ok','receipt',r.receipt,'current',private.guest_current(r.booking_id),'agreedTerms',terms);
end $$;
-- New helpers and gateways are never executable by arbitrary database clients.
do $$ declare f record; begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where (n.nspname='private' and p.proname in ('validate_occupancy_actor','guest_request_immutable','guest_booking_policy','guest_budget','guest_capability','guest_deadline','guest_current'))
 or (n.nspname='public' and p.proname in ('guest_availability','guest_quote','guest_request_admit','guest_reservation_create','guest_reservation_status')) loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
  if f.signature::text like 'guest_%' then execute format('grant execute on function %s to service_role',f.signature); end if;
 end loop;
end $$;
