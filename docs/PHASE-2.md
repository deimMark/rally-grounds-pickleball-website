# Phase 2 — implemented local foundation

Phase 1 is the approved baseline. The user authorized Phase 2 on a dedicated development
branch, `phase-2-foundation`. This record supersedes old Phase 1-only restrictions in
the historical planning/QA records. It does not authorize a push, merge, deployment or
production service connection.

## Reconciled scope and architecture

- AGENTS.md and the proposal previously said Phase 2 was not authorized. The latest user
  instruction authorizes it; the agent instructions now reflect the active phase.
- The original roadmap deferred availability UI to Phase 3. Phase 2 implements a real
  privacy-safe database/server availability service, while the public selector remains
  visibly synthetic until the reviewed guest booking integration.
- The old `/staff` page was public synthetic content. It is now guarded by validated
  Supabase Auth identity plus an active database staff role. Its schedule/metrics remain
  labeled synthetic; authentication is real and tested locally.
- Payment/evidence tables and Storage tests are deferred with the workflows in Phase 4;
  no empty payment schema or bucket was created to claim those future checks passed.
- Proposed effective-date semantics and owner/staff boundaries are engineering defaults
  for this local foundation. Undecided commercial policies remain explicit null values
  or provisional seed settings; no live guest booking policy has been invented.

## Reproduce in this cloud workspace

From `/workspace/rally-grounds-pickleball-website`, with Node 24 and Docker available:

```sh
npm --cache /tmp/rally-npm-cache ci
npm run db:start
npm run db:migrate
npm run db:staff
npm run dev
```

`db:start` starts only the designated `rally-grounds-local` Supabase project with database,
Auth, REST and gateway services. Studio, Storage, Realtime, Edge, analytics and email
capture services are disabled. The pinned CLI uses official digest-pinned slim images
because the standard Postgres image exceeded this cloud Docker backend's storage limit.

The cloud injects a proxy into containers. BusyBox `wget` ignores `no_proxy`, causing
Auth's localhost health check to receive HTTP 403 despite Auth responding normally.
`scripts/start-local-stack.mjs` detects that condition and installs a local-container
wrapper for that exact health URL. Its request uses `wget -Y off` to reach loopback;
other URLs keep their normal proxy behavior. Real health checks remain enabled. TLS
and artifact integrity verification are not disabled. No production container is touched.

The CLI's supported `SUPABASE_HOME` points to `/tmp/rally-supabase-home`; no system HOME
variable is repurposed. CLI output that may contain credentials goes only to private
`/tmp` logs. Connection configuration is generated in ignored, mode-0600 `.env.local`;
existing unrelated settings/APP_ORIGIN are retained, and a different existing Supabase
URL is not silently replaced. No service key is written into app configuration.

`db:staff` is a guarded local Auth administration helper. It generates/rotates synthetic
owner, staff, inactive, outsider and revocable-test identities, records local bootstrap,
and saves credentials only in ignored `.env.test.local`. No real staff account, outbound
customer message, default production password or public registration is created.

`db:migrate` applies pending local migrations without a reset. `db:reset` drops/rebuilds
this local database, applies migrations and seed, then refreshes the local connection.
Use `db:staff` afterward. **Reset and integration tests destroy synthetic domain records
in this designated instance**; do not use it for records you need to preserve.
All administration helpers verify the project identity and local API/DB host/ports.
They cannot accept a remote database URL or linked-project flag.

Set APP_ORIGIN to the exact browser origin used for sign-in; the generated default is
`http://127.0.0.1:3000`. This is a trusted server setting, not a value taken from request
Host/forwarded headers. No credentials need a NEXT_PUBLIC prefix. Staff auth cookies
are HttpOnly, SameSite=Lax and Secure when APP_ORIGIN uses HTTPS. Proxy refresh and
server guards use validated `getUser()` results, never unverified session/role metadata.

## Database and service contracts

The foundation migration, `20261031000100_foundation.sql`, creates:

- Courts and immutable versioned club settings, court configuration and typed policies.
- Staff profiles, minimal private customers, bookings, immutable agreement snapshots and
  court/time items, canonical occupancies, actor-bound idempotency records and audit.
- Owner-only publication/role RPCs, staff-only quote/create/release/block RPCs, and a safe
  anonymous availability projection. All tables use RLS with explicit grants.

Five stable court IDs are seeded, with 3/4/5 above, 2 beneath 5, and 1 beneath 2. Values
are integer centavos (initial rate 60,000); ranges/timestamps use timestamptz, with Manila
operating-hour evaluation and a UTC database default. Initial hours are provisionally
08:00–23:00. The deployment timezone is seeded configuration; changing it later is
rejected by the publication RPC and requires a separately reviewed migration.

Operational court rates/hours resolve at service time, across each effective-version
segment. Contractual policy resolves when a quote/create decision is made. New policy
versions are append-only and activate by database time. Existing agreements retain the
price breakdown, policy/club IDs and policy snapshot. No application role can edit them.
Court publication rejects hours/disable changes that would invalidate active occupancy;
rate changes may publish while old bookings retain their agreed amount.

`lib/server/availability.js` validates one ISO club day, calls the safe RPC and normalizes
returned instants to UTC. Results contain only court ID/number, start/end, status and
timezone. They never include customer details, booking references or evidence. The
public website still loads separate mock presentation fixtures.

`lib/server/booking.js` provides protected server wrappers around the same transactional
RPCs tested directly through PostgREST/Auth. These are an internal foundation, not a
public guest booking endpoint. Inputs are revalidated in PostgreSQL, including current
role, configured alignment/hours, agreed total and occupancy.

A PostgreSQL GiST exclusion constraint prevents overlaps of any active reservation,
hold, open-play block or maintenance block on the same court. `[start,end)` allows
adjacent sessions. Database checks also reject empty/unbounded/infinite ranges and
incorrect bounds. Writes acquire a shared calendar/configuration lock and stable court
locks; configuration/role changes acquire the exclusive calendar lock. Idempotency is
scoped to actor/key/operation/payload; all related rows and audit writes commit together.

Two additive migrations refine scheduled validation windows and bind reservation creation
to accepted agreement versions. Quotes return `version_context`; callers pass that
context as `agreedVersions`/`p_expected_versions` along with the agreed total. The database
rejects a changed policy even when the price stays the same. The old RPC signature is
removed, so callers cannot bypass that check. The context is version metadata, not an
authorization token or a promise that a court remains available.

Operational publication validates only its effective window, ending at the next scheduled
version. Price-only updates do not reject existing maintenance occupancy. Reservations
spanning a configuration boundary are validated for the affected segment, while their
original agreed price/terms remain unchanged.

Staff creation currently creates **only an unpaid hold**, with an explicit future
hold deadline no later than start or the configured maximum window. There is no confirm,
payment-review or guest creation path. It does not infer the unresolved public payment
cutoff. Expired holds are ignored in the safe projection and released atomically by the
next reservation/block write under the court lock. An automatic scheduler remains Phase 3.
Release is idempotent and cannot resurrect occupancy. Open-play/maintenance multi-court
blocks roll back completely if any court conflicts.

## Permissions and routes

| Actor | Database/application access |
| --- | --- |
| Anonymous | Public demo and safe availability RPC only; no private base-table reads or reservation writes. |
| Auth user without active staff role | No staff workspace; no sensitive rows or mutation authority. |
| Active staff | Protected workspace and configuration/reservation reads; authorized reservation/block operations. No direct table writes, configuration publication, role changes, customer/audit/idempotency reads. |
| Owner | Staff operations plus version publication and role administration; private customer/audit/idempotency reads. Cannot remove the last active owner or rewrite immutable agreements/audit rows. |

Customer access is deliberately owner-only until a separately reviewed CRM/assignment
workflow. Staff RPC authorization reads the live staff profile rather than mutable Auth
user metadata, so deactivation denies existing sessions on the next request. Direct
application writes are revoked; SECURITY DEFINER helpers have a fixed empty search path,
qualified objects and explicit grants. Private helpers have no app-role execution grants.
Successful sensitive changes are audited transactionally with actor/action/entity/time
and minimal redacted metadata; failed transactions leave no partial audit or domain rows.

Routes: `/` (public mock site), `/staff/login` (sign-in), `/staff` (protected synthetic
workspace), POST `/auth/login` and POST `/auth/logout`. Cookie mutation handlers reject
missing/mismatched Origin; other methods are not accepted. Private staff responses use
no-store caching. No public booking/customer/payment API has been added.

## Known limitations and undecided policies

- No public guest creation, capability recovery, payment screenshot handling, GCash
  verification, refund ledger, rescheduling UI, live analytics, Storage policies or
  calendar/Reclub integration. Future ledgers can reference stable booking/agreement IDs.
- Booking records already include a random guest-reference UUID, estimated player count,
  source, stable court/time items and immutable monetary terms. A reference is not a
  guest authorization token; it is not exposed by availability.
- Only held/cancelled/expired reservation states exist now. Verified/confirmed/completed
  states and settlement/refund transitions need explicit later migrations and tests.
- Guest lead-time equality, payment cutoff, refund percentage, booking horizon and maximum
  duration decisions remain unconfirmed; their undecided database fields are null.
  Known one-hour minimum/full-hour starts and provisional duration/hour settings are
  versioned. No null value is interpreted as a fabricated commercial percentage/limit.
- The current operating schedule is uniform per court/day, with future-effective changes
  and explicit closures. Weekly/holiday recurrence is not implemented. Reservation RPCs
  support intervals within a single club day and at most 24 hours as a technical bound.
- An automatic hold-expiry job, hold-abuse limits and production observability/rate limits
  remain later work. Public availability is advisory; the write transaction is authoritative.
- Local bootstrap is not a production invitation/recovery process. Owner MFA, account
  recovery, production cookie/domain configuration, backup/restore and incident drills
  remain launch gates. Auth sign-out follows Supabase JWT lifetime semantics; deactivating
  the DB staff role is the immediate application authorization revocation mechanism.
- No external Supabase project, production resource, GitHub push, deployment or merge
  has been performed. CI is defined locally and has not executed on GitHub.
- Phase 1.1 visual corrections, including official logo integration, remain pending.

## Reusable cloud configuration

The existing cloud configuration draft now saves the tested Phase 2 `install_script` and
`start_skill`. They install locked dependencies, start/migrate the local stack, manage
synthetic local Auth fixtures and restart/verify the application. Routine installation
never resets the domain database. Secret/network/repository settings were preserved.
Draft saving was confirmed; it has not been published and fresh-task restoration has
not been validated. For future-session reuse, review/save the draft in environment
settings and publish the environment snapshot when ready; this is separate from a
website deployment or GitHub push.
