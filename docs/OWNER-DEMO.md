# Owner demo preview checkpoint

This branch is a presentation-only fork of the approved Phase 1 `work` checkpoint
`753901cd3363a102d34c0cc77fbdcdfa2bde9a2b`. Branch: `owner-demo`.
No Phase 2/3 code or migrations are merged. Later backend work remains on its branches.
No GitHub default branch change, production configuration or external resource creation.

## Safe demonstration scope

- `/`: responsive homepage and interactive synthetic court/time selector.
- `/staff`: intentionally public, read-only synthetic dashboard; not staff authentication.
- No contact fields, reservation submissions, payment collection, evidence uploads or
  live availability. Every booking/financial figure is synthetic and visibly labeled.
- Courts 3/4/5 run left to right above Court 2, with Court 1 directly below Court 2.
- Server data loaders return only local fixtures. The unused optional Supabase connection
  factory does not execute any calls. No Supabase credentials are needed or configured.
- Existing robots metadata prevents indexing; this is not access control.
- `.vercelignore` excludes environment files, local provider state, dependencies/build
  outputs, test artifacts, historical QA captures and common private key files from uploads.
- Playwright accepts `TEST_PORT` and always starts its own production server, avoiding
  accidental validation against an existing backend-branch development process.

## Validation

Recorded 2026-11-02 in the cloud workspace. A clean `npm ci` used this branch's lockfile.
Ignored Phase 2 local environment files were temporarily moved outside the project for
build/browser validation, then restored without changing or printing their contents.
There were no Supabase variables in the process environment.

- Lint: passed.
- Units: 16 passed (2 files).
- Production build: passed; `/` and `/staff` are statically generated.
- Browsers: 13 passed (Chromium), including both routes at 360/390/768/1440 pixels,
  court geometry, keyboard controls, synthetic interactions and accessibility checks.
- Source/untracked/staged credential-pattern scans: passed. Only `.env.example` is
  tracked among environment files. Pattern checks do not detect every possible secret.

```sh
npm --cache /tmp/rally-npm-cache ci
npm run lint
npm run test
npm run build
TEST_PORT=3100 PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

Existing browser checks cover both routes at 360/390/768/1440 widths, mobile navigation,
loaded photo/fonts, court positions, keyboard selector interaction, preview-only behavior,
no selector mutation requests, synthetic dashboard filtering and serious/critical axe
accessibility violations. This does not establish a complete accessibility audit or
Firefox/Safari validation.

## Vercel authorization gate

No system-installed Vercel CLI, existing project link, Vercel environment binding or
standard saved login was found. Vercel CLI **65.9.0** was made available with npm exec
outside the project dependencies. Read-only `vercel whoami --non-interactive`, using a
writable temporary global config directory, returned **Logged out** (exit 1).
The default home config directory is not writable in this cloud environment.
No login flow, temporary/unclaimed deployment, project import or deployment was started.

**No Preview URL exists from this task.** Public access, successful hosted loading and
Deployment Protection cannot be verified before an authenticated deployment exists.

An authorized user must sign into the intended Vercel account/team securely and confirm
an appropriate Preview-only project/scope. Do not paste tokens into chat or commit them.
For this cloud environment, a supported interactive login can use a writable private
config directory outside the repository, for example:

```sh
VERCEL_TELEMETRY_DISABLED=1 npm --cache /tmp/rally-npm-cache exec --yes --package=vercel@65.9.0 -- vercel login --global-config /tmp/rally-vercel-cli
```

After authentication, inspect project/team settings and any existing environments before
creating a deployment. Do not import the default GitHub branch or connect this project to
production services. Do not reuse a project with inherited Supabase credentials. Stop
if billing, production deployment or additional account authorization is required.
An authenticated operator can then run a normal `vercel deploy` targeting **preview**
from `owner-demo`, never `--prod`, and verify the returned URL and deployment target.
Review the project name/scope interactively; do not blindly accept an existing project.
No custom domain or Git integration is needed for a CLI Preview.

Check hosted homepage/dashboard/assets and mobile layout, then check an unauthenticated
browser session for Deployment Protection. Report protected access honestly; request an
approved sharing method rather than disabling security or sharing bypass credentials.
Publication of this Git branch is separate from the local checkpoint and has not occurred.

## Missing assets and limits

No official logo is supplied; plain club-name text is preserved without inventing artwork.
The licensed stock photo is clearly labeled as not Rally Grounds facilities; see
[asset provenance](ASSETS.md). Actual facility imagery, exact location/opening details and
owner-confirmed operating terms remain pending. Phase 1.1 gold icon consistency, warm
surfaces and helper-text readability are separate, unimplemented visual corrections.
Fixed demonstration dates/rates are illustrative. There is no live booking/payment/Auth,
customer management, verified revenue or owner editing. No Phase 3B implementation.
