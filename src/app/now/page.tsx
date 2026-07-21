import type { Metadata } from 'next'
import Link from 'next/link'
import { Nav } from '@/components/nav/Nav'
import { Footer } from '@/components/sections/Footer'
import { SkillTag } from '@/components/ui/SkillTag'
import ScrollFloat from '@/components/ui/ScrollFloat'
import { nowData } from '@/content/now'

export const metadata: Metadata = {
  title: 'Now',
  description:
    'What Austin Makasare is currently building, learning, and thinking about — plus current availability for backend roles.',
  alternates: { canonical: '/now' },
  openGraph: {
    title: 'Now — Austin Makasare',
    description: 'What Austin Makasare is currently building, learning, and thinking about.',
    url: '/now',
    type: 'profile',
  },
}

const nowRows = [
  { icon: '🏗', label: 'BUILDING', value: nowData.building },
  { icon: '📖', label: 'LEARNING', value: nowData.learning },
  { icon: '📍', label: 'STATUS', value: nowData.status },
  { icon: '🎓', label: 'STUDYING', value: 'MSc Computer Science — graduating June–July 2026' },
]

const stackGroups = [
  {
    label: 'BACKEND',
    tags: ['Node.js', 'TypeScript', 'Express', 'Prisma', 'PostgreSQL', 'Zod'],
  },
  {
    label: 'ASYNC & INFRA',
    tags: ['BullMQ', 'Redis', 'Docker', 'AWS', 'Terraform', 'GitHub Actions'],
  },
  {
    label: 'FRONTEND',
    tags: ['Next.js', 'React', 'Tailwind CSS', 'Framer Motion', 'TanStack Query'],
  },
]

// Two variants: this page reuses the same kicker style on both the black
// hero/stack sections and the white content cards, and steel-gray only
// clears WCAG AA contrast on the dark surface.
const kickerStyleDark: React.CSSProperties = {
  fontFamily: 'var(--font-suisseintlmono)',
  fontSize: '12px',
  color: 'var(--color-steel-gray)',
  letterSpacing: '-0.36px',
  marginBottom: '16px',
}

const kickerStyleLight: React.CSSProperties = {
  ...kickerStyleDark,
  color: 'var(--color-muted-on-light)',
}

const blockHeadingStyle: React.CSSProperties = {
  fontFamily: 'var(--font-suisseintlcond)',
  fontWeight: 700,
  fontSize: 'var(--fs-display-md)',
  lineHeight: 0.9,
  letterSpacing: '-0.03em',
  color: 'var(--color-ink-black)',
  marginBottom: '20px',
}

const blockBodyStyle: React.CSSProperties = {
  fontFamily: 'var(--font-suisseintl)',
  fontWeight: 400,
  fontSize: '16px',
  lineHeight: 1.6,
  color: 'var(--color-ink-black)',
  letterSpacing: '-0.32px',
}

export default function NowPage() {
  return (
    <>
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

          <div style={{ ...kickerStyleDark }}>// NOW</div>

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
              marginBottom: '32px',
              textWrap: 'balance',
            }}
          >
            WHAT I&apos;M UP TO.
          </ScrollFloat>

          <p
            style={{
              fontFamily: 'var(--font-suisseintl)',
              fontWeight: 400,
              fontSize: '18px',
              lineHeight: 1.4,
              color: 'var(--color-steel-gray)',
              letterSpacing: '-0.18px',
              maxWidth: '480px',
            }}
          >
            A living snapshot — updated when things change. Inspired by Derek Sivers&apos; /now
            movement.
          </p>
        </div>
      </div>

      {/* B: Two-column main content */}
      <div style={{ background: 'var(--color-canvas-mist)', padding: 'var(--section-y) var(--gutter)' }}>
        <div
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'var(--now-main-cols)',
            gap: 'var(--now-gap)',
            alignItems: 'start',
          }}
        >
          {/* LEFT: sticky now rows card */}
          <div
            className="now-aside"
            style={{
              background: 'var(--color-pure-white)',
              borderRadius: '32px',
              padding: 'clamp(24px, 5vw, 40px)',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-suisseintlmono)',
                fontSize: '12px',
                color: 'var(--color-muted-on-light)',
                letterSpacing: '-0.36px',
                marginBottom: '24px',
              }}
            >
              // CURRENT STATUS
            </div>

            {nowRows.map((row, i, arr) => (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '100px minmax(0, 1fr)',
                  gap: '16px',
                  padding: '20px 0',
                  borderBottom: i < arr.length - 1 ? '1px solid var(--color-canvas-mist)' : 'none',
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--font-suisseintlmono)',
                    fontSize: '12px',
                    color: 'var(--color-muted-on-light)',
                    letterSpacing: '-0.36px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '6px',
                    paddingTop: '2px',
                  }}
                >
                  <span>{row.icon}</span>
                  <span>{row.label}</span>
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-suisseintl)',
                    fontWeight: 400,
                    fontSize: '15px',
                    lineHeight: 1.4,
                    color: 'var(--color-ink-black)',
                    letterSpacing: '-0.3px',
                  }}
                >
                  {row.value}
                </div>
              </div>
            ))}

            <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid var(--color-canvas-mist)' }}>
              <span
                style={{
                  background: 'var(--color-mint-pulse)',
                  color: 'var(--color-ink-black)',
                  fontFamily: 'var(--font-suisseintlmono)',
                  fontSize: '12px',
                  borderRadius: '48px',
                  padding: '6px 16px',
                  letterSpacing: '-0.36px',
                }}
              >
                OPEN TO BACKEND ROLES
              </span>
              <p
                style={{
                  fontFamily: 'var(--font-suisseintl)',
                  fontWeight: 400,
                  fontSize: '13px',
                  lineHeight: 1.4,
                  color: 'var(--color-muted-on-light)',
                  letterSpacing: '-0.28px',
                  marginTop: '12px',
                }}
              >
                Open to SDE-2 / senior backend roles. Remote preferred, India WFO considered.
              </p>
            </div>
          </div>

          {/* RIGHT: context blocks */}
          <div>
            <div
              style={{
                background: 'var(--color-pure-white)',
                borderRadius: '24px',
                padding: 'clamp(24px, 5vw, 40px)',
                marginBottom: '24px',
              }}
            >
              <div style={{ ...kickerStyleLight }}>// BUILDING</div>
              <ScrollFloat as="h2" style={{ ...blockHeadingStyle }}>SMARTFORMFLOW.</ScrollFloat>
              <p style={{ ...blockBodyStyle }}>
                Building multi-step conditional logic and a real-time split-pane form preview
                on top of the live Razorpay payment flow. Currently finishing the pre-launch
                checklist — legal
                pages, Sentry error tracking, and uptime monitoring — before opening the first 10
                paying clients. The platform handles event registrations, certificate issuance,
                and WhatsApp/email messaging for SMB organizers. Built solo on a single VPS,
                5-container Docker Compose stack.
              </p>
            </div>

            <div
              style={{
                background: 'var(--color-pure-white)',
                borderRadius: '24px',
                padding: 'clamp(24px, 5vw, 40px)',
                marginBottom: '24px',
              }}
            >
              <div style={{ ...kickerStyleLight }}>// LEARNING</div>
              <ScrollFloat as="h2" style={{ ...blockHeadingStyle }}>DISTRIBUTED SYSTEMS.</ScrollFloat>
              <p style={{ ...blockBodyStyle }}>
                Reading Designing Data-Intensive Applications by Martin Kleppmann — working
                through the replication, partitioning, and consistency chapters. The QuizBuzz
                load-testing session surfaced a class of failure (data stranded in the wrong
                backing store during a topology change) that DDIA covers rigorously. Going through
                it as a way to put first-principles vocabulary on patterns already encountered in
                production.
              </p>
              <div style={{ display: 'flex', gap: '8px', marginTop: '20px', flexWrap: 'wrap' }}>
                {[
                  'Replication',
                  'Consensus',
                  'CAP Theorem',
                  'Event Sourcing',
                  'CQRS',
                  'Distributed Transactions',
                ].map((t) => (
                  <SkillTag key={t}>{t}</SkillTag>
                ))}
              </div>
            </div>

            <div
              style={{
                background: 'var(--color-pure-white)',
                borderRadius: '24px',
                padding: 'clamp(24px, 5vw, 40px)',
                marginBottom: '24px',
              }}
            >
              <div style={{ ...kickerStyleLight }}>// STATUS</div>
              <ScrollFloat as="h2" style={{ ...blockHeadingStyle }}>OPEN TO ROLES.</ScrollFloat>
              <p style={{ ...blockBodyStyle }}>
                Completing my MSc in Computer Science (June–July 2026), with 1.5 years of
                full-time production experience building backend systems, infrastructure, and
                async job pipelines. Targeting SDE-2 or senior backend engineer roles at startups
                — teams building real infrastructure where backend reliability matters. Remote
                preferred; open to WFO in India.
              </p>
              <div
                style={{
                  marginTop: '24px',
                  paddingTop: '24px',
                  borderTop: '1px solid var(--color-canvas-mist)',
                  display: 'flex',
                  gap: '12px',
                }}
              >
                <a
                  href="https://cal.com/austinmakasare"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-sketch btn-sketch--primary"
                  style={{ padding: '10px 20px' }}
                >
                  Book a Call
                </a>
                <a
                  href="/austin-makasare-resume.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-sketch"
                  style={{ padding: '10px 20px' }}
                >
                  View Resume →
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* C: Dark stack strip */}
      <div style={{ background: 'var(--color-ink-black)', padding: 'var(--section-y) var(--gutter)' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <div style={{ ...kickerStyleDark }}>// CURRENT STACK</div>

          <ScrollFloat
            as="h2"
            style={{
              fontFamily: 'var(--font-suisseintlcond)',
              fontWeight: 700,
              fontSize: 'var(--fs-display-md)',
              lineHeight: 0.9,
              letterSpacing: '-0.03em',
              color: 'var(--color-pure-white)',
              marginBottom: '40px',
            }}
          >
            WHAT I&apos;M WORKING WITH.
          </ScrollFloat>

          {stackGroups.map((group) => (
            <div key={group.label} style={{ marginBottom: '32px' }}>
              <div
                style={{
                  fontFamily: 'var(--font-suisseintlmono)',
                  fontSize: '12px',
                  color: 'var(--color-muted-on-dark)',
                  letterSpacing: '-0.36px',
                  marginBottom: '12px',
                }}
              >
                {group.label}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {group.tags.map((t) => (
                  <span
                    key={t}
                    style={{
                      fontFamily: 'var(--font-suisseintlmono)',
                      fontSize: '12px',
                      color: 'var(--color-ink-black)',
                      background: 'var(--color-pure-white)',
                      borderRadius: '20px',
                      padding: '6px 12px',
                      letterSpacing: '-0.36px',
                      display: 'inline-block',
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      </main>
      <Footer />
    </>
  )
}
