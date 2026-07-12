'use client'

import { useEffect, useState } from 'react'

const ROTATING_WORDS = ['SYSTEMS', 'QUEUES', 'PIPELINES', 'PLATFORMS', 'PRODUCTS']
const INTERVAL_MS = 2200 // how long each word shows
const FLIP_DURATION_MS = 400 // animation duration

// Longest word decides the box width so the headline never reflows as
// shorter/longer words swap in ("PIPELINES"/"PLATFORMS" are the widest at 9
// chars — a fixed 4ch box, sized for "QUEUES", would jump on every swap).
const MIN_WIDTH_CH = Math.max(...ROTATING_WORDS.map((w) => w.length)) + 0.5

export function RotatingWord() {
  const [index, setIndex] = useState(0)
  const [animating, setAnimating] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const onChange = () => setReducedMotion(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    // Auto-cycling text runs indefinitely, which WCAG 2.2.2 requires be
    // pausable — simplest compliant answer here is to not auto-advance at
    // all for users who've asked for reduced motion, and just show the
    // first word.
    if (reducedMotion) return
    const timer = setInterval(() => {
      setAnimating(true)
      setTimeout(() => {
        setIndex((i) => (i + 1) % ROTATING_WORDS.length)
        setAnimating(false)
      }, FLIP_DURATION_MS)
    }, INTERVAL_MS)
    return () => clearInterval(timer)
  }, [reducedMotion])

  return (
    <span
      style={{
        display: 'inline-block',
        background: 'var(--color-electric-yellow)',
        color: 'var(--color-ink-black)',
        lineHeight: 1, // decoupled from the h1's tight 0.9 leading so the
        // box hugs the glyphs instead of bleeding into the lines above/below
        padding: '0.08em 0.14em',
        // perspective() as a transform function (not the standalone
        // `perspective` property) is what actually gives this element's own
        // rotateX depth — `perspective` alone only affects children.
        transform: animating
          ? 'perspective(400px) rotateX(90deg)'
          : 'perspective(400px) rotateX(0deg)',
        transition: reducedMotion ? 'none' : `transform ${FLIP_DURATION_MS}ms ease`,
        transformOrigin: 'center bottom',
        minWidth: `${MIN_WIDTH_CH}ch`,
        textAlign: 'center',
      }}
    >
      {ROTATING_WORDS[index]}
    </span>
  )
}
