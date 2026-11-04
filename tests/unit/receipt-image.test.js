import { describe, it, expect, vi } from 'vitest';
import { detectImageType, validateReceiptCandidate, inspectReceiptFile, errorMessages, HEADER_BYTES } from '../../lib/browser/receipt-image';
import { paymentDemo, paymentStates, paymentStateIds, verifiedRevenueCentavos, unverifiedClaimCentavos, staffPaymentQueue, paymentDemoContext, formatBytes } from '../../lib/demo/payment';

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x28, 0x65, 0, 0, 0x57, 0x45, 0x42, 0x50]);
const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0]);
const sample = { day: '2026-11-07', court: 'court-3', start: '08:00', duration: '120', players: '4' };

// Minimal File stand-in with slice().arrayBuffer() for the header read.
function fakeFile(name, type, bytes, size = bytes.length) {
 return { name, type, size, slice: (start, end) => ({ arrayBuffer: async () => bytes.slice(start, end).buffer }) };
}

describe('receipt image signature detection', () => {
 it('detects PNG, JPEG and WebP from leading bytes only', () => {
  expect(detectImageType(png)).toBe('image/png');
  expect(detectImageType(jpeg)).toBe('image/jpeg');
  expect(detectImageType(webp)).toBe('image/webp');
 });
 it('rejects other or truncated signatures', () => {
  expect(detectImageType(gif)).toBeNull();
  expect(detectImageType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x41, 0x56, 0x49, 0x20]))).toBeNull(); // RIFF but AVI
  expect(detectImageType(png.slice(0, 4))).toBeNull();
  expect(detectImageType(new Uint8Array())).toBeNull();
  expect(detectImageType(undefined)).toBeNull();
  expect(HEADER_BYTES).toBe(12);
 });
});

describe('receipt candidate validation (declared metadata + header)', () => {
 it('accepts valid PNG, JPEG and WebP whose bytes match their declared type', () => {
  expect(validateReceiptCandidate({ name: 'receipt.png', type: 'image/png', size: 1000 }, png)).toMatchObject({ ok: true, mime: 'image/png', label: 'PNG' });
  expect(validateReceiptCandidate({ name: 'receipt.JPG', type: 'image/jpeg', size: 1000 }, jpeg)).toMatchObject({ ok: true, mime: 'image/jpeg', label: 'JPEG' });
  expect(validateReceiptCandidate({ name: 'receipt.webp', type: 'image/webp', size: 1000 }, webp)).toMatchObject({ ok: true, mime: 'image/webp', label: 'WebP' });
 });
 it('reports an empty selection', () => {
  expect(validateReceiptCandidate(undefined, png)).toMatchObject({ ok: false, code: 'empty' });
  expect(validateReceiptCandidate({ name: '', type: '', size: 0 }, png).message).toBe(errorMessages.empty);
 });
 it('rejects unsupported declared types and extensions', () => {
  for (const file of [{ name: 'receipt.gif', type: 'image/gif', size: 10 }, { name: 'receipt.pdf', type: 'application/pdf', size: 10 }, { name: 'receipt', type: '', size: 10 }, { name: 'receipt.svg', type: 'image/svg+xml', size: 10 }]) {
   expect(validateReceiptCandidate(file, png)).toMatchObject({ ok: false, code: 'unsupported_type' });
  }
 });
 it('rejects files over the demo limit, which lives in lib/demo config', () => {
  expect(paymentDemo.image.maxBytes).toBeGreaterThan(0);
  expect(validateReceiptCandidate({ name: 'big.png', type: 'image/png', size: paymentDemo.image.maxBytes + 1 }, png)).toMatchObject({ ok: false, code: 'too_large' });
  expect(validateReceiptCandidate({ name: 'edge.png', type: 'image/png', size: paymentDemo.image.maxBytes }, png).ok).toBe(true);
 });
 it('does not trust the filename or declared type when the bytes disagree', () => {
  expect(validateReceiptCandidate({ name: 'fake.png', type: 'image/png', size: 100 }, gif)).toMatchObject({ ok: false, code: 'signature_mismatch' });
  expect(validateReceiptCandidate({ name: 'fake.png', type: 'image/png', size: 100 }, jpeg)).toMatchObject({ ok: false, code: 'signature_mismatch' });
  expect(validateReceiptCandidate({ name: 'renamed.jpg', type: '', size: 100 }, png)).toMatchObject({ ok: true, mime: 'image/png' }); // no declared type: bytes decide
  expect(validateReceiptCandidate({ name: 'empty.png', type: 'image/png', size: 100 }, new Uint8Array())).toMatchObject({ ok: false, code: 'signature_mismatch' });
 });
});

describe('inspectReceiptFile (browser flow with injected decoder and URL handling)', () => {
 it('creates a preview URL for a decodable image and reports metadata', async () => {
  const createUrl = vi.fn(() => 'blob:demo/1'), revokeUrl = vi.fn(), decode = vi.fn(async () => ({ width: 390, height: 620 }));
  const result = await inspectReceiptFile(fakeFile('receipt.png', 'image/png', png, 52855), { createUrl, revokeUrl, decode });
  expect(result).toMatchObject({ ok: true, url: 'blob:demo/1', mime: 'image/png', label: 'PNG', name: 'receipt.png', size: 52855, sizeLabel: '52 KB', width: 390, height: 620 });
  expect(revokeUrl).not.toHaveBeenCalled();
 });
 it('revokes the temporary URL and reports a corrupted image when decoding fails', async () => {
  const createUrl = vi.fn(() => 'blob:demo/2'), revokeUrl = vi.fn(), decode = vi.fn(async () => { throw new Error('corrupted'); });
  const result = await inspectReceiptFile(fakeFile('broken.jpg', 'image/jpeg', jpeg, 2048), { createUrl, revokeUrl, decode });
  expect(result).toMatchObject({ ok: false, code: 'corrupted', message: errorMessages.corrupted });
  expect(revokeUrl).toHaveBeenCalledWith('blob:demo/2');
 });
 it('treats a zero-size decode as corrupted and never creates a URL for an invalid candidate', async () => {
  const createUrl = vi.fn(() => 'blob:demo/3'), revokeUrl = vi.fn();
  expect(await inspectReceiptFile(fakeFile('zero.webp', 'image/webp', webp, 10), { createUrl, revokeUrl, decode: async () => ({ width: 0, height: 0 }) })).toMatchObject({ ok: false, code: 'corrupted' });
  expect(revokeUrl).toHaveBeenCalledWith('blob:demo/3');
  createUrl.mockClear();
  expect(await inspectReceiptFile(fakeFile('fake.png', 'image/png', gif, 10), { createUrl, revokeUrl })).toMatchObject({ ok: false, code: 'signature_mismatch' });
  expect(createUrl).not.toHaveBeenCalled();
  expect(await inspectReceiptFile(null, { createUrl, revokeUrl })).toMatchObject({ ok: false, code: 'empty' });
 });
});

describe('synthetic payment states and revenue accounting', () => {
 it('defines the five states and marks only the fictional verified state as revenue', () => {
  expect(paymentStateIds).toEqual(['awaiting_evidence', 'pending_review', 'needs_resubmission', 'verified', 'expired']);
  expect(paymentStateIds.filter((id) => paymentStates[id].verifiedRevenue)).toEqual(['verified']);
  expect(paymentStates.verified.label).toMatch(/fictional/i);
  expect(paymentStates.pending_review.label).toBe('Receipt submitted — awaiting staff verification (DEMO)');
  expect(paymentStates.pending_review.customer).toBe('No payment has been verified. No real receipt was uploaded.');
 });
 it('counts zero verified revenue for pending, rejected, awaiting and expired claims', () => {
  const claims = [{ state: 'pending_review', claimedCentavos: 60000 }, { state: 'needs_resubmission', claimedCentavos: 120000 }, { state: 'awaiting_evidence', claimedCentavos: 60000 }, { state: 'expired', claimedCentavos: 60000 }];
  expect(verifiedRevenueCentavos(claims)).toBe(0);
  expect(unverifiedClaimCentavos(claims)).toBe(180000);
  expect(verifiedRevenueCentavos([...claims, { state: 'verified', claimedCentavos: 60000 }])).toBe(60000);
  expect(verifiedRevenueCentavos([{ state: 'nonsense', claimedCentavos: 999 }])).toBe(0);
 });
 it('ships a synthetic staff queue covering every scenario with sample images only', () => {
  expect(staffPaymentQueue.map((item) => item.state)).toEqual(['awaiting_evidence', 'pending_review', 'needs_resubmission', 'verified', 'expired']);
  for (const item of staffPaymentQueue) {
   expect(item.customer).toMatch(/^Sample Customer [A-E]$/);
   expect(item.transactionRef).toMatch(/^SAMPLE-/);
   if (item.image) expect(item.image.src).toMatch(/^\/images\/receipts\/sample-/);
   expect(item.image ? item.submittedAt : null).toBe(item.submittedAt);
  }
  expect(verifiedRevenueCentavos(staffPaymentQueue)).toBe(60000);
 });
});

describe('payment demo context', () => {
 it('derives the context from a valid sample link and defaults to the held scenario', () => {
  const context = paymentDemoContext(sample);
  expect(context.initialState).toBe('awaiting_evidence');
  expect(context.receipt.totalCentavos).toBe(120000);
  expect(context.current.status).toBe('held');
 });
 it('supports the expired scenario and rejects unknown or malformed scenarios and links', () => {
  expect(paymentDemoContext({ ...sample, scenario: 'expired' })).toMatchObject({ initialState: 'expired', current: { status: 'expired' } });
  for (const bad of [{ ...sample, scenario: 'verified' }, { ...sample, scenario: ['held'] }, { ...sample, scenario: '' }, { ...sample, duration: '0120' }, { ...sample, start: '12:00' }, { day: 'x' }]) expect(paymentDemoContext(bad)).toBeNull();
 });
 it('keeps the frozen receipt total separate from the review state', () => {
  const held = paymentDemoContext(sample), expired = paymentDemoContext({ ...sample, scenario: 'expired' });
  expect(expired.receipt).toEqual(held.receipt);
 });
 it('formats sizes for humans', () => {
  expect(formatBytes(512)).toBe('512 B');
  expect(formatBytes(4 * 1024 * 1024)).toBe('4.0 MB');
  expect(formatBytes(-1)).toBe('');
 });
});
