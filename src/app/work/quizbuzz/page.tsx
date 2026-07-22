import { CaseStudyLayout } from '@/components/sections/CaseStudyLayout'
import { CaseStudySection } from '@/components/sections/CaseStudySection'
import { P, Lead, Callout, Metric, MetricGrid, DecisionCard } from '@/components/ui/CaseStudyProse'
import { ArchDiagram } from '@/components/ui/ArchDiagram'
import { LazyArchitectureJourney } from '@/components/ui/LazyArchitectureJourney'
import { LazyInfraScaleSimulator } from '@/components/ui/LazyInfraScaleSimulator'
import { SkillTag } from '@/components/ui/SkillTag'
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
                            <SkillTag key={tag}>{tag}</SkillTag>
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

                    <ArchDiagram
                        id="diag-infra"
                        title="Dual-Mode AWS Infrastructure"
                        description="Idle mode (~$35/mo): single EC2, local Redis. Live mode (+$14-30/contest): ALB + ASG + ElastiCache. Mode switch via Terraform + redis-migrate.js."
                        chart={`graph LR
    subgraph IDLE["IDLE MODE — ~$35/month"]
        direction TB
        EC2["Admin EC2 t3.medium"]
        Docker_BE["Backend Container"]
        Docker_W["Worker Container"]
        Docker_R["Redis:6379 Docker"]
        EC2 --> Docker_BE
        EC2 --> Docker_W
        EC2 --> Docker_R
    end
    subgraph LIVE["LIVE MODE — +$14–30/contest day"]
        direction TB
        ALB["Application Load Balancer"]
        AdminTG["Admin Target Group"]
        QuizTG["Quiz ASG 2-10 × t3.medium"]
        Cache["ElastiCache Redis r6g.large × 2"]
        ALB -->|socket.io/* api/quiz/*| QuizTG
        ALB -->|everything else| AdminTG
        QuizTG --> Cache
        AdminTG --> Cache
    end
    DNS["Route53 ysmquizbuzz.com"]
    RDS[("RDS PostgreSQL")]
    DNS -->|A record → Elastic IP - idle| EC2
    DNS -->|ALIAS → ALB - live| ALB
    EC2 --> RDS
    QuizTG --> RDS
    style IDLE fill:#f3f3f3
    style LIVE fill:#e5e7eb`}
                    />

                    <ArchDiagram
                        id="diag-ws"
                        title="Real-Time WebSocket Flow"
                        description="Participant journey: REST auth → EIO4 WebSocket handshake → waiting room → quiz → submission. BullMQ handles all heavy async work."
                        chart={`sequenceDiagram
    participant C as Client
    participant API as REST API
    participant GW as Socket.IO Gateway
    participant R as Redis
    participant Q as BullMQ
    participant W as Worker
    participant DB as PostgreSQL
    C->>API: POST quiz-join (registrationRef + joinCode)
    API->>DB: Verify participant + contest
    API->>R: Invalidate old session
    API-->>C: socketToken JWT
    C->>GW: WS + EIO4 handshake + namespace connect
    GW->>R: Validate JWT, check session
    GW-->>C: Namespace ACK
    C->>GW: join-waiting-room
    GW->>R: SADD waiting_room
    GW-->>C: joined-waiting-room
    W->>GW: CONTEST_START job fires
    GW-->>C: quiz-started (broadcast)
    C->>GW: get-questions
    GW->>R: Seeded shuffle + cache
    GW-->>C: questions-loaded (NO isCorrect)
    loop Each answer
        C->>GW: save-progress
        GW->>R: HSET answers hash
        GW-->>C: progress-saved
    end
    C->>GW: submit-quiz
    GW->>R: NX lock + idempotency check
    GW->>DB: Transaction: Submission + Answers
    GW->>Q: evaluate-submission job
    GW-->>C: submission-ack
    W->>DB: Score answers → update Submission`}
                    />

                    <ArchDiagram
                        id="diag-workers"
                        title="Background Worker System (BullMQ)"
                        description="API/WebSocket container never blocks. A separate worker process consumes 6 queues for evaluation, certificates, messaging, proctoring scoring, analytics, and timer management."
                        chart={`graph TD
    subgraph Producers["Producers (API Container)"]
        P1["Quiz Gateway"]
        P2["Contest Service"]
        P3["Certificate Service"]
        P4["Messaging Service"]
    end
    subgraph Queues["Redis / BullMQ Queues"]
        Q1["quiz-auto-submit (delayed)"]
        Q2["quiz-evaluation (concurrency: 50)"]
        Q3["certificate-generation (concurrency: 10)"]
        Q4["messaging (concurrency: 20)"]
        Q5["proctoring-score (concurrency: 30)"]
        Q6["analytics (concurrency: 5)"]
    end
    subgraph Workers["Consumers (Worker Container)"]
        W1["Quiz Timer Worker\nstart + force-submit + warnings"]
        W2["Evaluation Worker\nscore answers → update Submission"]
        W3["Certificate Worker\nPDF via pdfkit → S3"]
        W4["Message Worker\nWhatsApp + Email delivery"]
        W5["Proctoring Score Worker\nflag at 50 · disqualify at 100"]
        W6["Analytics Worker\ndaily rollup snapshots"]
    end
    P1 --> Q1
    P1 --> Q2
    P1 --> Q5
    P2 --> Q1
    P3 --> Q3
    P4 --> Q4
    Q1 --> W1
    Q2 --> W2
    Q3 --> W3
    Q4 --> W4
    Q5 --> W5
    Q6 --> W6
    W2 -->|all evaluated| Q6`}
                    />

                    <ArchDiagram
                        id="diag-db"
                        title="Database Schema (Key Relationships)"
                        description="~25 Prisma models. Every table scoped by organizationId. Contact is the deduplicated master record. Participant is a Contact × Contest registration."
                        chart={`erDiagram
    ORGANIZATION ||--o{ CONTEST : "hosts"
    ORGANIZATION ||--o{ CONTACT : "manages"
    CONTEST ||--o{ CONTEST_QUESTION : "contains"
    QUESTION ||--o{ CONTEST_QUESTION : "used in"
    QUESTION ||--o{ QUESTION_OPTION : "has"
    CONTACT ||--o{ PARTICIPANT : "registers as"
    CONTEST ||--o{ PARTICIPANT : "has"
    PARTICIPANT ||--o| PAYMENT : "pays"
    PARTICIPANT ||--o{ QUIZ_SESSION : "connects via"
    PARTICIPANT ||--o| SUBMISSION : "completes"
    SUBMISSION ||--o{ ANSWER : "contains"
    PARTICIPANT ||--o| LEADERBOARD_ENTRY : "ranked as"
    PARTICIPANT ||--o{ PROCTORING_EVENT : "triggers"
    PARTICIPANT ||--o| CERTIFICATE : "receives"
    CONTEST {
        string id PK
        enum status "DRAFT|LIVE|COMPLETED"
        datetime startTime
        datetime endTime
        string joinCode
    }
    PARTICIPANT {
        string id PK
        enum status "REGISTERED|IN_QUIZ|SUBMITTED"
        string registrationRef
    }
    SUBMISSION {
        int correct
        int wrong
        float score
        float percentage
    }`}
                    />

                    <ArchDiagram
                        id="diag-modules"
                        title="Backend Module Dependencies"
                        description="Messaging is the most-depended-on module (7 incoming). Contest is the primary domain entity. Dependency injection via central container.ts — no ad-hoc instantiation."
                        chart={`graph TD
    subgraph Admin["Administrative"]
        AdminAuth["Admin Auth"]
        Org["Organization"]
    end
    subgraph ContestGroup["Contest Lifecycle"]
        Contest["Contest"]
        Question["Question"]
        Participant["Participant"]
        Payment["Payment"]
    end
    subgraph RealTime["Real-time"]
        Quiz["Quiz Engine"]
        Proctoring["Proctoring"]
    end
    subgraph PostContest["Post-Contest"]
        Submission["Submission"]
        Analytics["Analytics"]
        Certificate["Certificate"]
    end
    Messaging["Messaging\nSMS + Email"]
    AdminAuth --> Org
    AdminAuth --> Messaging
    Org --> Messaging
    Contest --> Participant
    Contest --> Messaging
    Question --> Contest
    Participant --> Contest
    Payment --> Contest
    Payment --> Messaging
    Quiz --> Proctoring
    Quiz --> Submission
    Submission --> Participant
    Certificate --> Participant
    Analytics --> Quiz
    style Messaging fill:#d1ffca,color:#000000`}
                    />
                </CaseStudySection>

                <CaseStudySection id="decisions" kicker="// ENGINEERING DECISIONS" heading="WHAT I BUILT.">
                    <P>
                        These are the engineering decisions that defined this project — each one with a
                        concrete problem, the approach taken, and the measured outcome.
                    </P>
                    <DecisionCard
                        number={1}
                        shipped={true}
                        problem="Seeding 10,000 participant rows for load testing took 42 minutes — sequential Prisma upserts over an SSH tunnel at ~100ms latency per round-trip."
                        approach="Rewrote as bulk INSERT ... VALUES (...), ... ON CONFLICT DO NOTHING via a raw pg.Pool (bypassing Prisma's raw-query layer, which has a parameter-binding bug at large VALUES tables). Batch size 500, 4 concurrent batches, index-deterministic registrationRef keys."
                        outcome="42 minutes → 4.1 seconds. A 630× improvement. The key insight: for bulk operations, round-trip count dominates over query complexity."
                    />
                    <DecisionCard
                        number={2}
                        shipped={true}
                        problem="BullMQ jobs scheduled before a go-live switch were enqueued into the local Docker Redis. After the switch to ElastiCache, workers listened to a different Redis — jobs were stranded, invisible, and contest start events never fired."
                        approach="Built redis-migrate.js — a DUMP/RESTORE migration tool (preserves types and TTLs) that copies every key between Redis instances in both directions, wired into both go-live.sh and go-idle.sh. Always executes inside the live backend container so it inherits the container's actual REDIS_HOST."
                        outcome="Zero job loss across mode switches. The lesson: 'always remember to do X' is not a control — move the execution context so the system guarantees correctness."
                    />
                    <DecisionCard
                        number={3}
                        shipped={true}
                        problem="AUTO_SUBMIT produced only 140 submissions from a contest with 1,323 peak IN_QUIZ participants. The force-submit logic only read from the active Redis SET — participants whose connections were dropped by an OOM crash had their socket disconnect handlers skipped, landing them in the disconnected SET that AUTO_SUBMIT never checked."
                        approach="Fixed handleTimeExpiry() to union both active and disconnected participant sets before submitting, batched in groups of 50 with Promise.allSettled so one failure can't abort the batch."
                        outcome="Full submission coverage regardless of crash history. The principle: predict the symmetric bug once you've found the first instance of a failure class."
                    />
                    <DecisionCard
                        number={4}
                        shipped={true}
                        problem="Load test k6 client sent plain JSON over raw WebSockets. Socket.IO uses Engine.IO v4 framing on top of the WS transport — the server silently ignored every message. WS success rate: 50%. Admin live monitor showed 0 participants."
                        approach="Manually verified the infrastructure layer with curl (confirmed clean 101 upgrade and EIO4 open packet). Diagnosed the bug as above-transport: reimplemented the k6 client as an explicit state machine speaking the correct EIO4 handshake, namespace CONNECT with auth, framed event packets, and ping/pong keepalive."
                        outcome="WS success rate 50% → ~100%. 50/50 VUs appeared in the live monitor simultaneously. Lesson: a successful transport connection tells you nothing about the application protocol above it."
                    />
                    <DecisionCard
                        number={5}
                        shipped={false}
                        problem="The ASG's scale-out policy triggered on CPU at 60%. WebSocket load is memory/IO-bound — CPU stays near 20% while heap climbs to 95%. The scaler sees 'no scaling needed' right up until an OOM crash causes a brief CPU spike. A new instance still needs ~7 minutes to become healthy — far too slow for a quiz with a hard start time."
                        approach="Three options designed: (A) memory-percentage CloudWatch alarm as a more direct signal, (B) custom connection-count metric published from the backend itself, (C) pre-warm capacity from registered-participant count in go-live.sh before the event starts — most accurate since this workload's peak demand is always known in advance."
                        outcome="Designed and documented. Pre-warming selected as primary approach, CloudWatch as defense-in-depth. Validated on the next full load-test cycle."
                    />
                    <DecisionCard
                        number={6}
                        shipped={true}
                        problem="OTP rate limiter middleware was attached to the participant-login route, which doesn't use OTP. Under load testing, all k6 VUs shared a single source IP — 5 req/window instantly exhausted the limiter. A subsequent audit found a second bug: a separate limiter used windowMs: config.rateLimit.window without ×1000 conversion — giving it a 600ms window instead of 600 seconds."
                        approach="Removed the limiter from the non-OTP route. Audited every rate limiter in the codebase (not just the one that triggered). Fixed the unit mismatch in two locations."
                        outcome="Rate limiting correct across all routes. Principle: finding one instance of a bug class is the right moment to audit for siblings."
                    />
                </CaseStudySection>

                <CaseStudySection id="loadtest" kicker="// LOAD TESTING" heading="24 BUGS. DOCUMENTED.">
                    <Lead>
                        A real, dated (June 2026) attempt to validate 10,000 concurrent WebSocket users against
                        production AWS infrastructure. 24 distinct documented bugs across tooling, protocol,
                        infrastructure, and architecture.
                    </Lead>
                    <Callout label="SEED TOOLING">
                        Before a single test could run: ts-node not in the build, Prisma v7 requiring a new
                        driver adapter, SSH tunnel IPv4/IPv6 mismatch, interactive transactions timing out over
                        a 100ms tunnel, and a seeding script that took 42 minutes for 10,000 rows. Each fixed
                        individually, root-cause first.
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
                        <Metric value="630×" label="SEED SPEED IMPROVEMENT" />
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
