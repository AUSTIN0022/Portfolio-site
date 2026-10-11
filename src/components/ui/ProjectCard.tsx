'use client'

import { ProjectFigure } from '@/components/ui/ProjectFigure'
import type { Project } from '@/content/projects'

export function ProjectCard({ project }: { project: Project }) {

  return (
    <article
      data-gsap="card"
      className="card-elevated"
      style={{
        background: 'var(--color-bg)',
        borderRadius: '32px',
        padding: '0',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        // Lets the title size itself against the card's own width.
        containerType: 'inline-size',
      }}
    >
      {/* The image doubles as a link (the button below stays the accessible
          one, so this is out of the tab order) and shows the cursor label. */}
      <a
        href={project.caseStudyUrl}
        tabIndex={-1}
        aria-hidden
        data-cursor-label="View case study →"
        data-accent={project.id}
        style={{
          background: 'var(--color-chip-bg)',
          ['--pfig-bg' as string]: 'var(--color-chip-bg)',
          height: '200px',
          overflow: 'hidden',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -1px 0 rgba(0,0,0,0.04)',
        }}
      >
        {/* Slightly larger than the panel: the figure's own margins crop away, so it reads zoomed in. */}
        <ProjectFigure id={project.id} width="min(96%, 290px)" />
      </a>

      <div style={{ padding: '20px 24px 24px', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        <div
          style={{
            fontFamily: 'var(--font-suisseintlmono)',
            fontSize: '12px',
            color: 'var(--color-fg-muted)',
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
            // Long names (SMARTFORMFLOW) stay on one line in a three-up row.
            fontSize: 'min(var(--fs-display-md), 13.5cqi)',
            lineHeight: 0.9,
            letterSpacing: '-0.03em',
            color: 'var(--color-fg)',
            marginBottom: '12px',
          }}
        >
          {project.name}
        </h3>
        <p
          style={{
            fontFamily: 'var(--font-suisseintl)',
            fontWeight: 400,
            fontSize: '16px',
            lineHeight: 1.3,
            color: 'var(--color-fg-muted)',
            letterSpacing: '-0.28px',
            marginBottom: '20px',
            // Three lines max: keeps the cards short and their rows aligned;
            // the full story is in the case study.
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {project.tagline}
        </p>
        <dl
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: '12px',
            width: '100%',
            margin: 'auto 0 20px',
            paddingTop: '16px',
            borderTop: '1px solid color-mix(in srgb, var(--color-fg) 12%, transparent)',
          }}
        >
          {project.metrics.map((m) => (
            <div key={m.label}>
              <dt
                style={{
                  fontFamily: 'var(--font-suisseintlcond)',
                  fontWeight: 700,
                  fontSize: 'clamp(22px, 9cqi, 34px)',
                  lineHeight: 0.95,
                  letterSpacing: '-0.02em',
                  color: 'var(--color-fg)',
                }}
              >
                {m.value}
              </dt>
              <dd
                style={{
                  margin: '6px 0 0',
                  fontFamily: 'var(--font-suisseintlmono)',
                  fontSize: '10px',
                  lineHeight: 1.3,
                  letterSpacing: '-0.2px',
                  textTransform: 'uppercase',
                  color: 'var(--color-fg-muted)',
                }}
              >
                {m.label}
              </dd>
            </div>
          ))}
        </dl>
        <a href={project.caseStudyUrl} className="btn-sketch" style={{ padding: '10px 20px' }}>
          View Case Study →
        </a>
      </div>
    </article>
  )
}
