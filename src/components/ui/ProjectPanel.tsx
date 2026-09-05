'use client'

import Image from 'next/image'
import { SkillTag } from '@/components/ui/SkillTag'
import type { PanelMeta } from '@/components/ui/PinnedHorizontalScroll'
import type { Project } from '@/content/projects'

const projectImageMap: Record<Project['objectType'], string> = {
  monitor: '/item-images/monitor.webp',
  forms: '/item-images/laptop.webp',
  systems: '/item-images/queue.webp',
  backend: '/item-images/app-server.webp',
  infra: '/item-images/instance.webp',
}

/**
 * ProjectPanel — the single, shared visual for one project inside Work's
 * pinned horizontal reveal (see PinnedHorizontalScroll.tsx). Everything here
 * is specific to "projects"; the engine itself knows nothing about this
 * shape. `data-panel-media` / `data-panel-headline` are the only contract
 * with it: they mark which element gets the bottom-up mask reveal and which
 * gets the scroll-velocity blur.
 *
 * This is the one place that markup lives now — Work.tsx previously kept its
 * own inline duplicate (`ProjectPanelContent`) side-by-side with this file,
 * which had drifted out of sync with it. Consolidated back into a single
 * component so there's exactly one version of this panel to maintain.
 */
export function ProjectPanel({ project, meta }: { project: Project; meta: PanelMeta }) {
  const imgSrc = projectImageMap[project.objectType] || '/item-images/monitor.webp'

  return (
    <div
      style={{
        maxWidth: '1280px',
        margin: '0 auto',
        padding: '0 var(--gutter)',
        width: '100%',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
        gap: 'clamp(32px, 5vw, 80px)',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          background: 'var(--color-chip-bg)',
          borderRadius: '32px',
          height: 'min(60vh, 520px)',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -1px 0 rgba(0,0,0,0.04)',
          overflow: 'hidden',
        }}
      >
        <div
          data-panel-media
          className="work-panel-float"
          style={{ position: 'relative', width: '70%', height: '70%' }}
        >
          {/* priority: every panel is already in the DOM at mount, just
              translated off-screen by the pin/scrub — next/image's default
              lazy loading only starts the fetch once its own intersection
              observer sees it, which a translateX'd panel may not trigger in
              time, reading as a blank flash the first time it slides into
              view. There are only ever a handful of these, so eagerly
              loading all of them is cheap. PinnedHorizontalScroll additionally
              waits for every <img> under its wrapper to finish loading
              before its first ScrollTrigger.refresh(), so a slow image load
              can't leave the pin's measured distances stale either. */}
          <Image src={imgSrc} alt={project.name} fill sizes="600px" style={{ objectFit: 'contain' }} priority />
        </div>
      </div>

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

        <h3
          data-panel-headline
          style={{
            fontFamily: 'var(--font-suisseintlcond)',
            fontWeight: 700,
            fontSize: 'var(--fs-display)',
            lineHeight: 0.9,
            letterSpacing: '-0.03em',
            color: 'var(--color-fg)',
            marginBottom: '20px',
            textWrap: 'balance',
            opacity: meta.isActive ? 1 : 0.85,
            transition: 'opacity 0.3s ease',
          }}
        >
          {project.name}
        </h3>

        <p
          style={{
            fontFamily: 'var(--font-suisseintl)',
            fontWeight: 400,
            fontSize: 'var(--fs-golden-desc)',
            lineHeight: 1.4,
            color: 'var(--color-fg-muted)',
            letterSpacing: '-0.28px',
            marginBottom: '24px',
            maxWidth: '480px',
            textWrap: 'pretty',
          }}
        >
          {project.tagline}
        </p>

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '32px' }}>
          {project.stack.map((t) => (
            <SkillTag key={t}>{t}</SkillTag>
          ))}
        </div>

        <a href={project.caseStudyUrl} className="btn-sketch" style={{ padding: '10px 20px' }}>
          View Case Study →
        </a>
      </div>
    </div>
  )
}
