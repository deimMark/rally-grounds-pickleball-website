# Phase 1.1 visual QA — 2026-11-02

Result: **local checks passed; ready for review, not published or deployed**.
Branch: `phase-1-1-visual-qa`, created from `owner-demo` at
`1a9b04c262759ce62bf72573a86e3924c6809c48`. `owner-demo`, `work`, Phase 2 and Phase 3
branch tips remain unchanged. No merge, push, Vercel project/deployment or production
resource change occurred. This remains a credential-free, mock-only presentation.

## Before / after

| Before | After and evidence |
| --- | --- |
| Mobile schedule's horizontal table placed status beyond the initial viewport | Semantic cards below the 760 px breakpoint expose court, reference, time, session type and booking status. Browser tests verify every field fits at 320/360/390/760 widths, and the shared filter still returns DEMO-002 / Pending review. |
| Desktop schedule with small non-wrapping text | Desktop table retained, readable wrapping cells and complete status column at 1440. Hidden cards/table do not duplicate accessible content. |
| Net metric called “Net collected” in the actual baseline | “Net collections”: PHP 1,200 verified − PHP 300 completed refunds = PHP 900; PHP 600 unverified claims excluded. Unit regression verifies the calculation; every metric has DEMO FIGURE. No “Not collected” source label was found. |
| Coastal traveler photo unrelated to the sport | Local 1600 × 1066 community doubles pickleball photo, visibly illustrative/not Rally Grounds, optimized by Next.js Image with creator/source/CC BY-SA 4.0 links. Former asset removed. See [provenance](../../ASSETS.md). |
| 6–11 px informative helper text, cool secondary surfaces | Informative helpers/statuses/references/attribution now at least 12 px; warm ivory and named warm surfaces preserve the existing design. Decorative map artwork microcopy remains separate from meaningful helpers. |
| Platform-dependent star glyph and unverified compass | Deterministic Lucide asterisk in champagne gold; north arrow removed. Dark semantic text colors retained for contrast, with explicit state labels. |
| Draft club information not presented | Supplied name/address/phone displayed under “DRAFT CLUB DETAILS · OWNER CONFIRMATION PENDING” with an explicit unverified warning. Hours remain provisional. No telephone/map link or confirmed business structured data added. |
| Official logo missing | Asset search found no uploaded approved logo. Shared wordmark retained with decorative punctuation hidden from assistive technology. No invented logo. |

Historical Phase 1 reference: [homepage](../phase-1/desktop-homepage.png),
[dashboard](../phase-1/staff-dashboard.png). These original captures are unchanged.

## Exact test results

Node 24.19 / npm 11.9; local production Next.js build, system Chromium. No Supabase
variables were present; ignored local backend environment files were temporarily moved
outside the project for the build/browser/capture checks, then restored privately.

| Check | Result |
| --- | --- |
| `npm run lint` | Passed. |
| `npm run test` | **17 passed**, 2 files. Original 16 preserved; 1 synthetic net-collections regression added. |
| `npm run build` | Passed; `/` and `/staff` remain statically generated, no live guest/staff API routes. |
| `TEST_PORT=3100 PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e` | **21 passed**, 0 failed. Public/staff responsive checks at 320/360/390/768/1440; court layout/preview, keyboard, filter, mobile card visibility, desktop statuses, draft warnings and primary touch targets. |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium node scripts/capture-phase-1-1.mjs` | Five fresh screenshots; four desktop/mobile route scans with **zero axe violations**, helper sizes >=12 px and no page overflow. |
| Source/untracked and staged credential-pattern checks | Passed using the existing Phase 3A scanner read into `/tmp`; not merged into this branch. Only `.env.example` tracked among environment files. Scoped checks do not detect every possible secret format. |
| `git diff --check` | Passed. |

Browser tests assert visible mobile detail text does not overflow its card/viewport,
not merely that the status element exists. The desktop table is also checked for
horizontal clipping. Keyboard focus reaches the native filter, court controls, mobile
navigation and preview controls; static cards are semantic lists/definition lists and
do not add unnecessary tab stops. Relevant controls have 44 px targets; focus outlines
remain visible, using gold within dark shells.

## Text contrast and accessibility review

WCAG relative-luminance calculations for actual text pairs (normal-text threshold 4.5:1):

| Foreground / background | Ratio |
| --- | --- |
| Navy / warm ivory | 12.99:1 |
| Athletic blue / warm ivory | 6.47:1 |
| Muted helper / white | 6.29:1 |
| Muted helper / warm supporting surface | 5.33:1 |
| Champagne gold / navy (draft labels) | 6.79:1 |
| White / midnight (photo credit) | 18.24:1 |
| Confirmed status text / green status surface | 6.22:1 |
| Pending status text / warm status surface | 6.00:1 |
| Open-play status text / blue status surface | 7.42:1 |

Photo attribution has an opaque dark backing; its contrast does not depend on the photo.
Decorative gold on light backgrounds is not used for meaningful small text. Court state
always has a text label. Muted text against the darkest map dot is 4.65:1; primary map text is navy.
Hero artwork and patterned-map contrast require manual review
because axe cannot resolve all pseudo-elements/gradients; those incomplete rule counts
are recorded transparently in [capture metadata](capture-metadata.json). The earlier
unroled “Court view” label was corrected to a proper control group. The dashboard scans
have no incomplete rules. Screenshot review covers the map labels, artwork spacing and
status visibility. Automated scans do not establish complete WCAG 2.2 conformance.
Firefox/Safari, physical touch devices and manual screen-reader certification were not run.

## Current screenshots

- [Desktop homepage — 1440 px](desktop-homepage.png)
- [Mobile homepage — 390 px](mobile-homepage-390.png)
- [Desktop staff dashboard — 1440 px](desktop-staff-dashboard.png)
- [Mobile staff dashboard — 390 px](mobile-staff-dashboard-390.png)
- [Mobile schedule details — 390 px](mobile-schedule-details-390.png)

[capture-metadata.json](capture-metadata.json) records viewport/date, source baseline,
photo SHA-256, helper font sizes and accessibility outcomes. These captures contain only
synthetic booking references/amounts and the supplied, visibly unverified club contact.

## Files and remaining limitations

Presentation: `app/globals.css`, public page, court selector, shared brand and staff
schedule. Fixtures: `lib/demo/club.js`, `lib/demo/dashboard.js`. Photography:
`public/images/pickleball-community.jpg` replaces `club-placeholder.jpg`. Verification:
unit/browser files, `scripts/capture-phase-1-1.mjs`, this QA folder. Documentation:
AGENTS, root/docs READMEs, asset provenance and Phase 1.1 record.

The official logo and actual facility photos are missing. The Commons creator/license
are documented in the source distribution; direct Commons access is blocked here.
Owner approval of contact/location/hours remains outstanding. Dates, reservations,
availability and all analytics remain synthetic. Staff demo has no authentication or
privileged operations; no real contact collection, booking or payment works. Phase 3B
was not started. Keep the current published demo stable until separate review/publication
and deployment approval.
