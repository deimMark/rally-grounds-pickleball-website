import { it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { guestBookingConfiguration } from '@/lib/server/guest-reservations';
import { readGuestJson } from '@/lib/server/guest-http';
const env = { GUEST_INTENTS_ENABLED: 'true', GUEST_RESERVATIONS_ENABLED: 'true', GUEST_NETWORK_MODE: 'local-shared', GUEST_RATE_HMAC_KEY: 'a'.repeat(64),
  SUPABASE_GUEST_SERVICE_KEY: 'synthetic-unit-binding', APP_ORIGIN: 'http://127.0.0.1:3000', SUPABASE_URL: 'http://127.0.0.1:54321' };
it.each([{ GUEST_RESERVATIONS_ENABLED: '' }, { APP_ORIGIN: 'https://rally.example' }, { SUPABASE_URL: 'https://production.supabase.co' }])('booking gateway fails closed before contacting remote infrastructure %#', (change) => {
  expect(() => guestBookingConfiguration({ ...env, ...change })).toThrow('POLICY_NOT_READY');
});
it('streamed bodies cannot bypass the byte cap by omitting Content-Length', async () => {
  const body = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(' '.repeat(2049) + '{}')); c.close(); } });
  const request = new Request(env.APP_ORIGIN, { method: 'POST', headers: { 'content-type': 'application/json' }, body, duplex: 'half' });
  await expect(readGuestJson(request)).rejects.toThrow('INVALID_REQUEST');
});
it('rejects malformed UTF-8 without decoding to replacement characters', async () => {
  const request = new Request(env.APP_ORIGIN, { method: 'POST', headers: { 'content-type': 'application/json' }, body: new Uint8Array([0xff]) });
  await expect(readGuestJson(request)).rejects.toThrow('INVALID_REQUEST');
});
