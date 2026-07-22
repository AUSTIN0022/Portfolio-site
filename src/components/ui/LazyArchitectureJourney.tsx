'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'

const ArchitectureJourney = dynamic(
  () => import('./ArchitectureJourney').then((m) => m.ArchitectureJourney),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          height: 'min(86vh, 760px)',
          background: '#08080a',
          borderRadius: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(255, 255, 255, 0.4)',
          fontFamily: 'var(--font-suisseintlmono)',
          fontSize: '13px',
          letterSpacing: '-0.3px',
        }}
      >
        // LOADING ARCHITECTURE JOURNEY...
      </div>
    ),
  }
)

export function LazyArchitectureJourney() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [shouldLoad, setShouldLoad] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true)
          io.disconnect()
        }
      },
      { rootMargin: '400px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div ref={containerRef} style={{ minHeight: '300px' }}>
      {shouldLoad ? (
        <ArchitectureJourney />
      ) : (
        <div
          style={{
            height: 'min(86vh, 760px)',
            background: '#08080a',
            borderRadius: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255, 255, 255, 0.4)',
            fontFamily: 'var(--font-suisseintlmono)',
            fontSize: '13px',
            letterSpacing: '-0.3px',
          }}
        >
          // SCROLL TO LOAD ARCHITECTURE JOURNEY...
        </div>
      )}
    </div>
  )
}
