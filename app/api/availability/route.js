import { guestBookingConfiguration, guestAvailability } from '@/lib/server/guest-reservations';
import { guestJson, guestFailure } from '@/lib/server/guest-http';
import { validateClubDay } from '@/lib/domain/availability';
export const runtime = 'nodejs';
export async function GET(request) {
  try {
    const config = guestBookingConfiguration();
    const query = new URL(request.url).searchParams;
    if (query.size !== 2 || !query.has('day') || !/^\d{1,4}$/.test(query.get('durationMinutes') || '')) throw new Error('INVALID_REQUEST');
    let day; try { day = validateClubDay(query.get('day')); } catch { throw new Error('INVALID_REQUEST'); }
    return guestJson(await guestAvailability(config, day, Number(query.get('durationMinutes'))));
  } catch (error) { return guestFailure(error); }
}
