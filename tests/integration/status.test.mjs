import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { rpc, clients, reservation, success, failure, count, pool, day, at, court, identities } from './helpers.mjs';
async function accepted(overrides={}) {
 const params=reservation(overrides);
 const quote=await success(rpc('staff','quote_reservation',{p_court_id:params.p_court_id,p_start:params.p_start,p_end:params.p_end}));
 return {...params,p_expected_versions:quote.version_context};
}
test('3A status: creation separates immutable receipt, current state and replay marker', async () => {
 const response=await success(rpc('staff','create_reservation',await accepted()));
 assert.deepEqual(Object.keys(response).sort(),['current','receipt','replayed']);
 assert.equal(response.replayed,false);assert.equal(response.current.status,'held');assert.equal(response.receipt.status,'held');
 assert.equal(response.current.id,response.receipt.id);assert.equal(response.current.expires_at,response.receipt.expires_at);
 const stored=(await pool.query('select result from public.idempotency_requests')).rows[0].result;
 assert.deepEqual(stored,response.receipt);assert.ok(!Object.hasOwn(stored,'current'));
 assert.deepEqual(Object.keys(response.current).sort(),['expires_at','id','observed_at','status']);
});
test('3A status: cancelled replay returns historical held receipt and authoritative cancelled state', async () => {
 const params=await accepted();const original=await success(rpc('staff','create_reservation',params));
 await success(rpc('staff','release_reservation',{p_booking_id:original.receipt.id}));
 const replay=await success(rpc('staff','create_reservation',params));
 assert.equal(replay.replayed,true);assert.deepEqual(replay.receipt,original.receipt);assert.equal(replay.current.status,'cancelled');
 assert.equal((await success(rpc('staff','reservation_status',{p_booking_id:original.receipt.id}))).status,'cancelled');
 assert.equal(Number((await pool.query('select count(*) from public.court_occupancies where active')).rows[0].count),0);
 assert.equal(await count('bookings'),1);assert.equal(await count('audit_events'),2);
});
test('3A status: expired replay cannot extend or reactivate a hold before lazy reconciliation', async () => {
 const params=await accepted({p_hold_until:new Date(Date.now()+2200).toISOString()});
 const original=await success(rpc('staff','create_reservation',params));
 await new Promise(resolve=>setTimeout(resolve,2300));
 const current=await success(rpc('staff','reservation_status',{p_booking_id:original.receipt.id}));
 assert.equal(current.status,'expired');assert.ok(Date.parse(current.observed_at)>=Date.parse(current.expires_at));
 assert.equal((await pool.query('select status from public.bookings')).rows[0].status,'held');
 const replay=await success(rpc('staff','create_reservation',params));
 assert.equal(replay.current.status,'expired');assert.deepEqual(replay.receipt,original.receipt);
 assert.equal(Date.parse(replay.current.expires_at),Date.parse(params.p_hold_until));
 assert.equal(await count('audit_events'),1);assert.equal(await count('bookings'),1);
 const rows=await success(rpc('anon','availability',{p_day:day,p_duration_minutes:60}));
 assert.equal(rows.find(row=>row.court_id===court(1)&&new Date(row.starts_at).toISOString()===at(8)).status,'available');
 const replacement=await success(rpc('staff','create_reservation',await accepted()));
 const old=await success(rpc('staff','create_reservation',params));
 assert.equal(old.current.status,'expired');assert.notEqual(replacement.receipt.id,old.receipt.id);
 assert.equal(Number((await pool.query('select count(*) from public.court_occupancies where active')).rows[0].count),1);
});
test('3A status: changed inputs under an existing key fail and keep the original deadline', async () => {
 const params=await accepted();const original=await success(rpc('staff','create_reservation',params));
 for(const changes of [{p_players:5},{p_source:'phone'},{p_hold_until:new Date(Date.parse(params.p_hold_until)+1000).toISOString()},{p_expected_versions:{}},{p_court_id:court(2)}]) {
  await failure(clients.staff.rpc('create_reservation',{...params,...changes}),'22023');
 }
 assert.deepEqual((await pool.query('select result from public.idempotency_requests')).rows[0].result,original.receipt);
 assert.equal(await count('bookings'),1);assert.equal(await count('audit_events'),1);
});
test('3A status: direct anonymous, inactive and nonstaff reads are denied', async () => {
 const booking=await success(rpc('staff','create_reservation',await accepted()));
 for(const who of ['anon','inactive','outsider']) await failure(rpc(who,'reservation_status',{p_booking_id:booking.receipt.id}),'42501');
 await failure(rpc('staff','reservation_status',{p_booking_id:randomUUID()}),'22023');
 const grants=(await pool.query("select has_function_privilege('authenticated','private.reservation_state(uuid)','EXECUTE') as helper,has_table_privilege('authenticated','public.bookings','UPDATE') as direct_write")).rows[0];
 assert.equal(grants.helper,false);assert.equal(grants.direct_write,false);
});
test('3A status: concurrent release and replays retain one booking and one release audit', async () => {
 const params=await accepted();const original=await success(rpc('staff','create_reservation',params));
 const results=await Promise.all([...Array.from({length:20},()=>rpc('staff','create_reservation',params)),rpc('owner','release_reservation',{p_booking_id:original.receipt.id})]);
 assert.ok(results.every(result=>!result.error));
 for(const result of results.slice(0,20)) {
  assert.deepEqual(result.data.receipt,original.receipt);assert.equal(result.data.replayed,true);
  assert.ok(['held','cancelled'].includes(result.data.current.status));
 }
 assert.equal((await success(rpc('owner','reservation_status',{p_booking_id:original.receipt.id}))).status,'cancelled');
 assert.equal(await count('bookings'),1);assert.equal(await count('audit_events'),2);
});
test('3A status: a real Phase 2 receipt replays after upgrading without rewriting agreements', async () => {
 const connection=await pool.connect();
 try {
  await connection.query('begin');
  await connection.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:identities.TEST_STAFF_ID,role:'authenticated'})]);
  const oldMigration=readFileSync('supabase/migrations/20261031000300_agreed_versions.sql','utf8');
  const oldFunction=oldMigration.slice(oldMigration.indexOf('create function public.create_reservation('),oldMigration.indexOf('\nrevoke all on function private.quote')).replace('create function public.create_reservation(', 'create or replace function public.create_reservation(');
  await connection.query(oldFunction);
  const q=(await connection.query('select public.quote_reservation($1,$2,$3) as q',[court(1),at(8),at(9)])).rows[0].q;
  const values=[court(1),at(8),at(9),4,'staff',randomUUID(),60000,new Date(Date.now()+3600000).toISOString(),q.version_context];
  const statement='select public.create_reservation($1,$2,$3,$4,$5,$6,$7,$8,$9) as result';
  const legacy=(await connection.query(statement,values)).rows[0].result;
  assert.equal(legacy.status,'held');assert.equal(typeof legacy.id,'string');assert.equal(legacy.receipt,undefined);
  const agreement=(await connection.query('select agreement from public.booking_revisions')).rows[0].agreement;
  const upgrade=readFileSync('supabase/migrations/20261102000200_authoritative_reservation_status.sql','utf8');
  await connection.query(upgrade.slice(upgrade.indexOf('create or replace function public.create_reservation(')));
  const replay=(await connection.query(statement,values)).rows[0].result;
  assert.equal(replay.replayed,true);assert.equal(replay.current.status,'held');assert.deepEqual(replay.receipt,legacy);
  assert.deepEqual((await connection.query('select agreement from public.booking_revisions')).rows[0].agreement,agreement);
  assert.deepEqual((await connection.query('select result from public.idempotency_requests')).rows[0].result,legacy);
 } finally { await connection.query('rollback');connection.release(); }
});
