import { staffClock, staffCourts, staffHours, activeStatuses, paymentStateOf, bookingStatuses, courtNumber } from './staff';
import { scheduleItems, dayGrid, weekDays, rangeLabel, dayLabel, clubParts } from './staff-schedule';
import { completedRefundCentavos, pendingCount } from './staff-requests';
import { verifiedRevenueCentavos, unverifiedClaimCentavos } from './payment';
// Every overview figure is computed from the same fixtures (plus any in-memory simulation).

export function paymentSummary(data) {
 const claims = data.bookings.map((booking) => ({ state: paymentStateOf(booking), claimedCentavos: booking.agreement.totalCentavos }));
 const verified = verifiedRevenueCentavos(claims), refundsCompleted = completedRefundCentavos(data);
 return { verified, unverified: unverifiedClaimCentavos(claims), refundsCompleted, net: verified - refundsCompleted };
}

export function staffOverview(data, { today = staffClock.today, now = staffClock.now } = {}) {
 const items = scheduleItems(data);
 const rows = dayGrid(items, today);
 const week = new Set(weekDays(today));
 const todaysBookings = data.bookings.filter((booking) => bookingStatuses[booking.status].occupies && clubParts(booking.startsAt).dateKey === today);
 const inWeek = (startsAt) => week.has(clubParts(startsAt).dateKey);
 return {
  today, now,
  sessionsToday: todaysBookings.length,
  availableHoursToday: rows.reduce((sum, row) => sum + row.freeHours, 0),
  totalHoursToday: staffCourts.length * (staffHours.close - staffHours.open),
  upcomingReservations: data.bookings.filter((booking) => activeStatuses.includes(booking.status) && Date.parse(booking.startsAt) >= Date.parse(now)).length,
  pendingPaymentReviews: data.bookings.filter((booking) => paymentStateOf(booking) === 'pending_review').length,
  pendingCancellations: pendingCount(data.cancellations),
  pendingReschedules: pendingCount(data.reschedules),
  openPlayThisWeek: data.openPlay.filter((event) => inWeek(event.startsAt)).length,
  maintenanceThisWeek: data.closures.filter((closure) => inWeek(closure.startsAt)).length,
  payments: paymentSummary(data),
 };
}

// Rows for the overview's "Sample schedule" table (today only), in start order.
export function todayScheduleRows(data, today = staffClock.today) {
 return scheduleItems(data).filter((item) => item.dateKey === today).map((item) => ({
  id: item.kind === 'booking' ? item.reference : item.sourceId,
  court: `Court ${courtNumber(item.courtId)}`,
  time: rangeLabel(item.startsAt, item.endsAt),
  type: item.kind === 'booking' ? `Private session · ${item.title}` : item.kind === 'open-play' ? `Open play · ${item.title}` : 'Maintenance closure',
  status: item.label,
  tone: item.tone,
 }));
}
export const todayLabel = (today = staffClock.today) => dayLabel(today, true);
