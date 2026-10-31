import { describe, expect, it } from 'vitest';
import { normalizeAvailability, validateClubDay } from '../../lib/domain/availability';
import { isTrustedOrigin } from '../../lib/domain/auth-origin';
describe('availability service boundary', () => {
  it('accepts a real explicit club day including leap day', () => {
    expect(validateClubDay('2028-02-29')).toBe('2028-02-29');
  });
  it.each(['2026-02-29', '2026-13-01', '2026-11-31', '2026-1-1', 'today', '', null, '1999-12-31', '2101-01-01'])('rejects invalid/unbounded date %s', (value) => {
    expect(() => validateClubDay(value)).toThrow('Invalid club day');
  });
  it('projects safe fields and normalizes instants to UTC', () => {
    expect(normalizeAvailability([{ court_id: 'test-court', court_number: 1, starts_at: '2030-01-01T08:00:00+08:00', ends_at: '2030-01-01T09:00:00+08:00', status: 'available', timezone: 'Asia/Manila', customer: 'must not escape', booking_id: 'private' }])).toEqual([{ courtId: 'test-court', courtNumber: 1, startsAt: '2030-01-01T00:00:00.000Z', endsAt: '2030-01-01T01:00:00.000Z', status: 'available', timezone: 'Asia/Manila' }]);
  });
});
describe('cookie mutation origin checks', () => {
  it('allows only the exact configured trusted origin', () => {
    expect(isTrustedOrigin('https://club.example', 'https://club.example')).toBe(true);
    expect(isTrustedOrigin('http://127.0.0.1:3100', 'http://127.0.0.1:3100')).toBe(true);
  });
  it.each([null, '', 'null', 'https://club.example.evil.test', 'http://club.example', 'https://club.example/'])('rejects mismatched/absent origin %s', (origin) => {
    expect(isTrustedOrigin(origin, 'https://club.example')).toBe(false);
  });
  it('fails closed when server origin is absent or malformed', () => {
    expect(isTrustedOrigin('https://club.example', undefined)).toBe(false);
    expect(isTrustedOrigin('https://club.example', 'malformed')).toBe(false);
  });
});
