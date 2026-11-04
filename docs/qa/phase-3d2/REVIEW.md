# Phase 3D.2 booking UX and accessibility — local QA

Branch: `phase-3d2-booking-ux` (local only, not published).
Base: Phase 3D.1 `0172b32d24f3a4f1fddb5e3e66ffe7620eb93265` on owner-demo `6146af8`.
Date: 2026-11-04. Environment: Linux cloud container, Node 24.19.0 (`.nvmrc`), pinned
Playwright Chromium, production build served by `next start`.

## Result

**PASS (local acceptance).** All checks below passed; no critical or high findings.
Publication, merge and deployment are not approved by this document.

| Check | Result |
| --- | --- |
| ESLint | Passed, 0 errors |
| Vitest | **33 passed**, 0 failed, 0 skipped; 3 files (27 existing + 6 new) |
| Playwright (Chromium) | **62 passed**, 0 failed, 0 skipped (46 existing + 16 new); full suite repeated 3 further times: 62/62, 62/62, 62/62 |
| Keyboard-journey test stability | 10/10 on `--repeat-each 10` after the correction noted below |
| Next.js production build | Passed; routes `/`, `/_not-found`, `/book`, `/booking/confirmation`, `/booking/status`, `/staff` |
| Credential scan (changed text files) | 0 matches (private keys, JWT-shaped tokens, Supabase/service-role, DB URIs with credentials, GitHub/AWS/Stripe key formats, `password=`) |
| Client bundle scan (`.next/static`) | 0 matches for `service_role`, `SUPABASE_*`, `NEXT_PUBLIC_*`, JWT, private key or DB URI patterns; only the synthetic `example.invalid` fixtures appear (3 chunks) |
| `process.env` in browser code | None in `app/`, `components/`, `lib/demo`, `lib/domain` |
| fetch/axios/Supabase/storage/cookie/`/api/` in booking code | None |
| Tracked `.env*` | Only `.env.example` |
| Mobile layout 320/360/390/768/1440 px | No horizontal overflow on `/book`, confirmation, status and both unavailable states; every slot button ≥ 44 px tall; grouped slots render at all widths (new test, 5 widths) |
| Keyboard-only booking flow (390 px) | Tab-only from page top → duration → Court 4 → 9:00 AM → Review → details heading focused → submit without consent → error, focus on checkbox → Space → submit → confirmation → status; a visible outline was asserted at every stop |
| Accessible error/focus | One `role="alert"` inside `main`, `aria-invalid="true"`, `aria-describedby="consent-error"`, focus moved, live status region empty (announced once); error clears when consent is ticked |
| Automated accessibility (axe, WCAG 2.0/2.1/2.2 A+AA tags) | Zero serious/critical violations on every booking route, on the consent-error state, on the keyboard-journey end state and on all 10 screenshots |
| Court geometry | Existing 320–1440 px geometry tests unchanged and passing on `/` and `/book`; shared `CourtMap` geometry code untouched |
| owner-demo / phase-3d1-booking-interface | Unchanged, local and remote (`6146af8` / `0172b32`) |

## Corrections made during QA (tests only, nothing relaxed)

- The first keyboard-journey draft used `locator.focus()` for its first stop; Chromium does
  not apply `:focus-visible` deterministically to programmatic focus before any keyboard
  interaction, which failed 1 in ~6 runs. The test now reaches the first control with Tab,
  which is also the honest "keyboard-only" method. 10/10 afterwards.
- Alert queries are scoped to `main` because Next.js renders its own empty
  `role="alert"` route announcer.
- Two draft assertions had fixture mistakes (no 8:00 AM sample on Court 3 for 8 Nov; a
  disabled button keeps `tabIndex` 0) and were corrected to test the intended property.
- One product nit found by the new tests was fixed: a stale "start time cleared" notice
  lingered after a later input change with nothing selected; it now clears.

## Screenshots (synthetic data only)

Captured by `scripts/capture-phase-3d2.mjs` against the production build at 1440 px desktop
and 390 px mobile, full document height, after fonts loaded; each capture also ran axe and
an overflow check (see `capture-metadata.json`).

- [Desktop booking, 2-hour session, grouped slots with reasons](booking-desktop.png)
- [390 px grouped slots with a chosen start and the compact summary bar](booking-grouped-slots-mobile-390.png)
- [390 px list view with per-court counts](booking-list-view-mobile-390.png)
- [390 px "start time cleared" announcement](reset-notice-mobile-390.png)
- [390 px consent error with focus on the checkbox](consent-error-mobile-390.png)
- [390 px details step](details-mobile-390.png)
- [390 px confirmation with "is / is not" block and Manila times](confirmation-mobile-390.png)
- [Desktop private-status design preview](status-desktop.png)
- [390 px expired scenario, receipt deadline unchanged](status-expired-mobile-390.png)
- [390 px reference-less unavailable access](status-unavailable-mobile-390.png)

## Known limitations

- Three fixed sample days, three durations and fixed player options remain; prices, hours
  and availability are presentation fixtures, not owner-approved policy.
- The compact mobile bar duplicates the full summary for sighted users; screen-reader users
  encounter it once as a named region at the end of the page.
- Date-part order in Manila timestamps ("Nov 3, 2026" vs "3 Nov 2026") depends on the
  runtime's ICU data; the wall-clock time is asserted, the order is not.
- The remote Vercel project's handling of `vercel.json` exclusions and GitHub Actions on the
  eventual published commit are not verifiable from this environment and remain for the
  publication review. Automated axe checks are not an exhaustive assistive-technology audit.
- Credential scans are pattern-based and do not read ignored secret files.
