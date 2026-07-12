# Austin Makasare — Portfolio Design System
> Swiss editorial spread on cool paper. Backend Engineer as product.

**Theme:** light (default) with dark mode toggle

**Portfolio URL:** austinmakasare.site

Austin's portfolio runs the same Swiss-editorial visual system as the Dayos reference: a soft gray canvas holding massive ultra-condensed display headlines, restrained grotesque body text, and a tiny mono voice for tags and micro-labels. The page behaves like a print spread — one colossal typographic statement per section, set tight (0.90 line-height, -3% tracking), supported by generous whitespace rather than dividers or rules.

Color is nearly absent in chrome and nearly explosive in the 3D hero illustration. UI accents are a single soft mint (availability status, skill tag highlights) and a single electric yellow (hero headline accent word, 3D infra cube). Surfaces are flat — no shadows, no gradients — relying on a 5-level tonal stack (canvas → white card → mist → mint → yellow) to separate layers.

The hero is full-bleed black (not canvas gray) — matching Dayos's dark first section — then the page transitions to the gray canvas for all subsequent sections. The 3D hero object is a floating stack of infrastructure/server building blocks (stone-texture boxes with glowing yellow, mint, and magenta cubes labeled with tech names like "Node.js", "Redis", "BullMQ", "PostgreSQL") occupying the right 45% of the viewport.

**The message this portfolio delivers:** Hiring managers and freelance clients land here and immediately see "Backend Engineer building production systems — queues, locks, and infrastructure" before they read a single word.

---

## Tokens — Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Canvas Mist | `#e5e7eb` | `--color-canvas-mist` | Page background, section canvases, hairline dividers — the quiet ground |
| Pure White | `#ffffff` | `--color-pure-white` | Card surfaces, nav pill, elevated panels, button text |
| Surface Mist | `#f3f3f3` | `--color-surface-mist` | Skill tag backgrounds, button hover washes, low-emphasis panels |
| Ink Black | `#000000` | `--color-ink-black` | Hero background, headings on light surfaces, body text |
| Steel Gray | `#979797` | `--color-steel-gray` | Secondary body text, captions, project meta, placeholder fills |
| Graphite | `#444444` | `--color-graphite` | Nav text at rest, secondary borders, subdued button outlines |
| Mint Pulse | `#d1ffca` | `--color-mint-pulse` | 'Available for work' pill, highlighted links, active skill tags |
| Electric Yellow | `#fff100` | `--color-electric-yellow` | Hero headline accent word, 3D infra cube dominant color |

---

## Tokens — Typography

### SuisseIntl · `--font-suisseintl`
**Role:** Primary UI and body — nav, buttons, body copy, project descriptions, about text
- Substitute: Inter or Neue Haas Grotesk
- Weights: 400, 450, 500
- Sizes: 14, 16, 18, 20, 28, 40
- Line height: 1.10–1.33
- Letter spacing: -0.0100em at 40px, -0.0110em at 18–20px, -0.0200em at 14–16px, -0.0300em at 12px

### SuisseIntlCond · `--font-suisseintlcond`
**Role:** Display headlines — hero statement, section openers
- Substitute: Barlow Condensed Bold or Roboto Condensed Bold
- Weights: 700
- Sizes: 48, 64, 80, 130
- Line height: 0.90 (locked)
- Letter spacing: -0.0300em across all sizes

### SuisseIntlMono · `--font-suisseintlmono`
**Role:** Section kickers (`// PROJECTS`), tech stack tags, status chips, timeline markers
- Substitute: JetBrains Mono or IBM Plex Mono
- Weights: 400
- Sizes: 12 (only)
- Line height: 1.30–1.60
- Letter spacing: -0.0300em

### Type Scale

| Role | Size | Line Height | Letter Spacing | Token |
|------|------|-------------|----------------|-------|
| caption / mono tag | 12px | 1.3 | -0.36px | `--text-caption` |
| body-sm / nav / button | 14px | 1.3 | -0.28px | `--text-body-sm` |
| body / description | 16px | 1.33 | -0.32px | `--text-body` |
| subheading | 20px | 1.25 | -0.22px | `--text-subheading` |
| card heading | 28px | 1.2 | -0.31px | `--text-heading-sm` |
| stats number | 40px | 1.14 | -0.4px | `--text-heading` |
| project card display | 48px | 1.1 | -1.44px | `--text-heading-lg` |
| section opener | 80px | 0.9 | -2.4px | `--text-display` |
| hero headline | 130px | 0.9 | -3.9px | `--text-display-xl` |

---

## Tokens — Spacing & Shapes

**Base unit:** 8px

### Spacing Scale
| Name | Value | Token |
|------|-------|-------|
| 8 | 8px | `--spacing-8` |
| 16 | 16px | `--spacing-16` |
| 24 | 24px | `--spacing-24` |
| 40 | 40px | `--spacing-40` |
| 64 | 64px | `--spacing-64` |
| 80 | 80px | `--spacing-80` |
| 96 | 96px | `--spacing-96` |

### Border Radius
| Element | Value |
|---------|-------|
| buttons | 4px |
| skill tags | 12px |
| tags / chips | 20px |
| standard cards | 24px |
| project cards | 32px |
| nav pill | 48px |
| large feature cards | 64px |

### Layout
- **Page max-width:** 1280px
- **Section gap:** 80px
- **Card padding:** 24px
- **Element gap:** 16px

---

## Portfolio Sections

### 1. Nav (Floating Pill)
White (`#ffffff`) pill, 48px border-radius, floating on whatever the current section's background is. Left: "A·M" monogram mark. Center: nav links — Work / About / Skills / Now / Contact — in SuisseIntl 500 at 14px, `#444444`, no underline. Right: "Hire Me" filled dark button — `#000000` bg, `#ffffff` text, SuisseIntl 450 at 14px, 4px radius.

### 2. Hero Section
**Background:** Full-bleed `#000000`.
**Layout:** Asymmetric split — left 55%, right 45%.
**Left column:**
- Mono kicker: `// AUSTIN MAKASARE` — SuisseIntlMono 400, 12px, `#979797`, letter-spacing -0.36px. Optional: `[AVAILABLE FOR WORK]` mint pill beside it.
- Display headline: "BACKEND ENGINEER BUILDING SYSTEMS THAT SCALE." — SuisseIntlCond 700, 130px, `#ffffff`, line-height 0.90, letter-spacing -3.9px. One word or phrase highlighted in `#fff100` (e.g. "SYSTEMS").
- Subheadline: "Queues, locks, and distributed infrastructure — production systems that don't break." — SuisseIntl 400, 18px, `#ffffff`, line-height 1.25, max-width 480px.
- CTA row: "View My Work" filled black/white button + "Book a Call" ghost outline button, gap 16px.

**Right column:**
- React Three Fiber 3D scene: a stacked column of stone-textured building blocks with bright floating cubes labeled "Node.js", "Redis", "BullMQ", "PostgreSQL", "TypeScript" — yellow (#fff100), mint (#d1ffca), and magenta accents. Self-shadowed, no floor plate, no border. Occupies full right column height. Slow idle rotation on Y-axis (GSAP, 0.003 rad/frame).

### 3. Stats Strip
**Background:** `#000000`
**Layout:** Three-column row, full width, 96px top/bottom padding.
Three condensed statements in SuisseIntlCond 700, 80px, `#ffffff`, line-height 0.90:
- Column 1: "10K+" / below: "CONCURRENT USERS" in mono 12px `#979797`
- Column 2: "2" / below: "PRODUCTION SYSTEMS" in mono 12px
- Column 3: "1.5YR" / below: "INDUSTRY EXPERIENCE" in mono 12px

### 4. About Section
**Background:** `#e5e7eb` (canvas)
**Layout:** Left 55% / right 45%.
**Left:**
- Mono kicker: `// ABOUT ME`
- Section heading: "BUILDING THINGS THAT DON'T BREAK." — SuisseIntlCond 700, 80px, `#000000`, line-height 0.90
**Right:**
- Lead paragraph (SuisseIntl 400, 20px, `#000000`): "I'm a backend engineer and MSc Computer Science student building production-grade systems — from distributed job queues to scalable APIs handling 10,000 concurrent users."
- Body paragraph (SuisseIntl 400, 16px, `#000000`): "My work focuses on the unglamorous but critical parts of software: queues that don't lose jobs, locks that don't deadlock, infrastructure that auto-scales. I care about reliability, not just features."
- Skill tags (12 max): Node.js · TypeScript · PostgreSQL · Redis · BullMQ · Next.js · Prisma · AWS · Docker · REST APIs · Event-driven systems · System design — each a `#f3f3f3` surface pill, hover to `#d1ffca`.

### 5. Selected Work (Project Cards)
**Background:** `#e5e7eb` (canvas)
**Layout:** Horizontal scroll carousel — same as Dayos's department cards. Two visible cards at a time, prev/next arrow buttons centered below.
**Section header:** Mono kicker `// SELECTED WORK` + "WHAT I'VE BUILT." SuisseIntlCond 700, 80px.

**Card structure** (white `#ffffff`, 32px border-radius, 24px padding, no shadow):
- Top area (~55% height): 3D-rendered object specific to project (React Three Fiber or static render). Canvas Mist background inside the image area.
- Mono label (12px, `#444444`): e.g. "BACKEND · 2024"
- Project name (SuisseIntlCond 700, 48px, `#000000`, line-height 0.9): e.g. "QUIZ PLATFORM"
- One-liner (SuisseIntl 400, 14px, `#444444`): e.g. "Real-time monitoring for 10,000 concurrent exam takers"
- Tech tags: inline mono chips
- CTA: "View Case Study →" — ghost button, `#000000` border, 4px radius

**Project 1 — Quiz Platform**
- 3D object: a floating stack of digital screens/monitors with facial detection UI
- Label: "BACKEND · REAL-TIME · 2024"
- Name: "QUIZ PLATFORM"
- Tagline: "Scalable online examination for 10,000 concurrent users with live proctoring"
- Stack chips: Node.js · WebSocket · AWS · PostgreSQL · Redis

**Project 2 — Form Builder**
- 3D object: a floating form/document with colorful geometric modules snapping together
- Label: "FULLSTACK · AUTOMATION · 2024"
- Name: "FORM BUILDER"
- Tagline: "Pro-grade form platform with automated certificates, payments, and contact deduplication"
- Stack chips: Next.js · BullMQ · Prisma · PostgreSQL · Stripe

### 6. Skills Section
**Background:** `#000000`
**Layout:** Three columns — matching Dayos's "ANSWERS / ACTIONS / EXPERTS" structure exactly.
Three 3D objects above three condensed labels:
- Column 1: "SYSTEMS." — distributed queues, locks, event-driven architecture
- Column 2: "BACKEND." — Node.js, REST APIs, database design, ORM
- Column 3: "INFRA." — AWS, Docker, auto-scaling, CI/CD
Each column: 3D object (small, ~160px), bold condensed heading (80px, white), body copy (16px, `#979797`).

### 7. Now Section
**Background:** `#e5e7eb`
**Layout:** JSON-driven compact block, left-aligned. Mono kicker `// NOW`. No visible timestamp. Four rows:
- 🏗 BUILDING: "Form Builder Pro — adding Stripe payment flows"
- 📖 LEARNING: "Distributed systems — reading DDIA"
- 📍 STATUS: "Open to SDE-2 roles · Remote preferred"
- Optional: Spotify chip (currently playing, if API available)

### 8. CTA Tiles
**Background:** `#ffffff`
**Layout:** Two equal-width tiles side by side, full width.
- Left tile: "BOOK A CALL" + arrow icon square — links to Cal.com
- Right tile: "VIEW RESUME" + arrow icon square — downloads PDF
Both in SuisseIntlCond 700, 64px, `#000000`. Descriptions below in SuisseIntl 400, 14px, `#444444`.
Thin 1px `#e5e7eb` divider between tiles.

### 9. Footer
**Background:** `#000000`
**Layout:** Standard Dayos-style dark footer.
- Left: "A·M" monogram + "Austin Makasare" in SuisseIntl 500, 16px, `#ffffff`
- Below: "Have questions or want to work together?"
- Below: "Drop a line → hello@austinmakasare.site" — `#d1ffca` highlight on the email
- Right: four-column link grid — Work / About / Contact / Social
- Bottom bar: "© 2026 Austin Makasare" left · GitHub + LinkedIn icons right · "Back to top" button center

---

## Components

### Navigation Pill
White (`#ffffff`) pill, 48px border-radius, centered near top. "A·M" monogram left at 16px SuisseIntl 500. Center: Work, About, Skills, Now, Contact — SuisseIntl 500, 14px, `#444444`. Right: "Hire Me" — `#000000` bg, `#ffffff` text, 4px radius, 10px vertical / 20px horizontal padding.

### Hero Display Headline
SuisseIntlCond 700, 130px, `#ffffff` on `#000000`. Line-height 0.90, letter-spacing -3.9px. One word set in `#fff100`.

### Project Card
`#ffffff` surface, 32px border-radius, no shadow. Top: 3D object on `#e5e7eb` crop. Below: mono 12px label, condensed 48px project name, 14px description, tech chips, ghost CTA button.

### Skill Tag
`#f3f3f3` background, 12px border-radius, SuisseIntlMono 400, 12px, `#000000`. Hover: `#d1ffca` background.

### Available Pill
`#d1ffca` background, full border-radius, mono 12px, `#000000` text: "AVAILABLE FOR WORK". Sits beside the hero mono kicker.

### Stats Number
SuisseIntlCond 700, 80px, `#ffffff`. Below: mono 12px `#979797` label.

### CTA Tile
White surface, large condensed heading (64px), arrow-in-square icon (40px, `#000000` border, 4px radius). Description in 14px SuisseIntl 400 below.

### Ghost Button
Transparent fill, `#000000` 1px border, `#000000` text, SuisseIntl 500, 14px, 4px border-radius.

### Mono Kicker
SuisseIntlMono 400, 12px, `#979797` or `#444444`, letter-spacing -0.36px. Sits above section headings. Format: `// SECTION NAME`.

---

## Do's and Don'ts

### Do
- Set hero and section openers in SuisseIntlCond 700 at 48–130px with line-height 0.90 and letter-spacing -0.0300em
- Use `#000000` for the hero section background; `#e5e7eb` for body sections; `#000000` again for skills and footer
- Reserve `#fff100` for one word in the hero headline and for 3D object cube accents only
- Use `#d1ffca` for the availability pill, highlighted email link, and active skill tag states only
- Keep nav pill white and floating — no full-bleed header
- Apply 32px radius to project cards; 48px to the nav pill; 4px to buttons
- Use mono 12px `// KICKER` labels above every section heading

### Don't
- Do not use Inter, Roboto, or system fonts — always SuisseIntl family or stated substitutes
- Do not add drop shadows, gradients, or glassmorphism to any card or nav element
- Do not use `#fff100` or `#d1ffca` as full-section backgrounds
- Do not set SuisseIntlCond below 48px
- Do not show timestamps in the Now section
- Do not add more than two accent colors — mint and yellow are the full palette
- Do not soften tracking on display type — -0.0300em is required at all display sizes

---

## Layout Blueprint

```
┌──────────────────────────────── 1280px max ─────────────────────────────────┐
│  [NAV]   A·M ── Work · About · Skills · Now · Contact ────────── [Hire Me]  │
├─────────────────────────────────────────────────────────────────────────────┤
│  HERO (black)                                                                │
│  // AUSTIN MAKASARE          [AVAILABLE FOR WORK]                            │
│  BACKEND ENGINEER            ┌──────────────────────────────────┐            │
│  BUILDING SYSTEMS            │  3D: Node.js/Redis/BullMQ        │            │
│  THAT SCALE.                 │  block tower, right-anchored     │            │
│  ─────────────────           │  45% viewport width              │            │
│  Queues, locks,              │  No border, no card              │            │
│  distributed infra.          └──────────────────────────────────┘            │
│  [View Work]  [Book a Call]                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  STATS STRIP (black)                                                         │
│  10K+             2              1.5YR                                       │
│  CONCURRENT    PRODUCTION     EXPERIENCE                                     │
│  USERS         SYSTEMS                                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  ABOUT (gray canvas)                                                         │
│  // ABOUT ME          I'm a backend engineer and MSc CS student...           │
│  BUILDING THINGS      [body paragraph]                                       │
│  THAT DON'T BREAK.    [skill tags: Node.js · Redis · BullMQ · ...]          │
├─────────────────────────────────────────────────────────────────────────────┤
│  SELECTED WORK (gray canvas)                                                 │
│  // SELECTED WORK                                                            │
│  WHAT I'VE BUILT.                                                            │
│  ┌──────────────────┐  ┌──────────────────┐  ← prev/next arrows below       │
│  │  [3D render]     │  │  [3D render]     │                                  │
│  │  BACKEND · 2024  │  │  FULLSTACK · 2024│                                  │
│  │  QUIZ            │  │  FORM            │                                  │
│  │  PLATFORM        │  │  BUILDER         │                                  │
│  │  [description]   │  │  [description]   │                                  │
│  │  [tech chips]    │  │  [tech chips]    │                                  │
│  │  View Case Study │  │  View Case Study │                                  │
│  └──────────────────┘  └──────────────────┘                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  SKILLS (black)                                                              │
│  [3D cube]          [3D cube]          [3D cube]                             │
│  SYSTEMS.           BACKEND.           INFRA.                                │
│  [description]      [description]      [description]                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  NOW (gray canvas)                                                           │
│  // NOW                                                                      │
│  🏗 BUILDING: Form Builder Pro...                                            │
│  📖 LEARNING: Distributed systems...                                         │
│  📍 STATUS: Open to SDE-2 · Remote                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  CTA TILES (white)                                                           │
│  BOOK A CALL  ↗  │  VIEW RESUME  ↗                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  FOOTER (black)                                                              │
│  A·M  Austin Makasare             Work  About  Contact  Social               │
│  hello@austinmakasare.site        ──────────────────────────────            │
│  © 2026 Austin Makasare      [↑ top]       GitHub  LinkedIn                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3D Hero Object Spec (React Three Fiber)

The 3D object is the portfolio's signature visual — must feel like the Dayos reference: stone-textured column with bright colorful blocks. 

**Geometry:** A vertical stack of 4–5 rough stone/concrete cubes (Box geometry, ~1.5–2 unit wide, 0.8 unit tall each). On top: 4–6 smaller bright colored cubes scattered/tilted slightly (0.5 unit each), floating/hovering.

**Materials:**
- Base cubes: MeshStandardMaterial, light stone/concrete color (#d4cfc9), roughness 0.85, metalness 0.0
- Accent cubes (electric yellow `#fff100`): MeshStandardMaterial, emissive: #fff100, emissiveIntensity 0.3
- Accent cubes (mint `#d1ffca`): MeshStandardMaterial, emissive: #d1ffca, emissiveIntensity 0.2
- Accent cubes (magenta `#e040fb`): MeshStandardMaterial, emissive: #e040fb, emissiveIntensity 0.3

**Labels on cubes:** Html component from @react-three/drei — small white text on dark pill: "Node.js", "Redis", "BullMQ", "PostgreSQL", "TypeScript"

**Lighting:** AmbientLight intensity 0.5 + DirectionalLight from top-right, intensity 1.2, castShadow. PointLight at y=3 mint-colored, intensity 0.4.

**Animation:** useFrame idle Y-rotation 0.003 rad/frame. On scroll (GSAP ScrollTrigger): cubes separate and float outward.

**Camera:** PerspectiveCamera fov=45, position [0, 1, 8]. OrbitControls disabled. Canvas transparent background.

---

## Agent Prompt Quick Reference

**Color constants:**
- Canvas: `#e5e7eb`
- Hero/Skills/Footer bg: `#000000`
- Cards: `#ffffff`
- Secondary surfaces: `#f3f3f3`
- Primary text: `#000000` on light, `#ffffff` on dark
- Secondary text: `#979797`
- Nav text: `#444444`
- Mint accent: `#d1ffca`
- Yellow accent: `#fff100`
- No other colors

**Font stack:**
- Display (48–130px): SuisseIntlCond 700, line-height 0.9, tracking -0.03em
- UI/Body (14–40px): SuisseIntl 400/450/500
- Tags/Kickers (12px only): SuisseIntlMono 400

**Section sequence:** Nav → Hero (black) → Stats Strip (black) → About (gray) → Selected Work (gray) → Skills (black) → Now (gray) → CTA Tiles (white) → Footer (black)

**Animation library:** GSAP + ScrollTrigger for scroll-driven; Framer Motion for UI transitions; React Three Fiber for 3D
