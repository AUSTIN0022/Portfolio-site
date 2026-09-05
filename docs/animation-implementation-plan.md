# Animation & Motion Implementation Plan

**Scope:** the 8 core homepage sections (Hero, Stats Strip, About, Selected Work, Skills, Now, CTA Tiles, Footer), matching DESIGN.md's section blueprint. Nav, DomainMarquee, Principles, Statement and the /work case-study pages already have solid GSAP/ScrollFloat coverage and are out of scope here.

**Stack (already installed, do not add anything new):** `gsap` + `ScrollTrigger`, `framer-motion`, `@react-three/fiber`/`drei`/`three` (kept only for the lazy-loaded paintball easter egg — do not pull R3F into any of the 8 sections below). No smooth-scroll library (Lenis/Locomotive) is installed or needed — see Rule 5.

---

## 0. Read this first — a likely false negative

Before building anything: `useScrollAnimation()` is already called in `page.tsx`, every section already carries `data-gsap="heading" | "card" | "stat" | "tags"` markers, and `globals.css` already has a global `prefers-reduced-motion: reduce` block that zeroes every animation/transition duration site-wide. If the screen recording you compared against the reference video showed *zero* motion — text just appearing, nothing fading or sliding — the most likely explanation isn't "nothing is built," it's that **macOS Accessibility → Display → Reduce Motion was ON** on the recording device. That setting silently disables `gsap.matchMedia('(prefers-reduced-motion: no-preference)')` blocks (which is most of the reveal system) and forces the global CSS override. Check that setting first — it would save you from re-building work that already exists.

What's already live and should be left alone:
- Scroll-triggered fade+slide reveals on every section (`useScrollAnimation.ts`), staggered per card group, with `clearProps` cleanup so inline GSAP styles don't fight the CSS hover states afterward.
- `ScrollFloat` — a per-character scroll-scrubbed mask reveal (blur/scale/mask-in), already used on `/work`, `/now`, and case-study pages, gated behind an `IntersectionObserver` so it doesn't even initialize GSAP until the element is near-viewport.
- `CurvedRise` — a scroll-linked panel transition between sections (rounded top corners closing in, panel rising over the section above), built on Framer Motion `useScroll`/`useTransform`, animating only `margin`/`border-radius` on a single wrapper per section — cheap.
- Hover feedback: `.btn-sketch` (offset shadow), `.card-elevated` (lift + shadow), `.icon-btn` (translate + shadow + active-state squash), `.cta-tile-fill` (diagonal fill sweep on the Book a Call / View Resume tiles), Skills tile icons (`whileHover={{ scale: 1.05 }}`).
- Hero's isometric diagram already does a cursor-driven parallax tilt via Framer Motion springs — this is the "3D hero" from an earlier design pass; `git log` shows Three.js was deliberately removed from the hero for performance (`83e2a5f Removed Three.js WebGL Engine`). Do not reintroduce a WebGL canvas there.

So this plan below is additive polish on top of a real foundation, not a from-scratch build.

---

## Non-negotiable performance rules

Apply these to every addition below, no exceptions:

1. **Animate only `transform` and `opacity`.** Never animate `top`/`left`/`width`/`height`/`margin` in a loop or on scroll for more than one element at a time — those force layout recalculation every frame. `CurvedRise` is the one sanctioned exception (a single wrapper per section, not a repeated element).
2. **Gate every new GSAP tween behind `prefers-reduced-motion`** using the exact `gsap.matchMedia()` pattern already in `useScrollAnimation.ts` — an `mm.add('(prefers-reduced-motion: no-preference)', …)` block for the animated version, and either nothing (CSS fallback handles it) or an explicit `mm.add('(prefers-reduced-motion: reduce)', …)` that sets the end-state instantly.
3. **One-shot vs scrub, pick deliberately.** Reveals that should fire once (`toggleActions` default, or `once: true`) are cheap — they run, finish, and GSAP tears the ticker down. Scrub animations (`scrub: 0.5`, used in `ScrollFloat`) recompute every scroll frame for as long as the element is in range — fine for a handful of headline elements, wrong for anything repeated 10+ times on the page.
4. **Don't add per-item `ScrollTrigger` instances past ~8–10 items.** The current per-card stagger (`cardGroups` in `useScrollAnimation.ts`) creates one `ScrollTrigger` per element, which is fine at today's counts (2–4 cards per group). If a section ever grows past ~10 repeated items, switch that group to `ScrollTrigger.batch()` instead of one instance each.
5. **Do not add Lenis, Locomotive Scroll, or any scroll-hijacking library.** They re-implement scroll physics on top of native scroll and have to be manually bridged into GSAP's ticker (`gsap.ticker.add`) or every `ScrollTrigger` desyncs from the visible scroll position — this is the single most common cause of "the animations are there but scrolling feels laggy/rubber-bandy." The existing native-scroll + `CurvedRise` approach already reads as smooth. If you want GSAP-native buttery scroll later, `ScrollSmoother` (part of GSAP core since it went fully free) is the only smooth-scroll tool worth evaluating, because it's built to stay in sync with `ScrollTrigger` — treat it as optional, not part of this plan.
6. **Cap `devicePixelRatio`** on any canvas (`GunViewer` already does `dpr={[1, 1.5]}` — keep that pattern if any future 3D element is added; don't add a new one for this plan).
7. **Test after every section, not at the end:** Chrome DevTools → Performance panel, 4x CPU throttle, scroll through the whole page, confirm no long tasks (>50ms) and no forced layout warnings. Toggle `prefers-reduced-motion` in DevTools' Rendering tab and re-scroll — every animated element must resolve to its final, fully-visible state with no permanently-hidden content.

---

## Section-by-section plan

### 1. Hero
**Current:** cursor-parallax tilt on the diagram image (Framer Motion springs), badge fade-ins, floating y-loop, headline already char-split for the paintball shoot easter egg (`data-shoot-target`/`data-shoot-granularity="char"`), row-level fade-up via `data-gsap="heading"`.
**Add:** a kinetic entrance on the two big headlines (AUSTIN MAKASARE / FULL STACK ENGINEER) — blur-in + rise per character on first load, once, not scroll-scrubbed (it's above the fold, visible immediately).
**How:** the headline is already split into character spans for the shoot mechanic — reuse those spans for the entrance animation instead of introducing `ScrollFloat`'s own splitter on top (double-wrapping the same text in two independent char-split systems is exactly the kind of thing that causes silent visual bugs). Find wherever the shoot char-split happens (search for `data-shoot-granularity` consumers) and add a one-time `gsap.from(spans, { yPercent: 110, opacity: 0, stagger: 0.02, duration: 0.6, ease: 'power3.out' })` gated by the same `matchMedia` pattern, fired on mount (not on scroll — this is above the fold).
**Perf:** one-shot, ~15–20 spans total across both headlines, runs once on load — negligible cost either way.

### 2. Stats Strip
**Current:** `data-gsap="stat"` fade+slide only. The numbers (7.5K / 100% / 2YR) render as static text.
**Add:** count-up animation on the numeric portion when the strip scrolls into view — this is the single highest-leverage, lowest-effort "premium" signal missing right now.
**How:** new hook `src/hooks/useCountUp.ts` (sketch below), applied per stat with its numeric value and suffix (7.5/"K", 100/"%", 2/"YR").
**Perf:** one `ScrollTrigger` per stat (3 total, `once: true`), driving a plain JS number via `gsap.to({val:0}, {val: target, onUpdate})` — no DOM thrash, just a text-content update ~60 times over ~1.4s.

```ts
// src/hooks/useCountUp.ts
'use client'
import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

if (typeof window !== 'undefined') gsap.registerPlugin(ScrollTrigger)

export function useCountUp(target: number, opts: { decimals?: number; suffix?: string } = {}) {
  const { decimals = 0, suffix = '' } = opts
  const ref = useRef<HTMLDivElement>(null)
  const [display, setDisplay] = useState((0).toFixed(decimals) + suffix)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const mm = gsap.matchMedia()

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const obj = { val: 0 }
      gsap.to(obj, {
        val: target,
        duration: 1.4,
        ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 85%', once: true },
        onUpdate: () => setDisplay(obj.val.toFixed(decimals) + suffix),
      })
    })
    mm.add('(prefers-reduced-motion: reduce)', () => {
      setDisplay(target.toFixed(decimals) + suffix)
    })

    return () => mm.revert()
  }, [target, decimals, suffix])

  return { ref, display }
}
```
Usage in `StatsStrip.tsx` replaces the static `stat.number` with `const { ref, display } = useCountUp(7.5, { decimals: 1, suffix: 'K' })` (etc. per stat), spreading `ref` onto the existing `data-gsap="stat"` div and rendering `display` instead of the hardcoded string.

### 3. About
**Current:** heading fade-up, skill tags stagger-in (`data-gsap="tags"`) — already good.
**Add:** nothing structural. Optional: apply the existing `ScrollFloat` component to just the "BUILDING THINGS THAT DON'T BREAK." headline for a stronger kinetic moment, matching the treatment on `/work` and `/now`.
**Perf:** trivial — one short headline, `ScrollFloat` already IntersectionObserver-gated.

### 4. Selected Work (project cards)
**Current:** horizontal scroll-snap card track, custom drag scrollbar (`CardScrollbar`), prev/next `icon-btn` arrows with translate+shadow hover, `card-elevated` lift-on-hover, per-card stagger reveal.
**Add:** nothing structural — this section is already the most complete. Optional polish: a subtle `scale: 1.03` on the card's image/visual area on hover (separate from the card's own lift) to add depth, using Framer Motion `whileHover` the same way `Skills.tsx` already does it on its icons — reuse the pattern, don't invent a new one.
**Perf:** `whileHover` only runs on actual hover, zero idle cost.

### 5. Skills
**Current:** floating idle animation + `whileHover={{ scale: 1.05 }}` on icons, card stagger-in — already good.
**Add:** nothing. Leave as-is.

### 6. Now
**Current:** row-by-row stagger reveal (`data-gsap="card"`).
**Add:** a hover state on each row (subtle background tint or left-border accent on `:hover`) so the section isn't purely static once revealed — cheap CSS-only addition (`background-color` transition, or better, `transform: translateX(4px)` to stay on the GPU-safe list), mirroring the existing `.icon-btn`/`.card-elevated` hover language rather than a new visual idiom.
**Perf:** pure CSS `:hover`, zero JS.

### 7. CTA Tiles
**Current:** diagonal fill sweep on hover (`.cta-tile-fill`), card stagger reveal — already good and already matches the "premium" diagonal-cut interaction pattern.
**Add:** nothing structural.

### 8. Footer
**Current:** heading fade-up only; the four link columns and the giant closing wordmark ("AUSTIN") render statically once revealed.
**Add:** stagger the four link columns in together with the rest of the footer (wrap them in `data-gsap-group` with each column carrying `data-gsap="card"`, matching the exact pattern `Skills.tsx` and `Now.tsx` already use — no new code needed in `useScrollAnimation.ts`, just new `data-*` attributes in `Footer.tsx`). Optionally give the large closing wordmark the same `ScrollFloat` treatment used elsewhere for a strong closing beat.
**Perf:** 4 elements, one-shot stagger — negligible.

---

## New shared utility: scroll progress indicator

Not tied to any single section — a thin progress bar pinned to the top of the viewport is the cheapest "this feels engineered" signal a page can add, and it's what a small circular tracker plays the same role for in the reference video you compared against.

```tsx
// src/components/ui/ScrollProgress.tsx
'use client'
import { motion, useScroll, useSpring } from 'framer-motion'

export function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 200, damping: 30, restDelta: 0.001 })

  return (
    <motion.div
      aria-hidden
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '2px',
        background: 'var(--color-electric-yellow, var(--color-fg))',
        transformOrigin: '0%',
        scaleX,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    />
  )
}
```
Mount once in `page.tsx` alongside `<Nav />`. Cost: one element, one `transform: scaleX` update per frame while scrolling, driven by Framer Motion's own rAF scheduler (passive, GPU-composited) — this is as cheap as scroll-linked animation gets.

---

## Build order (do in this sequence)

| # | Task | Effort | Depends on |
|---|------|--------|------------|
| 1 | Verify Reduce Motion is off on your test device; re-record if it was on | 5 min | — |
| 2 | `useCountUp` hook + wire into Stats Strip | 30–45 min | — |
| 3 | `ScrollProgress` component, mount in `page.tsx` | 15 min | — |
| 4 | Footer: `data-gsap-group`/`data-gsap="card"` on link columns | 10 min | — |
| 5 | Now: hover state per row | 10 min | — |
| 6 | Hero: reuse shoot char-spans for one-shot entrance animation | 45–60 min | Locate shoot char-split code first |
| 7 | About + Footer wordmark: apply existing `ScrollFloat` to headline | 15 min | — |
| 8 | Work: `whileHover` scale on card visuals | 15 min | — |
| 9 | Full-page performance pass (see QA below) | 30 min | Everything above |

Total: roughly half a day of focused work, almost all of it wiring existing infrastructure into two sections that are currently under-animated (Stats Strip, Footer) rather than building new systems.

---

## QA checklist before calling it done

- Chrome DevTools → Performance → record a full scroll from top to bottom with 4x CPU throttle. No task should exceed 50ms; no "Forced reflow" warnings in the console.
- DevTools → Rendering → "Emulate CSS media feature prefers-reduced-motion: reduce" → reload and re-scroll. Every element must appear at full opacity/final position immediately — nothing should be stuck invisible.
- Lighthouse (mobile, throttled) before and after — Performance score should not regress; a scroll-progress bar and a count-up hook should cost effectively 0 points.
- Real device test on a mid-range Android or an older iPhone if you have access — simulator/desktop throttling doesn't always catch real scroll jank.
- Confirm macOS "Reduce Motion" is OFF when recording any future demo video of the site, so the built animation system actually shows up on camera.
