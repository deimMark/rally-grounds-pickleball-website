import { staffClock, staffHours, staffCourts, bookingStatuses, customerOf } from './staff';
// Pure scheduling helpers for the synthetic staff demo. Times are UTC instants rendered in
// Asia/Manila. Intervals are half-open [start, end): touching intervals do not overlap.
// Client-side conflict checks only illustrate the rule; real enforcement belongs in PostgreSQL.

const pad = (n) => String(n).padStart(2, '0');
const partsFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
export function clubParts(iso) {
 const parts = Object.fromEntries(partsFormat.formatToParts(new Date(iso)).map((part) => [part.type, part.value]));
 return { dateKey: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) % 24, minute: Number(parts.minute) };
}
export const clockLabel = (hour, minute = 0) => `${hour % 12 || 12}:${pad(minute)} ${hour % 24 < 12 ? 'AM' : 'PM'}`;
export const timeLabel = (iso) => { const { hour, minute } = clubParts(iso); return clockLabel(hour, minute); };
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function dayLabel(dateKey, long = false) {
 const date = new Date(`${dateKey}T12:00:00Z`);
 return long ? `${WEEKDAYS_LONG[date.getUTCDay()]}, ${date.getUTCDate()} ${MONTHS_LONG[date.getUTCMonth()]} ${date.getUTCFullYear()}` : `${WEEKDAYS[date.getUTCDay()]}, ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}
export const rangeLabel = (startsAt, endsAt) => `${timeLabel(startsAt)} – ${timeLabel(endsAt)}`;
export const sessionLabel = (startsAt, endsAt) => `${dayLabel(clubParts(startsAt).dateKey)} · ${rangeLabel(startsAt, endsAt)}`;
export const instantLabel = (iso) => `${dayLabel(clubParts(iso).dateKey)}, ${timeLabel(iso)}`;
export const durationLabel = (minutes) => `${minutes / 60} ${minutes === 60 ? 'hour' : 'hours'}`;

export function addDays(dateKey, days) {
 const date = new Date(`${dateKey}T12:00:00Z`);
 date.setUTCDate(date.getUTCDate() + days);
 return date.toISOString().slice(0, 10);
}
export function dateRange(first = staffClock.firstDay, last = staffClock.lastDay) {
 const keys = [];
 for (let key = first; key <= last; key = addDays(key, 1)) keys.push(key);
 return keys;
}
// Club weeks run Saturday to Friday in this demo.
export function weekStartOf(dateKey) { return addDays(dateKey, -((new Date(`${dateKey}T12:00:00Z`).getUTCDay() + 1) % 7)); }
export const weekDays = (dateKey) => Array.from({ length: 7 }, (_, index) => addDays(weekStartOf(dateKey), index));

export const overlaps = (a, b) => Date.parse(a.startsAt) < Date.parse(b.endsAt) && Date.parse(b.startsAt) < Date.parse(a.endsAt);

const withClubTime = (item) => {
 const start = clubParts(item.startsAt), end = clubParts(item.endsAt);
 return { ...item, dateKey: start.dateKey, startHour: start.hour + start.minute / 60, endHour: end.dateKey === start.dateKey ? end.hour + end.minute / 60 : 24 };
};
// Every occupying item on the courts: active or historical bookings, open play, closures.
export function scheduleItems(data) {
 const bookings = data.bookings.filter((booking) => bookingStatuses[booking.status].occupies).map((booking) => ({
  id: booking.reference, sourceId: booking.reference, kind: 'booking', courtId: booking.courtId, startsAt: booking.startsAt, endsAt: booking.endsAt,
  statusKey: booking.status, label: bookingStatuses[booking.status].label, tone: bookingStatuses[booking.status].tone,
  title: customerOf(data, booking)?.name ?? 'Sample customer', reference: booking.reference, simulated: Boolean(booking.simulated),
 }));
 const openPlay = data.openPlay.flatMap((event) => event.courtIds.map((courtId) => ({
  id: `${event.id}:${courtId}`, sourceId: event.id, kind: 'open-play', courtId, startsAt: event.startsAt, endsAt: event.endsAt,
  statusKey: 'open-play', label: 'Open play', tone: 'open-play', title: event.title, reference: event.id, simulated: Boolean(event.simulated), event,
 })));
 const closures = data.closures.map((closure) => ({
  id: closure.id, sourceId: closure.id, kind: 'maintenance', courtId: closure.courtId, startsAt: closure.startsAt, endsAt: closure.endsAt,
  statusKey: 'maintenance', label: 'Maintenance', tone: 'maintenance', title: closure.reason, reference: closure.id, simulated: Boolean(closure.simulated),
 }));
 return [...bookings, ...openPlay, ...closures].map(withClubTime).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.courtId.localeCompare(b.courtId));
}
export const kindLabels = { booking: 'Booking', 'open-play': 'Open play', maintenance: 'Maintenance closure' };

// Occupying items on any of `courtIds` that overlap the candidate interval (half-open).
export function findConflicts({ courtIds, startsAt, endsAt, excludeSourceIds = [] }, items) {
 return items.filter((item) => courtIds.includes(item.courtId) && !excludeSourceIds.includes(item.sourceId) && overlaps(item, { startsAt, endsAt }));
}

export const scheduleFilters = [
 { id: 'all', label: 'All sessions and blocks' },
 { id: 'bookings', label: 'All bookings' },
 { id: 'held', label: 'Unpaid holds' },
 { id: 'pending_verification', label: 'Pending review' },
 { id: 'confirmed', label: 'Confirmed' },
 { id: 'completed', label: 'Completed' },
 { id: 'open-play', label: 'Open play' },
 { id: 'maintenance', label: 'Maintenance' },
];
export function matchesFilter(item, filter = 'all') {
 if (filter === 'all') return true;
 if (filter === 'bookings') return item.kind === 'booking';
 if (filter === 'open-play' || filter === 'maintenance') return item.kind === filter;
 return item.kind === 'booking' && item.statusKey === filter;
}

// One row per court for a day. Free time is merged into ranges; items hidden by the active
// filter stay visible as "hidden by filter" so they are never mistaken for free time.
export function dayGrid(items, dateKey, { courtIds = staffCourts.map((court) => court.id), filter = 'all' } = {}) {
 const { open, close } = staffHours;
 return courtIds.map((courtId) => {
  const courtItems = items.filter((item) => item.courtId === courtId && item.dateKey === dateKey).sort((a, b) => a.startHour - b.startHour);
  const cells = []; let cursor = open, freeHours = 0;
  for (const item of courtItems) {
   const from = Math.max(item.startHour, open), to = Math.min(item.endHour, close);
   if (to <= from) continue;
   if (from > cursor) { cells.push({ type: 'free', from: cursor, to: from }); freeHours += from - cursor; }
   cells.push(matchesFilter(item, filter) ? { type: 'item', item, from, to } : { type: 'hidden', item, from, to });
   cursor = Math.max(cursor, to);
  }
  if (cursor < close) { cells.push({ type: 'free', from: cursor, to: close }); freeHours += close - cursor; }
  return { courtId, cells, freeHours, totalHours: close - open };
 });
}

export function weekGrid(items, dateKey, { courtIds = staffCourts.map((court) => court.id), filter = 'all' } = {}) {
 return weekDays(dateKey).map((day) => ({
  dateKey: day,
  courts: dayGrid(items, day, { courtIds, filter }).map((row) => ({ courtId: row.courtId, freeHours: row.freeHours, items: row.cells.filter((cell) => cell.type === 'item').map((cell) => cell.item), hidden: row.cells.filter((cell) => cell.type === 'hidden').length })),
 }));
}

// Day-level status for the shared CourtMap (its vocabulary: available/reserved/open-play/maintenance).
export function courtDayStatus(row) {
 if (row.freeHours > 0) return 'available';
 const kinds = new Set(row.cells.filter((cell) => cell.type !== 'free').map((cell) => cell.item.kind));
 if (kinds.size === 1 && kinds.has('open-play')) return 'open-play';
 if (kinds.size === 1 && kinds.has('maintenance')) return 'maintenance';
 return 'reserved';
}
export const hourRangeLabel = (from, to) => `${clockLabel(Math.floor(from), Math.round((from % 1) * 60))} – ${clockLabel(Math.floor(to), Math.round((to % 1) * 60))}`;
