import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { rpc, clients, reservation, success, failure, count, pool, court, day, at, identities } from './helpers.mjs';
const block=async (numbers=[1,2],kind='open_play',key=randomUUID()) => success(rpc('staff','block_courts',{p_court_ids:numbers.map(court),p_start:at(8),p_end:at(9),p_kind:kind,p_request_key:key}));
const release=(ids,key=randomUUID(),who='staff')=>rpc(who,'release_blocks',{p_occupancy_ids:ids,p_request_key:key});
async function activeCount(){return Number((await pool.query('select count(*) from public.court_occupancies where active')).rows[0].count);}
async function releaseAudits(){return Number((await pool.query("select count(*) from public.audit_events where action='court.block_released'")).rows[0].count);}

test('3A blocks: staff can release mixed multi-court block IDs without rewriting history', async () => {
 const open=await block();const maintenance=await block([3,4],'maintenance');
 const ids=[...open.occupancy_ids,...maintenance.occupancy_ids];
 const before=(await pool.query('select * from public.court_occupancies order by id')).rows;
 const result=await success(release(ids));
 assert.equal(result.released_ids.length,4);assert.deepEqual(result.already_released_ids,[]);
 assert.equal(await activeCount(),0);assert.equal(await releaseAudits(),4);assert.equal(await count('court_occupancies'),4);
 const after=(await pool.query('select * from public.court_occupancies order by id')).rows;
 assert.deepEqual(after.map(row=>({...row,active:true})),before);
 assert.ok((await success(rpc('anon','availability',{p_day:day}))).every(row=>row.status==='available'));
 const audit=await success(clients.owner.from('audit_events').select('*').eq('action','court.block_released'));
 assert.ok(audit.every(row=>row.actor_id===identities.TEST_STAFF_ID));
 assert.ok(audit.every(row=>JSON.stringify(Object.keys(row.metadata).sort())===JSON.stringify(['court_id','kind'])));
});
test('3A blocks: invalid or reservation IDs roll back the entire request and its audit', async () => {
 const blocks=await block();
 await success(rpc('staff','create_reservation',reservation({p_court_id:court(3)})));
 const reservationId=(await pool.query("select id from public.court_occupancies where kind='reservation'")).rows[0].id;
 for(const ids of [[blocks.occupancy_ids[0],randomUUID()],[blocks.occupancy_ids[0],reservationId],[],null,[null]]) await failure(release(ids),'22023');
 assert.equal(await activeCount(),3);assert.equal(await releaseAudits(),0);assert.equal(await count('idempotency_requests'),2);
});
test('3A blocks: 20 distinct concurrent release attempts audit each transition exactly once', async () => {
 const blocks=await block();
 const results=await Promise.all(Array.from({length:20},()=>release(blocks.occupancy_ids)));
 assert.ok(results.every(result=>!result.error));
 assert.equal(results.reduce((sum,result)=>sum+result.data.released_ids.length,0),2);
 assert.equal(results.filter(result=>result.data.released_ids.length===2).length,1);
 assert.equal(results.filter(result=>result.data.already_released_ids.length===2).length,19);
 assert.equal(await activeCount(),0);assert.equal(await releaseAudits(),2);
});
test('3A blocks: concurrent same-key releases return one canonical receipt', async () => {
 const blocks=await block();const key=randomUUID();
 const results=await Promise.all(Array.from({length:20},(_,i)=>release(i%2?blocks.occupancy_ids.toReversed():blocks.occupancy_ids,key)));
 assert.ok(results.every(result=>!result.error));
 assert.ok(results.every(result=>JSON.stringify(result.data)===JSON.stringify(results[0].data)));
 assert.equal(await count('idempotency_requests'),2);assert.equal(await releaseAudits(),2);
});
test('3A blocks: overlapping partial multi-court releases use stable locks and do not duplicate audits', async () => {
 const blocks=await block([1,2,3]);const key=randomUUID();
 const results=await Promise.all([release(blocks.occupancy_ids.slice(0,2),key,'staff'),release(blocks.occupancy_ids.slice(1),key,'owner')]);
 assert.ok(results.every(result=>!result.error));
 assert.equal(results.reduce((sum,result)=>sum+result.data.released_ids.length,0),3);
 assert.equal(await activeCount(),0);assert.equal(await releaseAudits(),3);
});
test('3A blocks: unauthorized and revoked staff cannot release blocks or mutate tables directly', async () => {
 const blocks=await block();
 for(const who of ['anon','inactive','outsider']) await failure(release(blocks.occupancy_ids,randomUUID(),who),'42501');
 await success(rpc('owner','set_staff_role',{p_user_id:identities.TEST_STAFF_ID,p_role:'staff',p_active:false}));
 await failure(release(blocks.occupancy_ids),'42501');
 assert.equal(await activeCount(),2);assert.equal(await releaseAudits(),0);
 const grants=(await pool.query("select has_table_privilege('authenticated','public.court_occupancies','UPDATE') as update,has_table_privilege('authenticated','public.court_occupancies','DELETE') as delete,has_function_privilege('anon','public.release_blocks(uuid[],uuid)','EXECUTE') as anon_execute")).rows[0];
 assert.deepEqual(grants,{update:false,delete:false,anon_execute:false});
});
test('3A blocks: reusing a key with another operation or changed IDs fails atomically', async () => {
 const key=randomUUID();const first=await block([1],'open_play',key);const second=await block([2]);
 await failure(release(first.occupancy_ids,key),'22023');
 const releaseKey=randomUUID();await success(release(first.occupancy_ids,releaseKey));
 await failure(release(second.occupancy_ids,releaseKey),'22023');
 assert.equal(await activeCount(),1);assert.equal(await releaseAudits(),1);
});
test('3A blocks: retrying release of an old block cannot release a replacement reservation', async () => {
 const blocks=await block([1],'maintenance');const key=randomUUID();
 const released=await success(release(blocks.occupancy_ids,key));
 await success(rpc('staff','create_reservation',reservation()));
 assert.deepEqual(await success(release(blocks.occupancy_ids,key)),released);
 const repeated=await success(release(blocks.occupancy_ids));
 assert.deepEqual(repeated.released_ids,[]);assert.equal(repeated.already_released_ids.length,1);
 assert.equal(await activeCount(),1);assert.equal(await releaseAudits(),1);
});
