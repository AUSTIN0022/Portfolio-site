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

export function ProjectCard({ project }: { project: Project }) {
  const imgSrc = projectImageMap[project.objectType] || '/item-images/monitor.webp'

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
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -1px 0 rgba(0,0,0,0.04)',
        }}
      >
        <motion.div
          style={{
            position: 'relative',
            width: '75%',
            height: '75%',
          }}
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          whileHover={{ scale: 1.04 }}
        >
          <Image
            src={imgSrc}
            alt={project.name}
            fill
            sizes="400px"
            style={{ objectFit: 'contain' }}
          />
        </motion.div>
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
