'use client'

import { motion, useScroll, useSpring } from 'framer-motion'

/**
 * Thin fixed progress bar tracking page scroll position. Uses Framer
 * Motion's own `useScroll`/`useSpring` (passive, rAF-driven) and animates
 * only `transform: scaleX` on a single element — the cheapest possible
 * scroll-linked animation. No new scroll listener, no layout properties.
 */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 200, damping: 30, restDelta: 0.001 })

  return (
    <motion.div
      aria-hidden
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '2px',
        background: 'var(--color-electric-yellow, var(--color-fg))',
        transformOrigin: '0%',
        scaleX,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    />
  )
}
