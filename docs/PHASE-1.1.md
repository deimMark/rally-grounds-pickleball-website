# Phase 1.1 visual corrections — proposed, not implemented

Phase 1 QA is provisionally approved. These are small presentation corrections to
complete before the next owner walkthrough. They do not authorize Phase 2, live
booking, external resources, a push or a deployment. Preserve the existing design and
use the approved official artwork; do not create a new club logo.

| Correction | Planned change | Acceptance check |
| --- | --- | --- |
| Official logo integration | After the owner supplies the approved SVG or transparent PNG, inspect/sanitize it, retain its provenance, place it in `public/branding/`, register path/alt/dimensions in the presentation configuration and pass it to the shared `Brand` component. Use supplied dark/light variants only. No upload interface or Storage bucket is required. | Correct official artwork in public header/footer and staff shell at 390/1440 widths; preserved aspect ratio, accessible home link, no clipping, no external asset calls. Missing asset remains an explicit blocker to this item only. |
| Gold icon consistency | Replace the platform-dependent hero star emoji with a deterministic decorative SVG/CSS shape. Use champagne gold `#D7AD6B` for decorative gold accents. Review darker `#9B702E` punctuation separately; retain an accessible darker tone where actual text contrast requires it. | Hero decoration stays gold on Chromium, Firefox and Safari; decorative icons are hidden from assistive technology; labels/controls retain AA contrast. No new logo or unsupported brand variant. |
| Warm neutral surfaces | Consolidate repeated supporting surface values into a small set of named surface/semantic tokens. Replace or explicitly approve cool dashboard `#F3F5F7` and community `#EEEEE8` backgrounds against warm ivory `#F8F5ED`. Retain labeled semantic status distinctions. | Public/staff screenshots share the approved warm surface treatment; borders, focus and status labels remain distinguishable, with no color-only state communication. |
| Helper text readability | Increase informative helper/status/attribution text from current 8–10 px sizing; target at least 12 px for meaningful helper text. Reserve smaller display microcopy for nonessential decorative text only. | Readable at 390 px and 200% zoom without clipping; no page overflow at 360/390/768/1440; keyboard focus, dropdowns and preview remain usable. |

After an authorized styling update, run lint, units, production build and the affected
browser/accessibility checks. Refresh all five QA screenshots and document changed
visuals; do not overwrite the existing Phase 1 checkpoint captures without preserving
which revision they describe. Cross-browser checks need the relevant browser runtimes;
report any unavailable checks explicitly.

The official logo can be attached in chat or uploaded through the cloud workspace.
No VS Code/local checkout is required. Logo integration is still pending the asset and
separate authorization to make these visual changes.
