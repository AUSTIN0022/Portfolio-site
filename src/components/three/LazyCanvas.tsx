'use client'

import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react'
import dynamic from 'next/dynamic'
import { useReducedMotion } from 'framer-motion'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

// One shared, SSR-skipped R3F Canvas import for every 3D surface on the site.
// WebGL has no server-side equivalent, so this can never be prerendered — the
// lever we actually have is WHEN the chunk is fetched, handled by `eager` below.
const Canvas = dynamic(() => import('@react-three/fiber').then((m) => m.Canvas), {
  ssr: false,
})

interface LazyCanvasProps {
  children: ReactNode
  camera?: { position?: [number, number, number]; fov?: number }
  className?: string
  style?: CSSProperties
  /**
   * Skip the intersection gate and mount on first paint. Set this for
   * above-the-fold canvases (the hero), where waiting for an IntersectionObserver
   * callback only adds a frame of delay before the chunk request even starts.
   */
  eager?: boolean
  /** Enable shadow mapping. Off by default — only the hero rig pays for it. */
  shadows?: boolean
}

/**
 * Keeps a lost WebGL context recoverable instead of permanently dead.
 *
 * A browser allows only a handful of live contexts (Chrome evicts the oldest
 * past ~16). In `next dev` every HMR patch remounts the Canvas and builds
 * another one, so after a few edits the browser evicts the live context and
 * the scene goes blank with "THREE.WebGLRenderer: Context Lost" — which is why
 * the hero renders in a production build but not always under the dev server.
 *
 * By default a lost context stays lost. Calling `preventDefault()` on the event
 * is what marks it eligible for restoration; we then re-render once the browser
 * hands it back. That covers the dev case above and, in production, the real
 * ones: GPU driver resets, and long-backgrounded tabs on mobile Safari.
 *
 * Deliberately NOT disposing the renderer here. R3F already tears down the
 * renderer when the Canvas truly unmounts, and doing it from an effect cleanup
 * is actively harmful: sibling cleanups (drei's <Environment> releasing its
 * cube render target) would then run against a destroyed renderer and throw,
 * and React Strict Mode's simulated remount would leave the live tree pointing
 * at a renderer we had already disposed.
 */
function ContextGuard() {
  const gl = useThree((s) => s.gl)
  const invalidate = useThree((s) => s.invalidate)

  useEffect(() => {
    const canvas = gl.domElement
    const onLost = (e: Event) => e.preventDefault()
    const onRestored = () => invalidate()

    canvas.addEventListener('webglcontextlost', onLost)
    canvas.addEventListener('webglcontextrestored', onRestored)

    return () => {
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onRestored)
    }
  }, [gl, invalidate])

  return null
}

/**
 * Performance wrapper for every WebGL surface. The page ships several 3D
 * objects; without gating, each spins up a context and a continuous
 * requestAnimationFrame render loop that runs forever — even off-screen and
 * even on a hidden tab — which pegs the GPU/CPU.
 *
 * This wrapper:
 *  - mounts the context once the element is within 250px of the viewport
 *    (mount-once: no context create/destroy churn on scroll), or immediately
 *    when `eager`,
 *  - drives `frameloop` from visibility so the render loop is fully paused
 *    when the canvas is off-screen or the tab is hidden,
 *  - renders at the display's true pixel ratio (capped at 2),
 *  - renders a single static frame ("demand") under reduced motion.
 */
export function LazyCanvas({
  children,
  camera,
  className,
  style,
  eager = false,
  shadows = false,
}: LazyCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const inViewRef = useRef(false)
  const [mounted, setMounted] = useState(eager)
  const [active, setActive] = useState(eager)
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
          // Was capped at 1.5, which on a 2x display rendered the scene at 75%
          // linear resolution and then upscaled it — the single biggest cause of
          // the soft, low-detail look. Render at native ratio, capped at 2 so
          // 3x phones don't pay 9x fill rate for no visible gain.
          dpr={[1, 2]}
          // three 0.185 deprecated PCFSoftShadowMap and silently downgrades it to
          // PCFShadowMap, so asking for it just produced a console warning and the
          // default anyway. VSM gives genuinely soft penumbrae, which is what this
          // scene wants — the key light is a broad studio softbox, not a hard sun.
          shadows={shadows ? { type: THREE.VSMShadowMap } : false}
          camera={camera}
          gl={{
            antialias: true,
            powerPreference: 'high-performance',
            alpha: true,
            // Match the hero's ToneMapping pass so a component looks identical on
            // every surface. three only applies the renderer's tone mapping when
            // rendering to the DEFAULT framebuffer — rendering into a composer's
            // render target skips it — so this governs the canvases that have no
            // EffectComposer, and is simply inert on the hero, where the composer's
            // own ToneMapping pass does the job instead. Either way, one curve.
            toneMapping: THREE.NeutralToneMapping,
          }}
          style={{ width: '100%', height: '100%' }}
        >
          <ContextGuard />
          {children}
        </Canvas>
      )}
    </div>
  )
}
