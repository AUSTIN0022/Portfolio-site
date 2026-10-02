'use client'

import Link from 'next/link'
import { MonoKicker } from '@/components/ui/MonoKicker'
import { ProjectCard } from '@/components/ui/ProjectCard'
import { projects } from '@/content/projects'

export function Work() {
  return (
    <section
      id="work"
      style={{ background: 'var(--color-bg)', padding: 'var(--section-y) 0', overflow: 'hidden' }}
    >
      <div style={{ maxWidth: '1280px', margin: '0 auto 48px', padding: '0 var(--gutter)' }} data-gsap="heading">
        <MonoKicker>// SELECTED WORK</MonoKicker>
        <h2
          style={{
            fontFamily: 'var(--font-suisseintlcond)',
            fontWeight: 700,
            fontSize: 'var(--fs-display)',
            lineHeight: 0.9,
            letterSpacing: '-0.03em',
            color: 'var(--color-fg)',
            marginTop: '16px',
          }}
        >
          WHAT I&apos;VE SHIPPED.
        </h2>
      </div>

      <div
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '0 var(--gutter)',
          display: 'grid',
          // Two columns on desktop (one on phones); a third project still
          // wraps cleanly onto the next row.
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))',
          gap: '32px',
        }}
      >
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>

      <div style={{ textAlign: 'center', marginTop: '48px' }}>
        <Link
          href="/work"
          style={{
            fontFamily: 'var(--font-suisseintlmono)',
            fontSize: '12px',
            color: 'var(--color-fg-muted)',
            letterSpacing: '-0.36px',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
          className="hover:text-[var(--color-fg)] transition-colors duration-200"
        >
          View all projects →
        </Link>
      </div>
    </section>
  )
}
