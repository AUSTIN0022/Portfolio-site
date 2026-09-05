'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { MonoKicker } from '@/components/ui/MonoKicker'
import { ProjectCard } from '@/components/ui/ProjectCard'
import { ProjectPanel } from '@/components/ui/ProjectPanel'
import { CardScrollbar } from '@/components/ui/CardScrollbar'
import { projects } from '@/content/projects'

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
}

export function Work() {
  const trackRef = useRef<HTMLDivElement>(null)
  const pinWrapRef = useRef<HTMLDivElement>(null)
  const pinTrackRef = useRef<HTMLDivElement>(null)

  const scrollBy = (dir: 1 | -1) => {
    trackRef.current?.scrollBy({ left: dir * 504, behavior: 'smooth' })
  }

  // Pinned horizontal reveal — one project fills the viewport at a time,
  // scroll slides the next one in from the right. Desktop + motion-safe
  // only; the media query in globals.css (.work-fallback / .work-pin-wrap)
  // decides which markup actually paints, and this matchMedia query is
  // kept identical to it on purpose so the animation only ever runs
  // against the markup that's actually visible. See
  // docs/interaction-upgrades-plan.md §1 for the full writeup.
  useEffect(() => {
    const wrap = pinWrapRef.current
    const track = pinTrackRef.current
    if (!wrap || !track) return

    const panels = gsap.utils.toArray<HTMLElement>('.work-panel', track)
    if (panels.length < 2) return

    // Off-screen panels stay readable to screen readers (DOM order is
    // untouched) but shouldn't be reachable by Tab while translated out of
    // view — keep only the active panel's case-study link in the tab order.
    const links = panels.map((p) => p.querySelector<HTMLAnchorElement>('a.btn-sketch'))
    const setActive = (idx: number) => {
      links.forEach((link, i) => {
        if (link) link.tabIndex = i === idx ? 0 : -1
      })
    }
    setActive(0)

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia()

      mm.add('(min-width: 900px) and (prefers-reduced-motion: no-preference)', () => {
        let lastIndex = 0

        const st = ScrollTrigger.create({
          trigger: wrap,
          start: 'top top',
          end: () => `+=${(panels.length - 1) * window.innerHeight * 1.1}`,
          pin: true,
          scrub: 1,
          snap: 1 / (panels.length - 1),
          invalidateOnRefresh: true,
          onEnter: () => gsap.set(track, { willChange: 'transform' }),
          onLeave: () => gsap.set(track, { willChange: 'auto' }),
          onLeaveBack: () => gsap.set(track, { willChange: 'auto' }),
          onUpdate: (self) => {
            gsap.set(track, { xPercent: -100 * (panels.length - 1) * self.progress })
            const idx = Math.round(self.progress * (panels.length - 1))
            if (idx !== lastIndex) {
              lastIndex = idx
              setActive(idx)
            }
          },
        })

        return () => {
          st.kill()
          setActive(0)
        }
      })
    }, wrap)

    return () => ctx.revert()
  }, [])

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

      {/* Pinned full-viewport reveal — desktop + motion-safe only */}
      <div ref={pinWrapRef} className="work-pin-wrap">
        <div ref={pinTrackRef} className="work-pin-track">
          {projects.map((p, i) => (
            <ProjectPanel key={p.id} project={p} index={i} total={projects.length} />
          ))}
        </div>
      </div>

      {/* Fallback — mobile and reduced-motion: today's horizontal scroll-snap
          card track, unchanged. */}
      <div className="work-fallback">
        <div style={{ maxWidth: '1280px', margin: '0 auto', paddingLeft: 'var(--gutter)', overflow: 'visible' }}>
          <div
            ref={trackRef}
            id="work-track"
            className="card-track"
            data-shoot-scroll-interactive="1"
            data-gsap-group
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
          data-shoot-scroll-interactive="1"
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
              border: '1px solid var(--color-fg)',
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
              border: '1px solid var(--color-fg)',
              borderRadius: '50%',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: '18px',
            }}
          >
            <span aria-hidden>→</span>
          </button>
        </div>
      </div>

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
