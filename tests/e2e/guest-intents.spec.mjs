import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import pg from 'pg';
import { localSettings } from '../../scripts/local-settings.mjs';

const settings=localSettings();
const pool=new pg.Pool({connectionString:settings.DB_URL});
const origin=`http://127.0.0.1:${process.env.TEST_PORT || 3000}`;
const endpoint='/api/guest-intents';
const headers={origin,'content-type':'application/json'};
test.describe.configure({mode:'serial'});
test.beforeEach(async()=>{
 await pool.query('truncate private.guest_intents,private.guest_rate_buckets cascade');
 await pool.query(`update private.guest_security_config set enabled=true,create_ttl_seconds=300,access_ttl_seconds=900,
 window_seconds=86400,max_requests=5,max_active_intents=5,max_cookie_count=5,retention_seconds=86400,key_fingerprint=$1`,
 [createHash('sha256').update(Buffer.from(process.env.GUEST_RATE_HMAC_KEY,'hex')).digest('hex')]);
});
test.afterAll(async()=>{await pool.end();});

test('intent admission is account-free, cookie-private and stores only a hash',async({page,context})=>{
 const response=await context.request.post(endpoint,{headers,data:{}});
 expect(response.status()).toBe(201);
 const data=await response.json();expect(Object.keys(data).sort()).toEqual(['accessExpiresAt','createExpiresAt','intentId']);
 const cookies=await context.cookies();const cookie=cookies.find(x=>x.name===`rg-intent-${data.intentId}`);
 expect(Boolean(cookie)).toBe(true);expect(cookie.httpOnly).toBe(true);expect(cookie.secure).toBe(false);expect(cookie.sameSite).toBe('Lax');expect(cookie.path).toBe('/');
 expect(Buffer.from(cookie.value,'base64url').length).toBe(32);
 const row=(await pool.query('select credential_hash from private.guest_intents where id=$1',[data.intentId])).rows[0];
 expect(row.credential_hash===createHash('sha256').update(Buffer.from(cookie.value,'base64url')).digest('hex')).toBe(true);
 expect(JSON.stringify(data).includes(cookie.value)).toBe(false);expect(JSON.stringify(data).includes(row.credential_hash)).toBe(false);
 expect(response.headers()['cache-control'].includes('no-store')).toBe(true);expect(response.headers()['referrer-policy']).toBe('no-referrer');
 await page.goto('/');expect(await page.evaluate(()=>document.cookie.includes('rg-intent-'))).toBe(false);
 const audit=(await pool.query('select actor_id,metadata from public.audit_events where entity_id=$1',[data.intentId])).rows[0];
 expect(audit.actor_id).toBe(null);expect(Object.keys(audit.metadata).sort()).toEqual(['actor_kind','scope']);
});

test('browser CSRF boundaries reject cross-origin, missing Origin and cross-site metadata',async({request})=>{
 for(const requestHeaders of [ {'content-type':'application/json'}, {...headers,origin:'https://evil.example'}, {...headers,'sec-fetch-site':'cross-site'}, {...headers,'sec-fetch-site':'same-site'}]) {
  const response=await request.post(endpoint,{headers:requestHeaders,data:{}});expect(response.status()).toBe(403);expect(Boolean(response.headers()['set-cookie'])).toBe(false);
 }
 expect((await pool.query('select count(*) from private.guest_intents')).rows[0].count).toBe('0');
 const preflight=await request.fetch(endpoint,{method:'OPTIONS',headers:{origin:'https://evil.example','access-control-request-method':'POST'}});
 expect(Boolean(preflight.headers()['access-control-allow-origin'])).toBe(false);
 expect((await request.get(endpoint)).status()).toBe(405);
});

test('intent endpoint rejects contact fields, non-objects, wrong media and oversized bodies',async({request})=>{
 for(const data of ['{"name":"Synthetic"}','[]','null','{', ' '.repeat(513)+'{}']) {
  const response=await request.post(endpoint,{headers,data});expect(response.status()).toBe(400);
 }
 expect((await request.post(endpoint,{headers:{...headers,'content-type':'text/plain'},data:'{}'})).status()).toBe(400);
 expect((await request.post(endpoint+'?unexpected=1',{headers,data:{}})).status()).toBe(400);
 expect((await pool.query('select count(*) from private.guest_intents')).rows[0].count).toBe('0');
});

test('twenty HTTP admissions share durable limits despite spoofed network headers',async({request})=>{
 const results=await Promise.all(Array.from({length:20},(_,i)=>request.post(endpoint,{headers:{...headers,'x-forwarded-for':`192.0.2.${i+1}`,'x-real-ip':`198.51.100.${i+1}`},data:{}})));
 expect(results.filter(r=>r.status()===201).length).toBe(5);expect(results.filter(r=>r.status()===429).length).toBe(15);
 for(const r of results.filter(r=>r.status()===429)) {
  expect(await r.json()).toEqual({error:'RATE_LIMITED'});expect(Number(r.headers()['retry-after'])).toBeGreaterThan(0);expect(Boolean(r.headers()['set-cookie'])).toBe(false);
 }
 expect((await pool.query('select count(*) from private.guest_intents')).rows[0].count).toBe('5');
 expect((await pool.query('select count(distinct network_key) from private.guest_rate_buckets')).rows[0].count).toBe('1');
});

test('disabled configuration fails closed without creating a capability',async({request})=>{
 await pool.query('update private.guest_security_config set enabled=false');
 const response=await request.post(endpoint,{headers,data:{}});expect(response.status()).toBe(503);expect(await response.json()).toEqual({error:'POLICY_NOT_READY'});
 expect(Boolean(response.headers()['set-cookie'])).toBe(false);expect((await pool.query('select count(*) from private.guest_rate_buckets')).rows[0].count).toBe('0');
});

async function newService(port,changes={}) {
 const url=`http://127.0.0.1:${port}`;
 const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{
  env:{...process.env,APP_ORIGIN:url,...changes},stdio:['ignore','pipe','pipe'],
 });
 let output='';child.stdout.on('data',x=>{output+=x;});child.stderr.on('data',x=>{output+=x;});
 const stop=async()=>{if(child.exitCode===null){const done=once(child,'exit');child.kill('SIGTERM');await done;}};
 try {
  for(let i=0;i<100;i++) {
   try {const response=await fetch(url,{signal:AbortSignal.timeout(500)});if(response.ok)return {url,stop,logs:()=>output};} catch {}
   await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw new Error('Secondary local service did not start');
 } catch(error) {await stop();throw error;}
}

test('HTTP quota persists across real service restarts and errors do not log secrets',async({request})=>{
 await pool.query('update private.guest_security_config set max_requests=1,max_active_intents=1');
 expect((await request.post(endpoint,{headers,data:{}})).status()).toBe(201);
 for(let i=0;i<2;i++) {
  const service=await newService(3147);
  try {
   const response=await fetch(service.url+endpoint,{method:'POST',headers:{origin:service.url,'content-type':'application/json'},body:'{}'});
   expect(response.status).toBe(429);expect(service.logs().includes(process.env.SUPABASE_GUEST_SERVICE_KEY)).toBe(false);
   expect(service.logs().includes(process.env.GUEST_RATE_HMAC_KEY)).toBe(false);
  } finally {await service.stop();}
 }
 const invalid=await newService(3147,{GUEST_NETWORK_MODE:'untrusted-forwarded-header'});
 try {
  const response=await fetch(invalid.url+endpoint,{method:'POST',headers:{origin:invalid.url,'content-type':'application/json'},body:'{}'});
  expect(response.status).toBe(503);
 } finally {await invalid.stop();}
});


test('crafted gateway fields cannot select an actor, function or credential',async({request})=>{
 const payloads=[
  '{"p_actor_id":"00000000-0000-4000-8000-000000000001"}',
  '{"function":"create_reservation","scope":"staff"}',
  '{"credential":"synthetic-forged-value","credential_hash":"synthetic"}',
  '{"__proto__":{"scope":"owner"}}',
  '{"constructor":{"prototype":{"scope":"owner"}}}',
 ];
 for(const data of payloads)expect((await request.post(endpoint,{headers,data})).status()).toBe(400);
 expect((await request.post(endpoint,{headers:{...headers,'content-encoding':'gzip'},data:'{}'})).status()).toBe(400);
 const chunked=new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode(' '.repeat(513)+'{}'));controller.close();}});
 const bounded=await fetch(origin+endpoint,{method:'POST',headers,body:chunked,duplex:'half'});
 expect(bounded.status).toBe(400);

 expect((await pool.query('select count(*) from private.guest_intents')).rows[0].count).toBe('0');
 expect((await pool.query('select count(*) from private.guest_rate_buckets')).rows[0].count).toBe('0');
});

test('a real browser on another origin cannot admit intents through JSON or simple POST',async({page})=>{
 const attacker=createServer((_request,response)=>{response.writeHead(200,{'content-type':'text/html'});response.end('<!doctype html><title>Synthetic alternate origin</title>');});
 const listening=once(attacker,'listening');attacker.listen(0,'127.0.0.1');await listening;
 try {
  await page.goto(`http://127.0.0.1:${attacker.address().port}`);
  const results=await page.evaluate(async(url)=>{
   let json;
   try {await fetch(url,{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:'{}'});json='allowed';}catch{json='blocked';}
   const simple=await fetch(url,{method:'POST',mode:'no-cors',credentials:'include',headers:{'content-type':'text/plain'},body:'{}'});
   return {json,simple:simple.type};
  },origin+endpoint);
  expect(results.json).toBe('blocked');expect(results.simple).toBe('opaque');
  expect((await pool.query('select count(*) from private.guest_intents')).rows[0].count).toBe('0');
 } finally {
  await page.goto('about:blank');attacker.closeAllConnections();await new Promise(resolve=>attacker.close(resolve));
 }
});
