# Phase 1 implementation record

The user explicitly authorized Phase 1 implementation after reviewing the architecture.
The application is a local/cloud presentation foundation, not a live booking system.

## Scope adjustments from the original roadmap

1. Supabase is **connection setup only** under the latest instruction. A server-only
   publishable-key factory and configuration validation are provided. No project, schema,
   migration, Storage bucket, Auth setup or live query is created. The original Phase 1
   database/integration gates move to Phase 2; they are not reported as passed.
2. The latest layout is Courts 3/4/5 across row one; Court 2 at row two, column three;
   Court 1 at row three, column three. This clarifies the older lower-row wording.
3. The owner/staff **demo foundation** is included now. Real operational permissions and
   Auth remain Phase 2, scheduling/payment workflows remain later milestones.
4. Supplied brand colors supersede the earlier unresolved color-values decision. No
   logo asset exists in the checkout. The club name is rendered as plain text.
5. Phase 1 is implemented in the existing Codex cloud checkout. No VS Code/local-machine
   setup is required; no worktree, deployment, push or external resource was created.

## Implemented

- Next.js App Router 16.4.3 / React 19.3.1 / JavaScript and Tailwind 4.3.3; pinned
  dependencies and lockfile. Node 24.19.0 and npm 11.9.0 are the tested tools.
- Six requested colors as Tailwind theme tokens; shared typography, buttons, notices,
  responsive shells, visible focus, reduced-motion support and loading/error views.
- Public homepage with club introduction, illustrated court artwork, licensed locally
  served HD stock photography, transparent provisional details and a responsive menu.
- Interactive court map and list; labeled mock days and availability; unavailable/open-
  play samples; selection reset on day/court changes; an explicitly nonbooking preview.
- Separate `/staff` shell, clearly public synthetic data, financial metric categories,
  read-only schedule filter and planned-module cards. No customer records are included.
- Server data loaders separate public presentation and staff demo fixtures, preparing a
  future place for authorized database reads without coupling UI to Supabase.
- Optional Supabase configuration/factory entirely server-side. No configuration is
  needed to demonstrate the application. No service-role credential is accepted/required.
- Vitest, Playwright, axe accessibility checks and a GitHub Actions workflow definition.
  Creating this local workflow file has not pushed or run any GitHub workflow.
- README with cloud run commands; asset provenance; scope changes documented without
  deleting the original architecture and acceptance gates.

## Verification in the cloud machine

- Locked clean install: `npm --cache /tmp/rally-npm-cache ci --no-audit --no-fund` passed.
- `npm run lint`: passed, no warnings/errors from the source lint check.
- `npm run test`: **16 tests passed** across two Vitest files.
- `npm run build`: passed; `/` and `/staff` build as static demo pages.
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e`:
  **13 tests passed** on installed Chromium 154.
- Browser checks cover both routes at 360/390/768/1440 widths without page overflow,
  image loading, mobile navigation, spatial court arrangement, preview-only behavior,
  selection resets, disabled slots, keyboard controls and schedule filtering.
- Both routes have no serious/critical findings in the scoped WCAG A/AA axe scans at
  390 pixels. This is scoped evidence, not a claim of complete WCAG certification.
- Visual inspection is performed on desktop/mobile captures. Browser errors and
  unexpected mutations are asserted in the appropriate browser tests.
- Runtime dependency audit: zero reported vulnerabilities at verification time.
- External GitHub CI and Supabase connectivity were not executed or verified.

The first browser run identified tablet overflow and contrast/scroll-region issues;
these were fixed and the complete browser suite passed afterward. No assertions were
removed to conceal the defects. The lazy-image check now scrolls into view before
waiting for load, matching the browser's actual lazy-loading behavior.

## Environment and remaining limitations

- Standard Playwright browser downloads return HTTP 403 under this cloud network's
  policy. The installed `/usr/bin/chromium` was used successfully; the config allows a
  browser executable override without hard-coding a cloud path for other environments.
- Supabase URL/publishable-key variables are not set in the current machine. This is
  expected for the mock-only scope; actual connection validation awaits an approved
  project/configuration. No secret values are requested in chat.
- ESLint 9.39.5 matches current Next lint-plugin peer ranges; npm marks ESLint 9 as out of
  support. Upgrade it with the lint-plugin dependency chain when those peer ranges allow
  the supported major. Production-runtime audit is separate from tooling lifecycle.
- No persistence, staff login/RBAC, real availability, booking/conflict protection,
  payment upload/verification, customer management or live analytics is implemented.
- Demo dates do not advance with today. No guest input survives reload. Prices/hours are
  labeled illustrative/provisional and do not implement contractual policy evaluation.
- No proof of real club facilities or exact address is provided; approved club photos,
  logo and location details remain owner inputs. Stock photo origin is documented.
- Cross-browser Safari/Firefox, real device testing and complete manual accessibility
  review remain later validation. Database/RLS/concurrency tests are deferred, not skipped
  under a passing live-workflow claim.
- GitHub push, deployment and external resource creation still require explicit approval.

## Reusable cloud configuration

The existing environment draft now contains tested `install_script` and `start_skill`
fields. Installation refreshes locked dependencies and builds the app; startup describes
restarting the demo, readiness checks, and the installed-Chromium test path. No network,
secret or repository settings were replaced. Draft persistence was confirmed by the
configuration tool; it has not been published or tested through a new-task restoration.
For reuse in future cloud tasks, review/save the draft in environment settings and
publish the environment snapshot when ready. This is separate from deploying the website.

The development server was started with `npm run dev` in the current cloud instance;
functional browser requests to `/` and `/staff` returned HTTP 200, and the custom missing
page returned HTTP 404.
