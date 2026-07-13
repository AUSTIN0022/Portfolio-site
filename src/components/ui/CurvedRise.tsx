'use client'

import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'

/**
 * CurvedRise — the scroll-driven "card rising over the section above it"
 * transition. As the wrapped section enters, its top corners are rounded and
 * its left/right edges start inset from the screen (revealing the previous
 * section behind the rounded corners); on scroll the inset relaxes to zero so
 * the edges travel out to touch the viewport sides. The section is also pulled
 * up over the one above it so the rounded top overlaps like a rising panel.
 *
 * The corners are rendered with a real `border-radius` + `overflow: hidden`
 * (which the browser anti-aliases) rather than a `clip-path: … round …` whose
 * animated corners render jagged/stair-stepped. The panel's horizontal margins
 * animate the inset, so the rounded top edges travel outward smoothly.
 *
 * Wrap a section whose background contrasts with the one above it (e.g. a dark
 * section rising over a light one) for the effect to read.
 */
export function CurvedRise({
  children,
  overlap = 64,
  inset = 48,
  radius = 48,
  behind = 'var(--color-canvas-mist)',
  panel = 'var(--color-ink-black)',
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
  /**
   * The panel's own background. It fills any area the growing content hasn't
   * reached yet, so the content can scale up from small without exposing a gap
   * behind it. Defaults to the ink-black both wrapped sections use.
   */
  panel?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  // 0 while the panel's top sits at the bottom of the viewport, reaching 1 as
  // that top rises to ~60% up the screen — the window over which it "settles".
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'start 60%'],
  })

  const sideInset = useTransform(scrollYProgress, [0, 1], [inset, 0])

  // The content grows from small to full size in lockstep with the panel —
  // the "rising card fills with its content" read. Starting at 0.82 also keeps
  // edge content (a stat number sitting right after the gutter) clear of the
  // inset on narrow viewports instead of being hard-clipped by it.
  const contentScale = useTransform(scrollYProgress, [0, 1], [0.82, 1])

  return (
    // Outer layer is NOT clipped: it carries the previous section's colour and
    // is pulled up over it, so the gap the margins open beside the panel
    // reveals this colour instead of the page body.
    <div ref={ref} style={{ position: 'relative', zIndex: 2, marginTop: -overlap, background: behind }}>
      <motion.div
        style={{
          overflow: 'hidden',
          borderTopLeftRadius: radius,
          borderTopRightRadius: radius,
          marginLeft: sideInset,
          marginRight: sideInset,
          background: panel,
        }}
      >
        {/* A fixed full-viewport block centred on screen: the narrowing panel
            clips it symmetrically without reflowing its contents, and it scales
            up as the panel settles so the content grows into place. Gaps left
            by the scale are covered by the panel's own background above. */}
        <motion.div
          style={{
            width: '100vw',
            position: 'relative',
            left: '50%',
            x: '-50%',
            scale: contentScale,
            transformOrigin: 'center top',
            willChange: 'transform',
          }}
        >
          {children}
        </motion.div>
      </motion.div>
    </div>
  )
}
