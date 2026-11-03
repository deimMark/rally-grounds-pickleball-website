# Phase 3B.2 adversarial security and transaction review

Date: 2026-11-03. Reviewed implementation:
`060f608eab2c9f07114932386ecd55ef651a484b`, branch `phase-3b2-guest-reservations`.
Base `0e411368d37045643495d29b288953f3ebff1007` is an ancestor, including reviewed
Phase 3A. Initial branch/HEAD matched and the working tree was clean. Remote base matched;
owner-demo/default remained `6146af81c6cdf6a501260b39dbc9ebfe6d0a64af`.

**Decision: eligible for controlled GitHub checkpoint publication in its local synthetic
scope; no unresolved critical/high security or transaction-integrity defect was found.**
Two non-blocking defects are recorded below. No public booking or live readiness approval.

This is a fresh adversarial review pass by the same coding assistant that implemented
the milestone, not an independent third-party audit or penetration-test certification.
The checkpoint is published for independent human review. Tests exercise additional
failure boundaries rather than merely repeating the implementation's success paths.
No application, migration, commercial policy or runtime security check was changed.

## Reviewed scope and files

Read AGENTS, ARCHITECTURE, ROADMAP, DECISIONS-AND-RISKS, PHASE-3B-CONTRACTS, PHASE-3B1,
PHASE-3B2, the 3B.1 security report and 3B.2 implementation QA. The latest user request
supersedes historical no-push instructions only for gated publication of this branch.

| Area | Inspected files/operations |
| --- | --- |
| New migration | `supabase/migrations/20261103000200_guest_reservations.sql`, all four private tables, actor constraints, four triggers, seven private helpers and five public gateways. |
| Prior database context | All seven earlier migrations; especially guest intent immutability/revocation/grants, staff Auth/RLS, quote/duration/configuration helpers, booking/occupancy transitions, exclusion constraint, expiry/release/block/audit functions. |
| HTTP | `app/api/availability/route.js`, `app/api/quotes/route.js`, `app/api/guest-reservations/route.js`, `app/api/guest-reservations/[reference]/route.js`, existing `app/api/guest-intents/route.js`. |
| Server/domain | `lib/server/guest-reservations.js`, `guest-http.js`, `guest-security.js`, `guest-intent.js`; `lib/domain/guest-reservation.js` and `availability.js`; existing staff/availability/booking boundaries. |
| Configuration | `.env.example`, `supabase/guest-booking.local.sql`, guest security fixture/bootstrap/local-target guards, `next.config.mjs`, `package.json`, `vercel.json`, CI workflow and secret scanners. |
| Tests | All Phase 3B.2 unit/integration/API tests, preserved earlier suites and fixture/reset changes. New review file and three HTTP/browser scenarios listed below. |

No runtime/schema diff from reviewed 060f608. The review commit adds tests, this document,
a historical QA link and current authorization wording only. No new migration.

## Transaction and locking assessment

**A — durable admission:** `guest_request_admit` requires the service gateway, explicit
local policy/key binding and valid capability. It commits separate shared/per-intent
request counters and the unique intent/operation/key fingerprint before domain RPC B.
Changed inputs conflict; identical keys recover the same pending/completed request.
Conflict attempts retain admission. Pending rows contain a keyed fingerprint, not a raw
contact/body snapshot. Missing settings do not silently grant unlimited operations.

**B — atomic domain:** validates capability again under the intent lock and locks the
request. A completed receipt is returned before old quote/create-window checks. Otherwise,
quote scope, immutable context, duration/scheduling, active allowance, versions and deadline
are revalidated under appropriate locks. Customer, booking, agreement, item, occupancy,
receipt, binding and redacted audit commit in one PostgreSQL transaction. Exclusion errors
and an injected late audit failure leave none of those domain rows or bindings committed.

Additional review probes held a fully executed B inside an uncommitted outer transaction.
Another connection saw no domain rows and a real retry was observed waiting via
`pg_blocking_pids`, not inferred from an arbitrary sleep. Commit released the retry to
exactly the original receipt. A separate Node process was then SIGKILLed with its own B
uncommitted: PostgreSQL rolled that transaction back, admission A survived, and a waiting
retry committed exactly one clean domain. An uncommitted attempted deadline is not an
accepted receipt; only the recovered committed receipt/deadline is authoritative.

Actual lock order is documented in PHASE-3B2: shared configuration/security row → shared
route bucket → intent → per-intent bucket/request, then domain hold-budget advisory lock
→ court → booking. Per-intent budgets are always taken under that intent, never in the
opposite direction. Domain B does not reacquire A's route bucket. Staff release and
request-path expiry use court→booking, without taking guest intent/limiter locks.
No deadlock/partial commit was observed in tested races; this is not proof of every
future lock graph. Multi-court worker operations must acquire sorted courts first.

Unique booking/intent constraints, irreversible intent binding and immutable booking/
request/agreement controls preserve one booking per intent and one historical receipt.
Normal clients gain no broad table UPDATE/DELETE. No staff identity is fabricated:
guest creators/audit actors are null with explicit guest attribution; legacy staff paths
retain their original authorization and immutable agreement behavior.

## Idempotency assessment

- Twenty independent guests compete at SQL and HTTP boundaries: one hold, 19 controlled
  conflicts; one customer/agreement/occupancy/binding, with all admitted attempts retained.
- Twenty identical SQL and HTTP retries: one committed booking and unchanged receipt/
  deadline. Existing changed-payload, same key/different intent and lost-response cases pass.
- New natural-expiry probe commits a hold before its short quote/create window expires;
  after real expiry, replay still returns the original receipt and fresh DB current state.
  An expired access credential is not rescued by an idempotency receipt.
- Existing natural hold expiry/cancelled replays cannot renew a deadline or reactivate
  occupancy. New concurrent staff release + private reads + twenty guest replays keep
  one creation receipt and one release audit; final status is cancelled/occupancy inactive.
- New real Next process restarts recover a previously admitted pending HTTP payload and
  replay the completed result without another booking. Fresh Node private-read clients
  remain rate-limited after quota exhaustion. Process memory does not own idempotency.

## Access, privacy and scheduling assessment

Five new SECURITY DEFINER gateways have `search_path=''`, schema-qualified objects,
explicit service-only EXECUTE grants and independent JWT-role checks. All four new
private tables have RLS/no allowing policies/no direct grants even to service_role.
Direct anon/staff/owner RPC and REST attempts fail; rollback-only temporary SELECT grants
independently verify RLS without leaving broadened permissions. No untrusted SQL function
name, actor/source/price/deadline/fingerprint selector is accepted by the HTTP boundary.

Private status verifies cookie hash, expiry/revocation, intent, request and booking binding
in the protected operation. A reference, matching email/phone or copied idempotency key
is not authentication. Stranger/nonexistent references return the same unavailable result.
Identical synthetic contacts do not merge customers. Contact is absent from public DTOs,
request receipts and redacted audit. Phone and real email collection remain unsupported.

Credentials remain 256-bit CSPRNG HttpOnly cookies, with hash-only storage. HTTPS cookie
Secure/__Host/Lax/Path/no-Domain controls remain covered; local HTTP has a separate name.
No bearer in JSON/URLs, no privileged client in browser code. Mutations preserve exact
Origin/Fetch Metadata, strict field sets, UTF-8/media/query/body/cookie limits. New review
server-log checks found none of the tested bearer/hash/fingerprint/private bindings or
synthetic name/contact. Captured local DB/REST/Kong stdout+stderr also had zero matches
for current intent hashes, actual service/HMAC bindings or sampled synthetic contacts.
Local PostgreSQL error parameter logging is configured to 0. This is scoped evidence;
hosted access/header/database/error logs still require a separate operational review.

PostgreSQL computes centavo prices and UTC instants, with Asia/Manila hours. Selected
60/60 and 90/60 duration behavior, unsupported configurations, stale price/terms/closures,
open-play/maintenance exclusion, adjacent/different-court success, policy snapshots and
missing required configuration all remain covered. Staff authorization is unchanged.

## Findings by severity

| ID | Severity in local scope | Finding, evidence and proposed correction |
| --- | --- | --- |
| R1 | Medium — functional browser-read boundary | A genuine same-origin browser GET normally omits Origin. The status handler requires it, so matching HttpOnly cookies plus X-Guest-Intent still return 404. New real-browser probe reproduces this; the API client with explicit Origin returns 200. PHASE-3B2's suggestion that browser JS can simply supply Origin is misleading because Origin is a forbidden request header. No cross-guest disclosure or booking integrity failure. Before a guest status UI, design a reviewed read-specific same-origin/Fetch Metadata or server mediation contract; preserve strict mutation Origin checks and DB capability/binding authorization. No fix in this audit. |
| R2 | Low — UUID JSON type validation | RegExp.test coerces one-element arrays to UUID strings; normalizeGuestQuote/Reservation therefore accept UUID arrays. HTTP probes confirm PostgREST rejects them with safe 400 and no domain rows, but malformed reservation input can leave one bounded pending admission. Require explicit string types for every UUID before regex/fingerprinting/admission; retain downstream UUID validation. No authorization bypass reproduced and no runtime fix in this audit. |
| R3 | Medium — privileged gateway trust | Service credentials remain broadly privileged/RLS-bypassing on existing tables. Fixed RPC wrappers, private-table revocations, independent checks and bundle isolation reduce caller exposure, not credential authority. Independently review hosted secret isolation/least privilege/logging before real data. |
| R4 | Medium — public abuse/operational readiness | Only loopback/local-shared identity exists. Origin is browser CSRF defense, not HTTP-tool authentication or public ingress control. No trusted public attribution/NAT budgets/edge defense/body-read deadline or quota-preserving rotation implementation. Keep public forwarding disabled. Invalid HTTP/quote validations may precede accounting or roll back their own quote transaction; reservation A remains durable on domain conflicts. |
| R5 | Medium — expiry/retention/recovery readiness | No scheduler/heartbeat/cleanup/recovery exists. Reads/budgets use logical expiry, and writers reconcile occupancy, but idle physical release has no autonomous SLA. Immutable quote/request DELETE triggers require a future narrow audited cleanup path. Retention markers are not deletion; lost capabilities cannot be recovered by reference/contact. |

No critical/high unprivileged access or transaction-integrity defect was found in the
reviewed local scope. Privileged-key compromise can have high impact; local publication
is not a finding that this key is least-privileged or that public booking is secure to launch.
R1/R2 are recorded defects, not fixed/waived assertions. The new browser tests characterize
those current limitations; no existing test was weakened to obtain green results.

## Validation evidence

Designated local Supabase/PostgreSQL/Auth/REST; synthetic records only. Node 24, npm 11,
Supabase CLI 2.122, system Chromium. Fixtures/suites run sequentially.

| Suite | Pass | Fail | Skip |
| --- | ---: | ---: | ---: |
| Real DB integration/security/concurrency | 99 | 0 | 0 |
| Unit tests | 112 | 0 | 0 |
| Browser/API | 40 | 0 | 0 |

- Eight migrations cleanly replayed via `npm run db:reset`; local `db:staff`/`db:guest`
  passed. No schema or runtime security changes made during this review.
- DB total: all 94 existing plus five new tests in `guest-reservation-review.test.mjs`.
  Browser total: all 37 existing plus real browser read, Next restart recovery/logs and
  UUID-array rejection probes. Unit count is unchanged. No failed/skipped/TODO tests.
- `npm run lint`, `npm run test`, `npm run test:integration`, `npm run build`,
  `TEST_PORT=3100 PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e`,
  `npm run check:secrets`, `npm run check:client-secrets`, `git diff --check`: passed.
- Known private service/HMAC bindings absent from all 16 browser JS/map artifacts.
  Source/untracked/staged credential-pattern checks passed; local .env files ignored/0600.
  Scans suppress values and do not prove absence of every possible secret representation.
- Private local diagnostics: `/tmp/rally-3b2-security-{reset,db,unit,build,browser}.log`.
  Generated diagnostics/traces/env artifacts are not versioned; browser traces disabled.

## Phase 3B.3 changes required — proposal only

1. Add a least-privilege, bounded, idempotent expiry operation using database time. Lock
   sorted court rows then booking rows, recheck held/deadline state, atomically release
   occupancy and audit once. Never take intent/limiter locks while holding courts.
2. Test worker versus create/retry/read/staff release, overlapping batches and multiple
   workers. Preserve accepted receipts/deadlines and current-state separation. Skip
   locked work only with eventual coverage, not an unobserved starvation guarantee.
3. Add one-minute-or-better cadence with healthy release ≤60 seconds, heartbeat/lag/error
   visibility, restart recovery, bounded retries and stopped-worker failure drills.
   Preserve request-path fallback; do not provision external workers in a local task.
4. Design explicit retention and deletion authorization for expired **unbound** intents,
   obsolete quotes/pending requests and inactive limiter windows. Immutable triggers and
   circular FKs make blind cascade deletion inappropriate. Keep bound receipts/agreement
   history and necessary audits. Index/batch/SKIP LOCKED eligibility and monitor failures.
5. Never delete active-window buckets or rotate a key/version into empty counters during
   an active budget window. Approve retention/key overlap/recovery/privacy exceptions.
6. Track R1/R2 as corrections before any guest browser launch; resolve owner-approved
   hours/cutoff/payment opportunity/horizon/duration/player/hold/contact/security/privacy
   settings and terms before broadening the synthetic scope. No payments/GCash here.

**Recommendation:** go for independent review and, after separate authorization, local
Phase 3B.3 expiry/retention engineering. No-go for public guest booking or production.
No Phase 3B.3 code was implemented in this task.

## Controlled publication safeguards

Existing `vercel.json` disables Git deployment for exact branch
`phase-3b2-guest-reservations` (and its base); its parsed value was verified false.
No Vercel CLI/API or settings change, deploy command, merge, force-push, production
Supabase connection, paid resource, real customer data or payment action. Publishing
this development branch must not move default/owner-demo or Phase 2/3A/3B.1 tips.
Remote HEAD and GitHub Actions are checked after push and reported in delivery output;
this report does not pre-claim hosted CI or deployment results.
