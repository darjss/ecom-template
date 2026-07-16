---
name: Bespoke Commerce System
description: Merchant-specific storefront art direction built on a stable, accessible buying spine.
colors:
  ink: "oklch(24% 0.025 66)"
  muted: "oklch(48% 0.02 66)"
  paper: "oklch(97% 0.018 85)"
  surface: "oklch(92% 0.035 78)"
  accent: "oklch(58% 0.16 38)"
  accent-ink: "oklch(98% 0.01 75)"
  focus: "oklch(54% 0.17 250)"
typography:
  display:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 6vw, 6rem)"
    fontWeight: 800
    lineHeight: 0.96
    letterSpacing: "-0.035em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "0.01em"
rounded:
  control: "8px"
  surface: "18px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  section: "clamp(48px, 8vw, 112px)"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "12px 18px"
    height: "44px"
  button-quiet:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "12px 18px"
    height: "44px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "12px 14px"
    height: "48px"
  status:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "8px 12px"
---

# Design System: Bespoke Commerce System

## 1. Overview

**Creative North Star: "Merchant frame, commerce spine"**

The system gives each Store enough visual freedom to feel authored while keeping the act of buying immediately recognizable. Store identity may change composition, typography, imagery, density, color, and merchandising rhythm. Product names, MNT prices, availability, option selection, quantity, Cart feedback, search, and Checkout entry retain stable semantics and familiar placement.

The shared layer is intentionally quiet. It supplies accessible controls, state language, focus, spacing, responsive behavior, and motion restraint rather than a visible house theme. Store-specific art direction should dominate the Storefront; shared Admin and conversion-heavy flows should remain calmer and operational. This rejects generic Shopify-style theme sameness, Shadcn-style card grids dressed up as commerce, and art direction that hides products, prices, search, or purchasing behind novelty.

**Key Characteristics:**

- Merchant-specific composition over token-only reskinning.
- Product imagery and prices before decorative interface furniture.
- Server-rendered usefulness before island hydration.
- Familiar conversion controls with expressive merchandising around them.
- Strong keyboard, reflow, contrast, reduced-motion, and Mongolian-language behavior.

**The Shared Floor Rule.** A Store may replace the frame, never the buying semantics. Shared behavior, state meaning, focus, validation, pricing clarity, and accessibility are not brand variables.

## 2. Colors

The shared palette is a restrained baseline, not a universal Store identity. Store palettes may replace it when they preserve semantic contrast and state meaning.

### Primary

- **Commerce Accent** (`oklch(58% 0.16 38)`): the default high-emphasis action color when a Store has not supplied an approved brand treatment.
- **Accent Ink** (`oklch(98% 0.01 75)`): text and icons on Commerce Accent.

### Neutral

- **Ink** (`oklch(24% 0.025 66)`): primary text and decisive borders.
- **Muted Ink** (`oklch(48% 0.02 66)`): secondary copy only where contrast remains compliant.
- **Paper** (`oklch(97% 0.018 85)`): default page and control surface.
- **Quiet Surface** (`oklch(92% 0.035 78)`): low-emphasis controls and grouped operational content.
- **Focus Blue** (`oklch(54% 0.17 250)`): reserved focus indicator that remains visible across merchant palettes.

**The Semantic Contrast Rule.** Brand color never weakens focus, error, disabled, availability, or text contrast. Every foreground/background pair must be validated, not assumed.

**The One Emphasis Rule.** Each region has one dominant action. Secondary actions use quieter surfaces or text treatment instead of competing accent fills.

## 3. Typography

**Display Font:** Inter with `ui-sans-serif`, `system-ui`, and `sans-serif` fallbacks  
**Body Font:** Inter with the same fallbacks  
**Label Font:** Inter with the same fallbacks

**Character:** The shared typography is direct, compact, and language-neutral. Store-specific families may replace it only after Mongolian Cyrillic coverage, numeral clarity, and realistic content lengths are proven.

### Hierarchy

- **Display** (800, `clamp(2.5rem, 6vw, 6rem)`, 0.96): rare Storefront statements and primary route titles; balanced wrapping; letter spacing no tighter than `-0.04em`.
- **Headline** (750, `clamp(1.75rem, 4vw, 3.5rem)`, 1): section and product headings.
- **Title** (700, `1rem–1.35rem`, 1.2): product names, form groups, and Admin decisions.
- **Body** (400, `1rem`, 1.6): prose and instructions, normally capped at `70ch`.
- **Label** (700, `0.8125rem`, 1.3): controls, prices, status, and compact metadata; sentence case by default.

**The Mongolian First Rule.** Never approve a typeface from Latin specimens alone. Check Ө, Ү, Ё, Й, punctuation, MNT figures, long labels, and dense mobile rows before adoption.

## 4. Elevation

The shared system is flat by default. Borders, tonal changes, and spacing establish hierarchy; shadows are reserved for transient overlays, sticky mobile purchase controls, and rare physical brand metaphors owned by a Store. Nested card shadows are never a layout system.

### Shadow Vocabulary

- **Overlay** (`0 14px 40px oklch(20% 0.02 66 / 18%)`): dialogs, popovers, and Cart sheets only.
- **Sticky Action** (`0 8px 30px oklch(20% 0.02 66 / 14%)`): mobile action bars when separation from scrolling content is necessary.

**The Flat-by-Default Rule.** A resting page is not a pile of floating cards. Add elevation only when an element actually overlays or moves independently from the document.

## 5. Components

### Buttons

- **Shape:** compact rounded rectangle (`8px`), never a universal pill.
- **Primary:** Commerce Accent with Accent Ink, minimum `44px` height and `12px 18px` padding.
- **Hover / Focus:** hover changes color or brightness only; focus uses the `3px` Focus Blue outline with `3px` offset; pointer press may scale to `0.97` for `120–160ms`.
- **Quiet:** Quiet Surface with Ink; no decorative shadow.
- **Disabled:** retains a readable label, removes action emphasis, and never relies on opacity alone to explain why purchasing is blocked.

### Chips

- **Style:** use only for a compact status or selected filter. Pills are not navigation, headings, or generic decoration.
- **State:** selected state changes at least two signals among fill, border, icon, and label; availability always includes text.

### Cards / Containers

- **Corner Style:** `18px` only for genuine grouped surfaces; Store-specific structural systems may use square geometry.
- **Background:** Paper or an approved Store surface.
- **Shadow Strategy:** flat at rest; refer to Elevation for overlays.
- **Border:** one quiet divider is preferred to boxed nesting.
- **Internal Padding:** `16–32px`, scaled to content density.

### Inputs / Fields

- **Style:** Paper background, `1px` visible border, `8px` radius, `48px` minimum height.
- **Focus:** Focus Blue `3px` outline; focus must remain visible when a Store overrides the field border.
- **Error / Disabled:** pair color with a plain-language message; preserve entered values after failure.

### Navigation

Storefront navigation keeps Search and Cart conventional and reachable. The active route uses text, weight, or underline rather than a decorative capsule by default. Mobile navigation must fit realistic Mongolian labels without truncating the only path to a commerce action.

### Purchase Boundary

Price, chosen Variant, quantity, availability freshness, and the primary purchase action read as one unit. The action begins disabled until fresh availability is known. Loading, unavailable, stale, and ready states remain visually and semantically distinct.

## 6. Do's and Don'ts

### Do:

- **Do** adapt composition, typography, imagery, density, navigation presentation, and merchandising rhythm for each merchant.
- **Do** keep Product names, MNT prices, Search, options, Cart, and Checkout entry familiar and visible.
- **Do** render useful public content before client JavaScript and keep live commercial truth outside cached presentation.
- **Do** validate every merchant palette against WCAG 2.2 AA, visible focus, 200% zoom, `320px` reflow, and reduced motion.
- **Do** use one purposeful motion response at a time, normally `120–220ms` with a strong ease-out curve.
- **Do** keep the shared Admin quieter and denser than expressive Storefront merchandising.

### Don't:

- **Don't** create generic Shopify-style theme sameness where identity is reduced to logo, color, and font swaps.
- **Don't** create Shadcn-style card grids dressed up as commerce or nest cards to manufacture hierarchy.
- **Don't** let art direction hide products, prices, search, or purchasing behind novelty.
- **Don't** use gradient text, decorative glassmorphism, side-stripe accents, or repeated tiny uppercase eyebrows as default grammar.
- **Don't** make every control a pill or every surface rounded and elevated.
- **Don't** animate keyboard-initiated actions, delay input, or encode inventory/payment state in motion.
- **Don't** introduce a Store-specific component override framework; reviewed route composition is the customization seam.
