import 'server-only';
import { NextResponse } from 'next/server';
export const guestHeaders = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };
export function guestJson(value, status = 200) { return NextResponse.json(value, { status, headers: guestHeaders }); }
export function guestFailure(error, privateRead = false) {
  const code = error?.message;
  const statuses = { INVALID_REQUEST: 400, DURATION_UNSUPPORTED: 400, GUEST_ACCESS_REQUIRED: 403, ACCESS_UNAVAILABLE: 404,
    SLOT_UNAVAILABLE: 409, REQUEST_MISMATCH: 409, INTENT_ALREADY_BOUND: 409, QUOTE_REVIEW_REQUIRED: 409,
    INTENT_EXPIRED: 410, RATE_LIMITED: 429, POLICY_NOT_READY: 503, TEMPORARILY_UNAVAILABLE: 503 };
  const safe = statuses[code] ? code : 'TEMPORARILY_UNAVAILABLE';
  if (privateRead && ['GUEST_ACCESS_REQUIRED', 'INVALID_REQUEST', 'ACCESS_UNAVAILABLE'].includes(safe)) return guestJson({ error: 'ACCESS_UNAVAILABLE' }, 404);
  return NextResponse.json({ error: safe }, { status: statuses[safe], headers: { ...guestHeaders, ...(safe === 'RATE_LIMITED' ? (Number.isInteger(error.retryAfter) && error.retryAfter > 0 ? { 'Retry-After': String(error.retryAfter) } : {}) : {}) } });
}
export async function readGuestJson(request) {
  if (new URL(request.url).search || (request.headers.get('cookie') || '').length > 8192
    || !/^application\/json(?:;\s*charset=utf-8)?$/i.test(request.headers.get('content-type') || '')
    || !['', 'identity'].includes(request.headers.get('content-encoding') || '')) throw new Error('INVALID_REQUEST');
  const length = request.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > 2048)) throw new Error('INVALID_REQUEST');
  const reader = request.body?.getReader(); if (!reader) throw new Error('INVALID_REQUEST');
  let size = 0; const chunks = [];
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length; if (size > 2048) { await reader.cancel(); throw new Error('INVALID_REQUEST'); } chunks.push(value);
    }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
  } catch { throw new Error('INVALID_REQUEST'); }
}
