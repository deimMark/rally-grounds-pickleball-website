# Phase 2 execution proposal — review before implementation

Status: the user subsequently authorized Phase 2 implementation. This is the reviewed
planning reference; actual implementation, refinements and limitations are recorded in
[PHASE-2.md](PHASE-2.md). Phase 1 finalization itself did not authorize Phase 2.
Read this with ARCHITECTURE.md, ROADMAP.md, DECISIONS-AND-RISKS.md and AGENTS.md.
Keep one club per deployment. No tenant/platform layer, live payments, external
provisioning, production changes, deployment, push or merge is included.

## Scope and boundaries

Phase 2 establishes a local Supabase database, versioned configuration, a tested
availability service, transactional court integrity, staff Auth/RBAC and security tests.
It does not enable public booking or replace the mock public selector with live
reservations. Public booking/token/upload UX stays in Phases 3–4; owner settings UI and
analytics stay in Phase 6. Open-play blocking is represented by the resource model now;
event-management UI and Reclub links stay in Phase 5.

Refinements to the original roadmap, proposed explicitly for review:

- The database/migration integration harness deferred from Phase 1 is included here.
- Availability calculation and its server contract are designed/tested here; public
  calendar/selector integration and the guest booking endpoint remain Phase 3.
- Negative RLS tests cover all tables introduced here. Payment/evidence table and Storage
  access tests are added with those actual resources in Phase 4; do not create empty
  payment tables or buckets solely to claim the earlier security gate passed.
- Reservation/hold creation is an internal transactional foundation exercised with
  synthetic integration fixtures, not an exposed anonymous booking endpoint.

## 2.1 — Reproducible local Supabase and migration harness

1. Verify Docker daemon access, platform/resources and required local ports. Pin a
   supported Supabase CLI version compatible with the chosen Auth/Postgres environment.
   Check current official Next/Supabase SSR guidance before writing integration code.
2. Add `supabase/config.toml`, reviewed timestamped migrations, synthetic `seed.sql`,
   local setup/reset instructions and real-database integration commands/CI jobs.
3. Preserve the existing application and lockfile except for necessary reviewed Auth/CLI
   dependencies. Add new variable names with blank examples, never actual credentials.
4. Guard reset/seed/admin helpers to target only the designated local test instance.
   Test Auth identities are generated locally with noncommitted credentials, not real
   customer/staff accounts or shared production passwords.

Gate: clean local bootstrap/reset and migration replay pass; existing app still builds.
No remote project is created. If Docker cannot run, finish independent design/tests and
report that prerequisite; request approval before creating any alternative test project.

## 2.2 — Schema, club/court configuration and policy versions

Migrations introduce only the needed foundation:

- `courts`: stable IDs, unique court numbers and validated layout coordinates.
- `club_settings_versions`, `court_config_versions`, `policy_versions`: typed fields,
  effective timestamps, authors/change notes, validated scope and explicit precedence.
- `staff_profiles`: Auth foreign key, active status and constrained owner/staff role.
- `customers`: minimal private identity/contact schema; synthetic fixtures only.
- `bookings`, `booking_revisions`, `booking_items`: minimal reservation state, integer
  centavo totals, version references and immutable agreed pricing/policy snapshots.
- `court_occupancies`: canonical active court/range claims for bookings, open play and
  maintenance, with constrained ownership/type relationships and foreign keys.
- `idempotency_requests`: actor/scope/key uniqueness and request fingerprint/result.
- `audit_events`: append-only redacted privileged-change records, atomic with mutations.

Seed five courts at the approved layout positions; PHP 600/hour; one-hour minimum;
full-hour starts; provisional 08:00–23:00 Manila hours; 60-minute lead-time setting;
two-hour maximum payment-window setting. Keep undecided refund rate null. Proposed
whole-hour duration increments remain explicitly provisional. Unconfirmed booking
horizon/capacity/refund settings must not acquire invented live defaults.

Store UTC instants and use `Asia/Manila` for club-day calculations. Effective-time
resolution serializes version publication per scope and rejects duplicate/ambiguous
activation. Include owner-authorized database operations for immediate/scheduled
publication; editable settings screens are outside this phase.

Proposed semantics remain as documented: branding resolves at read time; operational
hours/rates resolve for service-time segments; contractual terms resolve at booking
creation and are snapshotted. Detect existing reservation conflicts before operational
changes are published; a new version cannot silently invalidate an existing agreement.
This semantics/permission decision needs review before implementation of those functions.

Gate: migrations seed exactly five courts; before/at/after activation and court overrides
resolve deterministically; a service interval crossing a change is validated segment by
segment; new configuration leaves an existing agreement unchanged. Direct edits to used
historical versions/agreement snapshots are rejected through supported access paths.

## 2.3 — Availability calculations and safe read contract

Implement a database-backed server availability service for one explicit Manila club day:

1. Resolve enabled court configuration and operating intervals, including scheduled
   changes and court-specific overrides.
2. Project valid candidate intervals using configured start/duration increments.
3. Subtract all active private holds/reservations, open-play and maintenance occupancy.
   Define expired-hold reconciliation consistently with the transaction path; reads
   remain advisory and cannot guarantee a subsequent reservation.
4. Return only court identity, safe interval/status information, timezone and configuration
   version context. Never expose guest names, contacts, private booking IDs or evidence.
5. Validate input bounds and use a bounded query; dates do not depend on browser timezone.
   No public guest mutation endpoint is introduced. Public UI remains visibly mock-only
   until its separately reviewed Phase 3 integration.

Gate: known fixtures cover disabled courts, closures, schedule boundaries, adjacent
sessions, expired holds and different browser timezones; results match real occupancy.
RLS/public projections do not disclose private source rows. One malformed query cannot
request unbounded history or private fields.

## 2.4 — Transactional reservation integrity

- Enable `btree_gist` and add an exclusion constraint on court ID plus active, finite,
  nonempty `[start, end)` `tstzrange`. Do not put database time in the constraint predicate.
- Implement narrow internal create/release functions and state-transition checks.
  Validate court configuration, ranges, local-hour alignment, duration, price versions
  and actor permissions inside the transaction as well as at the server boundary.
- Lock courts/booking records in a documented consistent order, reconcile eligible
  expired holds, resolve configuration/snapshot, and insert booking/items/occupancy/audit
  atomically. Multi-court operations lock sorted court IDs and roll back as a unit.
- Guest lead-time logic uses database time; an authorized staff last-minute exception
  never bypasses overlap checks. Unresolved public cutoff details stay provisional.
- Enforce actor-bound idempotency: same key/payload returns the same result; changed
  payload fails. Only legal transitions can release occupancy or create another claim.
- Do not schedule a production expiry job or implement payment review. Test local hold
  expiry/release races now; scheduler startup and guest/payment races complete in later
  milestones with their corresponding workflow.

Gate: 20 simultaneous attempts for the same court/time produce exactly one successful
transaction/occupancy; adjacent intervals succeed; all overlap types fail at the DB
boundary, even without the UI. Also test concurrent settings changes, retry collisions,
release/creation races and atomic rollback. No partial booking, duplicate audit result
or orphan occupancy survives a failed transaction.

## 2.5 — Staff authentication and protected application boundary

- Add supported Supabase SSR browser/server clients and validated cookie handling.
  The Phase 1 stateless connection factory is not an authenticated session client.
- Add staff login/logout and session refresh. Verify user identity on the server using
  the supported validated Auth method, not a role sent from the browser or an unverified
  session payload. Do not cache authenticated pages across users.
- Protect `/staff` on the server and check active DB role on every protected operation.
  Replace its public-demo access behavior only when the new auth tests are in place;
  keep demo fixtures synthetic for authenticated local demonstrations.
- No public staff registration or self-service owner role assignment. Bootstrap one local
  synthetic owner with a guarded local-only helper. Test staff/owner role changes and
  immediate deactivation. Production invitations/MFA setup require later authorization;
  document owner MFA as a production launch prerequisite.
- Enforce request origin/CSRF checks on cookie-authenticated mutations, secure cookie
  settings and safe errors. Never expose service-role keys to clients or use privileged
  clients to bypass normal staff RLS.

Gate: anonymous `/staff` access redirects to login; active staff/owner can access the
permitted shell; logout, expired sessions and deactivated roles deny access. Forged
role metadata, cross-origin writes and ordinary staff role/publication mutations fail.
Update the existing dashboard browser tests to authenticate with synthetic local users;
do not simply disable the tests that previously exercised the public demo.

## 2.6 — Database security and automated acceptance

- Enable deny-by-default RLS and explicit grants on every introduced table; document
  anonymous, staff and owner access per operation. Use a safe availability projection.
- Staff can use authorized reservation operations; owners can publish configuration and
  administer roles. Neither can rewrite immutable agreements/audit history through the
  supported application role. Define narrow correction operations rather than broad
  table update access.
- SECURITY DEFINER functions, where necessary, use a fixed safe search path, qualified
  references, explicit execute grants and internal authorization. Prevent role escalation
  through profile edits, caller parameters or unaudited privileged functions.
- Use synthetic data only. Test actual PostgREST/function grants and Auth identities,
  including direct reads/writes that bypass application routes. Admin/test clients must
  not stand in for low-privilege actors in RLS tests.
- Extend Vitest for date/config/state/centavo logic, real Supabase/PostgreSQL integration
  for migrations/RLS/grants/concurrency, and Playwright for Auth/protected staff shell.
  Keep lint/build and public presentation/accessibility regression checks in CI.

Gate: all existing applicable checks plus the new suites pass with real test counts and
zero unresolved integrity/authorization failures. Clean migration replay works; secret
scan passes; failure/recovery commands are documented. There is still no live booking,
payment process, real customer data or deployed production environment.

## Decisions needed at the appropriate gates

Before 2.2/2.5: approve effective-date precedence, immutable-history behavior and the
owner/staff permission matrix. During local setup: confirm CLI/key/session compatibility
and Docker capability; use actual locally supplied auth configuration without committing
values. Unresolved operating hours, lead-time equality, payment cutoff/review policy,
refund rates and reschedule terms remain in DECISIONS-AND-RISKS.md and block their live
workflows later; they do not require production credentials or invented policy now.

Phase 1.1 corrections are separately documented in PHASE-1.1.md. The user has now explicitly authorized the Phase 2 implementation; external provisioning,
push, merge and deployment remain separately restricted.
