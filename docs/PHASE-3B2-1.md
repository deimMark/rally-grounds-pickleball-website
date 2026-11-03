# Phase 3B.2.1 — browser status and UUID security corrections

Local-only corrections on `phase-3b2-1-security-fixes`, based on verified remote/local
`22fb656f7c7c1dbcc35f23063aea2822c1aeecc7`. Starting tree was clean; Phase 3B.1 ancestry
was verified before creating this branch. Scope supersedes the previous review-only
AGENTS authorization: fix R1/R2 and commit locally, without push/merge/deployment or expiry.
Read the [previous review](qa/phase-3b2/SECURITY-REVIEW.md) for original reproductions.

## R1: a dedicated private GET trust policy

Before: `/api/guest-reservations/[reference]` reused the mutation policy and required an
explicit Origin. A real same-origin browser fetch omitted that forbidden-to-JavaScript
header, so legitimate capability holders received 404 even though API clients worked.

After: `trustedGuestRead` admits only GET requests to the configured trusted target.
It reuses known Next internal loopback/bind-address normalization for target comparison
(protocol and port included). Browser Origin is never normalized or inferred from Host,
X-Forwarded-Host, X-Forwarded-Proto or a caller's network identity.

| Evidence | Read result before capability authorization |
| --- | --- |
| No Origin, Sec-Fetch-Site=same-origin | Allowed for ordinary browser fetch. |
| Exact configured Origin, Fetch Metadata absent | Allowed for explicit local API clients. |
| Exact Origin and metadata present | Allowed only if metadata also agrees. |
| Foreign/empty/null Origin, cross-site/same-site/none/unknown site | Rejected uniformly. |
| Neither Origin nor same-origin site evidence | Rejected; no implicit legacy-client fallback. |
| Mode present | Must be cors or same-origin; navigation/no-cors/embed attempts reject. |
| Destination present | Must be empty (fetch), not document/iframe/image. |
| Target scheme/port/host mismatch | Rejected regardless of forwarding/trust headers. |

These headers are browser context checks, **not authentication**. Non-browser callers can
forge metadata but still need the real, unexpired, unrevoked HttpOnly capability cookie.
The nonsecret X-Guest-Intent selects that cookie only. SQL continues to revalidate its
hash, scope, deadline and intent/request/booking binding in the protected status RPC.
Unknown reference, wrong binding, malformed selector, forged/expired/revoked/missing
capability and disallowed read context retain uniform `404 ACCESS_UNAVAILABLE`, without
PII or reference-existence details. Rate and infrastructure errors retain their separate
safe codes. Private/no-store/no-referrer and no permissive CORS are unchanged.

POST intent, quote and reservation requests still use `trustedGuestRequest`: exact
Origin is mandatory and contradictory Fetch Metadata rejects. The GET policy cannot be
used to authorize a POST, and no browser JavaScript attempts to set Origin. Older clients
without either signal must use an approved server/API path; no unsafe fallback is added.

## R2: string-only UUIDs before admission

Before: RegExp.test coerced UUID arrays into strings. Downstream UUID parsing rejected
these requests, but malformed reservation requests could already have persisted a pending
admission/fingerprint and consumed request budget.

After: the UUID regex is private behind `isGuestUuid`, which first requires a primitive
string. Both quote fields (intentId/courtId), reservation fields (intentId/quoteId), route
reference, X-Guest-Intent/cookie selector and Idempotency-Key use that predicate. Cookie
naming rejects invalid types too; the server reservation service additionally guards its
request key before constructing a privileged client or fingerprinting. Arrays, objects,
boxed strings, numbers, booleans, null/undefined and malformed strings are not coerced.

HTTP header/path values are necessarily strings; serialized arrays/objects or combined
keys are still invalid UUID strings. Guest JSON fields retain their original strict field
sets and technical limits. Malformed UUIDs reject before request admission or domain
writes; malformed private selectors/references reject before the read RPC/budget.

Valid canonical inputs normalize to exactly the same projection and field order as before.
The HMAC algorithm/key, request scope, immutable receipts, agreed terms, hold deadlines,
current-state reads and replay order are unchanged. Native PostgreSQL UUID parsing and
all constraints/privileges remain in place. No migration or booking SQL was changed.

## Files and validation

- `lib/server/guest-security.js`: GET-specific trust and typed cookie naming; shared target
  comparison retains POST trust requirements.
- `lib/domain/guest-reservation.js`: string-only predicate and strict quote/create fields.
- `lib/server/guest-reservations.js`: typed capability selector and request key boundary.
- `app/api/guest-reservations/route.js` and `[reference]/route.js`: typed key/reference and
  dedicated read trust.
- `tests/unit/guest-security-fixes.test.js`: trust/type matrix, target/forwarding rejection,
  POST separation and no coercion/privileged-client access on bad keys.
- `tests/e2e/guest-reservations.spec.mjs`: corrected earlier R1/R2 reproductions and five
  expanded real-browser/API scenarios. Existing unrelated assertions remain intact.
- `vercel.json`: this branch's Git deployment disabled; previous disabled entries retained.
- AGENTS and review/implementation documents: current scope, exact behavior and evidence.

See [QA results](qa/phase-3b2-1/REVIEW.md) for actual counts and commands. Only guarded
synthetic local Supabase/Auth and Chromium were used. Public UI stays mock/disconnected.
All eight migrations and staff/booking/security/RLS functions remain unchanged.

## Remaining gates and next milestone

No autonomous expiry scheduler, heartbeat, cleanup, payment, public ingress, real contact
collection, recovery, notification or production resource is implemented. Retention
markers do not delete records; immutable quote/request deletion needs a later reviewed,
bounded authorized operation. Service-key isolation, trusted public attribution/NAT limits,
key rotation, hosted TLS/logging/read-timeouts and owner-approved commercial/contact/
privacy/retention/security policies remain live-launch gates. Local cookies do not isolate
other services on the same hostname by port. GET metadata is not network-client identity.

Recommendation: review these corrections, then separately authorize local Phase 3B.3
expiry/retention/worker concurrency and monitoring. Keep court→booking lock ordering,
immutable receipts and database-time deadlines. Do not acquire intent/limiter locks in
reverse while holding courts. No public launch follows from these corrections.
No push, merge, deployment, owner-demo modification or Phase 3B.3 implementation here.
