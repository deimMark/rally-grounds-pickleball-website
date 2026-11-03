# Phase 3B.2 local review checkpoint

Date: 2026-11-03. Branch: `phase-3b2-guest-reservations`.
Base: `0e411368d37045643495d29b288953f3ebff1007`, fetched from
`phase-3b-guest-security`, exact SHA/clean tree verified before edits. Phase 3A ancestry
verified. No default/demo/backend baseline branches were moved. Local commit SHAs are
reported in delivery output and `git log`; no push/hosted CI/deployment was performed.

## Scope and design review

See [implementation and contracts](../../PHASE-3B2.md). This implements synthetic local
unpaid transactions, not public account-free booking launch. The public mock UI is
unchanged and makes no guest endpoint calls. No payment collection/paid confirmation,
GCash/upload/refund, notifications, production connection or autonomous expiry scheduler.

- One additive migration, eight total cleanly replayed. Previous migrations unchanged.
  New private policy/quote/request/bucket tables use RLS with no allowing policies and
  explicit revoked direct grants, including service_role. Five service-only gateways
  independently check JWT role and use empty search_path. No arbitrary actor/function
  dispatch, anonymous guest mutation or staff impersonation.
- Truthful guest attribution: null employee creator/audit actor, guest intent and private
  customer associations, guest_web source set in SQL. Staff creation and old receipts,
  agreements, Auth, RLS, blocks, releases and policy histories remain covered.
- Durable admission/fingerprint is a separate committed transaction. Domain conflict
  and a fault at the final audit write leave no customer/booking/agreement/item/occupancy/
  binding/receipt partials, but preserve the admitted request and budget.
- Immutable quotes/receipts/agreements, HMAC fingerprints instead of contact/body copies,
  strict server projections and binding-aware reads. Raw credentials remain HttpOnly;
  reference/intent/contact values are not authentication. No customer history merging.
- Prices/versions/deadlines are recalculated in SQL, in integer centavos/UTC instants;
  Asia/Manila scheduling and selected duration agree. Policy/price/closure changes or
  expired quotes require review. Client financial/actor/deadline authority is rejected.
- Shared and per-intent operation budgets persist in PostgreSQL; concurrent holds also
  serialize their local shared active allowance. Forwarded headers supply no identity.
  This remains conservative local-shared limiting, not production per-client protection.

## Actual final validation

| Check | Pass | Fail | Skip |
| --- | ---: | ---: | ---: |
| Real local Supabase/PostgreSQL integration | 94 | 0 | 0 |
| Vitest unit tests | 112 | 0 | 0 |
| Playwright browser/API tests | 37 | 0 | 0 |

DB count: 70 preserved tests plus 24 new scenarios. Browser count: 29 preserved tests
plus eight new HTTP suites. Unit count: 96 preserved plus 16 normalization/boundary cases.
Fixture resets were expanded for new FK tables; existing assertions were not weakened.
One Playwright worker prevents separate files racing mutable database fixtures.

- `npm run db:reset`, `db:staff`, `db:guest`: passed on designated local stack. No migration
  enables guest policies; guarded explicit synthetic bootstrap is required. Clean replay
  includes `20261103000200_guest_reservations.sql` and all seven prior migrations.
- `npm run test:integration`: 94/94; PostgreSQL/PostgREST/Auth, no mocked database.
  Both 20 independent SQL guests and 20 independent HTTP guest sessions produce exactly
  one hold and 19 controlled conflicts, with no orphan customers/bindings.
- Twenty identical SQL retries and twenty identical HTTP retries produce one booking,
  immutable receipt and unchanged hold deadline. Lost-response, changed input, intent/key
  isolation, cancelled replay and naturally expired replay are covered.
- Adjacent/different-court success, open-play/maintenance rejection, 60/60 and 90/60
  consistency, stale same-price policy/price/closure/expired quotes, minimum payment
  opportunity, player limits and active hold allowance covered.
- Forged/wrong/revoked/expired capability, cross-guest/guessed-reference privacy,
  private-read budgets, anonymous/staff RPC attempts, direct private REST operations,
  explicit grants/search_path and rollback-only independent RLS probes covered.
- Natural hold expiry uses a real one-minute synthetic deadline and clock polling;
  no trigger or clock is disabled. Read/retry reports expired without resurrection,
  and the next valid writer reconciles occupancy exactly once.
- `npm run lint`, `npm run build`, `git diff --check`: passed.
- Source/untracked and staged credential-pattern scans passed. Only .env.example is
  tracked; local connection, service/HMAC and Auth fixture files remain ignored/0600.
- `npm run check:client-secrets`: actual private service/HMAC bindings absent from all
  16 compiled browser JS/map artifacts, values suppressed. Scoped scans are not proof
  against every possible secret format. Future CI runs this after build.

Local diagnostic logs: `/tmp/rally-3b2-reset.log`, `/tmp/rally-3b2-db.log`,
`/tmp/rally-3b2-unit.log`, `/tmp/rally-3b2-build.log`, `/tmp/rally-3b2-browser.log`.
These and generated test artifacts are not versioned. No private screenshot/trace exists.

During development: one test used an incorrect existing court-config RPC signature;
that fixture was corrected. Browser testing found noncanonical availability timestamps;
the server now normalizes UTC ISO output. Closure-after-quote now maps to renewed-review
conflict rather than malformed input. Final counts above supersede those failed runs.

## Security findings and residual risks

No unresolved critical/high access or atomicity defect was found by these local tests
and code review. This is not independent penetration-test certification or live approval.

1. **Privileged gateway trust (medium/local, high impact if compromised):** the service
   credential bypasses RLS on existing tables. New grants are minimal, wrappers fixed,
   no key appears in client bundles; hosted isolation/logging/least privilege need review.
2. **Public ingress/abuse protection (medium):** loopback-only configuration and default
   process binding, feature flags and Vercel branch deployment opt-out protect local
   scope. Do not publicly forward it. Origin is CSRF defense, not authentication of curl.
   No trusted public network adapter, NAT policy, edge DDoS/read-timeout protection exists.
3. **Expiry/retention/recovery (medium):** no autonomous worker or heartbeat; physical
   occupancy reconciles on writes, while reads/budgets use authoritative logical expiry.
   Immutable quote/request DELETE controls require a future narrow audited cleanup path.
   Lost responses can orphan pending technical records; bounded admissions and retention
   markers do not delete them. Lost/expired credentials have no contact/reference recovery.
4. **Policy/contact readiness (medium):** all new commercial/TTL/privacy values are
   explicit synthetic fixtures. Real email/phone and policy/legal requirements remain
   unset for live use. No owner-approved decisions were fabricated; no history merging.
5. **Hosting/rotation (before live):** dedicated TLS origin/cookie behavior through a real
   proxy, clock sync, secret/log isolation, body-read deadlines and quota-preserving key
   rotation still need independent operational validation. Local cookies do not isolate
   different services on the same hostname by port.

## Phase 3B.3 recommendation

Ready for independent review of the local checkpoint, then a separately authorized
scheduler/retention milestone: bounded least-privilege expiry under court→booking locks,
no inverse intent/limiter locking, expiry/create/read/release races, ≤60-second healthy
release, restart/outage/heartbeat monitoring and audited retention that preserves bound
agreements/receipts. Keep owner policy, contact/privacy/recovery and public hosting gates
open. Do not add payments or enable public guest booking as part of that recommendation.

## Subsequent adversarial review

See [SECURITY-REVIEW.md](SECURITY-REVIEW.md) for the later controlled publication gate,
additional failure/restart probes, two documented non-blocking defects and actual
99 DB / 112 unit / 40 browser test counts. The historical implementation results above
remain unchanged; the review does not implement the proposed corrections or Phase 3B.3.
