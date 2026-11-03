import { guestBookingConfiguration, guestCapability, guestQuote } from '@/lib/server/guest-reservations';
import { guestJson, guestFailure, readGuestJson } from '@/lib/server/guest-http';
import { trustedGuestRequest } from '@/lib/server/guest-security';
import { normalizeGuestQuote } from '@/lib/domain/guest-reservation';
export const runtime = 'nodejs';
export async function POST(request) {
  try {
    const config = guestBookingConfiguration();
    if (!trustedGuestRequest(request, config)) throw new Error('GUEST_ACCESS_REQUIRED');
    const input = normalizeGuestQuote(await readGuestJson(request)); if (!input) throw new Error('INVALID_REQUEST');
    const cap = guestCapability(request, config, input.intentId); if (!cap) throw new Error('GUEST_ACCESS_REQUIRED');
    return guestJson(await guestQuote(config, cap, input), 201);
  } catch (error) { return guestFailure(error); }
}
