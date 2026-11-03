import { describe, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { trustedGuestRead, trustedGuestRequest, guestCookieName } from '@/lib/server/guest-security';
import { isGuestUuid, normalizeGuestQuote, normalizeGuestReservation } from '@/lib/domain/guest-reservation';
import { guestCapability, guestReserve } from '@/lib/server/guest-reservations';
const origin = 'http://127.0.0.1:3000';
const config = { origin };
const id = '00000000-0000-4000-8000-000000000001';
const url = origin + '/api/guest-reservations/' + id;
const browser = { 'sec-fetch-site': 'same-origin', 'sec-fetch-mode': 'cors', 'sec-fetch-dest': 'empty' };
const request = (headers = {}, target = url) => new Request(target, { headers });
describe('R1: private GET trust is distinct from mutation trust', () => {
  it('accepts a normal browser fetch without Origin, while POST trust still rejects it', () => {
    expect(trustedGuestRead(request(browser), config)).toBe(true);
    expect(trustedGuestRequest(request(browser), config)).toBe(false);
  });
  it('retains explicit matching Origin for API clients without metadata', () => {
    expect(trustedGuestRead(request({ origin }), config)).toBe(true);
    expect(trustedGuestRead(request({ ...browser, origin }), config)).toBe(true);
    expect(trustedGuestRequest(request({ origin }), config)).toBe(true);
  });
  it.each([
    {}, { origin: 'null' }, { origin: '' }, { ...browser, origin: 'https://evil.example' },
    { ...browser, 'sec-fetch-site': 'cross-site' }, { origin, 'sec-fetch-site': 'same-site' },
    { origin, 'sec-fetch-site': 'none' }, { origin, 'sec-fetch-site': '' },
    { ...browser, 'sec-fetch-mode': 'no-cors' }, { ...browser, 'sec-fetch-mode': 'navigate' },
    { ...browser, 'sec-fetch-dest': 'iframe' }, { ...browser, 'sec-fetch-dest': 'document' },
  ])('rejects missing, foreign or contradictory trust evidence %#', (headers) => {
    expect(trustedGuestRead(request(headers), config)).toBe(false);
  });
  it.each(['http://evil.example:3000', 'http://127.0.0.1:3001', 'https://127.0.0.1:3000'])('rejects the wrong target even with spoofed forwarding headers %#', (target) => {
    expect(trustedGuestRead(request({ ...browser, origin, 'x-forwarded-host': '127.0.0.1:3000', 'x-forwarded-proto': 'http' }, target), config)).toBe(false);
  });
  it('retains known Next internal loopback target normalization and rejects malformed configuration', () => {
    expect(trustedGuestRead(request(browser, 'http://0.0.0.0:3000/api/guest-reservations/' + id), config)).toBe(true);
    expect(trustedGuestRead(request(browser), { origin: 'malformed' })).toBe(false);
  });
  it('does not allow a POST through the read policy', () => {
    expect(trustedGuestRead(new Request(url, { method: 'POST', headers: browser }), config)).toBe(false);
  });
});
const badTypes = [null, undefined, {}, [id], [id, id], 123, true, new String(id), { toString: () => id }];
describe('R2: UUIDs never rely on coercion', () => {
  it('accepts valid strings and rejects array, boxed, object and primitive substitutes without invoking conversion', () => {
    expect(isGuestUuid(id)).toBe(true);
    for (const value of [...badTypes, '', 'invalid', id + ',extra']) expect(isGuestUuid(value)).toBe(false);
    expect(isGuestUuid({ toString() { throw new Error('Must not coerce'); } })).toBe(false);
  });
  it.each(['intentId', 'courtId'])('rejects every nonstring quote %s before normalization', (field) => {
    const value = { intentId: id, courtId: id, startsAt: '2026-12-01T00:00:00Z', durationMinutes: 60 };
    for (const invalid of badTypes) expect(normalizeGuestQuote({ ...value, [field]: invalid })).toBeNull();
    expect(normalizeGuestQuote(value)).not.toBeNull();
  });
  it.each(['intentId', 'quoteId'])('rejects every nonstring reservation %s before fingerprinting', (field) => {
    const value = { intentId: id, quoteId: id, guest: { name: 'Synthetic', contact: { kind: 'email', value: 'synthetic@example.invalid' } }, estimatedPlayers: 4 };
    for (const invalid of badTypes) expect(normalizeGuestReservation({ ...value, [field]: invalid })).toBeNull();
    expect(normalizeGuestReservation(value)).toEqual(value);
  });
  it('rejects nonstring cookie selectors without cookie lookup or capability transport', () => {
    for (const invalid of badTypes) {
      expect(() => guestCookieName(invalid, false)).toThrow('Invalid intent identifier');
      expect(guestCapability({}, {}, invalid)).toBeNull();
    }
  });
  it('rejects nonstring and malformed request keys before constructing a privileged client', async () => {
    for (const invalid of [...badTypes, 'invalid']) await expect(guestReserve({}, null, {}, invalid)).rejects.toThrow('INVALID_REQUEST');
  });
});
