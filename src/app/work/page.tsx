import Link from 'next/link'
import { Nav } from '@/components/nav/Nav'
import { projects } from '@/content/projects'
import { WorkPageCard } from './WorkPageCard'

export const metadata = {
  title: 'Work — Austin Makasare',
  description:
    'Production systems built by Austin Makasare — backend engineer. QuizBuzz and SmartFormFlow case studies.',
}

const stats = [
  { number: '10K+', label: 'CONCURRENT USERS' },
  { number: '2', label: 'PRODUCTION SYSTEMS' },
  { number: '24', label: 'BUGS DOCUMENTED' },
]

export default function WorkPage() {
  return (
    <>
      <Nav />
      <main id="main-content">

      {/* A: Dark hero header */}
      <div style={{ background: '#000000' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: 'clamp(96px, 16vw, 120px) var(--gutter) var(--section-y)' }}>
          <Link
            href="/"
            style={{
              fontFamily: 'var(--font-suisseintlmono)',
              fontSize: '12px',
              color: '#979797',
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
              color: '#979797',
              letterSpacing: '-0.36px',
              marginBottom: '16px',
            }}
          >
            // SELECTED WORK
          </div>

          <h1
            style={{
              fontFamily: 'var(--font-suisseintlcond)',
              fontWeight: 700,
              fontSize: 'var(--fs-display)',
              lineHeight: 0.9,
              letterSpacing: '-0.03em',
              color: '#ffffff',
              maxWidth: '640px',
              textWrap: 'balance',
            }}
          >
            WHAT I&apos;VE BUILT.
          </h1>
        </div>
      </div>

      {/* B: Stats bar */}
      <div style={{ background: '#000000', borderTop: '1px solid #222', padding: '48px var(--gutter)' }}>
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
                  color: '#ffffff',
                }}
              >
                {stat.number}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-suisseintlmono)',
                  fontSize: '12px',
                  color: '#979797',
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
      <div style={{ background: '#e5e7eb', padding: 'var(--section-y) var(--gutter)' }}>
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
      <div style={{ background: '#e5e7eb', padding: '0 var(--gutter) var(--section-y)' }}>
        <div
          className="workcta"
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            background: '#000000',
            borderRadius: '32px',
            padding: 'clamp(40px, 7vw, 64px)',
          }}
        >
          <div>
            <div
              style={{
                fontFamily: 'var(--font-suisseintlmono)',
                fontSize: '12px',
                color: '#979797',
                letterSpacing: '-0.36px',
                marginBottom: '12px',
              }}
            >
              // GET IN TOUCH
            </div>
            <h2
              style={{
                fontFamily: 'var(--font-suisseintlcond)',
                fontWeight: 700,
                fontSize: 'var(--fs-display-md)',
                lineHeight: 0.9,
                letterSpacing: '-0.03em',
                color: '#ffffff',
                textWrap: 'balance',
              }}
            >
              WANT TO WORK TOGETHER?
            </h2>
          </div>
          <div style={{ display: 'flex', gap: '16px', flexShrink: 0 }}>
            <a
              href="https://cal.com/austinmakasare"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: '#ffffff',
                color: '#000000',
                fontFamily: 'var(--font-suisseintl)',
                fontWeight: 500,
                fontSize: '14px',
                borderRadius: '4px',
                padding: '12px 24px',
                textDecoration: 'none',
                letterSpacing: '-0.28px',
                flexShrink: 0,
              }}
            >
              Book a Call
            </a>
            <a
              href="mailto:hello@austinmakasare.site"
              style={{
                background: 'transparent',
                color: '#ffffff',
                border: '1px solid var(--color-border-on-dark)',
                fontFamily: 'var(--font-suisseintl)',
                fontWeight: 500,
                fontSize: '14px',
                borderRadius: '4px',
                padding: '12px 24px',
                textDecoration: 'none',
                letterSpacing: '-0.28px',
                flexShrink: 0,
              }}
            >
              Email
            </a>
          </div>
        </div>
      </div>
      </main>
    </>
  )
}
