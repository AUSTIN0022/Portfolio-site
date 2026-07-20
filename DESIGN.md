---
name: Austin Makasare Portfolio
description: Swiss-editorial backend-engineer portfolio — condensed display type, a two-color accent system, and a restrained tinted-elevation layer (soft layered shadows, glossy pills, ambient glow on black sections) on top of otherwise flat tonal surfaces.
colors:
  canvas-mist: "#e5e7eb"
  pure-white: "#ffffff"
  surface-mist: "#f3f3f3"
  ink-black: "#000000"
  steel-gray: "#979797"
  graphite: "#444444"
  mint-pulse: "#d1ffca"
  electric-yellow: "#fff100"
  slate-steel: "#808080"
  iron-line: "#616161"
  deep-graphite: "#666666"
typography:
  display:
    fontFamily: "SuisseIntlCond, Barlow Condensed, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.375rem, 7vw, 4.25rem)"
    fontWeight: 700
    lineHeight: 0.9
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "SuisseIntlCond, Barlow Condensed, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.75rem, 10vw, 5rem)"
    fontWeight: 700
    lineHeight: 0.9
    letterSpacing: "-0.03em"
  title:
    fontFamily: "SuisseIntlCond, Barlow Condensed, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2rem, 6.5vw, 3rem)"
    fontWeight: 700
    lineHeight: 0.9
    letterSpacing: "-0.03em"
  body:
    fontFamily: "SuisseIntl, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.33
    letterSpacing: "-0.32px"
  label:
    fontFamily: "SuisseIntlMono, JetBrains Mono, ui-monospace, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "-0.36px"
rounded:
  buttons: "4px"
  tags: "20px"
  cards: "24px"
  cards-large: "32px"
  nav-pill: "48px"
  feature: "64px"
spacing:
  xs: "8px"
  sm: "16px"
  md: "24px"
  lg: "40px"
  xl: "64px"
  2xl: "80px"
  3xl: "96px"
components:
  button-primary:
    backgroundColor: "{colors.ink-black}"
    textColor: "{colors.pure-white}"
    rounded: "{rounded.buttons}"
    padding: "12px 24px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-black}"
    rounded: "{rounded.buttons}"
    padding: "12px 24px"
  skill-tag:
    backgroundColor: "{colors.surface-mist}"
    textColor: "{colors.ink-black}"
    rounded: "{rounded.tags}"
    padding: "6px 12px"
  skill-tag-hover:
    backgroundColor: "{colors.mint-pulse}"
    textColor: "{colors.ink-black}"
    rounded: "{rounded.tags}"
  project-card:
    backgroundColor: "{colors.pure-white}"
    rounded: "{rounded.cards-large}"
  nav-pill:
    backgroundColor: "{colors.pure-white}"
    rounded: "{rounded.nav-pill}"
---

# Design System: Austin Makasare Portfolio

## 1. Overview

**Creative North Star: "The Print Spread That Learned to Scroll"**

This portfolio runs a Swiss-editorial system: massive ultra-condensed display type set tight (0.90 line-height, -3% tracking), a restrained grotesque for body copy, and a tiny mono voice reserved for kickers and tags. The page reads like a print spread — one dominant typographic statement per section — separated by generous whitespace and flat tonal surfaces rather than dividers, cards-on-cards, or shadows.

Color is almost entirely absent from UI chrome and concentrated instead in two deliberate accents: a soft mint (availability status, active tag state) and an electric yellow (the one accent word in the hero headline, hover states, the focus ring). Everything else is ink black, pure white, or one of three grays tuned per background — the palette is disciplined on purpose; the 3D hero illustration is where color is allowed to be loud.

This system explicitly rejects the SaaS-landing-page playbook: no gradient text, no glassmorphism, no hero-metric-with-gradient-accent cards, no identical icon-heading-text card grids. Sections alternate between the canvas-gray ground and full-bleed black not as a light/dark theme switch but as a fixed layout rhythm — there is no user-facing theme toggle.

**Key Characteristics:**
- Condensed, tight-set display type as the primary visual instrument
- Two accent colors used sparingly and specifically (mint = status/active, yellow = emphasis/hover)
- Mostly flat surfaces at rest; depth is spent deliberately on interaction (hover elevation, glossy pills, ambient glow on black sections) and the scroll-driven rising panel, not on permanent card shadows
- One named mono-kicker system (`// SECTION`) used consistently, not as decorative filler
- Black and canvas-gray sections alternate as fixed layout rhythm, not theme

## 2. Colors

Nearly monochrome chrome, two accents used with intent, and three separately-tuned muted grays because one gray can't pass contrast on every surface this system alternates between.

### Primary
- **Electric Yellow** (#fff100): the hero headline's one accent word, the CTA-tile hover fill (a diagonal wipe from the tile's center), the `principle-row` hover accent bar, the global keyboard focus ring, and the skip-link. Reserved for emphasis and interaction — never a background fill for a full section.

### Secondary
- **Mint Pulse** (#d1ffca): the "Available for Work" pill, the active/hover state of skill tags, and the highlighted email link in the footer. Signals status and affirmative state specifically.

### Neutral
- **Ink Black** (#000000): full-bleed section backgrounds (stats strip, skills, footer, the dark half of the Now/Work page headers), primary button fill, and all heading text on light surfaces.
- **Pure White** (#ffffff): card surfaces, the floating nav pill, button text on dark fills.
- **Canvas Mist** (#e5e7eb): the page's other section background (hero, about, principles, work, the light half of Now/Work pages) — the quiet ground the whole system rests on.
- **Surface Mist** (#f3f3f3): skill-tag resting background, low-emphasis panel fills (diagram render areas).
- **Graphite** (#444444): nav link text at rest, secondary body copy, borders — on **light surfaces only**.
- **Steel Gray** (#979797): secondary/muted text — on **dark (black) surfaces only**. At 2.9:1 on white and 2.4:1 on canvas-mist it fails WCAG AA on light ground; it clears 6.98:1 on black.
- **Slate Steel** (#808080): a dark-surface-only alternative to Steel Gray for text that needs slightly more restraint (5.3:1 on black) — used for the stack-tag group labels on the Now page.
- **Iron Line** (#616161): borders and hairlines on black surfaces (3.4:1 on black — meets the 3:1 non-text UI-component threshold).
- **Deep Graphite** (#666666): the light-surface counterpart to Steel Gray — muted kicker and label text on white cards or canvas-mist (4.6:1 on both).

### Named Rules
**The Split-Gray Rule.** No single muted gray works on every background this system uses. Steel Gray and Slate Steel are dark-surface-only; Deep Graphite is light-surface-only. Never reuse Steel Gray's hex on a light background — it fails AA there even though it's the "brand gray."

**The Two-Accent Rule.** Mint and yellow are the entire accent palette. Neither is ever used as a full-section background — both stay confined to pills, hover states, and single emphasized words.

## 3. Typography

**Display Font:** SuisseIntlCond (commercial; falls back to Barlow Condensed via next/font when the licensed `.woff2` files aren't present in `public/fonts/`)
**Body Font:** SuisseIntl (falls back to Inter)
**Label/Mono Font:** SuisseIntlMono (falls back to JetBrains Mono)

**Character:** A geometric condensed display paired with a neutral grotesque body and a technical mono for labels — display carries the voice, body and mono stay quiet and get out of the way.

### Hierarchy
- **Display** (700, `clamp(38px, 7vw, 68px)`, 0.9 line-height): the hero headline only — one size larger and more constrained than every other display use, since it's the single largest commitment on the page.
- **Headline** (700, `clamp(2.75rem, 10vw, 5rem)` ≈ 44–80px, 0.9 line-height): section-opener headings (About, Work, Now, CTA tiles).
- **Title** (700, `clamp(2rem, 6.5vw, 3rem)` ≈ 32–48px, 0.9–1.0 line-height): card and subsection headings (project card names, Now page block headings, diagram card titles at a smaller fixed 28px).
- **Body** (400, 16px, 1.33 line-height): descriptions and paragraph copy. Lead paragraphs step up to 20px/1.4.
- **Label** (400, 12px, 1.3 line-height, -0.36px tracking): mono kickers (`// SECTION`), tech-stack tags, status chips, timeline/PROBLEM-APPROACH-OUTCOME labels. The single most-used text style in the system — always uppercase content, never a CSS `text-transform` rule.
- Secondary sizes in active use: 14px (nav links, buttons, secondary body), 18px (hero subheadline), 15px (case-study approach/outcome copy).

### Named Rules
**The Fluid-Display Rule.** Every display/headline/title size is a `clamp()`, not a fixed px value — condensed type at a fixed size either overflows on mobile or looks timid on desktop. The clamp ceiling never exceeds what shipped at the original fixed-px design (the comments in `globals.css` document "was 80px" etc. as the ceiling reference).
**The Graceful-Degradation Rule.** SuisseIntl is a licensed typeface not committed to the repo (see `public/fonts/README.md`). There are no `@font-face` rules for it until the real files are licensed — the Google-Fonts fallback (Barlow Condensed / Inter / JetBrains Mono) is the actual rendered typography today, and it must stay a close visual match.

## 4. Elevation

Restrained, not flat. Section-to-section separation is still primarily the tonal stack (canvas → white card → surface-mist → mint → yellow) and the scroll-driven rising panel, but interactive surfaces now carry a deliberate three-level elevation system on hover/press, built from tinted, layered shadows rather than a single flat drop-shadow.

### Shadow Vocabulary
- **`--shadow-elevation-1`** (`0 1px 2px rgba(0,0,0,0.05), 0 2px 8px rgba(0,0,0,0.05)`): resting elevation for buttons and cards that need to read as slightly raised even before interaction.
- **`--shadow-elevation-2`** (`0 2px 6px rgba(0,0,0,0.07), 0 10px 28px rgba(0,0,0,0.10)`): hover state for round icon buttons (work-track prev/next, back-to-top).
- **`--shadow-elevation-3`** (`0 6px 16px rgba(0,0,0,0.10), 0 24px 56px rgba(0,0,0,0.18)`): hover state for primary buttons and the project-card lift. The deepest shadow in the system; still layered and diffuse, never a single hard offset.
- **Ambient glow** (`.surface-ambient`): a near-invisible bleed of mint (7%) and electric-yellow (5%) pooled at the top corners of the three pure-black sections (Stats, Skills, Footer), fading to true black by mid-section. Reads as depth on a dark surface without introducing a new hue.
- **Floating menu shadow** (`0 24px 60px rgba(0,0,0,0.25)`): unchanged, the mobile nav's dropdown menu.

### Named Rules
**The Tinted-Elevation Rule.** When a shadow is used, it is always multi-layered and low-opacity (≤0.18 alpha), never a single hard `0 4px 4px black`. Elevation appears on interaction (hover/press), not as permanent card chrome — resting cards stay close to flat; hover states are where the system spends its shadow budget.
**The Spring-Ease Rule.** Every elevation transition uses `--ease-spring` (`cubic-bezier(0.16, 1, 0.3, 1)`), never `ease` or `linear`. Buttons lift `-2px` and gain `--shadow-elevation-3` on hover, compress to `scale(0.97)` on press. Icon buttons and bento tiles lift `-2px` to `-4px` with `--shadow-elevation-2`.
**The Rising-Panel Rule.** Where a black section needs to visually rise over the section before it, wrap it in the `CurvedRise` component: as the panel scrolls into place, its top corners round and its edges pull in from an inset toward full width. This remains the system's primary large-scale elevation gesture and stays motion-driven, not shadow-driven.

## 5. Components

### Buttons
- **Shape:** 4px radius, no exceptions.
- **Primary:** ink-black background, pure-white text, SuisseIntl 500/450, 14px, 12px/24px padding (hero, CTA) or 10px/20px (nav pill's "Hire Me").
- **Ghost:** transparent fill, 1px ink-black border, ink-black text, same type and radius as primary.
- **Hover:** the `.btn-shine` class (applied to every primary/ghost CTA) lifts the button `-2px`, applies `--shadow-elevation-3` (dark) or `--shadow-elevation-1` (ghost), and brightens dark fills 8%. Press compresses to `scale(0.97)`.
- **Focus:** the global `:focus-visible` ring (2px electric-yellow, 2px offset) remains the keyboard-only indicator, layered on top of the hover elevation.

### Tags / Chips
- **Skill tag:** surface-mist background at rest, 20px radius, 12px mono, 6px/12px padding. Hovers (and marks "active" state) to a glossy top-lit mint gradient (`#eafde3 → mint-pulse`) with an inset top highlight and a soft mint-tinted shadow, plus a `-1px` lift — not a flat color swap.
- **Available pill:** the same glossy mint gradient + inset highlight, full pill radius, 12px mono, ink-black text — the one place mint appears as a filled background rather than a hover state.
- **Case-study status badge:** mint-pulse ("SHIPPED") or surface-mist ("DESIGNED") background, 20px radius, 12px mono.

### Cards / Containers
- **Corner style:** 24px for content cards (callouts, diagram cards, decision cards, bento tiles), 32px for project cards, 64px for the largest feature surfaces.
- **Background:** pure-white on canvas-mist sections; never a card-on-card nesting.
- **Shadow strategy:** `.card-elevated` — `--shadow-elevation-1` at rest, lifts `-6px` to `--shadow-elevation-3` on hover. Project-card media panels also carry a subtle inset top highlight + bottom seam (`inset 0 1px 0 rgba(255,255,255,.5), inset 0 -1px 0 rgba(0,0,0,.04)`) so the 3D object reads as sitting in a lit tray rather than flat on a rectangle.
- **Internal padding:** 24px baseline, up to `clamp(24px, 5vw, 40px)` on larger content cards.

### Bento Grid (Skills section)
The Skills section is a 4-column × 2-row dense grid (`grid-auto-flow: dense`) replacing a flat 3-column layout. SYSTEMS occupies a large 2×2 tile; BACKEND and INFRA fill the remaining 2×1 slots with zero empty cells. Each tile carries distinct low-opacity tinting (neutral/mint/yellow) rather than identical panels — the system's Bento Background Diversity rule. Collapses to a single column on mobile (`< 768px`), tiles at natural size, no span overrides.

### Navigation
- **Style:** a floating pure-white pill (48px radius), fixed to the top of the viewport, centered. "A·M" monogram left, links center, filled "Hire Me" button right, all in SuisseIntl 500/14px graphite (hover to ink-black).
- **Mobile:** the link row and CTA collapse behind a 44×44px hamburger toggle (`.nav-toggle`); tapping opens a white dropdown panel below the pill with the same links stacked and a full-width "Hire Me" button. The dropdown is the one place in the system that uses a shadow.
- **Interaction detail:** each nav label wraps in a per-character hover-wave animation (`WaveText`) with `white-space: nowrap` on the wrapper — required so the per-character spans can't become independent line-break points when the pill is under horizontal pressure.

### Signature Component: The 3D Infrastructure Object
A React Three Fiber scene appears three times: full-size in the hero, small (~160px) above each Skills column, and inside each project card. It's a stack of stone-textured cubes with smaller bright accent cubes (yellow, mint, and magenta) floating among them, slow-rotating on idle. Every instance is wrapped in `LazyCanvas`, which mounts the WebGL context only within 250px of viewport, pauses the render loop when off-screen or the tab is hidden, caps device-pixel-ratio at 1.5, and drops to a single static frame under `prefers-reduced-motion`.

## 6. Do's and Don'ts

### Do:
- **Do** set every display/headline/title size as a `clamp()`, never a fixed px value.
- **Do** use `var(--color-*)` custom properties for chrome colors — the tokens above are the single source of truth; component files should reference them, not hardcode hex.
- **Do** use Steel Gray / Slate Steel only on black backgrounds, and Deep Graphite only on white/canvas-mist backgrounds — check the actual rendered background before picking a muted-gray token, not just the section's "usual" color.
- **Do** wrap every WebGL scene in `LazyCanvas` and honor `prefers-reduced-motion` for every animation, including the nav's hover-wave and the CTA-tile diagonal fill.
- **Do** keep the `// SECTION` mono kicker format consistent wherever it appears — it's a deliberate, named brand system, not decorative scaffolding.
- **Do** use the `--shadow-elevation-1/2/3` tokens and `--ease-spring` for any new interactive-element shadow or lift — see Elevation. Never a hard single-offset drop-shadow.
- **Do** give every section a scroll-entry reveal via the existing `data-gsap="heading"|"card"|"stat"|"tags"` attributes (handled globally by `useScrollAnimation.ts`) — no section should mount statically.

### Don't:
- **Don't** add a hard, single-offset drop shadow (`0 4px 4px black`) to any surface — layered, tinted, low-opacity shadows only (see Elevation's Tinted-Elevation Rule).
- **Don't** use `#fff100` or `#d1ffca` as a full-section background — both are accents, never surfaces.
- **Don't** add a third accent color. Mint and yellow are the complete accent palette.
- **Don't** set display/headline/title type below 32px (the Title floor) or use a fixed px size at any display tier.
- **Don't** assume the hero section is black — it currently renders on Canvas Mist with a black headline; only the stats strip, skills, footer, and the header block of the Now/Work pages are full-bleed black.
- **Don't** add a light/dark theme toggle without a real design decision behind it — the black/canvas alternation is fixed layout rhythm, not a switchable mode, and there is no toggle UI anywhere in the code today.
- **Don't** let nav or button label text wrap mid-word — any text wrapped in `WaveText`'s per-character spans needs `white-space: nowrap` on its container, or a squeezed flex parent will break words between individual character spans.
