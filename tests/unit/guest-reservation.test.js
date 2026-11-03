import { describe, it, expect } from 'vitest';
import { normalizeGuestReservation, normalizeGuestQuote } from '@/lib/domain/guest-reservation';
const intentId = '00000000-0000-4000-8000-000000000011', quoteId = '00000000-0000-4000-8000-000000000012';
const input = () => ({ intentId, quoteId, guest: { name: ' Synthetic   Guest ', contact: { kind: 'email', value: 'guest@EXAMPLE.INVALID ' } }, estimatedPlayers: 4 });
describe('synthetic local guest input', () => {
  it('normalizes accepted input deterministically without changing local email identity', () => {
    const expected = { intentId, quoteId, guest: { name: 'Synthetic Guest', contact: { kind: 'email', value: 'guest@example.invalid' } }, estimatedPlayers: 4 };
    expect(normalizeGuestReservation(input())).toEqual(expected); expect(normalizeGuestReservation(expected)).toEqual(expected);
  });
  it.each(['price', 'expiresAt', 'paid', 'source', 'employeeId', '__proto__'])('rejects injected authority %s', (key) => {
    expect(normalizeGuestReservation({ ...input(), [key]: 'untrusted' })).toBeNull();
  });
  it('rejects extra or non-synthetic contact fields and channels', () => {
    for (const contact of [{ kind: 'email', value: 'guest@gmail.com' }, { kind: 'phone', value: '+639177773933' }, { kind: 'email', value: 'guest@example.invalid', verified: true }]) {
      const value = input(); value.guest.contact = contact; expect(normalizeGuestReservation(value)).toBeNull();
    }
  });
  it('bounds Unicode names and rejects control characters', () => {
    for (const name of ['', ' ', 'x'.repeat(121), 'Guest\nInjected']) { const value = input(); value.guest.name = name; expect(normalizeGuestReservation(value)).toBeNull(); }
  });
  it('rejects invalid scope identifiers and player counts', () => {
    for (const patch of [{ intentId: '123' }, { quoteId: null }, { estimatedPlayers: 0 }, { estimatedPlayers: 1.2 }, { estimatedPlayers: '4' }]) expect(normalizeGuestReservation({ ...input(), ...patch })).toBeNull();
  });
  it('accepts canonical quote intervals only, rejecting calendar normalization', () => {
    const q = { intentId, courtId: quoteId, startsAt: '2026-12-01T00:00:00Z', durationMinutes: 60 };
    expect(normalizeGuestQuote(q)?.startsAt).toBe('2026-12-01T00:00:00.000Z');
    for (const patch of [{ startsAt: '2026-02-30T00:00:00Z' }, { startsAt: '2026-12-01T08:00:00+08:00' }, { durationMinutes: 0 }, { price: 1 }]) expect(normalizeGuestQuote({ ...q, ...patch })).toBeNull();
  });
});
