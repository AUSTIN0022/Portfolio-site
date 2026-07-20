'use client'

import dynamic from 'next/dynamic'
import { LazyCanvas } from '@/components/three/LazyCanvas'
import { StudioLights, StudioEffects } from '@/components/three/StudioRig'

const ProjectObject = dynamic(
  () => import('@/components/three/ProjectObject').then((mod) => mod.ProjectObject),
  { ssr: false }
)

const columns = [
  {
    label: 'SYSTEMS.',
    desc: 'Distributed job queues, Redis-backed locking, event-driven architecture, and fault-tolerant async pipelines.',
    objectType: 'systems' as const,
  },
  {
    label: 'BACKEND.',
    desc: 'Node.js APIs at scale, PostgreSQL with Prisma ORM, RESTful design, authentication, and real-time WebSocket layers.',
    objectType: 'backend' as const,
  },
  {
    label: 'INFRA.',
    desc: 'AWS auto-scaling, Docker containerization, CI/CD pipelines, monitoring, and zero-downtime deployments.',
    objectType: 'infra' as const,
  },
]

export function Skills() {
  return (
    <section
      id="skills"
      aria-labelledby="skills-heading"
      className="surface-ambient"
      style={{ background: 'var(--color-ink-black)', padding: 'var(--section-y) var(--gutter)' }}
    >
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        {/* Visually hidden: the three column headings below carry the visual
            design (no kicker/title here by design, matching the Dayos
            reference layout), but the section still needs an accessible
            name and a real h2 so heading navigation doesn't jump from
            other sections' h2s straight to these h3 columns. */}
        <h2 id="skills-heading" className="sr-only">
          Skills
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'var(--skills-cols)', gap: 'var(--skills-gap)' }}>
          {columns.map((col, i) => (
            <div key={i}>
              {/* The 3D nodes have near-black bases that vanish into this pure-black
                section. This wrapper is a borderless spotlight — a light tint pooled
                low and wide (bottom centre, spreading left/right) so it sits right
                under the component's base and lifts it off the background, WITHOUT
                changing the component or the section colours. */}
            <div
                style={{
                  height: '160px',
                  marginBottom: '32px',
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
                  <ProjectObject type={col.objectType} scale={0.7} />
                  {/* Full post chain, matching the hero: AO for the contact darkening in
                      every seam, then the same NEUTRAL tone curve. Measured at 60fps with
                      five of these live, so the small surfaces get real quality parity
                      rather than a cheaper approximation. `tier="card"` only trims MSAA
                      and AO sample counts, which are invisible at this size. */}
                  <StudioEffects tier="card" aoRadius={0.4} aoIntensity={2.2} />
                </LazyCanvas>
              </div>
              <h3
                data-gsap="heading"
                style={{
                  fontFamily: 'var(--font-suisseintlcond)',
                  fontWeight: 700,
                  fontSize: 'var(--fs-display-md)',
                  lineHeight: 0.9,
                  letterSpacing: '-0.03em',
                  color: 'var(--color-pure-white)',
                  marginBottom: '24px',
                }}
              >
                {col.label}
              </h3>
              <p
                style={{
                  fontFamily: 'var(--font-suisseintl)',
                  fontWeight: 400,
                  fontSize: '16px',
                  lineHeight: 1.33,
                  color: 'var(--color-steel-gray)',
                  letterSpacing: '-0.32px',
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
