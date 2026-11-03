# Phase 1.1 — visual QA corrections

Implemented locally on `phase-1-1-visual-qa`, branched from `owner-demo` at
`1a9b04c262759ce62bf72573a86e3924c6809c48`. The approved Modern Clubhouse / Athletic
Blue direction, fonts, hero court illustration, court layout and mock-only application
boundaries are preserved. No Phase 2/3 code is merged and no deployment is performed.

| Finding before | Correction |
| --- | --- |
| Mobile schedule status column required horizontal scrolling | Up to 760 CSS px, semantic booking cards display court, reference, time, session type and booking status. Desktop keeps a wrapping table. Both render from the same filtered data; the hidden representation is also hidden from keyboard/accessibility navigation. |
| “Net collected” label; manually formatted synthetic totals | Renamed to **Net collections**, calculated from integer centavos: verified 120,000 − completed refunds 30,000 = 90,000 (PHP 900). Unverified 60,000 is excluded. Every metric retains DEMO FIGURE. The repository did not contain the reported “Not collected” string. |
| Unrelated coastal photograph | Local HD community doubles pickleball photo replaces it, via documented Wikimedia distribution, with creator/source/license links and explicit illustrative/not-facility caption. Next.js Image retains responsive optimization. |
| Informative helpers at 6–11 px | Minimum 12 px across helpers, status, reference, notices and attribution. Headings and display font direction remain intact. Enlarged mobile hero space prevents lettering/helper overlap. |
| Cool supporting surfaces / inconsistent gold decoration | Named warm surface tokens; existing navy/blue/ivory palette; champagne-gold decorative accents; Lucide asterisk replaces text/emoji glyph. Darker semantic status colors remain for readable contrast. |
| Unverified north arrow | Removed from court map. Court positions and interactions unchanged. |
| Missing detailed contact presentation | Supplied name/address/phone are data-driven, visibly labeled draft/owner confirmation pending, with a plain-language unverified warning. No telephone/map/messaging link or LocalBusiness structured data implies verification. Hours stay provisional. |
| Official logo unavailable | Workspace/repository asset search found no supplied approved logo. Shared text wordmark stays; no invented official mark or black-square image. |

## Verification

See [QA report and all five screenshots](qa/phase-1.1/REVIEW.md). Actual checks include
lint, 17 units, 21 browser tests, production build, credential-pattern scans and fresh
local desktop/mobile captures with axe scans and explicit text contrast calculations.

Run the capture helper after building and starting a local production server on 3101:

```sh
npm run build
npm run start -- --port 3101
# In a second terminal:
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium node scripts/capture-phase-1-1.mjs
```

The helper targets loopback only. Historical Phase 1 screenshots remain intact. New
captures use only synthetic schedule/financial data and the explicitly supplied draft
club contact, never customer information or credentials.

## Remaining gates

Official logo and actual facility media are still missing. Follow [asset provenance](ASSETS.md)
when replacing photography; preserve its credit and CC BY-SA license. The creator/license
are documented by the public source distribution; direct Commons access is blocked in
this cloud. Actual address/contact and operating hours require owner confirmation.
Cross-browser/manual assistive-technology review remains useful; automated accessibility
scans and contrast calculations do not establish a complete WCAG conformance audit.

All reservations, dates, availability and analytics remain synthetic. `/staff` is a public,
read-only demo, not real staff access. No contact collection, payments, booking mutations,
Supabase connection, push, merge or deployment is part of this checkpoint. `owner-demo`
and all Phase 3 branches remain unchanged. Any publication/deployment requires approval.

## Subsequent court orientation correction

The original captures above retained the correct court positions but incorrect equal
orientations. The [court correction QA](qa/phase-1.1/court-layout/REVIEW.md) and its
new desktop/390 px screenshots supersede that geometry: Courts 3/4/5 portrait, Courts
2/1 landscape below Court 5, correctly rotated markings. This correction is authorized
for publication on the visual QA branch only; owner-demo is not merged or modified.

## Precision review supersedes the first orientation correction

The first orientation correction passed its tests but failed human visual QA. Use the
[precision correction record](qa/phase-1.1/court-precision/REVIEW.md) and screenshots
for the current proposal: one 20×44 court geometry, swapped landscape dimensions,
uniform proportional spacing and lower courts right-aligned to Court 5. Both former
left-alignment assertions were replaced. Human visual approval remains required.
