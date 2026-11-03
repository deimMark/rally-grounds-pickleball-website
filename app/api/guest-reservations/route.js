import { guestBookingConfiguration, guestCapability, guestReserve } from '@/lib/server/guest-reservations';
import { guestJson, guestFailure, readGuestJson } from '@/lib/server/guest-http';
import { trustedGuestRequest } from '@/lib/server/guest-security';
import { isGuestUuid, normalizeGuestReservation } from '@/lib/domain/guest-reservation';
export const runtime = 'nodejs';
export async function POST(request) {
  try {
    const config = guestBookingConfiguration();
    if (!trustedGuestRequest(request, config)) throw new Error('GUEST_ACCESS_REQUIRED');
    const input = normalizeGuestReservation(await readGuestJson(request)); const key = request.headers.get('idempotency-key');
    if (!input || !isGuestUuid(key)) throw new Error('INVALID_REQUEST');
    const cap = guestCapability(request, config, input.intentId); if (!cap) throw new Error('GUEST_ACCESS_REQUIRED');
    const result = await guestReserve(config, cap, input, key);
    return guestJson(result, result.replayed ? 200 : 201);
  } catch (error) { return guestFailure(error); }
}
