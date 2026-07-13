'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { WaveText } from '@/components/ui/WaveText'

const navLinks: { label: string; href: string; tip: string }[] = [
  { label: 'Work', href: '/work', tip: 'Selected projects & case studies' },
  { label: 'About', href: '/#about', tip: 'Who I am & how I work' },
  { label: 'Skills', href: '/#skills', tip: 'The stack I build with' },
  { label: 'Now', href: '/now', tip: "What I'm focused on right now" },
  { label: 'Contact', href: '/#contact', tip: "Let's build something" },
]

// Spring tuned to feel like the iOS Dynamic Island — quick, slightly springy,
// no overshoot wobble.
const islandSpring = { type: 'spring' as const, stiffness: 380, damping: 32, mass: 0.9 }

type TipState = { label: string; text: string; x: number } | null

export function Nav() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [tip, setTip] = useState<TipState>(null)

  // The island is "expanded" (links shown inline) at the top of the page.
  // Desktop also expands on hover; mobile stays contracted once the menu is
  // open (the vertical menu takes over) or once the user scrolls.
  const expanded = isMobile ? !scrolled && !open : !scrolled || hovered
  // On mobile the hamburger only appears once the island has closed (scrolled)
  // or the menu is open — at the very top the links are shown inline instead.
  const showToggle = isMobile && (scrolled || open)

  const navRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  // Measure the natural width of the links cluster so we can collapse it to 0
  // and grow it back without any layout jump. Re-measure when the breakpoint
  // changes (font size differs) and after fonts load so it isn't short.
  const linksRef = useRef<HTMLDivElement>(null)
  const [linksWidth, setLinksWidth] = useState(0)
  useLayoutEffect(() => {
    const measure = () => {
      if (linksRef.current) {
        setLinksWidth(Math.ceil(linksRef.current.getBoundingClientRect().width) + 2)
      }
    }
    measure()
    const raf = requestAnimationFrame(measure)
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      document.fonts.ready.then(measure)
    }
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', measure)
    }
  }, [isMobile])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 48)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close the mobile menu on Escape, and whenever the viewport grows
  // past the breakpoint where the full nav returns.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const mq = window.matchMedia('(min-width: 768px)')
    const onChange = () => mq.matches && setOpen(false)
    window.addEventListener('keydown', onKey)
    mq.addEventListener('change', onChange)
    return () => {
      window.removeEventListener('keydown', onKey)
      mq.removeEventListener('change', onChange)
    }
  }, [open])

  // Tooltips are a desktop pointer affordance only.
  const showTip = (e: React.SyntheticEvent, label: string, text: string) => {
    if (isMobile) return
    const navEl = navRef.current
    const target = e.currentTarget as HTMLElement
    if (!navEl) return
    const r = target.getBoundingClientRect()
    const nr = navEl.getBoundingClientRect()
    setTip({ label, text, x: r.left + r.width / 2 - nr.left })
  }
  const hideTip = (label: string) =>
    setTip((t) => (t && t.label === label ? null : t))

  const linkFontSize = isMobile ? '12px' : '14px'
  const padX = expanded ? (isMobile ? 12 : 16) : isMobile ? 10 : 12

  return (
    <>
      <motion.nav
        ref={navRef}
        onHoverStart={() => setHovered(true)}
        onHoverEnd={() => {
          setHovered(false)
          setTip(null)
        }}
        initial={{ x: '-50%', y: -20, opacity: 0 }}
        animate={{
          x: '-50%',
          y: 0,
          opacity: 1,
          scale: expanded || open ? 1 : 0.92,
          paddingLeft: padX,
          paddingRight: padX,
          paddingTop: expanded ? 10 : 8,
          paddingBottom: expanded ? 10 : 8,
          // No shadow while the menu is open — the pill sits flush on top of
          // the menu card (both white) so they read as one connected island;
          // the card provides the single shared shadow.
          boxShadow: open
            ? 'none'
            : expanded
              ? '0 10px 30px rgba(0,0,0,0.10)'
              : '0 6px 20px rgba(0,0,0,0.18)',
        }}
        transition={islandSpring}
        style={{
          position: 'fixed',
          top: 'max(16px, env(safe-area-inset-top))',
          left: '50%',
          transformOrigin: 'center top',
          zIndex: 50,
          background: 'var(--color-pure-white)',
          // When the menu is open the pill widens to the card width and its
          // corners match the card so the two merge into a single shape.
          borderRadius: isMobile && open ? '28px' : '48px',
          width: isMobile && open ? 'min(360px, calc(100vw - 24px))' : undefined,
          display: 'flex',
          alignItems: 'center',
          justifyContent: isMobile && open ? 'space-between' : undefined,
          columnGap: isMobile ? '10px' : '18px',
          maxWidth: 'calc(100vw - 24px)',
        }}
      >
        <Link
          href="/"
          aria-label="Austin Makasare — home"
          style={{
            fontFamily: 'var(--font-suisseintl)',
            fontWeight: 500,
            fontSize: '16px',
            color: 'var(--color-ink-black)',
            letterSpacing: '-0.02em',
            textDecoration: 'none',
            paddingLeft: '8px',
            flexShrink: 0,
          }}
        >
          <WaveText>A·M</WaveText>
        </Link>

        {/* Collapsible island content — the links cluster morphs to 0 width
            when the island contracts, then springs back on hover / at top. */}
        <motion.div
          aria-hidden={!expanded}
          animate={{
            width: expanded ? linksWidth : 0,
            opacity: expanded ? 1 : 0,
          }}
          transition={islandSpring}
          style={{ overflow: 'hidden', flexShrink: 0 }}
        >
          <div
            ref={linksRef}
            className="nav-links"
            style={{
              alignItems: 'center',
              gap: isMobile ? '13px' : '24px',
              width: 'max-content',
            }}
          >
            {navLinks.map(({ label, href, tip: itemTip }) => (
              <Link
                key={label}
                href={href}
                onClick={() => setOpen(false)}
                onMouseEnter={(e) => showTip(e, label, itemTip)}
                onMouseLeave={() => hideTip(label)}
                onFocus={(e) => showTip(e, label, itemTip)}
                onBlur={() => hideTip(label)}
                style={{
                  fontFamily: 'var(--font-suisseintl)',
                  fontWeight: 500,
                  fontSize: linkFontSize,
                  color: 'var(--color-graphite)',
                  letterSpacing: '-0.028px',
                  textDecoration: 'none',
                }}
                className="hover:text-black transition-colors duration-200"
              >
                <WaveText>{label}</WaveText>
              </Link>
            ))}
          </div>
        </motion.div>

        <a
          href="#contact"
          className="nav-cta"
          style={{
            background: 'var(--color-ink-black)',
            color: 'var(--color-pure-white)',
            fontFamily: 'var(--font-suisseintl)',
            fontWeight: 450,
            fontSize: '14px',
            borderRadius: '999px',
            padding: '10px 20px',
            letterSpacing: '-0.028px',
            textDecoration: 'none',
            flexShrink: 0,
          }}
        >
          <WaveText>Hire Me</WaveText>
        </a>

        <button
          type="button"
          className="nav-toggle"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((v) => !v)}
          style={{
            display: showToggle ? 'inline-flex' : 'none',
            alignItems: 'center',
            justifyContent: 'center',
            width: '40px',
            height: '40px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            color: 'var(--color-ink-black)',
            borderRadius: '50%',
            flexShrink: 0,
          }}
        >
          <span aria-hidden style={{ position: 'relative', display: 'block', width: '18px', height: '12px' }}>
            <span
              style={{
                position: 'absolute',
                left: 0,
                top: open ? '5px' : 0,
                width: '18px',
                height: '2px',
                background: 'currentColor',
                borderRadius: '2px',
                transform: open ? 'rotate(45deg)' : 'none',
                transition: 'transform 0.25s ease, top 0.25s ease, opacity 0.2s ease',
              }}
            />
            <span
              style={{
                position: 'absolute',
                left: 0,
                top: '5px',
                width: '18px',
                height: '2px',
                background: 'currentColor',
                borderRadius: '2px',
                opacity: open ? 0 : 1,
                transition: 'opacity 0.2s ease',
              }}
            />
            <span
              style={{
                position: 'absolute',
                left: 0,
                bottom: open ? '5px' : 0,
                width: '18px',
                height: '2px',
                background: 'currentColor',
                borderRadius: '2px',
                transform: open ? 'rotate(-45deg)' : 'none',
                transition: 'transform 0.25s ease, bottom 0.25s ease, opacity 0.2s ease',
              }}
            />
          </span>
        </button>

        {/* Tooltip lives at the nav level (overflow visible) so it can spill
            below the island like a Dynamic Island detaching a bubble. */}
        <AnimatePresence>
          {tip && expanded && (
            <motion.span
              key={tip.label}
              role="tooltip"
              // Centering (x: '-50%') must go through framer, not a CSS
              // transform — framer owns the `transform` property and would
              // otherwise clobber a plain translateX(-50%).
              initial={{ opacity: 0, x: '-50%', y: -6, scale: 0.8 }}
              animate={{ opacity: 1, x: '-50%', y: 0, scale: 1 }}
              exit={{ opacity: 0, x: '-50%', y: -6, scale: 0.85 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              style={{
                position: 'absolute',
                top: '100%',
                left: tip.x,
                marginTop: '14px',
                transformOrigin: 'center top',
                background: 'var(--color-ink-black)',
                color: 'var(--color-pure-white)',
                fontFamily: 'var(--font-suisseintl)',
                fontWeight: 450,
                fontSize: '12px',
                letterSpacing: '-0.01em',
                lineHeight: 1,
                whiteSpace: 'nowrap',
                padding: '8px 12px',
                borderRadius: '999px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
                pointerEvents: 'none',
              }}
            >
              {/* little pointer notch, like the island detaching a bubble */}
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 0,
                  height: 0,
                  borderLeft: '5px solid transparent',
                  borderRight: '5px solid transparent',
                  borderBottom: '6px solid var(--color-ink-black)',
                }}
              />
              {tip.text}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.nav>

      <AnimatePresence>
        {open && (
          <>
            <motion.button
              type="button"
              aria-label="Close menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setOpen(false)}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 48,
                background: 'rgba(0,0,0,0.35)',
                border: 'none',
                cursor: 'pointer',
              }}
            />
            {/* Menu grows out of the island like a Dynamic Island expanding. */}
            <motion.div
              id="mobile-menu"
              initial={{ opacity: 0, x: '-50%', y: -10, scale: 0.85 }}
              animate={{ opacity: 1, x: '-50%', y: 0, scale: 1 }}
              exit={{ opacity: 0, x: '-50%', y: -10, scale: 0.9 }}
              transition={islandSpring}
              style={{
                position: 'fixed',
                // Start at the pill's own top so the card sits directly behind
                // it — the pill becomes the card's header row, one connected
                // island. Top padding clears that header (pill is ~52px tall).
                top: 'max(16px, env(safe-area-inset-top))',
                left: '50%',
                transformOrigin: 'center top',
                zIndex: 49,
                width: 'min(360px, calc(100vw - 24px))',
                background: 'var(--color-pure-white)',
                borderRadius: '28px',
                padding: '58px 12px 12px',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 24px 60px rgba(0,0,0,0.22)',
              }}
            >
              {navLinks.map(({ label, href }) => (
                <Link
                  key={label}
                  href={href}
                  onClick={() => setOpen(false)}
                  style={{
                    fontFamily: 'var(--font-suisseintl)',
                    fontWeight: 500,
                    fontSize: '16px',
                    color: 'var(--color-ink-black)',
                    letterSpacing: '-0.02em',
                    textDecoration: 'none',
                    padding: '14px 16px',
                    borderRadius: '14px',
                  }}
                >
                  {label}
                </Link>
              ))}
              <a
                href="#contact"
                onClick={() => setOpen(false)}
                style={{
                  background: 'var(--color-ink-black)',
                  color: 'var(--color-pure-white)',
                  fontFamily: 'var(--font-suisseintl)',
                  fontWeight: 500,
                  fontSize: '15px',
                  borderRadius: '999px',
                  padding: '14px 16px',
                  letterSpacing: '-0.02em',
                  textDecoration: 'none',
                  textAlign: 'center',
                  marginTop: '4px',
                }}
              >
                Hire Me
              </a>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
