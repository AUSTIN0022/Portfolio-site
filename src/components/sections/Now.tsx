'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { MonoKicker } from '@/components/ui/MonoKicker'
import { nowData } from '@/content/now'

const rows = [
  { icon: '🏗', label: 'BUILDING', value: nowData.building },
  { icon: '📖', label: 'LEARNING', value: nowData.learning },
  { icon: '📍', label: 'STATUS', value: nowData.status },
]

const ROTATE_MS = 4200

function Row({ row }: { row: (typeof rows)[number] }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '120px minmax(0, 1fr)',
        gap: '24px',
        alignItems: 'start',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-suisseintlmono)',
          fontSize: '12px',
          color: 'var(--color-fg-muted)',
          letterSpacing: '-0.36px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span>{row.icon}</span>
        <span>{row.label}</span>
      </div>
      <div
        style={{
          fontFamily: 'var(--font-suisseintl)',
          fontWeight: 400,
          fontSize: '16px',
          lineHeight: 1.33,
          color: 'var(--color-fg)',
          letterSpacing: '-0.32px',
          textWrap: 'pretty',
        }}
      >
        {row.value}
      </div>
    </div>
  )
}

/**
 * Now — homepage teaser for /now. A live mini-preview: cycles through the
 * same Building/Learning/Status data the dedicated page shows, one at a
 * time, so the teaser itself feels alive instead of a static row list.
 * Pauses on hover/focus and while off-screen, and skips rotation entirely
 * for prefers-reduced-motion (renders every row statically instead — same
 * content, no motion, matching this codebase's reduced-motion convention).
 */
export function Now() {
  const [index, setIndex] = useState(0)
  const [rotating, setRotating] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: no-preference)')
    setRotating(mq.matches)
    const onChange = () => setRotating(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (!rotating) return
    const el = cardRef.current
    if (!el) return

    let visible = true
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting
      },
      { threshold: 0.4 }
    )
    io.observe(el)

    const id = setInterval(() => {
      if (!visible || pausedRef.current) return
      setIndex((i) => (i + 1) % rows.length)
    }, ROTATE_MS)

    return () => {
      io.disconnect()
      clearInterval(id)
    }
  }, [rotating])

  const active = rows[index]

  return (
    <section id="now" style={{ background: 'var(--color-bg)', padding: 'var(--section-y) var(--gutter)' }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        <div data-gsap="heading">
          <MonoKicker>// NOW</MonoKicker>
        </div>

        <div
          ref={cardRef}
          data-gsap="card"
          onMouseEnter={() => {
            pausedRef.current = true
          }}
          onMouseLeave={() => {
            pausedRef.current = false
          }}
          onFocus={() => {
            pausedRef.current = true
          }}
          onBlur={() => {
            pausedRef.current = false
          }}
          style={{
            marginTop: '48px',
            maxWidth: '640px',
            border: '1px solid var(--color-fg)',
            borderRadius: '24px',
            padding: '32px',
            position: 'relative',
            overflow: 'hidden',
            minHeight: '148px',
          }}
        >
          {rotating ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              >
                <Row row={active} />
              </motion.div>
            </AnimatePresence>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {rows.map((row) => (
                <Row key={row.label} row={row} />
              ))}
            </div>
          )}

          {rotating && (
            <div style={{ display: 'flex', gap: '6px', marginTop: '24px' }}>
              {rows.map((row, i) => (
                <button
                  key={row.label}
                  type="button"
                  aria-label={`Show ${row.label.toLowerCase()}`}
                  aria-current={i === index}
                  onClick={() => setIndex(i)}
                  style={{
                    width: i === index ? '20px' : '6px',
                    height: '6px',
                    borderRadius: '3px',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    background:
                      i === index
                        ? 'var(--color-fg)'
                        : 'color-mix(in srgb, var(--color-fg) 20%, transparent)',
                    transition: 'width 0.3s var(--ease-spring), background 0.3s ease',
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <div style={{ marginTop: '32px' }}>
          <Link
            href="/now"
            style={{
              fontFamily: 'var(--font-suisseintlmono)',
              fontSize: '12px',
              color: 'var(--color-fg-muted)',
              letterSpacing: '-0.36px',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
            className="hover:text-[var(--color-fg)] transition-colors duration-200"
          >
            What I&apos;m working on →
          </Link>
        </div>
      </div>
    </section>
  )
}
