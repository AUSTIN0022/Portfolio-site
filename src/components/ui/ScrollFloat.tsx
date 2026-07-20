'use client'

import { useEffect, useMemo, useRef, type CSSProperties, type ElementType, type ReactNode } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

import './ScrollFloat.css'

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
}

interface ScrollFloatProps {
  children: ReactNode
  /** Wrapping tag. Defaults to 'h2' (the React Bits default) — override to
   * match the surrounding heading hierarchy (e.g. 'h3' for card titles,
   * 'div' for non-heading display numbers like the Stats strip). */
  as?: ElementType
  scrollContainerRef?: React.RefObject<HTMLElement>
  containerClassName?: string
  textClassName?: string
  /** Applied to the outer element — this is how every other heading on the
   * site sets its typography (inline style, not utility classes), so
   * ScrollFloat follows the same convention instead of inventing a new one. */
  style?: CSSProperties
  animationDuration?: number
  ease?: string
  scrollStart?: string
  scrollEnd?: string
  stagger?: number
}

/**
 * React Bits' ScrollFloat, adapted to this codebase:
 *  - TypeScript props instead of the upstream JS component.
 *  - `as` prop instead of a hardcoded <h2> — the upstream version forces
 *    every instance into an h2, which would inject incorrect entries into
 *    the page's heading outline wherever this wraps a card title or a
 *    non-heading display number (see the Skills section's existing
 *    sr-only-h2 comment about heading nav order; the same care applies here).
 *  - `style` passthrough instead of the upstream's opinionated CSS-file
 *    font-size/weight — every heading on this site sets its own typography
 *    inline via the SuisseIntlCond display scale, so ScrollFloat gets out of
 *    the way rather than overriding it.
 *  - `prefers-reduced-motion` handling via gsap.matchMedia, matching the
 *    pattern in useScrollAnimation.ts: reduced-motion users get the fully
 *    visible text with no scrub, never a permanently-hidden opacity:0 span.
 *  - non-string children render as-is, unanimated, instead of silently
 *    disappearing (the upstream splitText only handles string children).
 */
export default function ScrollFloat({
  children,
  as = 'h2',
  scrollContainerRef,
  containerClassName = '',
  textClassName = '',
  style,
  animationDuration = 1,
  ease = 'back.inOut(2)',
  scrollStart = 'center bottom+=50%',
  scrollEnd = 'bottom bottom-=40%',
  stagger = 0.03,
}: ScrollFloatProps) {
  const containerRef = useRef<HTMLElement>(null)
  const isPlainString = typeof children === 'string'

  const splitText = useMemo(() => {
    if (!isPlainString) return null
    return (children as string).split('').map((char, index) => (
      <span className="char" key={index}>
        {char === ' ' ? ' ' : char}
      </span>
    ))
  }, [children, isPlainString])

  useEffect(() => {
    const el = containerRef.current
    if (!el || !isPlainString) return

    const scroller = scrollContainerRef?.current ?? window
    const charElements = el.querySelectorAll('.char')
    if (!charElements.length) return

    const mm = gsap.matchMedia()

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo(
        charElements,
        {
          willChange: 'opacity, transform',
          opacity: 0,
          yPercent: 120,
          scaleY: 2.3,
          scaleX: 0.7,
          transformOrigin: '50% 0%',
        },
        {
          duration: animationDuration,
          ease,
          opacity: 1,
          yPercent: 0,
          scaleY: 1,
          scaleX: 1,
          stagger,
          scrollTrigger: {
            trigger: el,
            scroller,
            start: scrollStart,
            end: scrollEnd,
            scrub: true,
          },
        }
      )
    })

    return () => mm.revert()
  }, [isPlainString, scrollContainerRef, animationDuration, ease, scrollStart, scrollEnd, stagger])

  // `as any`: a polymorphic `as`-prop component genuinely can't be typed
  // precisely against JSX.IntrinsicElements without heavy generic
  // gymnastics (TS narrows the union to `never` otherwise) — the public
  // props stay fully typed via ScrollFloatProps above, only this internal
  // render escapes the checker.
  const Tag = as as any

  if (!isPlainString) {
    return (
      <Tag ref={containerRef} className={`scroll-float ${containerClassName}`} style={style}>
        {children}
      </Tag>
    )
  }

  return (
    <Tag ref={containerRef} className={`scroll-float ${containerClassName}`} style={style}>
      <span className={`scroll-float-text ${textClassName}`}>{splitText}</span>
    </Tag>
  )
}
