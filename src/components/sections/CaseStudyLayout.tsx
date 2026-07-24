'use client'

import Link from 'next/link'
import { createContext, useEffect, useRef, useState, type RefObject } from 'react'
import { motion, useScroll, useTransform, type MotionValue } from 'framer-motion'
import ScrollFloat from '@/components/ui/ScrollFloat'
import ShinyText from '@/components/ui/ShinyText'

interface CaseStudyLayoutProps {
  children: React.ReactNode
  projectName: string
  category: string
}

// Shared with CaseStudySection: `beamHeight` is the same motion value that
// drives the visible beam's height, in the same pixel space as `mainRef`
// (main's own top edge). Each section compares its own dot's offset
// against it to decide whether the beam has reached that dot yet — so the
// "lit" state is driven directly off the beam's actual animated position,
// not a separate approximation, and reverses correctly when scrolling up.
export const CaseStudyBeamContext = createContext<{
  beamHeight: MotionValue<number>
  mainRef: RefObject<HTMLElement | null>
} | null>(null)

export function CaseStudyLayout({ children, projectName, category }: CaseStudyLayoutProps) {
  const mainRef = useRef<HTMLElement>(null)
  const [height, setHeight] = useState(0)

  // Total height of every section combined — the beam line is sized to
  // this, not to the viewport, so it always spans exactly as far as the
  // content does. A ResizeObserver (not a one-shot measurement) because
  // this content includes async diagrams and R3F canvases that can still
  // change height after first paint.
  useEffect(() => {
    const el = mainRef.current
    if (!el) return
    let rafId = 0
    const measure = () => {
      if (rafId) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        if (!el) return
        const newHeight = el.getBoundingClientRect().height
        setHeight((prev) => (Math.abs(prev - newHeight) > 2 ? newHeight : prev))
      })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      ro.disconnect()
    }
  }, [])

  const { scrollYProgress } = useScroll({
    target: mainRef,
    offset: ['start 15%', 'end 60%'],
  })
  const beamHeight = useTransform(scrollYProgress, [0, 1], [0, height])
  const beamOpacity = useTransform(scrollYProgress, [0, 0.1], [0, 1])

  return (
    <div style={{ background: 'var(--color-canvas-mist)', minHeight: '100vh' }}>
      {/* Top bar */}
      <div style={{ background: 'var(--color-ink-black)' }}>
        <div style={{ padding: 'clamp(96px, 16vw, 120px) var(--gutter) var(--section-y)', maxWidth: '1280px', margin: '0 auto' }}>
          <Link
            href="/#work"
            className="case-back-link"
            style={{
              fontFamily: 'var(--font-suisseintlmono)',
              fontSize: '12px',
              textDecoration: 'none',
              letterSpacing: '-0.36px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '40px',
            }}
          >
            ← Back to work
          </Link>
          <div style={{ marginBottom: '16px' }}>
            <ShinyText
              text={category}
              color="var(--color-steel-gray)"
              shineColor="var(--color-pure-white)"
              speed={2.5}
              spread={60}
              style={{
                fontFamily: 'var(--font-suisseintlmono)',
                fontSize: '12px',
                letterSpacing: '-0.36px',
              }}
            />
          </div>
          <ScrollFloat
            as="h1"
            style={{
              fontFamily: 'var(--font-suisseintlcond)',
              fontWeight: 700,
              fontSize: 'var(--fs-display)',
              lineHeight: 0.9,
              letterSpacing: '-0.03em',
              color: 'var(--color-pure-white)',
              textWrap: 'balance',
            }}
          >
            {projectName}
          </ScrollFloat>
        </div>
      </div>

      {/* Content — a scroll timeline: each CaseStudySection pins its own
          title in the left rail as its content passes, and this beam line
          (sized off mainRef's real height, filled by overall scroll
          progress) tracks how far through the piece the reader is. */}
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: 'var(--section-y) var(--gutter)' }}>
        <main id="main-content" className="case-main" ref={mainRef} style={{ position: 'relative' }}>
          <CaseStudyBeamContext.Provider value={{ beamHeight, mainRef }}>
            {children}
          </CaseStudyBeamContext.Provider>

          <div className="case-beam-track" style={{ height }}>
            <motion.div
              className="case-beam"
              style={{ height: beamHeight, opacity: beamOpacity }}
            />
          </div>
        </main>
      </div>
    </div>
  )
}
