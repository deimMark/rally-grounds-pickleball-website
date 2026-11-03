# Phase 3B.1 adversarial review — 2026-11-03

**Decision: suitable for GitHub checkpoint publication for independent review in its
local-only scope. No unresolved critical/high-severity defect was found in the reviewed
implementation and probes. This is not approval for public admission or production use.**

Reviewed implementation: `7907b7dce56d6d03cc8466eac865b51fb67e447a` on
`phase-3b-guest-security`. Initial branch/HEAD matched, working tree was clean, and
Phase 3A `3e9a94c724f430bab9df4bd7107dfae659966cf4` was verified as an ancestor.
AGENTS, ARCHITECTURE, DECISIONS-AND-RISKS, PHASE-3B-CONTRACTS, PHASE-3B1 and the
implementation QA were read. Full 3B contracts remain proposals except the explicitly
local intent subset. No migrations, application/server code or booking logic were
changed during this review. Added tests exercise the implementation independently;
this report and the branch deployment opt-out accompany them in a review commit.

## Scope, threat model and evidence limits

Adversaries include anonymous REST clients, ordinary authenticated/inactive users,
staff/owner attempts outside their grants, browser cross-origin callers, crafted JSON,
forwarded-header spoofing, concurrent/restarted admission clients and search-path
shadowing. Only the guarded synthetic local Supabase/PostgreSQL/Auth stack was used.
No real contact/customer/payment data, external accounts or production resources.

Database administrators and a compromised service key are privileged trust boundaries;
their compromise can have high impact. That is not equated with an unprivileged exploit
in this local implementation. Residual production risks below remain launch blockers.
This is agent-performed code/adversarial regression review, not independent third-party
penetration-test certification. No scheduler, recovery flow or Phase 3B.2 feature was built.

## Database and direct bypass review

- All three new private tables have RLS enabled, no allowing policies and revoked direct
  table grants. `private` is absent from the exposed PostgREST schema list.
- Direct REST SELECT/INSERT/UPDATE/DELETE attempts on each table fail for anonymous,
  active staff/owner, inactive and no-role identities. Public-schema table-name guessing
  exposes no rows. Direct RPC actor/function argument injection fails without mutation.
- ACL-independent RLS was tested with temporary SELECT/schema grants **inside a local
  administrator transaction that was always rolled back**: anon/authenticated saw zero
  rows despite real private data. Grants remained revoked afterwards. No permission
  weakening was committed or used to make the application pass.
- Catalog inspection confirms all three public guest SECURITY DEFINER functions use
  `search_path=''`. Relations/helpers are schema-qualified. The two gateway RPCs grant
  EXECUTE only to service_role and also check the service JWT role internally. The
  revocation RPC grants EXECUTE to authenticated users but requires the current active
  owner in PostgreSQL. No broad UPDATE/DELETE grant or arbitrary function dispatch.
- A temporary `guest_intents` table and hostile caller search_path did not substitute
  private rows: the forged hash failed and the real capability remained valid.
- Scope/hash/network identity/deadline/creation/retention fields reject rewrites. Binding
  cannot be removed/replaced once set; unique booking FK prevents competing bindings.
  Synthetic staff bookings exercise the constraint only, not a guest creation flow.
- Twenty concurrent owner revocations yield exactly one successful transition/audit.
  Guest creation has null Auth actor and redacted guest/scope metadata; revocation has
  the real owner. Audit payloads contain no bearer, hash, raw IP or contact details.
- Existing staff Auth, role revocation, RLS, booking exclusion constraints, agreements,
  pricing/policy snapshots and append-only audit regressions remain green.

## Server boundary review

- Credentials are independent 32-byte Node CSPRNG values (256 bits), delivered only in
  HttpOnly cookies. SHA-256 of the raw bytes is the only credential material stored in
  the intent row. Per-intent UUIDs identify scope but are not bearer authority.
- Success JSON is an explicit three-field projection. No bearer/hash/service binding
  appears in JSON or generated URLs. Privileged SDK errors are replaced with safe
  failures and not logged; no new analytics or frontend capability transport exists.
- HTTPS serialization uses __Host prefix, Secure, HttpOnly, SameSite=Lax, Path=/ and no
  Domain. Approved loopback HTTP has a separate cookie name and keeps HttpOnly/Lax.
  Browser JavaScript cannot read it. Actual hosted TLS/proxy logging was not certified.
- Exact configured Origin is mandatory; no Host/X-Forwarded header supplies a trusted
  browser origin or client identity. Known Next internal loopback/wildcard addresses
  are normalized only for its server URL comparison, not to relax Origin equality.
- JSON/media/encoding/query/unknown fields, prototype-shaped payloads and actor/function/
  credential injections fail. Declared and streamed bodies are limited to 512 bytes;
  the adversarial HTTP case also sends oversized chunked input without Content-Length.
- Real browser requests from another loopback origin cannot mint intents using either
  JSON/CORS or a simple text/plain POST. Missing/foreign Origin and cross-site/same-site
  Fetch Metadata reject; preflight grants no cross-origin access.
- Cookie/header limits, no-store and the endpoint-specific no-referrer rule were checked.
  The public mock selector still emits no mutation request; no demo code calls admission.
- New privileged modules are server-only, accept narrow inputs and use two hardcoded RPC
  names. Known private service/HMAC values are absent from all generated browser chunks.

## Admission, expiry and transaction readiness

Atomic PostgreSQL accounting, not process memory, enforces request and active-intent
budgets. Twenty RPC attempts and twenty HTTP attempts with different spoofed IP headers
each produce five intents/fifteen controlled denials. Quota denials retain accounting.
Fresh SDK/Node processes and two real Next process restarts remain denied after exhaustion.
Missing/disabled settings, invalid enabled DB configuration, mismatched HMAC key binding
and unsupported attribution mode fail closed. No untrusted IP header becomes authority.

Creation/access deadlines are separate immutable database instants. Natural one-second
synthetic expiry tests distinguish creation expiry from still-valid access, then reject
full expiry. Revoked/forged/wrong-intent/unsupported-scope credentials fail. Cookies are
transport, not authority: a stale cookie cannot extend DB access. No trigger was disabled
to pass expiry tests. Reads do not silently renew or recreate intents.

Before 3B.2, preserve two transaction boundaries: short durable request admission and a
separate atomic booking transaction. The latter must revalidate capability/deadline and
binding under the intent lock, check immutable replay receipts before stale quote checks,
and follow the documented configuration→limiter→intent/request→sorted courts→booking lock
order. A boolean helper is not permission to look up another booking reference or perform
a later unchecked mutation. Expiry must avoid inverse intent/court locking. No such
booking transaction or full expiry scheduler is implemented/approved by this review.

## Findings and residual risks

| ID / severity in this local milestone | Finding / disposition before live use |
| --- | --- |
| R1 — Medium, privileged-key trust | The gateway service key is broadly privileged/RLS-bypassing despite its narrow wrapper. No leak or untrusted dispatch found. Keep it server-only/0600 for local use; independently review runtime secret isolation, least-privilege alternatives and provider log redaction before live data. |
| R2 — Medium, public ingress/readiness | Local-shared is one conservative bucket, not trusted public client attribution. Origin is browser CSRF protection, not authentication of arbitrary HTTP tools or a network firewall. Bind local services to loopback and do not publicly forward the security API. Public proxy trust, NAT budgets and edge protection remain unimplemented. |
| R3 — Medium, lifecycle/rotation readiness | Retention markers do not perform cleanup. Lost-response admissions may leave unbound intents; they expire logically and consume bounded local budgets. Approve retention/recovery/key rotation before public use. Rotating key+fingerprint must not reset active-window quotas. |
| R4 — Low locally, ingress hardening | Byte/cookie bounds do not establish an application body-read deadline or general DDoS protection. Framework/edge timeouts, request-header logging and resource limits need hosted review. Current malformed/CSRF rejects intentionally precede DB accounting. |
| R5 — Low, cookie/clock limits | Cookies do not isolate ports on one hostname; local development trusts other local services. Max-Age is calculated with application time while DB expiry is authoritative. Verify dedicated live origin/TLS, clock sync and stale-cookie handling; no stale cookie authorizes expired access. |

These are explicit local-scope residual/readiness limits, not newly reproduced
critical/high unprivileged access defects. Do not reinterpret this publication decision
as production-ready public rate limiting or guest booking authorization.

Cleanup proposal, not implementation: a bounded least-privilege worker may delete only
expired, retention-eligible **unbound** intents; protect future booking-bound history.
Use indexed eligibility predicates and bounded batches/SKIP LOCKED, prune rate buckets
only after their active window/retention, monitor failures and never renew deadlines.
Retain/aggregate key versions through an approved overlap window or pause admission
through rotation; do not re-key into empty counters. Recovery must not use a reference
or supplied contact string as authorization; there is currently no recovery endpoint.

## Validation — actual counts

Node 24.19/npm 11.9, local Supabase CLI 2.122, PostgreSQL/PostgREST/Auth, system Chromium.

| Check | Pass | Fail | Skip |
| --- | ---: | ---: | ---: |
| Real DB integration, after clean reset | 70 | 0 | 0 |
| Units | 96 | 0 | 0 |
| Browser/HTTP regressions | 29 | 0 | 0 |

The 70 DB tests include the original 63 plus seven new adversarial probes. The 29 browser
tests include the original 27 plus crafted-payload and real alternate-origin cases.
All original Phase 2/3A and 3B.1 tests remain. Existing tests were not relaxed.

- `npm run db:reset`, `npm run db:staff`, `npm run db:guest`: passed; all seven original
  migration versions replayed. No new schema migration in this review.
- `npm run lint`, `npm run test`, `npm run test:integration`, `npm run build`, and
  `TEST_PORT=3100 PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e`:
  passed. Fixture-mutating suites ran sequentially. Browser traces remain disabled.
- Source/untracked/staged credential-pattern scans and `git diff --check`: passed.
  Only .env.example tracked among env files; private local files remain ignored/0600.
- Actual guest service/HMAC bindings were absent from all 16 browser JS chunks, values
  suppressed. This and pattern scanning are scoped evidence, not universal secret proof.

## Publication safeguards and next gate

The reviewed application/schema remain byte-for-byte unchanged from implementation
7907b7d; a separate review commit records tests/review documentation and `vercel.json` only. Its
`git.deploymentEnabled` entry disables the exact `phase-3b-guest-security` branch's
Vercel Git deployments. This is a branch-local no-deployment safeguard, not a Vercel
project/default-branch/domain change. Reference:
https://vercel.com/docs/project-configuration/git-configuration . No deployment command
or Vercel settings API is used. GitHub branch publication is authorized; owner-demo and
all existing Phase 2/3A branches must stay unchanged. Remote HEAD/Actions status are
reported in the final response; a feedback check alone is not deployment evidence.

Recommendation: publish this local checkpoint for independent review. Do not begin
3B.2 in this task. Before later guest holds, approve the owner policy/contact/TTL/privacy
boundaries, truthful guest actor model, trusted hosting and idempotency/binding transaction
contracts. Then implement/test scoped quotes, atomic unpaid holds, private binding-aware
status and monitored expiry in the separately authorized milestone. No payments, GCash,
real customer information, public booking or production Supabase connection here.
