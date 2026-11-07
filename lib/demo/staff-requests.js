import { bookingByRef, paymentStateOf } from './staff';
import { scheduleItems, findConflicts } from './staff-schedule';
// Cancellation and rescheduling previews. Nothing here decides a policy, a refund rate or a
// deadline; refund requested/approved/completed stay three separate facts.

export function refundStage(refund) {
 if (refund.payout) return 'completed';
 if (refund.approved === true) return 'approved';
 if (refund.approved === false) return 'declined';
 if (refund.requested) return 'requested';
 return 'none';
}
export const refundStageLabels = {
 none: 'No refund requested',
 requested: 'Refund requested — awaiting a decision',
 approved: 'Refund approved — no payout recorded',
 declined: 'Refund not approved',
 completed: 'Refund completed — sample payout recorded',
};

export function cancellationView(request, data) {
 const booking = bookingByRef(data, request.bookingRef);
 const paid = paymentStateOf(booking) === 'verified';
 return { request, booking, refund: request.refund, refundStage: refundStage(request.refund), refundReviewMayBeNeeded: paid, verifiedCentavos: paid ? booking.agreement.totalCentavos : 0 };
}

// Sample availability check for the requested slot, excluding the booking being moved.
export function rescheduleView(request, data) {
 const booking = bookingByRef(data, request.bookingRef);
 const conflicts = findConflicts({ courtIds: [request.to.courtId], startsAt: request.to.startsAt, endsAt: request.to.endsAt, excludeSourceIds: [booking.reference] }, scheduleItems(data));
 return { request, booking, conflicts, available: conflicts.length === 0 };
}

export const completedRefundCentavos = (data) => data.cancellations.reduce((sum, request) => sum + (request.refund.payout?.centavos ?? 0), 0);
export const pendingCount = (requests) => requests.filter((request) => request.status === 'pending').length;
export const requestsForBooking = (data, reference) => ({
 cancellations: data.cancellations.filter((request) => request.bookingRef === reference),
 reschedules: data.reschedules.filter((request) => request.bookingRef === reference),
});
