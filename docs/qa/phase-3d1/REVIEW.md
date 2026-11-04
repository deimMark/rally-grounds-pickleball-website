# Phase 3D.1 customer booking interface — local QA

Branch: `phase-3d1-booking-interface` (local only, not published).
Base: approved owner-demo `6146af81c6cdf6a501260b39dbc9ebfe6d0a64af`.
No backend implementation was merged or copied. No push, deployment or production access.

## Result and scope

Ready for human review as a **synthetic interface demonstration only**. The journey
covers date/duration, five-court availability, details, price, confirmation and status
scenarios. It does not create real bookings or provide real private authorization.

New routes: `/book`, `/booking/confirmation`, `/booking/status`. Existing `/`, `/staff`
and not-found behavior remain. New UI/fixture components are separate from server data
connections. CourtMap is the shared extraction of the approved geometry/markings; the
homepage selector retains its interactions, IDs and original session-preview behavior.

Booking details use selectable synthetic profiles with reserved `example.invalid` emails;
identity/contact inputs are read-only. No personal data is accepted, transmitted or
persisted. Only nonsensitive public sample selection values are passed in navigation URLs.
No API client, Supabase query, capability token, payment action, worker or scheduler is
added. The status page is clearly labeled public design content, not protected live data.

## Recovery and independent verification (2026-11-04)

The original implementation was produced in another environment and never published.
Its 22 files were recovered here as a SHA-256-verified patch on owner-demo `6146af8`
(7 modified, 15 new); the eight screenshots were not transferred. The recovered files were
inspected in full and re-verified independently on macOS with Node 24.19.0 (`.nvmrc`)
and Playwright's pinned Chromium.

| Check | Result |
| --- | --- |
| ESLint | Passed, 0 errors |
| Vitest | 27 passed, 0 failed, 0 skipped; 3 files |
| Playwright (Chromium) | 46 passed, 0 failed, 0 skipped; also 138/138 across 3 repeated runs |
| Next.js production build | Passed; routes `/`, `/book`, `/booking/confirmation`, `/booking/status`, `/staff`, not-found |
| Credential-pattern scan | 0 matches in all changed files and in compiled `.next/static` client assets |
| Client bundle | No `NEXT_PUBLIC_*` values or server credentials; only the synthetic `example.invalid` fixtures |
| `npm audit` (runtime deps, `--omit=dev`) | 0 vulnerabilities |
| `npm audit` (all deps) | 16 moderate, all in ESLint dev tooling (`minimatch` via `eslint-config-next` plugins); not shipped; no dependency changed |
| Owner-demo | Unchanged at `6146af8`, local and remote |

### Browser test timing correction

On first independent run, 5 of 46 tests failed: the homepage `court-geometry` checks at
320/390/768/1024/1440px. The identical failures reproduced on an untouched owner-demo
export, so they were pre-existing, not caused by this work. Cause: `/` streams through
`app/(public)/loading.js`, so the content first arrives in a hidden Suspense container and
React reveals it shortly after load. The test measured `.court-map` before the reveal and
read a 0×0 box. The rendered geometry itself was correct when measured after reveal.

Once fixed, the same race surfaced in `foundation.spec.js` (“draft contact … interactive
targets”), failing 5 of 6 repeats on the untouched baseline (`boundingBox()` was `null`).
Correction, in tests only: wait until the map/section is visible and has a non-zero layout
box before measuring. The same wait was added to the homepage keyboard test, the
`foundation` layout-preservation test and the `/book` width test (also served through
a `loading.js`). No assertion, tolerance, retry count or test was removed or relaxed.

### Historical results reported by the original implementation

Reported in the original environment (Linux, system Chromium) and not independently
reproduced as-is: 27 unit tests and 46 browser tests passing, credential scans of 77 source
text files and 18 browser artifacts with zero matches. The race above was present there
too but did not trigger, probably due to timing differences.

## Screenshots

Regenerated 2026-11-04 from this code against a local production build (`next start`),
at 1440px desktop and 390px mobile. Each page was captured after its heading was visible
and fonts had loaded, with the viewport set to the full document height (this avoids a
full-page-capture artifact that showed the off-screen skip link over the form). Checked:
synthetic data only, no credentials or private information, no text metadata in the
PNG files, no clipping or horizontal overflow, demo labels present on every screen.

- [Desktop booking](booking-desktop.png)
- [390px booking](booking-mobile-390.png)
- [390px details](details-mobile-390.png)
- [390px confirmation](confirmation-mobile-390.png)
- [390px status](status-mobile-390.png)
- [Desktop status](status-desktop.png)
- [390px expired scenario](review-expired-mobile-390.png)
- [390px reference-only unavailable access](review-unavailable-mobile-390.png)

Scans cover recognizable private key/token/credential formats in changed text files and
compiled browser artifacts. They do not read ignored secret files or prove every possible
secret encoding.

## Remaining limitations and next review

Only three fixed sample days and example durations/player counts are supported. All prices,
operating hours, availability and deadlines are presentation fixtures, not owner-approved
policy or a live quote. Status changes are explicit design controls, not autonomous expiry.
No server conflict handling, real guest contact collection, capability cookies, idempotency,
private retrieval/recovery, live payment, refunds, uploads or messaging is implemented.
Integration/error states must later use the Phase 3B server contracts; see PHASE-3D1.md.
Sample links accept zero-padded numbers (for example `duration=0120`); harmless for
fixtures, and a candidate for Phase 3D.2 tightening. H2 is still an unresolved, separate
backend publication/launch blocker.

Official approved logo is still missing; existing text branding remains unchanged. Draft
club contact details, provisional hours and licensed illustrative photo remain labeled.
No stock image is represented as the actual facility.

Publication safeguards still unverified: the remote Vercel project's handling of the
`vercel.json` branch exclusion, and GitHub Actions results for the eventual published
commit. Recommendation: review the screens and approve the demo UX separately from backend
security/integration. No public booking, merge, publication or deployment approval implied.
