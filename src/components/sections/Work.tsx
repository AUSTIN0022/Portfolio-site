'use client'

import Link from 'next/link'
import { MonoKicker } from '@/components/ui/MonoKicker'
import { PinnedHorizontalScroll } from '@/components/ui/PinnedHorizontalScroll'
import { ProjectPanel } from '@/components/ui/ProjectPanel'
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

      <PinnedHorizontalScroll
        items={projects}
        renderPanel={(project, i, meta) => <ProjectPanel key={project.id} project={project} meta={meta} />}
        renderHud={(_progress, activeIndex, total) => (
          <>
            {/* data-phs-progress-fill: PinnedHorizontalScroll scrubs this
                bar's scaleX directly on the DOM every frame — it does not
                pass a fresh `progress` prop on every tick (that was the
                cause of the reported jitter: a React re-render per scroll
                frame). Any custom renderHud that wants the smooth fill
                needs this same attribute; without it the bar just sits
                static. */}
            <div className="phs-progress-track" aria-hidden>
              <div className="phs-progress-fill" data-phs-progress-fill aria-hidden />
            </div>
            <div className="phs-counter tabular-nums" aria-hidden>
              {String(activeIndex + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
            </div>
          </>
        )}
      />

      <div style={{ textAlign: 'center', marginTop: '24px' }}>
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
