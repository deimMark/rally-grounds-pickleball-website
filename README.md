# Rally Grounds

Phase 3B.1 is a **local-only** guest security milestone. See
[implementation](docs/PHASE-3B1.md) and [QA](docs/qa/phase-3b1/REVIEW.md).
Guest admission is off by default; no real guest booking or public launch is enabled.
Run `npm run db:guest` only for the designated local synthetic environment.

A single-club pickleball application foundation for San Juan, La Union. Phase 1 is the
approved visual baseline; Phase 2 adds a local Supabase database, secure staff access,
versioned policies and tested reservation/availability services. The public selector and
dashboard figures are still explicitly synthetic. No live payment or guest booking UI. Phase 3A corrects selected-duration availability,
receipt/current-state separation and authorized block release; see its review records below.

## Develop in the cloud workspace

No VS Code or local checkout is required. Use Node 24 (`.nvmrc`), npm 11.9.0 and Docker:

```sh
cd /workspace/rally-grounds-pickleball-website
npm --cache /tmp/rally-npm-cache ci
npm run db:start
npm run db:migrate
npm run db:staff
npm run dev
```

The app listens on `0.0.0.0:3000`. `/` is the public demo, `/staff/login` is staff sign-in,
and `/staff` requires a validated active staff/owner account. Use a supported cloud
port-viewing mechanism if available; no deployment is performed by these commands.
Live database/app processes must be restarted in a new cloud session.

The local-only helpers create ignored `.env.local` connection settings and
`.env.test.local` synthetic Auth identities/passwords. View local credentials privately
in the workspace if needed for the walkthrough; do not commit them. There is no default
production password, public registration or service key in application configuration.
APP_ORIGIN must match the exact browser origin used for sign-in (default local port 3000).

The CLI uses official slim images and a scoped correction for BusyBox's localhost
health check in this cloud proxy environment. See [Phase 2 operations](docs/PHASE-2.md).
Existing different Supabase configuration is not overwritten. No remote project is linked.

For optimized execution, use `npm run build` then `npm run start`. `npm run db:migrate`
applies pending local migrations; `npm run db:stop` stops this project's containers.

## Validate

```sh
npm run lint
npm run test
npm run check:secrets
# DESTRUCTIVE to this designated local synthetic database; never use for real records:
npm run db:reset
npm run db:staff
npm run test:integration
npm run build
# Existing cloud Chromium; port 3100 avoids the development server on port 3000:
TEST_PORT=3100 PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

Integration tests use real Supabase Auth/PostgREST/PostgreSQL, truncate/reseed domain
fixtures between tests, and verify 20 simultaneous attempts for one court/time.
They refuse remote administration targets. Browser tests use synthetic identities and
retain the existing public/mobile/selector checks alongside staff Auth checks. Traces
are disabled because Auth traces can contain passwords/session tokens. All generated
test output and local credentials remain ignored.

On other machines, install Chromium with `npx playwright install --with-deps chromium`,
then omit the executable override. The ordinary browser download is blocked by this
cloud's network policy; installed `/usr/bin/chromium` works. GitHub CI is defined but
is not executed until a separately authorized push/publication.

## Data and security boundaries

- `supabase/migrations/` and `supabase/seed.sql`: reproducible local schema and provisional
  synthetic club configuration. No real customer or payment seed records.
- `lib/server/booking.js`: authenticated internal quote/create/release/block operations.
  Database functions revalidate identity, configuration, price and conflicts atomically.
- `lib/server/availability.js`: safe one-day projection with UTC instants and Manila hours.
- `lib/supabase/` and `lib/server/staff-auth.js`: server-only connection/Auth and role guards.
- `lib/demo/` and `lib/server/demo-data.js`: mock presentation fixtures, kept separate from
  actual reservations. Protected dashboard figures are not live revenue or utilization.
- `app/globals.css`: supplied brand colors, typography and reusable presentation styles.

All introduced tables have deny-by-default RLS and explicit grants. Active staff/owner
roles come from the database, not client claims. Customer/audit records are owner-only
in this foundation. No public mutation endpoint, payment workflow or customer API exists.
Configuration is versioned; agreement snapshots and audit history are immutable.

Supabase configuration stays server-side. `.env.example` contains names only plus a
nonsecret local origin. Only publishable keys are accepted by the application factory;
service-role/admin credentials are confined to guarded local setup helpers.

## Review records

- [Phase 3A changes](docs/PHASE-3A.md), [QA](docs/qa/phase-3a/REVIEW.md), [proposed Phase 3B contracts](docs/PHASE-3B-CONTRACTS.md)
- [Phase 2 implementation and operations](docs/PHASE-2.md)
- [Phase 2 QA](docs/qa/phase-2/REVIEW.md)
- [Architecture](docs/ARCHITECTURE.md), [roadmap](docs/ROADMAP.md), [decisions/risks](docs/DECISIONS-AND-RISKS.md)
- [Phase 1 QA and screenshots](docs/qa/phase-1/REVIEW.md) — historical baseline
- [Pending Phase 1.1 corrections](docs/PHASE-1.1.md), [asset provenance](docs/ASSETS.md)
- [Engineering instructions](AGENTS.md)

No official logo was supplied; club-name text remains. Stock photography is credited
and explicitly identified as not Rally Grounds facilities. No push, deployment, merge,
production resource or calendar connection is authorized by local startup.
