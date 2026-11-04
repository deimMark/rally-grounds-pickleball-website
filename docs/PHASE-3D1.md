# Phase 3D.1 — synthetic customer booking interface

Base: owner-demo `6146af81c6cdf6a501260b39dbc9ebfe6d0a64af`.
Branch: `phase-3d1-booking-interface`. Local UI milestone only; no publication/deployment.
This branch contains no unpublished Phase 3B migrations, RPCs, routes, workers or Auth.
The H2 security finding remains an independent backend blocker, not fixed by this UI.

## Customer journey

- `/book`: pick one of three labeled sample dates, a configurable fixture duration,
  a court on the approved shared map (or List), and an available full session interval.
  Open play, maintenance, reserved hours and closing-time overruns disable choices.
  A change of day, court or duration clears the start selection.
- Continue to the details form: choose a fictional profile, read its synthetic name/email,
  choose an estimated player count and acknowledge this is a demo. Read-only identity
  fields prevent collecting real contacts. No input is sent to an API or browser storage.
- `/booking/confirmation`: a synthetic unpaid-hold receipt design with no reservation,
  financial obligation, screenshot upload or paid-confirmation claim.
- `/booking/status`: a public *design* of a future private page, with held/expired/cancelled
  fixture scenarios. Historical receipt/amount/deadline stay unchanged while current
  scenario changes. Missing/invalid sample context shows unavailable access; a supplied
  reference never authorizes anything. These pages contain no private/customer data.

The official wordmark fallback, illustration, typography, licensed photograph, warm/navy/
blue/gold palette, staff demo and existing mobile navigation are retained. CourtMap shares
identical geometry/markings/labels between homepage and booking: 3/4/5 portrait, 2/1
landscape, 5/2/1 right edges aligned. No court identities/layout were remapped.

## Data and safety

`lib/demo/booking.js` is a presentation fixture/DTO boundary, not booking authority.
Demo prices use integer centavos and the existing illustrative rate; all operating hours,
durations/player examples and availability are explicitly synthetic/provisional. No
commercial policy is invented for real use. Cancellation/refunds/deadlines and capacity
still require owner approval. Frozen receipt timestamps are examples, not a running
payment timer or autonomous expiry. No availability/occupancy is mutated by the demo.

Only nonsensitive selection values (fixture day/court/time/duration/player count) appear
in navigation URLs. No contact, credential, bearer value, idempotency secret or name is
stored in URLs, localStorage, sessionStorage, cookies, logs or a database. Private-design
routes use no-referrer/no-store headers, but these are **not authentication**. Static
fixture reference/intent/quote/court API identifiers are synthetic UUIDs, not capabilities.
No API client or capability-cookie issuing mechanism is present. vercel.json sets
`git.deploymentEnabled["phase-3d1-booking-interface"]` to `false`; no Vercel settings or
default branch changed. That flag only covers this exact branch name, and the remote
Vercel project's handling of it has **not** been verified from this environment.

## Phase 3B contract compatibility — future integration only

The documented guest contracts on the backend branch are interface references only.
No backend code is copied or merged. A future approved adapter must replace *all* fixtures:

| UI boundary | Future contract |
| --- | --- |
| Date/duration/courts/slots | GET /api/availability with strict ISO day and integer durationMinutes; public data only |
| New journey | POST /api/guest-intents; server issues HttpOnly capability cookie; no raw bearer in JavaScript |
| Session price | POST /api/quotes with intentId, canonical court UUID, UTC startsAt and durationMinutes; trust returned quote only |
| Details | guest `{name,contact:{kind,value}}` and integer estimatedPlayers; collect only owner-approved minimum fields |
| Creation | POST /api/guest-reservations with intentId/quoteId/guest/estimatedPlayers and stable per-intent UUID Idempotency-Key; never send client price/deadline/paid state |
| Receipt | `{reference,createdAt,totalCentavos,currency,expiresAt,stateAtCreation}` immutable |
| Current status | `{status,expiresAt,observedAt}` independently authoritative from protected GET, not browser time |
| Private access | GET /api/guest-reservations/<reference> with matching per-intent cookie/binding; reference alone never grants access |

The prototype quote uses that response field vocabulary, UTC instants from explicit
Asia/Manila dates, centavo totals, whitelisted public terms and versionContext. Guest
fixture contact uses the structured kind/value shape. The UI's human-readable court IDs
remain unchanged; separate synthetic UUIDs demonstrate future API identity mapping.
Real pricing, policy readiness, duration validation, idempotency, lead time, capacity,
contact normalization, conflict handling, stale terms/quotes, CSRF/Origin, capability
security and all server validation remain server responsibilities. They are not simulated
as operational security by this branch. A later integration must handle 409/stale quote,
429/rate-limit, 503/policy-not-ready, capability loss and uncertain/lost creation responses
without creating duplicate holds or promising confirmation. No live launch is approved.

## Recovery provenance

The interface was first implemented in an earlier, unpublished local commit in a
different environment. That commit, its local stash and its private evidence folder are
**not available** in this repository and must not be assumed to exist. Its 22 source,
configuration, test and documentation files were recovered here as a SHA-256-verified
patch on top of owner-demo `6146af8`; its eight QA screenshots were not transferred and
were regenerated from this code (see the QA report). Commit SHAs quoted in the historical
review sections refer to that original environment only.

No worker was activated by this task, and no worker, migration, RPC or backend code is on
this branch. Evidence for the separate Phase 3B H2 finding belongs to the backend review
and is not part of this branch. Do not infer backend approval from these UI tests.

## Verification

See the [QA report](qa/phase-3d1/REVIEW.md) for exact results. Use Node 24 (`.nvmrc`), then:

```sh
npm ci
npm run lint
npm test
npm run build
npx playwright install chromium   # once, or set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
TEST_PORT=3100 npm run test:e2e
```

No Supabase environment/configuration is required for these screens. Only a local
commit is authorized; GitHub publication requires separate approval. Do not merge or deploy.
