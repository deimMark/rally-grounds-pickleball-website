# Phase 3D.1 final functional, visual, accessibility and privacy review

> **Recovery note (2026-11-04).** This review was written in the original, unpublished
> implementation environment. The commit SHAs, file counts, `/tmp` log paths and backend
> branch references below belong to that environment and do not exist in this repository.
> The reviewed code was recovered here as a verified patch on owner-demo `6146af8` and
> independently re-verified; current results, the browser-test timing correction and the
> regenerated screenshots are recorded in [REVIEW.md](REVIEW.md). The findings and privacy
> analysis below still describe the recovered code. Publication is **not** authorized by
> this document; only a local commit is, and GitHub publication needs separate approval.

Date: 2026-11-03 (original environment). Reviewed source there: `02e1573` (unavailable here).
Branch: `phase-3d1-booking-interface`. Required owner-demo base verified exactly:
`6146af81c6cdf6a501260b39dbc9ebfe6d0a64af`. All changed files in that environment were
inspected. This review adds tests/evidence only; no product feature, booking backend,
worker-security branch, owner-demo or deployment settings are changed.

## Decision and publication gate

**Local interface QA passed; no critical/high defect reproduced in this scope.** This
is a fresh adversarial pass by the implementing assistant, not third-party certification
or approval of live guest booking. The independent backend H2 blocker remains unresolved
and is not imported, tested, modified or approved by this interface review.

**Publication is held. No push/deployment performed.** The exact branch has an explicit
`false` value under `git.deploymentEnabled` in vercel.json, valid JSON; CI contains no
deployment command. Remote Vercel schema/project verification was unavailable. GitHub
repository/check-run API reads returned `Forbidden`, including a retry outside the shell
sandbox. A read-only Git remote lookup succeeded and returned no existing branch ref;
it does not verify Vercel integration or GitHub Actions. Do not conflate successful Git
transport or the local flag with a queried provider/deployment result. Under the user's
strict gate, remote deployment prevention remains unverified and the branch is not pushed.
No CI URL/result exists for new unpublished review evidence. Restore verification access
before considering publication; do not enable deployment to work around it.

## Findings and severity

No critical/high finding was identified in the synthetic interface. No live authorization,
financial or database claims are inferred from passing UI tests.

| Finding | Assessment |
| --- | --- |
| Fixed fixture identities/timestamps and selectable held/expired/cancelled states | Expected demo limitation. Refresh resets the scenario to held; this is visibly a public design preview, not persisted reservation state. Replace with protected server state before integration. |
| Shared synthetic intent/quote/reference UUIDs across selections | Expected fixture limitation; not capabilities or unique bookings. Real responses must supply unique, correctly bound identifiers. |
| No capability cookies, idempotency, real contact validation, conflicts or API error handling | Integration gap, explicitly outside this branch. Do not connect these screens directly to live endpoints without a separate reviewed adapter. |
| Deployment/provider verification unavailable | Publication blocker, not a demonstrated application exploit. No hosted QA/CI success claimed. |
| Missing official logo and unverified club information | Existing owner-review dependency; text brand retained, address/contact/hours remain qualified. |

No production/private customer data is present. Guest names/emails come from two fixed
fictional profiles, with example.invalid addresses; identity fields are read-only. The
request path never serializes those fields. Dates/player counts/court/time selections are
public fixture choices. No free-text contact collection, upload, real authentication,
booking operation, payment/GCash verification or worker scheduling is implemented.

## Functional and visual evidence

The approved shared CourtMap was inspected alongside the original precision tests and
screenshots. Across 320, 390, 768, 1024 and 1440 CSS pixels, the new regression verifies:
matching top widths/heights/top edges and equal gaps; landscape dimensions swapped from
portrait; matching lower-court dimensions/left edges; Court 5/2/1 right-edge alignment;
and unchanged geometry on selection, with one CSS pixel tolerance and no page overflow.
Court 3/4/5 portrait and 2/1 landscape markings use one rotated SVG geometry. List view,
status text, keyboard controls and the existing homepage/staff regressions remain intact.

Screens reviewed against the specification, not just ratios: navy/blue typography, ivory
and warm panels, champagne-gold accents, labels, disabled choices, focus indication and
mobile wrapping. No clipped court, reference or status field was observed. Every result
has a demo badge, sample status/reference/price labels and explicit no-reservation/no-
payment copy. A check/lock icon is accompanied by the disclaimer and does not establish
actual confirmation or private authorization. No official logo or facility photo invented.

- [Desktop booking](booking-desktop.png)
- [390px booking/map](booking-mobile-390.png)
- [390px synthetic details](details-mobile-390.png)
- [390px confirmation](confirmation-mobile-390.png)
- [Desktop status](status-desktop.png)
- [390px status](status-mobile-390.png)
- [New: 390px expired scenario](review-expired-mobile-390.png)
- [New: 390px reference-only unavailable access](review-unavailable-mobile-390.png)

The six new browser cases cover direct valid links, refresh, back/forward navigation,
no permanently busy form, price/paid/status query tampering, read-only contact behavior,
request/console/storage privacy, invalid/repeated/unavailable selections, reference-only
access refusal, complete geometry, visible keyboard focus and desktop error/result axe
checks. All 40 previous cases remain enabled. Automated WCAG 2.2-tagged checks assert
zero serious/critical violations, supplemented by manual screenshot/focus/touch-target
inspection; this is not a claim of exhaustive assistive-technology certification.

One initial added geometry assertion compared viewport coordinates before/after a click
which legitimately scrolled a court into view. It now compares document coordinates,
including scroll offsets, retaining the same one-pixel tolerance. No product change or
assertion relaxation was needed. No failed security/functional check was excluded.

## Privacy, data contracts and code boundaries

Instrumented production-build journey: choose the Jamie synthetic profile, generate a
preview, view expiry and then reference-only unavailable access. Server stdout/stderr,
client console and outgoing URL/body values were inspected in memory for synthetic
contact markers. Zero contact matches, zero API/Supabase/GCash requests, zero non-GET/HEAD
requests, zero cookies and no local/session storage writes. Browser regression additionally
checks IndexedDB and CacheStorage remain empty. No private values are pasted into evidence.
Result/status responses are no-store/no-referrer and emit no permissive CORS. These headers
are privacy measures, not authentication. Deep links contain only public selections;
reference/name/email alone does not trigger a lookup or authorize access.

Source scope: no app/api routes or migrations tracked on this branch; optional original
Supabase connection factory remains uncalled and unchanged. No worker/admin clients,
SECURITY DEFINER code, production credentials, payment handlers or scheduler code added.
No backend branch commit is an ancestor (re-checked on recovery: the branch is owner-demo
plus this work only). Protected backend branches remain unchanged.

Compared read-only with docs/PHASE-3B-CONTRACTS.md on the backend reference branch:
quote field names, UTC starts/ends from Asia/Manila, integer centavo totals, structured
contact kind/value, immutable receipt versus separate current status are compatible
presentation shapes. They are **not an integrated API implementation**. Remaining gaps:
canonical court IDs and policy versions from public API; new intent and HttpOnly cookie;
server quotes/validity; stable intent-scoped Idempotency-Key; approved contact fields/
normalization; server totals/deadlines; lost-response replay, stale quote/conflict/429/503
states; protected status fetch with capability binding and agreedTerms; access recovery.
The UI does not consume agreedTerms or a server admission envelope. It recomputes fixtures
and uses the same sample identifiers; never reuse that mechanism as live authority.

## Exact validation (original environment; see REVIEW.md for recovered-code results)

| Check | Pass | Fail | Skip |
| --- | ---: | ---: | ---: |
| Unit tests (3 files) | 27 | 0 | 0 |
| Chromium browser tests | 46 | 0 | 0 |

Final browser run: 55.6 seconds. ESLint passed with zero errors. Production build passed;
routes remain `/`, `/staff`, `/book`, `/booking/confirmation`, `/booking/status` plus
not-found. No database test or operation was necessary or run for this UI review.

Credential-pattern scans: **77 source text files and 18 browser JS/map artifacts, zero
matches** for private-key blocks, recognizable GitHub/private Supabase/JWT credentials
and credential-bearing PostgreSQL URIs. Ignored private bindings were not read. These
are scoped format scans, not universal detection of every secret encoding. The synthetic
emails intentionally exist in UI bundles as public fixtures, not real contacts.

The original environment kept temporary command logs and a privacy-probe result; they
were ephemeral and are not part of this repository. Screenshots were regenerated from
the recovered code and contain only public synthetic data (see REVIEW.md). Review-only
files may be committed locally after checks; no hosted/public booking, merge or
deployment approval is implied.

## Next action

Review the local evidence and compatibility gaps. Restore GitHub API and Vercel
verification access, recheck the exact branch deployment-disable flag/provider behavior,
then reconsider the gated publication of only this branch. GitHub Actions must be checked
against the eventual published commit, not assumed green from local results. Do not
modify owner-demo or worker-security branches, merge, activate public booking or deploy.
