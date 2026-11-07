import { describe, it, expect } from 'vitest';
import { staffBookings, staffCustomers, staffOpenPlay, staffClosures, staffCancellationRequests, staffRescheduleRequests, staffClock, staffFixtureVersion, bookingStatuses, paymentStateOf, applySimulation, initialSimulation, clubInstant, activeStatuses } from '../../lib/demo/staff';
import { scheduleItems, findConflicts, overlaps, dayGrid, weekGrid, weekDays, weekStartOf, matchesFilter, clubParts, timeLabel, sessionLabel, dayLabel, dateRange, courtDayStatus } from '../../lib/demo/staff-schedule';
import { cancellationView, rescheduleView, refundStage, completedRefundCentavos } from '../../lib/demo/staff-requests';
import { customerSummary, customerSummaries, searchCustomers, bookingTimeline } from '../../lib/demo/staff-customers';
import { staffOverview, paymentSummary, todayScheduleRows } from '../../lib/demo/staff-overview';
import { staffPaymentQueue, verifiedRevenueCentavos, unverifiedClaimCentavos } from '../../lib/demo/payment';
import { formatMoney } from '../../lib/domain/demo-availability';

const data = applySimulation(initialSimulation);
const items = scheduleItems(data);
const booking = (n) => staffBookings.find((entry) => entry.reference.endsWith(String(n)));

describe('Phase 5A fixtures: integrity and synthetic-only content', () => {
 it('is versioned and uses only fictional customers with example.invalid contacts', () => {
  expect(staffFixtureVersion).toBe('staff-demo-v1');
  for (const customer of staffCustomers) {
   expect(customer.name).toMatch(/^Sample Customer [A-H]$/);
   expect(customer.contact.value).toMatch(/^customer-[a-h]@example\.invalid$/);
  }
  expect(JSON.stringify([staffBookings, staffOpenPlay, staffClosures, staffCancellationRequests, staffRescheduleRequests])).not.toMatch(/\b09\d{9}\b|@(?!example\.invalid)[a-z]+\.[a-z]+|https?:\/\//i);
 });
 it('keeps every occupying item conflict-free under half-open intervals', () => {
  for (const [index, a] of items.entries()) for (const b of items.slice(index + 1)) {
   if (a.courtId === b.courtId) expect(overlaps(a, b), `${a.id} vs ${b.id}`).toBe(false);
  }
 });
 it('stores money as integer centavos and timestamps as UTC instants', () => {
  for (const entry of staffBookings) {
   expect(Number.isInteger(entry.agreement.totalCentavos)).toBe(true);
   expect(entry.agreement.totalCentavos).toBe(entry.agreement.rateCentavos * entry.durationMinutes / 60);
   for (const iso of [entry.startsAt, entry.endsAt, entry.createdAt]) expect(iso).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:00\.000Z$/);
   expect(Object.isFrozen(entry.agreement)).toBe(true);
  }
 });
 it('never confirms or completes a booking without a verified (fictional) payment', () => {
  for (const entry of staffBookings) {
   if (['confirmed', 'completed'].includes(entry.status)) expect(entry.payment.verification).toBe('verified_fictional');
   if (entry.status === 'pending_verification') expect([entry.payment.evidence, entry.payment.verification]).toEqual(['submitted', 'unverified']);
   if (entry.payment.evidence === 'rejected') expect(entry.status).toBe('held');
  }
 });
 it('mirrors the Phase 4A receipt queue exactly for references 301–305', () => {
  for (const queued of staffPaymentQueue) {
   const match = staffBookings.find((entry) => entry.reference === queued.reference);
   expect(match.inPaymentQueue).toBe(true);
   expect(paymentStateOf(match)).toBe(queued.state);
   expect(match.courtId).toBe(`court-${queued.court}`);
   expect(match.agreement.totalCentavos).toBe(queued.agreedCentavos);
   expect(match.payment.method).toBe(queued.method);
   expect(sessionLabel(match.startsAt, match.endsAt)).toBe(queued.session);
   expect(staffCustomers.find((customer) => customer.id === match.customerId).name).toBe(queued.customer);
  }
 });
 it('links approved cancellations to cancelled bookings and pending ones to active bookings', () => {
  for (const request of staffCancellationRequests) {
   const target = staffBookings.find((entry) => entry.reference === request.bookingRef);
   if (request.status === 'approved') expect(target.status).toBe('cancelled');
   if (request.status === 'pending') expect(activeStatuses).toContain(target.status);
   if (request.refund.payout) expect(request.refund.approved).toBe(true);
  }
 });
});

describe('time and timezone helpers', () => {
 it('renders UTC instants in Asia/Manila independently of the process timezone', () => {
  expect(clubInstant('2026-11-07', 8)).toBe('2026-11-07T00:00:00.000Z');
  expect(clubParts('2026-11-06T23:30:00.000Z')).toEqual({ dateKey: '2026-11-07', hour: 7, minute: 30 });
  expect(clubParts('2026-11-07T15:00:00.000Z')).toEqual({ dateKey: '2026-11-07', hour: 23, minute: 0 });
  expect(timeLabel('2026-11-07T04:00:00.000Z')).toBe('12:00 PM');
  expect(timeLabel('2026-11-06T16:00:00.000Z')).toBe('12:00 AM');
  expect(dayLabel('2026-11-07')).toBe('Sat, 7 Nov 2026');
  expect(dayLabel('2026-11-07', true)).toBe('Saturday, 7 November 2026');
 });
 it('builds Saturday-to-Friday weeks and the demo date range', () => {
  expect(weekStartOf('2026-11-11')).toBe('2026-11-07');
  expect(weekStartOf('2026-11-07')).toBe('2026-11-07');
  expect(weekStartOf('2026-11-06')).toBe('2026-10-31');
  expect(weekDays('2026-11-09')).toEqual(['2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13']);
  expect(dateRange()).toHaveLength(14);
 });
});

describe('schedule grouping, filters and conflicts', () => {
 it('treats touching intervals as non-overlapping and any shared minute as a conflict', () => {
  const a = { startsAt: clubInstant('2026-11-08', 8), endsAt: clubInstant('2026-11-08', 10) };
  expect(overlaps(a, { startsAt: clubInstant('2026-11-08', 10), endsAt: clubInstant('2026-11-08', 11) })).toBe(false);
  expect(overlaps(a, { startsAt: clubInstant('2026-11-08', 7), endsAt: clubInstant('2026-11-08', 8) })).toBe(false);
  expect(overlaps(a, { startsAt: clubInstant('2026-11-08', 9, 59), endsAt: clubInstant('2026-11-08', 11) })).toBe(true);
  // Fixture example: OP-2 (Court 3, 8–10) touches booking 315 (Court 3, 10–11) on Sunday.
  expect(findConflicts({ courtIds: ['court-3'], startsAt: clubInstant('2026-11-08', 10), endsAt: clubInstant('2026-11-08', 11), excludeSourceIds: [booking(315).reference] }, items)).toEqual([]);
 });
 it('blocks availability for open play and maintenance but not for expired or cancelled bookings', () => {
  expect(findConflicts({ courtIds: ['court-5'], startsAt: clubInstant('2026-11-07', 11), endsAt: clubInstant('2026-11-07', 12) }, items).map((item) => item.kind)).toEqual(['open-play']);
  expect(findConflicts({ courtIds: ['court-5'], startsAt: clubInstant('2026-11-09', 8), endsAt: clubInstant('2026-11-09', 9) }, items).map((item) => item.kind)).toEqual(['maintenance']);
  expect(findConflicts({ courtIds: ['court-5'], startsAt: clubInstant('2026-11-08', 10), endsAt: clubInstant('2026-11-08', 11) }, items)).toEqual([]); // 305 expired
  expect(findConflicts({ courtIds: ['court-4'], startsAt: clubInstant('2026-11-08', 18), endsAt: clubInstant('2026-11-08', 19) }, items)).toEqual([]); // 314 cancelled
  expect(findConflicts({ courtIds: ['court-4', 'court-5'], startsAt: clubInstant('2026-11-11', 18), endsAt: clubInstant('2026-11-11', 19) }, items)).toHaveLength(2); // two-court open play
 });
 it('groups a day into merged free ranges, items and filtered (never "free") cells per court', () => {
  const rows = dayGrid(items, '2026-11-07');
  expect(rows.map((row) => row.courtId)).toEqual(['court-1', 'court-2', 'court-3', 'court-4', 'court-5']);
  const court3 = rows.find((row) => row.courtId === 'court-3');
  expect(court3.cells.map((cell) => [cell.type, cell.from, cell.to])).toEqual([['item', 8, 10], ['free', 10, 23]]);
  expect(court3.freeHours).toBe(13);
  expect(courtDayStatus(court3)).toBe('available');
  const filtered = dayGrid(items, '2026-11-07', { filter: 'open-play' }).find((row) => row.courtId === 'court-3');
  expect(filtered.cells[0].type).toBe('hidden');
  expect(filtered.freeHours).toBe(13); // hiding by filter never creates free time
  expect(dayGrid(items, '2026-11-07', { courtIds: ['court-4'] })).toHaveLength(1);
 });
 it('applies session-type and booking-status filters', () => {
  const pending = items.find((item) => item.statusKey === 'pending_verification');
  expect(matchesFilter(pending, 'pending_verification')).toBe(true);
  expect(matchesFilter(pending, 'bookings')).toBe(true);
  expect(matchesFilter(pending, 'open-play')).toBe(false);
  expect(items.filter((item) => matchesFilter(item, 'maintenance')).map((item) => item.id)).toEqual(['MC-1', 'MC-2']);
 });
 it('builds a seven-day week per court with filter-hidden counts', () => {
  const week = weekGrid(items, '2026-11-10', { filter: 'maintenance' });
  expect(week.map((day) => day.dateKey)[0]).toBe('2026-11-07');
  const monday = week.find((day) => day.dateKey === '2026-11-09');
  expect(monday.courts.find((court) => court.courtId === 'court-5').items.map((item) => item.id)).toEqual(['MC-1']);
  expect(monday.courts.find((court) => court.courtId === 'court-1').hidden).toBe(1); // booking 304 hidden by filter
 });
});

describe('statuses, payments and revenue separation', () => {
 it('classifies booking statuses and which ones occupy a court', () => {
  expect(Object.keys(bookingStatuses)).toEqual(['held', 'pending_verification', 'confirmed', 'completed', 'expired', 'cancelled']);
  expect(Object.entries(bookingStatuses).filter(([, status]) => !status.occupies).map(([id]) => id)).toEqual(['expired', 'cancelled']);
  expect(bookingStatuses.pending_verification.description).toMatch(/receipt alone never confirms/);
 });
 it('computes verified, unverified, refunds and net from the same fixtures as Phase 4A', () => {
  const summary = paymentSummary(data);
  expect(summary).toEqual({ verified: 840000, unverified: 180000, refundsCompleted: 60000, net: 780000 });
  expect(summary.unverified).toBe(unverifiedClaimCentavos(staffPaymentQueue));
  const queueRefs = new Set(staffPaymentQueue.map((item) => item.reference));
  const queueOnly = staffBookings.filter((entry) => queueRefs.has(entry.reference)).map((entry) => ({ state: paymentStateOf(entry), claimedCentavos: entry.agreement.totalCentavos }));
  expect(verifiedRevenueCentavos(queueOnly)).toBe(verifiedRevenueCentavos(staffPaymentQueue));
 });
 it('derives every overview metric from the fixtures', () => {
  const overview = staffOverview(data);
  expect(overview).toMatchObject({ today: '2026-11-07', sessionsToday: 3, availableHoursToday: 67, totalHoursToday: 75, upcomingReservations: 9, pendingPaymentReviews: 1, pendingCancellations: 1, pendingReschedules: 2, openPlayThisWeek: 3, maintenanceThisWeek: 2 });
  expect(overview.pendingPaymentReviews).toBe(staffPaymentQueue.filter((item) => item.state === 'pending_review').length);
  const rows = todayScheduleRows(data);
  expect(rows.map((row) => row.status)).toEqual(['Confirmed', 'Unpaid hold', 'Open play', 'Pending review']);
  expect(rows.filter((row) => row.status === 'Pending review').map((row) => row.id)).toEqual([booking(302).reference]);
  expect(formatMoney(overview.payments.net)).toBe('₱7,800');
 });
});

describe('cancellations, refunds and reschedules', () => {
 it('keeps refund requested, approved and completed distinct; approval creates no payout', () => {
  expect(staffCancellationRequests.map((request) => refundStage(request.refund))).toEqual(['requested', 'completed', 'approved', 'none']);
  expect(completedRefundCentavos(data)).toBe(60000);
  const pending = cancellationView(staffCancellationRequests[0], data);
  expect(pending.refundReviewMayBeNeeded).toBe(true);
  const simulated = applySimulation({ ...initialSimulation, cancellation: { 'CR-1': 'approved' } });
  const approved = simulated.cancellations.find((request) => request.id === 'CR-1');
  expect(refundStage(approved.refund)).toBe('approved');
  expect(approved.refund.payout).toBeNull();
  expect(completedRefundCentavos(simulated)).toBe(60000);
  expect(paymentSummary(simulated).verified).toBe(840000); // verified money is unchanged by a simulated cancellation
  expect(simulated.bookings.find((entry) => entry.reference === booking(310).reference).status).toBe('cancelled');
  const rejected = applySimulation({ ...initialSimulation, cancellation: { 'CR-1': 'rejected' } });
  expect(refundStage(rejected.cancellations[0].refund)).toBe('declined');
  expect(rejected.bookings.find((entry) => entry.reference === booking(310).reference).status).toBe('confirmed');
 });
 it('previews reschedule availability, excluding the booking being moved', () => {
  const [rr1, rr2, rr3, rr4] = staffRescheduleRequests.map((request) => rescheduleView(request, data));
  expect(rr1.available).toBe(true);
  expect(rr2.conflicts.map((item) => item.reference)).toEqual([booking(311).reference]);
  expect(rr3.available).toBe(true); // already moved: the booking itself is excluded
  expect(rr4.conflicts.map((item) => item.kind)).toEqual(['maintenance']);
 });
 it('never changes the original agreement or moves the booking when a reschedule is simulated', () => {
  const simulated = applySimulation({ ...initialSimulation, reschedule: { 'RR-1': 'approved' } });
  const original = booking(311), after = simulated.bookings.find((entry) => entry.reference === original.reference);
  expect(after.agreement).toBe(original.agreement);
  expect([after.courtId, after.startsAt, after.endsAt]).toEqual([original.courtId, original.startsAt, original.endsAt]);
  expect(simulated.reschedules[0]).toMatchObject({ status: 'approved', simulated: true });
 });
});

describe('customer history aggregation', () => {
 it('summarises bookings per customer in chronological order', () => {
  const a = customerSummary(data, staffCustomers[0]);
  expect(a.bookings.map((entry) => entry.reference.slice(-3))).toEqual(['307', '301']);
  expect(a).toMatchObject({ total: 2, past: 1, upcoming: 1, completed: 1, cancelled: 0, pendingClaims: 0, verifiedCentavos: 120000 });
  const c = customerSummary(data, staffCustomers[2]);
  expect(c).toMatchObject({ pendingClaims: 1, cancelled: 1, verifiedCentavos: 60000 });
  expect(customerSummaries(data).reduce((sum, summary) => sum + summary.total, 0)).toBe(staffBookings.length);
 });
 it('searches by name or sample reference only and filters by history', () => {
  const summaries = customerSummaries(data);
  expect(searchCustomers(summaries, 'customer b').map((summary) => summary.customer.reference)).toEqual(['CUST-DEMO-B']);
  expect(searchCustomers(summaries, 'cust-demo-h').map((summary) => summary.customer.name)).toEqual(['Sample Customer H']);
  expect(searchCustomers(summaries, 'customer-b@example.invalid')).toEqual([]); // no email lookup
  expect(searchCustomers(summaries, '', 'claims').map((summary) => summary.customer.reference)).toEqual(['CUST-DEMO-B', 'CUST-DEMO-C']);
 });
 it('builds a chronological verification history', () => {
  const timeline = bookingTimeline(data, booking(303));
  expect(timeline.map((event) => event.label)).toEqual(['Sample booking created as an unpaid hold', 'Receipt image submitted (bank transfer) — a claim, not proof of funds', 'Receipt rejected — no matching transaction in the sample records']);
  expect(bookingTimeline(data, booking(309)).at(-1).label).toBe('Sample refund payout recorded by staff');
 });
});

describe('simulated booking transitions', () => {
 it('offers no confirm transition and blocks revival of expired or cancelled bookings', async () => {
  const { bookingActions } = await import('../../lib/demo/staff');
  for (const entry of staffBookings) for (const action of bookingActions(entry)) expect(action.to).not.toBe('confirmed');
  expect(bookingActions(booking(305))).toEqual([]); // expired: nothing can revive it
  expect(bookingActions(booking(309))).toEqual([]); // cancelled
  expect(bookingActions(booking(306))).toEqual([]); // completed
  expect(bookingActions(booking(302)).map((action) => action.to)).toEqual(['expired', 'cancelled']);
  const future = bookingActions(booking(310));
  expect(future.find((action) => action.id === 'complete')).toMatchObject({ disabled: true });
  expect(bookingActions(booking(310), clubInstant('2026-11-11', 21)).find((action) => action.id === 'complete').disabled).toBe(false); // ends exactly at 9 PM (half-open)
  expect(future.find((action) => action.id === 'cancel').confirm).toBe(true);
 });
});

describe('simulation overlay', () => {
 it('changes only in-memory copies and counts simulated changes', () => {
  const simulated = applySimulation({ ...initialSimulation, bookingStatus: { [booking(301).reference]: 'expired' }, closuresCancelled: ['MC-2'], openPlayCancelled: ['OP-3'] });
  expect(simulated.bookings.find((entry) => entry.reference === booking(301).reference)).toMatchObject({ status: 'expired', simulated: true });
  expect(booking(301).status).toBe('held'); // fixture untouched
  expect(simulated.closures.map((closure) => closure.id)).toEqual(['MC-1']);
  expect(simulated.openPlay.map((event) => event.id)).toEqual(['OP-1', 'OP-2']);
  expect(simulated.changeCount).toBe(3);
  expect(staffOverview(simulated).sessionsToday).toBe(2);
  expect(staffClock.now).toBe('2026-11-06T23:30:00.000Z');
 });
});
