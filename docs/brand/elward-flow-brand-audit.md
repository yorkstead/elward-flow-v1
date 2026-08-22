# Elward Flow Brand Audit

Verified against the public Elward Systems website on 2026-08-22. This audit
separates values observed in Elward-owned public assets from application-specific
choices made for Elward Flow.

## Authentic Elward evidence

### Color system

| Role observed on `elward.com` | HEX       | RGB             | Evidence                                                     |
| ----------------------------- | --------- | --------------- | ------------------------------------------------------------ |
| Corporate logo blue           | `#0063A6` | `0, 99, 166`    | Dominant opaque pixel value in the current corporate PNG     |
| Corporate logo orange         | `#E0653B` | `224, 101, 59`  | Secondary opaque pixel value in the current corporate PNG    |
| Deep architectural navy       | `#1B334F` | `27, 51, 79`    | Repeated site section, footer, heading, and decorative color |
| Site action orange            | `#F2673A` | `242, 103, 58`  | Repeated CTA, outline, carousel, and decorative color        |
| Supporting interface blue     | `#0865C1` | `8, 101, 193`   | Link and interactive supporting color in the site stylesheet |
| Secondary blue                | `#3A4970` | `58, 73, 112`   | Supporting text and section color in the site stylesheet     |
| Cool gray                     | `#BCBCCA` | `188, 188, 202` | Repeated secondary border and control color                  |
| Light surface                 | `#F5F5F7` | `245, 245, 247` | Repeated light section background                            |
| White                         | `#FFFFFF` | `255, 255, 255` | Header, content surface, and reversed text color             |

The logo colors and site interface orange are intentionally recorded separately:
the current logo artwork uses `#E0653B`, while the current site stylesheet uses
`#F2673A` for interactive and decorative accents.

### Logo variants

- **Current corporate horizontal logo:** the transparent blue/orange
  `Elward_Logo2023RGB.png` used in the website header. A byte-identical local copy
  is stored at `public/brand/elward-logo-primary.png` with SHA-256
  `450EBD7115F8D8B4C5CEDD46AB7AFD195AD72BEF4C41F7715FA62455C1E1D9BB`.
  Use it on white or very light surfaces with its native 1467:306 aspect ratio.
- **White footer artwork:** the public footer contains a one-color mark embedded
  inside an HTML SVG symbol. No standalone, approved source file was located, so
  it is not copied into the application.
- **EVOLV white lockups:** the website exposes white EVOLV product-family artwork.
  These identify the rainscreen product family, not the Elward Flow application,
  and are not used as the application logo.

The verified corporate logo is placed on a light logo plate when used inside the
dark operational shell. This preserves the approved colors without inventing a
reversed corporate lockup.

### Typography

- The public site uses self-hosted **Open Sans** for body copy.
- Headings and navigation use a self-hosted **DINWeb Medium** face with uppercase
  labels and expanded tracking.
- A reusable DIN font license and original font package were not verified for this
  repository. Elward Flow therefore uses self-hosted-at-build Open Sans through
  `next/font` and the open-source Roboto Condensed as a DIN-like operational
  heading alternative. Roboto Condensed is an Elward Flow choice, not an official
  Elward brand font.

### Visual tone

The marketing site is bright, image-led, architectural, and spacious. It combines
large project photography with sharp navy sections, orange outlines, uppercase
headings, thin rules, limited corner rounding, and repeated façade geometry.

## Elward Flow product interpretation

Elward Flow is a dense operational interface rather than a marketing site. It
uses the authentic blue, navy, orange, typography cues, and corporate logo while
making the following product-specific choices:

- Dark navy application chrome with light, high-contrast work surfaces.
- Corporate blue for primary actions; the public-site orange is reserved for
  focus, attention, active details, and branded accents because white text on the
  orange does not consistently meet WCAG AA for ordinary text.
- Compact spacing, restrained radii, thin industrial borders, tabular data, and
  subtle panel-grid texture rather than large project photography.
- Green, amber, red, and blue operational states remain semantically distinct and
  always retain text or icon labels. Brand colors never replace QC disposition,
  warning, hold, obsolete-revision, or permitted-action semantics.
- The `EF` application icon is an Elward Flow product identifier, not a redraw or
  substitute for the official corporate logo.

## Unverified or unavailable source material

- Original vector master artwork for the current corporate logo.
- An approved standalone white/reversed corporate Elward lockup.
- Official clear-space and minimum-size specifications.
- An Elward-owned favicon or mobile application icon.
- A repository-licensed DINWeb font package.
- A formal current brand standards manual defining color tolerances or print
  conversions.

These gaps should be replaced with official source artwork and guidance if Elward
provides them. The application must not derive, recolor, trace, or redraw missing
corporate variants in the meantime.
