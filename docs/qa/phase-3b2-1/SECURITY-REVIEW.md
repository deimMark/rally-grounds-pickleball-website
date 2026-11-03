# Phase 3B.2.1 final security review

Date: 2026-11-03. Reviewed correction commit:
`5086c11b8e776ad9134c4f80b6cffb9f524c99b3` on `phase-3b2-1-security-fixes`.
Base: `22fb656f7c7c1dbcc35f23063aea2822c1aeecc7`, ancestor verified; initial branch/HEAD
matched and tree was clean. Remote base and owner-demo/default were checked unchanged.

**Decision: suitable for controlled GitHub publication of this local synthetic checkpoint.
No unresolved critical/high-severity defect was found in the reviewed corrections. R1/R2
are resolved in the tested scope. No public booking or production approval.**

This is an adversarial re-review by the implementing assistant, not independent
third-party certification. Publication enables the independent GitHub inspection requested
by the user. No application/test/migration correction was needed during this final pass;
a separate documentation commit records this review and current publication authority.

## Thirteen-file scope inspected

| Correction file | Assessment |
| --- | --- |
| `AGENTS.md` | Local R1/R2 authorization, preservation of invariants and no expiry/public scope. Latest user request supersedes its earlier no-push rule only for conditional publication. |
| `app/api/guest-reservations/[reference]/route.js` | Dedicated GET trust, typed reference/selector and unchanged protected binding-aware SQL status operation; uniform access failures. |
| `app/api/guest-reservations/route.js` | Typed Idempotency-Key, same strict POST Origin, validated normalized payload before admission. |
| `docs/PHASE-3B2-1.md` | Explicit before/after GET/UUID contract, supported evidence and fail-closed legacy behavior; no live claim. |
| `docs/PHASE-3B2.md` | Replaces the incorrect suggestion that browser JS can set Origin for GET; unchanged hold/transaction scope. |
| `docs/qa/phase-3b2-1/REVIEW.md` | Correction QA evidence, security regression cases and outstanding gates. |
| `docs/qa/phase-3b2/SECURITY-REVIEW.md` | Preserves original findings and links their correction checkpoint. |
| `lib/domain/guest-reservation.js` | Private UUID regex behind primitive-string predicate; canonical valid normalization projection preserved. |
| `lib/server/guest-reservations.js` | Typed cookie selector/request key before privileged client work; fingerprint, two transactions and status RPC unchanged. |
| `lib/server/guest-security.js` | Known configured target comparison, separate read/mutation context policies and typed cookie names; credential generation/cookie security unchanged. |
| `tests/e2e/guest-reservations.spec.mjs` | Real no-Origin browser request, binding/capability/metadata/CORS rejection, pre-admission UUID rejection, retained concurrency/restart/replay checks. |
| `tests/unit/guest-security-fixes.test.js` | Missing/invalid/contradictory trust evidence, target spoofing, POST separation, coercion types and rejection before privileged-client construction. |
| `vercel.json` | Exact correction branch Git deployment disabled; previous branch opt-outs preserved. |

Reviewed the applicable Next route guide, prior guest contracts/security reports and
surrounding server/SQL capability, binding, error projection and admission code. No changes
to eight migrations, booking SQL, staff Auth/RLS, pricing/policy history or occupancy rules.

## R1 assessment: browser GET context is not authorization

- Real same-origin Chromium GET succeeds with matching HttpOnly capability and selector.
  Playwright captures the outgoing request: no Origin, Sec-Fetch-Site=same-origin. Browser
  code supplies only the nonsecret intent selector, never the forbidden Origin header.
- Target scheme/host/port must match configured APP_ORIGIN after existing known Next
  internal loopback/bind-address normalization. Explicit browser Origin is exact; foreign,
  empty and null origins do not normalize into trusted values. Forwarding headers do not
  determine the trusted origin/identity. Host/proxy/TLS behavior for live ingress remains
  outside this local review.
- Missing Origin requires Sec-Fetch-Site=same-origin. Missing Fetch Metadata requires an
  explicit matching Origin. Neither signal means reject. Invalid/contradictory site values
  (including same-site, cross-site, none and empty) reject. Supplied mode must be cors or
  same-origin; supplied destination must be empty. No navigation/embed/no-cors fallback.
- Raw HTTP callers can forge Fetch Metadata. They still cannot read without the actual
  valid capability: tests with fabricated trust headers and absent/forged cookies fail.
  A valid cookie with a different booking reference/binding fails inside SQL. Revoked,
  naturally expired, forced stale or missing capabilities and unknown references retain
  uniform 404 ACCESS_UNAVAILABLE responses with no private details.
- Other-origin browser pages (same host/different port and localhost versus 127.0.0.1)
  cannot read the private response even in the victim browser context. No CORS grant or
  private-cache permission was added. Success/error responses remain private/no-store and
  no-referrer. Ordinary read admission limits remain in PostgreSQL.
- POST intent/quote/reservation still require exact Origin; same-origin read metadata
  without it returns 403 on all three. The GET policy rejects POST itself. The shared
  target helper preserves the previous target comparison and fails closed on bad URLs.

## R2 assessment: types checked before regex/admission

`isGuestUuid` requires `typeof value === 'string'` before RegExp.test. Arrays, objects,
boxed strings, null/undefined, numeric/boolean substitutes and malicious toString objects
are not coerced. All guest intent/quote/court IDs, cookie selectors/names, status reference
and Idempotency-Key boundaries use this predicate. Native database UUID checks remain.

Malformed JSON types and serialized UUID/header arrays/objects reject before durable
request admission or private read RPC. Tests assert zero new admission/customer/booking/
agreement/occupancy rows and create/read buckets. A malformed request cannot consume a
pending-request allowance. Valid UUID strings still produce and replay one hold.

As an additional probe outside suite counts, the pre-correction base and current pure
normalizers were compared for three valid payloads (ordinary, trimmed/domain-normalized,
and Unicode-normalized). Canonical projections and keyed HMAC fingerprints matched exactly;
values were suppressed. Existing HTTP lost-response/restart/replay tests also remain green.

## Transaction and regression assessment

No transaction code changed. Real tests repeat the following rather than relying on the
previous milestone's reported results:

- Twenty independent SQL and HTTP guests: one hold, 19 controlled conflicts, durable
  admission after conflict and no orphan domain rows.
- Twenty same-key SQL/HTTP retries: one booking/receipt/deadline; changed inputs conflict,
  different intent scopes remain isolated, and current status comes from the database.
- Lost response, quote/create-window expiry, natural hold expiry/cancellation, uncommitted
  transaction wait/commit, killed process rollback/pending recovery and real Next restarts
  preserve immutable receipts and never resurrect occupancy or extend deadlines.
- Anonymous/private REST/RPC access, RLS/grants, guest binding/revocation/expiry, staff
  authorization, multi-court blocks/release, duration/policy/snapshot/audit regressions pass.

## Actual repeated validation

Synthetic designated local Supabase/PostgreSQL/Auth/PostgREST only, Node 24/npm 11,
system Chromium. Database/browser fixture suites ran sequentially.

| Suite | Pass | Fail | Skip |
| --- | ---: | ---: | ---: |
| Real DB/security/concurrency integration | 99 | 0 | 0 |
| Unit tests | 138 | 0 | 0 |
| Browser/API regressions | 45 | 0 | 0 |

- `npm run db:start`, `db:reset`, `db:staff`, `db:guest`: passed; eight unchanged migrations
  replayed cleanly. No remote database or production resources used.
- `npm run lint`, `npm run test`, `npm run test:integration`, `npm run build`,
  `TEST_PORT=3100 PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e`:
  passed with no failed/skipped/cancelled/TODO tests. No assertions weakened or tests
  edited during this final review.
- Source/untracked/staged credential-pattern scans, `git diff --check`: passed. Local
  env/Auth files stay ignored/0600; no credential values printed or committed.
- `npm run check:client-secrets`: actual private service/HMAC bindings absent from all
  16 browser JS/map artifacts, values suppressed. Scoped checks do not prove absence of
  every secret encoding or certify hosted request/header/provider log behavior.
- Private diagnostic logs: `/tmp/rally-3b2-1-final-{reset,db,unit,build,browser}.log`.
  Generated artifacts/env files remain ignored; browser traces stay disabled.

## Remaining findings and readiness

No new critical/high defect or unresolved R1/R2 reproduction was found in this local scope.
The following known medium/live-readiness boundaries remain:

1. The service key is broadly privileged despite narrow server wrappers; hosted secret
   isolation/least privilege/log redaction need separate review before real customer data.
2. Only loopback/local-shared attribution exists. Origin/Fetch Metadata are browser context
   evidence, not network-client authentication or production bot/DDoS protection. Trusted
   public proxy/NAT budgets, body-read timeouts and quota-preserving rotation are absent.
3. Autonomous expiry/cleanup/heartbeat/recovery are not implemented. Logical expiry and
   request-path reconciliation do not establish an idle physical-release SLA. Retention
   markers and immutable quote/request delete triggers need a narrow audited cleanup path.
4. Owner-approved commercial/contact/privacy/retention/security settings and live TLS/
   proxy/clock behavior remain unresolved. Clients omitting both Origin and Fetch Metadata
   fail closed; local cookies do not isolate ports on a shared hostname.

**Recommendation:** go for independent review of this checkpoint and, after separate
implementation authorization, local Phase 3B.3 worker/retention/concurrency/monitoring work.
Preserve court→booking locks and immutable accepted receipts; never acquire intent/limiter
locks in reverse while holding courts. No-go for public guest booking/payments/production.
No Phase 3B.3 implementation, deployment, merge or production connection in this review.

## Publication gate

Parsed `git.deploymentEnabled['phase-3b2-1-security-fixes']` is false in vercel.json.
No Vercel CLI/API/settings operation is used. A normal push of this development branch
is authorized only after the above gate and a clean tree. Owner-demo/default and all
other development branch tips remain unchanged; no force-push or merge. Remote HEAD and
GitHub Actions are checked after publication and reported in delivery output, not
pre-claimed here. Runtime and tests remain byte-for-byte those of reviewed 5086c11.
