import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('server-only',()=>({}));
vi.mock('@/lib/server/guest-intent',()=>({admitGuestIntent:vi.fn()}));
import { admitGuestIntent } from '../../lib/server/guest-intent';
import { POST } from '../../app/api/guest-intents/route';
const origin='http://127.0.0.1:3000';
function request(changes={}) {return new NextRequest(origin+'/api/guest-intents',{method:'POST',body:'{}',headers:{origin,'content-type':'application/json'},...changes});}
beforeEach(()=>{
 vi.stubEnv('GUEST_INTENTS_ENABLED','true');vi.stubEnv('GUEST_NETWORK_MODE','local-shared');vi.stubEnv('GUEST_RATE_HMAC_KEY','b'.repeat(64));
 vi.stubEnv('SUPABASE_GUEST_SERVICE_KEY','synthetic-unit-binding');vi.stubEnv('APP_ORIGIN',origin);vi.stubEnv('SUPABASE_URL','http://127.0.0.1:54321');
 vi.mocked(admitGuestIntent).mockReset();
});
afterEach(()=>{vi.unstubAllEnvs();vi.restoreAllMocks();});
describe('guest intent route boundary',()=>{
 it('returns only safe fields and sets a private cookie without logging bearer/hash',async()=>{
  const log=vi.spyOn(console,'log'); const error=vi.spyOn(console,'error');
  vi.mocked(admitGuestIntent).mockImplementation(async(_,cap)=>({outcome:'created',intentId:cap.id,createExpiresAt:new Date(Date.now()+300000).toISOString(),accessExpiresAt:new Date(Date.now()+900000).toISOString()}));
  const response=await POST(request());const data=await response.json();
  expect(response.status).toBe(201);expect(Object.keys(data).sort()).toEqual(['accessExpiresAt','createExpiresAt','intentId']);
  const cap=vi.mocked(admitGuestIntent).mock.calls[0][1];
  expect(JSON.stringify(data).includes(cap.credential)).toBe(false);expect(JSON.stringify(data).includes(cap.hash)).toBe(false);
  const cookie=response.headers.get('set-cookie');expect(cookie.includes('HttpOnly')).toBe(true);expect(cookie.includes('SameSite=lax')).toBe(true);expect(cookie.includes('Domain=')).toBe(false);
  expect(response.headers.get('cache-control')).toContain('no-store');expect(response.headers.get('referrer-policy')).toBe('no-referrer');
  expect(log).not.toHaveBeenCalled();expect(error).not.toHaveBeenCalled();
 });
 it('issues the HTTPS host cookie with Secure and no Domain',async()=>{
  vi.stubEnv('APP_ORIGIN','https://localhost:3000');
  vi.mocked(admitGuestIntent).mockImplementation(async(_,cap)=>({outcome:'created',intentId:cap.id,createExpiresAt:new Date(Date.now()+300000).toISOString(),accessExpiresAt:new Date(Date.now()+900000).toISOString()}));
  const response=await POST(new NextRequest('https://localhost:3000/api/guest-intents',{method:'POST',body:'{}',headers:{origin:'https://localhost:3000','content-type':'application/json'}}));
  expect(response.status).toBe(201);
  const cookie=response.headers.get('set-cookie');
  expect(cookie.startsWith('__Host-rg-intent-')).toBe(true);expect(cookie.includes('; Secure')).toBe(true);expect(cookie.includes('HttpOnly')).toBe(true);expect(cookie.includes('Domain=')).toBe(false);
 });
 it('does not call the privileged gateway on CSRF or invalid input',async()=>{
  expect((await POST(request({headers:{origin:'https://evil.example','content-type':'application/json'}}))).status).toBe(403);
  expect((await POST(request({body:'{"contact":"synthetic"}'}))).status).toBe(400);
  expect(vi.mocked(admitGuestIntent).mock.calls.length).toBe(0);
 });
 it('fails closed when disabled before any privileged operation',async()=>{
  vi.stubEnv('GUEST_INTENTS_ENABLED','false');expect((await POST(request())).status).toBe(503);expect(vi.mocked(admitGuestIntent).mock.calls.length).toBe(0);
 });
 it('maps durable denials to 429 without a cookie or credential response',async()=>{
  vi.mocked(admitGuestIntent).mockResolvedValue({outcome:'rate_limited',retryAfterSeconds:42});
  const response=await POST(request());expect(response.status).toBe(429);expect(response.headers.get('retry-after')).toBe('42');expect(response.headers.has('set-cookie')).toBe(false);
  expect(await response.json()).toEqual({error:'RATE_LIMITED'});
 });
 it('redacts privileged provider errors from responses and logs',async()=>{
  const log=vi.spyOn(console,'error');vi.mocked(admitGuestIntent).mockRejectedValue(new Error('SYNTHETIC_INTERNAL_DO_NOT_ECHO'));
  const response=await POST(request());expect(response.status).toBe(503);expect(await response.json()).toEqual({error:'TEMPORARILY_UNAVAILABLE'});expect(log).not.toHaveBeenCalled();
 });
});
