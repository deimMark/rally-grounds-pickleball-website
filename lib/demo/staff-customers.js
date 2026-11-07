import { staffClock, paymentStateOf, activeStatuses, bookingStatuses } from './staff';
import { requestsForBooking } from './staff-requests';
import { instantLabel } from './staff-schedule';
// Customer history previews built only from the synthetic fixtures. Searching by name or
// sample reference is a convenience, never authorization; email/phone lookup is not offered.

export function customerSummary(data, customer, now = staffClock.now) {
 const bookings = data.bookings.filter((booking) => booking.customerId === customer.id).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
 const at = Date.parse(now);
 return {
  customer, bookings,
  total: bookings.length,
  past: bookings.filter((booking) => Date.parse(booking.startsAt) < at).length,
  upcoming: bookings.filter((booking) => Date.parse(booking.startsAt) >= at && activeStatuses.includes(booking.status)).length,
  completed: bookings.filter((booking) => booking.status === 'completed').length,
  cancelled: bookings.filter((booking) => booking.status === 'cancelled').length,
  expired: bookings.filter((booking) => booking.status === 'expired').length,
  pendingClaims: bookings.filter((booking) => ['pending_review', 'needs_resubmission'].includes(paymentStateOf(booking))).length,
  verifiedCentavos: bookings.filter((booking) => paymentStateOf(booking) === 'verified').reduce((sum, booking) => sum + booking.agreement.totalCentavos, 0),
 };
}
export const customerSummaries = (data, now) => data.customers.map((customer) => customerSummary(data, customer, now));

export const customerFilters = [
 { id: 'all', label: 'All sample customers', test: () => true },
 { id: 'upcoming', label: 'With upcoming bookings', test: (summary) => summary.upcoming > 0 },
 { id: 'claims', label: 'With pending payment claims', test: (summary) => summary.pendingClaims > 0 },
 { id: 'cancelled', label: 'With cancellations', test: (summary) => summary.cancelled > 0 },
];
export function searchCustomers(summaries, query = '', filter = 'all') {
 const needle = query.trim().toLowerCase();
 const rule = customerFilters.find((entry) => entry.id === filter) ?? customerFilters[0];
 return summaries.filter((summary) => rule.test(summary) && (!needle || summary.customer.name.toLowerCase().includes(needle) || summary.customer.reference.toLowerCase().includes(needle)));
}

// Chronological verification/booking history for one booking (fixture facts only).
export function bookingTimeline(data, booking) {
 const events = [{ at: booking.createdAt, label: 'Sample booking created as an unpaid hold' }];
 const { payment } = booking;
 if (payment.submittedAt) events.push({ at: payment.submittedAt, label: `Receipt image submitted (${payment.method === 'gcash' ? 'GCash' : 'bank transfer'}) — a claim, not proof of funds` });
 if (payment.evidence === 'rejected' && payment.reviewedAt) events.push({ at: payment.reviewedAt, label: 'Receipt rejected — no matching transaction in the sample records' });
 if (payment.verification === 'verified_fictional' && payment.reviewedAt) events.push({ at: payment.reviewedAt, label: 'Payment verified (fictional) — matched against the sample account records' });
 if (booking.expiredAt) events.push({ at: booking.expiredAt, label: 'Hold expired without a verified payment' });
 const requests = requestsForBooking(data, booking.reference);
 for (const request of requests.cancellations) {
  events.push({ at: request.requestedAt, label: `Cancellation ${request.initiatedBy === 'club' ? 'initiated by the club' : 'requested by the customer'}` });
  if (request.decidedAt) events.push({ at: request.decidedAt, label: `Cancellation ${request.status}${request.simulated ? ' (simulated)' : ''}` });
  if (request.refund.payout) events.push({ at: request.refund.payout.recordedAt, label: 'Sample refund payout recorded by staff' });
 }
 for (const request of requests.reschedules) {
  events.push({ at: request.requestedAt, label: 'Reschedule requested' });
  if (request.decidedAt) events.push({ at: request.decidedAt, label: `Reschedule ${request.status}${request.simulated ? ' (simulated)' : ''}` });
 }
 if (booking.status === 'completed') events.push({ at: booking.endsAt, label: 'Session completed' });
 if (booking.simulated) events.push({ at: staffClock.now, label: `Status shown as “${bookingStatuses[booking.status].label}” by a simulation (not saved)` });
 return events.sort((a, b) => Date.parse(a.at) - Date.parse(b.at)).map((event) => ({ ...event, when: instantLabel(event.at) }));
}
