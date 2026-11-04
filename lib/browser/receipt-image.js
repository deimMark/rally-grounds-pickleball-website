// Browser-only receipt image checks for the Phase 4A demonstration. Everything stays in
// memory: no upload, no storage, no logging of file contents. Pure helpers are exported
// separately so they can be unit-tested without a DOM.
import { paymentDemo, acceptedMimeTypes, formatBytes } from '../demo/payment';

const signatures = [
 { mime: 'image/png', test: (b) => b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a },
 { mime: 'image/jpeg', test: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
 { mime: 'image/webp', test: (b) => b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 },
];
export const HEADER_BYTES = 12;

// Detects the real image type from leading bytes, ignoring the filename and declared MIME type.
export function detectImageType(bytes) {
 const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes ?? []);
 return signatures.find((signature) => signature.test(b))?.mime ?? null;
}

export const errorMessages = {
 empty: 'Choose a receipt image first. No file is selected.',
 unsupported_type: 'That file type is not supported. Choose a PNG, JPEG or WebP image of your receipt.',
 too_large: `That image is larger than the demo limit of ${formatBytes(paymentDemo.image.maxBytes)}. Choose a smaller screenshot.`,
 signature_mismatch: 'That file does not look like a real PNG, JPEG or WebP image, even though its name suggests one. Choose the actual screenshot file.',
 corrupted: 'That image could not be opened. It may be damaged or incomplete. Choose another screenshot.',
};

// Pure validation of a file's declared metadata plus its leading bytes. Order matters: an
// empty selection, then type, then size, then signature. Decoding is a separate async step.
export function validateReceiptCandidate({ name = '', type = '', size = 0 } = {}, headerBytes, config = paymentDemo.image) {
 if (!name && !size) return { ok: false, code: 'empty', message: errorMessages.empty };
 const extension = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
 const declared = acceptedMimeTypes.includes(type) ? type : null;
 const byExtension = config.accepted.find((entry) => entry.extensions.includes(extension))?.mime ?? null;
 if (!declared && !byExtension) return { ok: false, code: 'unsupported_type', message: errorMessages.unsupported_type };
 if (size > config.maxBytes) return { ok: false, code: 'too_large', message: errorMessages.too_large };
 const detected = detectImageType(headerBytes);
 if (!detected) return { ok: false, code: 'signature_mismatch', message: errorMessages.signature_mismatch };
 if (declared && detected !== declared) return { ok: false, code: 'signature_mismatch', message: errorMessages.signature_mismatch };
 return { ok: true, mime: detected, label: config.accepted.find((entry) => entry.mime === detected).label };
}

export async function readHeaderBytes(file) {
 const buffer = await file.slice(0, HEADER_BYTES).arrayBuffer();
 return new Uint8Array(buffer);
}

// Decodes through an <img> so a truncated or non-image payload is rejected. Returns size only.
export function decodeImageUrl(url) {
 return new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
  image.onerror = () => reject(new Error('corrupted'));
  image.src = url;
 });
}

// Full browser check. `createUrl`/`revokeUrl`/`decode` are injectable for tests.
export async function inspectReceiptFile(file, { createUrl = (f) => URL.createObjectURL(f), revokeUrl = (u) => URL.revokeObjectURL(u), decode = decodeImageUrl } = {}) {
 if (!file) return { ok: false, code: 'empty', message: errorMessages.empty };
 const header = await readHeaderBytes(file);
 const candidate = validateReceiptCandidate(file, header);
 if (!candidate.ok) return candidate;
 const url = createUrl(file);
 try {
  const dimensions = await decode(url);
  if (!dimensions.width || !dimensions.height) throw new Error('corrupted');
  return { ok: true, url, mime: candidate.mime, label: candidate.label, name: file.name, size: file.size, sizeLabel: formatBytes(file.size), ...dimensions };
 } catch {
  revokeUrl(url);
  return { ok: false, code: 'corrupted', message: errorMessages.corrupted };
 }
}
