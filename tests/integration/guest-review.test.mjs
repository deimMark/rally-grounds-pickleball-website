import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { pool, clients, settings, rpc, success, failure, reservation } from './helpers.mjs';
const hex=()=>randomBytes(32).toString('hex');
const key=hex(), network=hex();
const admin=()=>createClient(settings.API_URL,settings.adminKey,{auth:{persistSession:false,autoRefreshToken:false}});
const input=()=>({p_id:randomUUID(),p_hash:hex(),p_network_key:network,p_key_fingerprint:key,p_cookie_count:0});
const admit=(p)=>admin().rpc('guest_intent_admit',p);
beforeEach(async()=>{
 await pool.query(`update private.guest_security_config set enabled=true,create_ttl_seconds=300,access_ttl_seconds=900,
 window_seconds=86400,max_requests=5,max_active_intents=5,max_cookie_count=5,retention_seconds=86400,key_fingerprint=$1`,[key]);
});

test('review: SECURITY DEFINER catalog and function privileges are narrowly scoped',async()=>{
 const rows=(await pool.query(`select p.proname,p.prosecdef,p.proconfig,
 has_function_privilege('anon',p.oid,'EXECUTE') as anonymous,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated,
 has_function_privilege('service_role',p.oid,'EXECUTE') as service
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
 and p.proname in ('guest_intent_admit','guest_intent_authorize','revoke_guest_intent')`)).rows;
 assert.equal(rows.length,3);
 for(const row of rows){assert.equal(row.prosecdef,true);assert.ok(row.proconfig.includes('search_path=""'));assert.equal(row.anonymous,false);
  assert.equal(row.authenticated,row.proname==='revoke_guest_intent');assert.equal(row.service,row.proname!=='revoke_guest_intent');}
 const policies=(await pool.query("select count(*) from pg_policies where schemaname='private' and tablename like 'guest_%'")).rows[0].count;
 assert.equal(policies,'0');
});

test('review: direct REST enumeration and mutation attempts expose no private guest tables',async()=>{
 await success(admit(input()));
 for(const who of ['anon','staff','owner','inactive','outsider']) {
  for(const table of ['guest_intents','guest_rate_buckets','guest_security_config']) {
   await failure(clients[who].schema('private').from(table).select('*'));
   await failure(clients[who].schema('private').from(table).insert({id:randomUUID()}));
   await failure(clients[who].schema('private').from(table).update({credential_hash:hex()}).not('id','is',null));
   await failure(clients[who].schema('private').from(table).delete().not('id','is',null));
  }
  await failure(clients[who].from('guest_intents').select('*'));
 }
 assert.equal((await pool.query('select count(*) from private.guest_intents')).rows[0].count,'1');
});

test('review: RLS independently denies reads even with rollback-only temporary read grants',async()=>{
 await success(admit(input()));
 const client=await pool.connect();
 try {
  await client.query('begin');
  // Isolate RLS from schema/table ACLs on this local admin transaction only. Never committed.
  await client.query('grant usage on schema private to anon,authenticated');
  await client.query('grant select on private.guest_intents,private.guest_rate_buckets,private.guest_security_config to anon,authenticated');
  for(const role of ['anon','authenticated']) {
   await client.query(`set local role ${role}`);
   for(const table of ['guest_intents','guest_rate_buckets','guest_security_config'])
    assert.equal((await client.query(`select count(*) from private.${table}`)).rows[0].count,'0');
   await client.query('reset role');
  }
 } finally {await client.query('rollback');client.release();}
 assert.equal((await pool.query("select has_table_privilege('anon','private.guest_intents','SELECT') as allowed")).rows[0].allowed,false);
});

test('review: search-path/temp-table shadowing cannot substitute capability rows',async()=>{
 const p=input();await success(admit(p));const forged=hex();const client=await pool.connect();
 try {
  await client.query('begin');await client.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({role:'service_role'})]);
  await client.query('create temp table guest_intents(id uuid,credential_hash text,scope text) on commit drop');
  await client.query("insert into guest_intents values($1,$2,'guest_intent')",[p.p_id,forged]);
  await client.query('set local search_path=pg_temp,public');
  assert.equal((await client.query("select public.guest_intent_authorize($1,$2,'access') as allowed",[p.p_id,forged])).rows[0].allowed,false);
  assert.equal((await client.query("select public.guest_intent_authorize($1,$2,'access') as allowed",[p.p_id,p.p_hash])).rows[0].allowed,true);
 } finally {await client.query('rollback');client.release();}
});

test('review: direct RPC argument/actor injection cannot bypass role or signature checks',async()=>{
 const p=input();
 for(const who of ['anon','staff','owner']) {
  await failure(clients[who].rpc('guest_intent_admit',{...p,p_actor_id:randomUUID()}));
  await failure(clients[who].rpc('guest_intent_admit',{...p,p_function:'publish_policy'}));
  await failure(clients[who].rpc('guest_intent_authorize',{p_id:p.p_id,p_hash:p.p_hash,p_scope:'access'}));
 }
 assert.equal((await pool.query('select count(*) from private.guest_intents')).rows[0].count,'0');
});

test('review: scope/key/deadline and committed binding cannot be rewritten',async()=>{
 const p=input();await success(admit(p));
 for(const [field,value] of [['id',randomUUID()],['scope','guest_intent_other'],['network_key',hex()],['created_at',new Date(Date.now()-1000)],['create_expires_at',new Date(Date.now()+600000)],['delete_after',new Date(Date.now()+172800000)]])
  await assert.rejects(pool.query(`update private.guest_intents set ${field}=$1 where id=$2`,[value,p.p_id]),{code:'23514'});
 const first=(await success(rpc('staff','create_reservation',reservation()))).receipt.id;
 const second=(await success(rpc('staff','create_reservation',reservation({p_court_id:'00000000-0000-4000-8000-000000000002'})))).receipt.id;
 await pool.query('update private.guest_intents set booking_id=$1 where id=$2',[first,p.p_id]);
 await assert.rejects(pool.query('update private.guest_intents set booking_id=$1 where id=$2',[second,p.p_id]),{code:'23514'});
 assert.equal((await pool.query('select booking_id from private.guest_intents where id=$1',[p.p_id])).rows[0].booking_id,first);
});

test('review: concurrent owner revocation creates exactly one redacted transition audit',async()=>{
 const p=input();await success(admit(p));
 const results=await Promise.all(Array.from({length:20},()=>rpc('owner','revoke_guest_intent',{p_id:p.p_id}).then(success)));
 assert.equal(results.filter(Boolean).length,1);
 const audits=(await pool.query('select action,metadata from public.audit_events where entity_id=$1',[p.p_id])).rows;
 assert.equal(audits.length,2);
 for(const row of audits){assert.deepEqual(Object.keys(row.metadata).sort(),row.action==='guest.intent_created'?['actor_kind','scope']:['actor_kind']);assert.ok(!JSON.stringify(row).includes(p.p_hash));}
});
