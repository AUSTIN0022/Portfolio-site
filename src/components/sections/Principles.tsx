import { MonoKicker } from '@/components/ui/MonoKicker'

const principles = [
  {
    title: 'RELIABILITY OVER FEATURES.',
    desc: 'A feature that fails silently is worse than one that never shipped. I build for correctness first and polish second.',
  },
  {
    title: 'DESIGN FOR FAILURE.',
    desc: 'Networks partition, disks fill, processes die. Every system I ship assumes the worst path and degrades without taking the rest down.',
  },
  {
    title: 'IDEMPOTENCY IS NON-NEGOTIABLE.',
    desc: 'Retries happen, messages duplicate, clients double-submit. An operation is safe to run twice or it does not ship.',
  },
  {
    title: 'OBSERVABILITY BY DEFAULT.',
    desc: 'You cannot fix what you cannot see. Logs, metrics, and traces are part of the feature — not an afterthought bolted on later.',
  },
  {
    title: 'SIMPLE SCALES.',
    desc: 'The most scalable system is the one you can still reason about at 3am. I optimize for clarity before cleverness.',
  },
]

export function Principles() {
  return (
    <section
      id="principles"
      style={{ background: 'var(--color-canvas-mist)', padding: 'var(--section-y) var(--gutter)' }}
    >
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        <div style={{ marginBottom: '48px' }}>
          <MonoKicker>// HOW I BUILD</MonoKicker>
          <h2
            data-gsap="heading"
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
            FIRST PRINCIPLES.
          </h2>
          <p
            style={{
              fontFamily: 'var(--font-suisseintl)',
              fontWeight: 400,
              fontSize: '16px',
              lineHeight: 1.33,
              color: 'var(--color-graphite)',
              letterSpacing: '-0.32px',
              marginTop: '16px',
              maxWidth: '520px',
            }}
          >
            Everything I ship derives from five core axioms. They decide the
            trade-offs before the first line of code.
          </p>
        </div>

        <div>
          {principles.map((p, i) => (
            <div key={p.title} className="principle-row">
              <span className="principle-num">{String(i + 1).padStart(2, '0')}</span>
              <h3
                style={{
                  fontFamily: 'var(--font-suisseintlcond)',
                  fontWeight: 700,
                  fontSize: 'var(--fs-display-md)',
                  lineHeight: 0.95,
                  letterSpacing: '-0.03em',
                  color: 'var(--color-ink-black)',
                }}
              >
                {p.title}
              </h3>
              <p
                style={{
                  fontFamily: 'var(--font-suisseintl)',
                  fontWeight: 400,
                  fontSize: '15px',
                  lineHeight: 1.4,
                  color: 'var(--color-graphite)',
                  letterSpacing: '-0.3px',
                }}
              >
                {p.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
