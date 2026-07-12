# QuizBuzz — System Architecture

> **Multi-tenant SaaS quiz platform** built to support 10,000 concurrent WebSocket users.
> Built solo: backend, frontend, infrastructure, CI/CD, load testing.
> Stack: Node.js · TypeScript · Socket.IO · BullMQ · Redis · PostgreSQL · AWS · Terraform

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Dual-Mode Infrastructure (Idle vs Live)](#2-dual-mode-infrastructure-idle-vs-live)
3. [AWS Deployment Architecture (Terraform)](#3-aws-deployment-architecture-terraform)
4. [Backend Module Architecture](#4-backend-module-architecture)
5. [Real-Time WebSocket Flow](#5-real-time-websocket-flow)
6. [Database Schema (ER Diagram)](#6-database-schema-er-diagram)
7. [Background Worker System](#7-background-worker-system)
8. [Quiz Module Deep Dive](#8-quiz-module-deep-dive)
9. [Redis Key Schema](#9-redis-key-schema)
10. [CI/CD Pipeline](#10-cicd-pipeline)
11. [Load Testing Results](#11-load-testing-results)

---

## 1. System Overview

QuizBuzz is a **multi-tenant SaaS platform** for conducting large-scale, real-time, proctored online quiz contests. Organizations create contests, participants register and pay, take a live timed quiz over WebSockets with facial detection proctoring, receive auto-evaluated results, and download certificates — all managed by a single backend.

```mermaid
graph TD
    subgraph Clients
        AdminApp["🖥️ Admin Dashboard\n(Next.js)"]
        ParticipantApp["📱 Participant App\n(Mobile/Web)"]
    end
    subgraph "API Layer"
        Express["Express.js REST API\n/api/v1/*"]
        SocketIO["Socket.IO Gateway\n/participant namespace"]
        AuthMW["Auth + Rate Limit\nMiddleware"]
    end
    subgraph "Core Business Logic"
        AdminMod["Admin & Org\nManagement"]
        ContestMod["Contest & Question\nEngine"]
        QuizMod["Real-time Quiz\nEngine"]
        SubMod["Submissions &\nEvaluation"]
        PayMod["Payment\nProcessing"]
        CertMod["Certificate\nGeneration"]
        ProcMod["Proctoring\nMonitor"]
    end
    subgraph "Data & Infrastructure"
        Prisma["Prisma ORM"]
        Postgres[("PostgreSQL\n(AWS RDS)")]
        Redis[("Redis\n(BullMQ + Sessions)")]
        Workers["BullMQ Workers\n(Separate Process)"]
        Razorpay["Razorpay API\n(Payments)"]
        S3["AWS S3\n(Certificates)"]
    end
    AdminApp -->|HTTPS/REST| Express
    AdminApp -->|WebSocket| SocketIO
    ParticipantApp -->|HTTPS/REST| Express
    ParticipantApp -->|WebSocket| SocketIO
    Express --> AuthMW
    SocketIO --> AuthMW
    AuthMW --> AdminMod
    AuthMW --> ContestMod
    AuthMW --> QuizMod
    AuthMW --> PayMod
    QuizMod -->|Session State| Redis
    QuizMod -->|Real-time Events| SocketIO
    QuizMod -->|Schedule Jobs| Workers
    AdminMod --> Prisma
    ContestMod --> Prisma
    SubMod --> Prisma
    CertMod --> Workers
    Workers --> Prisma
    Workers --> S3
    Prisma --> Postgres
    PayMod --> Razorpay
```

---

## 2. Dual-Mode Infrastructure (Idle vs Live)

The central architectural decision: two completely different infrastructure stacks for two completely different load profiles. Contest traffic is near-zero between events, then 10,000 sustained WebSocket connections during a 30-minute to 2-hour quiz.

```mermaid
graph LR
    subgraph "IDLE MODE — ~$35-40/month"
        direction TB
        EC2_Admin["🖥️ Admin EC2\nt3.small/medium\n(Elastic IP: 65.1.26.101)"]
        Docker_BE["Backend Container\nExpress + Socket.IO"]
        Docker_W["Worker Container\nBullMQ Consumer"]
        Docker_FE["Frontend Container\nNext.js SSR"]
        Docker_R["Redis Container\nlocalhost:6379"]
        EC2_Admin --> Docker_BE
        EC2_Admin --> Docker_W
        EC2_Admin --> Docker_FE
        EC2_Admin --> Docker_R
    end
    subgraph "LIVE MODE — +$14-30/contest day"
        direction TB
        ALB["⚡ Application Load Balancer\nHTTPS:443 + WebSocket"]
        AdminTG["Admin Target Group\n→ Admin EC2\n(dashboard, registration, payments)"]
        QuizTG["Quiz Target Group\n→ ASG 2-10 × t3.medium\n(WebSocket, /api/quiz/*)"]
        ElastiCache["🔴 ElastiCache Redis\nr6g.large × 2\n(Primary + Replica, HA)"]
        ALB -->|/socket.io/*\n/api/quiz/*| QuizTG
        ALB -->|Everything else| AdminTG
        QuizTG --> ElastiCache
        AdminTG --> ElastiCache
    end
    DNS["Route53\nysmquizbuzz.com"]
    DNS -->|A record → Elastic IP\n(idle mode)| EC2_Admin
    DNS -->|ALIAS → ALB\n(live mode)| ALB
    RDS[("Aurora PostgreSQL\nServerless v2\nauto-pauses when idle")]
    EC2_Admin --> RDS
    QuizTG --> RDS
```

### Mode Switch Scripts

| Script | Action | Duration |
|--------|--------|---------|
| `go-live.sh` | `terraform apply` → DNS propagation wait → ALB health check → smoke tests | ~10 minutes |
| `go-idle.sh` | Drain BullMQ queues → `terraform destroy` live resources → verify DNS reverted | ~8 minutes |
| `redis-migrate.js` | `DUMP/RESTORE` all Redis keys between Docker container ↔ ElastiCache (both directions) | ~2 minutes |

**Why this design:** Contest workload is 99% idle + 1% extreme burst on a known schedule. Pre-warming based on registered participant count beats reactive autoscaling for any scheduled workload where peak demand is known in advance.

---

## 3. AWS Deployment Architecture (Terraform)

Full Terraform-managed infrastructure. Every resource in both modes declared in `terraform/`.

```mermaid
graph TB
    subgraph "AWS ap-south-1 (Mumbai)"
        subgraph "Always-On Resources"
            R53["Route53\nHosted Zone\nysmquizbuzz.com"]
            ACM["ACM Certificate\n*.ysmquizbuzz.com"]
            RDS["Aurora Serverless v2\nPostgreSQL\nauto-pause when idle"]
            S3_Assets["S3 Bucket\nquizbuzz-assets-prod\n(certificates, uploads)"]
            S3_TF["S3 Bucket\nquizbuzz-tf-state\n(Terraform state)"]
            DynamoDB["DynamoDB\nquizbuzz-tf-locks\n(Terraform state locks)"]
            ECR["ECR Repositories\nbackend / worker / frontend"]
            SSM["SSM Parameter Store\nimage tags, secrets, DB URL"]
            CW["CloudWatch\nlogs, alarms, dashboards"]
        end
        subgraph "Admin EC2 (Always-On)"
            EIP["Elastic IP\n65.1.26.101"]
            EC2A["Admin EC2\nt3.small/medium"]
            SG_Admin["Security Group\n:80 :443 from ALB\n:22 from bastion only"]
            Nginx_A["Nginx\nReverse Proxy\nSSL Termination"]
            EC2A --> SG_Admin
            EC2A --> EIP
            EC2A --> Nginx_A
        end
        subgraph "VPC: 10.0.0.0/16"
            subgraph "Public Subnets (2 AZs)"
                ALB_R["Application Load Balancer\nHTTPS:443 → target groups\nHTTP:80 → redirect HTTPS"]
                NAT_GW["NAT Gateway\n(live mode only)\nor NAT Instance (idle mode)"]
            end
            subgraph "Private Subnets — App Tier (2 AZs)"
                ASG["Auto Scaling Group\nLaunch Template: t3.medium\nDesired: pre-warmed by participant count\nMin: 2, Max: 10\nscale-in DISABLED during quiz"]
                QuizEC2["Quiz EC2 Instances\n(live mode only)\nbackend + worker containers"]
                ASG --> QuizEC2
            end
            subgraph "Private Subnets — Data Tier (2 AZs)"
                ElastiCache_R["ElastiCache\nr6g.large × 2\nPrimary + Replica\nnoeviction policy\nauto-failover"]
                RDS_R["Aurora Serverless v2\nPostgreSQL\nconnection pooling"]
            end
        end
        R53 -->|A record: idle| EIP
        R53 -->|ALIAS: live| ALB_R
        ALB_R --> EC2A
        ALB_R --> ASG
        ASG --> ElastiCache_R
        EC2A --> ElastiCache_R
        EC2A --> RDS_R
        ASG --> RDS_R
        QuizEC2 --> S3_Assets
    end
    subgraph "CI/CD: GitHub Actions"
        GH["GitHub Push\n→ build 3 Docker images\n→ push to ECR/GHCR\n→ write image tag to SSM\n→ SSM Run Command on admin EC2\n(no SSH)"]
    end
    GH --> SSM
    SSM --> EC2A
    subgraph "Terraform Modules"
        TF_NET["networking/\nVPC, subnets, NAT,\nsecurity groups"]
        TF_DNS["dns/\nRoute53 zone\nmode-aware A/ALIAS record"]
        TF_ADMIN["admin_instance/\nEC2, EIP, IAM,\nuserdata"]
        TF_DB["database/\nAurora Serverless v2\nconnection pooling"]
        TF_STORAGE["storage/\nS3 bucket"]
        TF_REG["registry/\nECR repos"]
        TF_MON["monitoring/\nCloudWatch alarms\ndashboards"]
        TF_LIVE["live_contest/\ncount = is_live ? 1 : 0\nALB + listeners + rules\nElastiCache replication group\nASG + launch template\nscaling policy"]
    end
```

### ALB Listener Rules (Priority Order)

| Priority | Path Pattern | Target Group | Purpose |
|----------|-------------|-------------|---------|
| 10 | `/socket.io/*` | Quiz ASG | WebSocket connections (sticky, 1-day cookie, 5-min drain) |
| 15 | `/api/quiz/*` | Quiz ASG | Quiz REST API |
| 20 | `/api/*` | Admin EC2 | Admin REST API |
| 100 | `*` (default) | Admin EC2 | Next.js frontend, static assets |

### Terraform Variables

```hcl
variable "mode" {
  # "idle"  → only admin EC2 + always-on resources
  # "live"  → + ALB + ElastiCache + ASG (live_contest module)
  default = "idle"
}
variable "expected_participants" {
  # Used to calculate desired ASG capacity:
  # instances = ceil(expected_participants / 800)
  # Capped at 10 instances max
  default = 0
}
variable "image_tag" {
  # Docker image tag deployed to all containers
  # Written to SSM by CI/CD pipeline
}
```

### go-live.sh Flow

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant TF as Terraform
    participant DNS as Route53
    participant ALB as Load Balancer
    participant Redis as redis-migrate.js
    participant EC2 as Admin EC2
    Dev->>TF: terraform apply -var mode=live -var expected_participants=N
    TF->>ALB: Create ALB + listeners + listener rules
    TF->>TF: Create ElastiCache replication group
    TF->>TF: Create ASG + launch template
    TF->>DNS: Switch A record → ALIAS to ALB
    Dev->>Redis: (inside backend container) redis-migrate --from docker --to elasticache
    Redis->>EC2: DUMP/RESTORE all keys with TTL preservation
    Dev->>EC2: (SSM) update REDIS_HOST → ElastiCache endpoint
    EC2->>EC2: docker compose up -d --force-recreate backend worker
    Dev->>ALB: Poll /health until 2+ targets healthy
    Dev->>Dev: Smoke test /health/redis /health/db /health/queues
    Note over Dev: Contest is now live
    Note over Dev: Safety scale-down scheduled as dead-man switch at T+26h
```

---

## 4. Backend Module Architecture

Strict layered architecture. Request → Router → Controller → Service → Repository → Prisma. Zero business logic in controllers. Zero Prisma calls outside repositories.

```mermaid
graph TD
    subgraph "Request Entry"
        HTTP["HTTP Request"]
        WS["WebSocket Event"]
    end
    subgraph "Transport Layer"
        Router["*.routes.ts\n(routing only)"]
        MWAuth["auth.middleware.ts\n(JWT validation)"]
        MWRate["rate-limit.middleware.ts"]
        MWErr["error.middleware.ts\n(global error handler)"]
    end
    subgraph "Application Layer"
        Ctrl["*.controller.ts\n(parse request → call 1 service → shape response)"]
    end
    subgraph "Domain Layer"
        Svc["*.service.ts\n(all business logic, orchestration)"]
        Zod["*.validator.ts\n(Zod schemas)"]
    end
    subgraph "Data Layer"
        Repo["*.repository.ts\n(DB queries only — Prisma calls)"]
        Redis2["redis.ts\n(session + queue ops)"]
    end
    subgraph "Infrastructure"
        Prisma2["Prisma ORM"]
        PG[("PostgreSQL")]
        RedisSvc[("Redis")]
    end
    HTTP --> Router
    WS --> Router
    Router --> MWAuth
    MWAuth --> Ctrl
    Ctrl --> MWErr
    Ctrl --> Svc
    Svc --> Zod
    Svc --> Repo
    Svc --> Redis2
    Repo --> Prisma2
    Prisma2 --> PG
    Redis2 --> RedisSvc
    subgraph "Domain Modules"
        direction LR
        AdminAuth["Admin Auth\n& Org"]
        Contest["Contest\n& Question"]
        Quiz["Quiz Engine\n(largest module)"]
        Participant["Participant\n& Payment"]
        PostContest["Submission\nCertificate\nAnalytics"]
        Messaging["Messaging\n(SMS/Email)\n← most depended-on"]
    end
```

### Module Dependency Graph

```mermaid
graph TD
    subgraph "Administrative & Core"
        AdminAuth["Admin Auth"]
        Org["Organization"]
        Contact["Contact"]
    end
    subgraph "Contest Lifecycle"
        Contest["Contest"]
        Question["Question"]
        Participant["Participant"]
        Payment["Payment"]
    end
    subgraph "Real-time Execution"
        Quiz["Quiz Engine"]
        Proctoring["Proctoring"]
        QuizAuth["Quiz Auth"]
    end
    subgraph "Post-Contest"
        Submission["Submission"]
        Analytics["Analytics"]
        Certificate["Certificate"]
        Messaging["Messaging"]
    end
    AdminAuth --> Org
    AdminAuth --> Messaging
    Org --> Messaging
    Contest --> Participant
    Contest --> Messaging
    Contest --> Contact
    Contest --> Submission
    Question --> Contest
    Participant --> Contest
    Submission --> Participant
    Payment --> Contest
    Payment --> Participant
    Payment --> Messaging
    Quiz --> Proctoring
    Quiz --> Submission
    QuizAuth --> Messaging
    Contact --> Messaging
    Contact --> Certificate
    Certificate --> Participant
    Analytics --> Quiz
    style Messaging fill:#d1ffca,color:#000
```

**System gravity (modules by dependency count):**

| Module | Incoming | Outgoing | Role |
|--------|---------|---------|------|
| Messaging | 7 | 0 | Shared comms infrastructure |
| Contest | 4 | 4 | Primary domain entity |
| Participant | 5 | 1 | Bridge: users ↔ events |
| Quiz | 1 | 3 | Core real-time hub |

---

## 5. Real-Time WebSocket Flow

The quiz module owns the core real-time engine. Two Socket.IO namespaces: `/participant` (10,000 users) and `/admin` (monitoring dashboard).

```mermaid
sequenceDiagram
    participant Client as Participant Client
    participant HTTP as REST API
    participant GW as Quiz Gateway\n(Socket.IO)
    participant Svc as Quiz Services
    participant Redis as Redis
    participant Queue as BullMQ
    participant Worker as Quiz Worker
    participant DB as PostgreSQL
    Note over Client,DB: Phase 1 — Authentication (REST)
    Client->>HTTP: POST /api/v1/auth/contact/request-otp
    HTTP->>Redis: Store OTP hash (TTL: 5 min)
    HTTP-->>Client: { channel, expiresInSeconds }
    Client->>HTTP: POST /api/v1/auth/contact/verify-otp
    HTTP->>Redis: Verify OTP hash, delete on success
    HTTP-->>Client: { contactToken }
    Client->>HTTP: POST /api/v1/auth/contact/quiz-join
    HTTP->>DB: Verify participant.status, contest.joinCode
    HTTP->>DB: Create QuizSession, update participant.status = CHECKED_IN
    HTTP->>Redis: Publish session-invalidated to old socket (if any)
    HTTP-->>Client: { socketToken (JWT, exp = contest.endTime + 1h) }
    Note over Client,DB: Phase 2 — WebSocket Connection (EIO4 protocol)
    Client->>GW: WS upgrade + EIO4 handshake
    GW-->>Client: 0{"sid":"..."} (EIO OPEN packet)
    Client->>GW: 40/participant,{"token":"<socketToken>"} (namespace connect)
    GW->>Redis: Validate JWT, check session not SUBMITTED
    GW-->>Client: 40/participant,{"sid":"..."} (namespace ACK)
    GW->>DB: Update QuizSession.socketId
    GW->>Redis: HSET session hash {socketId, status: IN_WAITING}
    GW->>Redis: Subscribe to personal channel quiz:personal:{participantId}
    Note over Client,DB: Phase 3 — Waiting Room
    Client->>GW: 42/participant,["join-waiting-room",{contestId}]
    GW->>Svc: joinWaitingRoom()
    Svc->>Redis: SADD quiz:{contestId}:waiting_room {participantId}
    Svc->>Redis: Check quiz:{contestId}:status
    GW-->>Client: joined-waiting-room { waitingCount, startsAt }
    Note over Client,DB: Phase 4 — Quiz Starts (BullMQ timer fires)
    Worker->>Queue: CONTEST_START job fires at contest.startTime
    Worker->>GW: Broadcast quiz-started to contest:{contestId} room
    GW-->>Client: quiz-started { totalQuestions, durationSeconds }
    Client->>GW: 42/participant,["get-questions",{contestId}]
    GW->>Svc: getQuestionsForParticipant()
    Svc->>Redis: Check questions cache (quiz:{contestId}:questions_cache)
    Svc->>Svc: Seeded shuffle (participantId + contestId + SALT)
    Svc->>Redis: Cache participant order (quiz:{contestId}:questions:{participantId})
    Svc->>DB: Update participant.status = IN_QUIZ
    GW-->>Client: questions-loaded { questions (NO isCorrect), resumeFromIndex }
    Note over Client,DB: Phase 5 — Answering (fire-and-forget, Redis only)
    loop For each question
        Client->>GW: save-progress { questionId, selectedOptionId }
        GW->>Redis: HSET quiz:{contestId}:answers:{participantId} {questionId} {optionId}
        GW-->>Client: progress-saved { questionId }
        Client->>GW: heartbeat { contestId, currentQuestion }
        GW->>Redis: SETEX heartbeat key (TTL: 60s)
    end
    Note over Client,DB: Phase 6 — Submission
    Client->>GW: submit-quiz { contestId }
    GW->>Redis: SETNX quiz:locks:submit:{participantId} (NX, 10s TTL)
    GW->>Redis: HGETALL quiz:{contestId}:answers:{participantId}
    GW->>DB: Transaction: CREATE Submission + Answers, UPDATE Participant = SUBMITTED
    GW->>Redis: HSET session status = SUBMITTED
    GW->>Queue: Add evaluate-submission job
    GW-->>Client: submission-ack { submissionId, submittedAt }
    Note over Client,DB: Phase 7 — Evaluation (async, background)
    Worker->>Queue: Consume evaluate-submission job
    Worker->>DB: Fetch submission + correct answers (answer key)
    Worker->>DB: Score each answer, UPDATE Submission + Answer records
    Worker->>Queue: If all evaluated → add compute-leaderboard job
```

### Socket.IO EIO4 Wire Protocol

A raw WebSocket client (like k6) must implement the full EIO4 framing:

```
Open:        0{"sid":"...","pingInterval":25000,"pingTimeout":20000}
NS Connect:  40/participant,{"token":"<jwt>"}
NS ACK:      40/participant,{"sid":"..."}
Event Send:  42/participant,["quiz:v1:join",{...}]
Event Recv:  42/participant,["quiz:v1:start",{...}]
Ping:        2  (server → client, every 25s)
Pong:        3  (client → server, required or connection drops)
```

---

## 6. Database Schema (ER Diagram)

~25 Prisma models. Every table carrying organization-owned data includes `organizationId` — full multi-tenancy enforced at the query layer.

```mermaid
erDiagram
    ORGANIZATION {
        string id PK
        string name
        string slug UK
        bool isActive
    }
    ADMIN {
        string id PK
        string email UK
        string passwordHash
    }
    ORG_MEMBER {
        string id PK
        string adminId FK
        string organizationId FK
        enum role "OWNER|ADMIN|VIEWER"
    }
    CONTEST {
        string id PK
        string organizationId FK
        string slug
        enum status "DRAFT|PUBLISHED|LIVE|EVALUATION|COMPLETED"
        datetime startTime
        datetime endTime
        int duration
        string joinCode
        bool shuffleQuestions
        decimal fee
        int maxParticipants
    }
    QUESTION {
        string id PK
        string organizationId FK
        string questionText
        enum difficulty
    }
    QUESTION_OPTION {
        string id PK
        string questionId FK
        string text
        bool isCorrect
        int position
    }
    CONTEST_QUESTION {
        string id PK
        string contestId FK
        string questionId FK
        int position
        decimal marks
        decimal negativeMark
    }
    CONTACT {
        string id PK
        string organizationId FK
        string email UK
        string phone UK
    }
    PARTICIPANT {
        string id PK
        string contactId FK
        string contestId FK
        enum status "REGISTERED|CHECKED_IN|IN_WAITING|IN_QUIZ|SUBMITTED|DISQUALIFIED"
        string registrationRef UK
    }
    PAYMENT {
        string id PK
        string participantId FK "1:1"
        enum status "PENDING|AUTHORIZED|PAID|FAILED|REFUNDED"
        string razorpayOrderId
        string razorpayPaymentId
    }
    QUIZ_SESSION {
        string id PK
        string participantId FK
        string socketId
        string deviceFingerprint
        bool isActive
        datetime lastHeartbeatAt
    }
    SUBMISSION {
        string id PK
        string participantId FK "1:1"
        string contestId FK
        enum status "SUBMITTED|EVALUATED"
        int correct
        int wrong
        int skipped
        float score
        float percentage
        int timeTakenSecs
    }
    ANSWER {
        string id PK
        string submissionId FK
        string questionId FK
        string selectedOptionId
        bool isCorrect
        float marksAwarded
    }
    LEADERBOARD_ENTRY {
        string id PK
        string participantId FK "1:1"
        string contestId FK
        int rank
        float score
        float percentage
    }
    PROCTORING_EVENT {
        string id PK
        string participantId FK
        string contestId FK
        enum type "FACE_NOT_DETECTED|MULTIPLE_FACES|TAB_SWITCH|FULLSCREEN_EXIT"
        int severity
    }
    PROCTORING_SCORE {
        string id PK
        string participantId FK "1:1"
        int violationScore
        bool isFlagged
        bool isDisqualified
    }
    CERTIFICATE {
        string id PK
        string participantId FK "1:1"
        enum status "QUEUED|GENERATING|GENERATED|FAILED"
        string s3Key
        string s3Url
    }
    MESSAGE_LOG {
        string id PK
        string contestId FK
        string contactId FK
        enum channel "EMAIL|WHATSAPP"
        enum status "QUEUED|SENT|FAILED"
    }
    SCHEDULED_JOB {
        string id PK
        string contestId FK
        string bullmqJobId
        enum type "CONTEST_START|AUTO_SUBMIT|TIME_WARNING"
        enum status "PENDING|COMPLETED|FAILED"
    }
    ORGANIZATION ||--o{ ORG_MEMBER : "has members"
    ADMIN ||--o{ ORG_MEMBER : "belongs to"
    ORGANIZATION ||--o{ CONTEST : "hosts"
    ORGANIZATION ||--o{ CONTACT : "manages"
    CONTEST ||--o{ CONTEST_QUESTION : "contains"
    QUESTION ||--o{ CONTEST_QUESTION : "used in"
    QUESTION ||--o{ QUESTION_OPTION : "has options"
    CONTACT ||--o{ PARTICIPANT : "registers as"
    CONTEST ||--o{ PARTICIPANT : "has"
    PARTICIPANT ||--o| PAYMENT : "pays"
    PARTICIPANT ||--o{ QUIZ_SESSION : "connects via"
    PARTICIPANT ||--o| SUBMISSION : "completes"
    SUBMISSION ||--o{ ANSWER : "contains"
    QUESTION ||--o{ ANSWER : "answered in"
    CONTEST ||--o{ LEADERBOARD_ENTRY : "ranks"
    PARTICIPANT ||--o| LEADERBOARD_ENTRY : "ranked as"
    PARTICIPANT ||--o{ PROCTORING_EVENT : "triggers"
    PARTICIPANT ||--o| PROCTORING_SCORE : "scored by"
    PARTICIPANT ||--o| CERTIFICATE : "receives"
    CONTEST ||--o{ MESSAGE_LOG : "generates"
    CONTEST ||--o{ SCHEDULED_JOB : "schedules"
```

---

## 7. Background Worker System

All slow/unreliable/bursty work runs in a separate Docker container consuming BullMQ queues. The API/WebSocket container never blocks on heavy operations.

```mermaid
graph TD
    subgraph "Producers (API/WS Container)"
        QuizGW["Quiz Gateway\n(WebSocket)"]
        ContestSvc["Contest Service\n(REST)"]
        CertSvc["Certificate Service\n(REST)"]
        MsgSvc["Messaging Service\n(REST)"]
        SubSvc["Submission Service\n(WebSocket)"]
    end
    subgraph "Queue Layer (Redis / BullMQ)"
        Q_Timer["quiz-auto-submit\n(delayed jobs)"]
        Q_Eval["quiz-evaluation\nconcurrency: 50"]
        Q_Cert["certificate-generation\nconcurrency: 10"]
        Q_Msg["messaging\nconcurrency: 20"]
        Q_Analytics["analytics\nconcurrency: 5"]
        Q_Proc["proctoring-score\nconcurrency: 30"]
    end
    subgraph "Consumers (Worker Container — separate process)"
        W_Timer["Quiz Timer Worker\n• quiz-start → broadcast quiz-started\n• force-submit → auto-submit all IN_QUIZ\n• time-warning → emit to contest room"]
        W_Eval["Evaluation Worker\n• score each answer vs answer key\n• update Submission + Answer records\n• trigger leaderboard when all done"]
        W_Cert["Certificate Worker\n• render PDF via pdfkit\n• upload to S3\n• update Certificate.status → GENERATED"]
        W_Msg["Message Worker\n• WhatsApp / Email delivery\n• retry on failure\n• update MessageLog status"]
        W_Analytics["Analytics Worker\n• aggregate ContestAnalyticsSnapshot\n• daily rollup buckets"]
        W_Proc["Proctoring Score Worker\n• update violation score\n• auto-flag at threshold 50\n• auto-disqualify at threshold 100"]
    end
    QuizGW -->|schedule: startTime, endTime| Q_Timer
    QuizGW -->|on submit| Q_Eval
    QuizGW -->|on proctoring event| Q_Proc
    ContestSvc -->|on publish| Q_Timer
    CertSvc -->|on contest complete| Q_Cert
    MsgSvc -->|all notifications| Q_Msg
    SubSvc -->|on submission| Q_Analytics
    Q_Timer --> W_Timer
    Q_Eval --> W_Eval
    Q_Cert --> W_Cert
    Q_Msg --> W_Msg
    Q_Analytics --> W_Analytics
    Q_Proc --> W_Proc
    W_Eval -->|"all evaluated → trigger"| Q_Analytics
    W_Timer -->|"force-submit → enqueue"| Q_Eval
```

---

## 8. Quiz Module Deep Dive

The largest module. Manages the full participant lifecycle from OTP authentication through real-time quiz execution to submission.

```mermaid
stateDiagram-v2
    [*] --> REGISTERED: Contact registers + pays
    REGISTERED --> CHECKED_IN: POST /auth/contact/quiz-join\n(socketToken issued)
    CHECKED_IN --> IN_WAITING: WebSocket connect\njoin-waiting-room event
    IN_WAITING --> IN_QUIZ: quiz-started broadcast\nget-questions event
    state IN_QUIZ {
        [*] --> Answering
        Answering --> Answering: save-progress (Redis only)
        Answering --> Answering: heartbeat (every 15s)
        Answering --> [*]: All questions answered
    }
    IN_QUIZ --> SUBMITTED: submit-quiz\n(manual, before timer)
    IN_QUIZ --> SUBMITTED: force-submit\n(AUTO_SUBMIT BullMQ job at endTime)
    IN_QUIZ --> DISQUALIFIED: Proctoring score ≥ 100
    SUBMITTED --> [*]: Evaluation worker\nscores answers
    DISQUALIFIED --> [*]
    note right of IN_QUIZ
        Redis is source of truth here:
        Answers: HSET quiz:cId:answers:pId
        Session: HSET quiz:cId:session:pId
        Heartbeat: SETEX quiz:cId:heartbeat:pId (60s TTL)
    end note
```

### Exactly-Once Submission Guarantee

```mermaid
flowchart TD
    A[Client: submit-quiz] --> B{Redis NX lock\nquiz:locks:submit:pId\nPX=10000}
    B -->|Lock acquired| C{Session status\nin Redis?}
    B -->|Lock held| Z[Return null\nOther instance processing]
    C -->|SUBMITTED| D[Fetch existing\nsubmission from DB]
    C -->|IN_QUIZ| E[Read all answers\nHGETALL quiz:cId:answers:pId]
    D --> F[Emit submission-ack\nwith existing submissionId]
    E --> G[DB Transaction:\nCREATE Submission\nCREATE Answers for ALL questions\nUPDATE Participant status = SUBMITTED\nUPDATE QuizSession.endedAt]
    G --> H[Redis: HSET session status = SUBMITTED]
    H --> I[BullMQ: Add evaluate-submission job]
    I --> J[Emit submission-ack]
    J --> K[Release lock: DEL quiz:locks:submit:pId]
    Z --> K
    F --> K
```

### Reconnect Handling

```mermaid
flowchart TD
    A[Client reconnects\nwith same socketToken] --> B{Redis session\nexists?}
    B -->|No session| C[Treat as new connection\nstart from join-waiting-room]
    B -->|status = IN_WAITING| D[Re-add to waiting room\njoin contest socket room]
    B -->|status = IN_QUIZ| E[Skip waiting room\nSend resume-quiz event]
    B -->|status = SUBMITTED| F[Emit submission-ack\nwith existing submissionId]
    E --> G[get-questions: read cached order\nfrom quiz:cId:questions:pId]
    G --> H[Read saved answers\nHGETALL quiz:cId:answers:pId]
    H --> I[Emit resume-quiz\n{currentQuestion, savedAnswers}]
    I --> J[Client restores state\nno data lost]
```

---

## 9. Redis Key Schema

All keys: `quiz:{contestId}:{dataType}:{participantId}` — scoped per-contest, per-participant.

| Key Pattern | Type | TTL | Content |
|-------------|------|-----|---------|
| `quiz:{cId}:session:{pId}` | Hash | 2h | socketId, status, startedAt, currentQuestion, deviceFingerprint |
| `quiz:{cId}:answers:{pId}` | Hash | 24h | {questionId → selectedOptionId} — source of truth for in-progress answers |
| `quiz:{cId}:heartbeat:{pId}` | String | 60s | timestamp — dead-man switch. Expires = disconnected |
| `quiz:{cId}:questions:{pId}` | String | 1h | JSON array of question IDs in participant's shuffled order |
| `quiz:{cId}:questions_cache` | String | 1h | JSON full question objects (shared across all participants) |
| `quiz:{cId}:waiting_room` | Set | 24h | Set of participantIds currently in waiting room |
| `quiz:{cId}:status` | String | 1h | Contest status string (cache layer over DB) |
| `quiz:locks:submit:{pId}` | String | 10s | NX lock — prevents duplicate submission processing |
| `quiz:locks:session:{pId}` | String | 5s | NX lock — prevents duplicate question-fetch race |
| `quiz:personal:{pId}` | Pub/Sub | — | Cross-instance personal events (session-invalidated, disqualified) |

**Memory per participant at peak:** ~18.6 KB
**1,000 participants total:** ~37 MB (including Redis allocator overhead)
**Redis container limit:** 256 MB → 6× headroom at 1,000 users

---

## 10. CI/CD Pipeline

```mermaid
graph LR
    Dev["Developer\ngit push main"] --> GHA["GitHub Actions"]
    subgraph "Build Stage (parallel)"
        B1["Build Backend\nDocker image"]
        B2["Build Worker\nDocker image"]
        B3["Build Frontend\nDocker image"]
    end
    GHA --> B1
    GHA --> B2
    GHA --> B3
    B1 --> Push["Push to\nGHCR / ECR"]
    B2 --> Push
    B3 --> Push
    Push --> SSM_W["Write image tag\nto SSM Parameter Store"]
    SSM_W --> Gate["Manual Approval Gate\n(production Environment)"]
    Gate --> Deploy["AWS SSM Run Command\n(no SSH)\naws ssm send-command\n→ admin EC2\n→ docker compose pull\n→ docker compose up -d"]
    Deploy --> Smoke["Smoke Test\nGET /health\n→ 200 OK"]
```

**Why SSM instead of SSH:**
The admin EC2 has no inbound SSH rule. All deploys go through AWS Systems Manager Run Command — no SSH key management, full audit trail in CloudWatch, works from GitHub Actions with only an IAM role.

---

## 11. Load Testing Results

**Date:** June 27–28, 2026
**Environment:** AWS ap-south-1, production infrastructure
**Tool:** k6 with custom Socket.IO EIO4 implementation

```mermaid
xychart-beta
    title "Concurrent IN_QUIZ Participants Over Test Session"
    x-axis ["Stage 0 (50 VUs)", "Stage 1 Attempt 1", "Stage 1 Attempt 2", "Stage 1 Attempt 3", "Stage 2 (2000 VUs)"]
    y-axis "Peak IN_QUIZ" 0 --> 1500
    bar [50, 0, 500, 800, 1323]
```

| Metric | Result |
|--------|--------|
| Peak simultaneous IN_QUIZ | **1,323** |
| Successful submissions (end-to-end) | **140** (remainder lost to OOM + AUTO_SUBMIT bug — both since fixed) |
| Seed performance improvement | **630×** (42 min → 4.1 sec) |
| Bugs documented and root-caused | **24** |
| Evaluation worker: confirmed working | ✅ |
| ElastiCache connectivity: confirmed | ✅ |
| Socket.IO EIO4 protocol: confirmed | ✅ |
| Admin live monitor: confirmed | ✅ |

### Bugs by Category

| Category | Count | Examples |
|----------|-------|---------|
| Infrastructure / Terraform | 5 | HTTPS listener missing, ElastiCache eviction policy, COOKIE_DOMAIN stale |
| Redis / dual-backend | 4 | CONTEST_START job lost, AUTO_SUBMIT undercounting |
| Protocol | 2 | Socket.IO EIO4 framing, wrong question payload shape |
| Seed tooling | 6 | Prisma v7 adapter, IPv4/IPv6, bulk SQL, 42-min performance |
| Configuration | 4 | Rate limit units, DB pool size, heap limit, file descriptors |
| Architecture (design) | 3 | CPU-based autoscaling wrong metric, no readiness check, sticky sessions disabled |

**Gap between 1,323 and 10,000:** Documented explicitly with root-cause and remediation plan. The OOM crashes and AUTO_SUBMIT undercounting are fixed in code. Pre-warmed scaling (not CPU-reactive) is the next infrastructure change. See Outstanding Items in full incident log.

---

*Architecture documentation version: 1.0*
*Last updated: July 2026*
*Engineer: Austin Makasare*
*GitHub: [github.com/aUSTIN0022](https://github.com/aUSTIN0022/)*
