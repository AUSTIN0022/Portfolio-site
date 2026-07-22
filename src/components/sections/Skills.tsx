'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import ScrollFloat from '@/components/ui/ScrollFloat'

const columns = [
  {
    label: 'SYSTEMS.',
    desc: 'Distributed job queues, Redis-backed locking, event-driven architecture, and fault-tolerant async pipelines.',
    imageSrc: '/item-images/queue.webp',
    alt: 'Distributed Systems Queue Architecture',
    tile: 'bento-tile-lg',
    tint: 'neutral' as const,
    canvasH: 220,
  },
  {
    label: 'BACKEND.',
    desc: 'Node.js APIs at scale, PostgreSQL with Prisma ORM, RESTful design, authentication, and real-time WebSocket layers.',
    imageSrc: '/item-images/app-server.webp',
    alt: 'Backend API Server Architecture',
    tile: 'bento-tile-sm',
    tint: 'mint' as const,
    canvasH: 140,
  },
  {
    label: 'INFRA.',
    desc: 'AWS auto-scaling, Docker containerization, CI/CD pipelines, monitoring, and zero-downtime deployments.',
    imageSrc: '/item-images/instance.webp',
    alt: 'Cloud Infrastructure Node Instance',
    tile: 'bento-tile-sm',
    tint: 'yellow' as const,
    canvasH: 140,
  },
]

const tintStyles = {
  neutral: {
    background: 'rgba(255,255,255,0.035)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), inset 0 0 0 1px rgba(255,255,255,0.06)',
  },
  mint: {
    background: 'rgba(209,255,202,0.045)',
    boxShadow: 'inset 0 1px 0 rgba(209,255,202,0.08), inset 0 0 0 1px rgba(209,255,202,0.12)',
  },
  yellow: {
    background: 'rgba(255,241,0,0.04)',
    boxShadow: 'inset 0 1px 0 rgba(255,241,0,0.08), inset 0 0 0 1px rgba(255,241,0,0.12)',
  },
} as const

export function Skills() {
  return (
    <section
      id="skills"
      aria-labelledby="skills-heading"
      className="surface-ambient"
      style={{ background: 'var(--color-ink-black)', padding: 'var(--section-y) var(--gutter)' }}
    >
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        <h2 id="skills-heading" className="sr-only">
          Skills
        </h2>
        <div className="bento-skills">
          {columns.map((col, i) => (
            <div
              key={i}
              className={col.tile}
              style={{
                borderRadius: '24px',
                padding: 'clamp(24px, 3vw, 32px)',
                ...tintStyles[col.tint],
              }}
            >
              <div
                style={{
                  height: `${col.canvasH}px`,
                  marginBottom: '28px',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background:
                    'radial-gradient(135% 120% at 50% 60%, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 38%, rgba(255,255,255,0.01) 62%, rgba(255,255,255,0) 82%)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), inset 0 0 0 1px rgba(255,255,255,0.04)',
                }}
              >
                <motion.div
                  style={{
                    position: 'relative',
                    width: '80%',
                    height: '80%',
                  }}
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 4 + i, repeat: Infinity, ease: 'easeInOut' }}
                  whileHover={{ scale: 1.05 }}
                >
                  <Image
                    src={col.imageSrc}
                    alt={col.alt}
                    fill
                    sizes="300px"
                    style={{ objectFit: 'contain' }}
                  />
                </motion.div>
              </div>
              <ScrollFloat
                as="h3"
                style={{
                  fontFamily: 'var(--font-suisseintlcond)',
                  fontWeight: 700,
                  fontSize: col.tile === 'bento-tile-lg' ? 'var(--fs-display)' : 'var(--fs-display-md)',
                  lineHeight: 0.9,
                  letterSpacing: '-0.03em',
                  color: 'var(--color-pure-white)',
                  marginBottom: '20px',
                }}
              >
                {col.label}
              </ScrollFloat>
              <p
                style={{
                  fontFamily: 'var(--font-suisseintl)',
                  fontWeight: 400,
                  fontSize: '16px',
                  lineHeight: 1.33,
                  color: 'var(--color-steel-gray)',
                  letterSpacing: '-0.32px',
                  maxWidth: col.tile === 'bento-tile-lg' ? '520px' : 'none',
                }}
              >
                {col.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
