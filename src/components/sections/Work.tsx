'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { MonoKicker } from '@/components/ui/MonoKicker'
import { ProjectCard } from '@/components/ui/ProjectCard'
import { CardScrollbar } from '@/components/ui/CardScrollbar'
import ScrollFloat from '@/components/ui/ScrollFloat'
import { projects } from '@/content/projects'

export function Work() {
  const trackRef = useRef<HTMLDivElement>(null)

  const scrollBy = (dir: 1 | -1) => {
    trackRef.current?.scrollBy({ left: dir * 504, behavior: 'smooth' })
  }

  return (
    <section
      id="work"
      style={{ background: 'var(--color-canvas-mist)', padding: 'var(--section-y) 0', overflow: 'hidden' }}
    >
      <div style={{ maxWidth: '1280px', margin: '0 auto 48px', padding: '0 var(--gutter)' }}>
        <MonoKicker>// SELECTED WORK</MonoKicker>
        <ScrollFloat
          as="h2"
          style={{
            fontFamily: 'var(--font-suisseintlcond)',
            fontWeight: 700,
            fontSize: 'var(--fs-display)',
            lineHeight: 0.9,
            letterSpacing: '-0.03em',
            color: 'var(--color-ink-black)',
            marginTop: '16px',
          }}
        >
          WHAT I&apos;VE SHIPPED.
        </ScrollFloat>
      </div>

      {/* Cards can overflow right — start aligned with the 1280px content left edge */}
      <div style={{ maxWidth: '1280px', margin: '0 auto', paddingLeft: 'var(--gutter)', overflow: 'visible' }}>
        <div
          ref={trackRef}
          id="work-track"
          className="card-track"
          style={{
            display: 'flex',
            gap: '24px',
            paddingRight: 'var(--gutter)',
            overflowX: 'auto',
            scrollSnapType: 'x mandatory',
          }}
        >
          {projects.map((p) => (
            <div key={p.id} style={{ scrollSnapAlign: 'start' }}>
              <ProjectCard project={p} />
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          maxWidth: '1280px',
          margin: '48px auto 0',
          padding: '0 var(--gutter)',
          display: 'flex',
          gap: '20px',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <button
          onClick={() => scrollBy(-1)}
          aria-label="Scroll to previous projects"
          className="icon-btn"
          style={{
            flexShrink: 0,
            width: '48px',
            height: '48px',
            border: '1px solid var(--color-ink-black)',
            borderRadius: '50%',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: '18px',
          }}
        >
          <span aria-hidden>←</span>
        </button>

        <div style={{ flex: 1, maxWidth: '420px' }}>
          <CardScrollbar trackRef={trackRef} />
        </div>

        <button
          onClick={() => scrollBy(1)}
          aria-label="Scroll to next projects"
          className="icon-btn"
          style={{
            flexShrink: 0,
            width: '48px',
            height: '48px',
            border: '1px solid var(--color-ink-black)',
            borderRadius: '50%',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: '18px',
          }}
        >
          <span aria-hidden>→</span>
        </button>
      </div>

      <div style={{ textAlign: 'center', marginTop: '24px' }}>
        <Link
          href="/work"
          style={{
            fontFamily: 'var(--font-suisseintlmono)',
            fontSize: '12px',
            color: 'var(--color-graphite)',
            letterSpacing: '-0.36px',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
          className="hover:text-black transition-colors duration-200"
        >
          View all projects →
        </Link>
      </div>
    </section>
  )
}
