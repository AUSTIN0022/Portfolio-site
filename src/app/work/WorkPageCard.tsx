'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { SkillTag } from '@/components/ui/SkillTag'
import ScrollFloat from '@/components/ui/ScrollFloat'
import type { Project } from '@/content/projects'

const projectImageMap: Record<string, string> = {
  monitor: '/item-images/monitor.webp',
  forms: '/item-images/laptop.webp',
  systems: '/item-images/queue.webp',
  backend: '/item-images/app-server.webp',
  infra: '/item-images/instance.webp',
}

export function WorkPageCard({ project }: { project: Project }) {
  const imgSrc = projectImageMap[project.objectType] || '/item-images/monitor.webp'

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
      {/* LEFT — Media area with optimized PNG visual */}
      <div
        className="workcard-media"
        style={{
          background: 'var(--color-canvas-mist)',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}
      >
        <motion.div
          style={{
            position: 'relative',
            width: '80%',
            height: '80%',
          }}
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
          whileHover={{ scale: 1.05 }}
        >
          <Image
            src={imgSrc}
            alt={project.name}
            fill
            sizes="500px"
            style={{ objectFit: 'contain' }}
          />
        </motion.div>
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
          <Link href={project.caseStudyUrl} className="btn-sketch">
            View Case Study →
          </Link>
        </div>
      </div>
    </article>
  )
}
