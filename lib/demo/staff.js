import { bookingDemo } from './booking';
import { demoCourts } from './club';
import { staffPaymentQueue, paymentStates } from './payment';
// Phase 5A synthetic staff fixtures. One versioned dataset feeds every staff page so that
// courts, bookings, customers, payments, open play, closures and requests never disagree.
// Nothing here is a real customer, booking, payment, policy or operating statistic.

export const staffFixtureVersion = 'staff-demo-v1';
const pad = (n) => String(n).padStart(2, '0');
// UTC instant for a club-local (Asia/Manila, UTC+8, no DST) wall-clock time.
export const clubInstant = (dateKey, hour, minute = 0) => new Date(`${dateKey}T${pad(hour)}:${pad(minute)}:00+08:00`).toISOString();

// The demo clock: "today" is Saturday 7 November 2026, 7:30 AM in Manila.
export const staffClock = { today: '2026-11-07', now: clubInstant('2026-11-07', 7, 30), firstDay: '2026-10-31', lastDay: '2026-11-13' };
// Provisional demo hours reused from the booking fixtures (not owner-approved hours).
export const staffHours = { open: bookingDemo.startHour, close: bookingDemo.endHour, rateCentavos: bookingDemo.rateCentavos };
// Courts in number order for tables; geometry stays in the shared CourtMap/demoCourts.
export const staffCourts = [...demoCourts].sort((a, b) => a.number - b.number);
export const courtNumber = (courtId) => staffCourts.find((court) => court.id === courtId)?.number;

export const SIMULATION_LABEL = 'SIMULATED ACTION — NO BOOKING CHANGED';

export const staffCustomers = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((letter) => ({
 id: `cust-${letter.toLowerCase()}`,
 reference: `CUST-DEMO-${letter}`,
 name: `Sample Customer ${letter}`,
 contact: { kind: 'email', value: `customer-${letter.toLowerCase()}@example.invalid` },
}));
const customerByName = Object.fromEntries(staffCustomers.map((customer) => [customer.name, customer]));

// Booking status is separate from payment evidence and payment verification.
export const bookingStatuses = {
 held: { label: 'Unpaid hold', tone: 'pending', occupies: true, description: 'Holding the court while the customer pays. Not paid and not confirmed.' },
 pending_verification: { label: 'Pending review', tone: 'pending', occupies: true, description: 'Still an unpaid hold. A receipt was submitted and awaits staff verification; a receipt alone never confirms a booking.' },
 confirmed: { label: 'Confirmed', tone: 'available', occupies: true, description: 'Confirmed only after staff matched an actual incoming payment (fictional in this demo).' },
 completed: { label: 'Completed', tone: 'completed', occupies: true, description: 'The session has taken place. Its original agreement is kept unchanged.' },
 expired: { label: 'Expired hold', tone: 'expired', occupies: false, description: 'The hold lapsed without a verified payment and released the court. Evidence cannot revive it; the customer would book again.' },
 cancelled: { label: 'Cancelled', tone: 'cancelled', occupies: false, description: 'Cancelled and no longer occupying the court. Any refund is a separate decision and a separate payout record.' },
};
export const bookingStatusIds = Object.keys(bookingStatuses);
export const activeStatuses = ['held', 'pending_verification', 'confirmed'];

const ref = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const queueByRef = Object.fromEntries(staffPaymentQueue.map((item) => [item.reference, item]));
// Phase 4A payment-queue states map onto separate evidence and verification fields.
const evidenceFromQueue = { awaiting_evidence: 'none', pending_review: 'submitted', needs_resubmission: 'rejected', verified: 'submitted', expired: 'none' };

function makeBooking({ n, customer, court, day, start, hours, players, status, created, payment = {}, extra = {} }) {
 const queue = queueByRef[ref(n)];
 const startsAt = clubInstant(day, start), endsAt = clubInstant(day, start + hours);
 const totalCentavos = staffHours.rateCentavos * hours;
 const fromQueue = queue ? { method: queue.method, transactionRef: queue.transactionRef, submittedAt: queue.submittedAt, evidence: evidenceFromQueue[queue.state], verification: queue.state === 'verified' ? 'verified_fictional' : 'unverified' } : {};
 return {
  reference: ref(n),
  customerId: customerByName[`Sample Customer ${customer}`].id,
  courtId: `court-${court}`,
  startsAt, endsAt, durationMinutes: hours * 60, players, status,
  createdAt: created,
  // Fixed at creation. Simulations and requests never change these values.
  agreement: Object.freeze({ totalCentavos, rateCentavos: staffHours.rateCentavos, currency: 'PHP', termsVersion: 'presentation-v1' }),
  payment: { method: 'gcash', transactionRef: null, submittedAt: null, reviewedAt: null, evidence: 'none', verification: 'unverified', ...fromQueue, ...payment },
  inPaymentQueue: Boolean(queue),
  ...extra,
 };
}
const verified = (method, code, submittedAt, reviewedAt) => ({ method, transactionRef: `SAMPLE-${method === 'gcash' ? 'GC' : 'BK'}-${code}`, submittedAt, reviewedAt, evidence: 'submitted', verification: 'verified_fictional' });

export const staffBookings = [
 // 301–305 mirror the Phase 4A receipt queue exactly (asserted by unit tests).
 makeBooking({ n: 301, customer: 'A', court: 3, day: '2026-11-07', start: 8, hours: 2, players: 4, status: 'held', created: clubInstant('2026-11-03', 8, 0) }),
 makeBooking({ n: 302, customer: 'B', court: 4, day: '2026-11-07', start: 9, hours: 1, players: 2, status: 'pending_verification', created: clubInstant('2026-11-03', 8, 20) }),
 makeBooking({ n: 303, customer: 'C', court: 2, day: '2026-11-08', start: 13, hours: 2, players: 4, status: 'held', created: clubInstant('2026-11-03', 8, 50), payment: { reviewedAt: clubInstant('2026-11-03', 11, 0) } }),
 makeBooking({ n: 304, customer: 'D', court: 1, day: '2026-11-09', start: 17, hours: 1, players: 4, status: 'confirmed', created: clubInstant('2026-11-03', 9, 0), payment: { reviewedAt: clubInstant('2026-11-03', 12, 0) } }),
 makeBooking({ n: 305, customer: 'E', court: 5, day: '2026-11-08', start: 10, hours: 1, players: 2, status: 'expired', created: clubInstant('2026-11-03', 7, 0), extra: { expiredAt: clubInstant('2026-11-03', 9, 0) } }),
 makeBooking({ n: 306, customer: 'F', court: 2, day: '2026-10-31', start: 18, hours: 1, players: 4, status: 'completed', created: clubInstant('2026-10-28', 10, 0), payment: verified('gcash', '0006', clubInstant('2026-10-28', 10, 30), clubInstant('2026-10-28', 13, 0)) }),
 makeBooking({ n: 307, customer: 'A', court: 3, day: '2026-11-01', start: 9, hours: 2, players: 6, status: 'completed', created: clubInstant('2026-10-29', 9, 0), payment: verified('bank', '0007', clubInstant('2026-10-29', 9, 40), clubInstant('2026-10-29', 15, 0)) }),
 makeBooking({ n: 308, customer: 'G', court: 1, day: '2026-11-07', start: 8, hours: 1, players: 4, status: 'confirmed', created: clubInstant('2026-11-04', 10, 0), payment: verified('gcash', '0008', clubInstant('2026-11-04', 10, 20), clubInstant('2026-11-04', 14, 0)) }),
 makeBooking({ n: 309, customer: 'H', court: 5, day: '2026-11-09', start: 8, hours: 1, players: 2, status: 'cancelled', created: clubInstant('2026-11-02', 16, 0), payment: verified('gcash', '0009', clubInstant('2026-11-02', 16, 15), clubInstant('2026-11-02', 18, 0)) }),
 makeBooking({ n: 310, customer: 'F', court: 3, day: '2026-11-11', start: 19, hours: 2, players: 8, status: 'confirmed', created: clubInstant('2026-11-05', 9, 0), payment: verified('bank', '0010', clubInstant('2026-11-05', 9, 30), clubInstant('2026-11-05', 13, 0)) }),
 makeBooking({ n: 311, customer: 'G', court: 2, day: '2026-11-12', start: 17, hours: 1, players: 4, status: 'confirmed', created: clubInstant('2026-11-05', 11, 0), payment: verified('gcash', '0011', clubInstant('2026-11-05', 11, 10), clubInstant('2026-11-05', 14, 0)) }),
 makeBooking({ n: 312, customer: 'B', court: 4, day: '2026-11-13', start: 18, hours: 2, players: 6, status: 'confirmed', created: clubInstant('2026-11-05', 12, 0), payment: verified('gcash', '0012', clubInstant('2026-11-05', 12, 30), clubInstant('2026-11-05', 16, 0)) }),
 makeBooking({ n: 313, customer: 'H', court: 1, day: '2026-11-01', start: 16, hours: 1, players: 3, status: 'completed', created: clubInstant('2026-10-28', 11, 0), payment: verified('bank', '0013', clubInstant('2026-10-28', 11, 20), clubInstant('2026-10-28', 15, 0)) }),
 makeBooking({ n: 314, customer: 'C', court: 4, day: '2026-11-08', start: 18, hours: 1, players: 4, status: 'cancelled', created: clubInstant('2026-11-04', 12, 0), payment: verified('gcash', '0014', clubInstant('2026-11-04', 12, 10), clubInstant('2026-11-04', 15, 0)) }),
 makeBooking({ n: 315, customer: 'E', court: 3, day: '2026-11-08', start: 10, hours: 1, players: 4, status: 'confirmed', created: clubInstant('2026-11-04', 13, 0), payment: verified('gcash', '0015', clubInstant('2026-11-04', 13, 15), clubInstant('2026-11-04', 16, 0)) }),
];

// Reuses the Phase 4A payment-state vocabulary so receipt review and staff pages agree.
export function paymentStateOf(booking) {
 if (booking.payment.verification === 'verified_fictional') return 'verified';
 if (booking.status === 'expired') return 'expired';
 if (booking.payment.evidence === 'rejected') return 'needs_resubmission';
 if (booking.payment.evidence === 'submitted') return 'pending_review';
 return 'awaiting_evidence';
}
export const paymentStateLabel = (id) => paymentStates[id].shortLabel ?? paymentStates[id].label;
export const evidenceLabels = { none: 'No receipt submitted', submitted: 'Receipt submitted (a claim)', rejected: 'Receipt rejected — needs resubmission' };
export const verificationLabels = { unverified: 'Not verified — no funds matched', verified_fictional: 'Verified (fictional) — matched in the sample records' };

// Open play occupies its courts like any booking. `reclubUrl` is an optional, event-specific
// Reclub Meet link supplied by the owner; it never changes availability, bookings or payments.
// All fixtures are null ("link pending") because no approved real Meet link exists yet.
export const staffOpenPlay = [
 { id: 'OP-1', eventType: 'open-play', title: 'Saturday community open play', courtIds: ['court-5'], startsAt: clubInstant('2026-11-07', 8), endsAt: clubInstant('2026-11-07', 12), description: 'Sample social rotation for mixed levels.', reclubUrl: null },
 { id: 'OP-2', eventType: 'open-play', title: 'Sunday morning social', courtIds: ['court-3'], startsAt: clubInstant('2026-11-08', 8), endsAt: clubInstant('2026-11-08', 10), description: 'Sample relaxed doubles for regulars and visitors.', reclubUrl: null },
 { id: 'OP-3', eventType: 'open-play', title: 'Beginner-friendly open play', courtIds: ['court-4', 'court-5'], startsAt: clubInstant('2026-11-11', 17), endsAt: clubInstant('2026-11-11', 19), description: 'Sample introductory session with paddles available.', reclubUrl: null },
];

export const staffClosures = [
 { id: 'MC-1', courtId: 'court-5', startsAt: clubInstant('2026-11-09', 8), endsAt: clubInstant('2026-11-09', 10), reason: 'Fictional: net tension and post check.' },
 { id: 'MC-2', courtId: 'court-2', startsAt: clubInstant('2026-11-10', 12), endsAt: clubInstant('2026-11-10', 14), reason: 'Fictional: line repainting.' },
];

// Refund requested, approved and completed are three separate facts. An approval never
// creates a payout; a payout is a separately recorded sample amount, not a refund rate.
export const staffCancellationRequests = [
 { id: 'CR-1', bookingRef: ref(310), initiatedBy: 'customer', requestedAt: clubInstant('2026-11-06', 18), reason: 'Fictional: the group can no longer play that evening.', status: 'pending', decidedAt: null, refund: { requested: true, approved: null, payout: null } },
 { id: 'CR-2', bookingRef: ref(309), initiatedBy: 'club', requestedAt: clubInstant('2026-11-04', 9), reason: 'Fictional: club closed Court 5 for a sample maintenance check.', status: 'approved', decidedAt: clubInstant('2026-11-04', 10), refund: { requested: true, approved: true, payout: { centavos: 60000, recordedAt: clubInstant('2026-11-05', 11) } } },
 { id: 'CR-3', bookingRef: ref(314), initiatedBy: 'customer', requestedAt: clubInstant('2026-11-05', 15), reason: 'Fictional: a player is unwell.', status: 'approved', decidedAt: clubInstant('2026-11-06', 10), refund: { requested: true, approved: true, payout: null } },
 { id: 'CR-4', bookingRef: ref(308), initiatedBy: 'customer', requestedAt: clubInstant('2026-11-06', 20), reason: 'Fictional: asked to cancel, then confirmed the group would still play.', status: 'rejected', decidedAt: clubInstant('2026-11-06', 21), refund: { requested: false, approved: null, payout: null } },
];

export const staffRescheduleRequests = [
 { id: 'RR-1', bookingRef: ref(311), requestedAt: clubInstant('2026-11-06', 12), from: { courtId: 'court-2', startsAt: clubInstant('2026-11-12', 17), endsAt: clubInstant('2026-11-12', 18) }, to: { courtId: 'court-2', startsAt: clubInstant('2026-11-13', 17), endsAt: clubInstant('2026-11-13', 18) }, status: 'pending', decidedAt: null, note: null },
 { id: 'RR-2', bookingRef: ref(312), requestedAt: clubInstant('2026-11-06', 14), from: { courtId: 'court-4', startsAt: clubInstant('2026-11-13', 18), endsAt: clubInstant('2026-11-13', 20) }, to: { courtId: 'court-2', startsAt: clubInstant('2026-11-12', 17), endsAt: clubInstant('2026-11-12', 19) }, status: 'pending', decidedAt: null, note: null },
 { id: 'RR-3', bookingRef: ref(313), requestedAt: clubInstant('2026-10-29', 10), from: { courtId: 'court-1', startsAt: clubInstant('2026-10-31', 16), endsAt: clubInstant('2026-10-31', 17) }, to: { courtId: 'court-1', startsAt: clubInstant('2026-11-01', 16), endsAt: clubInstant('2026-11-01', 17) }, status: 'approved', decidedAt: clubInstant('2026-10-29', 14), note: 'Fictional: moved by one day at the customer’s request; original agreement kept.' },
 { id: 'RR-4', bookingRef: ref(304), requestedAt: clubInstant('2026-11-05', 9), from: { courtId: 'court-1', startsAt: clubInstant('2026-11-09', 17), endsAt: clubInstant('2026-11-09', 18) }, to: { courtId: 'court-5', startsAt: clubInstant('2026-11-09', 8), endsAt: clubInstant('2026-11-09', 9) }, status: 'rejected', decidedAt: clubInstant('2026-11-05', 11), note: 'Fictional: the requested time overlaps a sample maintenance closure.' },
];
export const requestStatusLabels = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' };

export const initialSimulation = Object.freeze({ bookingStatus: {}, cancellation: {}, reschedule: {}, openPlayAdded: [], openPlayEdited: {}, openPlayCancelled: [], closuresAdded: [], closuresCancelled: [], seq: 0, log: [] });

// Pure overlay of in-memory simulated actions on the fixtures. Fixtures are never mutated,
// and original agreements are carried through unchanged.
export function applySimulation(state = initialSimulation) {
 const cancellationApproved = new Set(Object.entries(state.cancellation).filter(([, decision]) => decision === 'approved').map(([id]) => id));
 const cancellations = staffCancellationRequests.map((request) => {
  const decision = state.cancellation[request.id];
  if (!decision || request.status !== 'pending') return request;
  return { ...request, status: decision, decidedAt: staffClock.now, simulated: true, refund: { ...request.refund, approved: request.refund.requested ? decision === 'approved' : null } };
 });
 const cancelledRefs = new Set(staffCancellationRequests.filter((request) => cancellationApproved.has(request.id) && request.status === 'pending').map((request) => request.bookingRef));
 const bookings = staffBookings.map((booking) => {
  let status = state.bookingStatus[booking.reference] ?? booking.status;
  if (cancelledRefs.has(booking.reference) && activeStatuses.includes(status)) status = 'cancelled';
  return status === booking.status ? booking : { ...booking, status, simulated: true };
 });
 const reschedules = staffRescheduleRequests.map((request) => {
  const decision = state.reschedule[request.id];
  return decision && request.status === 'pending' ? { ...request, status: decision, decidedAt: staffClock.now, simulated: true } : request;
 });
 const openPlay = [...staffOpenPlay.map((event) => (state.openPlayEdited[event.id] ? { ...event, ...state.openPlayEdited[event.id], simulated: true } : event)), ...state.openPlayAdded.map((event) => (state.openPlayEdited[event.id] ? { ...event, ...state.openPlayEdited[event.id] } : event))]
  .filter((event) => !state.openPlayCancelled.includes(event.id));
 const closures = [...staffClosures, ...state.closuresAdded].filter((closure) => !state.closuresCancelled.includes(closure.id));
 const changeCount = Object.keys(state.bookingStatus).length + Object.keys(state.cancellation).length + Object.keys(state.reschedule).length + state.openPlayAdded.length + Object.keys(state.openPlayEdited).length + state.openPlayCancelled.length + state.closuresAdded.length + state.closuresCancelled.length;
 return { bookings, openPlay, closures, cancellations, reschedules, customers: staffCustomers, changeCount };
}
// Simulated status transitions a staff member may preview. There is deliberately no
// "confirm" transition: confirmation follows a verified payment, never a receipt alone.
export function bookingActions(booking, now = staffClock.now) {
 if (['held', 'pending_verification'].includes(booking.status)) return [
  { id: 'expire', to: 'expired', label: 'Simulate: hold expires' },
  { id: 'cancel', to: 'cancelled', label: 'Simulate: cancel booking', confirm: true },
 ];
 if (booking.status === 'confirmed') {
  const ended = Date.parse(booking.endsAt) <= Date.parse(now);
  return [
   { id: 'complete', to: 'completed', label: 'Simulate: mark session completed', disabled: !ended, reason: ended ? null : 'Not available: the session has not ended at the demo clock (Sat 7 Nov 2026, 7:30 AM).' },
   { id: 'cancel', to: 'cancelled', label: 'Simulate: cancel booking', confirm: true },
  ];
 }
 return [];
}
export const customerOf = (data, booking) => data.customers.find((customer) => customer.id === booking.customerId);
export const bookingByRef = (data, reference) => data.bookings.find((booking) => booking.reference === reference);
