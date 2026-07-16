---
name: Өрнүүн 48
description: A bright Ulaanbaatar apartment pantry organized as an unmistakable, product-first shelf.
colors:
  pantry-ink: "oklch(24% 0.025 48)"
  clear-ground: "oklch(98% 0.006 80)"
  clean-paper: "oklch(99% 0.004 80)"
  tomato: "oklch(55% 0.19 33)"
  tomato-deep: "oklch(45% 0.17 31)"
  butter: "oklch(88% 0.14 88)"
  leaf: "oklch(57% 0.13 135)"
  trust-navy: "oklch(31% 0.07 249)"
  birch: "oklch(70% 0.075 72)"
  birch-shadow: "oklch(57% 0.075 65)"
  shelf-line: "oklch(84% 0.035 76)"
  focus-blue: "oklch(54% 0.17 250)"
typography:
  display:
    fontFamily: "Arial, Noto Sans, system-ui, sans-serif"
    fontSize: "clamp(3rem, 7vw, 6rem)"
    fontWeight: 800
    lineHeight: 0.9
    letterSpacing: "-0.035em"
  body:
    fontFamily: "Arial, Noto Sans, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "Arial, Noto Sans, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "0.01em"
rounded:
  shelf: "0px"
  control: "8px"
  media: "10px"
  status: "999px"
spacing:
  xxs: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  section: "clamp(56px, 8vw, 112px)"
components:
  button-tomato:
    backgroundColor: "{colors.tomato}"
    textColor: "{colors.clean-paper}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "12px 18px"
    height: "48px"
  button-butter:
    backgroundColor: "{colors.butter}"
    textColor: "{colors.pantry-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "12px 18px"
    height: "48px"
  search-field:
    backgroundColor: "{colors.clean-paper}"
    textColor: "{colors.pantry-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
    height: "50px"
  availability:
    backgroundColor: "{colors.clean-paper}"
    textColor: "{colors.pantry-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.status}"
    padding: "7px 10px"
  shelf-bay:
    backgroundColor: "{colors.clean-paper}"
    textColor: "{colors.pantry-ink}"
    rounded: "{rounded.shelf}"
    padding: "16px"
---

# Design System: Өрнүүн 48

## 1. Overview

**Creative North Star: "The Apartment Pantry Shelf"**

Өрнүүн 48 is a bright, fictional Ulaanbaatar household Store organized with the physical clarity of a well-kept apartment pantry. Pale birch rails, numbered compartments, honest product photography, tomato-red purchase actions, butter-yellow signals, and warm navy trust surfaces make the Store recognizable before a shopper reads the wordmark. The shelf is a spatial grammar for grouping products and information, not a decorative texture pasted onto every screen.

This direction advances the founder-accepted **Pantry shelf** prototype on branch `prototype/issue-28-reference-store` at `2c4ba47`. Direction A remains the identity source; Direction C contributes compact row rhythm to Search and repeat-purchase views; Direction B may inform an occasional Collection story but never the application shell. The improvement is deliberate: move the page ground closer to neutral, let birch and photography carry warmth, loosen dense compartments, reduce literal timber framing outside merchandising, tighten the typographic spacing, and keep a conventional Search/Cart header visible.

The Store is product-first rather than set-design-first. On desktop the opening shelf may be theatrical; below it, merchandising breathes. On mobile the cabinet becomes a composed sequence of bays and compact product rows instead of a miniature desktop grid. Prices, availability, options, Cart, and Checkout remain immediate and familiar.

**Key Characteristics:**

- Pale birch structure concentrated in the Home hero and merchandising shelves.
- Near-neutral page ground with warmth supplied by wood and sunlit product photography.
- Tomato actions, butter signals, leaf availability, and navy trust information.
- Square shelf geometry paired with compact rounded controls.
- Large, tightly composed Mongolian display type without cramped letterforms.
- Restock-list density for Search; generous product imagery for discovery.

**The Shelf Concentration Rule.** Use the physical shelf metaphor strongly once, then echo it through rails, numbering, and alignment. Do not box every section in timber.

## 2. Colors

The palette feels like morning light in a small apartment kitchen: clean neutral walls, pale birch storage, one decisive tomato label, and a few purposeful household signals.

### Primary

- **Tomato** (`oklch(55% 0.19 33)`): Cart, Add to Cart, Checkout, selected purchase controls, and the `48` brand stamp.
- **Tomato Deep** (`oklch(45% 0.17 31)`): pressed state, high-contrast error text, and darker tonal support; never a second competing accent.

### Secondary

- **Butter** (`oklch(88% 0.14 88)`): free-delivery facts, selected merchandising moments, and secondary calls to action on Tomato or Navy.
- **Leaf** (`oklch(57% 0.13 135)`): fresh availability markers paired with explicit text.
- **Trust Navy** (`oklch(31% 0.07 249)`): payment, delivery, tracking, Store notices, and other confidence-bearing information.

### Neutral

- **Pantry Ink** (`oklch(24% 0.025 48)`): body text, prices, strong dividers, and conventional controls.
- **Clear Ground** (`oklch(98% 0.006 80)`): the page background. It is intentionally less cream than the prototype.
- **Clean Paper** (`oklch(99% 0.004 80)`): product bays, fields, and high-readability surfaces.
- **Pale Birch** (`oklch(70% 0.075 72)`): shelf beams and rails, never the entire page background.
- **Birch Shadow** (`oklch(57% 0.075 65)`): physical shelf depth and rail boundaries.
- **Shelf Line** (`oklch(84% 0.035 76)`): quiet separators inside white and birch regions.
- **Focus Blue** (`oklch(54% 0.17 250)`): accessible keyboard focus independent of brand state.

**The Warmth Has a Source Rule.** Warmth comes from birch, sunlight, tomato, and butter—not a beige wash over every surface.

**The Signal Discipline Rule.** Tomato means action, Butter means emphasis, Leaf means availability, and Navy means trust or consequential information. Do not swap these roles for novelty.

## 3. Typography

**Display Font:** Arial with Noto Sans and system sans fallbacks  
**Body Font:** Arial with Noto Sans and system sans fallbacks  
**Label Font:** Arial with Noto Sans and system sans fallbacks

**Character:** One sturdy sans-serif voice keeps household goods practical and friendly. Weight, scale, and compartment rhythm create identity; the Store does not need a decorative display face or a mono costume. The stack must render Mongolian Cyrillic and tabular commercial figures cleanly.

### Hierarchy

- **Display** (800, `clamp(3rem, 7vw, 6rem)`, 0.9): Home statement only; two or three balanced lines; letter spacing `-0.035em`, never the prototype's cramped `-0.08em`.
- **Headline** (750, `clamp(2rem, 4.5vw, 4rem)`, 0.98): Product and Collection titles.
- **Title** (700, `1rem–1.35rem`, 1.2): product names, Checkout groups, and operational decisions.
- **Body** (400, `1rem`, 1.6): product and policy copy, capped near `68ch` and usually shorter in purchase contexts.
- **Label** (700, `0.8125rem`, 1.3): controls, prices, stock text, shelf coordinates, and metadata; sentence case unless the text is a literal short shelf mark.

**The One Shelf Label Rule.** Numbering and compact uppercase marks belong to physical shelf coordinates. Do not place a tracked uppercase eyebrow above every heading.

**The Price Rhythm Rule.** MNT amounts use tabular figures, remain on one line, and carry stronger weight than adjacent status metadata.

## 4. Elevation

Өрнүүн 48 uses a hybrid depth system. Ordinary commerce surfaces are flat and separated by rules or tonal changes. The Home shelf alone may feel physical through a crisp lower rail shadow and inset birch highlight. Overlays use one soft shadow; product cards never float individually above the shelf.

### Shadow Vocabulary

- **Shelf Rail** (`inset 0 2px oklch(84% 0.055 79), 0 5px 0 oklch(57% 0.075 65)`): horizontal pantry beams and plinths only.
- **Overlay** (`0 14px 40px oklch(20% 0.03 48 / 20%)`): Cart sheet, dialog, and popover.
- **Sticky Purchase** (`0 8px 30px oklch(25% 0.03 48 / 16%)`): compact mobile purchase bar only.

**The Physical-Only-Where-Physical Rule.** A shelf rail may cast a shelf shadow. A Product row, form field, policy block, or status message may not imitate furniture.

## 5. Components

### Buttons

- **Shape:** `8px` rounded rectangle; square shelf geometry must not force square touch targets.
- **Primary:** Tomato with Clean Paper, minimum `48px` height and `12px 18px` padding.
- **Hover / Focus:** deepen to Tomato Deep or reduce brightness; Focus Blue `3px` outline with `3px` offset; pointer press scales to `0.97` for `140ms`.
- **Secondary:** Butter with Pantry Ink for one merchandising or payment-switch emphasis; ordinary secondary actions are text or Clean Paper with a Shelf Line border.
- **Disabled:** neutral fill, Pantry Ink label, and adjacent reason; never hide uncertainty behind a dim button alone.

### Chips

- **Style:** reserved for availability, a selected filter, or a compact state. Use Clean Paper or a low-chroma tint and explicit text.
- **State:** selected controls add border and icon or weight; stock uses dot plus label, never dot alone.

### Cards / Containers

- **Corner Style:** shelf bays are square (`0px`); independent media may use `10px`; do not round every compartment.
- **Background:** Clean Paper inside the shelf, Clear Ground outside it, Navy for trust facts, Butter for one merchandising signal.
- **Shadow Strategy:** no per-card shadow. Rails and separators create the structure.
- **Border:** Shelf Line for ordinary rows; Birch Shadow for physical bays.
- **Internal Padding:** `12–24px` for dense product rows, `24–48px` for feature bays.

### Inputs / Fields

- **Style:** Clean Paper, `1px` Shelf Line, `8px` radius, `48–50px` height.
- **Focus:** Focus Blue outline; Search may also strengthen its border.
- **Error / Disabled:** plain Mongolian explanation, preserved input, and no reliance on Tomato alone.

### Navigation

Desktop keeps wordmark, a wide conventional Search field, Customer entry, and Cart in one stable header. Cart uses Tomato; Search remains visually larger than decorative navigation. On mobile, a menu trigger, `48` stamp, and Cart remain in the first row; Search receives its own full-width row or deliberate expansion. Category navigation becomes a horizontally scrollable shelf index with visible labels, not icon-only mystery navigation.

### Pantry Shelf

The signature Home composition uses one outer birch frame and unequal bays for category index, Store statement, hero photography, one Bundle or merchandising feature, and one delivery/trust fact. Bay boundaries align. The image remains the largest visual area. Below the hero, shelves loosen: product groups may share a rail, but descriptions and purchase controls receive sufficient white space.

### Product and Search Rows

Product discovery uses photography-forward bays at large widths. Search and repeat-purchase views adopt Direction C's compact row rhythm: thumbnail, full Product name, explicit availability, tabular MNT price, and one direct action. Mobile rows use roughly `40%` image and `60%` commercial detail rather than stacking a tall image over every item.

### Purchase Boundary

Selected Variant, current price, availability freshness, quantity, and Add to Cart read as one cluster. Image and price may crossfade on Variant changes over `160–220ms`; keyboard selection updates immediately without spatial animation. Cart feedback is brief and never blocks continued shopping.

## 6. Do's and Don'ts

### Do:

- **Do** use Direction A's pantry shelf as the identity source and Direction C's row rhythm for Search and repeat purchase.
- **Do** concentrate birch framing in the Home hero and selected merchandising shelves.
- **Do** keep the page ground near-neutral and let bright kitchen photography carry warmth.
- **Do** keep Search and Cart conventional, visible, and easy to reach on every viewport.
- **Do** use semantic Mongolian HTML for every Product name, SKU, price, status, and control; imagery never carries commerce truth.
- **Do** pair availability color with explicit text and recheck live truth before enabling purchase.
- **Do** crop generated product imagery consistently, favoring bright daylight, clear silhouettes, and blank fictional packaging.
- **Do** reduce mobile composition to readable bays and compact rows rather than shrinking the desktop cabinet.
- **Do** use `120–220ms` ease-out feedback, Astro route continuity, and immediate reduced-motion alternatives.

### Don't:

- **Don't** turn the accepted pantry direction into a generic Shopify-style theme where only red, cream, and a logo distinguish the Store.
- **Don't** create Shadcn-style card grids dressed up as commerce; the shelf is a composition, not a collection of rounded cards.
- **Don't** let the shelf metaphor hide products, prices, search, or purchasing behind novelty.
- **Don't** tint the entire application cream or beige; use Clear Ground outside physical birch regions.
- **Don't** repeat timber borders, inset shadows, shelf numbers, or uppercase labels on every section.
- **Don't** use the prototype's `-0.055em` to `-0.08em` heading spacing; never tighten display text beyond `-0.04em`.
- **Don't** make Tomato, Butter, Leaf, and Navy interchangeable decorative accents.
- **Don't** put readable brand copy, prices, SKUs, barcodes, QR codes, or authoritative status inside generated images.
- **Don't** animate keyboard actions, quantity truth, payment truth, or unavailable states.
- **Don't** copy Direction B's room photography into every route or Direction C's operational density into discovery-led Home merchandising.
