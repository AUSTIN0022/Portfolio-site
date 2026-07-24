'use client'

import { useEffect, useRef, useState } from 'react'
import { renderMermaidDiagram } from '@/lib/mermaidRender'
import { useDiagramGallery } from '@/components/ui/DiagramGallery'

interface ArchDiagramProps {
  title: string
  description?: string
  chart: string // Mermaid diagram source string
  id: string // unique id for mermaid to target
  /** Position within the page's diagram set — lets the gallery modal open
   * directly on this diagram and page through its siblings in order. */
  index: number
}

export function ArchDiagram({ title, description, chart, id, index }: ArchDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const renderRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const gallery = useDiagramGallery()

  // Register this diagram with the shared gallery (if one is mounted above)
  // so its expand button can open the modal positioned here.
  useEffect(() => {
    gallery?.registerDiagram(index, { id, title, description, chart })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, id, title, description, chart])

  useEffect(() => {
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
  }, [])

  useEffect(() => {
    if (!isVisible) return
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
  }, [chart, id, isVisible])

  return (
    <div
      ref={containerRef}
      style={{
        background: 'var(--color-pure-white)',
        borderRadius: '24px',
        padding: 'clamp(24px, 5vw, 40px)',
        marginBottom: '32px',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Card header */}
      <div style={{ marginBottom: '32px', paddingRight: gallery ? '48px' : 0 }}>
        <div
          style={{
            fontFamily: 'var(--font-suisseintlmono)',
            fontSize: '12px',
            color: 'var(--color-muted-on-light)',
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
            color: 'var(--color-ink-black)',
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
              color: 'var(--color-muted-on-light)',
              letterSpacing: '-0.28px',
              marginTop: '8px',
            }}
          >
            {description}
          </p>
        )}
      </div>

      {/* Expand into the gallery modal — only rendered when a gallery
          provider actually wraps this diagram set. */}
      {gallery && (
        <button
          type="button"
          className="icon-btn diagram-expand-btn"
          aria-label={`Expand "${title}" diagram`}
          onClick={() => gallery.openGallery(index)}
          style={{
            position: 'absolute',
            top: 'clamp(24px, 5vw, 40px)',
            right: 'clamp(24px, 5vw, 40px)',
            width: '36px',
            height: '36px',
            border: 'none',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--color-graphite)',
            flexShrink: 0,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 3H5a2 2 0 0 0-2 2v4M15 3h4a2 2 0 0 1 2 2v4M9 21H5a2 2 0 0 1-2-2v-4M15 21h4a2 2 0 0 0 2-2v-4" />
          </svg>
        </button>
      )}

      {/* Diagram render area */}
      <div
        style={{
          background: 'var(--color-surface-mist)',
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
              color: 'var(--color-graphite)',
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
