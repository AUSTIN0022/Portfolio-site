'use client'

import { useEffect, useRef, useState } from 'react'

interface ArchDiagramProps {
  title: string
  description?: string
  chart: string // Mermaid diagram source string
  id: string // unique id for mermaid to target
}

export function ArchDiagram({ title, description, chart, id }: ArchDiagramProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function render() {
      try {
        const mermaid = (await import('mermaid')).default
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
        const { svg } = await mermaid.render(id, chart)
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg
        }
      } catch {
        if (!cancelled) setError(true)
      }
    }
    render()
    return () => {
      cancelled = true
    }
  }, [chart, id])

  return (
    <div
      style={{
        background: '#ffffff',
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
            color: '#979797',
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
            color: '#000000',
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
              color: '#979797',
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
          background: '#f3f3f3',
          borderRadius: '12px',
          padding: '32px',
          overflowX: 'auto',
          minHeight: '200px',
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
              color: '#444444',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              lineHeight: 1.6,
            }}
          >
            {chart}
          </pre>
        ) : (
          <div ref={ref} style={{ width: '100%', maxWidth: '900px' }} aria-label={title} />
        )}
      </div>
    </div>
  )
}
