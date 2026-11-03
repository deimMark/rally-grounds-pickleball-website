# Phase 3B.1 QA — 2026-11-03

Result: **local guest access foundation passed; no guest booking/public launch**.
Branch `phase-3b-guest-security`, verified Phase 3A base
`3e9a94c724f430bab9df4bd7107dfae659966cf4`. Initial tree was clean and remote base
matched. No merge, push, deployment, Vercel change or production resource operation.

Implementation commits:

- `239b5aae56d0bac25f0cf3df57da68c9feef4908`: private intent model, durable admission,
  synthetic configuration/bootstrap and database tests.
- `a7534da1da207fb86d975f2666e5079ca45d9aa0`: local HTTP gateway, cookies/capability
  boundary, unit/HTTP/browser coverage and future CI setup.

The documentation checkpoint follows these commits; its SHA is reported in the final
review response/Git history. All work derives from Phase 3A, not owner-demo. The later
visual-demo changes were intentionally not merged into this backend milestone.

## Commands and actual results

Node 24.19 / npm 11.9 / Supabase CLI 2.122 / real local PostgreSQL, PostgREST and Auth;
system Chromium against the Next.js production build. Guarded local synthetic DB only.

| Check | Actual result |
| --- | --- |
| `npm run db:migrate` | New additive migration applied successfully to the existing local Phase 3A database. |
| `npm run db:reset`, `npm run db:staff`, `npm run db:guest` | Clean migration replay and synthetic staff/guest setup passed. All seven migration versions confirmed in migration history. |
| `npm run test:integration` after clean reset | **63 passed, 0 failed/skipped**: original 53 + 10 guest-security cases. |
| `npm run test` | **96 passed**, 6 files: original 47 + 49 guest boundary/primitive/authorization tests. |
| `npm run lint` | Passed. |
| `npm run build` | Passed. New `/api/guest-intents` POST route; existing public and staff routes preserved. |
| `TEST_PORT=3100 PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e` | **27 passed, 0 failed/skipped**: all original 21 + 6 real HTTP/browser guest security tests. |
| Known private binding scan in `.next/static` | Actual guest service/HMAC values absent from all **16 browser JavaScript chunks**; values suppressed. |
| `npm run check:secrets`, staged scans, `git diff --check` | Passed. Only `.env.example` tracked among environment files; local env files ignored/0600. Scoped patterns do not prove every possible secret format absent. |

Suites that mutate DB fixtures ran sequentially, not against competing tests. Browser
tracing remains off because Auth/capability evidence can contain credentials. No customer
records/payment evidence/real contacts were created. HTTP tests intentionally send only
synthetic invalid fields to prove their rejection. Private bindings stay in ignored local
files and are never printed. Test configuration is restored with db:guest for local use.
GitHub CI was updated for these local setup steps but not run for unpublished commits.

## Security evidence

| Boundary | Evidence |
| --- | --- |
| High-entropy/hash-only credential | 32-byte Node CSPRNG, canonical 43-character base64url, independent UUID; 128 generated values unique in unit checks. Real HTTP cookie decoded to 32 bytes; database contains only its SHA-256. JSON/audit exclude hash and bearer. Entropy is by construction, not a statistical certification. |
| Cookie isolation | Real browser sees HttpOnly/Lax local cookie but document.cookie cannot read it. HTTPS NextResponse test verifies __Host prefix, Secure, no Domain and Path=/. Actual TLS browser deployment was not provisioned. |
| Expired/revoked/forged/wrong intent/scope | Real database checks reject them. Real one-second synthetic deadlines prove creation expiry independent from access, then total expiry. No trigger was disabled to pass expiration tests. Owner-only irreversible revocation audited once. |
| One-booking binding | Unique nullable booking FK, immutable non-null binding; conflicting/rebinding attempts reject. The test uses an existing synthetic staff booking only to exercise constraints; no guest booking creation operation exists. |
| RLS and explicit privileges | All private tables have RLS enabled/no allowing policies. Anonymous/staff/owner direct gateway calls reject; ordinary and service-role direct private table reads reject. Missing service JWT claim rejects even when invoked by the local test administrator. |
| CSRF/input | Exact Origin + JSON/non-simple request + same-origin Fetch Metadata if present; wrong/missing origins and same-site/cross-site metadata reject. CORS preflight grants no origin. Unknown fields, invalid JSON/media/encoding/query and oversized streamed bodies reject; no contact form added. |
| Real framework behavior | Accounted for Next internal loopback/wildcard URL construction without changing exact browser-Origin matching. Mismatched internal port/public host still reject. The site's global referrer rule was overridden specifically for this private endpoint; HTTP confirms no-referrer/no-store. Temporary non-secret diagnostic logging used during investigation was removed. |
| Durable concurrency | 20 real RPC requests yield 5 intents/15 controlled denials, one counter saturated at 6 and exactly 5 creation audits. 20 HTTP requests with differing spoofed X-Forwarded-For/X-Real-IP headers likewise produce only 5 intents. |
| Restart persistence | New service client in a separate Node process remains denied after exhaustion. Two fresh Next.js process starts against the same database remain 429. Unknown attribution mode returns 503. No process-local quota state. |
| Configuration/store errors | Missing/disabled/invalid settings and mismatched HMAC binding fail closed. Invalid enabled DB configuration is rejected by CHECK constraints. Unit provider-error cases return safe failures without serializing SDK errors or logging secrets. |
| Existing foundation | All 53 Phase 2/3A DB tests, 47 original unit tests and 21 original browser tests pass: occupancy/conflicts, adjacent/different courts, immutable policies/receipts, staff roles/refresh/revocation, block release and audit history. |

## Scope limits and remaining risks

1. Local-only gate: no trusted public proxy adapter or public enablement. All local
   callers intentionally share one HMAC bucket; no claim of IP attribution. Future
   hosting must supply verified attribution and approved shared-NAT budgets.
2. Service key is privileged/RLS-bypassing. The application wrapper is server-only,
   invokes only two hardcoded RPCs and new private tables revoke direct grants, but the
   key still needs isolation/review before live use. Neither service key nor HMAC binding
   is browser-visible; no privileged shared staff identity is used.
3. No contact/quote/reservation/status API, guest booking actor extension, booking
   idempotency or autonomous hold expiry. Internal authorization is intent-scoped only;
   a future status RPC must match the booking binding and rate-limit reads independently.
4. Fixed windows and active-intent/cookie budgets are development protection, not a
   general edge/DDoS system. Invalid Origin/body/config requests reject before admission
   counters. Limits and TTLs are explicit synthetic fixtures, not live club policy.
5. Retention markers exist; autonomous cleanup, credential recovery and live key rotation
   across active windows remain unimplemented. Do not reset live quotas through key
   rotation or delete bound history without an approved retention design.
6. Owner policy decisions remain unresolved: operating hours, lead-time equality/minimum
   payment opportunity, horizon/duration/player/hold limits, contact/privacy/recovery,
   retention, security TTL/abuse budgets and contractual wording. No refund percentage
   was invented. Existing booking agreements were not rewritten.
7. Local cookie/HTTP/security regressions pass; this is not production TLS, hosting,
   backup/restore, complete accessibility or public penetration-test certification.

[Implementation and operations](../../PHASE-3B1.md) ·
[Full proposed guest contracts](../../PHASE-3B-CONTRACTS.md).

Recommendation: review this access boundary before authorizing Phase 3B.2. Next work
should approve missing policies/hosting trust, then add truthful guest actors, scoped
quotes, atomic one-intent holds with durable booking idempotency, binding-aware status
and autonomous expiry. No live payment workflow or public launch is authorized here.

## Changed files

- Migration/fixture: `supabase/migrations/20261103000100_guest_intent_security.sql`,
  `supabase/guest-security.local.json`.
- Server/API: `app/api/guest-intents/route.js`, `lib/server/guest-security.js`,
  `lib/server/guest-intent.js`, `next.config.mjs`.
- Local setup/check workflow: `scripts/bootstrap-local-guest.mjs`, `package.json`,
  `.env.example`, `.github/workflows/ci.yml`, `vitest.config.mjs`.
- Verification: `tests/integration/helpers.mjs`, `tests/integration/guest-security.test.mjs`,
  `tests/unit/guest-security.test.js`, `tests/unit/guest-route.test.js`,
  `tests/unit/guest-authorization.test.js`, `tests/e2e/guest-intents.spec.mjs`.
- Documentation: `AGENTS.md`, `README.md`, `docs/README.md`, `docs/ARCHITECTURE.md`,
  `docs/ROADMAP.md`, `docs/DECISIONS-AND-RISKS.md`, `docs/PHASE-3B-CONTRACTS.md`,
  `docs/PHASE-3B1.md` and this report.


## Subsequent security/publication review

The [adversarial review](SECURITY-REVIEW.md) preserves the implementation above and adds
independent bypass regressions and publication safeguards. Its current validation counts
supersede this historical implementation run; residual/live-readiness gates remain.
