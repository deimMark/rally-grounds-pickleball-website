# Demo asset provenance

No existing Rally Grounds logo was found. The site uses the club name as plain text;
no replacement logo has been designed. The decorative court illustration is original
CSS presentation artwork and is explicitly labeled as a design concept.

## Replaceable community photograph — Phase 1.1

- Local file: `public/images/pickleball-community.jpg`, 1600 × 1066 JPEG (HD).
- Work: **“Pickleball Players”**; creator: **TheVillagesFL**.
- Original file/source: https://commons.wikimedia.org/wiki/File:Pickleball_Players.jpg
- License: **Creative Commons Attribution-ShareAlike 4.0 International**,
  https://creativecommons.org/licenses/by-sa/4.0/ . Commercial reuse is allowed subject
  to attribution, license notice and ShareAlike for adapted photography. This does not
  assign the photograph's copyright to Rally Grounds or automatically license the
  entire application under CC BY-SA.
- Retrieved 2026-11-02 from the existing bundled Wikimedia photo distribution in
  `adaipule1989/pickleball-propasal`, commit
  `1d44f45bc04945f5d45078ab3354b448df8630b6`, file
  `assets/pickleball-community.jpg`:
  https://github.com/adaipule1989/pickleball-propasal/blob/1d44f45bc04945f5d45078ab3354b448df8630b6/assets/pickleball-community.jpg
- Source/license evidence: that revision's README “Source material and photography”
  and HTML footer explicitly identify the work, creator, Commons source and CC BY-SA 4.0.
  Direct Commons/provider access is blocked in this cloud; retrieval used the public
  GitHub distribution with its attribution preserved. No photograph-license claim is
  inferred from a software license or merely from a publicly accessible repository.
- The checked-in JPEG is copied unchanged. Next.js `Image` performs responsive
  optimization; CSS uses a cover crop for presentation. Any adapted rendition retains
  the same credit/license. It depicts an outdoor community doubles game, not an indoor
  Rally Grounds facility. Visible caption: “Illustrative stock photo · not Rally Grounds
  facilities”; creator/source and license links appear below it. No endorsement by the
  pictured players is claimed. Do not repurpose as an identifiable person testimonial.
- Photo credit/licensing/alt/path are configured in `lib/demo/club.js`; no remote photo
  request is needed at runtime. Next.js serves its local optimized image endpoint.
- SHA-256 for the bundled original is recorded in the Phase 1.1 QA metadata.
- The previous coastal photograph has been removed from `public/`. Historical Phase 1
  screenshots remain unmodified and retain their original dated context. Its former
  Kaboompics provenance is available in Git history at the owner-demo baseline.

## Fonts and icons

- DM Sans: Fontsource package `@fontsource/dm-sans`, SIL Open Font License 1.1.
- Barlow Condensed: Fontsource package `@fontsource/barlow-condensed`, SIL Open Font
  License 1.1. License files ship in the installed packages.
- Lucide React icons: ISC license; license ships in `lucide-react`.

Fonts are self-hosted through the installed packages. Icons are decorative where nearby
text supplies the accessible name. Gold is used with navy or midnight text/background;
small text on ivory uses darker colors for contrast.
