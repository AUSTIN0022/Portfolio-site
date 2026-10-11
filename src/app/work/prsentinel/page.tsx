import { CaseStudyLayout } from '@/components/sections/CaseStudyLayout'
import { CaseStudySection } from '@/components/sections/CaseStudySection'
import { P, Lead, Callout, Metric, MetricGrid, DecisionCard } from '@/components/ui/CaseStudyProse'
import { DecisionCardTrack } from '@/components/ui/DecisionCardTrack'
import { SkillTag } from '@/components/ui/SkillTag'
import { getTechIcon } from '@/lib/techIcons'
import { Nav } from '@/components/nav/Nav'
import { Footer } from '@/components/sections/Footer'
import type { Metadata } from 'next'
import { JsonLd } from '@/components/seo/JsonLd'
import { projectSchema, breadcrumbSchema } from '@/lib/seo/jsonLd'

const REPO = 'https://github.com/AUSTIN0022/PR-Sentinel'

export const metadata: Metadata = {
  title: 'PR Sentinel — AI Pull-Request Reviewer Case Study',
  description:
    'Case study: an AI pull-request reviewer running as a GitHub App — verified webhooks, a BullMQ worker, an orchestrator running specialised agents in parallel waves with permission-scoped tools, and a commit-keyed cache that cut GitHub calls up to 12× per review.',
  alternates: { canonical: '/work/prsentinel' },
  keywords: ['PR Sentinel', 'AI code review', 'GitHub App', 'multi-agent', 'BullMQ', 'Redis', 'Vercel AI SDK', 'Austin Makasare'],
  openGraph: {
    title: 'PR Sentinel — Austin Makasare',
    description: 'Case study: a multi-agent AI pull-request reviewer, from webhook to posted review.',
    url: '/work/prsentinel',
    type: 'article',
  },
}

const overviewStack = [
  'Node.js',
  'TypeScript',
  'Express',
  'BullMQ',
  'Redis',
  'PostgreSQL',
  'Prisma',
  'Next.js',
  'React',
  'Vercel AI SDK',
  'OpenRouter',
  'Tailwind CSS',
]

export default function PrSentinelPage() {
  return (
    <>
      <JsonLd
        data={[
          projectSchema('prsentinel')!,
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Work', path: '/work' },
            { name: 'PR Sentinel', path: '/work/prsentinel' },
          ]),
        ]}
      />
      <Nav />
      <CaseStudyLayout projectName="PR SENTINEL" category="AI AGENTS · GITHUB APP · 2026 · IN PROGRESS">
        <CaseStudySection id="overview" kicker="// PROJECT" heading="PR SENTINEL">
          <Lead>
            An AI pull-request reviewer that runs as a GitHub App. When a pull request opens, a verified
            webhook queues the review; an orchestrator plans it, runs specialised agents in parallel waves,
            filters their findings, and posts a structured review with line comments back to the PR.
          </Lead>
          <P>
            It&apos;s two applications: an Express + BullMQ backend that does the reviewing, and a Next.js 16
            dashboard that streams every run live — each agent, its tool calls, and its findings. The work is in
            progress and documented as it goes, in a running decision log in the repository.
          </P>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '32px' }}>
            {overviewStack.map((tag) => (
              <SkillTag key={tag}>
                {getTechIcon(tag)}
                {tag}
              </SkillTag>
            ))}
          </div>
          <div style={{ marginTop: '32px' }}>
            <a href={REPO} target="_blank" rel="noopener noreferrer" className="btn-sketch">
              View source on GitHub ↗
            </a>
          </div>
        </CaseStudySection>

        <CaseStudySection id="problem" kicker="// THE CHALLENGE" heading="REVIEWS THAT HOLD UP.">
          <Lead>
            An AI reviewer is easy to demo and hard to trust. It has to read real context without burning the
            GitHub API budget, survive restarts mid-review, and avoid confidently reporting things that aren&apos;t
            there.
          </Lead>
          <Callout label="BUDGET">
            A GitHub App installation shares one rate limit across every repository and every concurrent review.
            Agents that each fetch the same comments, diffs and files independently would exhaust it fast.
          </Callout>
          <Callout label="RESILIENCE">
            A review takes minutes and many model and API calls. A worker restart or a rate-limit pause must
            resume the review, not start it over — and must never look like a silent failure.
          </Callout>
          <Callout label="TRUST">
            Findings are only useful if they&apos;re right. A false positive costs a developer&apos;s attention; a
            run where every agent failed must never be reported as a clean pass.
          </Callout>
        </CaseStudySection>

        <CaseStudySection id="system" kicker="// ARCHITECTURE" heading="WEBHOOK TO REVIEW.">
          <Lead>
            Event-driven and decoupled: the webhook only verifies and enqueues; a worker owns the review from there,
            checkpointing every step.
          </Lead>
          <Callout label="THE PIPELINE">
            GitHub webhook → signature verification → BullMQ queue → worker → review orchestrator → PR
            understanding → planner → wave one → wave two → deduplication against earlier commits → reflection →
            review writer → GitHub review with line comments. Findings and per-agent executions are persisted to
            PostgreSQL; the dashboard reads them over REST and a live stream.
          </Callout>
          <Callout label="AGENT WAVES">
            A PR-understanding agent establishes intent, scope and risk; a planner schedules the specialists. Wave
            one — security, architecture, reliability — runs in parallel; wave two — testing, code quality,
            requirements — follows. A reflection agent then audits every finding for false positives before the
            writer posts.
          </Callout>
          <Callout label="PERMISSION-SCOPED TOOLS">
            Agents gather evidence through a tool registry of 12 tools — file contents, diffs, commits, dependency
            manifests, directory trees, file history, linked issues, CI status — each agent granted only the tools
            its role needs, inside a tool loop capped at eight steps.
          </Callout>
          <Callout label="THREE-TIER MEMORY">
            Run memory checkpoints each review step to Redis for instant recovery; cross-commit memory tracks
            findings as open, resolved or reopened across pushes; repository memory stores the detected stack and
            project-specific engineering rules.
          </Callout>
        </CaseStudySection>

        <CaseStudySection id="decisions" kicker="// ENGINEERING DECISIONS" heading="WHAT I BUILT.">
          <DecisionCardTrack>
            <DecisionCard
              number={1}
              title="Never fetch what an agent already has"
              shipped={true}
              problem="Six agents were each allowed to read the same PR comments and reviews, so a single review could make a dozen near-identical GitHub calls before it had read a single file."
              approach="Immutable git data — files, diffs, trees, history — cached by commit SHA and fetched once, ever. Mutable PR data served from tables kept in sync by webhooks. Code search deliberately stays live, because GitHub's search index moves."
              outcome="Up to 12× fewer GitHub calls per review. Cache hits are byte-identical to a live call, so review quality isn't traded for budget."
            />
            <DecisionCard
              number={2}
              title="Pause and resume instead of finding the ceiling in production"
              shipped={true}
              problem="Even with caching, a busy installation could run its shared GitHub budget down in the middle of a review."
              approach="A Redis-backed budget tracker fed from GitHub's own rate-limit headers. Below a soft floor no new wave starts — the review checkpoints and re-enqueues itself as a delayed job timed to the reset. Below a hard floor, tool calls fail with a structured error the agents already handle."
              outcome="The dashboard shows 'paused — resuming in ~12m' instead of a review that looks stuck or failed."
            />
            <DecisionCard
              number={3}
              title="A rate-limit floor that could deadlock a review"
              shipped={true}
              problem="Found in end-to-end testing: a review paused and re-paused forever with 90% of its budget left. A hard-coded minimum floor of 50 was larger than a rate-limit category whose entire limit was 10."
              approach="Floors became pure ratios of the reported limit, and the rate-limit category is now logged so the next surprisingly small limit is diagnosable."
              outcome="Reviews progress under every rate-limit category GitHub reports, not just the default one."
            />
            <DecisionCard
              number={4}
              title="One revoked token took down the whole server"
              shipped={true}
              problem="Express 4 doesn't forward rejected promises from async route handlers, so a single expired or revoked GitHub OAuth token crashed the entire process."
              approach="An async-handler wrapper on every route that lacked error handling, plus a specific 401 that tells the user to sign in again."
              outcome="One bad request now fails one request."
            />
            <DecisionCard
              number={5}
              title="A circuit breaker — and a dashboard that stopped lying"
              shipped={true}
              problem="When the model provider degraded, seven agents each burned three retries back to back; and a run where every agent failed was shown as a 'confirmed clean pass'."
              approach="A process-wide circuit breaker that opens for 60 seconds after three consecutive full failures. The dashboard's empty state now checks agent executions, not just the number of findings."
              outcome="No retry storms during outages, and an inconclusive review is reported as inconclusive."
            />
          </DecisionCardTrack>
        </CaseStudySection>

        <CaseStudySection id="results" kicker="// RESULTS" heading="WHERE IT STANDS.">
          <MetricGrid>
            <Metric value="11" label="SPECIALISED AGENTS" />
            <Metric value="12" label="PERMISSION-SCOPED TOOLS" />
            <Metric value="12×" label="FEWER GITHUB CALLS / REVIEW" />
            <Metric value="7 → 68" label="TESTS" />
          </MetricGrid>
          <P>
            Webhooks are verified with HMAC and stored tokens are encrypted with AES-256-GCM. The review pipeline,
            tool registry, memory layers and live dashboard are working end to end; development continues in the
            open, with every architectural and product decision written down as it&apos;s made.
          </P>
          <div style={{ marginTop: '24px' }}>
            <a href={REPO} target="_blank" rel="noopener noreferrer" className="btn-sketch">
              Follow the build on GitHub ↗
            </a>
          </div>
        </CaseStudySection>
      </CaseStudyLayout>
      <Footer />
    </>
  )
}
