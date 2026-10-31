import 'server-only';
import { requireStaff } from '@/lib/server/staff-auth';
// No anonymous mutation endpoint is provided. PostgreSQL revalidates every input,
// current role, price and occupancy inside the transaction, even for direct RPC use.
async function staffOperation(name, parameters) {
  const { client } = await requireStaff();
  const { data, error } = await client.rpc(name, parameters);
  if (error) {
    const failure = new Error(error.code === '23P01' ? 'The requested court is occupied' : 'Reservation operation could not be completed');
    failure.code = error.code === '23P01' ? 'CONFLICT' : error.code === '42501' ? 'FORBIDDEN' : 'INVALID_OPERATION';
    throw failure;
  }
  return data;
}
export function quoteReservation({ courtId, startsAt, endsAt }) {
  return staffOperation('quote_reservation', { p_court_id: courtId, p_start: startsAt, p_end: endsAt });
}
export function createReservation({ courtId, startsAt, endsAt, estimatedPlayers, source, requestKey, agreedTotalCentavos, holdUntil }) {
  return staffOperation('create_reservation', { p_court_id: courtId, p_start: startsAt, p_end: endsAt, p_players: estimatedPlayers, p_source: source, p_request_key: requestKey, p_expected_total: agreedTotalCentavos, p_hold_until: holdUntil });
}
export function releaseReservation(bookingId) {
  return staffOperation('release_reservation', { p_booking_id: bookingId });
}
export function blockCourts({ courtIds, startsAt, endsAt, kind, requestKey }) {
  return staffOperation('block_courts', { p_court_ids: courtIds, p_start: startsAt, p_end: endsAt, p_kind: kind, p_request_key: requestKey });
}
