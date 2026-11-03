# Court map precision correction — 2026-11-03

Branch `phase-1-1-visual-qa`, based on
`3af99b79efe7435fccc16e0881918f4e14b2bed5`.
**Human visual approval is required.** Previous orientation tests passed while the
floor plan still failed visual review. Those tests and captures are not acceptance
proof for this correction.

## Root cause and corrected reference

The previous four-track grid gave landscape courts an independent column-span width;
that width did not equal portrait height. Its regression incorrectly required the lower
courts' left edge to align with Court 5's left edge, extending them too far right.

The current reference is the user's explicit Rally Grounds floor-plan specification:
three identical portrait courts, followed by two identical landscape courts extending
leftward under Court 4, with their right edges aligned with Court 5. No separate original
uploaded sketch image exists in this checkout; no claim is made to have inspected one.

## One dimension and coordinate system

`demoClub.courtMap` supplies W=20, H=44, gap=4. The canvas is derived as
`3W + 2gap` by `H + 2(W + gap)`, or 68 × 92 units.

| Court | X | Y | Width | Height |
| --- | --- | --- | --- | --- |
| 3 | 0 | 0 | W | H |
| 4 | W + gap | 0 | W | H |
| 5 | 2(W + gap) | 0 | W | H |
| 2 | canvas width − H | H + gap | H | W |
| 1 | canvas width − H | H + W + 2gap | H | W |

CSS uses that one proportional grid at all viewports, capped at 440 CSS px. There are
no breakpoint-specific court dimensions or gaps. The remaining mobile padding and
annotation typography do not change relative court geometry. Existing IDs, logical
row/column identity and availability fixtures remain unchanged; no database logic changed.

One SVG geometry draws boundaries, kitchen lines, net and service divisions from the
shared width/length. Landscape rotates the same group by 90 degrees within a swapped
viewBox. Numbers are centered, with opaque surface-matched backing; statuses sit below
them on their own solid backing. The selected gold box-shadow changes no box dimensions.

## Regression and validation evidence

All geometry comparisons use <=1 CSS px tolerance and document coordinates, including
measurements before and after every selection. The old left-edge assertion was removed
from both geometry and foundation browser suites and replaced with right-edge alignment.

- Courts 3/4/5: equal width/height, equal top edges, equal positive horizontal gaps.
- Courts 2/1: equal width/height, matching left/right edges and shared vertical gaps.
- Landscape width equals portrait height; landscape height equals portrait width.
- Lower right edges equal Court 5's right edge; lower courts extend left of Court 5.
- Selection of any court leaves all positions, sizes and gaps unchanged.
- SVG net rotates to the correct axis and remains centered; identical canonical paths
  are reused by every court. Numbers center in the tile and do not overlap statuses.
- All five courts remain contained, labeled and selectable at 320/390/768/1024/1440 px,
  without horizontal page overflow; each target is at least 44 px in both directions.
- Correct session panel, synthetic open-play restrictions, keyboard order/Space selection,
  List view and preview-only behavior remain covered. No reservation is created.

Commands/results are recorded after the final implementation:

| Check | Result |
| --- | --- |
| `npm run lint` | Passed. |
| `npm run test` | 17 passed, original units retained. |
| `npm run build` | Passed, public/staff demo routes static. |
| `TEST_PORT=3100 PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e` | 28 passed, including strengthened precision regressions across five widths and keyboard/axe at 390/1440. |
| Capture helper | Two current screenshots with scoped axe scans; zero violations. |
| Credential-pattern scans / staged scan / `git diff --check` | Passed. Scoped pattern checks are not proof of every possible secret format. |

Tests/build/capture use synthetic fixtures without Supabase variables or environment
files. Ignored local backend environment files are temporarily moved outside the project
then restored privately. Existing brand colors and photo attribution are unchanged.
Axe's patterned-background contrast review entries remain recorded in metadata; automated
checks and local screenshot review do not constitute a full WCAG conformance audit.

## Visual review and captures

- [Desktop selector, 1440 px](desktop-court-selector.png)
- [Mobile selector, 390 px](mobile-court-selector-390.png)
- [Measured geometry and accessibility metadata](capture-metadata.json)

Review the images against the table/sketch specification above: equal top courts and
gaps, identical rotated lower courts, aligned right boundary, centered numbers, separated
status labels and a stable selection ring. Human approval is pending; do not merge just
because automated tests pass. Prior captures are preserved as historical failed geometry.

Reproduce with a local production server on 3131, then:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium node scripts/capture-court-layout.mjs
```

## Publication limits

Only this correction branch is authorized to be committed/pushed. No merge into owner-demo,
production deployment, Vercel settings change, Supabase connection or Phase 3 changes.
Report Actions/Preview status against the final SHA in the review response. A Vercel
feedback check alone does not prove a successful hosted build. If the cloud proxy blocks
Preview access, hosted content/protection stays unverified.

Official logo and real facility media are still missing. Draft address/phone and
provisional hours still require owner confirmation. All booking/availability/analytics
remain synthetic; there is no real customer collection, live reservation or payment flow.
