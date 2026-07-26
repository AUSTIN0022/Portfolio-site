'use client'

import { HeroDiagram } from '@/components/sections/HeroDiagram'

export function Hero() {
    return (
        <section
            className="hero-section"
            style={{ background: 'var(--color-bg)' }}
        >
            <div
                className="hero-inner"
                style={{
                    maxWidth: '1280px',
                    margin: '0 auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--hero-row-gap)',
                }}
            >
                {/* Top row: name + tags + CTAs on the left, the "01 /" index
                    and location meta on the right — laid out as a matched
                    pair of columns so the two blocks start at the same
                    baseline, the way an editorial masthead splits a spread. */}
                <div className="hero-row" data-gsap="heading">
                    <div className="hero-col-primary">
                        <h1
                            className="hero-headline"
                            data-shoot-target="1"
                            data-shoot-granularity="char"
                            style={{
                                fontFamily: 'var(--font-hero-display)',
                                fontWeight: 900,
                                fontSize: 'clamp(48px, 7.4vw, 108px)',
                                lineHeight: 0.88,
                                letterSpacing: '-0.035em',
                                color: 'var(--color-fg)',
                                marginBottom: '24px',
                                textWrap: 'balance',
                            }}
                        >
                            AUSTIN
                            <br />
                            MAKASARE
                        </h1>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
                            {['Node.js', 'PostgreSQL', 'Redis', 'Docker'].map((tag) => (
                                <span
                                    key={tag}
                                    style={{
                                        fontFamily: 'var(--font-suisseintlmono)',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        color: 'var(--color-fg-muted)',
                                        letterSpacing: '-0.2px',
                                        background: 'var(--color-chip-bg)',
                                        border: '1px solid color-mix(in srgb, var(--color-fg) 8%, transparent)',
                                        borderRadius: 'var(--radius-tags)',
                                        padding: '6px 12px',
                                    }}
                                >
                                    {tag}
                                </span>
                            ))}
                        </div>

                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                            <a
                                href="#work"
                                className="btn-sketch btn-sketch--primary"
                                style={{ padding: '9px 18px', fontSize: '13px' }}
                            >
                                See What I&apos;ve Shipped
                            </a>
                            <a
                                href="https://cal.com/austinmakasare"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-sketch"
                                style={{ padding: '9px 18px', fontSize: '13px' }}
                            >
                                Book a Call
                            </a>
                        </div>
                    </div>

                    <div className="hero-col-secondary hero-meta-col">
                        <p
                            style={{
                                fontFamily: 'var(--font-suisseintlmono)',
                                fontSize: '13px',
                                color: 'var(--color-fg-muted)',
                                letterSpacing: '-0.26px',
                                marginBottom: '10px',
                            }}
                        >
                            OPEN FOR FREELANCE / FULL-TIME
                        </p>
                        <p
                            style={{
                                fontFamily: 'var(--font-suisseintlmono)',
                                fontSize: '12px',
                                color: 'var(--color-fg-subtle)',
                                letterSpacing: '-0.24px',
                            }}
                        >
                            BASED IN INDIA
                            <br />
                            REMOTE-READY
                        </p>
                    </div>
                </div>

                {/* Bottom row: the architecture illustration + caption on the
                    left, the pitch line and role headline on the right — the
                    same 58/42 split as the row above, so the image's left
                    edge lines up with the headline's left edge and the pitch
                    block lines up with the meta block above it. */}
                <div className="hero-row hero-row--role">
                    <div className="hero-col-primary">
                        <div
                            className="hero-canvas hero-diagram-box"
                            style={{
                                width: '100%',
                                maxWidth: 'var(--hero-image-w)',
                                aspectRatio: '2 / 1',
                                position: 'relative',
                                overflow: 'hidden',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: '20px',
                            }}
                        >
                            <span className="hero-diagram-corner" aria-hidden />
                            <HeroDiagram />
                        </div>

                        <div style={{ display: 'flex', gap: '14px', marginBottom: '12px' }}>
                            <span
                                aria-hidden
                                style={{
                                    fontFamily: 'var(--font-suisseintlmono)',
                                    fontSize: '16px',
                                    color: 'var(--color-fg-subtle)',
                                    lineHeight: 1.4,
                                }}
                            >
                                →
                            </span>
                            <p
                                style={{
                                    fontFamily: 'var(--font-suisseintlmono)',
                                    fontSize: '12px',
                                    letterSpacing: '-0.24px',
                                    lineHeight: 1.4,
                                    color: 'var(--color-fg-subtle)',
                                    textTransform: 'uppercase',
                                }}
                            >
                                Full products, shipped solo —
                                <br />
                                design, build &amp; deploy.
                            </p>
                        </div>

                        <p
                            style={{
                                fontFamily: 'var(--font-suisseintlmono)',
                                fontSize: '11px',
                                letterSpacing: '-0.22px',
                                color: 'var(--color-fg-subtle)',
                                opacity: 0.7,
                            }}
                        >
                            DESIGN &amp; CODE BY AUSTIN
                        </p>
                    </div>

                    <div className="hero-col-secondary hero-right-col" style={{ alignSelf: 'end' }}>
                        <p
                            style={{
                                fontFamily: 'var(--font-suisseintlcond)',
                                fontWeight: 500,
                                fontSize: 'clamp(16px, 1.6vw, 19px)',
                                lineHeight: 1.3,
                                letterSpacing: '-0.02em',
                                color: 'var(--color-fg)',
                                marginBottom: '24px',
                            }}
                        >
                            I ship complete products, solo — architecture to deployment.
                        </p>

                        <h2
                            style={{
                                fontFamily: 'var(--font-hero-display)',
                                fontWeight: 900,
                                fontSize: 'clamp(48px, 7.4vw, 108px)',
                                lineHeight: 0.88,
                                letterSpacing: '-0.035em',
                                color: 'var(--color-fg)',
                            }}
                        >
                            FULL STACK
                            <br />
                            ENGINEER
                        </h2>

                    </div>
                </div>
            </div>
        </section>
    )
}
