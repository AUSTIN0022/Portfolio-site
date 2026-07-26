import { STAGES, NODES, BEATS } from '@/content/quizbuzzArchitecture'

const DIAGRAMS = [
  {
    title: 'Dual-Mode AWS Infrastructure',
    description:
      'Idle mode (~$35/mo): single EC2, local Redis. Live mode (+$14-30/contest): ALB + ASG + ElastiCache. Mode switch via Terraform + redis-migrate.js.',
  },
  {
    title: 'Real-Time WebSocket Flow',
    description:
      'Participant journey: REST auth → EIO4 WebSocket handshake → waiting room → quiz → submission. BullMQ handles all heavy async work.',
  },
  {
    title: 'Background Worker System (BullMQ)',
    description:
      'API/WebSocket container never blocks. A separate worker process consumes 6 queues for evaluation, certificates, messaging, proctoring scoring, analytics, and timer management.',
  },
  {
    title: 'Database Schema (Key Relationships)',
    description:
      '~25 Prisma models. Every table scoped by organizationId. Contact is the deduplicated master record. Participant is a Contact × Contest registration.',
  },
  {
    title: 'Backend Module Dependencies',
    description:
      'Messaging is the most-depended-on module (7 incoming). Contest is the primary domain entity. Dependency injection via central container.ts — no ad-hoc instantiation.',
  },
]

/**
 * Text-only mirror of the Architecture Journey, Infra Scale Simulator, and
 * diagram gallery — all three are scroll-triggered client components (canvas/
 * SVG builds that only mount once scrolled into view) with no server-rendered
 * equivalent, so a crawler that doesn't execute JS/scroll sees only the
 * "scroll to load" placeholder. This renders the same underlying data as
 * plain, always-present text so that content is not lost to non-JS or
 * non-scrolling crawlers. Visually hidden via `.sr-only`, not `display:none`,
 * so it stays in the accessibility tree for screen readers too.
 */
export function QuizBuzzCrawlableSummary() {
  return (
    <div className="sr-only">
      <h3>Architecture Journey — how a request travels through QuizBuzz</h3>
      <ol>
        {STAGES.map((stage) => (
          <li key={stage.key}>
            <strong>{stage.title}.</strong> {stage.subtitle}
            {stage.why ? ` ${stage.why}` : ''}
          </li>
        ))}
      </ol>

      <h3>System components</h3>
      <ul>
        {NODES.map((node) => (
          <li key={node.id}>
            {node.label}
            {node.sub ? ` — ${node.sub}` : ''}
          </li>
        ))}
      </ul>

      <h3>Infrastructure scaling — from idle to 7,500 concurrent users</h3>
      <ol>
        {BEATS.map((beat) => (
          <li key={beat.key}>
            <strong>{beat.title}.</strong> {beat.subtitle}
            {beat.why ? ` ${beat.why}` : ''}
          </li>
        ))}
      </ol>

      <h3>Architecture diagrams</h3>
      <ul>
        {DIAGRAMS.map((d) => (
          <li key={d.title}>
            <strong>{d.title}.</strong> {d.description}
          </li>
        ))}
      </ul>
    </div>
  )
}
