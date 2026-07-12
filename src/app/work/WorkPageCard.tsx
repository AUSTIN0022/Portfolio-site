'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { SkillTag } from '@/components/ui/SkillTag'
import { LazyCanvas } from '@/components/three/LazyCanvas'
import type { Project } from '@/content/projects'

const ProjectObject = dynamic(
  () => import('@/components/three/ProjectObject').then((m) => m.ProjectObject),
  { ssr: false }
)

export function WorkPageCard({ project }: { project: Project }) {
  return (
    <article
      style={{
        background: '#ffffff',
        borderRadius: '32px',
        overflow: 'hidden',
        display: 'grid',
        gridTemplateColumns: 'var(--workcard-cols)',
        height: 'var(--workcard-h)',
      }}
    >
      {/* LEFT — 3D canvas area, gray background */}
      <div className="workcard-media" style={{ background: '#e5e7eb', position: 'relative' }}>
        <LazyCanvas camera={{ position: [0, 0, 5], fov: 50 }} style={{ width: '100%', height: '100%' }}>
          <ambientLight intensity={0.7} />
          <directionalLight position={[2, 3, 2]} intensity={1} />
          <ProjectObject type={project.objectType} />
        </LazyCanvas>
      </div>

      {/* RIGHT — content */}
      <div
        style={{
          padding: 'clamp(28px, 5vw, 48px)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '24px',
        }}
      >
        <div>
          <div
            style={{
              fontFamily: 'var(--font-suisseintlmono)',
              fontSize: '12px',
              color: '#444444',
              letterSpacing: '-0.36px',
              marginBottom: '16px',
            }}
          >
            {project.category}
          </div>

          <h2
            style={{
              fontFamily: 'var(--font-suisseintlcond)',
              fontWeight: 700,
              fontSize: 'var(--fs-display-lg)',
              lineHeight: 0.9,
              letterSpacing: '-0.03em',
              color: '#000000',
              marginBottom: '20px',
            }}
          >
            {project.name}
          </h2>

          <p
            style={{
              fontFamily: 'var(--font-suisseintl)',
              fontWeight: 400,
              fontSize: '16px',
              lineHeight: 1.4,
              color: '#444444',
              letterSpacing: '-0.32px',
              maxWidth: '400px',
              marginBottom: '24px',
            }}
          >
            {project.tagline}
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {project.stack.map((t) => (
              <SkillTag key={t}>{t}</SkillTag>
            ))}
          </div>
        </div>

        <div>
          <Link
            href={project.caseStudyUrl}
            style={{
              display: 'inline-block',
              fontFamily: 'var(--font-suisseintl)',
              fontWeight: 500,
              fontSize: '14px',
              color: '#000000',
              border: '1px solid #000000',
              borderRadius: '4px',
              padding: '12px 24px',
              textDecoration: 'none',
              letterSpacing: '-0.28px',
            }}
          >
            View Case Study →
          </Link>
        </div>
      </div>
    </article>
  )
}
