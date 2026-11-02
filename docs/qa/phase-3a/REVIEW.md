# Phase 3A QA review — 2026-11-02

Result: **local Phase 3A validation passed; guest booking is not implemented**.
Branch: `phase-3a-foundation`. Reviewed baseline:
`1e173f31db6c35c143f5637e365918b721c8f825`.
Implementation commits:

- `c5bf7aa86018ec49b6d358936eb2c02bd06160fd` — selected duration consistency.
- `d0d5496186678081ec0d9da057e860583ca07c97` — current state and block release.

The documentation/QA commit follows these commits; its full SHA is available in Git
history and the final review report. Expected baseline and Phase 1 checkpoint
`753901cd3363a102d34c0cc77fbdcdfa2bde9a2b` are verified ancestors. Phase 2's four
implementation commits were retained unchanged. No push, merge or deploy occurred;
GitHub CI was not run for these unpublished commits.

## Actual checks

Executed with Node 24.19, npm 11.9, local Supabase CLI 2.122, real local
PostgreSQL/PostgREST/Auth, and system Chromium. No remote database/real customer records.

| Command / check | Result |
| --- | --- |
| `npm run db:migrate` | All three new additive migrations applied successfully to the Phase 2 database. |
| `npm run db:reset` then `npm run db:staff` | Clean local migration replay and synthetic Auth bootstrap passed. All six migration versions confirmed in migration history. |
| `npm run test:integration` after reset | **53 passed, 0 failed/skipped**: original 32 + duration 6 + status 7 + block release 8. |
| `npm run test` | **47 passed**, 3 files; original 35 plus 12 selected-duration input checks. |
| `npm run lint` | Passed. |
| `npm run build` | Passed; public and staff routes compiled. |
| `TEST_PORT=3100 PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e` | **21 passed**, using production build and real synthetic staff Auth. |
| `npm run check:secrets`, staged credential scan | Passed scoped pattern checks; values suppressed. |
| `git diff --check` | Passed. |

The database suite runs serially by file and truncates/reseeds domain fixtures between
cases; individual concurrency tests issue real simultaneous requests with up to 25
connections. Browser tests ran after database reset/bootstrap/testing, with no competing
fixture mutation. Browser coverage retains mobile layout/navigation, selector behavior,
real Auth rejection/revocation/cookies and serious/critical accessibility checks.

## Defect resolution evidence

| Prior finding | Regression evidence / outcome |
| --- | --- |
| R1: 90-minute minimum / 60-minute increment returns no slots | Default and explicit 120-minute selection return 70 intervals across five courts; quote and creation agree at 120,000 centavos. Selecting 90 fails clearly. 60/60 preserves the original 75 slots. Selected 180/max 180 and invalid configurations tested. |
| R2: replay receipt status can differ from actual state | Explicit receipt/current envelope, cancellation and deadline-expired replays, unchanged deadlines, changed-input rejection, replacement occupancy and 20 replays racing cancellation pass. Legacy Phase 2 function/receipt upgrade preserves agreement and receipt. |
| R3: no supported block release | Mixed open-play/maintenance multi-court release is atomic and audited. Invalid/reservation IDs roll back. Twenty distinct keys produce one actual release and 19 already-released outcomes; 20 identical-key attempts and overlapping ID sets also pass. Replacement reservations remain occupied. |

Original database regressions still prove adjacent intervals, independent courts,
20 competing creation attempts with one success/19 conflicts, exclusion enforcement,
versioned pricing/terms, owner settings restrictions, RLS and append-only audit controls.

## Security review

- Status/release require active staff/owner in PostgreSQL and server services. Anonymous,
  inactive, missing-role and unauthorized direct operations are rejected in real tests.
- No direct broad occupancy UPDATE/DELETE grant was introduced. Private helpers are not
  executable by anonymous or ordinary authenticated callers; no guest mutation API added.
- Availability retains its six public fields and excludes booking IDs, contact and payment
  information. No browser-side privileged client, new service key or NEXT_PUBLIC secret.
- `.env.local` and `.env.test.local` remain ignored, mode 0600; only `.env.example` is
  tracked. Dependencies, build outputs, browser artifacts and private key patterns are
  ignored. Source/untracked and staged text scans found no credential-pattern matches.
  These scoped scans do not prove absence of every possible secret format.
- No production customer/payment records, payment collection, external accounts, scheduler
  provisioning or production resource changes were introduced.

## Remaining limits and review gate

1. **Autonomous expiry remains absent.** Current reads derive expired from database time;
   persisted `held`/active occupancy flags can remain until write-time reconciliation.
   Reads/replay do not perform cleanup or claim scheduler health. Phase 3B must add a
   bounded worker, failure monitoring and expiry race tests (healthy release within 60s).
2. **Guest authorization and booking UI remain absent.** Public selector and dashboard
   metrics are synthetic. No guest endpoint/cookie/contact flow/rate limiter exists.
3. **Owner decisions remain open.** Hours, cutoff equality/minimum payment opportunity,
   horizon, maximum duration/players/holds, contact/retention, capability TTLs and abuse
   budgets need explicit configuration/approval before public admission. No refund rate
   was invented; existing snapshots are preserved.
4. Create RPC response shape changed intentionally. Internal consumers must use
   `receipt` for historical creation details and `current` for present status. Historical
   stored receipts and their agreement snapshots require no rewrite.
5. Invalid policy and invalid duration currently share an internal availability error code;
   the proposed public gateway must distinguish them. No public HTTP API was added here.
6. Privileged guest gateway, cookies/CSRF, durable admission and contact minimization need
   security review and implementation/testing under separate authorization. Proposed
   contracts are documented, not passing claims for future features.
7. Phase 1.1 logo/gold icons/warm surfaces/helper readability remain separate visual work.

Review [Phase 3A implementation](../../PHASE-3A.md) and
[Phase 3B contracts](../../PHASE-3B-CONTRACTS.md) before authorizing the next milestone.
