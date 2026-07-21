'use client'

import dynamic from 'next/dynamic'
import { SkillTag } from '@/components/ui/SkillTag'
import { LazyCanvas } from '@/components/three/LazyCanvas'
import { StudioLights, StudioEffects } from '@/components/three/StudioRig'
import type { Project } from '@/content/projects'

const ProjectObject = dynamic(
  () => import('@/components/three/ProjectObject').then((mod) => mod.ProjectObject),
  { ssr: false }
)

export function ProjectCard({ project }: { project: Project }) {
  return (
    <article
      data-gsap="card"
      className="card-elevated"
      style={{
        background: 'var(--color-pure-white)',
        borderRadius: '32px',
        padding: '0',
        width: 'min(480px, 84vw)',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          background: 'var(--color-canvas-mist)',
          height: '280px',
          position: 'relative',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -1px 0 rgba(0,0,0,0.04)',
        }}
      >
        {/* Same studio rig and post chain as the hero, so a component looks
            identical here and in the hero diagram. The object rocks continuously,
            so shadows come from the real shadow map (which follows the motion)
            rather than a baked ContactShadows plane, which would go stale.
            `shadowExtent` is tight around a single object instead of the hero's
            whole 8-node diagram, which keeps the shadow map's texel density high. */}
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

      <div style={{ padding: '24px' }}>
        <div
          style={{
            fontFamily: 'var(--font-suisseintlmono)',
            fontSize: '12px',
            color: 'var(--color-graphite)',
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
            color: 'var(--color-ink-black)',
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
            color: 'var(--color-graphite)',
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
        <a href={project.caseStudyUrl} className="btn-sketch" style={{ padding: '10px 20px' }}>
          View Case Study →
        </a>
      </div>
    </article>
  )
}
