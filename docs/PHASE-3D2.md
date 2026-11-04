# Phase 3D.2 — booking UX and accessibility refinement

Base: Phase 3D.1 commit `0172b32d24f3a4f1fddb5e3e66ffe7620eb93265` (branch
`phase-3d1-booking-interface`, one commit on approved owner-demo `6146af8`).
Branch: `phase-3d2-booking-ux`. Local UI milestone only; publication needs separate approval.
This branch still contains no API client, Supabase call, migration, worker, capability
cookie/token, payment or upload code. The Phase 3B.3 H2 finding remains an unresolved,
separate backend blocker that this work does not touch.

## What changed, by approved item

| # | Improvement | Where |
| --- | --- | --- |
| 1 | Accessible validation: submitting the details form without consent now shows one inline error (`role="alert"`, `aria-invalid`, `aria-describedby`), moves focus to the checkbox and does not navigate. The submit button is no longer silently disabled. The "Review demo details" button stays disabled until a start is chosen but now explains why through `aria-describedby`. | `components/booking/booking-workflow.js` |
| 2 | Reset announcements: when a chosen start is cleared because the day, duration or court changed, a polite live region says so once ("Start time cleared because the session duration changed…"). Changes with nothing selected are silent and clear any stale notice. | `booking-workflow.js` |
| 3 | Canonical URL parameters: `duration` and `players` must be canonical decimal integers (`120`, not `0120`, `+120`, `1e2`); `start` must be a string. | `lib/demo/booking.js` (`canonicalInteger`) |
| 4 | Removed the artificial 250 ms "pending" delay; the preview opens immediately and the button only reads "Opening demo preview…" while navigation is in flight. | `booking-workflow.js` |
| 5 | Start times grouped into Morning (08–11), Afternoon (12–16) and Evening (17–22) sample periods; grouping lives in `bookingDemo.periods`, not in UI code. | `lib/demo/booking.js`, `booking-workflow.js` |
| 6 | Unavailable slots keep native `disabled` (not tab stops, cannot activate) and gain an accessible, visible reason via `aria-describedby` ("Reserved in this sample", "Sample maintenance closure", "Would end after the demo closing time"); available slots describe their end time. A summary sentence ("10 of 15 sample starts fit a 2-hour session (…)") describes the whole fieldset. | `booking-workflow.js`, `lib/demo/booking.js` |
| 7 | Compact mobile summary: a fixed bottom bar at ≤760 px shows court, session and demo total with a "Full summary" link; `scroll-padding-bottom` and page padding keep focused controls above it. Hidden on desktop. | `booking-workflow.js`, `app/globals.css` |
| 8 | List view shows per-court counts ("7 of 15 sample starts") as each court button's accessible description; names like "Court 3, Available" are unchanged. | `components/public/court-map.js` (`getDetail`) |
| 9 | The court group carries a visually hidden text description of the approved layout (3/4/5 portrait across the top, 2/1 landscape below, right edges aligned with Court 5) on both the homepage and the booking page. Geometry untouched. | `court-map.js`, `lib/demo/booking.js` |
| 10 | Focus management via `useEffect` (never on first render, so the skip link remains first); header "Booking demo" link gets `aria-current="page"` on booking routes. | `booking-workflow.js`, `components/public/header.js` |
| 11 | Confirmation shows step 03 as current and both result pages open with a "This page is / is not" block; the sample receipt (fixed at creation) and the current demo status are separate labelled groups. | `components/booking/booking-result.js` |
| 12 | Demo timestamps (sample created, hold deadline, status observed) render in Asia/Manila through `formatManila`, with the UTC instant in `<time datetime>`. | `lib/demo/booking.js`, `booking-result.js` |
| 13 | The top demo notice is route-aware: booking routes read "Booking demonstration · Synthetic data only · No reservation, payment or personal data". | `components/ui/demo-notice.js` |
| 14 | 6 new unit tests and 16 new browser tests; one legacy assertion updated (see below). | `tests/` |

## Deliberate test change

`tests/e2e/booking-interface.spec.js` previously asserted that "Create demo preview" is
*disabled* before consent. The approved Phase 3D.2 behaviour is the opposite: an attempted
submission must produce an announced consent error. That single assertion was replaced by
a stronger one (enabled → click → error announced, checkbox focused, URL unchanged, then
consent → navigation). No other existing assertion, tolerance or test was changed, and no
retries were added.

## Data and safety

All prices, hours, durations, player options, periods and reasons remain in
`lib/demo/booking.js` and `lib/demo/club.js`; no policy constants were added to UI code and
no owner-approved rule is implied. The form still collects nothing: identity fields are
read-only synthetic profiles, no request other than GET/HEAD is made, no cookie or storage
is written (asserted by tests). `/booking/*` keeps `no-store`/`no-referrer` headers.
`vercel.json` disables Git deployments for both `phase-3d1-booking-interface` and
`phase-3d2-booking-ux`; no Vercel project setting was changed and the remote project's
handling of the flag is **not** verified from this environment.

## Verification

See [qa/phase-3d2/REVIEW.md](qa/phase-3d2/REVIEW.md). With Node 24 (`.nvmrc`):

```sh
npm ci
npm run lint
npm test
npm run build
TEST_PORT=3100 npm run test:e2e
npm run start -- --port 3101 &  # then:
node scripts/capture-phase-3d2.mjs
```
