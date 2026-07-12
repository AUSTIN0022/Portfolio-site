'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { WaveText } from '@/components/ui/WaveText'

const navLinks: { label: string; href: string }[] = [
  { label: 'Work', href: '/work' },
  { label: 'About', href: '/#about' },
  { label: 'Skills', href: '/#skills' },
  { label: 'Now', href: '/now' },
  { label: 'Contact', href: '/#contact' },
]

export function Nav() {
  const [open, setOpen] = useState(false)

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

  return (
    <>
      <motion.nav
        initial={{ x: '-50%', y: -20, opacity: 0 }}
        animate={{ x: '-50%', y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position: 'fixed',
          top: 'max(16px, env(safe-area-inset-top))',
          left: '50%',
          zIndex: 50,
          background: '#ffffff',
          borderRadius: '48px',
          display: 'flex',
          alignItems: 'center',
          gap: '32px',
          padding: '10px 16px',
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
            color: '#000000',
            letterSpacing: '-0.02em',
            textDecoration: 'none',
            paddingLeft: '8px',
          }}
        >
          <WaveText>A·M</WaveText>
        </Link>

        <div className="nav-links" style={{ alignItems: 'center', gap: '24px' }}>
          {navLinks.map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              style={{
                fontFamily: 'var(--font-suisseintl)',
                fontWeight: 500,
                fontSize: '14px',
                color: '#444444',
                letterSpacing: '-0.028px',
                textDecoration: 'none',
              }}
              className="hover:text-black transition-colors duration-200"
            >
              <WaveText>{label}</WaveText>
            </Link>
          ))}
        </div>

        <a
          href="#contact"
          className="nav-cta"
          style={{
            background: '#000000',
            color: '#ffffff',
            fontFamily: 'var(--font-suisseintl)',
            fontWeight: 450,
            fontSize: '14px',
            borderRadius: '4px',
            padding: '10px 20px',
            letterSpacing: '-0.028px',
            textDecoration: 'none',
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
            alignItems: 'center',
            justifyContent: 'center',
            width: '40px',
            height: '40px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            color: '#000000',
            borderRadius: '50%',
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
            <motion.div
              id="mobile-menu"
              initial={{ opacity: 0, x: '-50%', y: -12 }}
              animate={{ opacity: 1, x: '-50%', y: 0 }}
              exit={{ opacity: 0, x: '-50%', y: -12 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: 'fixed',
                top: 'calc(max(16px, env(safe-area-inset-top)) + 64px)',
                left: '50%',
                zIndex: 49,
                width: 'min(360px, calc(100vw - 24px))',
                background: '#ffffff',
                borderRadius: '24px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
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
                    color: '#000000',
                    letterSpacing: '-0.02em',
                    textDecoration: 'none',
                    padding: '14px 16px',
                    borderRadius: '12px',
                  }}
                >
                  {label}
                </Link>
              ))}
              <a
                href="#contact"
                onClick={() => setOpen(false)}
                style={{
                  background: '#000000',
                  color: '#ffffff',
                  fontFamily: 'var(--font-suisseintl)',
                  fontWeight: 500,
                  fontSize: '15px',
                  borderRadius: '12px',
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
