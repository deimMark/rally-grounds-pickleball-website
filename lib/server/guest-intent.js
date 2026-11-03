import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { guestConfiguration, guestCookieName, hashGuestCredential } from './guest-security';

function guestClient(config) {
  // Privileged and RLS-bypassing: callers below can invoke only the two explicit RPCs.
  return createClient(config.databaseUrl, config.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
export async function admitGuestIntent(config, capability, cookieCount) {
  const { data, error } = await guestClient(config).rpc('guest_intent_admit', {
    p_id: capability.id, p_hash: capability.hash, p_network_key: config.networkKey,
    p_key_fingerprint: config.fingerprint, p_cookie_count: cookieCount,
  });
  if (error || !data) throw new Error('Guest admission unavailable');
  return data;
}
export async function authorizeGuestIntent(request, intentId, scope) {
  try {
    if (!['create', 'access'].includes(scope)) return false;
    const config = guestConfiguration();
    const hash = hashGuestCredential(request.cookies.get(guestCookieName(intentId, config.secure))?.value);
    if (!hash) return false;
    const { data, error } = await guestClient(config).rpc('guest_intent_authorize', { p_id: intentId, p_hash: hash, p_scope: scope });
    return !error && data === true;
  } catch { return false; }
}
