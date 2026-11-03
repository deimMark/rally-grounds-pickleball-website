import 'server-only';
import { createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { guestConfiguration, guestCookieName, hashGuestCredential } from './guest-security';
import { guestUuid } from '@/lib/domain/guest-reservation';
export function guestBookingConfiguration(env = process.env) {
  if (env.GUEST_RESERVATIONS_ENABLED !== 'true') throw new Error('POLICY_NOT_READY');
  try { return guestConfiguration(env); } catch { throw new Error('POLICY_NOT_READY'); } // Loopback only.
}
function client(config) {
  return createClient(config.databaseUrl, config.serviceKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
export function guestCapability(request, config, intentId) {
  if (!guestUuid.test(intentId || '') || (request.headers.get('cookie') || '').length > 8192) return null;
  const credential = request.cookies.get(guestCookieName(intentId, config.secure))?.value;
  const hash = hashGuestCredential(credential);
  return hash ? { hash, credential } : null;
}
function common(config) { return { p_network_key: config.networkKey, p_key_fingerprint: config.fingerprint }; }
function fail(error) {
  const allowed = ['POLICY_NOT_READY', 'GUEST_ACCESS_REQUIRED', 'REQUEST_MISMATCH', 'INTENT_ALREADY_BOUND', 'INTENT_EXPIRED', 'QUOTE_REVIEW_REQUIRED', 'RATE_LIMITED', 'SLOT_UNAVAILABLE', 'DURATION_UNSUPPORTED', 'INVALID_REQUEST'];
  const code = error?.code === '23P01' ? 'SLOT_UNAVAILABLE'
    : allowed.includes(error?.message) ? error.message
      : ['23514', '22023', '23503', '22P02'].includes(error?.code) ? 'INVALID_REQUEST' : 'TEMPORARILY_UNAVAILABLE';
  const failure = new Error(code);
  if (code === 'RATE_LIMITED' && /^\d{1,5}$/.test(error?.details || '')) failure.retryAfter = Number(error.details);
  throw failure; // Never serialize or log provider objects, PII or request inputs.
}
function outcome(data, error) {
  if (error) fail(error);
  if (!data) throw new Error('TEMPORARILY_UNAVAILABLE');
  const codes = { guest_access_required: 'GUEST_ACCESS_REQUIRED', rate_limited: 'RATE_LIMITED', intent_already_bound: 'INTENT_ALREADY_BOUND', intent_expired: 'INTENT_EXPIRED', request_mismatch: 'REQUEST_MISMATCH', access_unavailable: 'ACCESS_UNAVAILABLE' };
  if (codes[data.outcome]) {
    const failure = new Error(codes[data.outcome]);
    if (data.outcome === 'rate_limited') failure.retryAfter = data.retryAfterSeconds;
    throw failure;
  }
  return data;
}
export async function guestAvailability(config, day, duration) {
  const { data, error } = await client(config).rpc('guest_availability', { ...common(config), p_day: day, p_duration: duration });
  const result = outcome(data, error);
  return { day: result.day, durationMinutes: result.durationMinutes, timezone: result.timezone, courts: result.courts, slots: result.slots.map(slot => ({ ...slot, startsAt: new Date(slot.startsAt).toISOString(), endsAt: new Date(slot.endsAt).toISOString() })) };
}
export async function guestQuote(config, cap, input) {
  const { data, error } = await client(config).rpc('guest_quote', { ...common(config), p_id: input.intentId, p_hash: cap.hash,
    p_court: input.courtId, p_start: input.startsAt, p_duration: input.durationMinutes });
  return outcome(data, error).quote;
}
export async function guestReserve(config, cap, input, key) {
  // The canonical, normalized projection has stable field order and excludes all client authority.
  // Keyed by the per-intent secret; a stored fingerprint cannot be used as a contact dictionary.
  const fingerprint = createHmac('sha256', Buffer.from(cap.credential, 'base64url')).update(JSON.stringify(input)).digest('hex');
  const parameters = { ...common(config), p_id: input.intentId, p_hash: cap.hash, p_request_key: key, p_fingerprint: fingerprint };
  const gateway = client(config);
  const admitted = await gateway.rpc('guest_request_admit', parameters); // Transaction A commits here.
  outcome(admitted.data, admitted.error);
  const { data, error } = await gateway.rpc('guest_reservation_create', { ...parameters, p_quote_id: input.quoteId,
    p_name: input.guest.name, p_contact: input.guest.contact.value, p_players: input.estimatedPlayers }); // Transaction B.
  return outcome(data, error);
}
export async function guestStatus(config, cap, intentId, reference) {
  const { data, error } = await client(config).rpc('guest_reservation_status', { ...common(config), p_id: intentId, p_hash: cap.hash, p_reference: reference });
  const result = outcome(data, error);
  return { receipt: result.receipt, current: result.current, agreedTerms: result.agreedTerms };
}
