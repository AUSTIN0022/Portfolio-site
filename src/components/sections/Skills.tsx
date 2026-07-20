'use client'

import dynamic from 'next/dynamic'
import { LazyCanvas } from '@/components/three/LazyCanvas'
import { StudioLights, StudioEffects } from '@/components/three/StudioRig'
import ScrollFloat from '@/components/ui/ScrollFloat'

const ProjectObject = dynamic(
  () => import('@/components/three/ProjectObject').then((mod) => mod.ProjectObject),
  { ssr: false }
)

const columns = [
  {
    label: 'SYSTEMS.',
    desc: 'Distributed job queues, Redis-backed locking, event-driven architecture, and fault-tolerant async pipelines.',
    objectType: 'systems' as const,
    tile: 'bento-tile-lg',
    tint: 'neutral' as const,
    canvasH: 220,
  },
  {
    label: 'BACKEND.',
    desc: 'Node.js APIs at scale, PostgreSQL with Prisma ORM, RESTful design, authentication, and real-time WebSocket layers.',
    objectType: 'backend' as const,
    tile: 'bento-tile-sm',
    tint: 'mint' as const,
    canvasH: 140,
  },
  {
    label: 'INFRA.',
    desc: 'AWS auto-scaling, Docker containerization, CI/CD pipelines, monitoring, and zero-downtime deployments.',
    objectType: 'infra' as const,
    tile: 'bento-tile-sm',
    tint: 'yellow' as const,
    canvasH: 140,
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
        {/* Visually hidden: the tiles below carry the visual design (no
            kicker/title here by design), but the section still needs an
            accessible name and a real h2 so heading navigation doesn't jump
            from other sections' h2s straight to these h3 tiles. */}
        <h2 id="skills-heading" className="sr-only">
          Skills
        </h2>
        <div className="bento-skills">
          {columns.map((col, i) => (
            <div
              key={i}
              className={col.tile}
              style={{
                borderRadius: '24px',
                padding: 'clamp(24px, 3vw, 32px)',
                ...tintStyles[col.tint],
              }}
            >
              {/* The 3D nodes have near-black bases that vanish into this pure-black
                section. This wrapper is a borderless spotlight — a light tint pooled
                low and wide (bottom centre, spreading left/right) so it sits right
                under the component's base and lifts it off the background, WITHOUT
                changing the component or the section colours. */}
              <div
                style={{
                  height: `${col.canvasH}px`,
                  marginBottom: '28px',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  background:
                    'radial-gradient(135% 120% at 50% 60%, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0.10) 38%, rgba(255,255,255,0.03) 62%, rgba(255,255,255,0) 82%)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), inset 0 0 0 1px rgba(255,255,255,0.04)',
                }}
              >
                {/* The 'dark' rig variant: same studio setup as the hero and the
                    project cards, but with the rim light pushed much harder. These
                    components have near-black bases sitting on a pure-black section,
                    so the rim is the only thing holding an edge against the
                    background — the CSS spotlight behind the canvas can lift the
                    area, but it cannot put a highlight on the geometry itself. */}
                <LazyCanvas
                  shadows
                  camera={{ position: [0, 0, 4], fov: 50 }}
                  style={{ width: '100%', height: '100%' }}
                >
                  <StudioLights variant="dark" shadowExtent={2.5} shadowMapSize={512} />
                  <ProjectObject type={col.objectType} scale={col.tile === 'bento-tile-lg' ? 0.9 : 0.7} />
                  {/* Full post chain, matching the hero: AO for the contact darkening in
                      every seam, then the same NEUTRAL tone curve. Measured at 60fps with
                      five of these live, so the small surfaces get real quality parity
                      rather than a cheaper approximation. `tier="card"` only trims MSAA
                      and AO sample counts, which are invisible at this size. */}
                  <StudioEffects tier="card" aoRadius={0.4} aoIntensity={2.2} />
                </LazyCanvas>
              </div>
              <ScrollFloat
                as="h3"
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
              </ScrollFloat>
              <p
                style={{
                  fontFamily: 'var(--font-suisseintl)',
                  fontWeight: 400,
                  fontSize: '16px',
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
