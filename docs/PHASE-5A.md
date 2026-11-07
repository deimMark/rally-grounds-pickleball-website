# Phase 5A — synthetic staff scheduling and operations dashboard

Base: Phase 4A commit `563eb8b3893ed2b5a882c0f882562775502cff91` (branch
`phase-4a-receipt-demo`, on Phase 3D.2 `af6ce95`, Phase 3D.1 `0172b32` and owner-demo `6146af8`).
Branch: `phase-5a-staff-demo`. Local demonstration milestone only. No push, merge, deployment,
staff authentication, live booking change, payment decision, refund or Reclub integration.
The Phase 3B.3 H2 finding remains an unresolved backend blocker and is untouched.

Includes the owner's **Reclub open-play addendum** (section "Open play and Reclub Meet links").

## Routes

| Route | Purpose |
| --- | --- |
| `/staff` | Overview: eight operations metrics, four fictional payment metrics, today's sample schedule, links to every area |
| `/staff/schedule` | Daily grid (courts × hours) and weekly grid (days × courts), date/court/type filters, shared CourtMap, item details, mobile list alternative |
| `/staff/bookings` | Booking list with search and filters; detail panel with seven sections; simulated status transitions. `?ref=<sample reference>` preselects a booking |
| `/staff/open-play` | Open-play events with Reclub link state; simulated create/edit/cancel/remove-link with conflict checks |
| `/staff/maintenance` | Closures; simulated create (after an affected-schedule review with no conflicts) and cancel |
| `/staff/customers` | Fictional customer history: search by name or sample reference, filters, chronological history |
| `/staff/requests` | Cancellation and rescheduling queues with refund steps, availability checks and simulated decisions |
| `/staff/payments-demo` | Phase 4A receipt review, now linked from the staff navigation |

The sidebar collapses into an accessible "Staff menu" disclosure at ≤ 760 px.

## Synthetic fixtures (`lib/demo/`)

One versioned dataset, `staff-demo-v1`, feeds every staff page:

- `staff.js` — demo clock (Sat 7 Nov 2026, 7:30 AM Asia/Manila), 8 fictional customers
  (`customer-x@example.invalid`), 15 bookings, 3 open-play events, 2 closures, 4 cancellation and
  4 rescheduling requests, status vocabulary, allowed simulated transitions and the pure
  `applySimulation` overlay. Bookings 301–305 mirror the Phase 4A receipt queue exactly
  (court, session, amount, method, customer and payment state; asserted by unit tests).
- `staff-schedule.js` — Manila time helpers, half-open overlap, schedule items, day/week grids,
  filters and conflict detection.
- `staff-customers.js`, `staff-requests.js`, `staff-overview.js` — aggregation, refund stages,
  reschedule availability checks and every overview metric.
- `reclub.js` — Reclub link allowlist and validation.

Money is integer centavos; timestamps are UTC instants rendered in Asia/Manila. Original booking
agreements are frozen objects and never change. Booking status, payment evidence and payment
verification are separate fields; `paymentStateOf` reuses the Phase 4A state vocabulary.

Overview figures (computed, not hardcoded): 3 sessions today, 67 of 75 free court-hours, 9 upcoming
reservations, 1 pending payment review, 1 cancellation and 2 rescheduling requests, 3 open-play
periods and 2 closures this week; verified (fictional) ₱8,400, unverified claims ₱1,800, completed
refunds ₱600, net ₱7,800. The unverified figure equals the Phase 4A queue's. The receipt page
totals only its five scenarios and now says so.

## Simulation boundaries

Simulated actions live in a React context in the staff layout: they persist while moving between
staff pages and reset on reload. Each shows `SIMULATED ACTION — NO BOOKING CHANGED` with a
description, moves focus to that notice, and adds to a visible "N simulated changes" banner with a
"Clear simulations" control. Nothing is written to a server, cookie or browser storage.

- No "confirm" transition exists. Confirmation follows a verified payment, never a receipt.
- Expired, cancelled and completed bookings offer no transitions, so evidence cannot revive a hold.
- A future session cannot be marked completed before it ends at the demo clock.
- Destructive simulations (cancel booking, cancel event or closure, approve cancellation) need an
  inline confirmation.
- Open play and closures are conflict-checked against every occupying item with half-open
  intervals. Conflicts are reported, never displaced or overridden. These checks are client-side
  illustrations, not database enforcement.
- Approving a cancellation marks the refund approved; it never records a payout. Approving a
  reschedule changes only the request: the booking is not moved and the new slot is not reserved.

## Open play and Reclub Meet links (addendum)

- Each event has `eventType: 'open-play'` and an optional `reclubUrl`. **All fixtures are `null`
  ("Reclub Meet link pending")**: no real Meet link has been supplied or approved, and none is
  invented. Owners obtain the real link in Reclub via the Meet → Share → Copy Link.
- Validation (`validateReclubUrl`) parses with `URL`. It requires a literal `https://`
  prefix; rejects whitespace, backslashes, quotes and control characters, credentials and custom
  ports; requires the hostname to equal an allowlisted host exactly; and rejects generic pages
  (site root, language roots, `/clubs/…`, `/sports/…`, help and marketing paths). Fragments are
  dropped. Lookalikes such as `reclub.co.evil.example`, `evil-reclub.co`, `reclub.com`,
  `reclub.co.`, punycode or unicode variants, and subdomains such as `help.reclub.co` all fail.
- Allowlist: `reclub.co`, Reclub's official domain. **The exact path format of a Meet's shared
  link could not be verified from this environment** (`reclub.co` was unreachable from the
  sandbox), so any non-generic path on that host is accepted. Once the owner supplies a real
  copied link, tighten `reclubConfig.eventPathPattern` and confirm whether other official share
  hosts exist.
- Display: open-play cells carry a ◆ marker, gold edge and stripe pattern plus the words "Open
  play" (not colour alone). A multi-hour event is one table cell spanning its hours, and a
  multi-court event shows the same event and link on each court. "View Meet on Reclub" is a plain
  external anchor, a sibling of the details button and never nested in it. It has
  `target="_blank"`, `rel="noopener noreferrer external"`, `referrerpolicy="no-referrer"` and an
  accessible name with event title, date, time and "(opens Reclub in a new tab)". Devices with the
  Reclub app can hand the official link to the app. The pending state is non-interactive text.
- Staff management preview: optional Reclub link field with live validation feedback, a
  normalised preview, inline error with focus on submit, and simulated add/edit/remove-link. No
  Reclub API, RSVP, roster, registration or payment sync exists. A link never changes availability,
  bookings or payments (unit-tested).
- **Customer-facing booking page: deferred (follow-up).** The public `/book` availability comes
  from the separate Phase 3D sample set (`lib/demo/club.js`), whose open-play slots have no event
  identity. Linking them would mean replacing the approved Phase 3D.2 data source. Per the
  addendum this is documented rather than forced. Open-play slots on `/book` remain unselectable,
  as before.

## Tests and QA

See [qa/phase-5a/REVIEW.md](qa/phase-5a/REVIEW.md). Four existing `/staff` assertions changed
value only, as documented there. With Node 24 (`.nvmrc`):

```sh
npm ci
npm run lint
npm test
npm run build
TEST_PORT=3100 npm run test:e2e
npm run start -- --port 3107 &   # then:
node scripts/capture-phase-5a.mjs
```

## Remaining Phase 5B requirements

Staff authentication and roles; PostgreSQL-enforced occupancy for open play, closures and staff
bookings (including concurrency); transactional reschedule moves; audited cancellation, refund
and payout records; customer history behind authorisation with pagination; real Reclub links
validated server-side; customer-facing open-play/Reclub display from one shared data source; and
removal of the legacy `lib/demo/dashboard.js` fixture with its test, once approved.

## Owner decisions still pending

Cancellation eligibility and deadlines; refund rates, fees and payout timing; reschedule lead
time, limits and price treatment; hold and payment deadlines; review SLA and coverage; open-play
pricing, capacity and whether income is recorded; the real Reclub Meet links and official share
host(s); operating hours; customer data retention; staff and owner permission matrix.
