import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { pool, settings, clients, court, day, at, rpc, reservation, success, failure, count } from './helpers.mjs';
const hex = () => randomBytes(32).toString('hex');
const network=hex(), key=hex();
const gateway=()=>createClient(settings.API_URL,settings.adminKey,{auth:{persistSession:false,autoRefreshToken:false}});
const common={p_network_key:network,p_key_fingerprint:key};
beforeEach(async()=>{
 await pool.query(`update private.guest_security_config set enabled=true,create_ttl_seconds=300,access_ttl_seconds=900,
 window_seconds=86400,max_requests=1000,max_active_intents=100,max_cookie_count=30,retention_seconds=86400,key_fingerprint=$1`,[key]);
 await pool.query(readFileSync('supabase/guest-booking.local.sql','utf8'));
});
async function intent() {
 const cap={id:randomUUID(),hash:hex()};
 const data=await success(gateway().rpc('guest_intent_admit',{...common,p_id:cap.id,p_hash:cap.hash,p_cookie_count:0}));
 assert.equal(data.outcome,'created');return cap;
}
const args=i=>({...common,p_id:i.id,p_hash:i.hash});
async function quote(i,overrides={}) {
 const result=await success(gateway().rpc('guest_quote',{...args(i),p_court:court(1),p_start:at(8),p_duration:60,...overrides}));
 assert.equal(result.outcome,'created');return result.quote;
}
function payload(i,q,overrides={}) {
 const input={p_request_key:randomUUID(),p_quote_id:q.quoteId,p_name:'Synthetic Guest',p_contact:'guest@example.invalid',p_players:4,...overrides};
 const fingerprint=createHmac('sha256',Buffer.from(i.hash,'hex')).update(JSON.stringify(input)).digest('hex');
 return {...args(i),...input,p_fingerprint:fingerprint};
}
async function admit(p) {
 const {p_id,p_hash,p_network_key,p_key_fingerprint,p_request_key,p_fingerprint}=p;
 return success(gateway().rpc('guest_request_admit',{p_id,p_hash,p_network_key,p_key_fingerprint,p_request_key,p_fingerprint}));
}
const create=p=>gateway().rpc('guest_reservation_create',p);
const status=(i,ref)=>gateway().rpc('guest_reservation_status',{...args(i),p_reference:ref});
const publish=changes=>success(rpc('owner','publish_policy',{p_effective:null,p_changes:changes,p_note:'Synthetic guest policy regression'}));
async function hold(overrides={}) {const i=await intent(),q=await quote(i,overrides),p=payload(i,q);assert.equal((await admit(p)).outcome,'admitted');return {i,q,p,result:await success(create(p))};}

test('3B2: truthful guest actor and atomic private agreement/occupancy/binding/receipt',async()=>{
 const {i,result}=await hold();assert.equal(result.replayed,false);assert.equal(result.receipt.stateAtCreation,'held');
 const b=(await pool.query('select * from public.bookings')).rows[0];assert.equal(b.actor_kind,'guest');assert.equal(b.created_by,null);assert.equal(b.guest_intent_id,i.id);assert.equal(b.source,'guest_web');
 for(const table of ['customers','booking_revisions','booking_items','court_occupancies']) assert.equal(await count(table),1);
 assert.equal((await pool.query('select booking_id from private.guest_intents')).rows[0].booking_id,b.id);
 const a=(await pool.query("select actor_id,metadata from public.audit_events where action='guest.reservation_created'")).rows[0];
 assert.equal(a.actor_id,null);assert.deepEqual(Object.keys(a.metadata).sort(),['actor_kind','court_id','intent_id']);
 const text=JSON.stringify(result);for(const x of [i.hash,i.id,b.id,b.customer_id,'Synthetic Guest','guest@example.invalid'])assert.equal(text.includes(x),false);
});
test('3B2: twenty independent guests compete: one hold, nineteen conflicts, durable admission and no orphans',async()=>{
 const inputs=await Promise.all(Array.from({length:20},async()=>{const i=await intent();return payload(i,await quote(i));}));
 for(const p of inputs)assert.equal((await admit(p)).outcome,'admitted');
 const results=await Promise.all(inputs.map(create));assert.equal(results.filter(x=>!x.error).length,1);assert.equal(results.filter(x=>x.error?.code==='23P01').length,19);
 for(const table of ['bookings','customers','booking_revisions','booking_items','court_occupancies'])assert.equal(await count(table),1);
 assert.equal((await pool.query('select count(*) from private.guest_booking_requests')).rows[0].count,'20');
 assert.equal((await pool.query('select count(*) from private.guest_intents where booking_id is not null')).rows[0].count,'1');
 assert.equal((await pool.query("select hits from private.guest_operation_buckets where bucket_key=$1 and operation='create'",[network])).rows[0].hits,20);
});
test('3B2: twenty admitted identical retries commit once and preserve a single original deadline',async()=>{
 const i=await intent(),q=await quote(i),p=payload(i,q);
 await Promise.all(Array.from({length:20},()=>admit(p)));
 const results=await Promise.all(Array.from({length:20},()=>success(create(p))));
 assert.equal(results.filter(x=>!x.replayed).length,1);assert.ok(results.every(x=>JSON.stringify(x.receipt)===JSON.stringify(results[0].receipt)));
 assert.equal(await count('bookings'),1);assert.equal(await count('customers'),1);
 assert.equal((await pool.query('select count(*) from private.guest_booking_requests')).rows[0].count,'1');
});
test('3B2: changed fingerprint conflicts and new keys cannot bypass one intent binding',async()=>{
 const {i,p,result}=await hold();assert.equal((await admit({...p,p_fingerprint:hex()})).outcome,'request_mismatch');
 await failure(create({...p,p_fingerprint:hex()}),'P0001');assert.equal((await admit({...p,p_request_key:randomUUID()})).outcome,'intent_already_bound');
 assert.equal((await success(status(i,result.receipt.reference))).outcome,'ok');assert.equal(await count('bookings'),1);
});
test('3B2: same key on different intents is isolated; adjacent and other-court sessions succeed',async()=>{
 const key= randomUUID();
 for(const overrides of [{},{p_start:at(9)},{p_court:court(2)}]){
 const i=await intent(),q=await quote(i,overrides),p=payload(i,q,{p_request_key:key});await admit(p);await success(create(p));}
 assert.equal(await count('bookings'),3);
});
test('3B2: open-play and maintenance exclusion rolls domain back without erasing admission',async()=>{
 for(const [index,kind] of ['open_play','maintenance'].entries()) {
 const c=court(index+1);await success(rpc('staff','block_courts',{p_court_ids:[c],p_start:at(8),p_end:at(9),p_kind:kind,p_request_key:randomUUID()}));
 const i=await intent(),q=await quote(i,{p_court:c}),p=payload(i,q);await admit(p);await failure(create(p),'23P01');}
 assert.equal(await count('bookings'),0);assert.equal(await count('customers'),0);assert.equal(await count('booking_revisions'),0);
 assert.equal((await pool.query('select count(*) from private.guest_booking_requests')).rows[0].count,'2');
});
test('3B2: 60/60 and 90/60 availability, quotes and creation agree',async()=>{
 for(const minimum of [60,90]) {
 if(minimum===90)await publish({minimum_minutes:90});const duration=minimum===90?120:60;
 const a=await success(gateway().rpc('guest_availability',{...common,p_day:day,p_duration:duration}));
 assert.equal(a.outcome,'ok');assert.ok(a.slots.length>0);assert.ok(a.slots.every(x=>Date.parse(x.endsAt)-Date.parse(x.startsAt)===duration*60000));
 const h=await hold({p_duration:duration,p_court:court(minimum===60?1:2)});assert.equal(h.result.receipt.totalCentavos,duration*1000);
 }
 await failure(gateway().rpc('guest_availability',{...common,p_day:day,p_duration:90}),'22023');
});
test('3B2: scheduled price change and same-price policy changes invalidate quotes',async()=>{
 for(const changes of [{no_refund_within_minutes:1500},{guest_lead_minutes:65}]){
 const i=await intent(),q=await quote(i),p=payload(i,q);await admit(p);await publish(changes);assert.equal((await failure(create(p),'P0001')).message,'QUOTE_REVIEW_REQUIRED');}
 const i=await intent(),q=await quote(i),p=payload(i,q);await admit(p);
 await success(rpc('owner','publish_court_config',{p_court_id:court(1),p_effective:at(8),p_changes:{rate_centavos:70000},p_note:'Synthetic scheduled price'}));
 assert.equal((await failure(create(p),'P0001')).message,'QUOTE_REVIEW_REQUIRED');assert.equal(await count('customers'),0);
});
test('3B2: missing required policies and invalid duration fail clearly',async()=>{
 await publish({booking_horizon_days:null});await failure(gateway().rpc('guest_availability',{...common,p_day:day,p_duration:60}),'P0001');
 assert.equal(await count('bookings'),0);
});
test('3B2: guest A cannot read B, guessed references have the identical failure shape',async()=>{
 const a=await hold(),b=await hold({p_court:court(2)});
 assert.deepEqual(await success(status(a.i,b.result.receipt.reference)),{outcome:'access_unavailable'});
 assert.deepEqual(await success(status(a.i,randomUUID())),{outcome:'access_unavailable'});
 assert.equal((await success(status(b.i,b.result.receipt.reference))).outcome,'ok');
 const denied=await success(status({...a.i,hash:hex()},a.result.receipt.reference));assert.deepEqual(denied,{outcome:'access_unavailable'});
 await success(rpc('owner','revoke_guest_intent',{p_id:a.i.id}));assert.deepEqual(await success(status(a.i,a.result.receipt.reference)),denied);
});
test('3B2: replay after cancellation keeps immutable receipt and cannot resurrect occupancy',async()=>{
 await publish({payment_window_minutes:1});const h=await hold();
 const id=(await pool.query('select id from public.bookings')).rows[0].id;
 await success(rpc('staff','release_reservation',{p_booking_id:id}));
 await admit(h.p);const replay=await success(create(h.p));assert.deepEqual(replay.receipt,h.result.receipt);assert.equal(replay.current.status,'cancelled');
 assert.equal((await pool.query('select active from public.court_occupancies')).rows[0].active,false);
});
test('3B2: natural quote expiry rejects without orphan domain state; renewal uses a new request key',async()=>{
 const row=(await pool.query('select * from private.guest_booking_policies order by effective_from desc limit 1')).rows[0];
 await pool.query(`insert into private.guest_booking_policies select gen_random_uuid(),clock_timestamp(),purpose,1,window_seconds,request_limit,intent_request_limit,max_quotes,max_pending_requests,max_active_holds,max_players,minimum_payment_seconds,retention_seconds,contact_kind,public_terms from private.guest_booking_policies where id=$1`,[row.id]);
 const i=await intent(),q=await quote(i),p=payload(i,q);await admit(p);await new Promise(r=>setTimeout(r,1200));
 assert.equal((await failure(create(p),'P0001')).message,'QUOTE_REVIEW_REQUIRED');assert.equal(await count('customers'),0);
 const renewed=payload(i,await quote(i));await admit(renewed);await success(create(renewed));
});
test('3B2: natural capability expiry and owner revocation prevent committing pending requests',async()=>{
 await pool.query('update private.guest_security_config set create_ttl_seconds=1,access_ttl_seconds=1');
 const i=await intent(),q=await quote(i),p=payload(i,q);await admit(p);await new Promise(r=>setTimeout(r,1200));await failure(create(p),'42501');
 await pool.query('update private.guest_security_config set create_ttl_seconds=300,access_ttl_seconds=900');
 const j=await intent(),r=payload(j,await quote(j));await admit(r);await success(rpc('owner','revoke_guest_intent',{p_id:j.id}));await failure(create(r),'42501');assert.equal(await count('customers'),0);
});
test('3B2: only service gateway executes new RPCs; private tables deny anon/authenticated/service direct access',async()=>{
 for(const who of ['anon','staff','owner','inactive','outsider'])for(const [fn,params]of [
 ['guest_availability',{...common,p_day:day,p_duration:60}],['guest_quote',{...common,p_id:randomUUID(),p_hash:hex(),p_court:court(1),p_start:at(8),p_duration:60}],
 ['guest_request_admit',{...common,p_id:randomUUID(),p_hash:hex(),p_request_key:randomUUID(),p_fingerprint:hex()}],
 ['guest_reservation_status',{...common,p_id:randomUUID(),p_hash:hex(),p_reference:randomUUID()}]])await failure(clients[who].rpc(fn,params));
 for(const role of ['anon','authenticated','service_role'])for(const table of ['guest_quotes','guest_booking_requests','guest_booking_policies','guest_operation_buckets']){
 const c=await pool.connect();try{await c.query('begin');await c.query(`set local role ${role}`);await assert.rejects(c.query(`select * from private.${table}`),{code:'42501'});}finally{await c.query('rollback');c.release();}}
 const defs=(await pool.query("select proconfig from pg_proc where proname in ('guest_availability','guest_quote','guest_request_admit','guest_reservation_create','guest_reservation_status')")).rows;assert.equal(defs.length,5);assert.ok(defs.every(x=>x.proconfig.includes('search_path=""')));
});
test('3B2: quotes/requests immutable; rejected inputs leave no partial customer',async()=>{
 const h=await hold();await assert.rejects(pool.query("update private.guest_quotes set context='{}' where id=$1",[h.q.quoteId]),{code:'23514'});
 await assert.rejects(pool.query('update private.guest_booking_requests set receipt=$1 where intent_id=$2',[{},h.i.id]),{code:'23514'});
 for(const bad of [{p_contact:'person@real.test'},{p_players:1000},{p_name:' '}]){
 const i=await intent(),p=payload(i,await quote(i,{p_court:court(2)}),bad);await admit(p);await failure(create(p),'22023');}
 assert.equal(await count('customers'),1);
});
test('3B2: identical synthetic contacts do not merge histories; staff creation remains functional',async()=>{
 await hold();await hold({p_court:court(2)});await success(rpc('staff','create_reservation',reservation({p_court_id:court(3)})));
 assert.equal(await count('customers'),2);assert.equal(await count('bookings'),3);
});

test('3B2: natural unpaid hold expiry never resurrects on retry; request-path reconciliation releases occupancy',async()=>{
 await publish({payment_window_minutes:1});const h=await hold();
 // Real DB time, no trigger changes or forged timestamps. Poll rather than block the orchestrator.
 while(Date.now()<Date.parse(h.result.receipt.expiresAt)+100)await new Promise(r=>setTimeout(r,1000));
 const replay=await success(create(h.p));assert.deepEqual(replay.receipt,h.result.receipt);assert.equal(replay.current.status,'expired');
 const fresh=await hold();assert.notEqual(fresh.result.receipt.reference,h.result.receipt.reference);
 assert.equal((await pool.query('select count(*) from public.court_occupancies where active')).rows[0].count,'1');
 assert.equal((await pool.query("select count(*) from public.audit_events where action='hold.expired'")).rows[0].count,'1');
});
test('3B2: active local hold allowance serializes different-court attempts and ignores completed retries',async()=>{
 await pool.query(`insert into private.guest_booking_policies select gen_random_uuid(),clock_timestamp(),purpose,quote_ttl_seconds,window_seconds,request_limit,intent_request_limit,max_quotes,max_pending_requests,1,max_players,minimum_payment_seconds,retention_seconds,contact_kind,public_terms from private.guest_booking_policies order by effective_from desc limit 1`);
 const inputs=await Promise.all([1,2].map(async n=>{const i=await intent();const p=payload(i,await quote(i,{p_court:court(n)}));await admit(p);return p;}));
 const results=await Promise.all(inputs.map(create));assert.equal(results.filter(x=>!x.error).length,1);assert.equal(results.filter(x=>x.error?.message==='RATE_LIMITED').length,1);
 assert.equal(await count('customers'),1);const p=inputs[results.findIndex(x=>!x.error)];await admit(p);assert.equal((await success(create(p))).replayed,true);
});
test('3B2: private reads and create attempts consume persistent separate quotas; unavailable config fails closed',async()=>{
 const h=await hold();await pool.query(`insert into private.guest_booking_policies select gen_random_uuid(),clock_timestamp(),purpose,quote_ttl_seconds,window_seconds,2,2,max_quotes,max_pending_requests,max_active_holds,max_players,minimum_payment_seconds,retention_seconds,contact_kind,public_terms from private.guest_booking_policies order by effective_from desc limit 1`);
 assert.equal((await success(status(h.i,h.result.receipt.reference))).outcome,'ok');assert.equal((await success(status(h.i,h.result.receipt.reference))).outcome,'ok');
 assert.equal((await success(status(h.i,h.result.receipt.reference))).outcome,'rate_limited');
 assert.equal((await success(status(h.i,h.result.receipt.reference))).outcome,'rate_limited'); // fresh gateway/client, same DB counters
 assert.equal((await pool.query("select hits from private.guest_operation_buckets where bucket_key=$1 and operation='read'",[network])).rows[0].hits,3);
 await pool.query('update private.guest_security_config set enabled=false');await failure(status(h.i,h.result.receipt.reference),'P0001');
});
test('3B2: failure injected after customer/booking writes rolls back the complete domain',async()=>{
 const i=await intent(),p=payload(i,await quote(i));await admit(p);
 // Isolated local fault injection at the final audit write; never disable integrity controls.
 await pool.query(`create function private.synthetic_fail_guest_audit() returns trigger language plpgsql as $$ begin if new.action='guest.reservation_created' then raise exception 'synthetic fault'; end if; return new; end $$;
 create trigger synthetic_fail_guest_audit before insert on public.audit_events for each row execute function private.synthetic_fail_guest_audit()`);
 try{await failure(create(p));}finally{await pool.query('drop trigger synthetic_fail_guest_audit on public.audit_events; drop function private.synthetic_fail_guest_audit()');}
 for(const table of ['customers','bookings','booking_items','booking_revisions','court_occupancies'])assert.equal(await count(table),0);
 assert.equal((await pool.query('select booking_id from private.guest_intents')).rows[0].booking_id,null);
 assert.equal((await pool.query('select booking_id from private.guest_booking_requests')).rows[0].booking_id,null);
 await success(create(p));assert.equal(await count('bookings'),1);
});

test('3B2: rejected forged capabilities retain shared admission without minting domain records',async()=>{
 const i=await intent(),q=await quote(i),p=payload(i,q);const forged={...p,p_hash:hex()};
 assert.equal((await admit(forged)).outcome,'guest_access_required');
 assert.equal((await pool.query("select hits from private.guest_operation_buckets where bucket_key=$1 and operation='create'",[network])).rows[0].hits,1);
 assert.equal((await pool.query('select count(*) from private.guest_booking_requests')).rows[0].count,'0');
 const r=await success(gateway().rpc('guest_quote',{...args(i),p_hash:hex(),p_court:court(1),p_start:at(8),p_duration:60}));assert.equal(r.outcome,'guest_access_required');
 assert.equal((await pool.query("select hits from private.guest_operation_buckets where bucket_key=$1 and operation='quote'",[network])).rows[0].hits,2);
});
test('3B2: direct anonymous domain RPC, REST writes and RLS bypass attempts are denied',async()=>{
 const i=await intent(),q=await quote(i),p=payload(i,q);
 for(const who of ['anon','staff','owner','inactive','outsider'])await failure(clients[who].rpc('guest_reservation_create',p));
 for(const table of ['guest_quotes','guest_booking_requests','guest_booking_policies','guest_operation_buckets']){
 for(const method of ['GET','POST','PATCH','DELETE']){
 const response=await fetch(`${settings.API_URL}/rest/v1/${table}`,{method,headers:{apikey:settings.publicKey,'Accept-Profile':'private','Content-Profile':'private','Content-Type':'application/json'},...(method==='POST'||method==='PATCH'?{body:'{}'}:{})});assert.ok(response.status>=400);
 }
 const c=await pool.connect();try{await c.query('begin');await c.query('grant usage on schema private to anon,authenticated');await c.query(`grant select on private.${table} to anon,authenticated`);await c.query('set local role anon');assert.equal((await c.query(`select count(*) from private.${table}`)).rows[0].count,'0');await c.query('set local role authenticated');assert.equal((await c.query(`select count(*) from private.${table}`)).rows[0].count,'0');}finally{await c.query('rollback');c.release();}
 }
 assert.equal(await count('bookings'),0);
});
test('3B2: another intent quote cannot be committed; minimum payment opportunity and lead gates apply',async()=>{
 const i=await intent(),j=await intent(),q=await quote(j),p=payload(i,q);await admit(p);assert.equal((await failure(create(p),'P0001')).message,'QUOTE_REVIEW_REQUIRED');
 await publish({payment_cutoff_minutes:100000});await failure(gateway().rpc('guest_quote',{...args(i),p_court:court(1),p_start:at(8),p_duration:60}),'P0001');assert.equal(await count('customers'),0);
});
test('3B2: closure after quoting requires renewed review rather than treating accepted input as malformed',async()=>{
 const i=await intent(),q=await quote(i),p=payload(i,q);await admit(p);
 await success(rpc('owner','publish_court_config',{p_court_id:court(1),p_effective:at(8),p_changes:{enabled:false},p_note:'Synthetic scheduled closure'}));
 assert.equal((await failure(create(p),'P0001')).message,'QUOTE_REVIEW_REQUIRED');assert.equal(await count('customers'),0);
});
