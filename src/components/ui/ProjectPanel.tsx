'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { SkillTag } from '@/components/ui/SkillTag'
import type { Project } from '@/content/projects'

const projectImageMap: Record<string, string> = {
  monitor: '/item-images/monitor.webp',
  forms: '/item-images/laptop.webp',
  systems: '/item-images/queue.webp',
  backend: '/item-images/app-server.webp',
  infra: '/item-images/instance.webp',
}

/**
 * ProjectPanel — the full-viewport variant of ProjectCard used inside Work's
 * pinned horizontal reveal (desktop, motion-safe only; see .work-pin-wrap in
 * globals.css and docs/interaction-upgrades-plan.md §1). Same tokens, same
 * fonts, same SkillTag/btn-sketch language as ProjectCard — just a two-column
 * panel instead of a small scroll-snap card, so the pinned reveal reads as
 * the same design system, not a new one.
 */
export function ProjectPanel({
  project,
  index,
  total,
}: {
  project: Project
  index: number
  total: number
}) {
  const imgSrc = projectImageMap[project.objectType] || '/item-images/monitor.webp'
  const num = String(index + 1).padStart(2, '0')
  const of = String(total).padStart(2, '0')

  return (
    <div className="work-panel">
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
          }}
        >
          <motion.div
            style={{ position: 'relative', width: '70%', height: '70%' }}
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Image src={imgSrc} alt={project.name} fill sizes="600px" style={{ objectFit: 'contain' }} />
          </motion.div>
        </div>

        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              marginBottom: '16px',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-suisseintlmono)',
                fontSize: '12px',
                color: 'var(--color-fg-muted)',
                letterSpacing: '-0.36px',
              }}
            >
              {project.category}
            </span>
            <span
              className="tabular-nums"
              style={{
                fontFamily: 'var(--font-suisseintlmono)',
                fontSize: '12px',
                color: 'var(--color-fg-subtle)',
                letterSpacing: '-0.36px',
              }}
            >
              {num} / {of}
            </span>
          </div>

          <h3
            style={{
              fontFamily: 'var(--font-suisseintlcond)',
              fontWeight: 700,
              fontSize: 'var(--fs-display)',
              lineHeight: 0.9,
              letterSpacing: '-0.03em',
              color: 'var(--color-fg)',
              marginBottom: '20px',
              textWrap: 'balance',
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
    </div>
  )
}
