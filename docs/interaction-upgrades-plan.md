# Interaction Upgrades — Work Reveal, /now Redesign, Nav Pattern Reuse, QuizBuzz Perf

Follow-up to `docs/animation-implementation-plan.md`. That doc covered the
first pass of scroll reveals, count-ups, and the scroll progress bar. This
doc covers four follow-on asks: the scroll engine decision, the "Selected
Work" pinned-horizontal redesign, the `/now` full-screen redesign, rolling
the nav's wave-text + tooltip pattern out site-wide, and fixing the jank on
`/work/quizbuzz`.

Read this first: every technique below reuses **GSAP + ScrollTrigger**,
already installed and already the site's animation engine. Nothing new
ships. Every scroll-driven effect stays wrapped in `gsap.matchMedia()`
gated on `(prefers-reduced-motion: no-preference)`, matching the existing
convention in `useScrollAnimation.ts`.

---

## 0. Scroll engine: stay on GSAP, don't add Locomotive

Short answer: **keep GSAP. Don't install Locomotive Scroll.** Nothing
changes about the current stack.

Why the Locomotive marketing site feels smoother isn't "Locomotive vs
GSAP" — it's not a fair comparison to begin with:

- **GSAP is not a scroll-smoothing library.** It's the animation/tween
  engine and orchestrator (`ScrollTrigger` maps scroll position to
  animation progress). It has never competed with Locomotive on "does
  scrolling itself feel smooth" — that's a separate concern from
  "do animations play smoothly."
- **Locomotive Scroll v5 (current release) is built on top of Lenis
  internally.** It's no longer an independent smooth-scroll architecture;
  it's Lenis with Locomotive's API on top. So "Locomotive felt smoother"
  really means "Lenis-style virtual scroll felt smoother," not that
  Locomotive has some engine advantage GSAP lacks.
- **The smooth feeling on their marketing site comes from a virtual-scroll
  layer** (intercepting the wheel/touch event, driving `transform` on a
  scroll container via `requestAnimationFrame` with easing, instead of
  letting the browser's native scroll happen) — not from their animation
  library. That's an orthogonal layer that sits on top of whatever tweens
  a site, GSAP included.

If a virtual-scroll layer is ever wanted on this site, the lowest-risk
option is **GSAP ScrollSmoother** (free since Webflow's 2025 acquisition
made all GSAP plugins free) — because it shares the exact same engine and
internal clock as `ScrollTrigger`, which this site already depends on.
Adding Lenis or Locomotive instead would mean two separate scroll-position
sources (Lenis' virtual scroll vs GSAP's `ScrollTrigger` reading native
scroll) that have to be explicitly wired together and kept in sync — a
real source of the exact jank we're trying to avoid, not a fix for it.

**Recommendation for now: add nothing.** None of the four features
requested below (pinned Work reveal, pinned `/now` panels, nav pattern
reuse, Mermaid/simulator fixes) need a virtual-scroll layer — they're all
`ScrollTrigger.pin()` problems, which GSAP already solves natively. Revisit
ScrollSmoother only if, after these ship, the native scroll still feels
insufficiently smooth on a specific device class — and even then, profile
first, because pinned sections are usually where virtual scroll causes
*more* visible tearing, not less, if it's not tuned carefully.

---

## 1. "Selected Work" — pinned horizontal reveal

### Current state (`src/components/sections/Work.tsx`, `ProjectCard.tsx`)

A horizontal `card-track` div with scroll-snap, prev/next `icon-btn`
arrows, and a `CardScrollbar`. Two projects exist today
(`src/content/projects.ts`: `quizbuzz`, `smartformflow`), so the design
must read well at 2 panels and scale cleanly past that.

### Target behavior (matching the reference video's pacing)

One project fills the viewport at a time. Vertical scroll inside the
section drives a horizontal slide: the current project slides off to the
left as the next slides in from the right, chained project-to-project,
until the last project releases the pin and normal vertical scroll
resumes into Skills.

### Implementation — pinned track, no new library

This is the standard GSAP horizontal-scroll pattern: pin the section,
translate an inner flex track on `xPercent` scrubbed to scroll progress.

```tsx
// Work.tsx — structure
<section ref={sectionRef} className="work-pin-wrap">
  <div ref={trackRef} className="work-track"> {/* flex row, one panel per project */}
    {projects.map((p) => (
      <div className="work-panel" key={p.id}>
        <ProjectPanel project={p} />
      </div>
    ))}
  </div>
  <div className="work-progress">01 / {String(projects.length).padStart(2, '0')}</div>
</section>
```

```css
.work-pin-wrap { position: relative; overflow: hidden; }
.work-track { display: flex; height: 100vh; will-change: transform; }
.work-panel { flex: 0 0 100vw; height: 100vh; }
```

```js
// inside the existing gsap.matchMedia() reduced-motion gate
const panels = gsap.utils.toArray<HTMLElement>('.work-panel')
const track = trackRef.current
if (panels.length > 1 && track) {
  const st = ScrollTrigger.create({
    trigger: sectionRef.current,
    start: 'top top',
    end: () => `+=${(panels.length - 1) * window.innerHeight * 1.1}`,
    pin: true,
    scrub: 1,
    snap: 1 / (panels.length - 1),
    onUpdate: (self) => {
      gsap.set(track, { xPercent: -100 * (panels.length - 1) * self.progress })
      setActiveIndex(Math.round(self.progress * (panels.length - 1)))
    },
    invalidateOnRefresh: true,
  })
  return () => st.kill()
}
```

Notes that keep this from becoming the next jitter source:

- **`xPercent` via `gsap.set`, never `left`/`margin-left`.** Transform-only
  keeps this on the compositor, same rule as everywhere else in the
  codebase.
- **`scrub: 1`** (not `true`) — a short catch-up smooths out the fast
  wheel deltas trackpads send without decoupling from scroll like a
  virtual-scroll layer would.
- **`invalidateOnRefresh: true`** — recomputes panel width/end distance on
  resize instead of caching stale pixel math, which is the usual cause of
  "horizontal pin snaps to the wrong project after resizing the window."
  This is the same class of bug the diagram gallery already guards against
  by re-measuring instead of caching.
- **2-project reality check:** with only 2 panels, `1 / (panels.length -
  1)` snap = 1 snap point (0 and 1) — effectively a single slide, which is
  the correct degenerate case. Don't special-case it; the math already
  handles it.
- **The `work-progress` "01 / 02" indicator** is a cheap, high-value detail
  straight out of the reference video's pacing cues — update it from the
  same `onUpdate` via `activeIndex` state, styled in `--font-suisseintlmono`
  per the type system (`tokens.json` → `font.suisseintlmono`, the
  existing convention for kickers/status chips).
- **Reduced motion fallback:** outside the `matchMedia` gate, render the
  panels in a normal vertical stack (or keep today's horizontal-scroll
  card track) — never leave a `prefers-reduced-motion` user pinned with no
  escape.
- **Mobile:** pin-and-scrub horizontal reveals read badly on touch
  (scrub friction feels laggy under a finger, and pin fights momentum
  scrolling). Gate this whole pattern behind a `(min-width: 900px)` media
  query inside the same `matchMedia()` call; below that, keep the existing
  scroll-snap card track — it already works well on touch.

---

## 2. `/now` — full-screen scroll-driven panels

### Current state (`src/app/now/page.tsx`, `src/content/now.ts`)

`/now` already exists as a dedicated route (not something to newly
create): a dark hero, a 2-column grid (status aside + 3 content cards),
then a "current stack" tag strip. Content today: `nowData = { building,
learning, status }` — 3 plain strings — plus 3 hardcoded content cards
(SmartFormFlow, Distributed Systems, Open to Roles).

### Target behavior

Same technique as the Work reveal, but **vertical** panels instead of
horizontal — each status item (Building / Learning / Status / Studying,
plus the 3 content cards) takes the full viewport, scroll drives a
vertical slide/mask transition to the next, one item visible at a time.

### Implementation

Vertical pin is the same primitive with `yPercent` instead of `xPercent`,
and reads better here because "one thing at a time, stacked in time" is
literally how a changelog/status page is structured — vertical panels
match that semantics better than horizontal ones would.

```css
.now-pin-wrap { position: relative; overflow: hidden; }
.now-track { height: 100vh; will-change: transform; }
.now-panel { height: 100vh; display: flex; align-items: center; }
```

```js
const st = ScrollTrigger.create({
  trigger: nowWrapRef.current,
  start: 'top top',
  end: () => `+=${(panelCount - 1) * window.innerHeight * 1.2}`,
  pin: true,
  scrub: 1,
  snap: 1 / (panelCount - 1),
  onUpdate: (self) => gsap.set(trackRef.current, {
    yPercent: -100 * (panelCount - 1) * self.progress,
  }),
})
```

Design differences from the Work reveal, on purpose:

- **Each panel keeps its own internal reveal** (heading via `ScrollFloat`,
  the value/label pair fading up) timed to fire once the panel crosses
  ~30% into view within the pin range — a `ScrollTrigger` nested on
  `containerAnimation: st.animation` so the child reveal rides the same
  scrubbed timeline instead of fighting it with an independent scroll
  listener. This is what makes it feel like "one thing enters, settles,
  then the next" rather than a mechanical slide.
- **A left-edge progress rail** (small tick marks, one per panel, current
  one filled) gives the same "where am I in the sequence" cue as the Work
  section's "01/02" counter, adapted to a longer list (up to 7 panels:
  4 status rows + 3 content cards).
- **Content data stays exactly as-is** (`src/content/now.ts`) — this is a
  layout/motion change, not a content rewrite. `nowData.building` /
  `.learning` / `.status` map 1:1 to the first 3 panels; a 4th
  "studying" panel and the 3 existing content cards fill the rest.
- **Reduced motion / mobile:** identical fallback rule as Work — outside
  `matchMedia`, and below `(min-width: 900px)`, render today's 2-column
  grid layout unchanged. `/now` is a page people may link directly to and
  read on a phone; it should never be pin-locked on small screens.

---

## 3. Reusable "wave-text + tooltip" affordance

### Current implementation (`src/components/nav/Nav.tsx`)

The nav already has the full pattern, just not extracted: `WaveText` for
the per-letter hover wave, plus a bespoke tooltip mechanism (`TipState`,
`tip`/`setTip`, `showTip`/`hideTip`, positioned relative to `navRef`,
rendered as an `AnimatePresence` + `motion.span` pill with a CSS-triangle
notch) keyed off each `navLinks[i].tip` description string.

### Extraction plan

Pull the tooltip half into a standalone `<HoverTip>` component (the
`WaveText` component is already standalone) so the pairing becomes a
2-line drop-in anywhere in the site:

```tsx
// src/components/ui/HoverTip.tsx — new file
type HoverTipProps = {
  label: string
  tip: string
  className?: string
}

export function HoverTip({ label, tip, className }: HoverTipProps) {
  const [show, setShow] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  return (
    <span
      ref={ref}
      className={className}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      <WaveText text={label} />
      <AnimatePresence>
        {show && <TipBubble anchorRef={ref} text={tip} />}
      </AnimatePresence>
    </span>
  )
}
```

`TipBubble` is the existing `motion.span` pill + notch markup lifted
verbatim out of `Nav.tsx`, generalized to position off whatever `anchorRef`
it's given instead of the hardcoded `navRef`. Nav.tsx then becomes a
consumer of `<HoverTip>` instead of owning the mechanism — net negative
lines of code in Nav.tsx, and every future reuse is 2 props.

**Keyboard/touch parity, not optional:** the nav's own tooltip already
needs `onFocus`/`onBlur` for keyboard users (tab-focusing a nav link
should surface the same tip a mouse hover does) — verify this exists in
the current Nav implementation and carry it into the extracted component
if it's missing. On touch, a tooltip that only fires on hover simply never
appears; treat the tip text as progressive enhancement (the label alone
must stand on its own without it) rather than adding tap-to-show, which
fights the primary tap-to-activate gesture on a nav link or tag.

### Reuse sites (small-detail affordance, not everywhere)

Apply where a short label already has a natural one-line description
worth surfacing, matching the nav's own bar for "worth a tooltip":

1. **Skill tags** (Skills section) — tag = tech name, tip = one-line
   "where/how it's used" (e.g. "Prisma" → "schema + migrations for every
   service").
2. **Project stack tags** (`ProjectCard`, and the new Work panels) — tag =
   tech name, tip = the specific role it played in that project.
3. **Footer link columns** — tip = a one-line expansion for terser labels
   like "Now" → "what I'm building this month."
4. **CTA tile icons** (`CtaTiles`) — tip = the action's outcome ("Book a
   call" → "15 min, no pitch").
5. **`/now` status rail ticks** (from §2) — tip = the panel's heading, so
   the rail doubles as a mini table of contents on hover.

Skip it anywhere a tooltip would just restate visible text (e.g. a button
whose full label is already on-screen) — the nav's own tips work because
the label is short and the tip adds real information; don't roll it out
by rote.

---

## 4. `/work/quizbuzz` — fixing the two jank sources

### 4a. Diagram gallery ("section six") — convert Mermaid to build-time SVG

**Diagnosis, not assumption** — the current pipeline
(`src/lib/mermaidRender.ts`, `ArchDiagram.tsx`, `DiagramGallery.tsx`) is
already fairly sophisticated: shared render cache + dedup (`svgCache`,
`pending` maps), a sequential idle-scheduled render queue
(`requestIdleCallback` with a `setTimeout` fallback), and
IntersectionObserver-gated rendering (800px `rootMargin`) so off-screen
diagrams don't render at all. This isn't naive — but it has two real gaps:

- **Safari has no `requestIdleCallback` at all**, so the `setTimeout`
  fallback path gets zero idle protection — every diagram render on
  Safari competes directly with scroll/paint on the main thread, no
  scheduling gap to hide it in.
  - Even on browsers that do support it, the `timeout` param in the
    current idle-schedule config **forces** the render to run once that
    timeout elapses, even under constant main-thread activity — meaning
    "idle-scheduled" quietly degrades to "scheduled no matter what" under
    exactly the busy-scroll conditions we're trying to protect against.
- **The fundamental cost is unavoidable client-side**: `mermaid.render()`
  parses a text spec and lays out a diagram at runtime — several hundred
  ms per diagram is mermaid's own layout engine doing real work, not a
  scheduling bug. No amount of scheduling removes that cost; it only
  moves *when* it's paid. With 5 diagrams in one gallery, "when" keeps
  landing during scroll.

**Fix: pre-render at build time, ship static SVG.** The diagrams are
static content — same 5 charts, same layout, every load, for every user.
There's no reason to pay Mermaid's runtime layout cost per-visitor when
it's fully deterministic per-build.

Implementation shape:

1. Move the 5 Mermaid chart definitions for QuizBuzz out of the inline
   template literals in `page.tsx` into a small build-time script (a
   Node script using the `mermaid` package's Node/Puppeteer-free CLI —
   `@mermaid-js/mermaid-cli` (`mmdc`) — or the `mermaid.render()` API run
   under Node with a headless DOM shim) that emits one `.svg` file per
   diagram into `public/diagrams/quizbuzz/` (or co-located under
   `src/content/`) at build time / on content change, not on every
   request.
2. Replace `<ArchDiagram chart="...">`'s runtime-render path with a
   static `<img src="/diagrams/quizbuzz/infra.svg">` (or inline the SVG
   markup directly via a build-time import, which avoids an extra HTTP
   request and still lets CSS theme the strokes/fills if the SVG uses
   `currentColor` where mermaid's theme config allows it).
3. Keep `DiagramGallery.tsx`'s carousel/expand/keyboard-nav UI exactly as
   is — that part isn't the jank source and doesn't need to change; only
   the "how does a diagram's pixels get produced" step moves from
   request-time to build-time.
4. Delete `mermaidRender.ts`'s runtime queue/cache once nothing calls
   `mermaid.render()` in the browser anymore, and drop the `mermaid`
   package from the client bundle (move it to a `devDependency` used only
   by the build script) — this also shrinks the shipped JS, a second win
   beyond removing the layout jank.

This is a real migration (new build step, regenerate on any diagram-text
change), not a one-line fix — worth scoping as its own small task before
touching the simulator below.

### 4b. "Take the Controls" infrastructure simulator — jitter

`InfraScaleSimulator.tsx` (1563 lines) already has documented prior
optimization work: an IntersectionObserver gates the `requestAnimationFrame`
loop so it doesn't run off-screen, `document.hidden`/`visibilitychange` is
handled, and scroll progress is read from a cached value (`cachedP`)
updated via a separate `onScroll` → rAF `measureScroll`, explicitly
replacing an earlier anti-pattern of calling `getBoundingClientRect()`
every frame. DOM/state writes (`setText`/`setAttribute`, `setBeatIdx`,
`setNotice`) are guarded, not unconditional.

Given that groundwork is already in place, the remaining jitter is most
likely one of these two — both need a profile before a fix, not a guess:

1. **DOM attribute-write volume per frame at the simulator's higher scale
   settings** — if the rAF loop is writing many `setAttribute` calls
   (positions/opacities across many simulated nodes) every frame rather
   than batching them into a single `requestAnimationFrame`-scheduled
   write, that's a classic cause of scroll-coupled jank: the browser's
   compositor is fighting layout/paint work that a `transform`+`opacity`-
   only, batched-write approach would avoid entirely.
2. **React re-renders competing with the imperative SVG writes on the same
   frame** — `setBeatIdx`/`setNotice` are React state, which schedules a
   re-render; if that re-render's commit lands on the same frame as a
   heavy batch of direct SVG attribute writes, the two compete for the
   same paint budget. Moving any per-frame-changing value that doesn't
   need to trigger a React re-render (e.g. a purely visual counter) into
   a ref + direct DOM write, and reserving `setState` only for values that
   actually change rendered JSX structure (not just text/attribute
   values), would remove that contention.

**Recommended next step before changing code:** profile one scroll pass
through the simulator in Chrome DevTools Performance panel (record while
scrolling through the `#scale` section), and look specifically at: (a)
whether Scripting time per frame spikes during the simulator vs. before/
after it, (b) how many `setAttribute`/style writes happen per animation
frame, and (c) whether "Recalculate Style" or "Layout" (not just
"Paint")shows up in the flame chart — that would confirm the DOM-write
volume hypothesis over the React-re-render one, and points the fix at
batching writes vs. trimming state. This is the kind of targeted profiling
pass worth doing as its own follow-up task rather than guessing at a fix
for 1500+ lines of simulator logic sight-unseen.

---

## Build order

| Order | Item | Why here |
|---|---|---|
| 1 | Mermaid → static SVG (§4a) | Isolated, mechanical, highest-confidence win, unblocks profiling the simulator cleanly (removes one confound) |
| 2 | Profile + fix InfraScaleSimulator (§4b) | Needs the above done first so the profile isn't muddied by Mermaid renders |
| 3 | Extract HoverTip component (§3) | Small, no visual redesign risk, unlocks reuse sites 1-5 |
| 4 | Selected Work pinned reveal (§1) | Biggest visual/UX change on the homepage — do after the low-risk items land |
| 5 | `/now` pinned panels (§2) | Reuses the exact pattern proven in §1; do second so any pin/scrub issues are already solved once |

## QA checklist (same bar as the first plan)

- Every new pin/scrub block wrapped in `gsap.matchMedia()`, reduced-motion
  fallback verified with OS-level "Reduce Motion" on.
- Work + /now pinned patterns gated to `(min-width: 900px)`; verify the
  fallback layouts on an actual phone, not just DevTools device mode.
- `invalidateOnRefresh: true` on both new pins; resize the window mid-scroll
  and confirm the pin range recalculates instead of desyncing.
- Lighthouse/Performance panel pass on `/work/quizbuzz` before and after
  the Mermaid migration — confirm Scripting time drops during the
  architecture section scroll.
- Tab through the new HoverTip reuse sites with a keyboard only — tips
  must appear on focus, not just hover.
