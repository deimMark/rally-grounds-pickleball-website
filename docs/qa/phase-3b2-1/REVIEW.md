# Phase 3B.2.1 correction QA

Date: 2026-11-03. Branch: `phase-3b2-1-security-fixes`.
Required base `22fb656f7c7c1dbcc35f23063aea2822c1aeecc7` matched local HEAD and the
fetched remote `phase-3b2-guest-reservations`. Starting tree was clean, with Phase 3B.1
ancestry verified. The correction branch was created before editing. Commit SHA is
reported in delivery output/`git log`; no push or hosted CI run was performed.

## Result

**R1 and R2 are corrected in the tested synthetic local scope.** No migration, staff
Auth/RLS, booking RPC, pricing/policy snapshot, occupancy constraint, transaction lock
order or idempotency algorithm was changed. No expiry worker or Phase 3B.3 feature.
The full contract and file inventory are in [PHASE-3B2-1.md](../../PHASE-3B2-1.md).

| Defect | Before | After / evidence |
| --- | --- | --- |
| R1 browser private GET | Valid HttpOnly capability + same-origin browser GET returned 404 because Origin was absent. | Dedicated GET policy accepts same-origin Fetch Metadata with no Origin. Playwright observes the real outgoing request: Origin absent, Sec-Fetch-Site=same-origin, response 200 with original receipt/current state. No browser code sets Origin. |
| R2 UUID coercion | UUID arrays reached SQL parsing; rejected create requests could leave a pending admission. | A primitive-string predicate guards all guest UUID fields, selectors, references and request keys. Single/multiple-element arrays, objects, nulls/numbers/booleans and serialized header substitutes reject before admission or private-read RPC. Zero new request/customer/booking/agreement/occupancy rows or create/read buckets for malformed inputs. |

Prior characterization tests for R1/R2 were updated to require the corrected behavior;
no unrelated regression assertion was removed or relaxed. Valid normalization field order
and HMAC fingerprint semantics are unchanged. Native database UUID parsing is retained.

## Actual validation

| Suite | Pass | Fail | Skip |
| --- | ---: | ---: | ---: |
| Real Supabase/PostgreSQL integration | 99 | 0 | 0 |
| Vitest units | 138 | 0 | 0 |
| Playwright browser/API | 45 | 0 | 0 |

Unit total: prior 112 plus 26 trust/type boundary cases. Browser total: prior 40 with the
two defect reproductions corrected, plus five expanded browser/API scenarios. All 99
real database tests, including transaction-recovery and RLS probes, remain unchanged.
No cancelled/TODO tests. Fixture-mutating suites ran sequentially, not in parallel.

Commands/results:

- `npm run db:start`, `npm run db:reset`, `npm run db:staff`, `npm run db:guest`: passed on
  designated local Supabase/PostgreSQL/Auth/PostgREST only; all eight migrations replayed.
- `npm run test:integration`: 99/99, including twenty independent guest requests (one
  hold/19 controlled conflicts), twenty same-key retries (one receipt/deadline), different
  courts/adjacency, open-play/maintenance conflicts and unchanged staff booking/block rules.
- Lost responses, uncommitted transaction wait/commit, killed process rollback/pending
  recovery, real Next restarts, natural quote/create/hold expiry and cancelled replays
  retain authoritative DB status with no resurrection or orphan domain rows.
- Anonymous/ordinary staff direct RPC attempts, private table REST/RLS tests, capability
  scoping/revocation/expiry, agreement/audit immutability and durable budgets pass.
- `npm run test`: 138/138; GET target/metadata/Origin matrix, unchanged POST requirements,
  nonstring UUIDs (including coercible objects/boxed strings), valid normalization,
  strict cookie selectors and request-key rejection before privileged-client construction.
- `npm run build`, `npm run lint`, `git diff --check`: passed.
- `TEST_PORT=3100 PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e`:
  45/45 with the production build/system Chromium; staff/demo/mobile regressions retained.
- `npm run check:secrets` and staged scan: passed; only .env.example tracked among env
  files; private local bindings/Auth fixtures remain ignored/0600.
- `npm run check:client-secrets`: actual private service/HMAC values absent from all 16
  browser JS/map artifacts, values suppressed. Scans are scoped evidence, not proof
  against every possible secret representation.

Ignored local diagnostic logs: `/tmp/rally-3b2-1-reset.log`, `-db.log`, `-unit.log`,
`-build.log`, `-browser.log` (all share the `/tmp/rally-3b2-1` prefix).
Browser traces stay disabled; generated artifacts and local credentials are not committed.

## Security regression details

- Real same-origin browser GET with no Origin succeeds; exact Origin API clients still
  work. Bad-target/contradictory contexts and absent trust evidence reject.
- Correct cookie with wrong reference/intent binding, another guest, missing/revoked
  capability and unknown/malformed identifiers produce the same 404 JSON with
  private/no-store/no-referrer. No name, contact, hash or internal customer ID in errors.
- Natural capability expiry is tested with database deadlines; a forced stale cookie
  still cannot authorize a read. No clock/trigger/security control was disabled.
- Browser pages on both another port (same-site) and localhost versus 127.0.0.1
  (cross-site) cannot read private status despite using the victim browser context.
  No permissive CORS or read admission is created by those preflight attempts.
- Forged same-origin headers without a cookie, or with a canonical but incorrect bearer,
  still fail. Fetch Metadata is context evidence, never capability authentication.
- Explicit foreign/null Origin, cross-/same-site metadata, no-cors and iframe targets
  fail uniformly even with the correct cookie. Forwarding headers cannot override the
  configured target in unit probes (host/scheme/port mismatch).
- Read metadata without Origin does not admit POST to intent, quote or reservation
  endpoints: all three return 403. Existing mutation CSRF/Origin tests remain green.
- Invalid intentId/courtId/quoteId JSON types, malformed Idempotency-Key, reference and
  X-Guest-Intent reject before corresponding DB admission. Valid UUID strings can then
  create and replay one hold with the same receipt; malformed attempts consume none.

## Remaining risks / Phase 3B.3 recommendation

These fixes close the verified R1/R2 behavior; they do not establish public readiness.
Clients without both Origin and Fetch Metadata fail closed. Local API clients can supply
an exact Origin; older browser support requires a separately reviewed approach rather
than a silent trust fallback. Raw HTTP tools can forge context headers, so capability
and SQL binding checks remain necessary. Local cookies do not isolate ports by hostname.

Privileged service-key isolation, trusted public attribution/limits, clock/TLS/proxy/log
review, body-read timeouts, quota-preserving rotation, lost-credential recovery and
owner-approved commercial/contact/privacy/retention/security settings remain unresolved.
Autonomous physical hold release, cleanup and worker health are still absent; no new SLA
is claimed. Retention markers/immutable rows need a narrow audited cleanup design.

Recommendation: **go for review of these corrections**, then separately authorized local
Phase 3B.3 expiry/retention/worker concurrency and monitoring. Preserve court→booking lock
order and immutable receipts; never reacquire guest intent/limiter locks in reverse from
an expiry worker. No-go for public booking/payments/production until launch gates close.

`vercel.json` disables Git deployment for `phase-3b2-1-security-fixes` and preserves its
base-branch opt-outs. No push, merge, Vercel action, production connection, real customer
collection, payment, owner-demo modification or Phase 3B.3 implementation was performed.
