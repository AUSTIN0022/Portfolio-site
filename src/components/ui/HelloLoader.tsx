'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

// One entry per language shown while the page boots. Kept short (single
// greeting word) so each one reads instantly at the loader's display size.
const GREETINGS = [
  { lang: 'ENGLISH', word: 'Hello' },
  { lang: 'HINDI', word: 'नमस्ते' },
  { lang: 'SPANISH', word: 'Hola' },
  { lang: 'FRENCH', word: 'Bonjour' },
  { lang: 'JAPANESE', word: 'こんにちは' },
  { lang: 'CHINESE', word: '你好' },
  { lang: 'ITALIAN', word: 'Ciao' },
]

const WORD_INTERVAL_MS = 350
const FADE_OUT_S = 0.5

export function HelloLoader() {
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(true)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
  }, [])

  // Locks scroll only while the loader is actually covering the page —
  // released the instant the fade-out starts, not after it finishes, so
  // the reveal underneath doesn't feel locked a beat longer than it looks.
  useEffect(() => {
    document.body.style.overflow = visible ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [visible])

  useEffect(() => {
    // Cycling text that can't be paused fails WCAG 2.2.2 — for reduced
    // motion, skip the rotation and just clear the loader quickly instead.
    if (reducedMotion) {
      const t = setTimeout(() => setVisible(false), 400)
      return () => clearTimeout(t)
    }

    let i = 0
    const cycle = setInterval(() => {
      i += 1
      if (i >= GREETINGS.length) {
        clearInterval(cycle)
        setVisible(false)
        return
      }
      setIndex(i)
    }, WORD_INTERVAL_MS)

    return () => clearInterval(cycle)
  }, [reducedMotion])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="hello-loader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: FADE_OUT_S, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            // Same electric-yellow the body already falls back to before
            // CSS/JS finish loading (see globals.css) — the loader is a
            // seamless continuation of that color, not a new one.
            background: 'var(--color-electric-yellow)',
          }}
        >
          <span className="sr-only" role="status">
            Loading Austin Makasare&apos;s portfolio
          </span>
          <div aria-hidden="true" style={{ textAlign: 'center' }}>
            <AnimatePresence>
              <motion.span
                key={GREETINGS[index].lang}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  display: 'block',
                  fontFamily: 'var(--font-suisseintlcond)',
                  fontWeight: 700,
                  fontSize: 'clamp(3rem, 12vw, 6.5rem)',
                  lineHeight: 0.9,
                  letterSpacing: '-0.03em',
                  color: 'var(--color-ink-black)',
                }}
              >
                {GREETINGS[index].word}
              </motion.span>
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
