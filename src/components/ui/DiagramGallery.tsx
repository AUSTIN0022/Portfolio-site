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
import { getCachedDiagramSvg, loadDiagramSvg } from '@/lib/diagramSvg'

type DiagramData = {
  id: string
  title: string
  description?: string
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
      if (existing && existing.id === data.id) return prev
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

// One card at a time: the incoming card slides in from the side you're
// paging toward while the outgoing one slides out the other way. No peeking
// neighbours — they sat outside the column and widened the page. Reduced
// motion keeps a short fade with a small nudge instead of the full slide.
const cardVariants = {
  enter: ({ dir, reduced }: { dir: number; reduced: boolean }) => ({
    transform: `translate(-50%, -50%) translateX(${dir * (reduced ? 4 : 40)}%)`,
    opacity: 0,
  }),
  center: { transform: 'translate(-50%, -50%) translateX(0%)', opacity: 1 },
  exit: ({ dir, reduced }: { dir: number; reduced: boolean }) => ({
    transform: `translate(-50%, -50%) translateX(${-dir * (reduced ? 4 : 40)}%)`,
    opacity: 0,
  }),
}

function cardTransition(reducedMotion: boolean) {
  return {
    transform: { duration: reducedMotion ? 0.15 : 0.42, ease: [0.77, 0, 0.175, 1] as const },
    opacity: { duration: 0.28 },
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
  const [direction, setDirection] = useState(1)
  const [hasBeenNear, setHasBeenNear] = useState(false)
  const stageRef = useRef<HTMLDivElement>(null)
  const shouldReduceMotion = !!useReducedMotion()

  const total = diagrams.length
  const goPrev = useCallback(() => {
    setDirection(-1)
    setActiveIndex((i) => (total ? (i - 1 + total) % total : i))
  }, [total])
  const goNext = useCallback(() => {
    setDirection(1)
    setActiveIndex((i) => (total ? (i + 1) % total : i))
  }, [total])
  const goTo = (i: number) => {
    setDirection(i > activeIndex ? 1 : -1)
    setActiveIndex(i)
  }

  // Lazy: don't fetch the diagram SVGs until this section is actually
  // approaching the viewport — it sits well below the fold behind two other
  // heavy scroll-driven visualizations on this page.
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

  // Prefetch the active diagram and its neighbors whenever the active index
  // changes, in either the inline strip or the fullscreen view.
  useEffect(() => {
    if (!hasBeenNear || total === 0) return
    const order = total === 1 ? [activeIndex] : [activeIndex, (activeIndex + 1) % total, (activeIndex - 1 + total) % total]
    for (const i of order) {
      const diagram = diagrams[i]
      if (diagram) void loadDiagramSvg(diagram.id).catch(() => {})
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
          onClick={() => goTo(i)}
        />
      ))}
    </div>
  )

  return (
    <>
      <div className="diagram-carousel">
        <div className="diagram-carousel-stage" ref={stageRef}>
          <AnimatePresence initial={false} custom={{ dir: direction, reduced: shouldReduceMotion }}>
            {hasBeenNear && (
              <DiagramCard
                key={diagrams[activeIndex].id}
                variant="inline"
                diagram={diagrams[activeIndex]}
                displayIndex={activeIndex}
                total={diagrams.length}
                direction={direction}
                reducedMotion={shouldReduceMotion}
                onExpand={() => setIsExpanded(true)}
              />
            )}
          </AnimatePresence>
        </div>

        <div className="diagram-carousel-controls">
          <button
            type="button"
            className="icon-btn"
            aria-label="Previous diagram"
            style={{ width: 48, height: 48, border: '1px solid var(--color-fg)', borderRadius: '50%', background: 'transparent', flexShrink: 0 }}
            onClick={goPrev}
          >
            <span aria-hidden>←</span>
          </button>
          {dots}
          <button
            type="button"
            className="icon-btn"
            aria-label="Next diagram"
            style={{ width: 48, height: 48, border: '1px solid var(--color-fg)', borderRadius: '50%', background: 'transparent', flexShrink: 0 }}
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

            <AnimatePresence initial={false} custom={{ dir: direction, reduced: shouldReduceMotion }}>
              <DiagramCard
                key={diagrams[activeIndex].id}
                variant="expanded"
                diagram={diagrams[activeIndex]}
                displayIndex={activeIndex}
                total={diagrams.length}
                direction={direction}
                reducedMotion={shouldReduceMotion}
              />
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
  direction,
  reducedMotion,
  variant,
  onExpand,
}: {
  diagram: DiagramData
  displayIndex: number
  total: number
  direction: number
  reducedMotion: boolean
  variant: 'inline' | 'expanded'
  onExpand?: () => void
}) {
  const [svg, setSvg] = useState<string | undefined>(() => getCachedDiagramSvg(diagram.id))

  useEffect(() => {
    if (svg) return
    let cancelled = false
    loadDiagramSvg(diagram.id).then(
      (result) => {
        if (!cancelled) setSvg(result)
      },
      () => {}
    )
    return () => {
      cancelled = true
    }
  }, [diagram.id, svg])

  return (
    <motion.div
      className={`diagram-card-shell ${variant === 'expanded' ? 'diagram-gallery-card' : 'diagram-carousel-card'}`}
      style={{ zIndex: variant === 'expanded' ? 301 : 1 }}
      custom={{ dir: direction, reduced: reducedMotion }}
      variants={cardVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={cardTransition(reducedMotion)}
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
            color: 'var(--color-fg-muted)',
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
