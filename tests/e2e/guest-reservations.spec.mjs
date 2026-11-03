import { test, expect } from '@playwright/test';
import { randomUUID, createHash, createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createClient } from '@supabase/supabase-js';
import { normalizeGuestReservation } from '../../lib/domain/guest-reservation.js';
import { localSettings } from '../../scripts/local-settings.mjs';
const settings=localSettings();const pool=new pg.Pool({connectionString:settings.DB_URL});
const origin=`http://127.0.0.1:${process.env.TEST_PORT || 3000}`;const headers={origin};
const day=new Date(Date.now()+3*86400000).toISOString().slice(0,10);
const at=h=>new Date(`${day}T${String(h).padStart(2,'0')}:00:00+08:00`).toISOString();
const court=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
test.describe.configure({mode:'serial'});
test.beforeEach(async()=>{
 await pool.query('truncate private.guest_intents,private.guest_rate_buckets,private.guest_operation_buckets,private.guest_booking_policies,public.courts,public.policy_versions,public.club_settings_versions,public.customers cascade');
 await pool.query(readFileSync('supabase/seed.sql','utf8'));await pool.query(readFileSync('supabase/guest-booking.local.sql','utf8'));
 await pool.query(`update private.guest_security_config set enabled=true,create_ttl_seconds=300,access_ttl_seconds=900,
 window_seconds=86400,max_requests=100,max_active_intents=100,max_cookie_count=30,retention_seconds=86400,key_fingerprint=$1`,[createHash('sha256').update(Buffer.from(process.env.GUEST_RATE_HMAC_KEY,'hex')).digest('hex')]);
});
test.afterAll(async()=>{await pool.end();});
async function prepare(request,n=1,h=8) {
 const r=await request.post('/api/guest-intents',{headers,data:{}});expect(r.status()).toBe(201);const intent=await r.json();
 const q=await request.post('/api/quotes',{headers,data:{intentId:intent.intentId,courtId:court(n),startsAt:at(h),durationMinutes:60}});expect(q.status()).toBe(201);
 return {quote:await q.json(),body:{intentId:intent.intentId,quoteId:(await q.json()).quoteId,guest:{name:'Synthetic Browser Guest',contact:{kind:'email',value:'browser@example.invalid'}},estimatedPlayers:4},key:randomUUID()};
}
const reserve=(request,p,body=p.body)=>request.post('/api/guest-reservations',{headers:{...headers,'idempotency-key':p.key},data:body});
const status=(request,p,reference)=>request.get(`/api/guest-reservations/${reference}`,{headers:{...headers,'x-guest-intent':p.body.intentId}});
test('local API produces a private unpaid hold, lost-response retry and bound status without contact disclosure',async({request})=>{
 const p=await prepare(request),r=await reserve(request,p);expect(r.status()).toBe(201);const first=await r.json();
 expect(Object.keys(first).sort()).toEqual(['current','receipt','replayed']);expect(first.current.status).toBe('held');expect(first.receipt.stateAtCreation).toBe('held');expect(first.receipt.totalCentavos).toBe(60000);
 const retry=await reserve(request,p);expect(retry.status()).toBe(200);const replay=await retry.json();expect(replay.receipt).toEqual(first.receipt);expect(replay.replayed).toBe(true);
 const s=await status(request,p,first.receipt.reference);expect(s.status()).toBe(200);expect((await s.json()).receipt).toEqual(first.receipt);
 for(const response of [r,retry,s]){
 expect(response.headers()['cache-control']).toContain('no-store');expect(response.headers()['referrer-policy']).toBe('no-referrer');
 const text=await response.text();for(const forbidden of ['browser@example.invalid','Synthetic Browser Guest','customer_id','created_by','credential','contact'])expect(text.includes(forbidden)).toBe(false);
 }
 expect((await pool.query('select count(*) from public.bookings')).rows[0].count).toBe('1');
});
test('twenty independent HTTP guests yield one hold and nineteen controlled conflicts',async({playwright})=>{
 const contexts=await Promise.all(Array.from({length:20},()=>playwright.request.newContext({baseURL:origin})));
 try {
 const plans=await Promise.all(contexts.map(ctx=>prepare(ctx)));const results=await Promise.all(contexts.map((ctx,i)=>reserve(ctx,plans[i])));
 expect(results.filter(r=>r.status()===201).length).toBe(1);expect(results.filter(r=>r.status()===409).length).toBe(19);
 for(const r of results.filter(r=>r.status()===409))expect(await r.json()).toEqual({error:'SLOT_UNAVAILABLE'});
 expect((await pool.query('select count(*) from public.customers')).rows[0].count).toBe('1');expect((await pool.query('select count(*) from private.guest_booking_requests')).rows[0].count).toBe('20');
 }finally{await Promise.all(contexts.map(ctx=>ctx.dispose()));}
});
test('twenty identical HTTP retries create one booking with one unchanged receipt',async({request})=>{
 const p=await prepare(request);const replies=await Promise.all(Array.from({length:20},()=>reserve(request,p)));
 expect(replies.filter(x=>x.status()===201).length).toBe(1);expect(replies.filter(x=>x.status()===200).length).toBe(19);
 const data=await Promise.all(replies.map(x=>x.json()));expect(data.every(x=>JSON.stringify(x.receipt)===JSON.stringify(data[0].receipt))).toBe(true);
 expect((await pool.query('select count(*) from public.bookings')).rows[0].count).toBe('1');
});
test('capability and binding checks make stranger and nonexistent references indistinguishable',async({request,playwright})=>{
 const a=await prepare(request),created=await(await reserve(request,a)).json();const other=await playwright.request.newContext({baseURL:origin});
 try {
 const b=await prepare(other,2);const response=await status(other,b,created.receipt.reference);expect(response.status()).toBe(404);expect(await response.json()).toEqual({error:'ACCESS_UNAVAILABLE'});
 expect(await(await status(other,b,randomUUID())).json()).toEqual(await response.json());
 const lost=await other.get(`/api/guest-reservations/${created.receipt.reference}`,{headers:{...headers,'x-guest-intent':a.body.intentId}});expect(lost.status()).toBe(404);
 }finally{await other.dispose();}
});
test('client price/deadline/payment/source/actor authority and real contacts are rejected',async({request})=>{
 const p=await prepare(request);
 for(const field of ['totalCentavos','expiresAt','paid','source','employeeId','credentialHash']){
 const r=await reserve(request,p,{...p.body,[field]:'forged'});expect(r.status()).toBe(400);expect(await r.json()).toEqual({error:'INVALID_REQUEST'});}
 const real={...p.body,guest:{name:'Synthetic',contact:{kind:'email',value:'do-not-collect@gmail.com'}}};expect((await reserve(request,p,real)).status()).toBe(400);
 expect((await pool.query('select count(*) from public.customers')).rows[0].count).toBe('0');expect((await pool.query('select count(*) from private.guest_booking_requests')).rows[0].count).toBe('0');
});
test('Origin, malformed body and private-read cross-site checks fail safely',async({request})=>{
 const p=await prepare(request);
 for(const endpoint of ['/api/quotes','/api/guest-reservations']){
 expect((await request.post(endpoint,{headers:{origin:'https://evil.example'},data:p.body})).status()).toBe(403);
 expect((await request.post(endpoint,{headers:{...headers,'content-type':'application/json'},data:' '.repeat(2049)+'{}'})).status()).toBe(400);}
 expect((await request.get(`/api/guest-reservations/${randomUUID()}`,{headers:{...headers,'sec-fetch-site':'cross-site','x-guest-intent':p.body.intentId}})).status()).toBe(404);
});
test('selected duration and safe public availability reject unsupported input and disclose no booking data',async({request})=>{
 const p=await prepare(request);await reserve(request,p);
 const r=await request.get(`/api/availability?day=${day}&durationMinutes=60`);expect(r.status()).toBe(200);const a=await r.json();
 expect(a.timezone).toBe('Asia/Manila');expect(a.courts.length).toBe(5);expect(a.slots.find(x=>x.courtId===court(1)&&x.startsAt===at(8)).status).toBe('unavailable');
 for(const word of ['reference','booking_id','customer','contact','totalCentavos'])expect(JSON.stringify(a).includes(word)).toBe(false);
 expect((await request.get(`/api/availability?day=${day}&durationMinutes=90`)).status()).toBe(400);
 expect((await request.get(`/api/availability?day=${day}&durationMinutes=60&extra=1`)).status()).toBe(400);
});
test('changed idempotency input conflicts without creating another booking',async({request})=>{
 const p=await prepare(request);await reserve(request,p);
 const r=await reserve(request,p,{...p.body,estimatedPlayers:5});expect(r.status()).toBe(409);expect(await r.json()).toEqual({error:'REQUEST_MISMATCH'});
 const newKey=await reserve(request,{...p,key:randomUUID()});expect(newKey.status()).toBe(409);expect(await newKey.json()).toEqual({error:'INTENT_ALREADY_BOUND'});
});

test('review: actual browser GET omits Origin and cannot yet use the private-read contract',async({page,context})=>{
 const p=await prepare(context.request);const created=await(await reserve(context.request,p)).json();await page.goto('/');
 const result=await page.evaluate(async({ref,intentId})=>{
  const response=await fetch(`/api/guest-reservations/${ref}`,{headers:{'x-guest-intent':intentId}});
  return {status:response.status,body:await response.json()};
 },{ref:created.receipt.reference,intentId:p.body.intentId});
 // Documents an existing local API/browser handoff limitation; no security check is relaxed.
 expect(result).toEqual({status:404,body:{error:'ACCESS_UNAVAILABLE'}});
 expect((await status(context.request,p,created.receipt.reference)).status()).toBe(200);
});
async function reviewServer(port) {
 const url=`http://127.0.0.1:${port}`;let logs='';
 const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{env:{...process.env,APP_ORIGIN:url},stdio:['ignore','pipe','pipe']});
 child.stdout.on('data',chunk=>{logs+=chunk;});child.stderr.on('data',chunk=>{logs+=chunk;});
 const stop=async()=>{if(child.exitCode===null&&child.signalCode===null){const exited=once(child,'exit');child.kill('SIGTERM');await exited;}};
 try {
  for(let i=0;i<100;i++){
   try{if((await fetch(url,{signal:AbortSignal.timeout(500)})).ok)return{url,stop,logs:()=>logs};}catch{}
   if(child.exitCode!==null)break;await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw new Error('Review server failed to start');
 }catch(error){await stop();throw error;}
}
test('review: a pending admitted HTTP payload survives real Next process restarts without leaking inputs',async({request})=>{
 const p=await prepare(request);const cookies=(await request.storageState()).cookies;
 const credential=cookies.find(c=>c.name===`rg-intent-${p.body.intentId}`).value;
 const fingerprint=createHmac('sha256',Buffer.from(credential,'base64url')).update(JSON.stringify(normalizeGuestReservation(p.body))).digest('hex');
 const row=(await pool.query('select credential_hash,network_key from private.guest_intents where id=$1',[p.body.intentId])).rows[0];
 const key=(await pool.query('select key_fingerprint from private.guest_security_config')).rows[0].key_fingerprint;
 const gateway=createClient(settings.API_URL,settings.adminKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const admitted=await gateway.rpc('guest_request_admit',{p_id:p.body.intentId,p_hash:row.credential_hash,p_network_key:row.network_key,p_key_fingerprint:key,p_request_key:p.key,p_fingerprint:fingerprint});
 expect(admitted.error).toBe(null);expect(admitted.data.outcome).toBe('admitted');
 expect((await pool.query('select count(*) from public.bookings')).rows[0].count).toBe('0');
 // Start and stop before recovery, then restart again after the committed response.
 let server=await reviewServer(3197);await server.stop();server=await reviewServer(3197);
 const outputs=[];
 try {
  const first=await request.post(server.url+'/api/guest-reservations',{headers:{origin:server.url,'idempotency-key':p.key},data:p.body});expect(first.status()).toBe(201);const receipt=(await first.json()).receipt;
  outputs.push(server.logs());await server.stop();server=await reviewServer(3197);
  const replay=await request.post(server.url+'/api/guest-reservations',{headers:{origin:server.url,'idempotency-key':p.key},data:p.body});expect(replay.status()).toBe(200);expect((await replay.json()).receipt).toEqual(receipt);
  expect((await pool.query('select count(*) from public.bookings')).rows[0].count).toBe('1');
  outputs.push(server.logs());
  for(const secret of [credential,row.credential_hash,fingerprint,process.env.SUPABASE_GUEST_SERVICE_KEY,process.env.GUEST_RATE_HMAC_KEY,p.body.guest.name,p.body.guest.contact.value])expect(outputs.some(text=>text.includes(secret))).toBe(false);
 } finally {await server.stop();}
});

test('review: database rejects UUID arrays accepted by permissive JavaScript normalization',async({request})=>{
 const p=await prepare(request);
 const quote=await request.post('/api/quotes',{headers,data:{intentId:[p.body.intentId],courtId:court(1),startsAt:at(8),durationMinutes:60}});
 expect(quote.status()).toBe(400);expect(await quote.json()).toEqual({error:'INVALID_REQUEST'});
 const response=await reserve(request,p,{...p.body,quoteId:[p.body.quoteId]});expect(response.status()).toBe(400);expect(await response.json()).toEqual({error:'INVALID_REQUEST'});
 expect((await pool.query('select count(*) from public.bookings')).rows[0].count).toBe('0');
 expect((await pool.query('select count(*) from public.customers')).rows[0].count).toBe('0');
 expect((await pool.query('select count(*) from private.guest_booking_requests where booking_id is null')).rows[0].count).toBe('1');
});
