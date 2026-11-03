import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { createClient } from '@supabase/supabase-js';
import { pool, settings, court, at, rpc, success, count } from './helpers.mjs';
const hex = () => randomBytes(32).toString('hex');
const common = { p_network_key: hex(), p_key_fingerprint: hex() };
const gateway = () => createClient(settings.API_URL, settings.adminKey, { auth: { persistSession: false, autoRefreshToken: false } });
const invoke = (name, parameters) => success(gateway().rpc(name, parameters));
const creationSql = 'select public.guest_reservation_create($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) as result';
const creationValues = p => [p.p_id,p.p_hash,p.p_network_key,p.p_key_fingerprint,p.p_request_key,p.p_fingerprint,p.p_quote_id,p.p_name,p.p_contact,p.p_players];
beforeEach(async () => {
  await pool.query(`update private.guest_security_config set enabled=true,create_ttl_seconds=300,access_ttl_seconds=900,
    window_seconds=86400,max_requests=100,max_active_intents=100,max_cookie_count=30,retention_seconds=86400,key_fingerprint=$1`, [common.p_key_fingerprint]);
  await pool.query(readFileSync('supabase/guest-booking.local.sql','utf8'));
});
async function pending() {
  const capability = { ...common, p_id: randomUUID(), p_hash: hex() };
  assert.equal((await invoke('guest_intent_admit', { ...capability, p_cookie_count: 0 })).outcome, 'created');
  const quoted = await invoke('guest_quote', { ...capability, p_court: court(1), p_start: at(8), p_duration: 60 });
  const p = { ...capability, p_request_key: randomUUID(), p_fingerprint: hex(), p_quote_id: quoted.quote.quoteId,
    p_name: 'Synthetic Recovery Guest', p_contact: 'recovery@example.invalid', p_players: 4 };
  assert.equal((await admission(p)).outcome,'admitted');return p;
}
function admission(p) {
  const { p_id,p_hash,p_network_key,p_key_fingerprint,p_request_key,p_fingerprint } = p;
  return invoke('guest_request_admit', { p_id,p_hash,p_network_key,p_key_fingerprint,p_request_key,p_fingerprint });
}
async function retry(p) { assert.equal((await admission(p)).outcome,'admitted');return invoke('guest_reservation_create',p); }
async function waitForBlocked(pid) {
  const until=Date.now()+5000;
  while(Date.now()<until) {
    if(Number((await pool.query('select count(*) from pg_stat_activity where $1=any(pg_blocking_pids(pid))',[pid])).rows[0].count)>0)return;
    await new Promise(resolve=>setTimeout(resolve,25));
  }
  throw new Error('Expected a real database lock wait');
}
async function domainIsAbsent() {
  for(const table of ['customers','bookings','booking_revisions','booking_items','court_occupancies'])assert.equal(await count(table),0);
  const request=(await pool.query('select booking_id,receipt from private.guest_booking_requests')).rows;
  assert.deepEqual(request,[{booking_id:null,receipt:null}]);
}
test('review: a retry waits for an uncommitted domain and returns its original committed receipt',async()=>{
  const p=await pending(),c=await pool.connect();let retried;
  try {
    await c.query('begin');await c.query("select set_config('request.jwt.claims','{\"role\":\"service_role\"}',true)");await c.query('set local role service_role');
    const first=(await c.query(creationSql,creationValues(p))).rows[0].result;
    await domainIsAbsent(); // Uncommitted domain must not leak into another transaction.
    retried=retry(p);await waitForBlocked(c.processID);await c.query('commit');
    const replay=await retried;assert.equal(replay.replayed,true);assert.deepEqual(replay.receipt,first.receipt);
    assert.equal(await count('bookings'),1);assert.equal(await count('customers'),1);
    assert.equal((await pool.query("select count(*) from public.audit_events where action='guest.reservation_created'")).rows[0].count,'1');
  } finally { await c.query('rollback');c.release();if(retried)await retried.catch(()=>{}); }
});
test('review: killing a real process with an uncommitted domain preserves admission and permits one clean recovery',async()=>{
  const p=await pending();
  // Private DB binding/arguments travel over stdin, never command arguments or output.
  const script=`import pg from 'pg';let input='';for await(const x of process.stdin)input+=x;const s=JSON.parse(input);const c=new pg.Client({connectionString:s.url});c.on('error',()=>{});await c.connect();await c.query('begin');await c.query(\"select set_config('request.jwt.claims','{\\\"role\\\":\\\"service_role\\\"}',true)\");await c.query('set local role service_role');await c.query(s.sql,s.values);process.stdout.write(JSON.stringify({pid:c.processID})+'\\n');await new Promise(()=>{});`;
  const child=spawn(process.execPath,['--input-type=module','-e',script],{stdio:['pipe','pipe','pipe']});
  let output='';let readyResolve;let readyReject;const ready=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});
  child.stdout.on('data',chunk=>{output+=chunk;if(output.includes('\n')){try{readyResolve(JSON.parse(output.trim()));}catch{readyReject(new Error('Child readiness invalid'));}}});
  child.stderr.resume();child.once('error',()=>readyReject(new Error('Recovery child failed')));
  child.once('exit',()=>readyReject(new Error('Recovery child exited before readiness')));
  child.stdin.end(JSON.stringify({url:settings.DB_URL,sql:creationSql,values:creationValues(p)}));
  let retried;const timer=setTimeout(()=>readyReject(new Error('Recovery child startup timed out')),10000);
  try {
    const {pid}=await ready;clearTimeout(timer);await domainIsAbsent();
    retried=retry(p);await waitForBlocked(pid);
    const stopped=once(child,'exit');child.kill('SIGKILL');await stopped;
    const recovered=await retried;assert.equal(recovered.replayed,false);
    const replay=await retry(p);assert.equal(replay.replayed,true);assert.deepEqual(replay.receipt,recovered.receipt);
    for(const table of ['customers','bookings','booking_revisions','booking_items','court_occupancies'])assert.equal(await count(table),1);
    assert.equal((await pool.query('select count(*) from private.guest_booking_requests')).rows[0].count,'1');
    assert.equal((await pool.query("select count(*) from public.audit_events where action='guest.reservation_created'")).rows[0].count,'1');
  } finally {clearTimeout(timer);if(child.exitCode===null&&child.signalCode===null){const stopped=once(child,'exit');child.kill('SIGKILL');await stopped;}if(retried)await retried.catch(()=>{});}
});
test('review: replay after natural quote AND creation-window expiry uses the completed receipt first',async()=>{
  await pool.query('update private.guest_security_config set create_ttl_seconds=1');
  const p=await pending();const original=await invoke('guest_reservation_create',p);
  await new Promise(resolve=>setTimeout(resolve,1200));
  assert.equal((await invoke('guest_intent_authorize',{p_id:p.p_id,p_hash:p.p_hash,p_scope:'create'})),false);
  const replay=await retry(p);assert.equal(replay.replayed,true);assert.deepEqual(replay.receipt,original.receipt);
  assert.equal(replay.current.expiresAt,original.current.expiresAt);assert.equal(await count('bookings'),1);
});
test('review: concurrent release, status and twenty replays preserve one receipt and cannot resurrect occupancy',async()=>{
  const p=await pending(),original=await invoke('guest_reservation_create',p);
  const booking=(await pool.query('select id from public.bookings')).rows[0].id;
  const results=await Promise.all([
    ...Array.from({length:20},()=>retry(p)),
    ...Array.from({length:10},()=>invoke('guest_reservation_status',{...common,p_id:p.p_id,p_hash:p.p_hash,p_reference:original.receipt.reference})),
    success(rpc('staff','release_reservation',{p_booking_id:booking})),
  ]);
  for(const replay of results.slice(0,20)){assert.equal(replay.replayed,true);assert.deepEqual(replay.receipt,original.receipt);assert.ok(['held','cancelled'].includes(replay.current.status));}
  const last=await retry(p);assert.equal(last.current.status,'cancelled');assert.deepEqual(last.receipt,original.receipt);
  assert.equal((await pool.query('select active from public.court_occupancies')).rows[0].active,false);
  assert.equal((await pool.query("select count(*) from public.audit_events where action='reservation.released'")).rows[0].count,'1');
});
test('review: private-read quota persists in a fresh Node process and does not disclose another booking',async()=>{
  const p=await pending(),created=await invoke('guest_reservation_create',p);
  await pool.query(`insert into private.guest_booking_policies select gen_random_uuid(),clock_timestamp(),purpose,quote_ttl_seconds,window_seconds,2,2,max_quotes,max_pending_requests,max_active_holds,max_players,minimum_payment_seconds,retention_seconds,contact_kind,public_terms from private.guest_booking_policies order by effective_from desc limit 1`);
  const params={...common,p_id:p.p_id,p_hash:p.p_hash,p_reference:created.receipt.reference};
  for(let n=0;n<2;n++)assert.equal((await invoke('guest_reservation_status',params)).outcome,'ok');
  const code=`import{createClient}from'@supabase/supabase-js';let s='';for await(const x of process.stdin)s+=x;const p=JSON.parse(s);const c=createClient(p.url,p.key,{auth:{persistSession:false}});const r=await c.rpc('guest_reservation_status',p.params);process.stdout.write(r.error?'error':r.data.outcome);`;
  const answer=execFileSync(process.execPath,['--input-type=module','-e',code],{input:JSON.stringify({url:settings.API_URL,key:settings.adminKey,params}),encoding:'utf8'});
  assert.equal(answer,'rate_limited');assert.equal((await invoke('guest_reservation_status',{...params,p_reference:randomUUID()})).outcome,'rate_limited');
});
