import { NextResponse } from 'next/server';
import { admitGuestIntent } from '@/lib/server/guest-intent';
import { guestConfiguration, newGuestCapability, guestCookieName, guestCookieOptions, trustedGuestRequest, emptyGuestBody, intentCookieCount } from '@/lib/server/guest-security';
export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };
function failure(code, status, extra = {}) { return NextResponse.json({ error: code }, { status, headers: { ...headers, ...extra } }); }
export async function POST(request) {
  let config;
  try { config = guestConfiguration(); } catch { return failure('POLICY_NOT_READY', 503); }
  if (!trustedGuestRequest(request, config)) return failure('GUEST_ACCESS_REQUIRED', 403);
  if ((request.headers.get('cookie') || '').length > 8192 || !await emptyGuestBody(request)) return failure('INVALID_REQUEST', 400);
  try {
    const capability = newGuestCapability();
    const result = await admitGuestIntent(config, capability, intentCookieCount(request.cookies.getAll()));
    if (result.outcome === 'policy_not_ready') return failure('POLICY_NOT_READY', 503);
    if (result.outcome === 'rate_limited') return failure('RATE_LIMITED', 429, { 'Retry-After': String(result.retryAfterSeconds) });
    if (result.outcome !== 'created') return failure('TEMPORARILY_UNAVAILABLE', 503);
    const response = NextResponse.json({ intentId: result.intentId, createExpiresAt: result.createExpiresAt, accessExpiresAt: result.accessExpiresAt }, { status: 201, headers });
    response.cookies.set(guestCookieName(capability.id, config.secure), capability.credential, guestCookieOptions(config.secure, result.accessExpiresAt));
    return response;
  } catch { return failure('TEMPORARILY_UNAVAILABLE', 503); } // Never serialize SDK errors, inputs, keys or capabilities.
}
