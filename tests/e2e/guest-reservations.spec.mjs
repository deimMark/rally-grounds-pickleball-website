import { test, expect } from '@playwright/test';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import pg from 'pg';
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
