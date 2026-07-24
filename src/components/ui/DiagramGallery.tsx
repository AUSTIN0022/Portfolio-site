'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { getCachedMermaidSvg, renderMermaidDiagram } from '@/lib/mermaidRender'

type DiagramData = {
  id: string
  title: string
  description?: string
  chart: string
}

interface DiagramGalleryContextValue {
  registerDiagram: (index: number, data: DiagramData) => void
}

const DiagramGalleryContext = createContext<DiagramGalleryContextValue | null>(null)

/** Consumed by `ArchDiagram` — returns null when no provider wraps it, so it
 * falls back to rendering its own standalone card instead of registering. */
export function useDiagramGallery() {
  return useContext(DiagramGalleryContext)
}

/**
 * Wrap a set of `ArchDiagram`s with this to turn them into one shared
 * coverflow carousel: the active diagram sits centered and sharp, its
 * neighbors peek in from the edges dimmed/blurred, and the whole thing pages
 * with Next/Prev. The inline carousel and the "expand to fullscreen" view are
 * the exact same component at two sizes — expanding never loses your place.
 * Diagrams register themselves on mount (by their `index` prop), so this
 * needs no data duplicated at the call site beyond that prop — `ArchDiagram`
 * itself renders nothing when wrapped here; this provider does the rendering.
 */
export function DiagramGalleryProvider({ children }: { children: ReactNode }) {
  const [diagrams, setDiagrams] = useState<Map<number, DiagramData>>(new Map())

  const registerDiagram = useCallback((index: number, data: DiagramData) => {
    setDiagrams((prev) => {
      const existing = prev.get(index)
      if (existing && existing.id === data.id && existing.chart === data.chart) return prev
      const next = new Map(prev)
      next.set(index, data)
      return next
    })
  }, [])

  const orderedDiagrams = useMemo(
    () =>
      Array.from(diagrams.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([, data]) => data),
    [diagrams]
  )

  const contextValue = useMemo(() => ({ registerDiagram }), [registerDiagram])

  return (
    <DiagramGalleryContext.Provider value={contextValue}>
      {children}
      <DiagramCarousel diagrams={orderedDiagrams} />
    </DiagramGalleryContext.Provider>
  )
}

function cardTransition(reducedMotion: boolean) {
  return {
    transform: { duration: reducedMotion ? 0.15 : 0.42, ease: [0.77, 0, 0.175, 1] as const },
    opacity: { duration: 0.28 },
    filter: { duration: 0.28 },
  }
}

// The whole card — kicker, title, description, and diagram together — is
// what scales/dims/blurs as a unit. Reduced motion keeps that dim/blur cue
// (not a vestibular trigger, and it's how the user tells which card is
// active) but drops the sliding distance: "fewer and gentler," not zero.
function roleFor(offset: number, reducedMotion: boolean): { transform: string; opacity: number; filter: string } {
  if (offset === 0) return { transform: 'translate(-50%, -50%) translateX(0%) scale(1)', opacity: 1, filter: 'blur(0px)' }
  const dir = offset > 0 ? 1 : -1
  const distance = reducedMotion ? 6 : 78
  const scale = reducedMotion ? 0.97 : 0.86
  return {
    transform: `translate(-50%, -50%) translateX(${dir * distance}%) scale(${scale})`,
    opacity: 0.45,
    filter: 'blur(3px)',
  }
}

/**
 * DiagramCarousel — owns which diagram is active and whether the fullscreen
 * view is open. Both the inline strip and the fullscreen overlay page
 * through the same `activeIndex`, so expanding/collapsing never jumps you
 * back to the first diagram.
 */
function DiagramCarousel({ diagrams }: { diagrams: DiagramData[] }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [isExpanded, setIsExpanded] = useState(false)
  const [hasBeenNear, setHasBeenNear] = useState(false)
  const stageRef = useRef<HTMLDivElement>(null)
  const shouldReduceMotion = !!useReducedMotion()

  const total = diagrams.length
  const goPrev = useCallback(() => {
    setActiveIndex((i) => (total ? (i - 1 + total) % total : i))
  }, [total])
  const goNext = useCallback(() => {
    setActiveIndex((i) => (total ? (i + 1) % total : i))
  }, [total])

  // Lazy: don't pay Mermaid's render cost until this section is actually
  // approaching the viewport, same rationale ArchDiagram used to apply per
  // card — this section can sit well below the fold behind two other heavy
  // scroll-driven visualizations on this page.
  //
  // Depends on `diagrams.length`, not `[]`: before any diagrams have
  // registered this component returns null (see below), so `stageRef` is
  // never attached on the very first render — without this dependency the
  // observer would attach to `null` once and never retry once the stage
  // actually mounts.
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasBeenNear(true)
          observer.disconnect()
        }
      },
      { rootMargin: '600px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [diagrams.length])

  // Prefetch the active diagram first, then its neighbors, whenever the
  // active index changes, in either the inline strip or the fullscreen view.
  // renderMermaidDiagram queues each call through a shared idle-scheduled
  // tail (see mermaidRender.ts), so calling it for all three here doesn't
  // block the main thread for the sum of all three — each gets its own idle
  // window, in this priority order.
  useEffect(() => {
    if (!hasBeenNear || total === 0) return
    const order = total === 1 ? [activeIndex] : [activeIndex, (activeIndex + 1) % total, (activeIndex - 1 + total) % total]
    for (const i of order) {
      const diagram = diagrams[i]
      if (diagram) void renderMermaidDiagram(diagram.id, diagram.chart)
    }
  }, [hasBeenNear, activeIndex, diagrams, total])

  useEffect(() => {
    if (!isExpanded) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsExpanded(false)
      else if (e.key === 'ArrowLeft') goPrev()
      else if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [isExpanded, goPrev, goNext])

  // Prev/Next loop around at the ends, so slots are computed by role
  // (prev/active/next) rather than a raw index range — a plain `[i-1,i,i+1]`
  // range would drop off the edge instead of wrapping to the far diagram.
  const slots = useMemo(() => {
    const n = total
    if (n === 0) return []
    if (n === 1) return [{ index: activeIndex, offset: 0 }]
    const prevIdx = (activeIndex - 1 + n) % n
    const nextIdx = (activeIndex + 1) % n
    const result = [{ index: activeIndex, offset: 0 }]
    if (prevIdx !== activeIndex) result.push({ index: prevIdx, offset: -1 })
    if (nextIdx !== activeIndex && nextIdx !== prevIdx) result.push({ index: nextIdx, offset: 1 })
    return result
  }, [activeIndex, total])

  if (diagrams.length === 0) return null

  const dots = (
    <div className="diagram-gallery-dots">
      {diagrams.map((d, i) => (
        <button
          key={d.id}
          type="button"
          className="diagram-gallery-dot"
          data-active={i === activeIndex ? '1' : '0'}
          aria-label={`Go to diagram ${i + 1}: ${d.title}`}
          aria-current={i === activeIndex}
          onClick={() => setActiveIndex(i)}
        />
      ))}
    </div>
  )

  return (
    <>
      <div className="diagram-carousel">
        <div className="diagram-carousel-stage" ref={stageRef}>
          <AnimatePresence initial={false}>
            {hasBeenNear &&
              slots.map((slot) => (
                <DiagramCard
                  key={diagrams[slot.index].id}
                  variant="inline"
                  diagram={diagrams[slot.index]}
                  displayIndex={slot.index}
                  total={diagrams.length}
                  offset={slot.offset}
                  reducedMotion={shouldReduceMotion}
                  onSelect={() => setActiveIndex(slot.index)}
                  onExpand={slot.offset === 0 ? () => setIsExpanded(true) : undefined}
                />
              ))}
          </AnimatePresence>
        </div>

        <div className="diagram-carousel-controls">
          <button
            type="button"
            className="icon-btn"
            aria-label="Previous diagram"
            style={{ width: 48, height: 48, border: '1px solid var(--color-ink-black)', borderRadius: '50%', background: 'transparent', flexShrink: 0 }}
            onClick={goPrev}
          >
            <span aria-hidden>←</span>
          </button>
          {dots}
          <button
            type="button"
            className="icon-btn"
            aria-label="Next diagram"
            style={{ width: 48, height: 48, border: '1px solid var(--color-ink-black)', borderRadius: '50%', background: 'transparent', flexShrink: 0 }}
            onClick={goNext}
          >
            <span aria-hidden>→</span>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${diagrams[activeIndex].title} — diagram ${activeIndex + 1} of ${diagrams.length}`}
          >
            <motion.button
              type="button"
              aria-label="Close diagram gallery"
              className="diagram-gallery-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsExpanded(false)}
            />

            <button type="button" className="diagram-gallery-close" aria-label="Close" onClick={() => setIsExpanded(false)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <AnimatePresence initial={false}>
              {slots.map((slot) => (
                <DiagramCard
                  key={diagrams[slot.index].id}
                  variant="expanded"
                  diagram={diagrams[slot.index]}
                  displayIndex={slot.index}
                  total={diagrams.length}
                  offset={slot.offset}
                  reducedMotion={shouldReduceMotion}
                  onSelect={() => setActiveIndex(slot.index)}
                />
              ))}
            </AnimatePresence>

            <div className="diagram-gallery-controls">
              <button type="button" className="diagram-gallery-nav" aria-label="Previous diagram" onClick={goPrev}>
                <span aria-hidden>←</span>
              </button>
              {dots}
              <button type="button" className="diagram-gallery-nav" aria-label="Next diagram" onClick={goNext}>
                <span aria-hidden>→</span>
              </button>
            </div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}

function DiagramCard({
  diagram,
  displayIndex,
  total,
  offset,
  reducedMotion,
  variant,
  onSelect,
  onExpand,
}: {
  diagram: DiagramData
  displayIndex: number
  total: number
  offset: number
  reducedMotion: boolean
  variant: 'inline' | 'expanded'
  onSelect: () => void
  onExpand?: () => void
}) {
  const [svg, setSvg] = useState<string | undefined>(() => getCachedMermaidSvg(diagram.id))

  useEffect(() => {
    if (svg) return
    let cancelled = false
    renderMermaidDiagram(diagram.id, diagram.chart).then((result) => {
      if (!cancelled) setSvg(result)
    })
    return () => {
      cancelled = true
    }
  }, [diagram.id, diagram.chart, svg])

  const role = roleFor(offset, reducedMotion)
  const isActive = offset === 0
  const enterDistance = reducedMotion ? 20 : 130
  const zIndex = variant === 'expanded' ? (isActive ? 301 : 300) : isActive ? 2 : 1

  return (
    <motion.div
      className={`diagram-card-shell ${variant === 'expanded' ? 'diagram-gallery-card' : 'diagram-carousel-card'}`}
      style={{ pointerEvents: isActive ? 'auto' : 'none', zIndex, cursor: isActive ? 'default' : 'pointer' }}
      initial={{
        transform: `translate(-50%, -50%) translateX(${offset > 0 ? enterDistance : -enterDistance}%) scale(0.8)`,
        opacity: 0,
        filter: 'blur(3px)',
      }}
      animate={role}
      exit={{
        transform: `translate(-50%, -50%) translateX(${offset >= 0 ? enterDistance : -enterDistance}%) scale(0.8)`,
        opacity: 0,
        filter: 'blur(3px)',
      }}
      transition={cardTransition(reducedMotion)}
      // Peek cards are a glimpse, not something to read — clicking one
      // brings the whole card to center instead of scrolling its content.
      onClick={!isActive ? onSelect : undefined}
    >
      {onExpand && (
        <button
          type="button"
          className="icon-btn diagram-expand-btn"
          aria-label={`Expand "${diagram.title}" diagram`}
          onClick={(e) => {
            e.stopPropagation()
            onExpand()
          }}
          style={{
            position: 'absolute',
            top: 'clamp(20px, 4vw, 40px)',
            right: 'clamp(20px, 4vw, 40px)',
            width: '36px',
            height: '36px',
            border: 'none',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--color-graphite)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 3H5a2 2 0 0 0-2 2v4M15 3h4a2 2 0 0 1 2 2v4M9 21H5a2 2 0 0 1-2-2v-4M15 21h4a2 2 0 0 0 2-2v-4" />
          </svg>
        </button>
      )}

      <div className="diagram-gallery-kicker">
        {'// DIAGRAM'} {displayIndex + 1} / {total}
      </div>
      <h3 className="diagram-gallery-title">{diagram.title}</h3>
      {diagram.description && <p className="diagram-gallery-desc">{diagram.description}</p>}

      <div className="diagram-gallery-surface">
        {svg ? (
          <div className="diagram-gallery-svg" aria-label={diagram.title} dangerouslySetInnerHTML={{ __html: svg }} />
        ) : (
          <div className="shoot-spinner" aria-hidden />
        )}
      </div>
    </motion.div>
  )
}
