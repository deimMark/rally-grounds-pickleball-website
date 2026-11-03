-- Local guest access foundation only: no guest booking mutation is exposed.
create table private.guest_security_config (
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false,
 purpose text not null check(purpose='synthetic_local_only'),
 create_ttl_seconds integer, access_ttl_seconds integer, window_seconds integer,
 max_requests integer, max_active_intents integer, max_cookie_count integer,
 retention_seconds integer, key_fingerprint text,
 check(not enabled or coalesce(
  create_ttl_seconds between 1 and 86400 and access_ttl_seconds between create_ttl_seconds and 604800
  and window_seconds between 1 and 86400 and max_requests between 1 and 100000
  and max_active_intents between 1 and 1000 and max_cookie_count between 1 and 30
  and retention_seconds between greatest(access_ttl_seconds,window_seconds) and 2592000
  and key_fingerprint ~ '^[0-9a-f]{64}$',false))
);
insert into private.guest_security_config(singleton,enabled,purpose) values(true,false,'synthetic_local_only');
create table private.guest_intents (
 id uuid primary key,
 credential_hash text not null unique check(credential_hash ~ '^[0-9a-f]{64}$'),
 scope text not null default 'guest_intent' check(scope='guest_intent'),
 network_key text not null check(network_key ~ '^[0-9a-f]{64}$'),
 created_at timestamptz not null,
 create_expires_at timestamptz not null,
 access_expires_at timestamptz not null,
 revoked_at timestamptz,
 booking_id uuid unique references public.bookings(id),
 delete_after timestamptz not null,
 check(isfinite(created_at) and isfinite(create_expires_at) and isfinite(access_expires_at) and isfinite(delete_after)),
 check(create_expires_at>created_at and access_expires_at>=create_expires_at and delete_after>=access_expires_at),
 check(revoked_at is null or (isfinite(revoked_at) and revoked_at>=created_at))
);
create index guest_intents_network on private.guest_intents(network_key,access_expires_at);
create table private.guest_rate_buckets (
 network_key text not null check(network_key ~ '^[0-9a-f]{64}$'),
 window_start timestamptz not null,
 hits integer not null check(hits>0),
 delete_after timestamptz not null,
 primary key(network_key,window_start)
);
create index guest_intents_cleanup on private.guest_intents(delete_after);
create index guest_rate_cleanup on private.guest_rate_buckets(delete_after);
do $$ declare t text; begin
 foreach t in array array['guest_security_config','guest_intents','guest_rate_buckets'] loop
  execute format('alter table private.%I enable row level security',t);
  execute format('revoke all on private.%I from public,anon,authenticated,service_role',t);
 end loop;
end $$;
create function private.guest_intent_immutable() returns trigger language plpgsql set search_path='' as $$
begin
 if (to_jsonb(new)-'booking_id'-'revoked_at') is distinct from (to_jsonb(old)-'booking_id'-'revoked_at')
  or (old.booking_id is not null and new.booking_id is distinct from old.booking_id)
  or (old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at) then
  raise exception 'Guest credential, deadline or binding is immutable' using errcode='23514';
 end if;
 return new;
end $$;
create trigger guest_intent_immutable before update on private.guest_intents for each row execute function private.guest_intent_immutable();
create function private.require_guest_gateway() returns void language plpgsql set search_path='' as $$
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Guest gateway required' using errcode='42501'; end if;
end $$;
create function public.guest_intent_admit(p_id uuid,p_hash text,p_network_key text,p_key_fingerprint text,p_cookie_count integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c private.guest_security_config; observed timestamptz; window_at timestamptz; requests integer;
 created private.guest_intents;
begin
 perform private.require_guest_gateway();
 if p_id is null or p_hash is null or p_hash !~ '^[0-9a-f]{64}$' or p_network_key is null
  or p_network_key !~ '^[0-9a-f]{64}$' or p_cookie_count is null or p_cookie_count not between 0 and 128 then
  raise exception 'Invalid guest admission' using errcode='22023';
 end if;
 select * into c from private.guest_security_config where singleton for share;
 if c.singleton is null or not c.enabled or p_key_fingerprint is distinct from c.key_fingerprint then
  return jsonb_build_object('outcome','policy_not_ready');
 end if;
 perform pg_advisory_xact_lock(hashtextextended('guest.admission:'||p_network_key,0));
 observed:=clock_timestamp();
 window_at:=to_timestamp(floor(extract(epoch from observed)/c.window_seconds)*c.window_seconds);
 insert into private.guest_rate_buckets values(p_network_key,window_at,1,window_at+make_interval(secs=>c.retention_seconds))
 on conflict(network_key,window_start) do update set hits=least(private.guest_rate_buckets.hits+1,c.max_requests+1)
 returning hits into requests;
 -- Return a controlled denial, not an exception: rejected attempts must commit accounting.
 if requests>c.max_requests then
  return jsonb_build_object('outcome','rate_limited','retryAfterSeconds',greatest(1,ceil(extract(epoch from(window_at+make_interval(secs=>c.window_seconds)-observed)))::integer));
 end if;
 if p_cookie_count>=c.max_cookie_count or (select count(*) from private.guest_intents
   where network_key=p_network_key and revoked_at is null and access_expires_at>observed)>=c.max_active_intents then
  return jsonb_build_object('outcome','rate_limited','retryAfterSeconds',c.access_ttl_seconds);
 end if;
 insert into private.guest_intents(id,credential_hash,network_key,created_at,create_expires_at,access_expires_at,delete_after)
 values(p_id,p_hash,p_network_key,observed,observed+make_interval(secs=>c.create_ttl_seconds),
  observed+make_interval(secs=>c.access_ttl_seconds),observed+make_interval(secs=>c.retention_seconds)) returning * into created;
 perform private.audit('guest.intent_created','guest_intent',p_id,jsonb_build_object('actor_kind','guest','scope','guest_intent'));
 return jsonb_build_object('outcome','created','intentId',created.id,'createExpiresAt',created.create_expires_at,'accessExpiresAt',created.access_expires_at);
end $$;
create function public.guest_intent_authorize(p_id uuid,p_hash text,p_scope text) returns boolean
language plpgsql security definer set search_path='' as $$
declare observed timestamptz:=clock_timestamp();
begin
 perform private.require_guest_gateway();
 if p_scope is null or p_scope not in ('create','access') or p_hash is null or p_hash !~ '^[0-9a-f]{64}$' then return false; end if;
 return exists(select 1 from private.guest_security_config where singleton and enabled)
  and exists(select 1 from private.guest_intents where id=p_id and credential_hash=p_hash
  and scope='guest_intent' and revoked_at is null and access_expires_at>observed
  and (p_scope='access' or (create_expires_at>observed and booking_id is null)));
end $$;
create function public.revoke_guest_intent(p_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_staff(true);
 update private.guest_intents set revoked_at=clock_timestamp() where id=p_id and revoked_at is null;
 if found then
  perform private.audit('guest.intent_revoked','guest_intent',p_id,jsonb_build_object('actor_kind','owner'));
  return true;
 end if;
 return false;
end $$;
revoke all on function private.guest_intent_immutable(),private.require_guest_gateway() from public,anon,authenticated,service_role;
revoke all on function public.guest_intent_admit(uuid,text,text,text,integer),public.guest_intent_authorize(uuid,text,text),public.revoke_guest_intent(uuid) from public,anon,authenticated,service_role;
grant execute on function public.guest_intent_admit(uuid,text,text,text,integer),public.guest_intent_authorize(uuid,text,text) to service_role;
grant execute on function public.revoke_guest_intent(uuid) to authenticated;
