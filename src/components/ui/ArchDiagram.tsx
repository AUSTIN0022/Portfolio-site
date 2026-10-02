'use client'

import { useEffect, useRef, useState } from 'react'
import { loadDiagramSvg } from '@/lib/diagramSvg'
import { useDiagramGallery } from '@/components/ui/DiagramGallery'

interface ArchDiagramProps {
  title: string
  description?: string
  id: string // matches public/diagrams/{id}.svg
  /** Position within the page's diagram set — lets the carousel open
   * directly on this diagram and page through its siblings in order. */
  index: number
}

/**
 * Renders a standalone diagram card when used on its own. When wrapped in a
 * `DiagramGalleryProvider`, it instead just registers its data (title,
 * description) and renders nothing — the provider's `DiagramCarousel`
 * owns all the visible rendering for the whole diagram set.
 */
export function ArchDiagram({ title, description, id, index }: ArchDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const renderRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const gallery = useDiagramGallery()

  useEffect(() => {
    gallery?.registerDiagram(index, { id, title, description })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, id, title, description])

  useEffect(() => {
    if (gallery) return // the carousel renders the visible card instead
    const el = containerRef.current
    if (!el) return
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
    loadDiagramSvg(id).then(
      (svg) => {
        if (!cancelled && renderRef.current) {
          renderRef.current.innerHTML = svg
          renderRef.current.style.opacity = '1'
        }
      },
      () => {
        if (!cancelled) setError(true)
      }
    )
    return () => {
      cancelled = true
    }
  }, [id, isVisible, gallery])

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
          <p style={{ fontFamily: 'var(--font-suisseintlmono)', fontSize: '12px', color: 'var(--color-fg-muted)' }}>
            Diagram failed to load.
          </p>
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
