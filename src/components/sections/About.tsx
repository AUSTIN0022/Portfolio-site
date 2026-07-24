import { MonoKicker } from '@/components/ui/MonoKicker'
import ScrollFloat from '@/components/ui/ScrollFloat'
import { SkillTag } from '@/components/ui/SkillTag'
import {
  SiNodedotjs,
  SiTypescript,
  SiPostgresql,
  SiRedis,
  SiNextdotjs,
  SiPrisma,
  SiDocker,
} from 'react-icons/si'
import { FaAws } from 'react-icons/fa6'
import { MdApi, MdBolt, MdAccountTree, MdQueue } from 'react-icons/md'

const iconColor = 'var(--color-graphite)'
const iconStyle = { display: 'inline-flex', marginRight: '6px', verticalAlign: '-2px' }

// Every item is a real mark, always shown with its label — no marquee, no
// hover-to-reveal tooltip. simple-icons has no BullMQ or AWS entry (AWS was
// dropped for trademark reasons), and "REST APIs" / "Event-driven" /
// "System Design" are architecture concepts, not products — those three get
// the closest representative icon instead of a brand logo.
const techItems: { icon: React.ReactNode; label: string }[] = [
  { icon: <SiNodedotjs color={iconColor} style={iconStyle} />, label: 'Node.js' },
  { icon: <SiTypescript color={iconColor} style={iconStyle} />, label: 'TypeScript' },
  { icon: <SiPostgresql color={iconColor} style={iconStyle} />, label: 'PostgreSQL' },
  { icon: <SiRedis color={iconColor} style={iconStyle} />, label: 'Redis' },
  { icon: <MdQueue color={iconColor} style={iconStyle} />, label: 'BullMQ' },
  { icon: <SiNextdotjs color={iconColor} style={iconStyle} />, label: 'Next.js' },
  { icon: <SiPrisma color={iconColor} style={iconStyle} />, label: 'Prisma' },
  { icon: <FaAws color={iconColor} style={iconStyle} />, label: 'AWS' },
  { icon: <SiDocker color={iconColor} style={iconStyle} />, label: 'Docker' },
  { icon: <MdApi color={iconColor} style={iconStyle} />, label: 'REST APIs' },
  { icon: <MdBolt color={iconColor} style={iconStyle} />, label: 'Event-driven' },
  { icon: <MdAccountTree color={iconColor} style={iconStyle} />, label: 'System Design' },
]

export function About() {
  return (
    <section
      id="about"
      style={{ background: 'var(--color-canvas-mist)', padding: 'var(--section-y) var(--gutter)' }}
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
        <div>
          <MonoKicker>// ABOUT ME</MonoKicker>
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
              textWrap: 'balance',
            }}
          >
            BUILDING THINGS THAT DON&apos;T BREAK.
          </ScrollFloat>
        </div>

        <div>
          <p
            style={{
              fontFamily: 'var(--font-suisseintl)',
              fontWeight: 400,
              fontSize: '20px',
              lineHeight: 1.25,
              color: 'var(--color-ink-black)',
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
              color: 'var(--color-ink-black)',
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
            {techItems.map((item) => (
              <SkillTag key={item.label}>
                {item.icon}
                {item.label}
              </SkillTag>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
