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
    // Group chars by word before splitting into per-char spans: each char
    // becomes its own inline-block box (required for the yPercent/scaleY
    // reveal below), and separate inline-block boxes are a line-break
    // opportunity to the browser even with no whitespace between them — so
    // without a word-level wrapper, a line can break mid-word (see the
    // `WaveText` convention this mirrors, and DESIGN.md's note on it).
    // The space between words must be a sibling of the word spans, not a
    // child of one — a space as the last child of an inline-block collapses
    // to zero width (trailing whitespace inside its own box gets trimmed),
    // so it has to sit outside in the surrounding normal-flow text.
    const words = (children as string).split(' ')
    const nodes: ReactNode[] = []
    words.forEach((word, wordIndex) => {
      nodes.push(
        <span className="word" key={`word-${wordIndex}`}>
          {word.split('').map((char, charIndex) => (
            <span className="char" key={charIndex}>
              {char}
            </span>
          ))}
        </span>
      )
      if (wordIndex < words.length - 1) nodes.push(' ')
    })
    return nodes
  }, [children, isPlainString])

  useEffect(() => {
    const el = containerRef.current
    if (!el || !isPlainString) return

    let mm: gsap.MatchMedia | null = null

    const initGsap = () => {
      const scroller = scrollContainerRef?.current ?? window
      const charElements = el.querySelectorAll('.char')
      if (!charElements.length) return

      mm = gsap.matchMedia()
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
            onComplete: () => {
              gsap.set(charElements, { clearProps: 'willChange' })
            },
            scrollTrigger: {
              trigger: el,
              scroller,
              start: scrollStart,
              end: scrollEnd,
              scrub: 0.5,
              fastScrollEnd: true,
            },
          }
        )
      })
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          initGsap()
          observer.disconnect()
        }
      },
      { rootMargin: '200px' }
    )

    observer.observe(el)

    return () => {
      observer.disconnect()
      if (mm) mm.revert()
    }
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
