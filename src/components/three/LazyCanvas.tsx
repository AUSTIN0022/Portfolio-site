'use client'

import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react'
import dynamic from 'next/dynamic'
import { useReducedMotion } from 'framer-motion'

// One shared, SSR-skipped R3F Canvas import for every 3D surface on the site.
const Canvas = dynamic(() => import('@react-three/fiber').then((m) => m.Canvas), {
  ssr: false,
})

interface LazyCanvasProps {
  children: ReactNode
  camera?: { position?: [number, number, number]; fov?: number }
  className?: string
  style?: CSSProperties
}

/**
 * Performance wrapper for every WebGL surface. The page ships several 3D
 * objects; without gating, each spins up a context and a continuous
 * requestAnimationFrame render loop that runs forever — even off-screen and
 * even on a hidden tab — which pegs the GPU/CPU.
 *
 * This wrapper:
 *  - mounts the context only once the element is within 250px of the
 *    viewport (mount-once: no context create/destroy churn on scroll),
 *  - drives `frameloop` from visibility so the render loop is fully paused
 *    when the canvas is off-screen or the tab is hidden,
 *  - caps device-pixel-ratio at 1.5 so retina screens don't pay 3x fill-rate,
 *  - renders a single static frame ("demand") under reduced motion.
 */
export function LazyCanvas({ children, camera, className, style }: LazyCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const inViewRef = useRef(false)
  const [mounted, setMounted] = useState(false)
  const [active, setActive] = useState(false)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return

    const sync = () => setActive(inViewRef.current && !document.hidden)

    const io = new IntersectionObserver(
      ([entry]) => {
        inViewRef.current = entry.isIntersecting
        if (entry.isIntersecting) setMounted(true)
        sync()
      },
      { rootMargin: '250px' }
    )
    io.observe(el)
    document.addEventListener('visibilitychange', sync)

    return () => {
      io.disconnect()
      document.removeEventListener('visibilitychange', sync)
    }
  }, [])

  const frameloop: 'always' | 'demand' | 'never' = !active
    ? 'never'
    : reduceMotion
      ? 'demand'
      : 'always'

  return (
    <div ref={wrapRef} className={className} style={style}>
      {mounted && (
        <Canvas
          frameloop={frameloop}
          dpr={[1, 1.5]}
          camera={camera}
          style={{ width: '100%', height: '100%' }}
        >
          {children}
        </Canvas>
      )}
    </div>
  )
}
