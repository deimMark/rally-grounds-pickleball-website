> Phase 1.1 visual corrections: local review branch `phase-1-1-visual-qa`.
> See [changes and validation](docs/PHASE-1.1.md) and [QA/screenshots](docs/qa/phase-1.1/REVIEW.md).
> The published `owner-demo` branch remains unchanged; these corrections are not deployed.

> Owner demonstration branch: Phase 1 mock-only baseline. See
> [Owner demo checkpoint](docs/OWNER-DEMO.md) for tests, limitations and Vercel authorization.
> No guest booking, payment collection or Supabase configuration is required.

# Rally Grounds

Phase 1: a mobile-first public website, interactive mock court selector and read-only
staff/owner dashboard foundation. Built in the Codex cloud workspace using Next.js
App Router, React, JavaScript and Tailwind CSS. No VS Code or local checkout is required.

## Run in the cloud workspace

Use Node 24 (the tested version is in `.nvmrc`) and npm 11.9.0. In the cloud terminal:

```sh
cd /workspace/rally-grounds-pickleball-website
npm --cache /tmp/rally-npm-cache ci
npm run dev
```

The app binds to `0.0.0.0` on port 3000. `/` is the public presentation;
`/staff` is an explicitly public, synthetic dashboard demo. Use your cloud workspace's
supported port-viewing mechanism if available. This does not deploy the application.
This chat's onboarding view may not provide web previews; server checks can still run
inside the cloud machine. No Supabase configuration is needed for the demo.

For the optimized application, run `npm run build`, then `npm run start`.
Live processes must be started again when a cloud session restarts.

## Checks

```sh
npm run lint
npm run test
npm run build
# Chromium is already installed in this cloud machine:
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

Playwright starts the built application automatically if port 3000 is free. Avoid
running a stale build on that port while testing a new one. Outside this cloud machine,
install Playwright Chromium with `npx playwright install --with-deps chromium`, then run
`npm run test:e2e`. The standard Playwright download is blocked by the current cloud
egress policy; using installed Chromium avoids that download. CI installs its browser.

## Phase 1 boundaries

- Every availability slot, demo date, session and financial figure is synthetic.
- Selector previews stay in React memory, reset on reload, collect no personal data,
  and never create a reservation, hold or payment.
- `/staff` has no Auth or protected operations. Do not add real records to this route
  before implementing server authorization and database policies in Phase 2.
- Supabase has an optional server-only publishable-key connection factory. It is unused
  by demo loaders, makes no automatic calls, and does not prove connectivity.
- No live booking, GCash verification, Google Calendar, Reclub synchronization, customer
  records, database migrations or external resources are included.
- All demo dates are fixed and explicitly labeled; the app does not pretend to show today.
- No approved logo was present; the header uses the club's name as text.

## Data and design seams

`lib/server/demo-data.js` is the server data boundary. The public loader supplies only
public synthetic fields; the staff demo uses a separate loader. Future Supabase reads
and authorization belong on that server boundary, not in UI components.

`lib/demo/` holds branding, presentation-only rates/hours, court coordinates, explicit
slot fixtures and dashboard examples. These are mock content, not an implementation of
live policies. Phase 2 will introduce versioned database configuration and rules.
`app/globals.css` defines the six supplied design colors, typography and reusable
component styles, using Tailwind v4 theme tokens and utilities. Font files are bundled
locally through Fontsource; no runtime font service is required.

The latest Phase 1 court arrangement is 3/4/5 across the upper row, Court 2 directly
below Court 5, and Court 1 directly below Court 2. Map and list use the same identities.

## Optional Supabase connection setup

Copy `.env.example` to `.env.local` only if an approved project is available. Supply
`SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` through secure environment configuration.
Only HTTPS or local-loopback HTTP endpoints and `sb_publishable_` keys are accepted.
Legacy JWT/secret/service-role keys are intentionally unsupported by this Phase 1
factory. No key needs a `NEXT_PUBLIC_` prefix. Do not add service credentials to the demo.

The app remains mock-only even when configuration exists. Staff SSR Auth/session
handling, real reads, RLS and Storage policies are later-phase work. Do not reuse this
stateless connection factory as an authenticated staff session client.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Milestones](docs/ROADMAP.md)
- [Decisions and security risks](docs/DECISIONS-AND-RISKS.md)
- [Phase 1 scope and verification](docs/PHASE-1.md)
- [Photo and font attribution](docs/ASSETS.md)
- [Engineering instructions](AGENTS.md)

No deployment, push or external resource creation is authorized by this implementation.
