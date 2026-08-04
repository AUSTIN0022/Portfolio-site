# Typography Scale Audit

Checks the site's actual rendered type sizes against 5 named ratio systems:

| Ratio | Value | 
|---|---|
| Golden | 1.618 |
| Silver | 1.414 |
| Perfect Fourth | 1.333 |
| Perfect Fifth | 1.25 |
| Minor Third | 1.2 |

Match = within ±2% of a ratio. Near = within ±5%.

## Finding 0 — two competing scales, one of them dead

`theme.css` / `variables.css` define a `--text-*` token scale (12/14/16/20/28/40/48/80/130px). **Zero components reference these tokens** — every heading/description in the codebase uses inline `fontSize` (hardcoded px or `clamp()`) instead. This scale is dead code.

Ironically, the dead scale is closer to a clean ratio system than what's actually live:

| Step | px | Ratio to prev | Nearest named ratio | Match |
|---|---|---|---|---|
| caption → body-sm | 12 → 14 | 1.167 | Minor Third (1.2) | near (−2.8%) |
| body-sm → body | 14 → 16 | 1.143 | Minor Third (1.2) | off (−4.8%) |
| body → subheading | 16 → 20 | **1.25** | Perfect Fifth | **exact** |
| subheading → heading-sm | 20 → 28 | 1.4 | Perfect Fourth (1.333) | off (+5%) |
| heading-sm → heading | 28 → 40 | 1.429 | Perfect Fourth (1.333) | off (+7.2%) |
| heading → heading-lg | 40 → 48 | **1.2** | Minor Third | **exact** |
| heading-lg → display | 48 → 80 | 1.667 | Golden (1.618) | near (+3%) |
| display → display-xl | 80 → 130 | 1.625 | Golden (1.618) | **near (+0.4%)** |

Recommendation: either wire this scale into components, or delete it — right now it's dead weight that also misleads anyone auditing "the" type scale.

## Finding 1 — the live display scale actually holds a ratio (unintentionally)

The fluid tokens actually used everywhere (`globals.css:143-145`, desktop-max values):

- `--fs-display-md` → 48px
- `--fs-display-lg` → 64px
- `--fs-display` → 80px
- Hero H1/H2 ceiling (`Hero.tsx:34,200`) → 108px

| Step | Ratio | Nearest named ratio | Match |
|---|---|---|---|
| 48 → 64 | **1.333** | Perfect Fourth | **exact** |
| 64 → 80 | **1.25** | Perfect Fifth | **exact** |
| 80 → 108 | 1.35 | Perfect Fourth (1.333) | near (+1.3%) |

This is the one part of the site that lines up cleanly with the reference chart, and it's consistent across pages (Home, `/work`, `/now`, case studies all reuse these same three tokens).

## Finding 2 — the body/caption cluster has no ratio at all

Sizes actually found in components: **8, 10, 11, 12, 13, 14, 15, 16, 18, 20, 22px** — 11 distinct steps crammed into a 14px range (Hero.tsx, Footer.tsx, CaseStudyProse.tsx, InfraScaleSimulator.tsx, Nav.tsx, etc).

| Step | Ratio |
|---|---|
| 10→8 | 1.25 |
| 11→10 | 1.10 |
| 12→11 | 1.09 |
| 13→12 | 1.08 |
| 14→13 | 1.08 |
| 15→14 | 1.07 |
| 16→15 | 1.07 |
| 18→16 | 1.125 |
| 20→18 | 1.11 |

None of these land on a named ratio (all sit below even Minor Third, 1.2), and there are far more steps than a real scale needs — a normal system has 4-6 steps total, not 11 between 8px and 22px. Reads as ad-hoc "whatever looked right" sizing per component rather than a scale. Consolidating this cluster down to 3-4 steps (e.g. 12 / 14 / 16 / 20, reusing Perfect Fifth 16→20 which already appears) would fix it in one pass.

## Finding 3 — title/description pairs, page by page

The specific thing you asked about: does a section's heading size relate to its own description/subtitle by one of these ratios?

| Location | Title | Description | Ratio | Verdict |
|---|---|---|---|---|
| About (`About.tsx`) | body-1 20px | body-2 16px | **1.25** | Perfect Fifth — exact |
| Footer (`Footer.tsx`) | heading 20px | body 16px | **1.25** | Perfect Fifth — exact |
| CtaTiles (`CtaTiles.tsx`) | subtitle 20px | small text 15px | **1.333** | Perfect Fourth — exact |
| WorkPageCard (`WorkPageCard.tsx`) | desc 16px | eyebrow 12px | **1.333** | Perfect Fourth — exact |
| fs-display-md → fs-display-lg (used as section→subsection title, e.g. Principles) | 48px | — | **1.333** | Perfect Fourth — exact (see Finding 1) |
| Principles (`Principles.tsx`) | section H2 80px | item title 48px | 1.667 | near Golden (+3%) |
| `/work` listing (`work/page.tsx`) | H1 80px | subtitle 48px | 1.667 | near Golden (+3%) |
| `/now` (`now/page.tsx`) | H1 80px | subtitle 48px | 1.667 | near Golden (+3%) |
| DomainMarquee (`DomainMarquee.tsx`) | 72px | 36px | 2.0 | no match (not in this list — an "octave") |
| **Hero (`Hero.tsx`)** | H1/H2 108px | pitch line 19px | 5.68 | **no relation** |
| About | H2 80px | body 20px | 4.0 | **no relation** |
| Work section (home) | H2 80px | card text 18px | 4.44 | **no relation** |
| CaseStudyLayout | H1 80px | category eyebrow 12px | 6.67 | **no relation** |
| Skills bento | large tile 80px | label 16px | 5.0 | **no relation** |
| 404 page | H1 80px | body 18px | 4.44 | **no relation** |

Pattern: whenever a section keeps a **middle step** between its biggest heading and its smallest label (About, Footer, CtaTiles, WorkPageCard, Principles), the jump to that middle step lands on a real ratio — mostly exact Perfect Fourth/Fifth, sometimes near-Golden. Whenever a section jumps **straight from an 80-108px display headline to a 12-20px caption with nothing in between** (Hero, home About/Work sections, CaseStudyLayout, Skills, 404), the ratio is 4x-8x — outside all five systems, because none of these systems are meant to span a single jump that large. That's the real gap: missing intermediate steps, not wrong math.

## Fixes applied (2026-08-02)

Scoped to the home page route (`src/app/page.tsx` and the components it renders). Rather than rewrite the shared `--fs-display*` tokens — which would've also reshaped `/work`, `/now`, and the case-study pages, and would've broken pairs that were already landing near a golden step by coincidence (CtaTiles title:desc = 4.267 ≈ φ³, StatsStrip number:label = 6.67 ≈ φ⁴, both left untouched) — each flagged "no relation" pair was fixed locally to hit the nearest golden step (φ, φ², φ³, or φ⁴), within ~2%:

| Component | Pair | Before | After | New ratio | Target φⁿ |
|---|---|---|---|---|---|
| `Hero.tsx` | H1/H2 (108) → pitch line | 19px | 16px | 6.75 | φ⁴ = 6.854 (−1.5%) |
| `About.tsx` | H2 (80) → body-1 | 20px | `var(--fs-golden-body)` = 19px | 4.21 | φ³ = 4.236 (−0.6%) |
| `Principles.tsx` | H2 (80) → section intro | 16px | `var(--fs-golden-body)` = 19px | 4.21 | φ³ = 4.236 (−0.6%) |
| `Principles.tsx` | item title (48) → item desc | 15px | `var(--fs-golden-desc)` = 18px | 2.67 | φ² = 2.618 (+1.9%) |
| `Skills.tsx` | large tile (80) → label | 16px | `var(--fs-golden-body)` = 19px | 4.21 | φ³ = 4.236 (−0.6%) |
| `Skills.tsx` | small tile (48) → label | 16px | `var(--fs-golden-body)` = 19px | 2.53 | φ² = 2.618 (−3.5%) |
| `ProjectCard.tsx` (home Work cards) | title (48) → tagline | 14px | `var(--fs-golden-desc)` = 18px | 2.67 | φ² = 2.618 (+1.9%) |

Two new tokens in `globals.css`: `--fs-golden-body` (19px) and `--fs-golden-desc` (18px), reused across About/Principles/Skills and Principles/ProjectCard respectively instead of repeating magic numbers.

**Left unchanged, deliberately:**
- `CtaTiles.tsx`, `Statement.tsx`, `StatsStrip.tsx`, `Work.tsx` heading — already golden (CtaTiles, StatsStrip) or have no real title:description pair to fix (Statement is a standalone quote, Work's H2 has no paragraph under it).
- `Footer.tsx` identity block (A·M / name / tagline) — forcing golden here would make the name bigger than the "A·M" mark above it, inverting the existing visual hierarchy for a block that's a contact card, not a heading+description pair.
- `DomainMarquee.tsx` (72px/36px, exactly 2×) — decorative marquee text, not a title:description pair.
- The shared `--fs-display` / `--fs-display-lg` / `--fs-display-md` tokens themselves — left at 80/64/48px. Forcing all three into one strict golden chain (80 → 49 → 30) would shrink CtaTiles and Statement's 64px, breaking their already-good golden pairing with their own body text. Fixed at the pair level instead of the token level.

## Summary

- The reference chart's ratios **do show up** in this codebase, concentrated in the `--fs-display*` three-step scale (Finding 1, exact Perfect Fourth + Perfect Fifth) and in a handful of title→subtitle pairs (Finding 3).
- The nicest, most textbook-consistent scale in the repo (Finding 0) is never actually used.
- The small-text cluster (Finding 2) isn't a scale at all — 11 sizes across 14px with no consistent ratio.
- Biggest fix for "does the heading relate to its description by a ratio": add one more step between display headlines (80-108px) and body captions (12-20px) in Hero, About, Work, CaseStudyLayout, Skills, and the 404 page — each of those currently skips straight from display to caption.
