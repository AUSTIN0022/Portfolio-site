'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import ScrollFloat from '@/components/ui/ScrollFloat'

interface SidebarLink {
  id: string
  label: string
}

interface CaseStudyLayoutProps {
  children: React.ReactNode
  sidebarLinks: SidebarLink[]
  projectName: string
  category: string
}

export function CaseStudyLayout({ children, sidebarLinks, projectName, category }: CaseStudyLayoutProps) {
  const [activeId, setActiveId] = useState(sidebarLinks[0]?.id ?? '')

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting)
        if (visible.length > 0) setActiveId(visible[0].target.id)
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 }
    )
    sidebarLinks.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [sidebarLinks])

  return (
    <div style={{ background: 'var(--color-canvas-mist)', minHeight: '100vh' }}>
      {/* Top bar */}
      <div style={{ background: 'var(--color-ink-black)' }}>
        <div style={{ padding: 'clamp(96px, 16vw, 120px) var(--gutter) var(--section-y)', maxWidth: '1280px', margin: '0 auto' }}>
          <Link
            href="/#work"
            style={{
              fontFamily: 'var(--font-suisseintlmono)',
              fontSize: '12px',
              color: 'var(--color-steel-gray)',
              textDecoration: 'none',
              letterSpacing: '-0.36px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '40px',
            }}
          >
            ← Back to work
          </Link>
          <div
            style={{
              fontFamily: 'var(--font-suisseintlmono)',
              fontSize: '12px',
              color: 'var(--color-steel-gray)',
              letterSpacing: '-0.36px',
              marginBottom: '16px',
            }}
          >
            {category}
          </div>
          <ScrollFloat
            as="h1"
            style={{
              fontFamily: 'var(--font-suisseintlcond)',
              fontWeight: 700,
              fontSize: 'var(--fs-display)',
              lineHeight: 0.9,
              letterSpacing: '-0.03em',
              color: 'var(--color-pure-white)',
              textWrap: 'balance',
            }}
          >
            {projectName}
          </ScrollFloat>
        </div>
      </div>

      {/* Content + Sidebar */}
      <div
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: 'var(--section-y) var(--gutter)',
          display: 'grid',
          gridTemplateColumns: 'var(--case-cols)',
          gap: 'var(--case-gap)',
          alignItems: 'start',
        }}
      >
        {/* Section nav: scroll strip on mobile, sticky column on desktop */}
        <nav className="case-sidebar">
          {sidebarLinks.map(({ id, label }, i) => (
            <a
              key={id}
              href={`#${id}`}
              className="case-nav-link"
              data-active={activeId === id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontFamily: 'var(--font-suisseintlmono)',
                fontSize: '12px',
                letterSpacing: '-0.36px',
                color: activeId === id ? 'var(--color-ink-black)' : 'var(--color-muted-on-light)',
                textDecoration: 'none',
                padding: '6px 0',
                transition: 'color 0.2s ease',
                fontWeight: activeId === id ? 500 : 400,
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              <span className="case-nav-num">{String(i + 1).padStart(2, '0')}</span>
              {label}
            </a>
          ))}
        </nav>

        {/* Main content */}
        <main id="main-content" className="case-main">{children}</main>
      </div>
    </div>
  )
}
