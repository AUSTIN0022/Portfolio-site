'use client'

import { useContext, useEffect, useRef, useState } from 'react'
import { motion, useMotionValue, useTransform } from 'framer-motion'
import ScrollFloat from '@/components/ui/ScrollFloat'
import { CaseStudyBeamContext } from './CaseStudyLayout'

interface CaseStudySectionProps {
  id: string
  kicker: string
  heading: string
  children: React.ReactNode
}

/**
 * One entry in the case study's scroll timeline. `.case-section-rail` is a
 * single element, not two responsive copies: on mobile it's `position:
 * static` and just stacks above the content; at desktop (see globals.css)
 * it switches to `position: sticky`, pinning in place while this section's
 * content scrolls past underneath it — that pinned title *is* the section
 * nav now, replacing the old fixed link-list sidebar.
 *
 * The dot lights up (fills with the beam's own color) once the animated
 * beam line — a shared motion value from CaseStudyLayout — reaches this
 * dot's own measured position, and un-lights automatically when scrolling
 * back up past it, since it's a live comparison re-evaluated every frame
 * rather than a one-way flag.
 */
export function CaseStudySection({ id, kicker, heading, children }: CaseStudySectionProps) {
  const dotRef = useRef<HTMLSpanElement>(null)
  const beamCtx = useContext(CaseStudyBeamContext)
  const fallbackHeight = useMotionValue(0)
  const beamHeight = beamCtx?.beamHeight ?? fallbackHeight
  // Infinity until measured: a dot with no known position should read as
  // "not yet reached" rather than momentarily flashing lit at height 0.
  const [dotOffset, setDotOffset] = useState(Infinity)

  useEffect(() => {
    const main = beamCtx?.mainRef.current
    const dot = dotRef.current
    if (!main || !dot) return

    let rafId = 0
    const measure = () => {
      if (rafId) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        if (!main || !dot) return
        const dotRect = dot.getBoundingClientRect()
        const mainRect = main.getBoundingClientRect()
        const newOffset = dotRect.top - mainRect.top + dotRect.height / 2
        setDotOffset((prev) => (Math.abs(prev - newOffset) > 1 ? newOffset : prev))
      })
    }

    measure()
    window.addEventListener('resize', measure, { passive: true })
    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      window.removeEventListener('resize', measure)
    }
  }, [beamCtx])

  const dotBackground = useTransform(beamHeight, (h) =>
    h >= dotOffset ? 'var(--color-electric-yellow)' : 'var(--color-canvas-mist)'
  )
  const dotBorderColor = useTransform(beamHeight, (h) =>
    h >= dotOffset ? 'var(--color-electric-yellow)' : 'var(--color-muted-on-light)'
  )
  const dotShadow = useTransform(beamHeight, (h) =>
    h >= dotOffset ? '0 0 6px 1px rgba(255, 241, 0, 0.7)' : 'none'
  )

  return (
    <section id={id} data-section style={{ scrollMarginTop: '100px' }}>
      <div className="case-section-row">
        <div className="case-section-rail">
          <motion.span
            ref={dotRef}
            className="case-dot"
            aria-hidden
            style={{ background: dotBackground, borderColor: dotBorderColor, boxShadow: dotShadow }}
          />
          <div
            style={{
              fontFamily: 'var(--font-suisseintlmono)',
              fontSize: '12px',
              color: 'var(--color-muted-on-light)',
              letterSpacing: '-0.36px',
              marginBottom: '12px',
            }}
          >
            {kicker}
          </div>
          <ScrollFloat
            as="h2"
            style={{
              fontFamily: 'var(--font-suisseintlcond)',
              fontWeight: 700,
              fontSize: 'clamp(1.5rem, 1.7vw, 1.875rem)',
              lineHeight: 0.95,
              letterSpacing: '-0.03em',
              color: 'var(--color-ink-black)',
              textWrap: 'balance',
            }}
          >
            {heading}
          </ScrollFloat>
        </div>

        <div className="case-section-content">{children}</div>
      </div>
    </section>
  )
}
