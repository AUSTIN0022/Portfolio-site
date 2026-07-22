'use client'

import { useState, useEffect, useRef, ReactNode, ComponentProps } from 'react'
import dynamic from 'next/dynamic'

const ArchDiagramComponent = dynamic(
  () => import('@/components/ui/ArchDiagram').then((mod) => mod.ArchDiagram),
  { ssr: false }
)

const ArchitectureJourneyComponent = dynamic(
  () => import('@/components/ui/ArchitectureJourney').then((mod) => mod.ArchitectureJourney),
  { ssr: false }
)

const InfraScaleSimulatorComponent = dynamic(
  () => import('@/components/ui/InfraScaleSimulator').then((mod) => mod.InfraScaleSimulator),
  { ssr: false }
)

function ViewportLazy({
  children,
  fallback,
  rootMargin = '300px',
}: {
  children: ReactNode
  fallback: ReactNode
  rootMargin?: string
}) {
  const [shouldLoad, setShouldLoad] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (shouldLoad) return
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true)
          observer.disconnect()
        }
      },
      { rootMargin }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [shouldLoad, rootMargin])

  return <div ref={ref}>{shouldLoad ? children : fallback}</div>
}

export function ArchDiagram(props: ComponentProps<typeof ArchDiagramComponent>) {
  return (
    <ViewportLazy
      rootMargin="200px"
      fallback={
        <div
          style={{
            background: 'var(--color-pure-white)',
            borderRadius: '24px',
            padding: 'clamp(24px, 5vw, 40px)',
            marginBottom: '32px',
            minHeight: '350px',
          }}
        >
          <div
            style={{
              background: 'var(--color-surface-mist)',
              borderRadius: '12px',
              height: '240px',
              width: '100%',
            }}
          />
        </div>
      }
    >
      <ArchDiagramComponent {...props} />
    </ViewportLazy>
  )
}

export function ArchitectureJourney() {
  return (
    <ViewportLazy
      rootMargin="300px"
      fallback={
        <div
          style={{
            height: '644vh',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'sticky',
              top: 0,
              height: '100vh',
              maxHeight: '780px',
              background: '#08080a',
              borderRadius: '24px',
              border: '1px solid #1a1a22',
            }}
          />
        </div>
      }
    >
      <ArchitectureJourneyComponent />
    </ViewportLazy>
  )
}

export function InfraScaleSimulator() {
  return (
    <ViewportLazy
      rootMargin="300px"
      fallback={
        <div
          style={{
            height: '644vh',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'sticky',
              top: 0,
              height: '100vh',
              maxHeight: '780px',
              background: '#08080a',
              borderRadius: '24px',
              border: '1px solid #1a1a22',
            }}
          />
        </div>
      }
    >
      <InfraScaleSimulatorComponent />
    </ViewportLazy>
  )
}

