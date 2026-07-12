'use client'

import dynamic from 'next/dynamic'
import { LazyCanvas } from '@/components/three/LazyCanvas'

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
    <section id="skills" style={{ background: '#000000', padding: 'var(--section-y) var(--gutter)' }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'var(--skills-cols)', gap: 'var(--skills-gap)' }}>
          {columns.map((col, i) => (
            <div key={i}>
              <LazyCanvas
                camera={{ position: [0, 0, 4], fov: 50 }}
                style={{ height: '160px', marginBottom: '32px' }}
              >
                <ambientLight intensity={0.6} />
                <directionalLight position={[2, 3, 2]} intensity={1} />
                <ProjectObject type={col.objectType} scale={0.7} />
              </LazyCanvas>
              <h3
                data-gsap="heading"
                style={{
                  fontFamily: 'var(--font-suisseintlcond)',
                  fontWeight: 700,
                  fontSize: 'var(--fs-display)',
                  lineHeight: 0.9,
                  letterSpacing: '-0.03em',
                  color: '#ffffff',
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
                  color: '#979797',
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
