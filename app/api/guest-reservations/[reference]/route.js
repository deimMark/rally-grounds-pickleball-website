import { guestBookingConfiguration, guestCapability, guestStatus } from '@/lib/server/guest-reservations';
import { guestJson, guestFailure } from '@/lib/server/guest-http';
import { trustedGuestRead } from '@/lib/server/guest-security';
import { isGuestUuid } from '@/lib/domain/guest-reservation';
export const runtime = 'nodejs';
export async function GET(request, { params }) {
  try {
    const config = guestBookingConfiguration();
    if (!trustedGuestRead(request, config) || new URL(request.url).search) throw new Error('ACCESS_UNAVAILABLE');
    const { reference } = await params;
    const intentId = request.headers.get('x-guest-intent'); // Nonsecret selector, never bearer authority.
    if (!isGuestUuid(reference)) throw new Error('ACCESS_UNAVAILABLE');
    const cap = guestCapability(request, config, intentId); if (!cap) throw new Error('ACCESS_UNAVAILABLE');
    return guestJson(await guestStatus(config, cap, intentId, reference));
  } catch (error) { return guestFailure(error, true); }
}
