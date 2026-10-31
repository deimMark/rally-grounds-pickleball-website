# Phase 1 QA checkpoint

Reviewed **31 October 2026, 4:01 PM Asia/Manila**. No new product features, Phase 2
implementation, deployment, push, commit, remote change or external resource creation.
This checkpoint adds only QA documentation, capture metadata and screenshots.

## Result

The existing application runs successfully. Both `/` and `/staff` returned HTTP 200.
Lint, the production build, **all 16 unit tests** and **all 13 browser tests** passed.
The current development server on port 3000 was left untouched. Browser tests and
screenshots used a separate local production server on port 3100, which was stopped
when capture finished. No user-facing loopback preview links were created.

## Screenshots

Captured from the current production build using Chromium 154, locally bundled fonts,
light color scheme, reduced motion, device scale 1 and Manila timezone. Full-page
captures include below-the-fold content; the navigation capture is a viewport image.

| View | Capture | Browser viewport |
| --- | --- | --- |
| Desktop homepage | [desktop-homepage.png](desktop-homepage.png) | 1440 × 1000 |
| Mobile homepage | [mobile-homepage-390.png](mobile-homepage-390.png) | 390 × 844 |
| Five-court selector | [five-court-selector.png](five-court-selector.png) | 1440 × 1000; section capture |
| Staff dashboard | [staff-dashboard.png](staff-dashboard.png) | 1440 × 1000 |
| Open mobile navigation | [mobile-navigation-390.png](mobile-navigation-390.png) | 390 × 844 |

[Capture metadata](capture-metadata.json) records time, viewports, browser version,
computed theme values and zero browser page errors during capture. The selector capture
shows a synthetic Court 2 session preview that explicitly says no court was reserved.

## Current routes

| Route | Behavior |
| --- | --- |
| `/` | Public homepage, club information, mock court selector and community content. |
| `/staff` | Public, read-only owner/staff **demo**, with synthetic metrics and schedule filter; no staff authentication. |
| Unmatched paths | Custom HTTP 404 page; Next's `/_not-found` build entry is its internal fallback. |

`/#the-club`, `/#courts` and `/#community` are homepage anchors, not separate routes.
The staff page also has `#schedule` and `#upcoming` anchors. There are no booking,
payment, API, customer-account or authentication routes.

## Verification

| Check | Current outcome |
| --- | --- |
| `npm run lint` | Passed. |
| `npm run test` | 16 passed, 2 files; no failures or skipped tests. |
| `npm run build` | Passed; homepage, staff demo and internal 404 fallback built. |
| Existing Playwright suite | 13 passed; no failures or skipped tests. |
| Responsive checks | Both routes pass at 360, 390, 768 and 1440 CSS pixels without page overflow. |
| Interaction checks | Map/list, court layout, selection/reset, disabled slots, preview-only behavior, keyboard controls, mobile navigation and schedule filtering pass. |
| Accessibility scans | No serious/critical findings in the suite's scoped WCAG A/AA scans on both routes at 390 pixels. Not complete WCAG certification. |

To avoid accidentally testing the running development server, the existing Playwright
configuration was imported by a temporary config in `/tmp/rally-phase1-qa.config.mjs`.
Only the base URL/server port, absolute test directory and temporary result path were
overridden. The existing 13 tests were unchanged. Executed command:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e -- --config /tmp/rally-phase1-qa.config.mjs
```

The temporary server was started from this checkout using `npm run start -- --port 3100`.
GitHub CI, Firefox/Safari, real-device testing, Supabase connectivity and future database
integrity tests were not run and are not represented as passed.

## Placeholders and incomplete functionality

- Club name text substitutes for an official logo; no logo asset has been supplied.
- The coastal photograph is credited licensed stock from Bulgaria, explicitly labeled
  as not Rally Grounds facilities. Court artwork is a labeled illustration.
- Dates (7–9 November 2026), court availability, sessions and financial figures are fixed
  synthetic fixtures. Selector state is temporary, collects no guest data and reserves
  nothing. Claimed payments are separately labeled from synthetic verified receipts.
- PHP 600/hour is illustrative; 8 AM–11 PM is provisional; exact address/opening details
  remain unconfirmed. These displays are not an implemented policy/pricing engine.
- Supabase has an unused server-only connection factory, with no configured credentials
  or verified connection. No database schema, Auth, RBAC, Storage setup or persistence.
- No live booking/conflict enforcement, payment upload/verification, customer management,
  editable owner settings, live analytics, Reclub sync or Google Calendar integration.
- Planned dashboard module cards are informational; no protected operations are enabled.

## Visual review

The four requested primary tokens exactly match the supplied values:
navy `#102B50`, blue `#1E5A99`, gold `#D7AD6B` and ivory `#F8F5ED`.
Midnight and clean white are also declared in the source theme. Tailwind omits the unused
white custom property from computed CSS; white surfaces currently use literal colors.
The court arrangement is correct: 3/4/5 across the top, Court 2 beneath Court 5,
and Court 1 directly beneath Court 2. No page overflow was found at tested widths.

Polish items for review, **not fixed in this checkpoint**:

1. The decorative hero star renders as a green emoji on this Chromium/Linux system,
   rather than the intended gold text glyph. A deterministic decorative SVG/CSS shape
   would avoid the platform-dependent color and appearance.
2. Dashboard background `#F3F5F7` and community background `#EEEEE8` introduce cool/gray
   surfaces alongside the warm ivory palette. Confirm these supporting neutrals or
   align them with the approved ivory surface system in a later styling pass.
3. The public brand punctuation uses darker gold `#9B702E`; the footer uses champagne
   gold. Confirm this contrast-oriented variant or standardize the decorative detail.
4. Court/status surfaces use supporting green, amber and gray tones; several are literal
   values rather than named semantic design tokens. They are text-labeled, not color-only.
5. Several desktop/helper labels are 8–10 px. They pass the scoped contrast checks, but
   increasing them would improve comfort during an owner demonstration and on phones.

The primary palette and overall layouts are consistent; the issues above are presentation
polish, not blockers to the mock demonstration. They do not establish production readiness.

## Supplying and registering the official logo

There is **no upload/registration screen** in Phase 1. No VS Code is needed:

1. Attach the official logo file in this chat or upload it through the cloud workspace's
   file-upload control. Prefer the original approved SVG or a high-resolution transparent
   PNG. Include a light/dark variant only if the club already supplies one; do not invent it.
2. In a separately authorized branding update, inspect/sanitize an SVG before use (or use
   the approved PNG), then place it under `public/branding/`, for example
   `public/branding/rally-grounds-logo.svg`. Avoid embedded scripts and remote resources.
3. Register its public path, accessible label, intrinsic width/height and any supplied
   variant in `demoClub` within `lib/demo/club.js`. This is local presentation metadata,
   not a database record or an existing settings feature.
4. Pass that metadata through the public/staff shells to the shared `Brand` component
   in `components/ui/brand.js`. Render it using `next/image`, retaining the home link,
   intrinsic aspect ratio and suitable contrast in the header, footer and staff sidebar.
5. Record asset ownership/provenance in `docs/ASSETS.md`, rerun checks and replace the QA
   screenshots. Future owner-managed media registration remains later-phase work.

These are instructions only; no logo asset, registration code or upload endpoint was
created during this checkpoint.

## Git and secret handling

- Current symbolic branch: **`work` (unborn; no commits)**.
- All Phase 1 application files are **untracked working files**. There is no committed
  application revision or commit SHA to review yet; the implementation is not on GitHub.
- `origin` is configured for **github.com/deimMark/rally-grounds-pickleball-website.git**.
  Remote configuration was inspected without printing credentials and was not changed.
  No fetch or push was needed for this checkpoint.
- **No secrets or sensitive configuration are committed: there are no commits or tracked
  files at all.** A targeted credential-pattern scan of 45 source/config/text files found
  no real credentials, and production browser JavaScript contained no Supabase server
  configuration identifiers. This is scoped inspection, not a guarantee about every
  possible secret format.
- Only `.env.example` exists at the checkout root; its values are blank. `.env.local` and
  `.env.production` are ignored. No Supabase URL, publishable-key or service-role-key
  variables are set in the current process. Values were never printed.
- The connection module uses `server-only`; there are no service credentials in the
  demonstration. Unit-test key strings are explicitly synthetic, nonfunctional fixtures.

Phase 2 remains unstarted. Before relying on a Git review or remote backup, the current
working files need an initial commit; no commit or push was made by this QA checkpoint.
