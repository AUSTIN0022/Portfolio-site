'use client'

import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
}

const rowFont = {
  fontFamily: 'var(--font-suisseintlcond)',
  fontWeight: 700,
  letterSpacing: '-0.03em',
  lineHeight: 0.9,
  color: 'var(--color-ink-black)',
} as const

const wordStyle = { ...rowFont, fontSize: 'clamp(4.5rem, 13vw, 13rem)' }
const ampStyle = {
  ...rowFont,
  fontWeight: 400,
  fontSize: 'clamp(2.25rem, 6vw, 5rem)',
  color: 'var(--color-muted-on-light)',
  margin: '0 clamp(20px, 4vw, 56px)',
}

export function DomainMarquee() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const trackTopRef = useRef<HTMLDivElement>(null)
  const trackBottomRef = useRef<HTMLDivElement>(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    const section = sectionRef.current
    const trackTop = trackTopRef.current
    const trackBottom = trackBottomRef.current
    if (!section || !trackTop || !trackBottom) return

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia()

      // Reduced-motion users get the fully visible, static rows — no
      // scroll-linked travel — matching this codebase's convention in
      // useScrollAnimation.ts and ScrollFloat.tsx.
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const calculateValues = (trackEl: HTMLDivElement) => {
          const viewport = window.innerWidth
          const maxTravel = Math.max(trackEl.scrollWidth - viewport, 0)
          const offscreenRight = Math.min(viewport * 0.9, 900)
          const offscreenLeft = -Math.min(maxTravel + viewport * 0.2, maxTravel + 900)
          const endLeft = -Math.min(maxTravel, viewport * 0.95)
          const endRight = Math.min(viewport * 0.9, 900)
          return { offscreenRight, offscreenLeft, endLeft, endRight }
        }

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: 'top bottom',
            end: 'bottom top',
            scrub: 0.16,
            fastScrollEnd: true,
            invalidateOnRefresh: true,
          },
        })

        if (isMobile) {
          // A small nudge, not the full off-screen travel — avoids
          // excessive horizontal overflow on small screens.
          tl.to(trackTop, { x: -60, ease: 'none' }, 0)
          tl.to(trackBottom, { x: 60, ease: 'none' }, 0)
        } else {
          tl.fromTo(
            trackTop,
            { x: () => calculateValues(trackTop).offscreenRight },
            { x: () => calculateValues(trackTop).endLeft, ease: 'none' },
            0
          )
          tl.fromTo(
            trackBottom,
            { x: () => calculateValues(trackBottom).offscreenLeft },
            { x: () => calculateValues(trackBottom).endRight, ease: 'none' },
            0
          )
        }

        return () => {
          tl.scrollTrigger?.kill()
        }
      })
    }, section)

    return () => ctx.revert()
  }, [isMobile])

  return (
    <section
      ref={sectionRef}
      aria-label="Backend, APIs, systems, and infrastructure"
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: 'var(--color-canvas-mist)',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: '0 auto 0 0',
          width: '10vw',
          minWidth: '60px',
          background: 'linear-gradient(90deg, var(--color-canvas-mist), transparent)',
          zIndex: 2,
          pointerEvents: 'none',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: '0 0 0 auto',
          width: '10vw',
          minWidth: '60px',
          background: 'linear-gradient(270deg, var(--color-canvas-mist), transparent)',
          zIndex: 2,
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'clamp(48px, 9vw, 120px)',
          width: '100%',
        }}
      >
        <div
          ref={trackTopRef}
          style={{
            display: 'flex',
            alignItems: 'center',
            width: 'max-content',
            willChange: 'transform',
          }}
        >
          <span style={wordStyle}>BACKEND</span>
          <span style={ampStyle}>&amp;</span>
          <span style={wordStyle}>APIs</span>
        </div>

        <div
          ref={trackBottomRef}
          style={{
            display: 'flex',
            alignItems: 'center',
            width: 'max-content',
            willChange: 'transform',
          }}
        >
          <span style={wordStyle}>SYSTEMS</span>
          <span style={ampStyle}>&amp;</span>
          <span style={wordStyle}>INFRA</span>
        </div>
      </div>
    </section>
  )
}
