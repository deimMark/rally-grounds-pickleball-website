import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rpc, reservation, success, failure, count, day, court, at, pool } from './helpers.mjs';
const publish = (changes) => rpc('owner','publish_policy',{ p_effective:null,p_changes:changes,p_note:'Synthetic duration regression' });
test('3A duration: default and explicit 60-minute availability preserve the 75 seeded slots', async () => {
 const implicit=await success(rpc('anon','availability',{p_day:day}));
 const explicit=await success(rpc('anon','availability',{p_day:day,p_duration_minutes:60}));
 assert.equal(implicit.length,75);assert.deepEqual(explicit,implicit);
});
test('3A duration: 90/60 resolves to legal 120-minute slots, quotes and reservations', async () => {
 await success(publish({minimum_minutes:90}));
 const implicit=await success(rpc('anon','availability',{p_day:day}));
 const explicit=await success(rpc('anon','availability',{p_day:day,p_duration_minutes:120}));
 assert.equal(implicit.length,70);assert.deepEqual(explicit,implicit);
 assert.ok(explicit.every(row=>Date.parse(row.ends_at)-Date.parse(row.starts_at)===7200000));
 await failure(rpc('anon','availability',{p_day:day,p_duration_minutes:90}),'22023');
 await failure(rpc('staff','quote_reservation',{p_court_id:court(1),p_start:at(8),p_end:new Date(Date.parse(at(8))+5400000).toISOString()}),'23514');
 const q=await success(rpc('staff','quote_reservation',{p_court_id:court(1),p_start:at(8),p_end:at(10)}));
 assert.equal(q.total_centavos,120000);
 await success(rpc('staff','create_reservation',reservation({p_end:at(10),p_expected_total:120000,p_expected_versions:q.version_context})));
 assert.equal((await pool.query('select total_centavos from public.bookings')).rows[0].total_centavos,120000);
 const after=await success(rpc('anon','availability',{p_day:day,p_duration_minutes:120}));
 assert.equal(after.find(row=>row.court_id===court(1)&&new Date(row.starts_at).toISOString()===at(8)).status,'unavailable');
});
test('3A duration: selected 180 minutes respects closing time and configured commercial maximum', async () => {
 await success(publish({minimum_minutes:90,max_duration_minutes:180}));
 const rows=await success(rpc('anon','availability',{p_day:day,p_duration_minutes:180}));
 assert.equal(rows.length,65);
 assert.ok(rows.every(row=>Date.parse(row.ends_at)-Date.parse(row.starts_at)===10800000));
 assert.equal(new Date(rows.at(-1).starts_at).toISOString(),at(20));
 await failure(rpc('anon','availability',{p_day:day,p_duration_minutes:240}),'22023');
 await failure(rpc('staff','quote_reservation',{p_court_id:court(1),p_start:at(8),p_end:at(12)}),'23514');
});
test('3A duration: unsupported policy configurations fail before publication or audit', async () => {
 for(const changes of [{minimum_minutes:1500},{minimum_minutes:90,max_duration_minutes:100},{minimum_minutes:1440,duration_increment_minutes:1000},{duration_increment_minutes:0}]) {
  await failure(publish(changes),'22023');
 }
 assert.equal(await count('policy_versions'),1);assert.equal(await count('audit_events'),0);
});
test('3A duration: invalid selections fail clearly rather than returning an empty calendar', async () => {
 for(const minutes of [0,-1,30,90,1441]) await failure(rpc('anon','availability',{p_day:day,p_duration_minutes:minutes}),'22023');
 assert.equal((await success(rpc('anon','availability',{p_day:day,p_duration_minutes:120}))).length,70);
});
test('3A duration: policy publication leaves existing agreement and stored receipt unchanged', async () => {
 const params=reservation();const quote=await success(rpc('staff','quote_reservation',{p_court_id:params.p_court_id,p_start:params.p_start,p_end:params.p_end}));
 params.p_expected_versions=quote.version_context;
 await success(rpc('staff','create_reservation',params));
 const before=(await pool.query('select agreement from public.booking_revisions')).rows[0].agreement;
 const receipt=(await pool.query('select result from public.idempotency_requests')).rows[0].result;
 await success(publish({minimum_minutes:90}));
 await success(rpc('staff','create_reservation',params));
 assert.deepEqual((await pool.query('select agreement from public.booking_revisions')).rows[0].agreement,before);
 assert.deepEqual((await pool.query('select result from public.idempotency_requests')).rows[0].result,receipt);
 assert.equal(await count('bookings'),1);
});
