'use client'

import { RotatingWord } from '@/components/ui/RotatingWord'
import { HeroDiagram } from '@/components/sections/HeroDiagram'

export function Hero() {
    return (
        <section
            className="hero-section"
            style={{ background: 'var(--color-bg)', minHeight: 'var(--hero-min-h)' }}
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
                <div data-gsap="heading">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                        <span
                            style={{
                                fontFamily: 'var(--font-suisseintlmono)',
                                fontSize: '12px',
                                color: 'var(--color-fg-muted)',
                                letterSpacing: '-0.36px',
                            }}
                        >
            // AUSTIN MAKASARE
                        </span>
                    </div>

                    <h1
                        className="hero-headline"
                        data-shoot-target="1"
                        data-shoot-granularity="char"
                        style={{
                            fontFamily: 'var(--font-suisseintlcond)',
                            fontWeight: 700,
                            fontSize: 'clamp(38px, 7vw, 68px)',
                            lineHeight: 0.9,
                            letterSpacing: '-0.03em',
                            color: 'var(--color-fg)',
                            maxWidth: '680px',
                            marginBottom: '32px',
                            textWrap: 'balance',
                        }}
                    >
                        BACKEND ENGINEER BUILDING <RotatingWord /> THAT SCALE.
                    </h1>

                    <p
                        style={{
                            fontFamily: 'var(--font-suisseintl)',
                            fontWeight: 400,
                            fontSize: '18px',
                            lineHeight: 1.25,
                            color: 'var(--color-fg-muted)',
                            maxWidth: '480px',
                            letterSpacing: '-0.18px',
                            marginBottom: '40px',
                        }}
                    >
                        Queues, locks, and distributed infrastructure: the systems that stay up when everything else is on fire.
                    </p>

                    <div style={{ display: 'flex', gap: '16px' }}>
                        <a href="#work" className="btn-sketch btn-sketch--primary">
                            See What I&apos;ve Shipped
                        </a>
                        <a
                            href="https://cal.com/austinmakasare"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-sketch"
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
                    <HeroDiagram />
                </div>
            </div>
        </section>
    )
}
