# Phase 4A receipt-image demonstration — local QA

Branch: `phase-4a-receipt-demo` (local only, not published).
Base: Phase 3D.2 `af6ce955a0cf483c1b2acecadc6a9239d5a62f90`.
Date: 2026-11-04. Environment: Linux cloud container, Node 24.19.0 (`.nvmrc`), pinned
Playwright Chromium, production build served by `next start`.

## Result

**PASS (local acceptance).** All gates below passed; no high or critical findings.
Publication, merge and deployment are not approved by this document.

| Check | Result |
| --- | --- |
| ESLint | Passed, 0 errors, 0 warnings |
| Vitest | **50 passed**, 0 failed, 0 skipped; 4 files (33 existing + 17 new) |
| Playwright (Chromium) | **77 passed**, 0 failed, 0 skipped (62 existing + 15 new); full suite repeated: 77/77, 77/77 |
| Next.js production build | Passed; new routes `ƒ /booking/payment-demo`, `○ /staff/payments-demo`; existing routes unchanged |
| Credential scan (changed text files) | 0 matches (private keys, JWT-shaped tokens, Supabase/service-role, DB URIs, GitHub/AWS/Stripe key formats, `password=`, local paths, session ids) |
| Phone/account-number-like scan (changed text files, rendered pages) | 0 matches |
| Client bundle scan (`.next/static`) | 0 matches for `service_role`, `SUPABASE_*`, `NEXT_PUBLIC_*`, JWT, private key or DB URI patterns |
| Network/storage/env in payment code | None: no `fetch`, `FormData`, `XMLHttpRequest`, Supabase, `/api/`, cookies, Web Storage, IndexedDB or `process.env` |
| Sample images | 3 generated files (PNG/JPEG/WebP), `SAMPLE / NOT A REAL PAYMENT` mark, fictional values, no tEXt/EXIF metadata |
| Tracked `.env*` | Only `.env.example` |
| Mobile layout 320/360/390/768/1440 px | No horizontal overflow on the payment page (empty, preview and error states), the expired scenario, the unavailable state and the staff review page |
| Keyboard-only workflow (390 px) | Tab/Arrow/Enter only: method radios → file input → Remove → Submit → focused heading → Start over; a visible outline asserted at every stop |
| Accessible errors | One `role="alert"` in `main`, `aria-invalid="true"`, `aria-describedby` includes the error id, focus returned to the input for unsupported, mismatched, corrupted, oversized and empty selections |
| Automated accessibility (axe, WCAG 2.0/2.1/2.2 A+AA) | Zero serious/critical violations on every route/state tested and on all 12 screenshots |
| No real upload / mutation | Zero non-GET/HEAD requests, zero payment/API calls, no cookies, empty Web Storage/IndexedDB/CacheStorage after a submission; reload resets to "Awaiting evidence" |
| Verified revenue | Pending, rejected, awaiting and expired claims contribute ₱0 (unit + browser); the fictional verified scenario is labelled as such |
| Expired booking | Submission impossible in the expired scenario; copy states evidence does not revive a hold |
| Existing booking UI and court geometry | Phase 3D.2 suite unchanged and passing; geometry re-asserted on `/book`; staff overview intact |
| owner-demo / 3D.1 / 3D.2 | Unchanged, local and remote |

## Test-design notes (no existing assertion changed)

- No existing test was modified, skipped or deleted. The staff sidebar now uses a route-aware
  `StaffNav` component; existing `/staff` tests continue to pass unchanged.
- The keyboard test uses `setInputFiles` for the file chooser itself (a native OS dialog cannot
  be scripted) and keyboard for everything else.
- During development two test-side mistakes were corrected: a request filter that matched the
  sample image filename (`sample-gcash-receipt.png`) as if it were a GCash API call, and a
  focus assertion that ran before React re-enabled the input. The second exposed a real
  product timing bug (focus requested while the input was still `disabled`), fixed by moving
  focus from an effect once the error is rendered.

## Screenshots (synthetic data only)

Captured by `scripts/capture-phase-4a.mjs` at 390 px mobile and 1440 px desktop, full
document height, after fonts loaded; each capture ran axe and overflow/phone-number checks
(see `capture-metadata.json`).

1. [Mobile payment instructions](01-payment-instructions-mobile-390.png)
2. [GCash method selected](02-gcash-selected-mobile-390.png)
3. [Bank transfer method selected](03-bank-transfer-selected-mobile-390.png)
4. [Receipt image selected and previewed](04-receipt-selected-preview-mobile-390.png)
5. [Receipt validation error (PDF rejected, focus on input)](05-receipt-validation-error-mobile-390.png)
6. [Synthetic pending-review confirmation](06-pending-review-confirmation-mobile-390.png)
7. [Staff receipt-review queue, desktop](07-staff-receipt-queue-desktop.png)
8. [Staff receipt detail, mobile](08-staff-receipt-detail-mobile-390.png)
9. [Rejected scenario](09-staff-rejected-scenario-mobile-390.png)
10. [Synthetic verified scenario, desktop](10-staff-verified-fictional-scenario-desktop.png)
11. [Desktop payment page with preview](11-payment-page-desktop.png)
12. [Expired scenario (extra)](12-expired-scenario-mobile-390.png)

## Known limitations

- Demonstration only: nothing is stored, reviewed or verified; the "verified" state is a
  fictional scenario and verified revenue figures are demo figures.
- Image checks are browser-side demo validation (signature, size, decode). They are not a
  substitute for the server-side decode/re-encode, metadata stripping and private Storage
  controls required before any real upload exists.
- Recipient details, deadlines, fees, partial payments, resubmission windows, retention and
  notifications remain undecided owner policy and are deliberately absent.
- Automated axe checks are not an exhaustive assistive-technology audit; the native file
  chooser's own accessibility is the browser's.
- Remote Vercel behaviour for the `vercel.json` exclusions and CI on a published commit are
  not verifiable from this environment.
