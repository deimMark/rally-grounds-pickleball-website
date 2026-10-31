# Demo asset provenance

No existing Rally Grounds logo was found. The site uses the club name as plain text;
no replacement logo has been designed. The decorative court illustration is original
CSS presentation artwork and is explicitly labeled as a design concept.

## Replaceable stock photograph

- Local file: `public/images/club-placeholder.jpg` (1280 × 853 pixels, HD).
- Title: **Man looking out to sea**; photographer: **Karolina Grabowska**.
- Original source: https://kaboompics.com/photo/5269/man-looking-out-to-sea
- License: Kaboompics free photo license, https://kaboompics.com/page/license-and-faq
  (commercial/noncommercial website use; do not resell or redistribute as stock).
- Retrieved from Tabler's existing photo distribution at commit
  `096491dea4886f78891c2e29310351d5aee6c460`:
  `shared/static/photos/man-looking-out-to-sea.jpg`.
- Upstream provenance (author, source, original resolution):
  https://github.com/tabler/tabler/blob/096491dea4886f78891c2e29310351d5aee6c460/shared/data/photos.json
- The photo is a stock coastal scene from Bulgaria. It depicts neither the Rally Grounds
  facilities nor La Union. The image alt text and visible caption state its stock status.
- Phase 1 renders the asset locally without calls to a stock-photo provider. Change
  `club.media` in `lib/demo/club.js` and the attribution here when replacing it with
  approved club imagery. Future media management belongs behind owner authorization.
- Photograph copyright remains with its creator; the upstream UI software's MIT license
  is not a replacement for the photograph's license. Obtain the club's approved media
  before public launch and preserve current license/source records.

## Fonts and icons

- DM Sans: Fontsource package `@fontsource/dm-sans`, SIL Open Font License 1.1.
- Barlow Condensed: Fontsource package `@fontsource/barlow-condensed`, SIL Open Font
  License 1.1. License files ship in the installed packages.
- Lucide React icons: ISC license; license ships in `lucide-react`.

Fonts are self-hosted through the installed packages. Icons are decorative where nearby
text supplies the accessible name. Gold is used with navy or midnight text/background;
small text on ivory uses darker colors for contrast.
