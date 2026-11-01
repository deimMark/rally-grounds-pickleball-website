# Phase 3 proposal — real guest reservation holds

Status: **review only; not implemented or authorized by the publication task**.
Baseline: approved implementation `6ef2aed7a473eabbf0b630f4a1674ed9d6578439`.
See [publication review](qa/phase-2/PUBLICATION-REVIEW.md), ARCHITECTURE.md,
ROADMAP.md and DECISIONS-AND-RISKS.md. Preserve the single-club deployment model,
server/database authority, staff RBAC, UTC storage and Asia/Manila evaluation.

## Outcome and limits

Replace the mock public selector with database-backed availability, accepted public
quotes, account-free guest creation of real unpaid reservation holds, private status
access and autonomous expiry. No customer Auth account is required.

A hold is not a verified/confirmed paid reservation. Payment screenshots, manual GCash
verification, payment/refund ledgers and paid-confirmation transitions stay in Phase 4.
No real payment collection or guest production launch occurs just because a local hold
workflow works. Google Calendar, Reclub sync, rescheduling approvals, CRM and the owner
settings UI remain outside this phase. No production project, scheduler provisioning,
merge or deployment is authorized by approval of local implementation alone.

## 3.0 — Policy and foundation gates

1. Resolve R1: valid configurable durations must agree between quoting, availability and
   creation. Extend the service to consider the selected duration; validate unsupported
   combinations/publication bounds. Keep a technical query bound separate from a
   commercial maximum duration.
2. Resolve R3 with a minimal authorized block-release RPC and tests. Keep full event UI
   later; never grant direct table mutation to anonymous users or staff.
3. Confirm public lead-time equality at 60 minutes, payment cutoff, minimum opportunity
   to pay, operating hours, booking horizon, duration limits and required guest contact.
   Store decisions as effective policy versions. Do not turn null into a silent default.
4. Approve guest-intent/capability TTL, retry/retention periods and abuse budgets as
   configuration. Confirm a privacy notice and legitimate minimal data collection.
5. Decide how a real unpaid hold is presented without Phase 4 payment handling. In local
   testing, use synthetic guests; live opening requires the corresponding payment and
   operational process, not an artificial "payment successful" demo action.

Independent work can proceed on schema/security/testing while owner decisions are
pending. Guest booking activation must fail closed for missing required live policy.

Acceptance: the 90/60 counterexample either produces legal selectable durations or is
rejected with a clear configuration error; seeded 60/60 behavior still works. Closures
can be safely released and audited without weakening conflict/RLS protection. All newly
confirmed rules are versioned and unresolved commercial values remain explicit.

## 3.1 — Guest scope, customer records and atomic persistence

Add reviewed additive migrations for a private guest intent/capability and guest request
idempotency scope, booking-to-guest/customer associations, and constrained actor/audit
metadata. Preserve legacy staff rows and immutable agreements. A guest must not be
represented as a shared employee Auth user, and `source=guest_web` is assigned server-side.

Proposed simple credential flow:

- Establish a high-entropy (at least 256-bit) per-booking-intent capability before the
  create POST and store its hash, expiry and scope. The browser receives the credential
  in a Secure-on-HTTPS, HttpOnly, SameSite cookie; identifiers alone cannot authorize.
- Bind the intent to exactly one resulting booking atomically. The same pre-issued
  credential permits creation retry and subsequently only that booking's private status.
  A lost creation response therefore does not require storing or replaying a plaintext
  bearer token in the idempotency result.
- Define the approved bounded recovery flow if the original cookie is lost/expired.
  Reference/phone/email guessing must never reveal records; staff-assisted recovery
  remains acceptable until a separately approved delivery/verification channel exists.
- Store only approved name/contact fields. Do not automatically merge customers or
  expose histories based on an unverified matching phone/email. Bind a new/private
  customer association or a deliberately reviewed staff matching process.
- One transaction performs authorization, policy/quote revalidation, abuse-budget check,
  customer association, booking/agreement/item/occupancy insert, idempotency result and
  redacted audit. Failure leaves no orphan customer, capability binding or occupancy.

New tables use RLS and explicit grants. Anonymous Data API users still cannot directly
write customers/bookings or invoke a privileged guest mutation RPC. A narrow server
boundary validates the intent and calls only a whitelisted database operation; privileged
keys never enter client code. Review any service-role use explicitly because it bypasses
RLS; never accept caller-selected actor IDs, filters or arbitrary RPC names.

Acceptance: two unrelated guest intents using the same visible idempotency key remain
isolated; one intent/key/request yields one booking under retries; changed intent input
rejects. A database failure rolls back every related row. Legacy staff operations and
role checks continue to pass. Only hashes of bearer credentials are stored.

## 3.2 — Safe quote and availability endpoints

Proposed route contracts, to be finalized before implementation:

| Route | Contract |
| --- | --- |
| GET `/api/availability` | One validated club day and selected duration; bounded court/interval/bookability DTO; no customer/reference/private IDs. |
| POST `/api/quotes` | Server-calculated centavos, approved public terms, effective-version context and configured quote validity. No reservation side effect. |
| Guest intent endpoint | Establish only the scoped credential/CSRF intent, no occupancy; rate-limited and origin-checked. |
| POST `/api/guest-reservations` | Requires scoped intent cookie, accepted quote/version context and durable idempotency key; atomically creates an unpaid hold. |
| Private booking status page/read | Capability-scoped current state/terms/deadline for that booking only; no public record lookup by reference. |

Do not forward the existing staff quote unchanged: remove internal author IDs, change
notes and other administrative metadata. Likewise, availability UUIDs identify courts,
not bookings. Replace mock `court-1` identifiers with canonical court UUIDs and load
approved public layout/settings through a safe projection.

Recompute price, hours, public lead time, selected duration and quote versions in the
write transaction. The client cannot set price, deadline, paid state, source or actor.
Reject changed price/terms and require renewed acceptance. Guest lead-time checks use
database time and cannot acquire the staff last-minute exception.

Acceptance: the selected-duration calendar agrees with the quote and transaction;
boundary times before/at/after the configured cutoff are tested. Twenty independent
guests racing for one court/time yield exactly one hold and 19 controlled conflicts.
Adjacent intervals and identical times on different courts succeed. Past/closed/disabled
slots, stale quotes and forged client amounts/deadlines fail without side effects.

## 3.3 — Durable idempotency, current status and expiry

- Uniqueness covers guest intent, operation and request key, with a canonical accepted
  request fingerprint. Retry identity excludes regenerated server timing values; the
  original deadline/result is retained. Reusing a key with different input rejects.
- Resolve the distinction in R2: label the immutable creation receipt separately from
  authoritative current status. A replay after cancellation/expiry must never be shown
  as a new/current held reservation or extend the hold.
- Add a bounded `expire_due_holds` operation with least-privilege job authorization,
  consistent calendar/court/booking lock order, idempotent transitions and redacted job
  audit attribution. Keep request-path reconciliation for scheduler outages.
- Provide a restartable local scheduler runner at a one-minute cadence plus an explicit
  test tick. Production scheduling/runtime provisioning remains a separate approval.
- Use database time; no `now()` in the GiST exclusion predicate. Only unpaid eligible
  holds expire. Protect future timely evidence/pending-review states behind explicit
  Phase 4 transitions rather than silently releasing money-under-review reservations.
- Add job heartbeat/failure/retry visibility. Bound each batch, avoid overlapping job
  work and report failures rather than treating an open port/PID as readiness.

Acceptance: unpaid holds release within 60 seconds of deadline with a healthy runner;
job retries have no duplicate releases/audits. With the runner paused, a valid new write
can reconcile the expired hold. Lost-response/reload retries retain the original booking
and deadline. Expiry versus create/status/release races preserve one legal final state
and never resurrect reassigned occupancy. Current status comes from the server, not
browser countdown time or a historical cached receipt.

## 3.4 — Guest privacy and abuse controls

Use deny-by-default RLS/grants and a whitelist of public/private response fields. Treat
court/reference UUIDs as identifiers, never secrets. Private pages/responses use no-store
caching; redact credentials, contact details and request bodies from logs/audit. Avoid
third-party scripts on private status pages and use no-referrer protection. If an access
link is introduced, exchange the token into the scoped cookie then redirect to a clean
URL; never leave credentials in query history, referrers, analytics or screenshots.

Enforce origin/CSRF checks on cookie mutations and a durable shared limiter for intent,
quote, creation and private reads. Budget by appropriate session and privacy-preserving
network identifiers; document shared-network/NAT behavior. Numeric limits/retention are
reviewed configuration, not scattered UI constants. Prevent unlimited anonymous intent
or unique-key churn from holding all courts. No external CAPTCHA/messaging resources
are needed without separate approval.

Acceptance: guest A cannot view/change guest B's data by modifying reference/ID/cookie/
key or by sharing the same contact string. Random, expired, revoked and wrong-scope
credentials return safe generic responses. Direct anonymous REST/RPC/Storage access to
private records fails. Parallel processes/restarts cannot reset abuse budgets. No bearer
credential appears in stored idempotency payloads, response logs, URLs or public bundles.
Successful audited guest actions have honest guest/job actor attribution, not a fake staff ID.

## 3.5 — Public booking interface and acceptance run

Wire the five-court map/list to the real public DTO and configuration, preserving the
approved 3/4/5 above, 2 beneath 5, 1 beneath 2 layout. Support day/duration selection,
loading/error/empty/conflict/stale-quote states, minimal guest fields, clear terms and
an unpaid-hold receipt/private status page. Make the change from mock-only content
explicit; do not substitute fake success when a backend call fails.

Acceptance: Playwright completes account-free creation and private status retrieval at
390 px and desktop; refresh/back/double-submit/network-response loss create no duplicate
hold. Server-timed expiration is reflected accessibly. Keyboard/list alternatives,
visible focus and no page overflow pass at 360/390/768/1440; scoped accessibility scans
have no serious/critical findings, supplemented by manual checks.

Release evidence must include clean migration replay, existing applicable regression
suites, added unit/real DB/Auth/RLS/concurrency tests, browser flows, lint and production
build. Record actual counts/failures/skips; add regression tests for every finding in
the publication review. Use synthetic data and the designated local test database.
No payment, confirmation, notification or production deployment may be claimed from
these tests. Owner review and explicit authorization are required before starting Phase 3.
