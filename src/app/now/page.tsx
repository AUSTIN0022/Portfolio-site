import Link from 'next/link'
import { Nav } from '@/components/nav/Nav'
import { SkillTag } from '@/components/ui/SkillTag'
import { nowData } from '@/content/now'

export const metadata = {
  title: 'Now — Austin Makasare',
  description: 'What Austin Makasare is currently building, learning, and thinking about.',
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

const kickerStyle: React.CSSProperties = {
  fontFamily: 'var(--font-suisseintlmono)',
  fontSize: '12px',
  color: '#979797',
  letterSpacing: '-0.36px',
  marginBottom: '16px',
}

const blockHeadingStyle: React.CSSProperties = {
  fontFamily: 'var(--font-suisseintlcond)',
  fontWeight: 700,
  fontSize: 'var(--fs-display-md)',
  lineHeight: 0.9,
  letterSpacing: '-0.03em',
  color: '#000000',
  marginBottom: '20px',
}

const blockBodyStyle: React.CSSProperties = {
  fontFamily: 'var(--font-suisseintl)',
  fontWeight: 400,
  fontSize: '16px',
  lineHeight: 1.6,
  color: '#000000',
  letterSpacing: '-0.32px',
}

export default function NowPage() {
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

          <div style={{ ...kickerStyle }}>// NOW</div>

          <h1
            style={{
              fontFamily: 'var(--font-suisseintlcond)',
              fontWeight: 700,
              fontSize: 'var(--fs-display)',
              lineHeight: 0.9,
              letterSpacing: '-0.03em',
              color: '#ffffff',
              maxWidth: '640px',
              marginBottom: '32px',
              textWrap: 'balance',
            }}
          >
            WHAT I&apos;M UP TO.
          </h1>

          <p
            style={{
              fontFamily: 'var(--font-suisseintl)',
              fontWeight: 400,
              fontSize: '18px',
              lineHeight: 1.4,
              color: '#979797',
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
      <div style={{ background: '#e5e7eb', padding: 'var(--section-y) var(--gutter)' }}>
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
              background: '#ffffff',
              borderRadius: '32px',
              padding: 'clamp(24px, 5vw, 40px)',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-suisseintlmono)',
                fontSize: '12px',
                color: '#979797',
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
                  gridTemplateColumns: '100px 1fr',
                  gap: '16px',
                  padding: '20px 0',
                  borderBottom: i < arr.length - 1 ? '1px solid #e5e7eb' : 'none',
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--font-suisseintlmono)',
                    fontSize: '12px',
                    color: '#979797',
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
                    color: '#000000',
                    letterSpacing: '-0.3px',
                  }}
                >
                  {row.value}
                </div>
              </div>
            ))}

            <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid #e5e7eb' }}>
              <span
                style={{
                  background: '#d1ffca',
                  color: '#000000',
                  fontFamily: 'var(--font-suisseintlmono)',
                  fontSize: '12px',
                  borderRadius: '48px',
                  padding: '6px 16px',
                  letterSpacing: '-0.36px',
                }}
              >
                AVAILABLE FOR WORK
              </span>
              <p
                style={{
                  fontFamily: 'var(--font-suisseintl)',
                  fontWeight: 400,
                  fontSize: '13px',
                  lineHeight: 1.4,
                  color: '#979797',
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
                background: '#ffffff',
                borderRadius: '24px',
                padding: 'clamp(24px, 5vw, 40px)',
                marginBottom: '24px',
              }}
            >
              <div style={{ ...kickerStyle }}>// BUILDING</div>
              <h2 style={{ ...blockHeadingStyle }}>SMARTFORMFLOW.</h2>
              <p style={{ ...blockBodyStyle }}>
                Adding Stripe payment flows, multi-step conditional logic, and a real-time
                split-pane form preview. Currently finishing the pre-launch checklist — legal
                pages, Sentry error tracking, and uptime monitoring — before opening the first 10
                paying clients. The platform handles event registrations, certificate issuance,
                and WhatsApp/email messaging for SMB organizers. Built solo on a single VPS,
                5-container Docker Compose stack.
              </p>
            </div>

            <div
              style={{
                background: '#ffffff',
                borderRadius: '24px',
                padding: 'clamp(24px, 5vw, 40px)',
                marginBottom: '24px',
              }}
            >
              <div style={{ ...kickerStyle }}>// LEARNING</div>
              <h2 style={{ ...blockHeadingStyle }}>DISTRIBUTED SYSTEMS.</h2>
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
                background: '#ffffff',
                borderRadius: '24px',
                padding: 'clamp(24px, 5vw, 40px)',
                marginBottom: '24px',
              }}
            >
              <div style={{ ...kickerStyle }}>// STATUS</div>
              <h2 style={{ ...blockHeadingStyle }}>OPEN TO ROLES.</h2>
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
                  borderTop: '1px solid #e5e7eb',
                  display: 'flex',
                  gap: '12px',
                }}
              >
                <a
                  href="https://cal.com/austinmakasare"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    background: '#000000',
                    color: '#ffffff',
                    fontFamily: 'var(--font-suisseintl)',
                    fontWeight: 500,
                    fontSize: '14px',
                    borderRadius: '4px',
                    padding: '10px 20px',
                    textDecoration: 'none',
                    letterSpacing: '-0.28px',
                  }}
                >
                  Book a Call
                </a>
                <a
                  href="/austin-makasare-resume.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    background: 'transparent',
                    color: '#000000',
                    border: '1px solid #000000',
                    fontFamily: 'var(--font-suisseintl)',
                    fontWeight: 500,
                    fontSize: '14px',
                    borderRadius: '4px',
                    padding: '10px 20px',
                    textDecoration: 'none',
                    letterSpacing: '-0.28px',
                  }}
                >
                  View Resume →
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* C: Dark stack strip */}
      <div style={{ background: '#000000', padding: 'var(--section-y) var(--gutter)' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <div style={{ ...kickerStyle }}>// CURRENT STACK</div>

          <h2
            style={{
              fontFamily: 'var(--font-suisseintlcond)',
              fontWeight: 700,
              fontSize: 'var(--fs-display-md)',
              lineHeight: 0.9,
              letterSpacing: '-0.03em',
              color: '#ffffff',
              marginBottom: '40px',
            }}
          >
            WHAT I&apos;M WORKING WITH.
          </h2>

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
                      color: '#000000',
                      background: '#ffffff',
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
    </>
  )
}
