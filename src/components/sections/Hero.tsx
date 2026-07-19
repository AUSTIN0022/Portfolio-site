'use client'

import { motion } from 'framer-motion'
import { AvailablePill } from '@/components/ui/AvailablePill'
import { RotatingWord } from '@/components/ui/RotatingWord'
import { LazyCanvas } from '@/components/three/LazyCanvas'
import { HeroScene } from '@/components/three/HeroScene'

export function Hero() {
    return (
        <section
            className="hero-section"
            style={{ background: 'var(--color-canvas-mist)', minHeight: 'var(--hero-min-h)' }}
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
                                color: 'var(--color-graphite)',
                                letterSpacing: '-0.36px',
                            }}
                        >
            // AUSTIN MAKASARE
                        </span>
                        <AvailablePill>OPEN TO BACKEND ROLES</AvailablePill>
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
                            color: 'var(--color-ink-black)',
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
                            color: 'var(--color-graphite)',
                            maxWidth: '480px',
                            letterSpacing: '-0.18px',
                            marginBottom: '40px',
                        }}
                    >
                        Queues, locks, and distributed infrastructure — the systems that stay up when everything else is on fire.
                    </p>

                    <div style={{ display: 'flex', gap: '16px' }}>
                        <a
                            href="#work"
                            style={{
                                background: 'var(--color-ink-black)',
                                color: 'var(--color-pure-white)',
                                fontFamily: 'var(--font-suisseintl)',
                                fontWeight: 500,
                                fontSize: '14px',
                                borderRadius: '4px',
                                padding: '12px 24px',
                                textDecoration: 'none',
                            }}
                        >
                            See What I&apos;ve Shipped
                        </a>
                        <a
                            href="https://cal.com/austinmakasare"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                background: 'transparent',
                                color: 'var(--color-ink-black)',
                                border: '1px solid var(--color-ink-black)',
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
                    }}
                >
                    <LazyCanvas
                        camera={{ position: [4.9, 18.8, 35], fov: 26 }}
                        style={{ width: '100%', height: '100%' }}
                    >
                        <HeroScene />
                    </LazyCanvas>
                </div>
            </div>
        </section>
    )
}
