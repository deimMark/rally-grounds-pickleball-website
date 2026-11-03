# Phase 3B proposed guest booking contracts

Status: **full-flow contracts with a synthetic local Phase 3B.2 subset implemented**.
See [Phase 3B.2](PHASE-3B2.md) and [QA](qa/phase-3b2/REVIEW.md) for actual implementation
scope/evidence. Local intents, quotes, unpaid holds, scoped idempotency and private status
exist; no public guest UI, live contact collection or autonomous scheduler exists. The
public selector is mock-only. Local policy/security fixtures do not waive owner approval
or live-readiness gates below. Earlier Phase 3B.1 reports remain historical evidence.

## 1. Admission and policy readiness

Guests do not create Supabase Auth accounts. A booking reference, contact string or
court UUID never authorizes access. Keep the existing anonymous table-write prohibition.
Guest creation must run through a narrow server-only gateway and independently guarded
SQL functions, not through the staff creation RPC with a shared/fake employee identity.

Before enabling guest admission, a published policy must resolve operating hours,
public lead-time equality, payment cutoff/minimum payment opportunity, advance horizon,
maximum duration/players/active holds and the minimum required contact fields. Preserve
null/undecided values; require an explicit owner decision before interpreting null as
unlimited. Existing partial-refund uncertainty must not become an invented percentage.
Approved public contractual wording must describe any undecided/manual-review term.

Security settings must define intent/create/access TTLs, quote validity, request/limiter
retention and abuse budgets. Missing required settings return `503 POLICY_NOT_READY`;
local tests use explicit synthetic settings, never implicit production defaults.
Live payment/paid-confirmation, uploads and refunds remain Phase 4; this contract creates
**unpaid holds only**. No production launch, infrastructure or messaging is authorized.

## 2. Private credential and cookie contract

`POST /api/guest-intents`, same-origin JSON with no customer fields, establishes:

- Server-generated UUID intent ID plus 32 random bytes (256 bits) from a cryptographic
  RNG. Return the intent ID and expiry, never the raw credential in response JSON.
- Store only SHA-256 of the random credential, its scope/expiry and later booking binding.
  Hashes and bearer values are private, excluded from logs, analytics and audit payloads.
- Set `__Host-rg-intent-<uuid>` on HTTPS: Secure, HttpOnly, SameSite=Lax, Path=/, no Domain.
  Use a clearly separate `rg-intent-<uuid>` development name only on approved loopback
  HTTP origins; never weaken HTTPS cookie settings. Max-Age follows approved access TTL.
- Per-intent names support multiple tabs/bookings within configured intent/cookie budgets.
  A body/path intent UUID selects a cookie name, never supplies a trusted actor. Validate
  its UUID syntax, credential hash, scope and expiry on the server and in the gateway RPC.
- Before binding, the capability permits only its own quote/create/retry flow. Bind it
  to exactly one booking atomically; after binding it permits only that booking's status
  and replay. Do not broaden it to customer history or another booking.
- Separate `create_expires_at` from `access_expires_at`. Access expiry may cover viewing
  the resulting receipt, but cannot extend a hold. Values require approved configuration.
- A lost creation response reuses the pre-issued cookie, avoiding plaintext token storage
  or new token generation in the immutable idempotency receipt. Never rotate on replay.
- Lost/expired credentials require a separately approved recovery process. Reference,
  phone or email alone must not recover access. No SMS/email provider is assumed.

No credential belongs in a URL, localStorage, hidden HTML input, client error or user-facing
screenshot. Use no-referrer protection and no third-party scripts on private pages.
Only nonsecret intent/request identifiers may be held in client form state.

## 3. Persistence, actor and privilege contracts

Proposed additive private/RLS tables (no anonymous/authenticated direct access):

| Record | Required state and invariants |
| --- | --- |
| `guest_intents` | ID, credential hash, create/access expiries, revocation, nullable unique booking binding; bind once, never substitute a staff Auth ID. |
| `guest_quotes` | ID, intent FK, court/UTC interval/duration, centavo total, safe public terms plus internal version context, validity; immutable accepted quote context. No customer fields. |
| `guest_booking_requests` | Intent FK, operation, UUID key, canonical keyed request fingerprint, pending/completed state, immutable completed creation receipt and booking FK. Unique intent/operation/key. |
| `guest_rate_buckets` | Route/scope/window, privacy-preserving network or intent key, atomic count, expiry/key version; no raw contact or bearer values. |

Extend bookings with explicit actor kind and guest-intent association. Legacy records
remain staff-authored; do not infer actor kind from the existing source field. A guest
row has no employee `created_by`, has a valid intent/customer association, and gets
`source=guest_web` only from trusted code. Add checks while preserving historical rows,
agreements and staff RPC behavior. Audit guest actions with truthful guest/intent metadata,
not a fake staff identity. Keep customer, agreement and receipt data private.

The proposed gateway uses a **server-only privileged Supabase client**, restricted in
application code to explicit guest RPC names and whitelisted arguments. No arbitrary
filters, actor IDs, function names or body-supplied credential hashes/fingerprints pass
through. Anonymous and ordinary staff JWTs cannot execute those new guest mutation RPCs.
Every RPC also validates capability hash/scope, intent binding and transaction invariants.
A service credential bypasses RLS: this risk requires explicit review, minimal code scope,
secure runtime storage and tests. It is not a narrowly privileged credential merely
because the module is named "guest". Never place it in NEXT_PUBLIC/client code.

Inspect existing secure bindings before asking for new values. Do not put values in chat,
source or setup instructions. A proxy placeholder is not raw cryptographic key material;
any server-local HMAC key must use a runtime binding/store that actually supports it.

## 4. Public HTTP contracts

All JSON bodies reject unknown fields and oversized/malformed input. Enforce the exact
configured Origin for cookie mutations, same-site credentials and CSRF intent binding.
CORS is not authorization. Do not derive trusted origins or network identity from
unvalidated caller Host/X-Forwarded-* headers.

| Endpoint | Request | Success/behavior |
| --- | --- | --- |
| `POST /api/guest-intents` | Empty JSON; shared admission budget | `201 {intentId,createExpiresAt,accessExpiresAt}` + HttpOnly cookie; no occupancy. |
| `GET /api/availability` | Strict ISO `day`, integer `durationMinutes`, one club day | `200 {day,durationMinutes,timezone,courts,slots}` using canonical court UUIDs and public layout. Duration must satisfy policy; never silently turn invalid input into no slots. |
| `POST /api/quotes` | `{intentId,courtId,startsAt,durationMinutes}` + capability | `201 {quoteId,courtId,startsAt,endsAt,durationMinutes,totalCentavos,currency,terms,versionContext,validUntil}`. Server-calculated, no reservation side effect. |
| `POST /api/guest-reservations` | `Idempotency-Key: <uuid>`; `{intentId,quoteId,guest,estimatedPlayers}` + capability | First success `201 {receipt,current,replayed:false}`; valid replay `200` with identical receipt and fresh current state. |
| `GET /api/guest-reservations/<reference>` | Matching per-intent capability cookie | `200 {receipt,current,agreedTerms}` for that booking only; reference is a lookup identifier, not access proof. |

`guest` is `{name,contact:{kind,value}}`; permitted/required contact kinds come from
approved collection policy. No public search/list/history endpoint. A private status
page can consume the final read route; URLs contain no bearer secret.

Public quotes must not expose the existing staff quote wholesale: exclude author IDs,
change notes and administrative fields. Whitelist the approved public policy terms and
version identifiers. Public availability contains court identity/layout, UTC intervals,
club timezone and public eligibility/status reasons only; no booking ID/reference,
customer, internal event details or financial evidence.

Creation ignores no financial authority: reject body fields for total, deadline, source,
actor, paid state or server fingerprint. Load the stored scoped quote and recalculate
in PostgreSQL. Use database time for lead-time, quote validity and hold expiry. Staff
last-minute authority cannot be acquired by a guest route or a caller flag.

## 5. Atomic creation and durable idempotency

Use two explicit persistence boundaries so a failed reservation cannot erase abuse
accounting or permit changed input under an admitted key:

1. A short admission transaction validates capability and shared request budget and
   reserves `(intent,operation,key)` with a canonical keyed request fingerprint. No
   customer/booking/occupancy is created. Same key/different fingerprint returns 409.
   Derive the fingerprint server-side from normalized accepted input; do not store raw
   contact/body copies in the idempotency payload. A keyed digest may use the per-intent
   credential as its HMAC key, avoiding a low-entropy contact dictionary digest.
2. The domain transaction locks the intent/request and the relevant court, checks a
   completed receipt **before** revalidating old quote time/deadline, then revalidates
   quote versions, current policy, public lead time and active-hold budget. It atomically
   inserts customer association, booking/agreement/item/occupancy, completed receipt,
   intent binding and redacted audit. Conflict/failure leaves no partial domain rows.
   The small pending admission may remain for bounded retry/cleanup; it is not a hold.

One intent can produce at most one committed booking. A completed intent plus another
key/input returns `409 INTENT_ALREADY_BOUND`, not another hold. A stale quote requires
renewed acceptance and a new request key while the unbound intent is still valid.

Fingerprint input is the canonical intent, quote ID, normalized contact/name and player
count. Client and server timing estimates are not included. Compute and persist the
actual deadline once on first successful creation. Retry never recomputes or extends it.
A retry after cancellation/expiry returns the original creation receipt with current
`cancelled`/`expired`, even if the original quote is now expired.

Receipt DTO: `{reference,createdAt,totalCentavos,currency,expiresAt,stateAtCreation}`.
Current DTO: `{status,expiresAt,observedAt}` plus only approved safe next-action labels.
No internal customer ID, staff ID, credential, capability hash or notes appear. A fresh
current state is read from the database using its clock; a browser countdown is display
only. The immutable receipt is never described as a live confirmation.

Define one lock order across admission, creation and expiry: shared configuration lock,
canonical limiter rows where needed, intent/request, sorted courts, booking rows. The
expiry worker must not acquire intent/limiter locks while holding court locks in the
opposite order. Derive active-hold budgets from authoritative deadline/state predicates
rather than counters that require inverse-lock decrements during expiry.

## 6. Contact and privacy contract

- Collect name and the minimum approved contact channel, no customer account, wallet
  password, payment proof, ID document, marketing profile or unnecessary player names.
- Trim/normalize text consistently before fingerprinting and storage; name stays within
  the existing 120-character bound. Validate phone using a maintained parser/default
  country from approved club configuration and store canonical E.164; email validation
  is bounded to 254 characters, with domain normalization and no outbound verification
  assumption. Validation errors identify the field without echoing its value.
- A contact value is not an authentication factor or verified ownership. Do not merge
  customer histories merely because another guest supplied the same phone/email.
- Keep contact only in private customer records linked to the booking; no contact in
  public DTOs, URLs, idempotency results, logs or audit metadata. Existing owner-only
  customer access remains until staff CRM permissions are explicitly reviewed.
- Retention/deletion exceptions for agreements/financial history require an approved
  policy before live collection. Limit pending intents/quotes/request fingerprints
  and limiter retention separately from customer/booking retention.
- Private endpoints/pages use no-store caching and no-referrer; errors do not reveal
  whether a stranger's reference/contact exists. No third-party analytics on private pages.

## 7. Shared rate-limit contract

Implement durable PostgreSQL admission buckets shared across processes/restarts. Routes
use separate configured budgets for intent creation, quotes, creation/replays and private
reads, plus active intents/holds. Do not rely on process memory or a guest-supplied cookie
count alone. Combine verified intent scope with a privacy-preserving network bucket,
accounting for shared-club Wi-Fi/NAT behavior.

The server must obtain network identity only through the approved hosting proxy chain.
Hash/HMAC identifiers with approved protected key/version handling; do not log raw IPs
or rotate keys in a way that resets an active abuse window. Absent valid limiter config,
untrusted network attribution or limiter-store failure must not silently grant unlimited
creation. Fail closed with a safe retryable response and operational diagnostics.

Every request, including retries, consumes an appropriate request budget; a completed
retry never consumes another active-hold allowance or extends the hold. Persist admission
accounting even if the reservation conflicts. Expired holds stop counting by database
time even if the future sweeper is delayed. Quotas and TTLs are configuration, not new
commercial defaults. No CAPTCHA/messaging service is provisioned without approval.

## 8. Error and expiry contracts

| Condition | Public outcome |
| --- | --- |
| Malformed/unsupported selected duration | `400 INVALID_REQUEST` / `DURATION_UNSUPPORTED`, no sensitive echo. |
| Missing/invalid/wrong-scope creation credential | `403 GUEST_ACCESS_REQUIRED`, no account/reference disclosure. |
| Private status absent/unauthorized/expired credential | Uniform `404 ACCESS_UNAVAILABLE`, no existence leak. |
| Court conflict | `409 SLOT_UNAVAILABLE`, refresh safe availability. |
| Changed accepted terms/price or expired quote | `409 QUOTE_REVIEW_REQUIRED`, no hold until renewed acceptance. |
| Same key changed input / already-bound intent | `409 REQUEST_MISMATCH` / `INTENT_ALREADY_BOUND`. |
| Authorized but unbound intent create window elapsed | `410 INTENT_EXPIRED`; creating a new intent does not revive any old hold. |
| Shared quota exceeded | `429 RATE_LIMITED` + safe Retry-After, no other visitor counters. |
| Required policy/connection/limiter unavailable | `503 POLICY_NOT_READY` / `TEMPORARILY_UNAVAILABLE`, never fake success. |

Before public admission, distinguish unsupported configuration from bad user duration
in the gateway error mapping; Phase 3A exposes the combined internal code
`INVALID_DURATION_OR_POLICY`. A truly closed day may return an empty valid calendar;
an invalid policy must not masquerade as a fully booked day.

Autonomous expiry is still required in 3B: bounded least-privilege sweeps, one-minute
local cadence, idempotent release/audit, restart/failure/heartbeat checks and database
clock. Healthy operation must release within 60 seconds. Preserve request-path fallback
and the unchanged receipt/current distinction during scheduler outages. No production
worker provisioning or future payment-review transitions are authorized by this contract.

## 9. Phase 3B acceptance matrix

- Twenty independent guest intents racing for one court/time: exactly one committed
  hold, 19 controlled conflicts, no orphan customers/intent bindings. Adjacent intervals
  and identical times on different courts succeed.
- Twenty same-intent/key retries, lost-response retry, reload and delayed replay produce
  one booking/deadline. Changed input fails; different guest scopes cannot collide or
  disclose each other's records. Cancelled/expired bookings are never reactivated.
- Quote/availability/creation agree for 60/60, 90/60 and selected multi-hour sessions;
  unsupported configurations and stale same-price terms reject explicitly.
- Direct anonymous/private table and guest mutation RPC attempts fail; guest A cannot
  access B using a guessed reference, matching contact, copied key or wrong cookie.
  Expired/revoked/wrong-scope tokens, Origin/CSRF attacks and oversized fields fail safely.
- Parallel processes and restarts do not reset admission limits. Conflict attempts count
  against the request budget; completed retries do not acquire another hold allowance.
- Scheduler races with create/read/release preserve one final state; stopped workers do
  not block a valid request-path reconciliation. No credentials/PII leak in artifacts.
- Account-free browser flow passes at 390 px and desktop, including network/empty/error/
  conflict/stale-term states, keyboard access and scoped accessibility checks. No dummy
  "payment successful" or paid-confirmation action.
- Clean migration replay, upgrade preservation, real Auth/RLS/DB tests, units, existing
  browser tests, lint, production build and credential scan all pass with exact counts.

Commercial confirmations, privileged gateway review and explicit Phase 3B authorization
remain required. No part of this document claims that those future features already work.
