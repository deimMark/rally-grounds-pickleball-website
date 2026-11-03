import { describe, it, expect, vi } from 'vitest';
vi.mock('server-only',()=>({}));
import { newGuestCapability, hashGuestCredential, guestConfiguration, guestCookieName, guestCookieOptions, trustedGuestRequest, emptyGuestBody } from '../../lib/server/guest-security';
const env = { GUEST_INTENTS_ENABLED:'true', GUEST_NETWORK_MODE:'local-shared', GUEST_RATE_HMAC_KEY:'a'.repeat(64),
 SUPABASE_GUEST_SERVICE_KEY:'synthetic-unit-binding',APP_ORIGIN:'http://127.0.0.1:3000',SUPABASE_URL:'http://127.0.0.1:54321' };
describe('guest security primitives',()=>{
 it('uses 32 random bytes per capability, canonical encoding and independently random UUIDs',()=>{
  const values=Array.from({length:128},()=>newGuestCapability());
  expect(new Set(values.map(x=>x.id)).size).toBe(128);expect(new Set(values.map(x=>x.hash)).size).toBe(128);
  expect(values.every(x=>Buffer.from(x.credential,'base64url').length===32&&x.credential.length===43&&hashGuestCredential(x.credential)===x.hash)).toBe(true);
 });
 it.each(['', 'x'.repeat(42),'x'.repeat(44),'='.repeat(43),'a'.repeat(43),null])('rejects malformed or noncanonical credential %#',(value)=>{expect(hashGuestCredential(value)).toBe(null);});
 it('keeps HTTPS cookies host-only, HttpOnly, Secure and Lax with separate HTTP local names',()=>{
  const x=newGuestCapability();const options=guestCookieOptions(true,new Date(Date.now()+60000).toISOString());
  expect(guestCookieName(x.id,true).startsWith('__Host-')).toBe(true);
  expect(guestCookieName(x.id,false).startsWith('rg-intent-')).toBe(true);
  expect(options).toMatchObject({httpOnly:true,secure:true,sameSite:'lax',path:'/'});expect(options.domain).toBeUndefined();
  expect(options.maxAge).toBeGreaterThan(0);expect(options.maxAge).toBeLessThanOrEqual(60);
  expect(guestCookieOptions(false,new Date(Date.now()+60000).toISOString()).secure).toBe(false);
 });
 it.each(['not-id','../x','00000000-0000-0000-0000-000000000000'])('rejects unsafe intent identifiers %#',(id)=>expect(()=>guestCookieName(id,true)).toThrow());
 it('ignores client network headers and yields one deterministic local network bucket',()=>{
  const config=guestConfiguration(env);expect(config.networkKey.length).toBe(64);
  expect(guestConfiguration(env).networkKey===config.networkKey).toBe(true);
 });
 it.each([
  {GUEST_INTENTS_ENABLED:'false'}, {GUEST_NETWORK_MODE:'forwarded'}, {GUEST_RATE_HMAC_KEY:''},
  {GUEST_RATE_HMAC_KEY:'proxy-placeholder'}, {SUPABASE_GUEST_SERVICE_KEY:''},
  {APP_ORIGIN:'https://rally.example'}, {APP_ORIGIN:'http://127.0.0.1:3000/'},
  {SUPABASE_URL:'https://production.supabase.co'}, {SUPABASE_URL:'http://u:p@127.0.0.1:54321'},
 ])('fails closed for unavailable, untrusted or public configuration %#',(changes)=>expect(()=>guestConfiguration({...env,...changes})).toThrow());
 it('supports HTTPS loopback configuration without weakening cookie security',()=>expect(guestConfiguration({...env,APP_ORIGIN:'https://localhost:3000'}).secure).toBe(true));
 it.each([null,'null','https://evil.example','http://localhost:3000'])('rejects wrong/missing Origin %#',(origin)=>{
  const headers=origin?{origin}:{};expect(trustedGuestRequest(new Request(env.APP_ORIGIN+'/api/guest-intents',{headers}),guestConfiguration(env))).toBe(false);
 });
 it('rejects cross-site fetch metadata even with a forged Origin',()=>expect(trustedGuestRequest(new Request(env.APP_ORIGIN,{headers:{origin:env.APP_ORIGIN,'sec-fetch-site':'cross-site'}}),guestConfiguration(env))).toBe(false));
 it.each(['[]','null','{"name":"Synthetic"}','{','""','1', ' '.repeat(513)+'{}'])('rejects unknown fields/malformed/oversized bodies %#',async(body)=>{
  expect(await emptyGuestBody(new Request(env.APP_ORIGIN,{method:'POST',headers:{'content-type':'application/json'},body}))).toBe(false);
 });
 it('accepts an empty JSON object only',async()=>expect(await emptyGuestBody(new Request(env.APP_ORIGIN,{method:'POST',headers:{'content-type':'application/json'},body:'{}'}))).toBe(true));
});

describe('Next internal URL handling',()=>{
 it('accepts the known local server bind while requiring the exact browser Origin',()=>{
  const config=guestConfiguration(env);
  expect(trustedGuestRequest(new Request('http://0.0.0.0:3000/api/guest-intents',{headers:{origin:env.APP_ORIGIN}}),config)).toBe(true);
  expect(trustedGuestRequest(new Request('http://0.0.0.0:3000/api/guest-intents',{headers:{origin:'http://localhost:3000'}}),config)).toBe(false);
 });
 it.each(['http://0.0.0.0:3001','http://evil.example:3000'])('rejects mismatched port/nonlocal internal URL %#',(url)=>{
  expect(trustedGuestRequest(new Request(url,{headers:{origin:env.APP_ORIGIN}}),guestConfiguration(env))).toBe(false);
 });
});

it('rejects encoded bodies and oversized declared lengths before parsing',async()=>{
 for(const extra of [{'content-encoding':'gzip'},{'content-length':'513'},{'content-length':'invalid'}]) {
  const request=new Request(env.APP_ORIGIN,{method:'POST',headers:{'content-type':'application/json',...extra},body:'{}'});
  expect(await emptyGuestBody(request)).toBe(false);
 }
});
