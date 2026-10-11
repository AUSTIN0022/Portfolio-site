import { CaseStudyLayout } from '@/components/sections/CaseStudyLayout'
import { CaseStudySection } from '@/components/sections/CaseStudySection'
import { P, Lead, Callout, Metric, MetricGrid, DecisionCard } from '@/components/ui/CaseStudyProse'
import { ArchDiagram } from '@/components/ui/ArchDiagram'
import { DiagramGalleryProvider } from '@/components/ui/DiagramGallery'
import { DecisionCardTrack } from '@/components/ui/DecisionCardTrack'
import { LazyArchitectureJourney } from '@/components/ui/LazyArchitectureJourney'
import { LazyInfraScaleSimulator } from '@/components/ui/LazyInfraScaleSimulator'
import { QuizBuzzCrawlableSummary } from '@/components/work/QuizBuzzCrawlableSummary'
import { SkillTag } from '@/components/ui/SkillTag'
import { getTechIcon } from '@/lib/techIcons'
import { Nav } from '@/components/nav/Nav'
import { Footer } from '@/components/sections/Footer'
import type { Metadata } from 'next'
import { JsonLd } from '@/components/seo/JsonLd'
import { projectSchema, breadcrumbSchema } from '@/lib/seo/jsonLd'

export const metadata: Metadata = {
    title: 'QuizBuzz — Real-time Quiz Platform Case Study',
    description: 'Case study: multi-tenant quiz platform load-tested to 7,500 concurrent WebSocket users against a 10K-user architecture. Built solo with Node.js, Socket.IO, BullMQ, Redis, PostgreSQL, AWS, and Terraform.',
    alternates: { canonical: '/work/quizbuzz' },
    keywords: ['QuizBuzz', 'WebSocket scaling', 'Socket.IO', 'load testing', 'k6', 'Redis', 'BullMQ', 'multi-tenant', 'real-time backend', 'Austin Makasare'],
    openGraph: {
        title: 'QuizBuzz — Austin Makasare',
        description: 'Case study: multi-tenant quiz platform load-tested to 7,500 concurrent WebSocket users against a 10K-user architecture.',
        url: '/work/quizbuzz',
        type: 'article',
    },
}

const overviewStack = [
    'Node.js',
    'TypeScript',
    'Express',
    'Socket.IO',
    'BullMQ',
    'Redis',
    'PostgreSQL',
    'Prisma',
    'Next.js',
    'AWS',
    'Terraform',
    'k6',
    'Razorpay',
    'Docker',
    'GitHub Actions',
]

export default function QuizBuzzPage() {
    return (
        <>
            <JsonLd
                data={[
                    projectSchema('quizbuzz')!,
                    breadcrumbSchema([
                        { name: 'Home', path: '/' },
                        { name: 'Work', path: '/work' },
                        { name: 'QuizBuzz', path: '/work/quizbuzz' },
                    ]),
                ]}
            />
            <Nav />
            <QuizBuzzCrawlableSummary />
            <CaseStudyLayout
                projectName="QUIZBUZZ"
                category="BACKEND · REAL-TIME · INFRA · 2024–2026"
            >
                <CaseStudySection id="overview" kicker="// PROJECT" heading="QUIZBUZZ">
                    <Lead>
                        A multi-tenant SaaS platform for running large-scale, real-time, proctored online quiz
                        contests. Built end-to-end solo — backend, frontend, infrastructure, CI/CD, load
                        testing, and incident response — with an engineering target of 10,000 concurrent
                        WebSocket users.
                    </Lead>
                    <P>
                        Organizations sign up, create branded contests, collect paid registrations, run a live
                        timed quiz to thousands of simultaneous participants over WebSockets, auto-evaluate
                        answers, publish a leaderboard, and issue certificates — with live facial detection
                        proctoring throughout.
                    </P>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '32px' }}>
                        {overviewStack.map((tag) => (
                            <SkillTag key={tag}>
                                {getTechIcon(tag)}
                                {tag}
                            </SkillTag>
                        ))}
                    </div>
                </CaseStudySection>

                <CaseStudySection id="problem" kicker="// THE CHALLENGE" heading="SCALE WITHOUT COST.">
                    <Lead>
                        The core constraint: support up to 10,000 simultaneous WebSocket connections during a
                        live contest — which lasts 30 minutes to 2 hours — on a cost-conscious AWS footprint
                        that costs near zero when no contest is running.
                    </Lead>
                    <Callout label="WORKLOAD SHAPE">
                        Contest traffic is fundamentally spiky. Near-zero between events, then a hard burst of
                        sustained WebSocket connections during a live quiz. Reactive autoscaling doesn&apos;t
                        fit a scheduled, known-peak event — reactive tooling is too slow, and always-on
                        capacity wastes money.
                    </Callout>
                    <Callout label="REAL-TIME CONSTRAINT">
                        All 10,000 participants must receive the same events simultaneously — quiz start, time
                        warnings, question delivery, force-submit — over persistent WebSocket connections that
                        survive across server instances. State must be shared, not local.
                    </Callout>
                    <Callout label="INTEGRITY CONSTRAINT">
                        A participant&apos;s in-progress answers must survive crashes, reconnects, and
                        infrastructure mode switches. Zero data loss is the acceptance criterion.
                        &apos;Probably fine&apos; isn&apos;t good enough when someone has paid a registration
                        fee.
                    </Callout>
                </CaseStudySection>

                <CaseStudySection id="journey" kicker="// START HERE — WATCH IT ASSEMBLE" heading="THE ARCHITECTURE JOURNEY.">
                    <Lead>
                        The whole system, built in front of you. Scroll to fly the camera across the
                        architecture as one real request travels through it — registration and payment, the
                        real-time engine, background workers, and the infrastructure underneath. The detailed
                        diagrams and decisions that follow are the proof.
                    </Lead>
                    <LazyArchitectureJourney />
                </CaseStudySection>

                <CaseStudySection id="scale" kicker="// PRODUCTION ENGINEERING — TAKE THE CONTROLS" heading="FROM ONE USER TO TEN THOUSAND.">
                    <Lead>
                        The Journey showed how QuizBuzz works. This shows how it survives. Scroll to watch a
                        single idle instance meet a live contest — CPU pins, Auto Scaling launches capacity, the
                        load balancer spreads it out — then take the controls and push the system yourself.
                    </Lead>
                    <LazyInfraScaleSimulator />
                </CaseStudySection>

                <CaseStudySection id="system" kicker="// INFRASTRUCTURE" heading="DUAL-MODE INFRA.">
                    <Lead>
                        The central architectural bet: two completely different infrastructure stacks for two
                        completely different load profiles.
                    </Lead>
                    <Callout label="IDLE MODE — ~$35/MONTH">
                        A single EC2 instance (t3.small) runs everything: Next.js frontend, Express backend,
                        BullMQ worker, and a local Docker Redis container. Handles admin work, registration,
                        payment webhooks, and result pages between contests.
                    </Callout>
                    <Callout label="LIVE MODE — +$14–30/CONTEST DAY">
                        Terraform spins up an ALB, an ElastiCache Redis replication group (primary + replica,
                        HA), and an Auto Scaling Group of quiz-serving EC2 instances (2–10, sized by expected
                        participant count). Route53 switches from an A record to an ALB ALIAS record.
                    </Callout>
                    <P>
                        Mode switching is orchestrated by two scripts: go-live.sh (Terraform apply → DNS
                        propagation wait → health-check polling → smoke tests) and go-idle.sh (drain BullMQ
                        queues → Terraform destroy live resources → verify DNS reverted).
                    </P>
                    <P>
                        The backend enforces strict module boundaries: every domain (contest, participant,
                        quiz, payment, proctoring) has its own routes/controller/service/repository layer. Only
                        primitive identifiers cross module boundaries — no cross-domain joins.
                    </P>
                </CaseStudySection>

                <CaseStudySection id="architecture" kicker="// VISUAL ARCHITECTURE" heading="HOW IT'S BUILT.">
                    <Lead>
                        Five diagrams covering every layer of the system — from AWS infrastructure to the
                        WebSocket wire protocol to the database schema. All diagrams are generated from the
                        actual source architecture documentation.
                    </Lead>

                    <DiagramGalleryProvider>
                    <ArchDiagram
                        index={0}
                        id="diag-infra"
                        title="Dual-Mode AWS Infrastructure"
                        description="Idle mode (~$35/mo): single EC2, local Redis. Live mode (+$14-30/contest): ALB + ASG + ElastiCache. Mode switch via Terraform + redis-migrate.js."
                    />

                    <ArchDiagram
                        index={1}
                        id="diag-ws"
                        title="Real-Time WebSocket Flow"
                        description="Participant journey: REST auth → EIO4 WebSocket handshake → waiting room → quiz → submission. BullMQ handles all heavy async work."
                    />

                    <ArchDiagram
                        index={2}
                        id="diag-workers"
                        title="Background Worker System (BullMQ)"
                        description="API/WebSocket container never blocks. A separate worker process consumes 6 queues for evaluation, certificates, messaging, proctoring scoring, analytics, and timer management."
                    />

                    <ArchDiagram
                        index={3}
                        id="diag-db"
                        title="Database Schema (Key Relationships)"
                        description="~25 Prisma models. Every table scoped by organizationId. Contact is the deduplicated master record. Participant is a Contact × Contest registration."
                    />

                    <ArchDiagram
                        index={4}
                        id="diag-modules"
                        title="Backend Module Dependencies"
                        description="Messaging is the most-depended-on module (7 incoming). Contest is the primary domain entity. Dependency injection via central container.ts — no ad-hoc instantiation."
                    />
                    </DiagramGalleryProvider>
                </CaseStudySection>

                <CaseStudySection id="decisions" kicker="// ENGINEERING DECISIONS" heading="WHAT I BUILT.">
                    <P>
                        These are the engineering decisions that defined this project — each one with a
                        concrete problem, the approach taken, and the measured outcome.
                    </P>
                    <DecisionCardTrack>
                    <DecisionCard
                        number={1}
                        title="Pay for 10,000 users only on contest day"
                        shipped={true}
                        problem="Contests are scheduled, short and spiky. Running a load balancer, an auto-scaling fleet and a Redis cluster all month for a few hours of peak would be paying for idle capacity."
                        approach="One Terraform variable switches modes. Idle is a single EC2 with Redis in Docker; live adds an ALB, an auto-scaling group and an ElastiCache primary + replica — created by go-live and torn down by go-idle."
                        outcome="~70% lower infra cost. The peak is known before it arrives, so capacity can be decided in advance instead of chased."
                    />
                    <DecisionCard
                        number={2}
                        title="One question cache, not ten thousand reads"
                        shipped={true}
                        problem="At the start signal every participant asks for the same questions at once — a thundering herd against Postgres, at the worst possible moment."
                        approach="The question set is cached once in Redis for the whole contest; each participant stores only their own shuffled order. The answer key is stripped before anything reaches a client."
                        outcome="~2.7 KB per participant. Share what is identical, store per-user only what actually differs."
                    />
                    <DecisionCard
                        number={3}
                        title="Scoring moved off the request path"
                        shipped={true}
                        problem="Scoring answers, ranking a leaderboard and scoring proctoring inline would make every submit as slow as the slowest of them, exactly when everyone submits together."
                        approach="A submit only enqueues a BullMQ job. Separate workers score answers (concurrency 50), aggregate proctoring (30), and trigger the leaderboard once every submission is evaluated."
                        outcome="< 100 ms API at peak. The request path records intent; everything heavy happens behind a queue."
                    />
                    <DecisionCard
                        number={4}
                        title="Exactly-once submissions across instances"
                        shipped={true}
                        problem="A reconnect, a retry and the contest-end auto-submit can all try to submit the same participant at once — possibly on different instances."
                        approach="A Redis SET NX lock per participant (10 s TTL) guards submission; only the holder writes and enqueues scoring. A 5 s lock does the same for the question fetch."
                        outcome="0 answers scored twice. When work can arrive twice, make the second arrival a no-op."
                    />
                    <DecisionCard
                        number={5}
                        title="Heap exhaustion at 500 sockets an instance"
                        shipped={true}
                        problem="Both auto-scaled instances died together at 1,000 and 2,000 users: “JavaScript heap out of memory”. Redis state was only ~18.6 KB a participant — the heap was full of socket objects and closures."
                        approach="Raised the heap to 1.5 GB and the container limit to 2 GB in the launch template — then found running instances had booted from the old template and never got the fix."
                        outcome="512 MB → 1.5 GB heap. Measure where memory actually lives before raising a limit, and check the fix reached the machines."
                    />
                    <DecisionCard
                        number={6}
                        title="A connection pool sized for a quiet day"
                        shipped={true}
                        problem="1,000 users arriving in 30 s is ~33 logins a second; a pool of five connections queued instantly and requests timed out."
                        approach="Pool raised to 20 (minimum 5) with a 10 s query timeout, and the load ramp slowed to a realistic 120 s — eight arrivals a second."
                        outcome="pool 5 → 20. Arrival rate and pool size are one variable, not two."
                    />
                    <DecisionCard
                        number={7}
                        title="Redis could silently evict the job queue"
                        shipped={true}
                        problem="Workers kept warning about the eviction policy. The no-eviction parameter group was defined in Terraform but never attached, so under pressure Redis could drop BullMQ keys and lose jobs."
                        approach="Attached the parameter group to the replication group, so every live cluster is created with noeviction."
                        outcome="volatile-lru → noeviction. A resource defined in code is not a resource applied — read the warning."
                    />
                    <DecisionCard
                        number={8}
                        title="Rethinking autoscaling for WebSocket load"
                        shipped={false}
                        problem="The ASG's scale-out policy triggered on CPU at 60%. WebSocket load is memory/IO-bound — CPU stays near 20% while heap climbs to 95%. The scaler sees 'no scaling needed' right up until an OOM crash causes a brief CPU spike. A new instance still needs ~7 minutes to become healthy — far too slow for a quiz with a hard start time."
                        approach="Three options designed: (A) memory-percentage CloudWatch alarm as a more direct signal, (B) custom connection-count metric published from the backend itself, (C) pre-warm capacity from registered-participant count in go-live.sh before the event starts — most accurate since this workload's peak demand is always known in advance."
                        outcome="Designed and documented. Pre-warming selected as primary approach, CloudWatch as defense-in-depth. Validated on the next full load-test cycle."
                    />
                    <DecisionCard
                        number={9}
                        title="Closing the auto-submit coverage gap"
                        shipped={true}
                        problem="AUTO_SUBMIT produced only 140 submissions from a contest with 1,323 peak IN_QUIZ participants. The force-submit logic only read from the active Redis SET — participants whose connections were dropped by an OOM crash had their socket disconnect handlers skipped, landing them in the disconnected SET that AUTO_SUBMIT never checked."
                        approach="Fixed handleTimeExpiry() to union both active and disconnected participant sets before submitting, batched in groups of 50 with Promise.allSettled so one failure can't abort the batch."
                        outcome="Full submission coverage regardless of crash history. The principle: predict the symmetric bug once you've found the first instance of a failure class."
                    />
                    <DecisionCard
                        number={10}
                        title="Zero job loss across a dual-Redis switch"
                        shipped={true}
                        problem="BullMQ jobs scheduled before a go-live switch were enqueued into the local Docker Redis. After the switch to ElastiCache, workers listened to a different Redis — jobs were stranded, invisible, and contest start events never fired."
                        approach="Built redis-migrate.js — a DUMP/RESTORE migration tool (preserves types and TTLs) that copies every key between Redis instances in both directions, wired into both go-live.sh and go-idle.sh. Always executes inside the live backend container so it inherits the container's actual REDIS_HOST."
                        outcome="Zero job loss across mode switches. The lesson: 'always remember to do X' is not a control — move the execution context so the system guarantees correctness."
                    />
                    <DecisionCard
                        number={11}
                        title="Late joiners stuck in the waiting room"
                        shipped={true}
                        problem="Anyone joining after the contest went live was parked in the waiting room for a start signal that had already fired once and was gone."
                        approach="Joining now checks the contest status; if it is already live, the participant starts the quiz directly instead of waiting."
                        outcome="START_IMMEDIATELY. One-shot events need a path for whoever arrives after them."
                    />
                    <DecisionCard
                        number={12}
                        title="Login worked, then every request was a 401"
                        shipped={true}
                        problem="Admin login returned 200, then /me and /refresh failed. The auto-scaled instances set cookies for the old domain — and the load balancer was routing admin logins to them."
                        approach="Fixed the domain in both instance templates, patched the running instances, and traced why the request landed on that fleet at all."
                        outcome="200 → 401. Know which machine actually served the request before debugging the one you expected."
                    />
                    <DecisionCard
                        number={13}
                        title="Debugging the Socket.IO protocol layer"
                        shipped={true}
                        problem="Load test k6 client sent plain JSON over raw WebSockets. Socket.IO uses Engine.IO v4 framing on top of the WS transport — the server silently ignored every message. WS success rate: 50%. Admin live monitor showed 0 participants."
                        approach="Manually verified the infrastructure layer with curl (confirmed clean 101 upgrade and EIO4 open packet). Diagnosed the bug as above-transport: reimplemented the k6 client as an explicit state machine speaking the correct EIO4 handshake, namespace CONNECT with auth, framed event packets, and ping/pong keepalive."
                        outcome="WS success rate 50% → ~100%. 50/50 VUs appeared in the live monitor simultaneously. Lesson: a successful transport connection tells you nothing about the application protocol above it."
                    />
                    <DecisionCard
                        number={14}
                        title="Recovering drifted Terraform without touching live traffic"
                        shipped={true}
                        problem="An interrupted apply left the HTTPS listener and its routing rules out of state — the site timed out — while one DNS record from that run already existed in AWS."
                        approach="Read the plan first, imported the existing record instead of recreating it, and applied only once the diff showed six additions and nothing destroyed."
                        outcome="6 add · 0 destroy. Understand the diff before you apply it, especially on infrastructure serving traffic."
                    />
                    <DecisionCard
                        number={15}
                        title="Auditing every rate limiter, not just the broken one"
                        shipped={true}
                        problem="OTP rate limiter middleware was attached to the participant-login route, which doesn't use OTP. Under load testing, all k6 VUs shared a single source IP — 5 req/window instantly exhausted the limiter. A subsequent audit found a second bug: a separate limiter used windowMs: config.rateLimit.window without ×1000 conversion — giving it a 600ms window instead of 600 seconds."
                        approach="Removed the limiter from the non-OTP route. Audited every rate limiter in the codebase (not just the one that triggered). Fixed the unit mismatch in two locations."
                        outcome="Rate limiting correct across all routes. Principle: finding one instance of a bug class is the right moment to audit for siblings."
                    />
                    </DecisionCardTrack>
                </CaseStudySection>

                <CaseStudySection id="loadtest" kicker="// LOAD TESTING" heading="24 BUGS. DOCUMENTED.">
                    <Lead>
                        A real, dated (June 2026) attempt to validate 10,000 concurrent WebSocket users against
                        production AWS infrastructure. 24 distinct documented bugs across tooling, protocol,
                        infrastructure, and architecture.
                    </Lead>
                    <Callout label="SEED TOOLING">
                        Before a single test could run: ts-node not in the build, Prisma v7 requiring a new
                        driver adapter, an SSH tunnel IPv4/IPv6 mismatch, and interactive transactions timing
                        out over a 100ms tunnel. Each fixed individually, root-cause first.
                    </Callout>
                    <Callout label="MEMORY VS CPU">
                        At 500 concurrent WebSocket connections, Node.js hit its default ~512MB heap ceiling —
                        not from the ~9MB of actual session data, but from socket objects, closures, Redis
                        pub/sub subscriptions, and BullMQ state. Fixed by raising the heap ceiling and
                        container memory limit. Lesson: WebSocket load is memory-bound, not CPU-bound.
                    </Callout>
                    <Callout label="INFRASTRUCTURE DRIFT">
                        HTTPS listener and routing rules missing from Terraform state after an interrupted
                        apply. ElastiCache attached to the wrong parameter group (volatile-lru instead of
                        noeviction — would cause silent BullMQ job loss under memory pressure). Stale
                        COOKIE_DOMAIN from a prior domain migration breaking auth on quiz-serving instances.
                        Each found and fixed via direct code audit.
                    </Callout>
                </CaseStudySection>

                <CaseStudySection id="results" kicker="// RESULTS" heading="WHAT WAS ACHIEVED.">
                    <MetricGrid>
                        <Metric value="7500" label="PEAK CONCURRENT IN-QUIZ" />
                        <Metric value="0" label="ANSWERS SCORED TWICE" />
                        <Metric value="24" label="PRODUCTION BUGS DOCUMENTED" />
                    </MetricGrid>
                    <P>
                        The gap between 7500 peak concurrent and the 10,000-user architectural target is
                        documented explicitly — not glossed over. Outstanding: apply pre-warmed scaling, run
                        from an external non-AWS network, re-validate the mode-switch migration end-to-end.
                    </P>
                    <P>
                        The full pipeline was confirmed working end-to-end: login → WebSocket join with EIO4
                        protocol → answer recording per question → auto-submit on timeout → evaluation worker →
                        leaderboard.
                    </P>
                </CaseStudySection>

                <CaseStudySection id="lessons" kicker="// RETROSPECTIVE" heading="WHAT I'D DO DIFFERENTLY.">
                    <Callout label="DUAL-REDIS IS A SHARP EDGE">
                        The idle/live dual-Redis design was the right call for cost, but 7 of 24 documented
                        bugs trace directly to the infrastructure mode switch itself. The redis-migrate.js tool
                        was the right permanent fix — but the lesson is that any system with &apos;two
                        different backends depending on mode&apos; needs automatic data migration at the switch
                        boundary, not operational discipline.
                    </Callout>
                    <Callout label="AUTOSCALING FOR SCHEDULED WORKLOADS">
                        Reactive CPU-based autoscaling is wrong for a workload where peak demand is knowable in
                        advance. This system always knows registered-participant count before the contest
                        starts — the right approach is pre-warming, not reacting. This is a design insight that
                        applies to any system with scheduled, registration-gated bursts.
                    </Callout>
                    <Callout label="PROTOCOL BOUNDARIES MATTER">
                        The Socket.IO EIO4 debugging story is the most portable lesson from this project: a
                        successful TCP handshake and WebSocket upgrade tell you nothing about the
                        application-protocol layer above them. Testing each layer independently — transport,
                        framing, namespace, application — is the discipline that found a bug that would
                        otherwise have looked like &apos;random connection failures.&apos;
                    </Callout>
                </CaseStudySection>
            </CaseStudyLayout>
            <Footer />
        </>
    )
}
