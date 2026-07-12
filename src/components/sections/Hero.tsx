'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import { AvailablePill } from '@/components/ui/AvailablePill'
import { RotatingWord } from '@/components/ui/RotatingWord'

export function Hero() {
  return (
    <section
      className="hero-section"
      style={{ background: '#e5e7eb', minHeight: 'var(--hero-min-h)' }}
    >
      <div
        className="hero-inner"
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'var(--hero-cols)',
          alignItems: 'center',
          gap: '40px',
        }}
      >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <span
            style={{
              fontFamily: 'var(--font-suisseintlmono)',
              fontSize: '12px',
              color: '#444444',
              letterSpacing: '-0.36px',
            }}
          >
            // AUSTIN MAKASARE
          </span>
          <AvailablePill>AVAILABLE FOR WORK</AvailablePill>
        </div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
          className="hero-headline"
          style={{
            fontFamily: 'var(--font-suisseintlcond)',
            fontWeight: 700,
            fontSize: 'clamp(38px, 7vw, 68px)',
            lineHeight: 0.9,
            letterSpacing: '-0.03em',
            color: '#000000',
            maxWidth: '680px',
            marginBottom: '32px',
            textWrap: 'balance',
          }}
        >
          BACKEND ENGINEER BUILDING <RotatingWord /> THAT SCALE.
        </motion.h1>

        <p
          style={{
            fontFamily: 'var(--font-suisseintl)',
            fontWeight: 400,
            fontSize: '18px',
            lineHeight: 1.25,
            color: '#444444',
            maxWidth: '480px',
            letterSpacing: '-0.18px',
            marginBottom: '40px',
          }}
        >
          Queues, locks, and distributed infrastructure — production systems that don&apos;t break.
        </p>

        <div style={{ display: 'flex', gap: '16px' }}>
          <a
            href="#work"
            style={{
              background: '#000000',
              color: '#ffffff',
              fontFamily: 'var(--font-suisseintl)',
              fontWeight: 500,
              fontSize: '14px',
              borderRadius: '4px',
              padding: '12px 24px',
              textDecoration: 'none',
            }}
          >
            View My Work
          </a>
          <a
            href="https://cal.com/austinmakasare"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: 'transparent',
              color: '#000000',
              border: '1px solid #000000',
              fontFamily: 'var(--font-suisseintl)',
              fontWeight: 500,
              fontSize: '14px',
              borderRadius: '4px',
              padding: '12px 24px',
              textDecoration: 'none',
            }}
          >
            Book a Call
          </a>
        </div>
      </div>

      <div
        className="hero-canvas"
        style={{
          height: 'var(--hero-canvas-h)',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Image
          src="/hero-illustration.png"
          alt="Illustration of stacked backend infrastructure blocks — servers, queues, and databases"
          fill
          priority
          sizes="(max-width: 1024px) 90vw, 45vw"
          style={{ objectFit: 'contain' }}
        />
      </div>
      </div>
    </section>
  )
}
