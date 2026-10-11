'use client'

import Link from 'next/link'
import { SkillTag } from '@/components/ui/SkillTag'
import ScrollFloat from '@/components/ui/ScrollFloat'
import { getTechIcon } from '@/lib/techIcons'
import { ProjectFigure } from '@/components/ui/ProjectFigure'
import type { Project } from '@/content/projects'

export function WorkPageCard({ project }: { project: Project }) {

  return (
    <article
      style={{
        background: 'var(--color-bg)',
        borderRadius: '32px',
        overflow: 'hidden',
        display: 'grid',
        gridTemplateColumns: 'var(--workcard-cols)',
        height: 'var(--workcard-h)',
      }}
    >
      {/* LEFT — the project's line figure */}
      <div
        className="workcard-media"
        data-accent={project.id}
        style={{
          background: 'var(--color-bg)',
          ['--pfig-bg' as string]: 'var(--color-bg)',
          overflow: 'hidden',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}
      >
        <ProjectFigure id={project.id} width="min(100%, 540px)" />
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
              color: 'var(--color-fg-muted)',
              letterSpacing: '-0.36px',
              marginBottom: '16px',
            }}
          >
            {project.category}
          </div>

          <ScrollFloat
            as="h2"
            style={{
              fontFamily: 'var(--font-suisseintlcond)',
              fontWeight: 700,
              fontSize: 'var(--fs-display-lg)',
              lineHeight: 0.9,
              letterSpacing: '-0.03em',
              color: 'var(--color-fg)',
              marginBottom: '20px',
            }}
          >
            {project.name}
          </ScrollFloat>

          <p
            style={{
              fontFamily: 'var(--font-suisseintl)',
              fontWeight: 400,
              fontSize: '16px',
              lineHeight: 1.4,
              color: 'var(--color-fg-muted)',
              letterSpacing: '-0.32px',
              maxWidth: '400px',
              marginBottom: '24px',
            }}
          >
            {project.tagline}
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {project.stack.map((t) => (
              <SkillTag key={t}>
                {getTechIcon(t)}
                {t}
              </SkillTag>
            ))}
          </div>
        </div>

        <div>
          <Link href={project.caseStudyUrl} className="btn-sketch">
            View Case Study →
          </Link>
        </div>
      </div>
    </article>
  )
}
