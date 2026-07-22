'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'

const InfraScaleSimulator = dynamic(
  () => import('./InfraScaleSimulator').then((m) => m.InfraScaleSimulator),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          height: 'min(88vh, 780px)',
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
        // LOADING SIMULATOR...
      </div>
    ),
  }
)

export function LazyInfraScaleSimulator() {
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
        <InfraScaleSimulator />
      ) : (
        <div
          style={{
            height: 'min(88vh, 780px)',
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
          // SCROLL TO LOAD SIMULATOR...
        </div>
      )}
    </div>
  )
}
