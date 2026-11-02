-- Release explicit occupancy IDs returned by block_courts, atomically across courts.
-- No direct UPDATE/DELETE grants and no path for releasing reservation occupancy here.
create function public.release_blocks(p_occupancy_ids uuid[],p_request_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ids uuid[]; payload jsonb; previous public.idempotency_requests; o public.court_occupancies;
 released jsonb:='[]'; already_released jsonb:='[]'; result jsonb;
begin
 perform pg_advisory_xact_lock_shared(842017,1);
 perform private.require_staff();
 if p_request_key is null or p_occupancy_ids is null or cardinality(p_occupancy_ids) not between 1 and 100
  or array_position(p_occupancy_ids,null) is not null then raise exception 'Invalid block release request' using errcode='22023'; end if;
 select array_agg(x order by x) into ids from (select distinct unnest(p_occupancy_ids) as x) canonical;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_request_key::text,0));
 payload:=jsonb_build_object('occupancy_ids',to_jsonb(ids));
 select * into previous from public.idempotency_requests where actor_id=auth.uid() and request_key=p_request_key;
 if found then
  if previous.operation<>'court.release_blocks' or previous.payload<>payload then raise exception 'Idempotency payload changed' using errcode='22023'; end if;
  return previous.result;
 end if;
 -- The same court-before-occupancy lock order as create/block/reservation release.
 perform c.id from public.courts c where c.id in(select court_id from public.court_occupancies where id=any(ids)) order by c.id for update;
 perform x.id from public.court_occupancies x where x.id=any(ids) order by x.court_id,x.id for update;
 if (select count(*) from public.court_occupancies where id=any(ids))<>cardinality(ids)
  or exists(select 1 from public.court_occupancies where id=any(ids) and (kind not in ('open_play','maintenance') or booking_id is not null)) then
  raise exception 'Every requested ID must identify a court block' using errcode='22023';
 end if;
 for o in select * from public.court_occupancies where id=any(ids) order by court_id,id loop
  if o.active then
   update public.court_occupancies set active=false where id=o.id;
   released:=released||jsonb_build_array(o.id);
   perform private.audit('court.block_released','occupancy',o.id,jsonb_build_object('kind',o.kind,'court_id',o.court_id));
  else
   already_released:=already_released||jsonb_build_array(o.id);
  end if;
 end loop;
 result:=jsonb_build_object('released_ids',released,'already_released_ids',already_released);
 insert into public.idempotency_requests values(auth.uid(),p_request_key,'court.release_blocks',payload,result);
 return result;
end $$;
revoke all on function public.release_blocks(uuid[],uuid) from public,anon,authenticated;
grant execute on function public.release_blocks(uuid[],uuid) to authenticated;
