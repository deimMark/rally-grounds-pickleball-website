# Phase 3B.2 — local atomic guest unpaid holds

Based on reviewed `0e411368d37045643495d29b288953f3ebff1007` on
`phase-3b-guest-security`, fetched and verified before creating
`phase-3b2-guest-reservations`. Phase 3A is an ancestor; starting tree was clean.
No demo, Phase 2 or Phase 3A branches were changed. This milestone supersedes the
previous AGENTS/3B.1 prohibition on guest creation **for local synthetic tests only**.
It does not authorize live policy, public ingress, payment collection or deployment.

## What exists

Additive migration `20261103000200_guest_reservations.sql` adds private guest policies,
immutable quotes, durable scoped requests and operation buckets. All original migrations
and existing staff agreements/functions remain. No live policy is inserted by migration
or seed. `bookings` gains explicit `actor_kind` and a unique guest intent association;
legacy rows remain staff-authored, even legacy source=guest_web. Guest rows require a
private customer and intent, null employee creator and trusted guest_web source. Guest
occupancies have null employee creator only when linked to a guest booking. Existing
booking/occupancy transition and exclusion constraints are preserved.

Development/start scripts bind to 127.0.0.1 on this branch. Do not publicly forward
these services. Only loopback application/database bindings can enable the new Node route handlers:

| Endpoint | Contract |
| --- | --- |
| GET /api/availability | Exact day/durationMinutes query. PostgreSQL court UUID/layout and eligible UTC intervals/statuses; Asia/Manila scheduling. No booking/customer/event details. |
| POST /api/quotes | Strict intentId/courtId/startsAt/durationMinutes, per-intent cookie, exact Origin. Immutable private quote; public terms/version projection only. No occupancy. |
| POST /api/guest-reservations | Strict intentId/quoteId/guest/estimatedPlayers plus UUID Idempotency-Key and scoped cookie. 201 first hold, 200 valid replay; immutable receipt plus fresh current status. |
| GET /api/guest-reservations/[reference] | Exact Origin and X-Guest-Intent nonsecret UUID selector plus matching cookie. SQL checks capability AND intent/booking binding in the read transaction. Uniform 404 for absent/stranger/lost/expired/revoked access. |

The existing intent endpoint/cookies remain unchanged. Reads deliberately require exact
Origin too: local API clients must supply it; a future private page can use same-origin
fetch with this header. No guest form/status page or public selector integration exists.
The mock owner site has no calls to these endpoints. No success message claims payment
or a confirmed reservation; the only creation state is held/unpaid.

## Authorization and privacy

A server-only module contains five explicit new RPC calls. It generates no new Auth
account and never calls the staff booking RPC on a guest's behalf. Gateway RPCs grant
EXECUTE only to service_role and independently check the JWT role; all definer functions
have an empty search_path and qualified relations. New tables have RLS, no policies and
no direct grants to anon/authenticated/service_role. Staff auth/customer permissions
remain unchanged. The service credential is still broadly privileged: narrow wrappers
are not a replacement for runtime secret isolation.

The per-intent 256-bit bearer stays in the existing HttpOnly cookie, never in JSON or
URLs. Only its hash crosses the gateway. The server calculates a keyed fingerprint from
normalized intent/quote/name/contact/player input with the per-intent credential as HMAC
key. No contact/body copy is saved in the request. Customer rows alone store contact;
identical submitted contacts create separate histories and are never verified identity.
Guest audit events explicitly use a null staff actor, guest kind and nonsecret IDs.
Errors whitelist safe codes and never serialize SDK diagnostics or field values.

All API responses use private/no-store and no-referrer; Next's header rule covers API
errors as well. Mutations enforce exact configured Origin/Fetch Metadata, JSON, no query,
strict field sets, an 8192-character cookie cap and a 2048-byte streamed body cap with
strict UTF-8. Missing local flags, service/HMAC bindings, approved mode or explicit DB
policy fails closed. No forwarded network headers are trusted. Local HTTP uses the
separate development cookie; production HTTPS cookie requirements are preserved.

## Transaction and lock design

A. `guest_request_admit` commits durable shared/per-intent accounting and the unique
(intent,reservation.create,key) HMAC fingerprint. Changed payload returns conflict.
Pending requests are bounded; no customer/booking is created. Domain conflicts cannot
roll this transaction back. Completed retries consume request budget, not another hold.

B. `guest_reservation_create` revalidates capability and locks intent/request. It checks
completed receipts before stale quote/create-window checks, then validates immutable
quote scope/version/deadline, scheduling, player and synthetic-contact limits. Under the
shared local hold-budget lock and court lock it reconciles expired occupancy, recalculates
price/policy and computes the hold deadline using DB time. Customer, booking, immutable
agreement, item, occupancy, receipt, binding and redacted audit commit together. Exclusion
or any late error rolls the whole domain back. Neither API nor SQL accepts guest price,
paid state, employee actor, source or deadline authority.

Lock order: shared configuration advisory lock and security configuration row, shared
route bucket, intent, per-intent route bucket/request; creation then takes the local hold
budget advisory lock, court and booking locks. The per-intent budget is always taken
while owning that intent; no operation takes that bucket then waits for an intent.
Domain creation does not reacquire route admission locks. Staff and reconciliation use
court→booking and never acquire guest intent/limiter locks while holding courts.
Future expiry must preserve that order. Active-hold allowance uses state/deadline queries,
not counters that require an inverse-lock decrement.

A replay preserves the original receipt/deadline; current derives held/expired/cancelled
from PostgreSQL and database time. Reads may report logical expiry while physical
occupancy remains until write-time reconciliation. There is no autonomous worker yet.
Future scheduler/release races and heartbeat/failure monitoring belong to Phase 3B.3.

## Explicit synthetic settings, never live defaults

`npm run db:guest` is guarded by the designated local project/127.0.0.1 ports. It applies
`guest-booking.local.sql`, appending a synthetic base policy and guest policy, and writes
GUEST_RESERVATIONS_ENABLED=true to ignored 0600 .env.local. `.env.example` defaults off.
It does not enable any remote connection or change production resources. Re-running the
bootstrap publishes a new local policy and intentionally stales outstanding local quotes.

Synthetic values: 30-day rolling horizon, 240-minute maximum, inclusive 60-minute lead
cutoff, earlier of 120-minute window and start-minus-60-minute deadline, 60-second minimum
payment opportunity, 12 players, five shared active holds; 120-second quotes, 200 shared
requests and 40 per-intent requests per route/60-second window, ten quotes and ten pending
requests per intent, 86400-second retention markers. Original intent fixture remains
300/900-second creation/access expiry and five active intents/cookies. These numbers
are testing choices only. Settings are versioned and required, not null-as-unlimited.
Public terms are an explicit synthetic notice/privacy/cancellation/hours allowlist.
Partial refund percentage remains unset and manual/undecided terms remain visible.

Only invented names and `example.invalid` email addresses are accepted. The HTTP shape
uses contact.kind=email; the policy's synthetic_email marker makes its limited meaning
explicit. Real contact domains and phones are rejected. A phone parser/default country,
real email collection policy, identity verification and contact recovery are deliberately
not implemented; no notification is sent. This is a documented local subset of the full
contracts, not a claim of live contact support.

## Local validation and residual gates

Use db:start, db:reset, db:staff, db:guest, then test:integration; reapply db:guest before
browser/API tests and interactive use. The suites mutate local fixtures and must run
sequentially. Playwright uses one worker to prevent separate files racing shared fixture
resets; existing assertions remain. Browser traces stay disabled. See
[actual QA results](qa/phase-3b2/REVIEW.md).

No autonomous expiry/cleanup/recovery, uploads, GCash, refunds, messaging, frontend guest
booking, trusted public attribution or public commercial policy exists. Local shared
limits are not per-IP production protection or DDoS defense. Invalid HTTP/Origin rejects
may happen before DB accounting. Quote validation errors roll back their quote transaction;
reservation domain errors retain their separately committed request admission.

Retention timestamps are eligibility markers, not deletion. Immutable quote/request
triggers currently prohibit normal deletes; Phase 3B.3 needs an audited, narrowly authorized
bounded retention operation, preserving bound booking agreements/receipts. Do not bypass
triggers or delete booking history as a cleanup shortcut. Local access expiry can precede
the booking's service time; lost/expired capabilities have no recovery endpoint.

Before live use: owner-approved hours/cutoff/horizon/duration/player/hold/contact/payment
opportunity/privacy/retention/security TTL and quota values, approved legal terms,
service-secret isolation, dedicated TLS origin/proxy attribution, body-read deadlines,
clock sync, observability redaction and quota-preserving key rotation remain unresolved.
No part of local test success waives these gates. `vercel.json` disables Git deployment
for both this branch and its base. No push or deployment is authorized in this task.
