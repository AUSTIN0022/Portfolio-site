import { MonoKicker } from '@/components/ui/MonoKicker'
import { SkillTag } from '@/components/ui/SkillTag'
import { getTechIcon } from '@/lib/techIcons'

// Every item is a real mark, always shown with its label — no marquee, no
// hover-to-reveal tooltip. Icons resolve through the shared techIcons map
// (@/lib/techIcons) so this list stays in sync with the marks used on the
// Hero tags and the /work case studies.
const techLabels = [
  'Node.js',
  'TypeScript',
  'PostgreSQL',
  'Redis',
  'BullMQ',
  'Next.js',
  'Prisma',
  'AWS',
  'Docker',
  'REST APIs',
  'Event-driven',
  'System Design',
]

export function About() {
  return (
    <section
      id="about"
      style={{ background: 'var(--color-bg)', padding: 'var(--section-y) var(--gutter)' }}
    >
      <div
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'var(--about-cols)',
          gap: 'var(--about-gap)',
          alignItems: 'start',
        }}
      >
        <div data-gsap="heading">
          <MonoKicker>// ABOUT ME</MonoKicker>
          <h2
            style={{
              fontFamily: 'var(--font-suisseintlcond)',
              fontWeight: 700,
              fontSize: 'var(--fs-display)',
              lineHeight: 0.9,
              letterSpacing: '-0.03em',
              color: 'var(--color-fg)',
              marginTop: '16px',
              textWrap: 'balance',
            }}
          >
            BUILDING THINGS THAT DON&apos;T BREAK.
          </h2>
        </div>

        <div>
          <p
            style={{
              fontFamily: 'var(--font-suisseintl)',
              fontWeight: 400,
              fontSize: '20px',
              lineHeight: 1.25,
              color: 'var(--color-fg)',
              letterSpacing: '-0.22px',
              marginBottom: '24px',
            }}
          >
            I&apos;m a backend engineer and MSc Computer Science student building production-grade
            systems, from distributed job queues to APIs battle-tested under real concurrent
            load.
          </p>
          <p
            style={{
              fontFamily: 'var(--font-suisseintl)',
              fontWeight: 400,
              fontSize: '16px',
              lineHeight: 1.33,
              color: 'var(--color-fg)',
              letterSpacing: '-0.32px',
              marginBottom: '40px',
            }}
          >
            My work focuses on the unglamorous but critical parts of software: queues that
            don&apos;t lose jobs, locks that don&apos;t deadlock, infrastructure that
            auto-scales. I care about reliability, not just features: the kind of backend
            you don&apos;t get paged for at 3am.
          </p>
          <div
            data-gsap="tags"
            style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}
          >
            {techLabels.map((label) => (
              <SkillTag key={label}>
                {getTechIcon(label)}
                {label}
              </SkillTag>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
