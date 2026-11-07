import { describe, it, expect } from 'vitest';
import { validateReclubUrl, reclubLinkState, reclubConfig } from '../../lib/demo/reclub';
import { staffOpenPlay, applySimulation, initialSimulation, clubInstant } from '../../lib/demo/staff';
import { scheduleItems, findConflicts } from '../../lib/demo/staff-schedule';

// Test-only fixture on the allowlisted host with an obviously fake path. Never shipped in app data.
const TEST_MEET = 'https://reclub.co/SAMPLE-TEST-ONLY-not-a-real-meet';

describe('Reclub Meet link validation', () => {
 it('treats an empty or missing link as pending, never as a link', () => {
  for (const value of [null, undefined, '', '   ']) expect(validateReclubUrl(value)).toEqual({ ok: true, state: 'pending', url: null });
 });
 it('accepts only https links on the allowlisted host with an event-specific path', () => {
  expect(reclubConfig.allowedHosts).toEqual(['reclub.co']);
  expect(validateReclubUrl(TEST_MEET)).toEqual({ ok: true, state: 'ready', url: TEST_MEET, display: 'reclub.co/SAMPLE-TEST-ONLY-not-a-real-meet' });
  expect(validateReclubUrl(`  ${TEST_MEET}  `).url).toBe(TEST_MEET);
  expect(validateReclubUrl('https://RECLUB.CO/SAMPLE-TEST-ONLY').url).toBe('https://reclub.co/SAMPLE-TEST-ONLY');
  expect(validateReclubUrl(`${TEST_MEET}#rsvp`).url).toBe(TEST_MEET); // fragment dropped
 });
 it.each([
  ['http://reclub.co/SAMPLE', 'not_https'],
  ['javascript:alert(1)', 'not_https'],
  ['data:text/html,<b>x</b>', 'invalid_characters'],
  ['vbscript:msgbox', 'not_https'],
  ['reclub://meet/123', 'not_https'],
  ['ftp://reclub.co/SAMPLE', 'not_https'],
  ['//reclub.co/SAMPLE', 'not_a_url'],
  ['reclub.co/SAMPLE', 'not_a_url'],
  ['https:reclub.co/SAMPLE', 'not_a_url'],
  ['https:\\\\reclub.co\\SAMPLE', 'invalid_characters'],
  ['https://reclub.co/SAM PLE', 'invalid_characters'],
  ['https://reclub.co/SAMPLE\u0000', 'invalid_characters'],
  ['https://reclub.co.evil.example/SAMPLE', 'host_not_allowed'],
  ['https://evil-reclub.co/SAMPLE', 'host_not_allowed'],
  ['https://reclub.com/SAMPLE', 'host_not_allowed'],
  ['https://reclub.co./SAMPLE', 'host_not_allowed'],
  ['https://help.reclub.co/SAMPLE', 'host_not_allowed'],
  ['https://xn--rclub-bsa.co/SAMPLE', 'host_not_allowed'],
  ['https://réclub.co/SAMPLE', 'host_not_allowed'],
  ['https://reclub.co@evil.example/SAMPLE', 'credentials'],
  ['https://user:pass@reclub.co/SAMPLE', 'credentials'],
  ['https://reclub.co:8443/SAMPLE', 'port'],
  ['https://reclub.co', 'not_event_specific'],
  ['https://reclub.co/', 'not_event_specific'],
  ['https://reclub.co/ja', 'not_event_specific'],
  ['https://reclub.co/clubs/@sample-club', 'not_event_specific'],
  ['https://reclub.co/ja/clubs/@sample-club', 'not_event_specific'],
  ['https://reclub.co/sports/pickleball', 'not_event_specific'],
  [`https://reclub.co/${'a'.repeat(2100)}`, 'too_long'],
  [42, 'not_text'],
 ])('rejects %s (%s)', (input, code) => {
  const result = validateReclubUrl(input);
  expect(result).toMatchObject({ ok: false, state: 'invalid', url: null });
  if (code === 'credentials' && String(input).includes('@evil')) expect(['credentials', 'host_not_allowed']).toContain(result.code);
  else expect(result.code).toBe(code);
  expect(result.message.length).toBeGreaterThan(10);
 });
 it('never renders invalid stored data as a link', () => {
  expect(reclubLinkState({ reclubUrl: 'javascript:alert(1)' })).toEqual({ state: 'invalid', url: null });
  expect(reclubLinkState({ reclubUrl: null })).toEqual({ state: 'pending', url: null });
  expect(reclubLinkState({ reclubUrl: TEST_MEET })).toMatchObject({ state: 'ready', url: TEST_MEET });
 });
});

describe('open play fixtures and occupancy with Reclub links', () => {
 it('ships no invented live Reclub URLs: every fixture is "link pending"', () => {
  for (const event of staffOpenPlay) expect(event).toMatchObject({ eventType: 'open-play', reclubUrl: null });
 });
 it('keeps one event association across all courts and hours of an event', () => {
  const items = scheduleItems(applySimulation(initialSimulation)).filter((item) => item.sourceId === 'OP-3');
  expect(items.map((item) => item.courtId)).toEqual(['court-4', 'court-5']);
  expect(new Set(items.map((item) => item.event))).toEqual(new Set([staffOpenPlay[2]]));
  expect(items.every((item) => item.startHour === 17 && item.endHour === 19)).toBe(true); // one 2-hour block, not per-hour links
 });
 it('a Reclub link never changes court availability or booking conflicts', () => {
  const withLink = applySimulation({ ...initialSimulation, openPlayEdited: { 'OP-1': { reclubUrl: TEST_MEET } } });
  const probe = { courtIds: ['court-5'], startsAt: clubInstant('2026-11-07', 9), endsAt: clubInstant('2026-11-07', 10) };
  const before = findConflicts(probe, scheduleItems(applySimulation(initialSimulation)));
  const after = findConflicts(probe, scheduleItems(withLink));
  expect(before.map((item) => item.id)).toEqual(['OP-1:court-5']);
  expect(after.map((item) => item.id)).toEqual(['OP-1:court-5']);
  expect(withLink.bookings).toEqual(applySimulation(initialSimulation).bookings);
  // Half-open: a private session may start exactly when open play ends.
  expect(findConflicts({ courtIds: ['court-5'], startsAt: clubInstant('2026-11-07', 12), endsAt: clubInstant('2026-11-07', 13) }, scheduleItems(withLink))).toEqual([]);
 });
});
