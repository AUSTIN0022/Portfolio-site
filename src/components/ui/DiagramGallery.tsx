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
  openGallery: (index: number) => void
}

const DiagramGalleryContext = createContext<DiagramGalleryContextValue | null>(null)

/** Consumed by `ArchDiagram` — returns null when no provider wraps it, so the
 * expand button/registration is skipped and the card behaves standalone. */
export function useDiagramGallery() {
  return useContext(DiagramGalleryContext)
}

/**
 * Wrap a set of `ArchDiagram`s with this to turn their individual expand
 * buttons into one shared lightbox: each button opens the same modal
 * positioned at that diagram, with Next/Prev paging through the rest without
 * closing. Diagrams register themselves on mount (by their `index` prop), so
 * this needs no data duplicated at the call site beyond that prop.
 */
export function DiagramGalleryProvider({ children }: { children: ReactNode }) {
  const [diagrams, setDiagrams] = useState<Map<number, DiagramData>>(new Map())
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const registerDiagram = useCallback((index: number, data: DiagramData) => {
    setDiagrams((prev) => {
      const existing = prev.get(index)
      if (existing && existing.id === data.id && existing.chart === data.chart) return prev
      const next = new Map(prev)
      next.set(index, data)
      return next
    })
  }, [])

  const openGallery = useCallback((index: number) => setOpenIndex(index), [])
  const closeGallery = useCallback(() => setOpenIndex(null), [])

  const orderedDiagrams = useMemo(
    () =>
      Array.from(diagrams.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([, data]) => data),
    [diagrams]
  )

  const contextValue = useMemo(() => ({ registerDiagram, openGallery }), [registerDiagram, openGallery])

  return (
    <DiagramGalleryContext.Provider value={contextValue}>
      {children}
      <DiagramGalleryModal
        diagrams={orderedDiagrams}
        openIndex={openIndex}
        onClose={closeGallery}
        onNavigate={setOpenIndex}
      />
    </DiagramGalleryContext.Provider>
  )
}

function slideTransition(reducedMotion: boolean) {
  return {
    transform: { duration: reducedMotion ? 0.15 : 0.38, ease: [0.77, 0, 0.175, 1] as const },
    opacity: { duration: 0.25 },
    filter: { duration: 0.25 },
  }
}

// Reduced motion keeps the dim/blur cue (not a vestibular trigger, and it's
// how the user tells which slide is active) but drops the sliding distance —
// "fewer and gentler," not zero.
function roleFor(
  offset: number,
  reducedMotion: boolean
): { transform: string; opacity: number; filter: string; zIndex: number } {
  if (offset === 0) return { transform: 'translateX(0%) scale(1)', opacity: 1, filter: 'blur(0px)', zIndex: 2 }
  const dir = offset > 0 ? 1 : -1
  const distance = reducedMotion ? 8 : 62
  return {
    transform: `translateX(${dir * distance}%) scale(0.88)`,
    opacity: 0.45,
    filter: 'blur(4px)',
    zIndex: 1,
  }
}

function DiagramGalleryModal({
  diagrams,
  openIndex,
  onClose,
  onNavigate,
}: {
  diagrams: DiagramData[]
  openIndex: number | null
  onClose: () => void
  onNavigate: (index: number) => void
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const isOpen = openIndex !== null
  const activeIndex = openIndex ?? 0
  const canPrev = activeIndex > 0
  const canNext = activeIndex < diagrams.length - 1
  const shouldReduceMotion = useReducedMotion()

  // Prefetch the active diagram + its immediate neighbors as soon as the
  // gallery opens or the user navigates — reuses the same cache the inline
  // cards populate, so this is a no-op for anything already rendered on the
  // page, and only pays Mermaid's render cost for a diagram the visitor
  // hasn't scrolled to yet.
  useEffect(() => {
    if (!isOpen) return
    for (const i of [activeIndex - 1, activeIndex, activeIndex + 1]) {
      const diagram = diagrams[i]
      if (diagram) void renderMermaidDiagram(diagram.id, diagram.chart)
    }
  }, [isOpen, activeIndex, diagrams])

  useEffect(() => {
    if (!isOpen) return
    dialogRef.current?.focus()
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' && canPrev) onNavigate(activeIndex - 1)
      else if (e.key === 'ArrowRight' && canNext) onNavigate(activeIndex + 1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, activeIndex, canPrev, canNext, onClose, onNavigate])

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const windowIndices = useMemo(() => {
    if (!isOpen) return []
    return [activeIndex - 1, activeIndex, activeIndex + 1].filter((i) => i >= 0 && i < diagrams.length)
  }, [isOpen, activeIndex, diagrams.length])

  const active = diagrams[activeIndex]

  return (
    <AnimatePresence>
      {isOpen && active && (
        <>
          <motion.button
            type="button"
            aria-label="Close diagram gallery"
            className="diagram-gallery-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={`${active.title} — diagram ${activeIndex + 1} of ${diagrams.length}`}
            tabIndex={-1}
            className="diagram-gallery"
            initial={{ opacity: 0, transform: `translate(-50%, -50%) scale(${shouldReduceMotion ? 1 : 0.95})` }}
            animate={{ opacity: 1, transform: 'translate(-50%, -50%) scale(1)' }}
            exit={{ opacity: 0, transform: `translate(-50%, -50%) scale(${shouldReduceMotion ? 1 : 0.95})` }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="diagram-gallery-header">
              <div style={{ minWidth: 0 }}>
                <div className="diagram-gallery-kicker">
                  {'// DIAGRAM'} {activeIndex + 1} / {diagrams.length}
                </div>
                <h3 className="diagram-gallery-title">{active.title}</h3>
                {active.description && <p className="diagram-gallery-desc">{active.description}</p>}
              </div>
              <button type="button" className="icon-btn diagram-gallery-close" aria-label="Close" onClick={onClose}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="diagram-gallery-track">
              <AnimatePresence initial={false}>
                {windowIndices.map((i) => (
                  <GallerySlide
                    key={diagrams[i].id}
                    diagram={diagrams[i]}
                    offset={i - activeIndex}
                    reducedMotion={!!shouldReduceMotion}
                    onSelect={() => onNavigate(i)}
                  />
                ))}
              </AnimatePresence>

              <button
                type="button"
                className="icon-btn diagram-gallery-nav diagram-gallery-nav--prev"
                aria-label="Previous diagram"
                disabled={!canPrev}
                onClick={() => canPrev && onNavigate(activeIndex - 1)}
              >
                <span aria-hidden>←</span>
              </button>
              <button
                type="button"
                className="icon-btn diagram-gallery-nav diagram-gallery-nav--next"
                aria-label="Next diagram"
                disabled={!canNext}
                onClick={() => canNext && onNavigate(activeIndex + 1)}
              >
                <span aria-hidden>→</span>
              </button>
            </div>

            <div className="diagram-gallery-dots">
              {diagrams.map((d, i) => (
                <button
                  key={d.id}
                  type="button"
                  className="diagram-gallery-dot"
                  data-active={i === activeIndex ? '1' : '0'}
                  aria-label={`Go to diagram ${i + 1}: ${d.title}`}
                  aria-current={i === activeIndex}
                  onClick={() => onNavigate(i)}
                />
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function GallerySlide({
  diagram,
  offset,
  reducedMotion,
  onSelect,
}: {
  diagram: DiagramData
  offset: number
  reducedMotion: boolean
  onSelect: () => void
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
  const enterDistance = reducedMotion ? 20 : 120

  return (
    <motion.div
      className="diagram-gallery-slide"
      style={{ pointerEvents: isActive ? 'auto' : 'none' }}
      initial={{ transform: `translateX(${offset > 0 ? enterDistance : -enterDistance}%) scale(0.8)`, opacity: 0, filter: 'blur(4px)' }}
      animate={role}
      exit={{ transform: `translateX(${offset >= 0 ? enterDistance : -enterDistance}%) scale(0.8)`, opacity: 0, filter: 'blur(4px)' }}
      transition={slideTransition(reducedMotion)}
      // Peek slides are a glimpse, not something to read — clicking one
      // jumps it to center instead of scrolling its own content.
      onClick={!isActive ? onSelect : undefined}
    >
      <div className="diagram-gallery-slide-inner" style={{ cursor: isActive ? 'default' : 'pointer' }}>
        {svg ? (
          <div className="diagram-gallery-svg" aria-label={diagram.title} dangerouslySetInnerHTML={{ __html: svg }} />
        ) : (
          <div className="shoot-spinner" aria-hidden />
        )}
      </div>
    </motion.div>
  )
}
