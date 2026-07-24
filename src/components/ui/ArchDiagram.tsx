'use client'

import { useEffect, useRef, useState } from 'react'
import { renderMermaidDiagram } from '@/lib/mermaidRender'
import { useDiagramGallery } from '@/components/ui/DiagramGallery'

interface ArchDiagramProps {
  title: string
  description?: string
  chart: string // Mermaid diagram source string
  id: string // unique id for mermaid to target
  /** Position within the page's diagram set — lets the carousel open
   * directly on this diagram and page through its siblings in order. */
  index: number
}

/**
 * Renders a standalone diagram card when used on its own. When wrapped in a
 * `DiagramGalleryProvider`, it instead just registers its data (title,
 * description, chart) and renders nothing — the provider's `DiagramCarousel`
 * owns all the visible rendering for the whole diagram set.
 */
export function ArchDiagram({ title, description, chart, id, index }: ArchDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const renderRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const gallery = useDiagramGallery()

  useEffect(() => {
    gallery?.registerDiagram(index, { id, title, description, chart })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, id, title, description, chart])

  useEffect(() => {
    if (gallery) return // the carousel renders the visible card instead
    const el = containerRef.current
    if (!el) return
    // Mermaid's layout pass is a synchronous, main-thread-blocking task (up to
    // several hundred ms per diagram). Starting it a full viewport ahead of
    // time means that work lands while the diagram is still off-screen and
    // the user is reading the previous card, instead of stalling the frame
    // right as this one scrolls into view.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '800px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [gallery])

  useEffect(() => {
    if (gallery || !isVisible) return
    let cancelled = false

    async function render() {
      try {
        const svg = await renderMermaidDiagram(id, chart)
        if (!cancelled && renderRef.current) {
          renderRef.current.innerHTML = svg
          // Fade the diagram in instead of popping it into the reserved box —
          // rendering is deferred to idle time so this can land well after the
          // card has already scrolled into view on a slow connection.
          renderRef.current.style.opacity = '1'
        }
      } catch {
        if (!cancelled) setError(true)
      }
    }

    // Defer to idle time so the blocking layout pass doesn't compete with an
    // in-progress scroll/paint frame. Falls back to a macrotask on Safari,
    // which has no requestIdleCallback.
    let idleHandle: number | ReturnType<typeof setTimeout> | undefined
    if (typeof window.requestIdleCallback === 'function') {
      idleHandle = window.requestIdleCallback(() => void render(), { timeout: 1000 })
    } else {
      idleHandle = setTimeout(() => void render(), 0)
    }

    return () => {
      cancelled = true
      if (typeof window.cancelIdleCallback === 'function' && typeof idleHandle === 'number') {
        window.cancelIdleCallback(idleHandle)
      } else if (idleHandle !== undefined) {
        clearTimeout(idleHandle as ReturnType<typeof setTimeout>)
      }
    }
  }, [chart, id, isVisible, gallery])

  if (gallery) return null

  return (
    <div
      ref={containerRef}
      style={{
        background: 'var(--color-bg)',
        borderRadius: '24px',
        padding: 'clamp(24px, 5vw, 40px)',
        marginBottom: '32px',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Card header */}
      <div style={{ marginBottom: '32px' }}>
        <div
          style={{
            fontFamily: 'var(--font-suisseintlmono)',
            fontSize: '12px',
            color: 'var(--color-fg-subtle)',
            letterSpacing: '-0.36px',
            marginBottom: '8px',
          }}
        >
          {'// DIAGRAM'}
        </div>
        <h3
          style={{
            fontFamily: 'var(--font-suisseintlcond)',
            fontWeight: 700,
            fontSize: '28px',
            lineHeight: 1.0,
            letterSpacing: '-0.84px',
            color: 'var(--color-fg)',
          }}
        >
          {title}
        </h3>
        {description && (
          <p
            style={{
              fontFamily: 'var(--font-suisseintl)',
              fontWeight: 400,
              fontSize: '14px',
              lineHeight: 1.5,
              color: 'var(--color-fg-subtle)',
              letterSpacing: '-0.28px',
              marginTop: '8px',
            }}
          >
            {description}
          </p>
        )}
      </div>

      {/* Diagram render area */}
      <div
        style={{
          background: 'var(--color-chip-bg)',
          borderRadius: '12px',
          padding: '32px',
          overflowX: 'auto',
          minHeight: '280px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {error ? (
          <pre
            style={{
              fontFamily: 'var(--font-suisseintlmono)',
              fontSize: '11px',
              color: 'var(--color-fg-muted)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              lineHeight: 1.6,
            }}
          >
            {chart}
          </pre>
        ) : (
          <div
            ref={renderRef}
            style={{
              width: '100%',
              maxWidth: '900px',
              opacity: 0,
              transition: 'opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            aria-label={title}
          />
        )}
      </div>
    </div>
  )
}
