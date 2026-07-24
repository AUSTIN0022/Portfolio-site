import { CaseStudyLayout } from '@/components/sections/CaseStudyLayout'
import { CaseStudySection } from '@/components/sections/CaseStudySection'
import { P, Lead, Callout, Metric, MetricGrid, DecisionCard } from '@/components/ui/CaseStudyProse'
import { DecisionCardTrack } from '@/components/ui/DecisionCardTrack'
import { SkillTag } from '@/components/ui/SkillTag'
import { Nav } from '@/components/nav/Nav'
import { Footer } from '@/components/sections/Footer'
import type { Metadata } from 'next'
import { JsonLd } from '@/components/seo/JsonLd'
import { projectSchema, breadcrumbSchema } from '@/lib/seo/jsonLd'

export const metadata: Metadata = {
  title: 'SmartFormFlow — Multi-tenant Event SaaS Case Study',
  description:
    'Case study: multi-tenant event SaaS with payments, automated certificate generation, and WhatsApp delivery — engineered around async workers and global contact deduplication. Node.js, Express, BullMQ, Prisma, PostgreSQL, Razorpay, Docker.',
  alternates: { canonical: '/work/smartformflow' },
  keywords: ['SmartFormFlow', 'SaaS', 'async workers', 'BullMQ', 'Razorpay', 'multi-tenant', 'background jobs', 'Prisma', 'Austin Makasare'],
  openGraph: {
    title: 'SmartFormFlow — Austin Makasare',
    description:
      'Case study: multi-tenant event SaaS with payments, automated certificates, and async job queues.',
    url: '/work/smartformflow',
    type: 'article',
  },
}

const overviewStack = [
  'Node.js',
  'TypeScript',
  'Express 5',
  'Prisma 7',
  'PostgreSQL',
  'BullMQ',
  'Redis',
  'Next.js',
  'Razorpay',
  'AWS S3',
  'Docker',
  'PDFKit',
  'Sharp',
  'Zod',
  'Vitest',
]

export default function SmartFormFlowPage() {
  return (
    <>
      <JsonLd
        data={[
          projectSchema('smartformflow')!,
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Work', path: '/work' },
            { name: 'SmartFormFlow', path: '/work/smartformflow' },
          ]),
        ]}
      />
      <Nav />
      <CaseStudyLayout
        projectName="SMARTFORMFLOW"
        category="FULLSTACK · SAAS · ASYNC · 2025–2026"
      >
        <CaseStudySection id="overview" kicker="// PROJECT" heading="SMARTFORMFLOW">
          <Lead>
            A multi-tenant SaaS platform for event organizers to build dynamic
            registration forms, collect payments, automatically issue certificates, message
            attendees over email and WhatsApp, and manage every attendee as a deduplicated contact
            across all their events.
          </Lead>
          <P>
            Started as an internal tool for a single client. As it proved itself in production, the
            decision was made to generalize it into a proper multi-tenant SaaS — which meant
            retrofitting every layer: database queries, service boundaries, auth, payments,
            workers, and analytics.
          </P>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '32px' }}>
            {overviewStack.map((tag) => (
              <SkillTag key={tag}>{tag}</SkillTag>
            ))}
          </div>
        </CaseStudySection>

        <CaseStudySection id="problem" kicker="// THE CHALLENGE" heading="SAAS. NOT A TOOL.">
          <Lead>
            Single-tenant tools are easy. Multi-tenant SaaS — where every query must be org-scoped,
            every async job must be isolated, and every payment flows through the right merchant
            account — is a different architectural category.
          </Lead>
          <Callout label="ASYNC-FIRST REQUIREMENT">
            Certificate generation, email/WhatsApp delivery, CSV export, and analytics rollups
            can&apos;t block the request cycle. A burst of certificate jobs during a live event
            shouldn&apos;t degrade API latency for concurrent users. Every slow operation must run
            on a queue.
          </Callout>
          <Callout label="DEDUPLICATION REQUIREMENT">
            The same person registers for multiple events — sometimes with slightly different
            email/phone formatting, sometimes using a field labeled &apos;Mobile Number&apos; vs
            &apos;Contact No.&apos; The platform must resolve all of these to one canonical Contact
            record, with all their event history attached.
          </Callout>
          <Callout label="PAYMENT ISOLATION REQUIREMENT">
            SFF doesn&apos;t sit between organizers and their money. Each organization connects its
            own Razorpay account. Money flows directly to the organizer. Webhook signature
            verification uses each org&apos;s own secret, not a shared platform secret.
          </Callout>
        </CaseStudySection>

        <CaseStudySection id="system" kicker="// ARCHITECTURE" heading="LAYERED. ASYNC. ISOLATED.">
          <Lead>
            Strict layered architecture with a five-container Docker Compose topology and a BullMQ
            fire-and-forget pattern for every slow operation.
          </Lead>
          <Callout label="BACKEND LAYER DISCIPLINE">
            Request → Router → Controller → Service → Repository → Prisma → PostgreSQL. Controllers
            are thin — extract request data, call one service method, shape the response.
            Repositories are the only layer allowed to touch Prisma. Services own all business
            logic and are wired once via a central container.ts dependency injector.
          </Callout>
          <Callout label="ASYNC PIPELINE">
            Route → Controller → Service → BullMQ Queue → Worker → WorkerService → Provider. The
            worker Docker container is isolated from the API container — a burst of background jobs
            can&apos;t starve request-handling threads. The frontend enqueues, gets an immediate
            response, and polls for completion.
          </Callout>
          <Callout label="FIVE-CONTAINER TOPOLOGY">
            frontend (Next.js), backend (Express), worker (BullMQ consumer), redis, postgres — all
            Docker Compose. Nginx as reverse proxy with SSL termination. CI/CD: GitHub Actions
            builds images → GHCR → VPS pull-and-restart. Zero SSH deploys.
          </Callout>
        </CaseStudySection>

        <CaseStudySection id="decisions" kicker="// ENGINEERING DECISIONS" heading="WHAT I BUILT.">
          <DecisionCardTrack>
          <DecisionCard
            number={1}
            title="Closing three cross-tenant data leaks"
            shipped={true}
            problem="The multi-tenancy migration surfaced three real data-leak bugs: the form service filtered by userId instead of organizationId, Event.findById had no org assertion, and Certificate.issueCertificate had no org assertion — holdovers from the single-client-tool era."
            approach="Full manual audit across every backend system. Added organizationId to every where clause. Established a standing test pattern: org isolation tests assert a 404, not a 403 — the API should behave as if the other org's resource doesn't exist at all."
            outcome="Zero cross-tenant data leaks in all audited endpoints. Automated org-isolation tests run as a mandatory pre-deploy gate."
          />
          <DecisionCard
            number={2}
            title="Normalizing real-world contact field labels"
            shipped={true}
            problem="Contact deduplication only recognized fields literally labeled 'phone' or 'email'. A field labeled 'Mobile Number', 'WhatsApp Number', or 'Contact No.' was silently treated as a new contact — fragmenting the same person into multiple records."
            approach="Built a normalized field-alias registry (fieldAliases.ts) that maps dozens of real-world label variants to canonical phone/email properties, with logging for near-misses to iteratively expand the list."
            outcome="Deduplication works across real form field naming patterns. Near-miss logging lets the registry grow from actual usage rather than upfront guessing."
          />
          <DecisionCard
            number={3}
            title="Fixing a silent Razorpay receipt-limit failure"
            shipped={true}
            problem="Razorpay order creation silently failed for some organizations. No validation error was returned. Root cause: the receipt field has an undocumented 40-character hard limit — raw UUIDs with a prefix exceed it."
            approach="Strip dashes from the UUID, take the first 30 characters, prefix with rcpt_. Applied once at the boundary where orders.create is called. Amounts stored in display units everywhere else in the codebase — conversion to paise (×100) happens only at the Razorpay API boundary."
            outcome="Order creation reliable across all orgs. Currency unit discipline prevents a class of subtle rounding bug from propagating through the codebase."
          />
          <DecisionCard
            number={4}
            title="Three silent production failures, three standing rules"
            shipped={true}
            problem="Three separate production reliability bugs surfaced that were each hard to diagnose: SMTP silently failed in production (Docker Compose corrupted the SMTP password by interpreting $ as shell variable substitution), Nodemailer failed only in prod because createTransport ran before dotenv populated process.env, and BullMQ certificate jobs failed silently because a dynamic import didn't resolve under CommonJS TypeScript."
            approach="Quote every .env value containing $. Lazy-instantiate the Nodemailer transporter behind a getter so it constructs on first use, after env vars are loaded. Convert all worker-file imports to static top-level imports."
            outcome="Each bug turned into a standing rule rather than a one-off patch. The .env quoting rule alone has prevented several subsequent production issues."
          />
          <DecisionCard
            number={5}
            title="A two-phase protocol for live-data migrations"
            shipped={true}
            problem="The database migration was needed in production against a live client's data. prisma migrate dev would re-run all migrations, risking data loss. Hand-editing migration files risks corrupting the _prisma_migrations history table."
            approach="Strict two-phase protocol: Phase 1 applies only additive, nullable columns via psql directly, then registers the migration as applied without re-running it (prisma migrate resolve --applied). Phase 2 (constraints, NOT NULL, unique indexes) only after the corresponding code is deployed and backfill is complete."
            outcome="Zero data loss across all schema migrations on live production data. The protocol is now the standing rule for any future migration touching existing rows."
          />
          </DecisionCardTrack>
        </CaseStudySection>

        <CaseStudySection id="multitenancy" kicker="// MULTI-TENANCY" heading="THE CENTRAL DISCIPLINE.">
          <Lead>
            The single most important rule in the codebase: every query touching organization-owned
            data must include organizationId in its where clause.
          </Lead>
          <Callout label="THE RULE">
            findById(formId, organizationId) is correct. findById(formId) is a cross-tenant data
            leak. There is no exception to this rule — even for endpoints that feel &apos;internal
            only.&apos; The audit found leaks in the form service, Event.findById, and
            Certificate.issueCertificate — all from the single-client-tool era.
          </Callout>
          <Callout label="THE TEST PATTERN">
            Org isolation tests assert a 404, not a 403. The API should behave as if the other
            org&apos;s resource doesn&apos;t exist at all — not confirm its existence via an
            access-denied response. This prevents a class of IDOR vulnerability where 403 reveals
            that a resource exists at that ID.
          </Callout>
          <Callout label="PAYMENT ISOLATION">
            Each org stores its own encrypted Razorpay credentials (keyId, keySecretEnc,
            webhookSecretEnc) in OrgPaymentConfig. Webhook signature verification uses that
            org&apos;s own webhook secret, not a shared platform secret. Money never touches
            SmartFormFlow — it flows directly from attendee to organizer&apos;s Razorpay account.
          </Callout>
        </CaseStudySection>

        <CaseStudySection id="results" kicker="// RESULTS" heading="WHAT WAS ACHIEVED.">
          <MetricGrid>
            <Metric value="25+" label="DATABASE MODELS" />
            <Metric value="5" label="DOCKER SERVICES" />
            <Metric value="0" label="CROSS-TENANT LEAKS (AUDITED)" />
          </MetricGrid>
          <P>
            Pre-launch: legal pages, Sentry monitoring, a public pricing page. Pre-marketing:
            infrastructure load testing (k6, 200–500 concurrent VUs against the submission
            endpoint), Cloudflare, rate limiting, frontend for the already-built team/role backend.
          </P>
          <P>
            Features shipped: dynamic single/multi-step form builder, optional per-form payment
            collection, public form sharing, org-level analytics funnel, automated certificate
            generation, email + WhatsApp messaging with database-driven templates, global contact
            deduplication, field-level drop-off tracking, CSV export, team collaboration with
            role-based membership, and full CI/CD.
          </P>
        </CaseStudySection>

        <CaseStudySection id="lessons" kicker="// RETROSPECTIVE" heading="WHAT I'D DO DIFFERENTLY.">
          <Callout label="RETROFIT MULTI-TENANCY IS EXPENSIVE">
            Multi-tenancy added as a retrofit — rather than designed in from the start — required a
            full audit of every backend system and produced real data-leak bugs. If I were starting
            over, organizationId would be in every table from migration 001, and the standing test
            pattern (404-not-403 org isolation) would be in the test suite from day one, not added
            after the audit.
          </Callout>
          <Callout label="PRODUCTION INCIDENTS BECOME STANDING RULES">
            The .env dollar-sign bug, the Nodemailer lazy-init bug, the Razorpay receipt-length
            bug, the webhook raw-body-ordering bug — each one became a standing rule and a
            checklist item rather than a one-off patch. The value isn&apos;t just fixing the bug;
            it&apos;s never hitting the same class of bug again.
          </Callout>
          <Callout label="DEFER THE CANVAS, SHIP THE VALUE">
            The decision to defer a full visual canvas editor (for spatial image placement in
            certificates and forms) in favor of a simpler split-pane preview was deliberate and
            documented — not just skipped. The canvas is the right long-term answer; it&apos;s
            premature for a 2-person team pre-launch. Knowing when not to build is as important as
            knowing how to build.
          </Callout>
        </CaseStudySection>
      </CaseStudyLayout>
      <Footer />
    </>
  )
}
