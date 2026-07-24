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

const wordStyle = { ...rowFont, fontSize: 'clamp(3.25rem, 10vw, 10rem)' }
const ampStyle = {
  ...rowFont,
  fontWeight: 400,
  fontSize: 'clamp(2rem, 5vw, 4rem)',
  color: 'var(--color-muted-on-light)',
  margin: '0 clamp(16px, 3vw, 40px)',
}
const listLabelStyle = {
  fontFamily: 'var(--font-suisseintlmono)',
  fontSize: '12px',
  color: 'var(--color-muted-on-light)',
  letterSpacing: '0.2em',
  textTransform: 'uppercase' as const,
}
const listItemStyle = {
  fontFamily: 'var(--font-suisseintl)',
  fontWeight: 600,
  fontSize: '16px',
  color: 'var(--color-graphite)',
  letterSpacing: '-0.02em',
}

const row1List = ['Node.js APIs', 'RESTful Design', 'Authentication', 'Real-time WebSockets']
const row2List = ['Distributed Queues', 'Redis-Backed Locking', 'AWS Auto-Scaling', 'Zero-Downtime Deploys']

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
        padding: 'clamp(48px, 8vw, 96px) 0',
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(24px, 4vw, 48px)' }}>
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

          {!isMobile && (
            <div
              style={{
                marginLeft: 'clamp(32px, 6vw, 96px)',
                paddingRight: '80px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <span style={listLabelStyle}>Services</span>
              <div
                style={{
                  height: '1px',
                  width: '32px',
                  background: 'var(--color-muted-on-light)',
                  opacity: 0.4,
                  marginBottom: '4px',
                }}
              />
              {row1List.map((item) => (
                <span key={item} style={listItemStyle}>
                  {item}
                </span>
              ))}
            </div>
          )}
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

          {!isMobile && (
            <div
              style={{
                marginLeft: 'clamp(32px, 6vw, 96px)',
                paddingRight: '80px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                textAlign: 'right',
              }}
            >
              <span style={listLabelStyle}>Focus</span>
              <div
                style={{
                  height: '1px',
                  width: '32px',
                  background: 'var(--color-muted-on-light)',
                  opacity: 0.4,
                  marginBottom: '4px',
                  marginLeft: 'auto',
                }}
              />
              {row2List.map((item) => (
                <span key={item} style={listItemStyle}>
                  {item}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
