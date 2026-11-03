# Phase 3B.1 — local guest access foundation

Implemented locally on `phase-3b-guest-security`, based on verified reviewed Phase 3A
`3e9a94c724f430bab9df4bd7107dfae659966cf4`. The starting working tree was clean and
remote Phase 3A matched that exact SHA. No merge from the visual/demo branch was made.
No push, deployment, Vercel action or production Supabase change is authorized/performed.

## Scope reconciled with the full 3B contracts

This implements only intent admission and internal intent capability authorization from
[the full proposal](PHASE-3B-CONTRACTS.md). Public booking policy readiness remains a
later gate: this milestone explicitly allows synthetic local technical intents without
inventing live commercial rules. It creates no quotes, holds, reservations, customers,
contacts, payment records or public status access. The public selector remains mock data.

The privileged gateway proposed in the contracts is implemented for two explicit RPCs.
It uses the local service binding, not a shared staff account. A service key is broadly
privileged/RLS-bypassing; naming its wrapper does not reduce that authority. New private
tables have no direct grants even to service_role. The narrow RPCs use definer authority,
require the service JWT role independently, validate inputs/configuration and expose
only their limited results. Review this credential boundary again before any live use.

## Additive database model

Migration: `supabase/migrations/20261103000100_guest_intent_security.sql`.
All original Phase 2/3A migrations, bookings, agreement snapshots and functions remain.

| Private table | Purpose |
| --- | --- |
| `guest_security_config` | Disabled-by-default singleton, no live TTL/quota defaults; purpose restricted to `synthetic_local_only`. Explicit configured TTLs/window/quotas/retention and HMAC-key fingerprint. Invalid enabled settings rejected by CHECK constraints. |
| `guest_intents` | UUID, SHA-256 credential hash, immutable scope/deadlines, separate create/access expiries, revocation, unique nullable booking FK, opaque limiter key and retention marker. No contact/customer fields. |
| `guest_rate_buckets` | Atomic, persistent fixed-window request accounting keyed by an opaque HMAC identifier; bounded counter and deletion marker. No raw IP, credential or customer data. |

All three tables enable RLS, have no allowing policies and explicitly revoke ordinary
and service-role direct table grants. They are outside the exposed public schema.

The intent trigger prevents changing its hash, identity, scope, timestamps or deadlines;
revocation cannot be undone and a non-null booking binding cannot change/be removed.
The unique booking FK prevents two intents binding one booking. There is no supported
binding operation yet. A synthetic staff booking tests that constraint only; guest
reservations still cannot be created through existing staff-authored booking functions.
The actor-kind/guest-created_by booking migration is deferred to 3B.2, not faked here.

RPCs:

- `guest_intent_admit`: service-only, validates configuration/key binding and arguments,
  serializes each local network bucket, increments its database-time fixed window, checks
  request/active-intent/cookie budgets, creates one intent and redacted audit atomically.
  Quota denial returns an outcome rather than raising/rolling back its accounting.
- `guest_intent_authorize`: service-only boolean predicate for `create` or `access`.
  Missing, forged, mismatched, expired, revoked and unsupported scopes return false.
  `create` also requires the creation deadline and an unbound intent; `access` respects
  its separate expiry. Disabled configuration rejects authorization.
- `revoke_guest_intent`: active owner only, idempotent revocation and one transition audit.
  Staff/anonymous users cannot revoke. No broad table mutation permissions were granted.

Guest creation audit has null Auth actor, `actor_kind=guest` and the intent UUID/scope.
Owner revocation has the actual owner actor. Hashes, bearer values, raw addresses and
contacts are excluded. Existing append-only audit controls are preserved.

## Server and HTTP boundary

Only new route: `POST /api/guest-intents`, Node.js runtime.

1. Feature enablement, approved local mode, exact loopback APP_ORIGIN, loopback database,
   real 32-byte local HMAC binding and service binding must be configured; otherwise 503.
   Public origins/databases and unknown attribution modes fail closed. Default is off.
2. Exact browser Origin must match configured APP_ORIGIN. If Fetch Metadata is supplied,
   it must be same-origin. No permissive CORS, client Host/X-Forwarded trust or CSRF bypass.
   JSON-only empty objects, no query parameters, 512-byte streamed body limit, bounded
   Cookie header, strict encoding/type and rejection of unknown fields prevent contact
   collection. Unsupported methods return 405; preflight grants no cross-origin access.
3. Generate an independent UUID and 32 CSPRNG bytes server-side. Only SHA-256 of the raw
   bytes reaches PostgreSQL. Cookie uses canonical base64url. New requests/retries consume
   admission budget; there is no booking idempotency promise at this stage.
4. Return 201 `{intentId,createExpiresAt,accessExpiresAt}` and the private per-intent cookie.
   400 invalid input, 403 Origin/CSRF denial, 429 quota with Retry-After, or safe 503 on
   unavailable policy/provider. Errors never echo SDK details, request values or secrets.

HTTPS cookies: `__Host-rg-intent-<uuid>`, Secure, HttpOnly, SameSite=Lax, Path=/, no Domain.
Approved loopback HTTP uses separate `rg-intent-<uuid>` names and HttpOnly/Lax/Path=/.
Access expiry bounds cookie expiry; database time remains authoritative. Raw credentials
never appear in JSON, URLs, frontend props/localStorage, audit or application logs.

Responses have private/no-store and no-referrer, including a path-specific Next.js header
rule because the pre-existing global Referrer-Policy otherwise overrides the route.
No private guest UI or analytics scripts were added. Tests verify JavaScript cannot read
the cookie. The known private bindings are absent from generated browser assets.

NextRequest normalizes loopback literals and can construct an internal URL with the
server's wildcard bind address. The URL comparison canonicalizes these known internal
addresses/ports only; the browser Origin remains exact, with separate mismatched-host/
port tests. This is not client network attribution and no forwarded header supplies it.

`authorizeGuestIntent` is server-only, selects the matching per-intent cookie and forwards
only its hash and an allowed scope. **It authorizes an intent, not an arbitrary booking
reference.** A future private status RPC must join/verify that intent's booking binding
and apply a read budget; do not expose a generic booking lookup after this boolean check.
This precheck is not transactional mutation authority: future booking RPCs must revalidate
the capability and binding under the intent lock within their own transaction.

## Durable abuse protection and local operation

Only `local-shared` attribution exists: all local callers share one opaque HMAC bucket,
regardless of cookies or spoofed IP headers. This is deliberately conservative and does
not claim to identify client IPs. There is no public hosting/proxy adapter. Missing or
untrusted attribution fails closed; never substitute client X-Forwarded-For as identity.
The HMAC key fingerprint must match database configuration. Local setup preserves the
key across process restarts, so restarting services cannot reset the counters.

The SQL transaction locks configuration, then the per-bucket advisory lock before
counter/intent changes. Active intents count by database deadline/revocation even if
cleanup has not run. Cookie counts are an additional bound, not the sole quota.
Admitted valid request attempts, including quota denials, persist accounting. Malformed,
CSRF and configuration rejections happen before DB admission; this is not a general
edge/DDoS limiter. Shared-clock fixed windows can burst across boundaries; the independent
active-intent budget remains. Live traffic needs approved trusted attribution and budgets.

```sh
npm --cache /tmp/rally-npm-cache ci
npm run db:start
npm run db:migrate
npm run db:staff
npm run db:guest
npm run dev
```

`db:guest` refuses non-designated local DB/API targets, applies
`supabase/guest-security.local.json` and writes service/HMAC bindings only to ignored
0600 `.env.local`. It prints no credentials. It does not create/link external projects.
Synthetic settings are 300s create / 900s access, 5 requests per 60s window, 5 active
intents/cookies and 3600s retention marker. These are test/development values, not approved
club policy. Technical schema bounds are likewise not commercial recommendations.
Never paste credentials into chat or source. Do not upload these local env files.

Validation resets only the guarded synthetic database:

```sh
npm run db:reset
npm run db:staff
npm run db:guest
npm run test:integration
npm run db:guest
npm run lint
npm run test
npm run build
TEST_PORT=3100 PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
npm run db:guest
npm run check:secrets
```

Tests intentionally alter synthetic private settings; rerun db:guest before interactive
local API use. Do not run fixture-mutating database/browser suites simultaneously.
CI adds these local setup steps for a future separately authorized push; it was not run
on GitHub for this unpublished branch. See [QA evidence](qa/phase-3b1/REVIEW.md).

## Remaining decisions and Phase 3B.2 recommendation

- No guest quotes/reservations/status/contact flow, guest actor extension, booking
  idempotency or autonomous hold expiry exists. Current public UI remains a demo.
- No public-network adapter or production enablement exists. Approve hosting proxy trust,
  service-key isolation, key rotation across active windows and shared-NAT abuse budgets
  before broadening the local gate. A rotated key must not silently reset live quotas.
- Retention timestamps are model markers, not an autonomous cleanup job. Approve cleanup
  and recovery/revocation operations; do not blindly delete future bound intents. No
  recovery by reference/contact alone or messaging provider is implemented.
- Owner decisions remain open: hours, exact 60-minute cutoff/minimum payment opportunity,
  advance horizon, duration/player/hold limits, minimal contact fields/privacy/retention,
  security TTLs/quotas and agreed policy wording. Partial refund rate stays undecided.
- HTTPS cookie serialization is unit-tested; actual browser TLS was not provisioned.
  Local HTTP/browser isolation and real service restarts are tested. No production or
  full live security/conformance readiness is claimed.

For 3B.2, first approve the missing boundaries and scoped gateway design, then implement
capability-scoped public quotes and truthful guest actor records, one-intent atomic unpaid
holds, durable request fingerprints/idempotency, binding-aware private status, minimal
approved contact collection, and autonomous expiry with race/monitoring tests. Keep live
payments and public launch separately gated. This recommendation does not authorize it.
