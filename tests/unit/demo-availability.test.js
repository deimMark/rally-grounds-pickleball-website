import { describe, expect, it } from 'vitest';
import { demoAvailability, demoCourts, demoDays } from '../../lib/demo/club';
import { getCourtStatus, getDemoSlots, formatMoney } from '../../lib/domain/demo-availability';

describe('demo court data and display', () => {
  it('preserves court identities in the approved updated spatial layout', () => {
    expect(demoCourts.map(({ number, row, column }) => [number, row, column])).toEqual([
      [3, 1, 1], [4, 1, 2], [5, 1, 3], [2, 2, 3], [1, 3, 3],
    ]);
  });
  it('has explicit fixtures for every court on every demo day', () => {
    for (const day of demoDays) for (const court of demoCourts) {
      const slots = getDemoSlots(demoAvailability, day.id, court.id);
      expect(slots).toHaveLength(4);
      expect(new Set(slots.map((slot) => slot.id)).size).toBe(slots.length);
      expect(slots.every((slot) => ['available', 'reserved', 'open-play'].includes(slot.status))).toBe(true);
    }
  });
  it('does not invent availability for an unknown court or day', () => {
    expect(getDemoSlots(demoAvailability, 'unknown-day', 'court-3')).toEqual([]);
    expect(getDemoSlots(demoAvailability, demoDays[0].id, 'unknown-court')).toEqual([]);
    expect(getCourtStatus([])).toBe('reserved');
  });
  it('distinguishes open play and reserved from courts with sample sessions', () => {
    expect(getCourtStatus(getDemoSlots(demoAvailability, '2026-11-07', 'court-5'))).toBe('open-play');
    expect(getCourtStatus(getDemoSlots(demoAvailability, '2026-11-08', 'court-2'))).toBe('reserved');
    expect(getCourtStatus(getDemoSlots(demoAvailability, '2026-11-07', 'court-3'))).toBe('available');
  });
  it('formats centavos without losing fractional pesos', () => {
    expect(formatMoney(60000)).toBe('₱600');
    expect(formatMoney(60050)).toBe('₱600.50');
  });
});
