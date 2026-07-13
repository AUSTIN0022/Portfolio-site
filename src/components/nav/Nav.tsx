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
// The mobile menu glides open/closed on a soft eased tween instead of the
// snappy spring — no bounce, gentle deceleration, so it doesn't jump in/out.
const menuGlide = { type: 'tween' as const, duration: 0.4, ease: [0.16, 1, 0.3, 1] as const }

type TipState = { label: string; text: string; x: number } | null

export function Nav() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [vw, setVw] = useState(0)
  const [tip, setTip] = useState<TipState>(null)

  // Target width the menu card grows into (the pill morphs up to this).
  const cardWidth = Math.min(360, (vw || 375) - 24)

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
    const updateVw = () => setVw(window.innerWidth)
    update()
    updateVw()
    mq.addEventListener('change', update)
    window.addEventListener('resize', updateVw)
    return () => {
      mq.removeEventListener('change', update)
      window.removeEventListener('resize', updateVw)
    }
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
          // When the mobile menu opens, the pill fades as the card glides in
          // from the same spot — the card becomes the expanded island, so
          // there's no jarring pill-width snap.
          opacity: isMobile && open ? 0 : 1,
          scale: isMobile && open ? 0.96 : expanded ? 1 : 0.92,
          paddingLeft: padX,
          paddingRight: padX,
          paddingTop: expanded ? 10 : 8,
          paddingBottom: expanded ? 10 : 8,
          boxShadow: expanded
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
          borderRadius: '48px',
          display: 'flex',
          alignItems: 'center',
          columnGap: isMobile ? '10px' : '18px',
          maxWidth: 'calc(100vw - 24px)',
          pointerEvents: isMobile && open ? 'none' : 'auto',
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
            {/* The island morphs: the card's box grows from the pill's
                footprint (small, pill-radius) up to the full card, while the
                pill fades. overflow:hidden clips the fixed-width content so it
                is revealed as the box expands — the real Dynamic Island move. */}
            <motion.div
              id="mobile-menu"
              initial={{ opacity: 0, x: '-50%', width: 132, height: 52, borderRadius: 26 }}
              animate={{ opacity: 1, x: '-50%', width: cardWidth, height: 'auto', borderRadius: 28 }}
              exit={{ opacity: 0, x: '-50%', width: 132, height: 52, borderRadius: 26 }}
              transition={menuGlide}
              style={{
                position: 'fixed',
                // Sits exactly where the pill was so the growth feels
                // continuous — the pill appears to expand into this card.
                top: 'max(16px, env(safe-area-inset-top))',
                left: '50%',
                transformOrigin: 'center top',
                zIndex: 49,
                background: 'var(--color-pure-white)',
                boxShadow: '0 24px 60px rgba(0,0,0,0.22)',
                overflow: 'hidden',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'flex-start',
                maxWidth: 'calc(100vw - 24px)',
              }}
            >
              {/* Fixed-width content — held at the final width and centered so
                  it doesn't reflow while the card box is still growing. */}
              <div
                style={{
                  width: cardWidth,
                  flexShrink: 0,
                  boxSizing: 'border-box',
                  padding: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
              {/* Header row — mirrors the closed pill (A·M + toggle). */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px 10px',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-suisseintl)',
                    fontWeight: 500,
                    fontSize: '16px',
                    color: 'var(--color-ink-black)',
                    letterSpacing: '-0.02em',
                  }}
                >
                  A·M
                </span>
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setOpen(false)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '36px',
                    height: '36px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: 'var(--color-ink-black)',
                    borderRadius: '50%',
                    marginRight: '-6px',
                  }}
                >
                  <span aria-hidden style={{ position: 'relative', display: 'block', width: '16px', height: '16px' }}>
                    <span
                      style={{
                        position: 'absolute',
                        top: '7px',
                        left: 0,
                        width: '16px',
                        height: '2px',
                        background: 'currentColor',
                        borderRadius: '2px',
                        transform: 'rotate(45deg)',
                      }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        top: '7px',
                        left: 0,
                        width: '16px',
                        height: '2px',
                        background: 'currentColor',
                        borderRadius: '2px',
                        transform: 'rotate(-45deg)',
                      }}
                    />
                  </span>
                </button>
              </div>

              {navLinks.map(({ label, href, tip: itemTip }) => (
                <Link
                  key={label}
                  href={href}
                  onClick={() => setOpen(false)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '3px',
                    textDecoration: 'none',
                    padding: '10px 12px',
                    borderRadius: '14px',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-suisseintl)',
                      fontWeight: 500,
                      fontSize: '16px',
                      color: 'var(--color-ink-black)',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {label}
                  </span>
                  {/* The desktop tooltip text, surfaced as a subtitle since
                      touch has no hover. */}
                  <span
                    style={{
                      fontFamily: 'var(--font-suisseintl)',
                      fontWeight: 450,
                      fontSize: '12px',
                      color: 'var(--color-graphite)',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {itemTip}
                  </span>
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
                  marginTop: '6px',
                }}
              >
                Hire Me
              </a>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
