-- Validate only the service-time window governed by the new operational version.
-- Price-only changes never rewrite agreements and do not restrict existing occupancy.
create or replace function public.publish_court_config(p_court_id uuid,p_effective timestamptz,p_changes jsonb,p_note text) returns uuid language plpgsql security definer set search_path='' as $$
declare base public.court_config_versions; v public.court_config_versions; next_effective timestamptz; tz text; result uuid; effective timestamptz:=coalesce(p_effective,now());
begin
 perform pg_advisory_xact_lock(842017,1); perform private.require_staff(true);
 select timezone into tz from public.club_settings_versions where effective_from<=effective order by effective_from desc limit 1;
 if not isfinite(effective) or effective<now() or (p_effective is not null and date_trunc('hour',effective at time zone tz)<>effective at time zone tz)
 or p_changes is null or jsonb_typeof(p_changes)<>'object' or exists(select 1 from jsonb_object_keys(p_changes) k where k not in ('enabled','rate_centavos','opening_minute','closing_minute','provisional')) then
  raise exception 'Invalid court configuration publication' using errcode='22023'; end if;
 select * into base from public.court_config_versions where court_id=p_court_id and effective_from<=effective order by effective_from desc limit 1;
 if base.id is null then raise exception 'Unknown court configuration' using errcode='22023'; end if;
 select * into v from jsonb_populate_record(base,p_changes);
 select min(effective_from) into next_effective from public.court_config_versions where court_id=p_court_id and effective_from>effective;
 if (v.enabled is distinct from base.enabled or v.opening_minute is distinct from base.opening_minute or v.closing_minute is distinct from base.closing_minute)
 and exists(select 1 from public.court_occupancies o left join public.bookings b on b.id=o.booking_id
   where o.court_id=p_court_id and o.active and o.occupied_during && tstzrange(effective,next_effective,'[)')
   and (o.booking_id is null or b.status<>'held' or b.expires_at>clock_timestamp()) and (not v.enabled
    or extract(hour from greatest(lower(o.occupied_during),effective) at time zone tz)*60
       +extract(minute from greatest(lower(o.occupied_during),effective) at time zone tz)<v.opening_minute
    or extract(epoch from((least(upper(o.occupied_during),coalesce(next_effective,upper(o.occupied_during))) at time zone tz)
       -date_trunc('day',greatest(lower(o.occupied_during),effective) at time zone tz)))/60>v.closing_minute)) then
  raise exception 'Existing occupancy requires resolution before publication' using errcode='23514'; end if;

 insert into public.court_config_versions(court_id,effective_from,enabled,rate_centavos,opening_minute,closing_minute,provisional,created_by,change_note)
 values(p_court_id,effective,v.enabled,v.rate_centavos,v.opening_minute,v.closing_minute,v.provisional,auth.uid(),p_note) returning id into result;
 perform private.audit('court_config.published','court_config_version',result,jsonb_build_object('court_id',p_court_id,'effective_from',effective)); return result;
end $$;
