'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { SkillTag } from '@/components/ui/SkillTag'
import ScrollFloat from '@/components/ui/ScrollFloat'
import StarBorder from '@/components/ui/StarBorder'
import { LazyCanvas } from '@/components/three/LazyCanvas'
import { StudioLights, StudioEffects } from '@/components/three/StudioRig'
import type { Project } from '@/content/projects'

const ProjectObject = dynamic(
  () => import('@/components/three/ProjectObject').then((m) => m.ProjectObject),
  { ssr: false }
)

export function WorkPageCard({ project }: { project: Project }) {
  return (
    <article
      style={{
        background: 'var(--color-pure-white)',
        borderRadius: '32px',
        overflow: 'hidden',
        display: 'grid',
        gridTemplateColumns: 'var(--workcard-cols)',
        height: 'var(--workcard-h)',
      }}
    >
      {/* LEFT — 3D canvas area, gray background */}
      <div className="workcard-media" style={{ background: 'var(--color-canvas-mist)', position: 'relative' }}>
        {/* Same studio rig as the hero and the landing-page cards — this is the
            /work page's version of ProjectCard and was carrying the identical flat
            two-light setup. */}
        <LazyCanvas
          shadows
          camera={{ position: [0, 0, 5], fov: 50 }}
          style={{ width: '100%', height: '100%' }}
        >
          <StudioLights variant="light" shadowExtent={2.5} shadowMapSize={512} />
          <ProjectObject type={project.objectType} />
          {/* Full post chain, matching the hero: AO for the contact darkening in
              every seam, then the same NEUTRAL tone curve. Measured at 60fps with
              five of these live, so the small surfaces get real quality parity
              rather than a cheaper approximation. `tier="card"` only trims MSAA
              and AO sample counts, which are invisible at this size. */}
          <StudioEffects tier="card" aoRadius={0.4} aoIntensity={2.2} />
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
              color: 'var(--color-graphite)',
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
              color: 'var(--color-ink-black)',
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
              color: 'var(--color-graphite)',
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
          <StarBorder as="span">
            <Link
              href={project.caseStudyUrl}
              className="btn-shine btn-shine--ghost"
              style={{
                display: 'inline-block',
                fontFamily: 'var(--font-suisseintl)',
                fontWeight: 500,
                fontSize: '14px',
                color: 'var(--color-ink-black)',
                border: '1px solid var(--color-ink-black)',
                borderRadius: '4px',
                padding: '12px 24px',
                textDecoration: 'none',
                letterSpacing: '-0.28px',
              }}
            >
              View Case Study →
            </Link>
          </StarBorder>
        </div>
      </div>
    </article>
  )
}
