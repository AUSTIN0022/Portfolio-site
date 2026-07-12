'use client'

import dynamic from 'next/dynamic'
import { SkillTag } from '@/components/ui/SkillTag'
import { LazyCanvas } from '@/components/three/LazyCanvas'
import type { Project } from '@/content/projects'

const ProjectObject = dynamic(
  () => import('@/components/three/ProjectObject').then((mod) => mod.ProjectObject),
  { ssr: false }
)

export function ProjectCard({ project }: { project: Project }) {
  return (
    <article
      data-gsap="card"
      style={{
        background: '#ffffff',
        borderRadius: '32px',
        padding: '0',
        width: 'min(480px, 84vw)',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      <div style={{ background: '#e5e7eb', height: '280px', position: 'relative' }}>
        <LazyCanvas camera={{ position: [0, 0, 5], fov: 50 }} style={{ width: '100%', height: '100%' }}>
          <ambientLight intensity={0.7} />
          <directionalLight position={[2, 3, 2]} intensity={1} />
          <ProjectObject type={project.objectType} />
        </LazyCanvas>
      </div>

      <div style={{ padding: '24px' }}>
        <div
          style={{
            fontFamily: 'var(--font-suisseintlmono)',
            fontSize: '12px',
            color: '#444444',
            letterSpacing: '-0.36px',
            marginBottom: '8px',
          }}
        >
          {project.category}
        </div>
        <h3
          style={{
            fontFamily: 'var(--font-suisseintlcond)',
            fontWeight: 700,
            fontSize: 'var(--fs-display-md)',
            lineHeight: 0.9,
            letterSpacing: '-0.03em',
            color: '#000000',
            marginBottom: '12px',
          }}
        >
          {project.name}
        </h3>
        <p
          style={{
            fontFamily: 'var(--font-suisseintl)',
            fontWeight: 400,
            fontSize: '14px',
            lineHeight: 1.3,
            color: '#444444',
            letterSpacing: '-0.28px',
            marginBottom: '16px',
          }}
        >
          {project.tagline}
        </p>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '24px' }}>
          {project.stack.map((t) => (
            <SkillTag key={t}>{t}</SkillTag>
          ))}
        </div>
        <a
          href={project.caseStudyUrl}
          style={{
            display: 'inline-block',
            fontFamily: 'var(--font-suisseintl)',
            fontWeight: 500,
            fontSize: '14px',
            color: '#000000',
            border: '1px solid #000000',
            borderRadius: '4px',
            padding: '10px 20px',
            textDecoration: 'none',
            letterSpacing: '-0.28px',
          }}
        >
          View Case Study →
        </a>
      </div>
    </article>
  )
}
