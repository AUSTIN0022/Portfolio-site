'use client'

import { useRef } from 'react'
import { motion, useScroll, useTransform, useMotionTemplate } from 'framer-motion'

/**
 * CurvedRise — the scroll-driven "card rising over the section above it"
 * transition. As the wrapped section enters, its top corners are rounded and
 * its left/right edges start inset from the screen (revealing the previous
 * section behind the rounded corners); on scroll the inset relaxes to zero so
 * the edges travel out to touch the viewport sides. The section is also pulled
 * up over the one above it so the rounded top overlaps like a rising panel.
 *
 * Wrap a section whose background contrasts with the one above it (e.g. a dark
 * section rising over a light one) for the effect to read.
 */
export function CurvedRise({
  children,
  overlap = 64,
  inset = 48,
  radius = 48,
  behind = '#e5e7eb',
}: {
  children: React.ReactNode
  /** How far the panel is pulled up over the previous section (px). */
  overlap?: number
  /** Initial horizontal inset of the panel edges before scroll (px). */
  inset?: number
  /** Top-corner radius of the rising panel (px). */
  radius?: number
  /**
   * Colour of the section the panel rises over. It backs the inset gap so the
   * space revealed beside the panel reads as that section — not the black page
   * body behind it.
   */
  behind?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  // 0 while the panel's top sits at the bottom of the viewport, reaching 1 as
  // that top rises to ~60% up the screen — the window over which it "settles".
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'start 60%'],
  })

  const sideInset = useTransform(scrollYProgress, [0, 1], [inset, 0])
  const clipPath = useMotionTemplate`inset(0px ${sideInset}px 0px ${sideInset}px round ${radius}px ${radius}px 0px 0px)`

  return (
    // Outer layer is NOT clipped: it carries the previous section's colour and
    // is pulled up over it, so the gap the clip-path opens beside the panel
    // reveals this colour instead of the page body.
    <div ref={ref} style={{ position: 'relative', zIndex: 2, marginTop: -overlap, background: behind }}>
      <motion.div style={{ clipPath, willChange: 'clip-path' }}>{children}</motion.div>
    </div>
  )
}
