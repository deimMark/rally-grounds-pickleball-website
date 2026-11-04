import { demoSelection, demoReceipt, formatManila, canonicalInteger } from './booking';
// Phase 4A presentation fixtures. Nothing here is a payment rule, a recipient or a ledger.
// Every reference, name, amount, timestamp and outcome is synthetic.

export const paymentDemo = {
 methods: [
  { id: 'gcash', label: 'GCash', app: 'the GCash app', steps: ['Open the GCash app and choose Send Money.', 'Enter the club recipient details shown by staff (not shown in this demo).', 'Send the exact sample total and keep the receipt screen.', 'Save a screenshot of the receipt, then submit it here for staff review.'] },
  { id: 'bank', label: 'Bank transfer', app: 'your banking app', steps: ['Open your banking app and choose Transfer to another bank.', 'Enter the club account details shown by staff (not shown in this demo).', 'Transfer the exact sample total and keep the confirmation screen.', 'Save a screenshot or the downloaded confirmation image, then submit it here for staff review.'] },
 ],
 recipient: { badge: 'DEMO ONLY — NO REAL TRANSFER', name: 'Rally Grounds (sample recipient)', note: 'No account number, mobile number or QR code is shown in this demonstration. Real recipient details will only ever be shown by the club after owner approval.' },
 // Provisional demo limits for the browser-only picker; not a product policy.
 image: {
  maxBytes: 4 * 1024 * 1024,
  accepted: [
   { mime: 'image/png', label: 'PNG', extensions: ['png'] },
   { mime: 'image/jpeg', label: 'JPEG', extensions: ['jpg', 'jpeg'] },
   { mime: 'image/webp', label: 'WebP', extensions: ['webp'] },
  ],
 },
 scenarios: ['held', 'expired'],
 // Evidence-submission sample timestamps (UTC instants rendered in Asia/Manila).
 submittedAt: '2026-11-03T00:40:00.000Z',
};
export const acceptedMimeTypes = paymentDemo.image.accepted.map((type) => type.mime);
export const acceptedExtensions = paymentDemo.image.accepted.flatMap((type) => type.extensions);

// Synthetic payment states. `verified` is always a fictional scenario in Phase 4A.
export const paymentStates = {
 awaiting_evidence: { label: 'Awaiting evidence', tone: 'neutral', verifiedRevenue: false, customer: 'No receipt has been submitted for this sample booking.', staff: 'No evidence yet. Nothing to review.' },
 pending_review: { label: 'Receipt submitted — awaiting staff verification (DEMO)', shortLabel: 'Pending review', tone: 'pending', verifiedRevenue: false, customer: 'No payment has been verified. No real receipt was uploaded.', staff: 'A receipt image was submitted. It is a claim, not proof of funds. Compare it with the club’s actual GCash or bank records before deciding.' },
 needs_resubmission: { label: 'Receipt rejected — resubmission needed (DEMO)', shortLabel: 'Needs resubmission', tone: 'rejected', verifiedRevenue: false, customer: 'The sample receipt could not be matched to an incoming transaction. In the real product the customer would be asked to submit a clearer or correct receipt.', staff: 'Rejected in this sample. A rejected receipt contributes nothing to verified revenue and does not release or extend the hold by itself.' },
 verified: { label: 'Payment verified — fictional scenario (DEMO)', shortLabel: 'Verified (fictional)', tone: 'verified', verifiedRevenue: true, customer: 'This is a fictional outcome. In the real product it would only appear after staff matched an actual incoming transaction.', staff: 'Fictional example only. Real verification requires a matching recipient, the actual received amount, settlement details and transaction reference from the club’s own records.' },
 expired: { label: 'Booking expired — evidence cannot be submitted (DEMO)', shortLabel: 'Expired', tone: 'expired', verifiedRevenue: false, customer: 'The sample hold expired before any receipt was verified. Submitting evidence now would not revive it.', staff: 'Expired sample. Evidence received after expiry must not revive the reservation.' },
};
export const paymentStateIds = Object.keys(paymentStates);

// Only fictional `verified` claims count; pending/rejected/expired/awaiting contribute zero.
export function verifiedRevenueCentavos(claims) {
 return claims.filter((claim) => paymentStates[claim.state]?.verifiedRevenue).reduce((sum, claim) => sum + claim.claimedCentavos, 0);
}
export function unverifiedClaimCentavos(claims) {
 return claims.filter((claim) => ['pending_review', 'needs_resubmission'].includes(claim.state)).reduce((sum, claim) => sum + claim.claimedCentavos, 0);
}

export function formatBytes(bytes) {
 if (!Number.isFinite(bytes) || bytes < 0) return '';
 if (bytes < 1024) return `${bytes} B`;
 if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`;
 return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Builds the customer payment-demo context from the same nonsensitive sample link as the
// confirmation page, plus an optional whitelisted `scenario`. Anything else → null.
export function paymentDemoContext(params) {
 const selection = demoSelection(params);
 if (!selection) return null;
 const scenario = params.scenario === undefined ? 'held' : params.scenario;
 if (typeof scenario !== 'string' || !paymentDemo.scenarios.includes(scenario)) return null;
 const { receipt, current } = demoReceipt(selection, scenario);
 return { selection, receipt, current, scenario, initialState: scenario === 'expired' ? 'expired' : 'awaiting_evidence' };
}
export { formatManila, canonicalInteger };

// Synthetic staff review queue. Names are obviously fictional; references are sample UUID-like
// values from the booking fixtures; images are the committed sample receipts.
export const staffPaymentQueue = [
 { id: 'queue-1', reference: '00000000-0000-4000-8000-000000000301', customer: 'Sample Customer A', court: 3, session: 'Sat, 7 Nov 2026 · 8:00 AM – 10:00 AM', method: 'gcash', claimedCentavos: 120000, agreedCentavos: 120000, transactionRef: 'SAMPLE-GC-0001', submittedAt: null, image: null, state: 'awaiting_evidence' },
 { id: 'queue-2', reference: '00000000-0000-4000-8000-000000000302', customer: 'Sample Customer B', court: 4, session: 'Sat, 7 Nov 2026 · 9:00 AM – 10:00 AM', method: 'gcash', claimedCentavos: 60000, agreedCentavos: 60000, transactionRef: 'SAMPLE-GC-0002', submittedAt: '2026-11-03T00:40:00.000Z', image: { src: '/images/receipts/sample-gcash-receipt.png', alt: 'Sample GCash receipt image marked SAMPLE, NOT A REAL PAYMENT, showing a fictional ₱600 transfer' }, state: 'pending_review' },
 { id: 'queue-3', reference: '00000000-0000-4000-8000-000000000303', customer: 'Sample Customer C', court: 2, session: 'Sun, 8 Nov 2026 · 1:00 PM – 3:00 PM', method: 'bank', claimedCentavos: 120000, agreedCentavos: 120000, transactionRef: 'SAMPLE-BK-0003', submittedAt: '2026-11-03T01:05:00.000Z', image: { src: '/images/receipts/sample-bank-receipt.jpg', alt: 'Sample bank transfer confirmation image marked SAMPLE, NOT A REAL PAYMENT, showing a fictional ₱1,200 transfer' }, state: 'needs_resubmission' },
 { id: 'queue-4', reference: '00000000-0000-4000-8000-000000000304', customer: 'Sample Customer D', court: 1, session: 'Mon, 9 Nov 2026 · 5:00 PM – 6:00 PM', method: 'gcash', claimedCentavos: 60000, agreedCentavos: 60000, transactionRef: 'SAMPLE-GC-0004', submittedAt: '2026-11-03T01:20:00.000Z', image: { src: '/images/receipts/sample-receipt.webp', alt: 'Sample receipt image marked SAMPLE, NOT A REAL PAYMENT, showing a fictional ₱600 transfer' }, state: 'verified' },
 { id: 'queue-5', reference: '00000000-0000-4000-8000-000000000305', customer: 'Sample Customer E', court: 5, session: 'Sun, 8 Nov 2026 · 10:00 AM – 11:00 AM', method: 'bank', claimedCentavos: 60000, agreedCentavos: 60000, transactionRef: 'SAMPLE-BK-0005', submittedAt: null, image: null, state: 'expired' },
];
export const methodLabel = (id) => paymentDemo.methods.find((method) => method.id === id)?.label ?? id;
