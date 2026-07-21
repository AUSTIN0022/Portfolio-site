import { MonoKicker } from '@/components/ui/MonoKicker'
import ScrollFloat from '@/components/ui/ScrollFloat'
import LogoLoop, { type LogoItem } from '@/components/ui/LogoLoop'
import { LogoTooltip } from '@/components/ui/LogoTooltip'
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

// Every item is a real mark. simple-icons has no BullMQ or AWS entry (AWS
// was dropped for trademark reasons), and "REST APIs" / "Event-driven" /
// "System Design" are architecture concepts, not products — those five get
// the closest representative icon instead of a brand logo. Every icon is
// wrapped in LogoTooltip so hovering it (rather than reading the marquee
// mid-scroll) reveals the name it stands for.
const techLogos: LogoItem[] = [
  {
    node: (
      <LogoTooltip label="Node.js">
        <SiNodedotjs color={iconColor} />
      </LogoTooltip>
    ),
    title: 'Node.js',
    href: 'https://nodejs.org',
  },
  {
    node: (
      <LogoTooltip label="TypeScript">
        <SiTypescript color={iconColor} />
      </LogoTooltip>
    ),
    title: 'TypeScript',
    href: 'https://www.typescriptlang.org',
  },
  {
    node: (
      <LogoTooltip label="PostgreSQL">
        <SiPostgresql color={iconColor} />
      </LogoTooltip>
    ),
    title: 'PostgreSQL',
    href: 'https://www.postgresql.org',
  },
  {
    node: (
      <LogoTooltip label="Redis">
        <SiRedis color={iconColor} />
      </LogoTooltip>
    ),
    title: 'Redis',
    href: 'https://redis.io',
  },
  {
    node: (
      <LogoTooltip label="BullMQ">
        <MdQueue color={iconColor} />
      </LogoTooltip>
    ),
    title: 'BullMQ',
    href: 'https://docs.bullmq.io',
  },
  {
    node: (
      <LogoTooltip label="Next.js">
        <SiNextdotjs color={iconColor} />
      </LogoTooltip>
    ),
    title: 'Next.js',
    href: 'https://nextjs.org',
  },
  {
    node: (
      <LogoTooltip label="Prisma">
        <SiPrisma color={iconColor} />
      </LogoTooltip>
    ),
    title: 'Prisma',
    href: 'https://www.prisma.io',
  },
  {
    node: (
      <LogoTooltip label="AWS">
        <FaAws color={iconColor} />
      </LogoTooltip>
    ),
    title: 'AWS',
    href: 'https://aws.amazon.com',
  },
  {
    node: (
      <LogoTooltip label="Docker">
        <SiDocker color={iconColor} />
      </LogoTooltip>
    ),
    title: 'Docker',
    href: 'https://www.docker.com',
  },
  {
    node: (
      <LogoTooltip label="REST APIs">
        <MdApi color={iconColor} />
      </LogoTooltip>
    ),
    title: 'REST APIs',
  },
  {
    node: (
      <LogoTooltip label="Event-driven">
        <MdBolt color={iconColor} />
      </LogoTooltip>
    ),
    title: 'Event-driven',
  },
  {
    node: (
      <LogoTooltip label="System Design">
        <MdAccountTree color={iconColor} />
      </LogoTooltip>
    ),
    title: 'System Design',
  },
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
            systems, from distributed job queues to APIs load-tested to 7,500 concurrent
            WebSocket users.
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
            style={{ height: '56px', position: 'relative', overflow: 'hidden' }}
          >
            <LogoLoop
              logos={techLogos}
              speed={60}
              direction="left"
              logoHeight={40}
              gap={48}
              fadeOut
              fadeOutColor="var(--color-canvas-mist)"
              scaleOnHover
              ariaLabel="Technologies I work with"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
