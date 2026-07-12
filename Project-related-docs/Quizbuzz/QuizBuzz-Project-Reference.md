# QuizBuzz — Complete Project Reference
*A multi-tenant, real-time online quiz & contest platform built solo, from architecture to 10,000-user load testing.*

> This document is a full technical dossier of QuizBuzz — intended as raw source material for a portfolio write-up, case study, or interview deep-dive. It covers what the product does, how it's built, every major architectural decision, the incidents hit while scaling it, and how each was diagnosed and fixed.

---

## 1. What QuizBuzz Is

QuizBuzz is a **multi-tenant SaaS platform for running large-scale, real-time, proctored online quiz contests** — built under YSM Software / YSM Info Solution for the Indian market. Organizations (companies, colleges, training institutes) sign up, create branded contests, sell paid or free registrations, run a live timed quiz to thousands of simultaneous participants over WebSockets, auto-evaluate answers, publish a leaderboard, and issue certificates — all with fraud/proctoring detection along the way.

It is architected, built, and operated **end-to-end by a single engineer** (backend, frontend, infrastructure, CI/CD, load testing, and incident response), with a specific engineering target: **10,000 concurrent WebSocket users** sustained for the length of a live quiz (30 min – 2 hrs), on a cost-conscious AWS footprint that scales up only when a contest is actually live.

### Core user journeys
1. **Organization admin**: signs up → creates org → builds a question bank → creates a contest (fee, schedule, prizes, rules) → assigns questions → publishes → monitors registrations → goes live → watches a real-time participant/proctoring dashboard → declares results → sends certificates/messages.
2. **Participant**: discovers a public contest → registers with OTP-verified email/phone → pays via Razorpay (if paid) → joins at quiz time with a join code → sits in a waiting room → answers questions in a live timed session (with face/tab/fullscreen proctoring) → auto-submits at time end → sees leaderboard rank → downloads a certificate.

---

## 2. Technology Stack

| Layer | Technology |
|---|---|
| Backend framework | Express (Node.js) + TypeScript, manual DI via a custom IoC container (`container.ts`) — not NestJS despite superficial resemblance in module layout |
| Real-time | Socket.IO with the **Redis adapter** for cross-instance pub/sub |
| Background jobs | **BullMQ** — separate worker processes, not in-process |
| ORM / DB | Prisma ORM → PostgreSQL (AWS RDS / Aurora Serverless v2) |
| Frontend | Next.js (App Router), shadcn/ui (`new-york` style, neutral base), OKLCH warm-neutral palette with teal primary / amber accent, Geist Sans/Mono, Framer Motion (sliding active-pill sidebar via `layoutId`), translucent `backdrop-blur` panels |
| Payments | Razorpay (India-specific payment gateway) |
| Messaging | WhatsApp + Email providers, templated (registration confirmation, payment confirmation, reminders, results, certificates) |
| Monitoring | Sentry (errors) + PostHog (product analytics) + CloudWatch + self-hosted Prometheus/Grafana |
| Infra as Code | Terraform, modular, two-mode (idle/live) architecture |
| CI/CD | GitHub Actions → build/push to GHCR/ECR → deploy via AWS SSM Run Command (no SSH) |
| Load testing | k6 (primary, WebSocket-capable), Artillery (secondary) |
| Validation | Zod, used for both request validation and environment/config validation |

---

## 3. System Architecture

### 3.1 High-level layout

```
┌────────────────────────────────────────────────────────────┐
│  ALWAYS ON — Admin EC2 (t3.small/medium, Elastic IP)        │
│  frontend (Next.js) · backend (Express+Socket.IO) ·         │
│  worker (BullMQ consumer) · redis (local Docker, idle mode) │
│  Handles: admin dashboard, registration, payments, results  │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│  LIVE CONTEST ONLY — created via `terraform apply`, ~24h    │
│  ALB (sticky sessions) → admin-tg (t3.small) + quiz-tg (ASG)│
│  ElastiCache Redis r6g.large (primary + replica)            │
│  NAT Gateway replaces NAT Instance                          │
│  Each quiz instance runs backend + worker, REDIS_HOST →     │
│  ElastiCache (no local Redis)                                │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│  ALWAYS ON — AWS managed                                     │
│  Aurora Serverless v2 (auto-pause) · S3 · Route53 · ECR ·    │
│  SSM Parameter Store · CloudWatch · NAT Instance (idle only) │
└────────────────────────────────────────────────────────────┘
```

### 3.2 The dual-mode ("idle vs. live") design — the central architectural bet

This is the single biggest architectural decision in the project, and a deliberate cost/complexity trade-off:

- **Idle mode (default, always running):** one small EC2 instance runs everything — frontend, backend, worker, and a local Docker Redis container. Handles admin work, registration, payment webhooks, and result pages. Costs ~$35–40/month.
- **Live mode (on-demand, ~24h window):** Terraform spins up an ALB, an ElastiCache Redis replication group (primary + replica, HA), and an Auto Scaling Group of quiz-serving EC2 instances (2–10, sized by expected participant count). Route53 switches from an A record (pointing at the admin instance's Elastic IP) to an ALIAS record (pointing at the ALB). Costs an additional ~$14–30 per contest day.
- **Mode switch is orchestrated by two scripts:** `go-live.sh` (Terraform apply → DNS propagation wait → health-check polling → smoke tests → scheduled safety scale-down) and `go-idle.sh` (drain BullMQ queues → Terraform destroy live resources → verify DNS reverted → confirm Aurora will auto-pause).
- **Why this is justified:** the workload is fundamentally spiky — near-zero traffic between contests, then a short burst of up to 10,000 sustained WebSocket connections. Reactive autoscaling doesn't fit a workload where "peak" is a scheduled, known event; a scheduled infrastructure switch is simpler and cheaper than running always-on capacity for a rare peak.
- **The cost of this decision:** roughly 7 of ~24 documented load-testing bugs traced directly to the idle/live transition itself (two different Redis backends, cookie-domain mismatches, DNS races, stale userdata templates) — a concrete, measured example of an architecture trade-off's real engineering cost, not just its benefit.

### 3.3 Backend module architecture (strict, repeated per domain)

Every backend domain module follows the same file layout, enforcing separation of concerns:

```
module/
  module.routes.ts       — routing + middleware binding only
  module.controller.ts   — request parsing / response formatting, NO business logic
  module.service.ts      — all business logic, calls repositories, uses config
  module.repository.ts   — DB queries only, no logic
  module.types.ts
  module.validator.ts    — Zod schemas
```

Real modules in the backend (`backend/src/modules/`): `admin` (+ `auth`), `analytics`, `certificate`, `contact`, `contest` (+ `leaderboard.repository`), `messaging`, `organization`, `participant`, `payment`, `proctoring`, `question`, `quiz` (the largest — gateway, scheduler, registration, quiz-auth, proctoring), `submission`.

Supporting layers: `src/config` (typed, Zod-validated env config — `app`, `db`, `redis`, `queue`, `websocket`, `auth`), `src/middlewares` (auth for org-scoped admin routes, auth for participants, error handling, idempotency, rate limiting), `src/error` (a standard `AppError` class + HTTP error mapping), `src/providers` (email, local/S3 storage, Razorpay, WhatsApp, generic message provider), `src/queues` and `src/workers` (BullMQ boards + independent worker processes: analytics, capture-metadata, certificate, evaluation, export, leaderboard, message, quiz-timer, submission), `src/socket` (Socket.IO setup + auth middleware), `src/container.ts` (manual DI).

### 3.4 Domain data model (Prisma / PostgreSQL)

Fully multi-tenant: nearly every table carries an `organizationId` foreign key, added retroactively via a dedicated migration (`added_organization_id_to_all_the_table`) — a sign the multi-tenant boundary was hardened after initial build-out.

Key models and relationships:
- **Organization → OrgMember → Admin** (many-to-many via join table, roles: `OWNER`/`ADMIN`/`VIEWER`), with revocable `AdminRefreshToken`s.
- **Contest** — the central entity: fee, currency, duration, cutoff score, max participants, registration deadline, start/end time, `ContestStatus` state machine (`DRAFT → PUBLISHED → REGISTRATION_CLOSED → LIVE → EVALUATION → RESULTS_OUT → COMPLETED`, plus `CANCELLED`), shuffling flags, join code.
- **Prize** — rank-range based (`rankFrom`/`rankTo`) reward brackets with benefits arrays.
- **Question / QuestionOption** — org-scoped question bank, difficulty enum, tags; **ContestQuestion** is the join table carrying per-contest `position`, `marks`, `negativeMark`.
- **Contact** — a deduplicated identity keyed by `(organizationId, email)` and `(organizationId, phone)` — one Contact can register for many contests without creating duplicate people records. This "one profile, many activities" pattern also underlies the separate Form Builder product in the same portfolio.
- **Participant** — the join of Contact × Contest (a single registration), with `ParticipantStatus` state machine (`REGISTERED → CHECKED_IN → IN_WAITING → IN_QUIZ → SUBMITTED`, or `DISQUALIFIED`/`ABSENT`), one-to-one with Payment, Submission, LeaderboardEntry, Certificate.
- **Payment** — Razorpay order/payment/signature fields, `PaymentStatus` (`PENDING → AUTHORIZED → PAID`, or `FAILED`/`REFUNDED`), provider enum (`RAZORPAY`/`MANUAL`/`FREE`).
- **QuizSession** — device-level session tracking during a live quiz (socket ID, fingerprint, last heartbeat, current question index) — enables reconnect/resume and multi-device conflict detection.
- **Submission / Answer** — the final persisted answer record, one row per question, filled in by the evaluation worker (`isCorrect`, `marksAwarded`) after being sourced from Redis at submit time.
- **LeaderboardEntry** — rank, score, percentage, resolved prize bracket, publish flag.
- **Certificate** — generation status pipeline (`PENDING → QUEUED → GENERATING → GENERATED/FAILED → DELIVERED`), S3 file URL/key, JSON metadata for template params.
- **ProctoringEvent / ProctoringScore** — per-violation-type events (`FACE_NOT_DETECTED`, `MULTIPLE_FACES`, `TAB_SWITCH`, `FULLSCREEN_EXIT`, `AUDIO_DETECTED`, `COPY_PASTE_DETECTED`) with severity, plus a live-updated aggregate score/flag per participant.
- **MessageLog** — full audit trail of every WhatsApp/email message sent, by template and channel, with delivery status and retry count.
- **ScheduledJob** — a Postgres-side audit/queryable mirror of BullMQ jobs (BullMQ itself remains the execution source of truth).
- **ContestAnalyticsSnapshot** — pre-aggregated per-contest stats (registrations, revenue, participation, score distribution, live active count), refreshed periodically by a worker rather than computed on read.

### 3.5 Frontend architecture

Next.js App Router with clearly separated route groups:
- **Public site**: `/contests`, `/contests/[slug]`, `/[slug]` (org-branded landing), `/register`.
- **Participant flow** (`/quiz/[slug]/...`): `join → system-check → waiting → play → submitted → results → leaderboard → certificate/[id]`, plus `conflict` and `disqualified` terminal states.
- **Participant dashboard** (`/dashboard`): contests, results, certificates, profile, settings.
- **Admin portal** (`/admin`): organization/team management, question bank, messaging + templates, and a deep per-contest workspace (`/admin/contests/[id]/...`) with tabs for overview, questions, registrations, live monitor, proctoring, submissions, results, analytics, certificates, and messages.

State/data layer: TanStack Query hooks per domain (`useContest`, `useQuizSocket`, `useProctoring`, `useLeaderboard`, `useAnalytics`, etc.) backed by a typed `lib/api/*` REST client layer, Zustand-style stores (`auth-store`, `quiz-store`, `proctoring-store`), and a dedicated `lib/proctoring/` module wrapping browser face detection (`FaceDetectionEngine.ts`) for the live camera-check widget.

UI: full shadcn/ui component set, a custom sidebar with animated active-pill navigation, skeleton loading states per major view, error boundaries at both global and section level, and PWA-lite touches (`offline.tsx`, mobile bottom nav).

### 3.6 Real-time protocol (Socket.IO / EIO4)

Namespace: `/participant` (also referenced generically as `/quiz` in early docs). Auth via a short-lived `socketToken` issued by `POST /auth/contact/quiz-join`, itself scoped to a single contest.

**Client → Server events:** `join-waiting-room`, `get-questions`, `save-progress` (on every answer change), `heartbeat` (every 15s), `submit-quiz`.

**Server → Client events:** `joined-waiting-room`, `quiz-started`, `questions-loaded` (never includes correct answers), `resume-quiz` (reconnect support), `progress-saved`, `submission-ack`, `time-warning` (10 min/5 min/1 min), `quiz-force-submit`, `session-invalidated` (new-device login kicks old session), `error`.

**Versioned event naming convention actually used in code:** `quiz:v1:join`, `quiz:v1:answer`, `quiz:v1:start`, `quiz:v1:submit`, etc. — all socket handlers delegate to services; no business logic lives in the gateway layer.

**Design constraint that shaped a lot of debugging:** Socket.IO does not speak plain JSON over the wire — it uses Engine.IO v4 binary/text framing (`0{...}` open packet, `40/namespace,{auth}` namespace-connect, `2`/`3` ping/pong, `42/namespace,[event,data]` event packets). Any tool or script that talks to the backend as a "raw" WebSocket client must implement this framing exactly, or the server silently ignores every message (see incident log, Bug #14).

---

## 4. Infrastructure & DevOps

### 4.1 AWS footprint (region: `ap-south-1`, account `211125602755`)

- **Networking:** custom VPC/subnets, mode-aware NAT (NAT Instance for idle, NAT Gateway for live), security groups per tier (EC2, ALB, ElastiCache, Aurora).
- **DNS:** Route53 hosted zone for `ysmquizbuzz.com`, 30-second TTL A record in idle mode (→ Elastic IP `65.1.26.101`), ALIAS record to the ALB in live mode — the "mode-switch core" of the whole design.
- **Compute:** always-on admin EC2 (t3.small/medium); live-only Auto Scaling Group of quiz instances (originally spec'd `c6i.large`, actually load-tested on `t3.medium`), sized by `ceil(expected_participants / N)` capped at 10 instances.
- **Cache:** ElastiCache Redis replication group (`r6g.large` × 2, primary + replica, automatic failover, multi-AZ) — live mode only. `noeviction` maxmemory policy is required (see incident #21) because BullMQ relies on TTL'd keys surviving memory pressure.
- **Database:** RDS/Aurora Serverless v2 PostgreSQL, auto-pauses when idle.
- **Storage:** S3 bucket `quizbuzz-assets-prod` for certificates and uploaded assets.
- **Registry:** ECR (also referenced as GHCR in some docs) for backend/worker/frontend Docker images.
- **Secrets/config:** SSM Parameter Store (image tag, DB URL, secrets) — read at container start, never hardcoded.
- **Observability:** CloudWatch (logs, alarms, dashboards), self-hosted Prometheus + Grafana on the admin instance, Sentry, PostHog.
- **TLS:** ACM certificate, referenced by both the idle-mode reverse proxy and the live-mode ALB HTTPS listener.

### 4.2 Terraform structure

Modular, mode-aware, root module wiring:

```
terraform/
  environments/prod/        — root module: main.tf, variables.tf (mode=idle|live, expected_participants, image_tag), terraform.tfvars
  modules/
    networking/              — VPC, subnets, NAT (mode-aware), security groups
    dns/                     — Route53 zone + mode-aware A/ALIAS record — the mode-switch core
    admin_instance/          — always-on EC2, EIP, IAM, userdata
    database/                — Aurora Serverless v2 + connection pooling
    storage/                 — S3
    registry/                — ECR repos
    monitoring/               — CloudWatch alarms + dashboards
    live_contest/             — created ONLY when mode=live: ALB + target groups + listener rules, ElastiCache, ASG + launch template + scaling policy, live userdata
```

Notable Terraform patterns:
- `count = local.is_live ? 1 : 0` on the entire `live_contest` module — conditional infrastructure creation is a first-class pattern here, not a hack.
- ALB listener rules route by path: WebSocket traffic (`/socket.io/*`) and quiz API paths → quiz target group (sticky, 1-day cookie, 5-minute deregistration drain to protect active WebSocket sessions); everything else (admin dashboard, registration, payments, SSR pages) → admin target group.
- ASG scale-out policy is CPU target-tracking with `disable_scale_in = true` — instances are added automatically under load but **never automatically removed** during a live quiz; scale-down is a manual, deliberate step (`go-idle.sh`), because losing a WebSocket-carrying instance mid-quiz is unacceptable.
- Route53 hosted zone read as a `data` source (not managed) after an `allow_overwrite = true` fix — needed because idle↔live switching repeatedly recreates the same record name.

### 4.3 CI/CD (GitHub Actions)

Pipeline: build & push three images (backend, worker, frontend) to the registry in parallel → write the new image tag into SSM Parameter Store → deploy to the admin instance via **AWS SSM Run Command** (`aws ssm send-command` executing `docker compose pull && docker compose up -d --no-deps ...` on the instance) — deliberately avoiding SSH entirely — → smoke test against `/health`. A `production` GitHub Environment gate requires manual approval before the deploy step runs.

### 4.4 Operational scripts

- `go-live.sh` — Terraform apply (mode=live, sized by `--participants`) → 35s DNS propagation wait → poll ALB target health until ≥2 healthy → smoke-test `/health`, `/health/redis`, `/health/db`, `/health/queues` → schedule a 26-hour safety auto-scale-down as a dead-man's switch.
- `go-idle.sh` — cancel scheduled safety actions → wait for BullMQ queues to drain (with a queue-depth check and extended wait if non-empty) → Terraform apply (mode=idle, destroying ALB/ElastiCache/ASG) → verify DNS resolved back to the admin Elastic IP → health-check.
- `bootstrap.sh` — one-time setup: create the Terraform state S3 bucket + DynamoDB lock table, `terraform init`, first idle-mode apply.
- **Redis migration tooling (`redis-migrate.js`)** — built specifically to solve the two-Redis problem (see §5): copies every key via `DUMP`/`RESTORE` with TTL preservation, run *inside* the backend container (guaranteeing it uses the container's actual `REDIS_HOST`), invoked by both `go-live.sh` (before switching to ElastiCache) and `go-idle.sh` (before destroying ElastiCache).

---

## 5. The Load-Testing Journey — Incidents, Root Causes, Fixes

This is the most substantive engineering narrative in the project: a real, dated (June 27–28, 2026) attempt to validate 10,000 concurrent WebSocket users against production AWS infrastructure, producing 24 distinct documented bugs. Presented here as a chronological engineering story, grouped by theme.

### 5.1 Getting the test environment working at all
Before a single load test could run, five separate tooling problems had to be solved, because RDS lives in a private subnet only reachable via SSH tunnel through the admin EC2:
- **Seed script toolchain mismatch** — `ts-node` wasn't part of the backend's build (it uses `tsc`), and strict TypeScript flagged implicit `any`. Fixed by writing the seed script in plain JavaScript with `NODE_PATH` pointed at the backend's `node_modules`.
- **Prisma v7 breaking change** — the built-in query engine was removed; Prisma now requires an explicit driver adapter (`@prisma/adapter-pg`).
- **IPv4 vs IPv6 tunnel mismatch** — Windows resolved `localhost` to `::1`, but the SSH tunnel bound to `127.0.0.1`; fixed by hardcoding the IPv4 loopback address in the connection string.
- **Seeding performance** — a naive seed script took **42 minutes** for 10,000 rows (sequential batches, per-row Prisma upserts inside `$transaction()`, which also hit Prisma's 30-second transaction timeout over the ~100ms-latency tunnel). Rewritten with a raw `pg` pool, bulk `INSERT ... ON CONFLICT`, batch size 500, 4 concurrent batches, and deterministic non-colliding reference IDs (`QB-LOAD-000001`) → **4.1 seconds** for the same 10,000 rows, a **630× speedup**.
- **Bulk SQL parameter binding bug** — Prisma's `$executeRawUnsafe` mis-counted parameters when mixing anchor params with a large `VALUES` table; solved by bypassing Prisma for bulk writes and using the `pg` driver directly, which handles large parameter arrays correctly.

### 5.2 The two-Redis problem (recurring architectural fault line)
The single most consequential class of bug came directly from the idle/live dual-Redis design:
- **CONTEST_START job lost:** a contest-lifecycle job was enqueued into the local Docker Redis (correct at the time, since ElastiCache didn't exist yet) but by the time it should have fired, `go-live.sh` had already switched the admin instance's `REDIS_HOST` to ElastiCache — the worker was listening to a different Redis than the one holding the job. The job was invisible; the contest went `LIVE` in the database but no participant ever moved out of the waiting room.
- **The generalized version — AUTO_SUBMIT data loss:** applying the same root-cause pattern, `handleTimeExpiry()` only read participant IDs from the `active` Redis SET. When ASG instances OOM-crashed (see §5.3), Node died without running its disconnect handler, so ~1,100 of ~1,300 in-quiz participants were sitting in a `disconnected` SET that auto-submit never checked — only 140 submissions were actually produced from a contest that should have had well over a thousand. This is a clean example of the project's "root cause generalization" pattern: one confirmed failure mode (jobs lost to the wrong Redis / wrong state set) was used to predict and pre-empt a symmetric failure elsewhere in the same codebase.
- **Permanent fix:** a purpose-built `redis-migrate.js` tool, using Redis `DUMP`/`RESTORE` with TTL preservation, copies every key (not just BullMQ's) between the Docker Redis and ElastiCache in both directions, and is wired into both `go-live.sh` and `go-idle.sh`. `handleTimeExpiry()` was fixed to union `active` and `disconnected` participant sets before submitting.
- **Process fix that mattered as much as the code fix:** operational scripts (`reset-contest.js`, and by extension anything that touches Redis) must run *inside the live backend container* via SSM, not from a developer's laptop over an SSH tunnel — a tunnel to `localhost:6379` silently talks to whichever Redis is locally reachable, not necessarily the one the running system is actually using.

### 5.3 Memory, not CPU, is the real scaling constraint
- **OOM crashes** hit both ASG instances simultaneously at 500 and 2,000 concurrent connections. Root cause: Node.js's default ~512MB heap, combined with per-connection socket objects, closures, event listeners, Redis pub/sub subscriptions, and BullMQ job state — *not* the raw per-participant Redis data itself (measured at ~18.6KB/participant, i.e. ~37MB total at 1,000 users, nowhere near the limit on its own). Fixed by setting `NODE_OPTIONS=--max-old-space-size=1536` and raising container memory limits — but the fix initially only lived in the Terraform *template*, so already-running instances (booted from the old launch template) kept crashing until manually patched via SSM.
- **The deeper architectural finding:** the ASG's scale-out policy triggers on CPU utilization at 60%, but WebSocket load here is memory/I/O-bound, not CPU-bound — at 500 connections, CPU sits around 20% while heap is near 95%. The autoscaler sees "no scaling needed" right up until an OOM crash causes a brief CPU spike, by which point a new instance still needs ~7 minutes (420s ASG grace period) to become healthy — far too slow for a quiz with a hard start time. Documented resolution direction: replace reactive CPU-based scaling with **pre-warmed capacity**, computed directly from the known, already-registered participant count before the contest starts (`instances = ceil(participants / connections_per_instance)`), since this is a scheduled workload with a known load profile — reactive autoscaling is the wrong tool for a problem where the answer is knowable in advance.
- **DB connection pool exhaustion:** `DB_POOL_MAX=5` (tuned for light admin traffic) collapsed under ~33 login requests/second from a 1,000-VU ramp in 30 seconds. Fixed by raising the pool (`DB_POOL_MIN=5`, `DB_POOL_MAX=20`, longer query timeout) *and* slowing the k6 ramp itself to 120 seconds — a two-sided fix acknowledging that both the system and the test needed to be realistic about arrival rate.

### 5.4 Getting the WebSocket load test itself correct
- **Wrong Socket.IO wire protocol:** the initial k6 script sent plain JSON over a raw WebSocket connection; Socket.IO requires EIO4 framing (open packet → namespace-connect packet with auth → ping/pong keepalive → framed event packets). Result: 50% "connections" that were technically open TCP/WS but invisible to the application, 0 participants in the live monitor. Rewritten to speak the exact EIO4 handshake and event framing, verified against a 50/50 smoke test before scaling up.
- **Wrong question payload shape:** the corrected k6 script still assumed a flat `data.questionId` on `quiz:v1:start`, when the actual payload was `data.questions[]` (an array of all questions upfront, since QuizBuzz loads the full paper rather than pushing one question at a time) — fixed by iterating the array and sending one `quiz:v1:answer` per question with appropriate think-time.
- **Stale sticky-session cookies across test runs:** cancelling and immediately restarting a load-test stage reused `AWSALB` cookies from the previous stage, routing some virtual users to instances where their new session didn't exist, producing spurious `NOT_REGISTERED` errors — resolved as a *process* rule (let each stage fully complete; never reuse a contest slug across test runs; always seed against the freshly created contest's actual ID) rather than a code change.
- **File descriptor limits:** identified as a latent risk (Linux default `ulimit -n 1024`, one FD per WebSocket connection) and pre-emptively fixed in ASG userdata (`nofile 65536`, applied to both the OS and the Docker daemon) before it could manifest as an unexplained connection-failure ceiling.

### 5.5 Smaller but real correctness bugs surfaced along the way
- A **join-waiting-room fast path** was missing: a participant joining a contest that was already `LIVE` (e.g., a late arrival or a load-test VU spun up after the go-live trigger) was always routed into the waiting room to await a `CONTEST_START` job that had *already fired once* — they'd wait forever. Fixed with a `START_IMMEDIATELY` status returned from the join check, handled by the gateway to start the quiz for that participant directly instead of parking them.
- An **OTP rate limiter misapplied to a non-OTP endpoint** (`participant-login`, which re-uses an identity already verified at registration time) caused instant 429s once all 1,000 k6 virtual users shared a single test-runner IP address — removed from that specific route.
- A **units bug**: one of two separate rate-limiter instances in the codebase multiplied its configured window by 1000 to convert seconds→ms; the other (in `quiz-registration.routes.ts`) didn't, silently giving that limiter a 600ms window instead of 600 seconds — caught by log inspection, fixed by aligning the conversion.
- **ElastiCache eviction policy:** a Terraform parameter group correctly specified `maxmemory-policy = noeviction`, but the parameter group was never actually *attached* to the replication group resource — a one-line omission that would have caused silent BullMQ job loss under memory pressure (`volatile-lru` evicts TTL'd keys, and BullMQ relies on some).
- **Stale ACM/ALB listener state** and a **stale hardcoded `COOKIE_DOMAIN`** (leftover from a domain migration, baked into the ASG userdata template) both caused authentication to break specifically on quiz-serving instances while the admin instance worked fine — because the ALB's routing rules sent `/api/*` traffic (including admin login) to the quiz target group, not the admin instance, so the wrong instances' env vars were the ones that actually mattered in live mode.

### 5.6 Results actually achieved
| Metric | Result |
|---|---|
| Peak simultaneous participants "IN QUIZ" | **1,323** |
| Submissions successfully processed end-to-end | 140 (remainder lost to the OOM + AUTO_SUBMIT bugs above, both since fixed in code) |
| Full pipeline confirmed working | login → WebSocket join → answer recording → auto-submit → evaluation → leaderboard |
| WebSocket EIO4 protocol | Confirmed working after the protocol fix |
| ElastiCache connectivity, live monitor, admin dashboard | Confirmed working |

The gap between "1,323 peak concurrent" and the 10,000-user architectural target is the honest, current state of the system — documented explicitly rather than glossed over, with a prioritized outstanding-items list (critical items: apply the heap fix to running instances before the next test, run reset scripts inside the container, seed against the correct contest ID, slow the k6 ramp, verify seeded contest IDs match).

---

## 6. Key Engineering Principles Actually Enforced

These aren't aspirational — they're patterns visibly applied throughout the incident log and codebase:

1. **No hypothesis-only diagnosis.** Every fix in the incident log is traced to an actual code path or actual log line before being applied — not "this might be it."
2. **Root-cause generalization.** A confirmed failure mode (e.g., "jobs lost when the wrong Redis is being read") is treated as a *pattern*, and proactively checked for elsewhere in the system (leading directly to catching the AUTO_SUBMIT `disconnected`-set bug before it caused another silent data-loss incident).
3. **Terraform-only infrastructure changes.** Manual SSM patches to running instances are treated explicitly as *temporary* stopgaps, with the permanent fix always landing in the Terraform userdata template — the incident log repeatedly flags "fixed in template; must still be manually applied to already-running instances" as a distinct, tracked state.
4. **Operational scripts run inside live containers, not over a laptop tunnel** — because a tunnel's `localhost` binding is not guaranteed to be the same Redis/DB the running system is actually using.
5. **Config-driven, not magic-number-driven.** Rate limits, pool sizes, heap limits, connections-per-instance, and queue concurrency are all environment variables consumed through a single typed/Zod-validated config layer (`src/config/`), not inlined in service code — the explicit intent being that scaling from 10k → 100k users should require **zero code changes**, only environment variable changes (`INSTANCE_COUNT`, `MAX_WS_CONNECTIONS`, `REDIS_CLUSTER_SIZE`, `QUEUE_CONCURRENCY`, `WORKER_INSTANCES`).
6. **Domain boundary discipline.** Only primitive identifiers (e.g., a bare `contactId` string) are allowed to cross module boundaries — no cross-domain repository joins, keeping modules independently reasoned-about and (per the "future-proofing" goal) extractable into separate services later if needed.
7. **Service layer orchestrates, repository layer only queries.** Strictly enforced by the module file-layout convention itself.
8. **Batch code changes before live tests are flagged as too risky** — changes are verified incrementally rather than bundled, given how expensive a failed live-mode test run is (both in AWS cost and in diagnosis time).

---

## 7. Current Build Status (Super Admin / Ops Dashboard)

A second, currently-in-progress piece of the platform: a separate **Super Admin / Ops Dashboard**, architecturally isolated from the main product:

- Runs on its own **always-on EC2** (no ASG — an ops console doesn't need to scale with contest traffic), on its own subdomain.
- Shares the main RDS/Aurora cluster but via a **dedicated Postgres role with its own connection limit** and a **separate database** (`CREATE DATABASE quizbuzz_ops`) — isolating ops workload from quiz-serving workload at the connection-pool level, not just the application level.
- Backend uses a **dual `pg.Pool` pattern**: a Prisma client for tables the ops service owns outright, plus a raw `pg` pool strictly for **read-only** cross-boundary reads into the main product's database — a pragmatic compromise that avoids duplicating the main schema while still respecting the "no cross-domain repository joins" principle for anything beyond reads.
- Frontend follows a strict **three-layer architecture** (mock data → simulated API → TanStack Query hooks) specifically so that swapping in the real backend later requires no UI rewrite — used consistently across all AI-assisted frontend generation (Lovable/v0.dev) with structured phase prompts.
- Open/flagged decisions at time of writing: whether Razorpay refunds should be called directly from the ops backend or routed through the main backend (an ownership-boundary question), and whether `Organization.isActive` suspension is already enforced in the main app's service layer or still needs to be added.
- Known frontend gaps, tracked explicitly rather than hidden: edit-contact modal not wired to a real mutation, delete-contact UI missing entirely, the contact participation-history DTO is missing payment/submission/certificate fields, and the certificate template studio is still local mock state with no backend persistence.

---

## 8. Roadmap / What's Next

- Ship the Super Admin / Ops Dashboard (5-phase build plan).
- Replace reactive CPU-based ASG scaling with **pre-warmed capacity** derived from known registered-participant counts — explicitly identified as both simpler and more architecturally correct for a scheduled workload than tuning autoscaling thresholds.
- Re-run load tests from an **external, non-AWS network** — in-network (same-VPC/region) load generation was identified as methodologically unsound, since it doesn't exercise real internet latency/packet loss and may understate capacity problems.
- Fix orphaned Elastic IPs accumulating from repeated NAT Gateway create/destroy cycles across mode switches (partial mitigation already added to `go-idle.sh`'s pre-destroy step).
- Build a CSV/PDF export pipeline for contest data (already spec'd: backend-only, wrapped in a DB transaction, progress reported via polling, full audit log, file snapshot retained).

---

## 9. Suggested Portfolio Framing

For a case-study writeup, the strongest narrative arc this project supports is:

> *"I designed a cost-optimized dual-mode AWS architecture for a workload that is 99% idle and 1% extreme burst, built the full multi-tenant product on top of it solo, then proved it against real infrastructure with a genuine 10,000-user load test — and documented, root-caused, and fixed 24 real production-scale bugs along the way, several of which taught me that the same underlying flaw (two Redis instances during a mode switch) manifests in multiple places if you don't go looking for it."*

Concrete, quantifiable talking points this project gives you:
- **630× seed performance improvement** (42 min → 4.1 sec) via bulk SQL + concurrency, with a clear before/after root-cause explanation.
- **A real, named architectural trade-off** (idle/live dual infrastructure) with both its cost savings *and* its measured bug surface (7/24 incidents) stated honestly — shows engineering maturity, not just a feature list.
- **A memory-vs-CPU scaling insight** that most engineers only encounter in postmortems, found and fixed proactively via metrics reading, not because it caused an outage.
- **A protocol-level debugging story** (Socket.IO EIO4 framing) that demonstrates comfort below the application layer.
- **A concrete distributed-systems failure class** (job scheduled to the wrong backing store during an infrastructure transition) diagnosed, generalized, and permanently fixed with purpose-built tooling (`redis-migrate.js`) rather than a one-off patch.
