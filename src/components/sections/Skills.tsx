'use client'

import { CustomFigure } from '@/components/ui/CustomFigure'

const columns = [
  {
    label: 'SYSTEMS.',
    desc: 'Distributed job queues, Redis-backed locking, event-driven architecture, and fault-tolerant async pipelines.',
    figure: 'claim',
    tile: 'bento-tile-lg',
    tint: 'neutral' as const,
    canvasH: 260,
  },
  {
    label: 'BACKEND.',
    desc: 'Node.js APIs at scale, PostgreSQL with Prisma ORM, RESTful design, authentication, and real-time WebSocket layers.',
    figure: 'apistack',
    tile: 'bento-tile-sm',
    tint: 'mint' as const,
    canvasH: 180,
  },
  {
    label: 'INFRA.',
    desc: 'AWS auto-scaling, Docker containerization, CI/CD pipelines, monitoring, and zero-downtime deployments.',
    figure: 'rollout',
    tile: 'bento-tile-sm',
    tint: 'yellow' as const,
    canvasH: 180,
  },
]

const tintStyles = {
  neutral: {
    background: 'rgba(255,255,255,0.035)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), inset 0 0 0 1px rgba(255,255,255,0.06)',
  },
  mint: {
    background: 'rgba(209,255,202,0.045)',
    boxShadow: 'inset 0 1px 0 rgba(209,255,202,0.08), inset 0 0 0 1px rgba(209,255,202,0.12)',
  },
  yellow: {
    background: 'rgba(255,241,0,0.04)',
    boxShadow: 'inset 0 1px 0 rgba(255,241,0,0.08), inset 0 0 0 1px rgba(255,241,0,0.12)',
  },
} as const

export function Skills() {
  return (
    <section
      id="skills"
      aria-labelledby="skills-heading"
      className="surface-ambient"
      style={{ background: 'var(--color-ink-black)', padding: 'var(--section-y) var(--gutter)' }}
    >
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        <h2 id="skills-heading" className="sr-only">
          Skills
        </h2>
        <div className="bento-skills" data-gsap-group>
          {columns.map((col) => (
            <div
              key={col.label}
              className={col.tile}
              data-gsap="card"
              style={{
                borderRadius: '24px',
                padding: 'clamp(24px, 3vw, 32px)',
                ...tintStyles[col.tint],
              }}
            >
              {/* The tile is always dark, so the figure is forced onto Hairline's dark
                  palette, with white outlines (.skills-figure). */}
              <div
                data-theme="dark"
                data-accent
                className="skills-figure"
                style={{
                  height: `${col.canvasH}px`,
                  marginBottom: '28px',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#141414',
                  ['--pfig-bg' as string]: '#141414',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), inset 0 0 0 1px rgba(255,255,255,0.04)',
                }}
              >
                <div style={{ width: `${Math.round(col.canvasH * 1.25 * 1.12)}px`, flex: 'none' }}>
                  <CustomFigure name={col.figure} play />
                </div>
              </div>
              <h3
                style={{
                  fontFamily: 'var(--font-suisseintlcond)',
                  fontWeight: 700,
                  fontSize: col.tile === 'bento-tile-lg' ? 'var(--fs-display)' : 'var(--fs-display-md)',
                  lineHeight: 0.9,
                  letterSpacing: '-0.03em',
                  color: 'var(--color-pure-white)',
                  marginBottom: '20px',
                }}
              >
                {col.label}
              </h3>
              <p
                style={{
                  fontFamily: 'var(--font-suisseintl)',
                  fontWeight: 400,
                  fontSize: 'var(--fs-golden-body)',
                  lineHeight: 1.33,
                  color: 'var(--color-steel-gray)',
                  letterSpacing: '-0.32px',
                  maxWidth: col.tile === 'bento-tile-lg' ? '520px' : 'none',
                }}
              >
                {col.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
