import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('server-only',()=>({}));
const rpc=vi.hoisted(()=>vi.fn());
vi.mock('@supabase/supabase-js',()=>({createClient:vi.fn(()=>({rpc}))}));
import { authorizeGuestIntent } from '../../lib/server/guest-intent';
import { newGuestCapability } from '../../lib/server/guest-security';
beforeEach(()=>{
 for(const [key,value] of Object.entries({GUEST_INTENTS_ENABLED:'true',GUEST_NETWORK_MODE:'local-shared',GUEST_RATE_HMAC_KEY:'c'.repeat(64),SUPABASE_GUEST_SERVICE_KEY:'synthetic-unit-binding',APP_ORIGIN:'http://127.0.0.1:3000',SUPABASE_URL:'http://127.0.0.1:54321'}))vi.stubEnv(key,value);
 rpc.mockReset();rpc.mockResolvedValue({data:true,error:null});
});
afterEach(()=>vi.unstubAllEnvs());
function request(cap) {return new NextRequest('http://127.0.0.1:3000',{headers:{cookie:`rg-intent-${cap.id}=${cap.credential}`}});}
it('authorizes only the matching per-intent cookie and forwards its hash, never bearer',async()=>{
 const cap=newGuestCapability();expect(await authorizeGuestIntent(request(cap),cap.id,'access')).toBe(true);
 expect(rpc.mock.calls[0][0]).toBe('guest_intent_authorize');expect(rpc.mock.calls[0][1]).toEqual({p_id:cap.id,p_hash:cap.hash,p_scope:'access'});
 expect(JSON.stringify(rpc.mock.calls).includes(cap.credential)).toBe(false);
});
it('rejects other intent IDs, wrong scopes and malformed cookies before the privileged call',async()=>{
 const cap=newGuestCapability();expect(await authorizeGuestIntent(request(cap),newGuestCapability().id,'access')).toBe(false);
 expect(await authorizeGuestIntent(request(cap),cap.id,'staff')).toBe(false);
 expect(await authorizeGuestIntent(request({...cap,credential:'invalid'}),cap.id,'create')).toBe(false);
 expect(rpc.mock.calls.length).toBe(0);
});
it('fails closed on provider denial or failure',async()=>{
 const cap=newGuestCapability();rpc.mockResolvedValue({data:null,error:{code:'42501'}});
 expect(await authorizeGuestIntent(request(cap),cap.id,'access')).toBe(false);
 rpc.mockRejectedValue(new Error('Synthetic internal failure'));expect(await authorizeGuestIntent(request(cap),cap.id,'access')).toBe(false);
});
it('rejects missing local configuration without a privileged request',async()=>{
 vi.stubEnv('GUEST_INTENTS_ENABLED','false');const cap=newGuestCapability();expect(await authorizeGuestIntent(request(cap),cap.id,'access')).toBe(false);expect(rpc.mock.calls.length).toBe(0);
});
