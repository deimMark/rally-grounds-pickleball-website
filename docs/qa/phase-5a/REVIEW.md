# Phase 5A staff operations dashboard (with Reclub open-play addendum) — local QA

Branch: `phase-5a-staff-demo` (local only, not published).
Base: Phase 4A `563eb8b3893ed2b5a882c0f882562775502cff91`.
Date: 2026-11-07. Environment: Linux cloud container, Node 24.19.0 (`.nvmrc`), pinned Playwright
Chromium, production build served by `next start`.

## Result

**PASS WITH CONDITIONS (local acceptance).** Every gate passed on the final tree. The condition
is one intermittent failure of an unchanged Phase 3D.2 test, observed once and not reproduced
(see "Intermittent failure"). Publication, merge and deployment are not approved by this document.

| Check | Result |
| --- | --- |
| ESLint | Passed, 0 errors, 0 warnings |
| Vitest | **110 passed**, 0 failed, 0 skipped; 6 files (50 existing + 24 staff + 36 Reclub) |
| Playwright (Chromium) | **95 tests** (77 existing + 18 new). Final-tree full runs: 95/95, 94/95 (see below), 95/95, 95/95 |
| Stress | 152/152: Phase 5A spec + 3D.2 keyboard test, 8 repeats, 4 workers; 3D.2 keyboard test 20/20 isolated |
| Production build | Passed; new static routes `/staff/schedule`, `/staff/customers`, `/staff/maintenance`, `/staff/open-play`, `/staff/requests`; dynamic `/staff/bookings` (reads `?ref`) |
| Credential scan (changed text files) | 0 matches (private keys, JWT-like tokens, service-role/Supabase secrets, DB URIs with credentials, GitHub/AWS/Stripe formats, `password=`, local paths, session ids) |
| Phone / non-synthetic email scan | 0 matches; only `@example.invalid` addresses |
| URLs in staff code and fixtures | None except the Reclub input placeholder `https://reclub.co/…`; every open-play fixture has `reclubUrl: null` |
| Client bundle (`.next/static`) | 0 matches for secret patterns; the test-only Reclub link is absent |
| Network/storage/env in staff code | None: no `fetch`, Supabase, `/api/`, cookies, Web Storage, IndexedDB, `FormData` or `process.env` |
| No mutation / persistence | Tests assert zero non-GET requests, zero `/api`, Supabase or GCash calls, no cookies or storage after simulations; reload resets |
| Reclub | No request reaches Reclub (intercepted and aborted); the only link opened is the event-specific test link |
| Court geometry | `components/public/court-map.js` and `lib/demo/club.js` unchanged; geometry re-asserted on `/staff/schedule` and `/book` |
| Accessibility (axe, WCAG 2.0/2.1/2.2 A+AA) | Zero serious/critical violations on all 8 staff routes at 320/360/390/768/1440 px (day and week views) and on all 20 screenshots |
| Responsive | No horizontal overflow on all staff routes at 320/360/390/768/1440 px; tables switch to cards below 1200 px; the sidebar becomes a disclosure menu at ≤ 760 px |
| owner-demo / 3D.1 / 3D.2 / 4A | Unchanged, local and remote |

## Documented changes to existing assertions (`tests/e2e/foundation.spec.js`)

The approved Phase 5A requirement replaces hardcoded `/staff` figures with values computed from
one fixture set. The Phase 1 values could not be kept: ₱1,200 verified less ₱300 refunds = ₱900 net
implies a 50% partial refund rate (an invented policy), and contradicts Phase 4A's totals. Value
changes only; row counts, filter behaviour, labels, layout and accessibility checks are unchanged.

1. `'₱1,200'` → `'₱8,400'` (verified payments, fictional)
2. `'₱900'` → `'₱7,800'` (net = verified − completed refunds ₱600)
3. Mobile cards `'DEMO-002'` → `'00000000-0000-4000-8000-000000000302'` (the pending-review
   booking, shared with the Phase 4A queue)
4. Desktop "Net collections" `'₱900'` → `'₱7,800'`

`tests/unit/demo-availability.test.js` still tests the legacy `lib/demo/dashboard.js`, which is no
longer rendered. It was left unchanged and annotated; removal is a Phase 5B clean-up.

## Intermittent failure (condition)

One full-suite run on the final tree failed `3D.2: keyboard-only journey at 390px …`
(`tests/e2e/booking-ux.spec.js`), 94/95; the error output was not retained. It was not
reproduced in 20 isolated repeats, 8 repeats under 4-worker load alongside the staff spec, or 4
further full-suite runs. Phase 5A did not change that test or `/book`'s components
(`booking-workflow.js`, `court-map.js`, `header.js`, `demo-notice.js`). Shared changes were scoped
CSS additions and one new `statusLabels.maintenance` key. No retry was added and nothing was
skipped. Recommendation: keep it under observation in CI; if it recurs, keep the trace
(`trace: retain-on-failure` is already configured) and investigate before release.

## Test-design notes

- Reclub navigation: tests route `reclub.co` requests to an abort handler and assert the single
  intercepted URL is the event's own test link. No real external navigation occurs. The test
  link `https://reclub.co/SAMPLE-TEST-ONLY-not-a-real-meet` appears only in tests and in the
  capture script, never in app data or the client bundle.
- Accessible names: hidden context starts with "for …", so names read "Details for Court 5, …"
  and "View Meet on Reclub for <event>, <date>, <time> (opens Reclub in a new tab)". In 1-hour grid
  cells the visible abbreviation leads the name ("Review (Pending review)"), satisfying WCAG 2.5.3.
- During QA a stale `next-server` from an earlier manual capture served outdated CSS and made one
  capture fail its target-size check. The servers were stopped and all screenshots recaptured
  against a fresh build. Playwright's own runs start and stop their server and were unaffected.

## Screenshots (synthetic data only)

Captured by `scripts/capture-phase-5a.mjs`. Every capture is checked with axe, for overflow,
for demo labels and for phone or non-synthetic email text, for unexpected Reclub links, and for
mutation requests (see `capture-metadata.json`). Captures 19–20 use the test-only Reclub link
with requests aborted.

1. [Staff overview, desktop](01-staff-overview-desktop.png)
2. [Staff overview, 390 px](02-staff-overview-mobile-390.png)
3. [Daily schedule with open play, desktop](03-daily-schedule-open-play-desktop.png)
4. [Daily schedule, 390 px](04-daily-schedule-mobile-390.png)
5. [Weekly schedule](05-weekly-schedule-desktop.png)
6. [Booking list](06-booking-list-desktop.png)
7. [Booking details](07-booking-details-desktop.png)
8. [Open-play management](08-open-play-management-desktop.png)
9. [Maintenance closure preview, no conflicts](09-maintenance-closure-preview-desktop.png)
10. [Occupancy conflict warning](10-occupancy-conflict-warning-desktop.png)
11. [Customer history](11-customer-history-desktop.png)
12. [Cancellation request with refund steps](12-cancellation-request-desktop.png)
13. [Rescheduling request with conflict](13-rescheduling-request-conflict-desktop.png)
14. [Receipt-review integration](14-receipt-review-integration-desktop.png)
15. [Keyboard focus in the mobile staff menu](15-keyboard-mobile-menu-390.png)
16. [Mobile open-play event details](16-open-play-event-details-mobile-390.png)
17. [Reclub link pending state](17-reclub-link-pending-desktop.png)
18. [Reclub link validation error](18-reclub-link-validation-desktop.png)
19. [Staff Reclub link management preview (test-only link)](19-reclub-link-management-preview-desktop.png)
20. [Enabled Reclub link in the schedule (test-only link)](20-reclub-link-enabled-schedule-desktop.png)

## Known limitations

- Demonstration only: no authentication, persistence, database enforcement, refunds, payouts or
  Reclub integration. Client-side conflict checks do not prove concurrency safety.
- Real Reclub Meet links are **pending owner approval**. The Meet share-link path format and any
  additional official share hosts are unverified, because `reclub.co` was not reachable from this
  environment.
- The customer-facing `/book` open-play Reclub action is deferred (see PHASE-5A.md). It needs a
  single shared schedule source.
- Staff fixtures (`staff-demo-v1`) are separate from the public `/book` sample availability,
  which predates them. Both are synthetic, but they are not yet one dataset.
- Automated axe checks are not a full assistive-technology audit.
