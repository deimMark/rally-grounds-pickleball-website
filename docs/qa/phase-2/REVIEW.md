# Phase 2 QA — local database and staff security foundation

Verified 31 October 2026 (Asia/Manila), on `phase-2-foundation`, based on approved Phase 1
commit `753901cd3363a102d34c0cc77fbdcdfa2bde9a2b`. Phase 1.1 styling remains pending.
No push, merge, deployment, remote Supabase project, production resource, real payment
or Google Calendar account was used.

## Completed checks

| Check | Observed result |
| --- | --- |
| Locked clean install | `npm --cache /tmp/rally-npm-cache ci --no-audit --no-fund` passed (445 packages). |
| Local stack startup/restart | Real database/Auth/gateway health checks passed using the supported slim images and documented loopback-only health correction. |
| Clean migration replay | `npm run db:reset` applied all three migrations and the synthetic seed; `db:staff` recreated five synthetic Auth identities. |
| Non-destructive migration refresh | `npm run db:migrate` passed with the designated local target. |
| Lint | `npm run lint` passed. |
| Unit tests | `npm run test`: **35 passed**, 3 files; no failures/skips. |
| Real integration suite | `npm run test:integration`: **32 passed**, no failures/skips, after the final clean replay. |
| Production build | `npm run build` passed with dynamic protected staff/Auth routes and a static public homepage. |
| Browser suite | `TEST_PORT=3100 PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e`: **21 passed**, no failures/skips, against the final build and recreated local Auth identities. |
| Credential-pattern review | Source/staged scans passed; local environment/credential files remain ignored. See security scope below. |

Runtime: Node 24.19.0, Supabase CLI 2.122.0, PostgreSQL **17.11**, DB timezone **UTC**,
Supabase SSR 0.12.7, Chromium 154.0.8037.57. Application versions remain pinned in the
manifest/lockfile. GitHub Actions is defined but has not run remotely.

## Database evidence

The integration suite uses actual local Supabase Auth-issued JWTs and PostgREST for
application-role operations, plus a guarded local PostgreSQL admin connection for
fixture setup and direct constraint checks. Low-privilege checks do not use an admin
client masquerading as an ordinary user. Domain fixtures are reset between tests.

- **20 simultaneous reservation attempts, same court/time:** exactly **1 committed**
  reservation and **19 PostgreSQL exclusion conflicts (`23P01`)**. The winning booking,
  agreement, item, occupancy, idempotency entry and audit each exist exactly once.
- Twenty same-actor/same-key retries return one reservation. Changed payloads reject;
  another actor's key is a distinct scope. Released/expired holds cannot resurrect.
- Adjacent half-open ranges succeed; overlaps involving private holds, open play and
  maintenance fail at the database level. Invalid/unbounded/infinite ranges are rejected.
- A multi-court operation that conflicts on a later court leaves no earlier partial
  occupancy or audit. Invalid amount/player/source/deadline requests leave no partial rows.
- Expired holds disappear from advisory availability and are reconciled under write locks;
  racing release/creation leaves exactly one active occupancy.
- Manila hours/start alignment/minimum duration are enforced; a database session using
  America/New_York still produces Manila 08:00 as the correct UTC instant.
- Immediate and scheduled rates, policy activation before/at/after the exact instant,
  disabled-court boundaries and service intervals crossing configuration changes pass.
- Old monetary/policy snapshots remain unchanged. Stale accepted policies reject even
  at the same price, and the old RPC signature cannot bypass version acceptance.
- Operational publication validates the affected effective window; a later restoration
  protects a booked slot after that window. Price-only changes do not invalidate
  off-hours maintenance blocks. Incompatible hours/disable changes still reject.
- Every introduced table has RLS; anonymous users cannot read private base tables;
  no-role/inactive users cannot mutate bookings. Ordinary staff cannot publish policies,
  change roles or read private customer/audit/idempotency rows. Owners cannot remove the
  last active owner or directly rewrite immutable historical data.
- Forged Auth user metadata does not elevate a staff role. Database deactivation denies
  a previously signed-in staff user on a direct reservation RPC as well as on reads.
- Owner-visible audit entries are atomic/append-only and contain only the intended
  actor/action/entity/time/minimal metadata, with no customer contact/evidence payload.
- Anonymous availability contains only court identity/number, interval, status and
  timezone; never customer records, private booking IDs or references.
- Email/password sign-in works while anonymous account registration remains disabled.

## Browser evidence

The original 13 presentation checks remain; staff variants now sign in with synthetic
users instead of bypassing the protected boundary. Eight Auth checks were added:

- Anonymous `/staff` redirects to `/staff/login`; missing/untrusted POST origins reject.
- Active owner sign-in succeeds; cookies are HttpOnly/SameSite=Lax; logout removes access.
- Inactive and ordinary nonstaff Auth users cannot enter the workspace.
- Incorrect credentials produce a generic error; session-cookie tampering cannot grant access.
- The request proxy refreshes an expired session envelope through real Supabase Auth.
- Revoking the live database role denies an existing browser session on its next request.

Both pages remain responsive at 360/390/768/1440 pixels. Keyboard controls, court map/list,
preview/reset, disabled sample slots, navigation and schedule filtering pass. Both scoped
390-pixel axe scans report no serious/critical findings. This is Chromium evidence,
not cross-browser or complete WCAG certification. Browser traces are disabled to avoid
retaining local passwords/session tokens.

The first Auth denial checks encountered two `role=alert` elements (the intended form
message and Next's route announcer). Tests now target the alert inside `main`; assertions
were retained, and the entire 21-test suite passed afterward.

## Routes and observable boundaries

| Route | Phase 2 behavior |
| --- | --- |
| `/` | Public, explicitly mock-only homepage/court selector. |
| `/staff/login` | Server-rendered staff sign-in; generic errors; no public registration. |
| `/staff` | Server-validated identity and live active-role check; synthetic read-only dashboard content. |
| POST `/auth/login` | Exact-origin-checked staff password sign-in. |
| POST `/auth/logout` | Exact-origin-checked sign-out; GET/missing origin rejected. |
| Unknown path | Existing 404 page. |

Database RPCs/services are real, but no public guest booking/customer/payment endpoint
or live-data calendar UI was introduced. The new server availability contract uses real
court UUIDs; Phase 3 must replace mock court identifiers through the data boundary.

## Security and environment scope

`.env.local` holds only local application connection configuration; `.env.test.local`
holds generated synthetic test credentials. Both are ignored/private (0600). Local admin
keys come from CLI status only inside guarded setup helpers; no admin key is written to
app configuration or passed to browser code. The app has no NEXT_PUBLIC credentials.
Source/staged review checks common credential patterns and must not be interpreted as
proof against every secret format. Intentional fake unit-test strings are nonfunctional.

CLI setup/admin helpers target only the designated local project and verify expected
loopback API/database endpoints. Reset and integration commands are destructive to this
synthetic local domain database, not production operations. Existing unrelated env values
are retained; a different existing Supabase connection is not silently overwritten.

The standard image hit Docker storage limits; the CLI's official slim images resolved
that. Auth's BusyBox health check initially went through the cloud proxy and received
403; the documented wrapper routes only the localhost health URL directly. Final startup
uses real successful health checks, with no ignore-health flag or TLS/checksum bypass.
Global Auth signup stays disabled while the email/password provider is enabled; a real
API test verifies that distinction.

## Remaining limitations and next milestone

- Public site/availability selector and dashboard figures are still mock demonstrations.
  There is no live guest booking UI, payment confirmation, customer CRM or analytics UI.
- Only staff-created unpaid holds/cancellation/expiry are implemented. Later verified
  payment/confirmation/refund states and ledgers require new migrations and tests.
- Guest cutoff equality, payment cutoff, partial refund rate, booking horizon and maximum
  duration are undecided/null. Initial hours/duration increment remain provisional.
- Schedules are uniform daily court hours plus effective changes/explicit blocks; weekly
  recurrence/holidays, timezone migration and overnight reservations are not implemented.
- No automatic expiry scheduler, production owner invitations/MFA/recovery, production
  rate-limit/monitoring deployment, Storage evidence policies or backup/restore drill.
- Supabase sign-out uses normal access-JWT lifetime semantics. Database role deactivation
  is the immediate authorization-revocation control tested here.
- Production/cloud-provider connectivity, remote CI, Firefox/Safari and new-task snapshot
  restoration have not been verified. The baseline ESLint 9 toolchain still emits its
  upstream lifecycle warning; upgrading the compatible lint-plugin chain is separate.
- Phase 1.1 logo/gold icon/warm surface/helper-text corrections remain pending.

Recommend reviewing this foundation and unresolved policy decisions, completing the
separate Phase 1.1 presentation corrections, then proceeding to Phase 3 guest quote/
availability UI, capability-scoped booking and the authenticated expiry scheduler. No
production booking/payment launch should be inferred from these local foundation tests.

See [implementation and commands](../../PHASE-2.md),
[decision register](../../DECISIONS-AND-RISKS.md) and
[Phase 1.1 corrections](../../PHASE-1.1.md).
