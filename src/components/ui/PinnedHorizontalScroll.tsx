'use client'

import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
}

export type PanelMeta = {
  /** true once this panel is the "settled" one. */
  isActive: boolean
  /** 0-1, this panel's own local reveal progress. Coarse (updates only when
   * `isActive` changes, not every scrub tick) — a per-frame value here would
   * mean a React re-render on every scroll tick, which is the performance
   * foot-gun this rewrite exists to remove. The reveal/blur/progress-bar
   * effects themselves are driven directly on the DOM by GSAP, never through
   * React state. */
  progress: number
  /** Last measured scroll velocity (px/s) at the time this panel became
   * active. Same coarseness caveat as `progress`. */
  velocity: number
}

export type PinnedScrollOptions = {
  /** Fraction of each panel's scroll allotment spent "settled" vs
   * "transitioning". Default 0.65. */
  holdRatio?: number
  /** Extra scroll distance after the last panel before unpinning, as a
   * percentage of one panel's pinned distance. Default 20. */
  pinBufferVh?: number
  /** GSAP ease string for panel-to-panel tweens. Default 'power2.inOut'. */
  ease?: string
  /** Scrub smoothing. Default 0.6. */
  scrub?: number | boolean
  /** Per-panel bottom-up mask reveal on the panel's `[data-panel-media]`
   * element. Default true. */
  enableImageReveal?: boolean
  /** Directional blur on the active panel's `[data-panel-headline]` element
   * during fast transitions. Default true. */
  enableVelocityBlur?: boolean
  /** What to render instead of the pin/scrub engine for
   * prefers-reduced-motion users. Default 'stack'. */
  reducedMotionFallback?: 'stack' | 'fade' | 'disable'
  /** Below this width the pin/scrub engine never engages regardless of
   * motion preference. Default 900. Mirrored exactly by the `.phs-wrap` /
   * `.phs-fallback` media query in globals.css — change one, change both. */
  minWidth?: number
}

type PinnedHorizontalScrollProps<T> = {
  items: T[]
  renderPanel: (item: T, index: number, meta: PanelMeta) => React.ReactNode
  renderHud?: (progress: number, activeIndex: number, total: number) => React.ReactNode
  options?: PinnedScrollOptions
}

const DEFAULTS = {
  holdRatio: 0.65,
  pinBufferVh: 20,
  ease: 'power2.inOut',
  scrub: 0.6,
  enableImageReveal: true,
  enableVelocityBlur: true,
  reducedMotionFallback: 'stack' as const,
  minWidth: 900,
}

// The default HUD's fill bar carries `data-phs-progress-fill` so the engine
// can scrub it directly on the DOM (see the onUpdate handler below) — same
// convention as `data-panel-media` / `data-panel-headline`. A *custom*
// `renderHud` that wants the smooth per-frame fill should add the same
// attribute to its own bar; without it, that bar simply won't animate
// (no error, just static), which is why DefaultHud always includes it.
function DefaultHud({ activeIndex, total }: { activeIndex: number; total: number }) {
  return (
    <>
      <div className="phs-progress-track" aria-hidden>
        <div className="phs-progress-fill" data-phs-progress-fill aria-hidden />
      </div>
      <div className="phs-counter tabular-nums" aria-hidden>
        {String(activeIndex + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
      </div>
    </>
  )
}

function FallbackPanels<T>({
  items,
  renderPanel,
  mode,
}: {
  items: T[]
  renderPanel: PinnedHorizontalScrollProps<T>['renderPanel']
  mode: 'stack' | 'fade' | 'disable'
}) {
  const wrapRef = useRef<HTMLDivElement>(null)

  // 'fade': a plain IntersectionObserver + CSS opacity transition — not
  // GSAP, this fallback path is specifically for reduced-motion/narrow
  // viewports, so it stays independent of the pin engine entirely rather
  // than sharing ScrollTrigger instances with it.
  useEffect(() => {
    if (mode !== 'fade') return
    const els = wrapRef.current?.querySelectorAll<HTMLElement>('.phs-fallback-panel')
    if (!els?.length) return
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('phs-visible')
        })
      },
      { threshold: 0.2 }
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [mode])

  if (mode === 'disable') {
    return (
      <div className="phs-fallback-disable">
        {items.map((item, i) => (
          <div key={i} className="phs-fallback-disable-panel">
            {renderPanel(item, i, { isActive: true, progress: 1, velocity: 0 })}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div ref={wrapRef} className="phs-fallback-stack">
      {items.map((item, i) => (
        <div
          key={i}
          className={mode === 'fade' ? 'phs-fallback-panel phs-fade' : 'phs-fallback-panel'}
          // 'stack' reuses the site's existing generic scroll-reveal
          // convention (useScrollAnimation.ts's [data-gsap="card"] handler)
          // instead of a bespoke one — it's the true zero-added-motion
          // fallback for prefers-reduced-motion, and that hook already
          // no-ops under reduced motion, so this stays correct either way.
          data-gsap={mode === 'stack' ? 'card' : undefined}
        >
          {renderPanel(item, i, { isActive: true, progress: 1, velocity: 0 })}
        </div>
      ))}
    </div>
  )
}

/**
 * Generic pinned vertical→horizontal scroll effect. Pins its wrapper, then
 * converts continued vertical scroll into a horizontal drag of an inner
 * track: each panel holds still for `holdRatio` of its scroll allotment,
 * then a quick eased slide moves to the next one. The wrapper owns the pin,
 * scrub, track, and HUD slot — it has no opinion on what a panel contains;
 * `renderPanel` supplies that entirely.
 *
 * Rewritten from scratch to fix five concrete bugs found in the previous
 * version:
 *   1. The pin's scroll distance was computed from `window.innerWidth`.
 *      `end: "+=N"` on a plain (non-horizontal) ScrollTrigger always measures
 *      the page's real, *vertical* scroll axis — the one the user is
 *      actually scrolling on — never the width of the thing being dragged
 *      sideways. On a wide-but-short laptop screen this mis-sized every
 *      hold/snap segment badly enough to look like the pin never engaged.
 *   2. `setProgress(self.progress)` ran on *every* scrub tick, i.e. a React
 *      re-render on every animation frame while scrolling — the exact
 *      performance foot-gun this component's own `PanelMeta.progress` doc
 *      comment warned against, and the actual cause of the reported jitter.
 *      The progress bar is now scrubbed directly on the DOM
 *      (`data-phs-progress-fill`), never through React state.
 *   3. The hold/snap timeline was built from sequential relative tweens
 *      (including empty-object tweens purely to consume time) chained with
 *      `"<"` position parameters. Correct GSAP, but easy to get subtly
 *      wrong and hard to verify. It's rebuilt below with explicit absolute
 *      time positions per segment, so total timeline duration is always
 *      exactly `items.length - 1` and maps 1:1 to scroll progress.
 *   4. THE ACTUAL CAUSE of "pin doesn't hold / blank screen / jumps straight
 *      to the next panel": on this site every section (including this one)
 *      is wrapped by <CurvedRise>, which applies its own scroll-linked
 *      `scale` transform (0.82 → 1) to an ANCESTOR of `.phs-wrap` via
 *      framer-motion. ScrollTrigger has to fall back to `pinType: "transform"`
 *      under a transformed ancestor (a `position: fixed` element's containing
 *      block becomes that ancestor per the CSS spec, not the viewport), and
 *      that mode bakes in the ancestor's transform *at the moment ScrollTrigger
 *      measures/refreshes* to convert scroll pixels into the compensating
 *      local translate it applies each frame. This component's own initial
 *      `ScrollTrigger.refresh()` (below, once images finish loading) fires
 *      right after mount — while CurvedRise's wrapper is still sitting at its
 *      *starting* scale (0.82), well before the user has scrolled it to its
 *      resting scale (1). Once CurvedRise later settles mid-scroll, GSAP's
 *      cached compensation no longer matches the ancestor's real transform,
 *      so the pin's per-frame correction stops actually cancelling the page's
 *      scroll — `.phs-wrap` just drifts up the screen with normal scroll
 *      (measured live: its `top` tracked scroll 1:1 instead of staying at 0),
 *      scrolls out of view (the "blank screen"), and by the time it's back in
 *      frame the scrub has already run past the transition (the "second
 *      project is seen directly"). The fix below watches that ancestor chain
 *      for the style mutations framer-motion writes on every frame of its
 *      scale animation and, once they stop (debounced — CurvedRise is done
 *      settling, not just between two frames of it), issues exactly one more
 *      `ScrollTrigger.refresh()` so the pin's measurements are taken against
 *      CurvedRise's final, resting transform instead of its initial one.
 *   5. That bug #4 watcher could itself still fire a `ScrollTrigger.refresh()`
 *      while THIS pin was actively engaged — CurvedRise's reveal transform
 *      can still be mid-animation right as the pin's `start` is crossed, so
 *      the debounced refresh landed inside the hold phase, rebuilt the pin's
 *      geometry against a DOM that already had the pin-spacer inserted and
 *      the track translated, and visibly snapped. That's what showed up as
 *      the first panel "jittering"/"juggling" instead of holding still. The
 *      refresh now checks `tl.scrollTrigger.isActive` and, if the pin is
 *      live, defers itself instead of firing mid-pin.
 */
export function PinnedHorizontalScroll<T>({ items, renderPanel, renderHud, options }: PinnedHorizontalScrollProps<T>) {
  const opts = { ...DEFAULTS, ...options }
  const wrapRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    const wrap = wrapRef.current
    const track = trackRef.current
    if (!wrap || !track || items.length < 2) return

    // Defensive: if a previous instance's ScrollTrigger on this exact
    // element is somehow still alive (e.g. a dev hot-reload that didn't
    // finish tearing down), kill it before building a new one rather than
    // stacking two pins on the same trigger.
    ScrollTrigger.getAll().forEach((st) => {
      if (st.trigger === wrap) st.kill()
    })

    const panels = gsap.utils.toArray<HTMLElement>('.phs-panel', track)
    const mediaEls = panels.map((p) => p.querySelector<HTMLElement>('[data-panel-media]'))
    const headlineEls = panels.map((p) => p.querySelector<HTMLElement>('[data-panel-headline]'))
    const progressFillEls = wrap.querySelectorAll<HTMLElement>('[data-phs-progress-fill]')

    // Off-screen panels stay readable to screen readers (DOM order is
    // untouched) but shouldn't be reachable by Tab while translated out of
    // view.
    const interactiveEls = panels.map((p) => Array.from(p.querySelectorAll<HTMLElement>('a, button')))
    const setTabbable = (idx: number) => {
      interactiveEls.forEach((els, i) => els.forEach((el) => { el.tabIndex = i === idx ? 0 : -1 }))
    }
    setTabbable(0)

    if (opts.enableImageReveal) {
      gsap.set(mediaEls.filter(Boolean) as HTMLElement[], { clipPath: 'inset(100% 0 0 0)' })
      if (mediaEls[0]) gsap.set(mediaEls[0], { clipPath: 'inset(0% 0 0 0)' })
    }
    gsap.set(progressFillEls, { scaleX: 0, transformOrigin: '0% 50%' })

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia()

      mm.add(`(min-width: ${opts.minWidth}px) and (prefers-reduced-motion: no-preference)`, () => {
        let lastIndex = 0
        const segCount = items.length - 1 // number of hold+snap segments; nothing animates "into" the already-visible first panel

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: wrap,
            start: 'top top',
            // Vertical scroll drives this pin — always window.innerHeight,
            // never innerWidth, even though the *motion* itself is
            // horizontal. See bug #1 in the doc comment above.
            end: () => `+=${segCount * window.innerHeight * (1 + opts.pinBufferVh / 100)}`,
            scrub: opts.scrub,
            pin: true,
            // Force transform-based pinning rather than letting GSAP's own
            // heuristic pick 'fixed'. `.phs-wrap` always sits inside
            // <CurvedRise>'s ancestor, which carries a CSS `transform`
            // (translateX, and briefly scale) for as long as its own
            // scroll-linked settle animation is running or has ever run —
            // and per the CSS spec, ANY transformed ancestor (including a
            // plain translate with no scale) becomes the containing block
            // for a `position: fixed` descendant, so `position: fixed` here
            // renders relative to that ancestor, not the viewport, and
            // drifts with it exactly like an unpinned element. GSAP's own
            // "is a transformed ancestor here" check can get this wrong
            // depending on the exact instant it runs (observed live:
            // right after this component's ancestor-settle refresh below,
            // it picked 'fixed' anyway and the pin drifted). Pinning via a
            // plain `transform` on `.phs-wrap` itself is unaffected by an
            // ancestor's own transform, so it's the only mode that's
            // correct here regardless of when GSAP measures.
            pinType: 'transform',
            anticipatePin: 1,
            invalidateOnRefresh: true,
            onEnter: () => gsap.set(track, { willChange: 'transform' }),
            onLeave: () => gsap.set(track, { willChange: 'auto' }),
            onLeaveBack: () => gsap.set(track, { willChange: 'auto' }),
            onUpdate: (self) => {
              // Smooth per-frame values go straight to the DOM — never
              // through React state. This is bug #2's fix.
              gsap.set(progressFillEls, { scaleX: self.progress })

              const idx = Math.round(self.progress * segCount)
              if (idx !== lastIndex) {
                lastIndex = idx
                setActiveIndex(idx)
                setTabbable(idx)
              }
              if (opts.enableVelocityBlur) {
                const headline = headlineEls[lastIndex]
                if (headline) {
                  const v = Math.abs(self.getVelocity())
                  const blurPx = gsap.utils.clamp(0, 8, v / 2500)
                  gsap.to(headline, {
                    filter: blurPx > 0.15 ? `blur(${blurPx}px)` : 'blur(0px)',
                    duration: 0.2,
                    overwrite: true,
                  })
                }
              }
            },
          },
        })

        // Explicit absolute positions per segment — deterministic total
        // duration of exactly `segCount`, mapped 1:1 against scroll
        // progress. See bug #3 in the doc comment above.
        for (let i = 1; i <= segCount; i++) {
          const segStart = i - 1
          const moveStart = segStart + opts.holdRatio
          const moveDuration = 1 - opts.holdRatio
          tl.to(track, { xPercent: -100 * i, ease: opts.ease, duration: moveDuration }, moveStart)
          if (opts.enableImageReveal && mediaEls[i]) {
            tl.to(mediaEls[i], { clipPath: 'inset(0% 0 0 0)', ease: opts.ease, duration: moveDuration }, moveStart)
          }
        }

        // Panel images can still be loading when this runs (next/image
        // resolves asynchronously even with `priority`); a size change
        // after ScrollTrigger's first measurement is exactly what makes a
        // pin's start/end drift out from under the actual layout, which
        // reads as jitter or the pin snapping straight to a later panel.
        // Re-measuring once everything currently in the DOM has finished
        // loading closes that gap without polling.
        const imgs = Array.from(wrap.querySelectorAll('img'))
        Promise.all(
          imgs.map(
            (img) =>
              img.complete
                ? Promise.resolve()
                : new Promise<void>((resolve) => {
                    img.addEventListener('load', () => resolve(), { once: true })
                    img.addEventListener('error', () => resolve(), { once: true })
                  })
          )
        ).then(() => ScrollTrigger.refresh())

        // Bug #4 fix: re-measure once CurvedRise's (or any other ancestor's)
        // scroll-linked transform is done changing, not just once at mount.
        // framer-motion writes its animated `scale`/`x` straight to the
        // element's `style` attribute every frame, so a MutationObserver on
        // that attribute across the ancestor chain sees exactly the frames
        // where it's moving — debounce so we refresh once, ~120ms after the
        // *last* such frame (i.e. once it's actually settled), rather than on
        // every single frame (which would itself be a jitter/perf regression
        // of the same shape this rewrite exists to remove). Capped at 8
        // ancestor levels: plenty to reach past CurvedRise's wrapper divs
        // without walking all the way to <body> on every mount.
        // Bug #5 fix: never call ScrollTrigger.refresh() while THIS trigger
        // is actively pinned. refresh() re-measures start/end and rebuilds
        // the pin-spacer from the live DOM — doing that mid-pin (pin-spacer
        // already inserted, track already translated) recalculates the
        // trigger's geometry out from under itself and snaps the pinned
        // element, which reads as exactly the "jittering/juggling" reported
        // for the first project. CurvedRise's scroll-linked reveal transform
        // (the ancestor mutation that schedules a refresh in the first
        // place) can still be mid-animation right as this pin engages, so
        // without this guard a refresh lands squarely inside the hold phase.
        // If the pin is active when the debounce fires, defer instead of
        // refreshing out from under it, and keep deferring until it isn't.
        let refreshTimer: ReturnType<typeof setTimeout> | undefined
        const scheduleRefresh = () => {
          if (refreshTimer) clearTimeout(refreshTimer)
          refreshTimer = setTimeout(() => {
            // TEMP DEBUG — remove before final handoff.
            ;(window as any).__phsDebug = (window as any).__phsDebug || { refreshes: [], deferrals: [] }
            if (tl.scrollTrigger?.isActive) {
              ;(window as any).__phsDebug.deferrals.push(performance.now())
              scheduleRefresh()
              return
            }
            ;(window as any).__phsDebug.refreshes.push({ t: performance.now(), wasActive: false })
            ScrollTrigger.refresh()
          }, 120)
        }
        const watchedAncestors: HTMLElement[] = []
        {
          let node: HTMLElement | null = wrap.parentElement
          for (let depth = 0; node && depth < 8; depth++) {
            watchedAncestors.push(node)
            node = node.parentElement
          }
        }
        const ancestorObserver = new MutationObserver(scheduleRefresh)
        watchedAncestors.forEach((node) =>
          ancestorObserver.observe(node, { attributes: true, attributeFilter: ['style'] })
        )

        return () => {
          if (refreshTimer) clearTimeout(refreshTimer)
          ancestorObserver.disconnect()
          tl.scrollTrigger?.kill()
          tl.kill()
          setActiveIndex(0)
          setTabbable(0)
        }
      })
    }, wrap)

    return () => ctx.revert()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, opts.holdRatio, opts.pinBufferVh, opts.ease, opts.scrub, opts.enableImageReveal, opts.enableVelocityBlur, opts.minWidth])

  return (
    <>
      <div ref={wrapRef} className="phs-wrap">
        <div ref={trackRef} className="phs-track">
          {items.map((item, i) => (
            <div key={i} className="phs-panel">
              {renderPanel(item, i, { isActive: i === activeIndex, progress: i === activeIndex ? 1 : 0, velocity: 0 })}
            </div>
          ))}
        </div>
        <div className="phs-hud">
          {renderHud ? renderHud(activeIndex === items.length - 1 ? 1 : activeIndex / Math.max(1, items.length - 1), activeIndex, items.length) : (
            <DefaultHud activeIndex={activeIndex} total={items.length} />
          )}
        </div>
      </div>

      <div className="phs-fallback">
        <FallbackPanels items={items} renderPanel={renderPanel} mode={opts.reducedMotionFallback} />
      </div>
    </>
  )
}
