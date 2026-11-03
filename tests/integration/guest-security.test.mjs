import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { pool, settings, rpc, success, failure, reservation } from './helpers.mjs';
const hex = () => randomBytes(32).toString('hex');
const network = hex(), fingerprint = hex();
const gateway = () => createClient(settings.API_URL, settings.adminKey, { auth: { persistSession:false, autoRefreshToken:false } });
const params = (overrides={}) => ({p_id:randomUUID(),p_hash:hex(),p_network_key:network,p_key_fingerprint:fingerprint,p_cookie_count:0,...overrides});
const admit = (p=params()) => gateway().rpc('guest_intent_admit',p);
const authorize = (p, scope='create') => gateway().rpc('guest_intent_authorize',{p_id:p.p_id,p_hash:p.p_hash,p_scope:scope});
beforeEach(async()=>{
 await pool.query(`update private.guest_security_config set enabled=true,create_ttl_seconds=300,access_ttl_seconds=900,
 window_seconds=86400,max_requests=5,max_active_intents=5,max_cookie_count=5,retention_seconds=86400,key_fingerprint=$1`,[fingerprint]);
});
test('guest: credential hash only, separate expiries, no fake staff actor and redacted audit',async()=>{
 const bytes=randomBytes(32),p=params({p_hash:createHash('sha256').update(bytes).digest('hex')});
 const result=await success(admit(p));assert.equal(result.outcome,'created');
 const row=(await pool.query('select * from private.guest_intents where id=$1',[p.p_id])).rows[0];
 assert.ok(row.credential_hash===p.p_hash);assert.ok(!JSON.stringify(row).includes(bytes.toString('base64url')));
 assert.equal(row.create_expires_at-row.created_at,300000);assert.equal(row.access_expires_at-row.created_at,900000);
 assert.equal(row.booking_id,null);assert.deepEqual(Object.keys(result).sort(),['accessExpiresAt','createExpiresAt','intentId','outcome']);
 const audit=(await pool.query('select actor_id,action,metadata from public.audit_events')).rows;
 assert.deepEqual(audit,[{actor_id:null,action:'guest.intent_created',metadata:{scope:'guest_intent',actor_kind:'guest'}}]);
 assert.equal((await pool.query('select count(*) from public.bookings')).rows[0].count,'0');
});
test('guest: forged, unknown and wrong-scope capabilities fail uniformly',async()=>{
 const p=params(), other=params();await success(admit(p));await success(admit(other));assert.equal(await success(authorize(p)),true);
 assert.equal(await success(authorize({...p,p_id:other.p_id})),false);
 assert.equal(await success(authorize({...p,p_hash:hex()})),false);
 assert.equal(await success(authorize({...p,p_id:randomUUID()})),false);
 for(const scope of ['staff','booking','',null]) assert.equal(await success(authorize(p,scope)),false);
});
test('guest: creation deadline expires independently from access; total expiry rejects both',async()=>{
 await pool.query('update private.guest_security_config set create_ttl_seconds=1,access_ttl_seconds=300');
 const p=params();await success(admit(p));
 await new Promise(resolve=>setTimeout(resolve,1200));
 assert.equal(await success(authorize(p)),false);assert.equal(await success(authorize(p,'access')),true);
 await pool.query('update private.guest_security_config set access_ttl_seconds=1');
 const expired=params();await success(admit(expired));
 await new Promise(resolve=>setTimeout(resolve,1200));
 assert.equal(await success(authorize(expired)),false);assert.equal(await success(authorize(expired,'access')),false);
});
test('guest: only owner revokes; revocation is idempotent, audited once and permanent',async()=>{
 const p=params();await success(admit(p));
 await failure(rpc('staff','revoke_guest_intent',{p_id:p.p_id}),'42501');
 await failure(rpc('anon','revoke_guest_intent',{p_id:p.p_id}));
 assert.equal(await success(rpc('owner','revoke_guest_intent',{p_id:p.p_id})),true);
 assert.equal(await success(rpc('owner','revoke_guest_intent',{p_id:p.p_id})),false);
 assert.equal(await success(authorize(p,'access')),false);
 await assert.rejects(pool.query('update private.guest_intents set revoked_at=null where id=$1',[p.p_id]),{code:'23514'});
 assert.equal((await pool.query("select count(*) from public.audit_events where action='guest.intent_revoked'")).rows[0].count,'1');
});
test('guest: direct anonymous/staff/owner admission and private table access are denied',async()=>{
 await assert.rejects(pool.query('select public.guest_intent_authorize($1,$2,$3)',[randomUUID(),hex(),'access']),{code:'42501'});
 for(const who of ['anon','staff','owner','inactive','outsider']) {
  await failure(rpc(who,'guest_intent_admit',params()));
  await failure(rpc(who,'guest_intent_authorize',{p_id:randomUUID(),p_hash:hex(),p_scope:'access'}));
 }
 for(const role of ['anon','authenticated','service_role']) {
  const client=await pool.connect();
  try {await client.query('begin');await client.query(`set local role ${role}`);await assert.rejects(client.query('select * from private.guest_intents'),{code:'42501'});}
  finally {await client.query('rollback');client.release();}
 }
 const rls=(await pool.query("select relrowsecurity from pg_class where oid='private.guest_intents'::regclass")).rows[0];assert.equal(rls.relrowsecurity,true);
});
test('guest: twenty concurrent admissions yield five intents and fifteen durable denials',async()=>{
 const replies=await Promise.all(Array.from({length:20},()=>admit().then(success)));
 assert.equal(replies.filter(x=>x.outcome==='created').length,5);assert.equal(replies.filter(x=>x.outcome==='rate_limited').length,15);
 assert.equal((await pool.query('select count(*) from private.guest_intents')).rows[0].count,'5');
 assert.equal((await pool.query('select hits from private.guest_rate_buckets')).rows[0].hits,6);
 assert.equal((await pool.query("select count(*) from public.audit_events where action='guest.intent_created'")).rows[0].count,'5');
});
test('guest: limiter persists across a new service client in a fresh Node process',async()=>{
 for(let i=0;i<5;i++) await success(admit());
 // Private values travel over child stdin, never command arguments or test output.
 const child=execFileSync(process.execPath,['--input-type=module','-e',`import {createClient} from '@supabase/supabase-js';let raw='';for await(const c of process.stdin)raw+=c;const x=JSON.parse(raw);const c=createClient(x.url,x.key,{auth:{persistSession:false}});const r=await c.rpc('guest_intent_admit',x.p);process.stdout.write(r.error?'error':r.data.outcome);`],{cwd:process.cwd(),input:JSON.stringify({url:settings.API_URL,key:settings.adminKey,p:params()}),encoding:'utf8'});
 assert.equal(child,'rate_limited');
});
test('guest: missing/disabled configuration and rotated key fail closed without counters',async()=>{
 await pool.query('update private.guest_security_config set enabled=false');assert.equal((await success(admit())).outcome,'policy_not_ready');
 await pool.query('update private.guest_security_config set enabled=true');assert.equal((await success(admit(params({p_key_fingerprint:hex()})))).outcome,'policy_not_ready');
 await assert.rejects(pool.query('update private.guest_security_config set access_ttl_seconds=null'),{code:'23514'});
 await pool.query('delete from private.guest_security_config');assert.equal((await success(admit())).outcome,'policy_not_ready');
 await pool.query("insert into private.guest_security_config(singleton,enabled,purpose) values(true,false,'synthetic_local_only')");
 assert.equal((await pool.query('select count(*) from private.guest_rate_buckets')).rows[0].count,'0');
});
test('guest: cookie and active-intent budgets cannot be bypassed by deleting cookies',async()=>{
 assert.equal((await success(admit(params({p_cookie_count:5})))).outcome,'rate_limited');
 assert.equal((await pool.query('select hits from private.guest_rate_buckets')).rows[0].hits,1);
 await pool.query('update private.guest_security_config set max_requests=100,max_active_intents=1');
 assert.equal((await success(admit())).outcome,'created');assert.equal((await success(admit())).outcome,'rate_limited');
});
test('guest: deadline/hash immutability and unique, irreversible booking binding',async()=>{
 const p=params(),other=params();await success(admit(p));await success(admit(other));
 for(const [column,value] of [['credential_hash',hex()],['access_expires_at',new Date(Date.now()+3600000)]])
  await assert.rejects(pool.query(`update private.guest_intents set ${column}=$1 where id=$2`,[value,p.p_id]),{code:'23514'});
 const booked=await success(rpc('staff','create_reservation',reservation()));const booking=booked.receipt.id;
 // A synthetic staff booking is used solely to test the FK/binding constraint; no guest booking RPC exists.
 await pool.query('update private.guest_intents set booking_id=$1 where id=$2',[booking,p.p_id]);
 assert.equal(await success(authorize(p)),false);assert.equal(await success(authorize(p,'access')),true);
 await assert.rejects(pool.query('update private.guest_intents set booking_id=null where id=$1',[p.p_id]),{code:'23514'});
 await assert.rejects(pool.query('update private.guest_intents set booking_id=$1 where id=$2',[booking,other.p_id]),{code:'23505'});
});
