'use client'

import { useEffect, useRef, useState } from 'react'

interface ArchDiagramProps {
  title: string
  description?: string
  chart: string // Mermaid diagram source string
  id: string // unique id for mermaid to target
}

let mermaidInitialized = false

export function ArchDiagram({ title, description, chart, id }: ArchDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const renderRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

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
        const mermaid = (await import('mermaid')).default
        if (!mermaidInitialized) {
          mermaid.initialize({
            startOnLoad: false,
            theme: 'neutral',
            themeVariables: {
              primaryColor: '#f3f3f3',
              primaryTextColor: '#000000',
              primaryBorderColor: '#000000',
              lineColor: '#444444',
              secondaryColor: '#e5e7eb',
              tertiaryColor: '#ffffff',
              background: '#ffffff',
              mainBkg: '#f3f3f3',
              nodeBorder: '#000000',
              clusterBkg: '#f3f3f3',
              titleColor: '#000000',
              edgeLabelBackground: '#ffffff',
              fontFamily: 'var(--font-suisseintl), ui-sans-serif, system-ui, sans-serif',
            },
          })
          mermaidInitialized = true
        }
        const { svg } = await mermaid.render(id, chart)
        if (!cancelled && renderRef.current) {
          renderRef.current.innerHTML = svg
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
      }}
    >
      {/* Card header */}
      <div style={{ marginBottom: '32px' }}>
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
          <div ref={renderRef} style={{ width: '100%', maxWidth: '900px' }} aria-label={title} />
        )}
      </div>
    </div>
  )
}
