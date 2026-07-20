import type { Metadata } from 'next'
import Link from 'next/link'
import { Nav } from '@/components/nav/Nav'
import ScrollFloat from '@/components/ui/ScrollFloat'
import StarBorder from '@/components/ui/StarBorder'
import { projects } from '@/content/projects'
import { WorkPageCard } from './WorkPageCard'
import { JsonLd } from '@/components/seo/JsonLd'
import { workCollectionSchema, breadcrumbSchema } from '@/lib/seo/jsonLd'

export const metadata: Metadata = {
  title: 'Work',
  description:
    'Production systems built by Austin Makasare — backend engineer. QuizBuzz and SmartFormFlow case studies with real architecture, scale numbers, and trade-offs.',
  alternates: { canonical: '/work' },
  openGraph: {
    title: 'Work — Austin Makasare',
    description:
      'Production systems built by Austin Makasare — backend engineer. QuizBuzz and SmartFormFlow case studies.',
    url: '/work',
    type: 'website',
  },
}

const stats = [
  { number: '7.5K', label: 'PEAK CONCURRENT WS' },
  { number: '2', label: 'PRODUCTION SYSTEMS' },
  { number: '24', label: 'BUGS DOCUMENTED' },
]

export default function WorkPage() {
  return (
    <>
      <JsonLd
        data={[
          workCollectionSchema(),
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Work', path: '/work' },
          ]),
        ]}
      />
      <Nav />
      <main id="main-content">

      {/* A: Dark hero header */}
      <div style={{ background: 'var(--color-ink-black)' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: 'clamp(96px, 16vw, 120px) var(--gutter) var(--section-y)' }}>
          <Link
            href="/"
            style={{
              fontFamily: 'var(--font-suisseintlmono)',
              fontSize: '12px',
              color: 'var(--color-steel-gray)',
              textDecoration: 'none',
              letterSpacing: '-0.36px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '48px',
            }}
          >
            ← austinmakasare.site
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
            // SELECTED WORK
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
              maxWidth: '640px',
              textWrap: 'balance',
            }}
          >
            WHAT I&apos;VE BUILT.
          </ScrollFloat>
        </div>
      </div>

      {/* B: Stats bar */}
      <div style={{ background: 'var(--color-ink-black)', borderTop: '1px solid #222', padding: '48px var(--gutter)' }}>
        <div
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'var(--stats-cols)',
          }}
        >
          {stats.map((stat, i) => (
            <div key={i} className="stat-cell">
              <div
                style={{
                  fontFamily: 'var(--font-suisseintlcond)',
                  fontWeight: 700,
                  fontSize: 'var(--fs-display-md)',
                  lineHeight: 0.9,
                  letterSpacing: '-0.03em',
                  color: 'var(--color-pure-white)',
                }}
              >
                {stat.number}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-suisseintlmono)',
                  fontSize: '12px',
                  color: 'var(--color-steel-gray)',
                  letterSpacing: '-0.36px',
                  marginTop: '8px',
                }}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* C: Project cards */}
      <div style={{ background: 'var(--color-canvas-mist)', padding: 'var(--section-y) var(--gutter)' }}>
        <div
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '32px',
          }}
        >
          {projects.map((project) => (
            <WorkPageCard key={project.id} project={project} />
          ))}
        </div>
      </div>

      {/* D: Bottom CTA strip */}
      <div style={{ background: 'var(--color-canvas-mist)', padding: '0 var(--gutter) var(--section-y)' }}>
        <div
          className="workcta"
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            background: 'var(--color-ink-black)',
            borderRadius: '32px',
            padding: 'clamp(40px, 7vw, 64px)',
          }}
        >
          <div>
            <div
              style={{
                fontFamily: 'var(--font-suisseintlmono)',
                fontSize: '12px',
                color: 'var(--color-steel-gray)',
                letterSpacing: '-0.36px',
                marginBottom: '12px',
              }}
            >
              // GET IN TOUCH
            </div>
            <ScrollFloat
              as="h2"
              style={{
                fontFamily: 'var(--font-suisseintlcond)',
                fontWeight: 700,
                fontSize: 'var(--fs-display-md)',
                lineHeight: 0.9,
                letterSpacing: '-0.03em',
                color: 'var(--color-pure-white)',
                textWrap: 'balance',
              }}
            >
              WANT TO WORK TOGETHER?
            </ScrollFloat>
          </div>
          <div style={{ display: 'flex', gap: '16px', flexShrink: 0 }}>
            <StarBorder as="span" style={{ flexShrink: 0 }}>
              <a
                href="https://cal.com/austinmakasare"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-shine btn-shine--dark"
                style={{
                  background: 'var(--color-pure-white)',
                  color: 'var(--color-ink-black)',
                  fontFamily: 'var(--font-suisseintl)',
                  fontWeight: 500,
                  fontSize: '14px',
                  borderRadius: '4px',
                  padding: '12px 24px',
                  textDecoration: 'none',
                  letterSpacing: '-0.28px',
                  display: 'inline-block',
                }}
              >
                Book a Call
              </a>
            </StarBorder>
            <StarBorder as="span" style={{ flexShrink: 0 }}>
              <a
                href="mailto:austinmakasare00@gmail.com"
                className="btn-shine btn-shine--ghost"
                style={{
                  background: 'transparent',
                  color: 'var(--color-pure-white)',
                  border: '1px solid var(--color-border-on-dark)',
                  fontFamily: 'var(--font-suisseintl)',
                  fontWeight: 500,
                  fontSize: '14px',
                  borderRadius: '4px',
                  padding: '12px 24px',
                  textDecoration: 'none',
                  letterSpacing: '-0.28px',
                  display: 'inline-block',
                }}
              >
                Email
              </a>
            </StarBorder>
          </div>
        </div>
      </div>
      </main>
    </>
  )
}
