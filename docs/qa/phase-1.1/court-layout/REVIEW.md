# Court orientation correction — 2026-11-02

**Historical, visually rejected geometry.** Superseded by the
[court map precision correction](../court-precision/REVIEW.md); its former left-edge
alignment and independent landscape sizing are no longer acceptance criteria.

Branch: `phase-1-1-visual-qa`; parent `06134a67f67c6ba4d174ba1e982b5c4a219ef4ad`.
This additive visual correction supersedes the court geometry in the earlier Phase 1.1
captures. The user-supplied sketch and previously documented row/column positions are
its reference. No separate original uploaded sketch asset was found in this checkout.

## Geometry and scope

- Courts 3/4/5 remain upper left/center/right, now portrait (5:11).
- Court 2 stays below Court 5, with Court 1 below Court 2. Both are landscape (11:5),
  extending toward the right from the same starting column. A fourth empty map track
  accommodates their width without moving IDs or overflowing the map.
- Portrait courts have horizontal net and kitchen boundaries, with a split vertical
  service centerline. Landscape courts rotate all three markings to the corresponding
  vertical net/kitchen boundaries and horizontal service centerline.
- Added only presentation orientation/column-span metadata to the existing synthetic
  court records; original IDs, row/column positions, day/status fixtures and selection
  logic are preserved. List view remains unchanged and accessible.
- Responsive map width is capped at 480 px, with proportional rows rather than fixed
  equal row heights. At 390 px, upper courts are 75 × 165 px and lower courts are
  158 × 71.8 px. At 1440 px, they are 109.5 × 240.9 and 233 × 105.9 px respectively.
- No database identity, booking logic, Auth, payment or Phase 3 code changed. The site
  still collects no customer data and creates no reservations. Dimensions are illustrative,
  not a surveyed floor plan, compass direction or claim about site measurements.

## Actual checks

Local production build, Node 24.19 / npm 11.9 and system Chromium. Ignored backend
configuration was temporarily moved outside the project for build/browser/capture checks
and then restored privately. No Supabase credentials or real customer data were used.

| Command / evidence | Result |
| --- | --- |
| `npm run lint` | Passed. |
| `npm run test` | **17 passed**; existing unit coverage unchanged. |
| `npm run build` | Passed; public and synthetic staff routes remain static. |
| `TEST_PORT=3100 PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e` | **28 passed**: original 21 plus 5 geometry/selection and 2 keyboard/accessibility regressions. |
| Geometry viewports | 320, 390, 768, 1024 and 1440 px. All five buttons contained, correct relative positions/aspect ratios, no clipped status labels/page overflow, targets >=44 px. |
| Marking/selection coverage | Rendered net/service-line bounding boxes rotate correctly. Every court selects its matching session panel; synthetic open-play restrictions, alternate List view and preview-only receipt persist. |
| Keyboard / axe | DOM order 3→4→5→2→1; Space selection and matching details at 390/1440 px. Both scoped WCAG 2.2 axe scans have zero violations. |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium node scripts/capture-court-layout.mjs` | Desktop/390 px screenshots saved; zero scoped axe violations and geometry metadata recorded. Start the local production build on 3120 first. |
| Credential-pattern checks and `git diff --check` | Passed, source/untracked and staged text checked. Pattern scanning is not proof of every possible secret format. |

The geometry regression uses document coordinates, keeping assertions valid as Playwright
scrolls to click each court. Existing full-page, schedule/filter, navigation, synthetic
collections, contact warnings and accessibility tests remain green. Patterned map surfaces
still produce manual color-contrast review entries in axe; prior reviewed color pairs are
unchanged, and incomplete rule counts remain visible in the capture metadata. No complete
cross-browser or manual assistive-technology conformance claim is made.

## Screenshots and review limits

- [Desktop court selector](desktop-court-selector.png)
- [390 px mobile court selector](mobile-court-selector-390.png)
- [Capture metadata](capture-metadata.json)

Earlier screenshots are preserved for history. The approved official logo is still missing;
contact/location remains owner-unverified and hours provisional. All availability,
reservations and analytics remain synthetic. Existing photo attribution is unchanged.

The user authorizes publication of this correction branch and its automatic Vercel Preview
only. `owner-demo` (also the repository default branch), work and Phase 2/3 branch tips
must remain unchanged. No merge, production deployment or Vercel settings change occurs.
Hosted build/content/protection must be reported as unverified if cloud access is blocked;
local screenshots are not evidence of hosted QA. Publication/Preview status is reported
in the final review response against the correction's exact Git SHA.
