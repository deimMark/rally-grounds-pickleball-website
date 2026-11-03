import 'server-only';
import { randomBytes, randomUUID, createHash, createHmac } from 'node:crypto';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export function guestConfiguration(env = process.env) {
  // This milestone is deliberately unavailable for any public host/database.
  if (env.GUEST_INTENTS_ENABLED !== 'true' || env.GUEST_NETWORK_MODE !== 'local-shared') throw new Error('Guest configuration unavailable');
  const origin = new URL(env.APP_ORIGIN);
  const database = new URL(env.SUPABASE_URL);
  const loopback = (host) => ['localhost', '127.0.0.1', '[::1]'].includes(host);
  if (!loopback(origin.hostname) || !loopback(database.hostname) || origin.origin !== env.APP_ORIGIN
    || origin.username || origin.password || database.username || database.password
    || !['https:', 'http:'].includes(origin.protocol) || !['https:', 'http:'].includes(database.protocol)
    || database.pathname !== '/' || database.search || database.hash
    || !/^[0-9a-f]{64}$/.test(env.GUEST_RATE_HMAC_KEY || '') || !env.SUPABASE_GUEST_SERVICE_KEY) throw new Error('Guest configuration unavailable');
  const key = Buffer.from(env.GUEST_RATE_HMAC_KEY, 'hex');
  return { origin: origin.origin, secure: origin.protocol === 'https:', databaseUrl: database.origin,
    serviceKey: env.SUPABASE_GUEST_SERVICE_KEY, fingerprint: createHash('sha256').update(key).digest('hex'),
    networkKey: createHmac('sha256', key).update('rally.guest.local-shared.v1').digest('hex') };
}
export function newGuestCapability() {
  const bytes = randomBytes(32);
  return { id: randomUUID(), credential: bytes.toString('base64url'), hash: createHash('sha256').update(bytes).digest('hex') };
}
export function hashGuestCredential(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(value)) return null;
  const bytes = Buffer.from(value, 'base64url');
  if (bytes.length !== 32 || bytes.toString('base64url') !== value) return null;
  return createHash('sha256').update(bytes).digest('hex');
}
export function guestCookieName(id, secure) {
  if (!uuid.test(id)) throw new Error('Invalid intent identifier');
  return `${secure ? '__Host-rg-intent-' : 'rg-intent-'}${id}`;
}
export function guestCookieOptions(secure, accessExpiresAt) {
  return { httpOnly: true, secure, sameSite: 'lax', path: '/', expires: new Date(accessExpiresAt),
    maxAge: Math.max(0, Math.floor((Date.parse(accessExpiresAt) - Date.now()) / 1000)) };
}
export function trustedGuestRequest(request, config) {
  // No Host or forwarded-header trust. JSON + exact Origin + Fetch Metadata prevent browser CSRF.
  const canonical = (value) => {
    const url = new URL(value);
    // NextURL normalizes loopback literals; next start may use its wildcard bind address.
    // Only the internal URL is normalized. Browser Origin remains an exact match.
    if (['127.0.0.1', '[::1]', '0.0.0.0', '[::]'].includes(url.hostname)) url.hostname = 'localhost';
    return url.origin;
  };
  return request.headers.get('origin') === config.origin && canonical(request.url) === canonical(config.origin)
    && (!request.headers.has('sec-fetch-site') || request.headers.get('sec-fetch-site') === 'same-origin');
}
export async function emptyGuestBody(request) {
  if (new URL(request.url).search || !/^application\/json(?:;\s*charset=utf-8)?$/i.test(request.headers.get('content-type') || '')
    || !['', 'identity'].includes(request.headers.get('content-encoding') || '')) return false;
  const length = request.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > 512)) return false;
  const reader = request.body?.getReader();
  if (!reader) return false;
  let size = 0; const chunks = [];
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length;
      if (size > 512) { await reader.cancel(); return false; }
      chunks.push(value);
    }
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0;
  } catch { return false; }
}
export function intentCookieCount(cookies) {
  return cookies.filter(({ name }) => /^(?:__Host-)?rg-intent-/.test(name)).length;
}
