# QuizBuzz Load Testing — Incident Log & Engineering Notes

**Date:** June 27–28, 2026  
**Environment:** AWS ap-south-1 (Mumbai), Production  
**Goal:** Validate 10,000 concurrent WebSocket users across live infrastructure  
**Stack:** NestJS/Node.js backend, Socket.IO, BullMQ, PostgreSQL RDS, ElastiCache Redis, ALB + ASG

---

## Table of Contents

1. [Infrastructure Overview](#1-infrastructure-overview)
2. [Pre-Test Setup Issues](#2-pre-test-setup-issues)
3. [Bug: Terraform State Lock](#3-bug-terraform-state-lock)
4. [Bug: HTTPS Listener Missing from ALB](#4-bug-https-listener-missing-from-alb)
5. [Bug: COOKIE_DOMAIN Wrong in Live Mode](#5-bug-cookie_domain-wrong-in-live-mode)
6. [Bug: Seeding Script — TypeScript Compilation Failures](#6-bug-seeding-script--typescript-compilation-failures)
7. [Bug: Prisma v7 Requires Adapter](#7-bug-prisma-v7-requires-adapter)
8. [Bug: SSH Tunnel IPv4 vs IPv6](#8-bug-ssh-tunnel-ipv4-vs-ipv6)
9. [Bug: Seeding Transactions Timeout Over Tunnel](#9-bug-seeding-transactions-timeout-over-tunnel)
10. [Bug: Seed Script 42-Minute Performance](#10-bug-seed-script-42-minute-performance)
11. [Bug: Bulk SQL Parameter Binding](#11-bug-bulk-sql-parameter-binding)
12. [Bug: registrationRef Unique Constraint Collision](#12-bug-registrationref-unique-constraint-collision)
13. [Bug: OTP Rate Limiter on participant-login](#13-bug-otp-rate-limiter-on-participant-login)
14. [Bug: k6 Script — Wrong Socket.IO Protocol](#14-bug-k6-script--wrong-socketio-protocol)
15. [Bug: Participants Stuck in Waiting Room](#15-bug-participants-stuck-in-waiting-room)
16. [Bug: CONTEST_START Job Enqueued to Wrong Redis](#16-bug-contest_start-job-enqueued-to-wrong-redis)
17. [Bug: OOM Crash — Node.js Heap Exhaustion](#17-bug-oom-crash--nodejs-heap-exhaustion)
18. [Bug: DB Connection Pool Exhaustion](#18-bug-db-connection-pool-exhaustion)
19. [Bug: AUTO_SUBMIT Only Reads active SET](#19-bug-auto_submit-only-reads-active-set)
20. [Bug: RATE_LIMIT_WINDOW Wrong Units](#20-bug-rate_limit_window-wrong-units)
21. [Bug: ElastiCache Eviction Policy volatile-lru](#21-bug-elasticache-eviction-policy-volatile-lru)
22. [Bug: NOT_REGISTERED Errors in k6](#22-bug-not_registered-errors-in-k6)
23. [Bug: k6 Question Structure Wrong](#23-bug-k6-question-structure-wrong)
24. [Bug: File Descriptor Limit Not Set](#24-bug-file-descriptor-limit-not-set)
25. [Recurring Issue: Redis Migration on Mode Switch](#25-recurring-issue-redis-migration-on-mode-switch)
26. [Recurring Issue: ASG Scale-Out Wrong Metric](#26-recurring-issue-asg-scale-out-wrong-metric)
27. [Architecture Decision: Single Instance vs Live Infrastructure](#27-architecture-decision-single-instance-vs-live-infrastructure)
28. [Test Results Summary](#28-test-results-summary)
29. [Outstanding Items](#29-outstanding-items)

---

## 1. Infrastructure Overview

```
IDLE MODE:
  ysmquizbuzz.com → Route53 A record → Elastic IP → Admin EC2 (t3.medium)
  Admin EC2 runs: backend, worker, frontend, redis (Docker containers)

LIVE MODE:
  ysmquizbuzz.com → Route53 ALIAS → ALB → quiz-tg (ASG c6i/t3.medium × 2-10)
                                         → admin-tg (admin EC2)
  ElastiCache r6g.large (primary + replica)
  All instances share ElastiCache for Redis
```

**Key endpoints:**
- Domain: `ysmquizbuzz.com`
- RDS: `quizbuzz-postgres.crswgokccgv2.ap-south-1.rds.amazonaws.com:5432`
- ElastiCache: `quizbuzz-live-redis.uk8v2d.ng.0001.aps1.cache.amazonaws.com`
- Admin EC2 Elastic IP: `65.1.26.101`

---

## 2. Pre-Test Setup Issues

### Context
Before any load test could run, the following needed to be completed:
1. Create contest in admin dashboard
2. Seed 10,000 participants into RDS (private subnet — not directly accessible from laptop)
3. Spin up live infrastructure
4. Schedule contest lifecycle BullMQ jobs
5. Run k6 load test

RDS is in a **private subnet** — only reachable from within the VPC. All seeding had to go through an SSH tunnel via the admin EC2.

---

## 3. Bug: Terraform State Lock

**Symptom:**
```
Error: Error acquiring the state lock
Lock Info:
  ID: 611fc451-a026-42ba-20ad-60d517da3ae4
```

**Cause:** Terminal closed mid-apply, leaving a stale DynamoDB lock entry.

**Fix:**
```bash
terraform force-unlock 611fc451-a026-42ba-20ad-60d517da3ae4
```

**Status:** ✅ Fixed (one-time manual command)

---

## 4. Bug: HTTPS Listener Missing from ALB

**Symptom:** `curl https://ysmquizbuzz.com` → `ERR_CONNECTION_TIMED_OUT`. ALB only had HTTP:80 listener (redirecting to 443) but no HTTPS:443 listener.

**Cause:** Terraform `go-live.sh` failed to create the HTTPS listener during a previous apply. The `aws_lb_listener.https` resource and all listener rules were missing from Terraform state — they simply never got created.

**Fix:** Imported the existing ACM CNAME validation record and ran `terraform apply`:
```bash
terraform import 'module.dns.aws_route53_record.acm_validation["ysmquizbuzz.com"]' \
  'Z05552042KN58E1DBW8S6__68c900956c0be64ac81145eff2503b65.ysmquizbuzz.com._CNAME'
terraform apply -var="mode=live" -var="expected_participants=10000" -auto-approve
```

**Resources created:**
- `aws_lb_listener.https` (port 443 with ACM cert)
- `aws_lb_listener_rule.websocket` (priority 10, `/socket.io/*` → quiz-tg)
- `aws_lb_listener_rule.api` (priority 15, `/api/*` → quiz-tg)
- `aws_lb_listener_rule.frontend` (priority 20, `/`, `/_next/*` → admin-tg)
- `aws_acm_certificate_validation.main`
- `aws_route53_record.acm_validation`

**Status:** ✅ Fixed

---

## 5. Bug: COOKIE_DOMAIN Wrong in Live Mode

**Symptom:** Admin dashboard login returned HTTP 200 but immediately failed on `/me` and `/refresh` with 401. Browser showed `Set-Cookie: Domain=.ysminfosolution.com` — old domain.

**Cause:** The ASG `userdata.sh.tpl` had `COOKIE_DOMAIN=.ysminfosolution.com` hardcoded (old domain before migration to `ysmquizbuzz.com`). The admin instance had the correct value but quiz ASG instances were setting cookies with the wrong domain.

**Why admin worked but ASG failed:** Admin login endpoint was routed by ALB to the **quiz ASG instances** (via `/api/*` rule pointing to quiz-tg), not the admin instance. The ASG instances had the wrong cookie domain.

**Fix — Terraform template:**
```diff
- COOKIE_DOMAIN=.ysminfosolution.com
+ COOKIE_DOMAIN=.ysmquizbuzz.com
```

**Fix — Running instances (immediate, via SSM):**
```bash
for IP in 10.0.20.220 10.0.21.237; do
  ssh -J ec2-user@65.1.26.101 ec2-user@$IP \
    "sed -i 's/COOKIE_DOMAIN=.ysminfosolution.com/COOKIE_DOMAIN=.ysmquizbuzz.com/g' /app/.env && \
     sed -i 's/quiz.ysminfosolution.com/ysmquizbuzz.com/g' /app/.env && \
     cd /app && docker compose up -d --force-recreate backend worker"
done
```

**Status:** ✅ Fixed in Terraform template. Also fixed in admin userdata template.

---

## 6. Bug: Seeding Script — TypeScript Compilation Failures

**Symptom:** Running `npx ts-node seed-load-test-data.ts` failed with multiple errors:
- `Cannot find module '@prisma/client'`
- `Cannot find module 'dotenv'`
- `Parameter 'contact' implicitly has an 'any' type`

**Cause:**
1. `ts-node` not installed in backend `node_modules` (backend uses `tsc` build, not ts-node)
2. Backend `tsconfig.json` has `rootDir: ./src` — rejects files outside `src/`
3. `strict: true` in tsconfig flags implicit `any` in seed script

**Fix:** Rewrote seed as plain JavaScript (`seed-load-test-data.js`) with `NODE_PATH` pointing to backend node_modules:
```powershell
$env:NODE_PATH = "D:\YSM\QuizBuzz (new)\backend\node_modules"
node ..\load-testing\scripts\seed-load-test-data.js
```

**Status:** ✅ Fixed

---

## 7. Bug: Prisma v7 Requires Adapter

**Symptom:**
```
PrismaClientConstructorValidationError: Using engine type "client" requires 
either "adapter" or "accelerateUrl" to be provided to PrismaClient constructor.
```

**Cause:** Prisma v7 removed the built-in query engine. Now requires an explicit adapter (`@prisma/adapter-pg`).

**Fix:**
```javascript
const { PrismaPg } = require("@prisma/adapter-pg");
const adapter = new PrismaPg({ connectionString: DATABASE_URL });
const prisma = new PrismaClient({ adapter });
```

**Status:** ✅ Fixed

---

## 8. Bug: SSH Tunnel IPv4 vs IPv6

**Symptom:** `Test-NetConnection -ComputerName localhost -Port 5433` returned success but Prisma connection timed out. The DATABASE_URL used `localhost` which Windows resolved to `::1` (IPv6) but the SSH tunnel bound to `127.0.0.1` (IPv4).

**Fix:** Replace `localhost` with `127.0.0.1` explicitly in DATABASE_URL:
```powershell
$env:DATABASE_URL = "postgresql://quizbuzz_admin:PASSWORD@127.0.0.1:5433/quizbuzz?..."
```

**Status:** ✅ Fixed

---

## 9. Bug: Seeding Transactions Timeout Over Tunnel

**Symptom:**
```
Transaction API error: A rollback cannot be executed on an expired transaction. 
The timeout for this transaction was 30000 ms, however 30239 ms passed.
```

**Cause:** Original seed script used `prisma.$transaction([...200 upserts])` — a single transaction with 200 sequential DB round-trips over an SSH tunnel with ~100ms latency. Total time = 200 × 100ms = 20+ seconds, exceeding the 30s Prisma transaction timeout.

**Fix:** Removed transactions entirely. Switched to individual upserts with progress tracking. Then further optimized to bulk SQL.

**Status:** ✅ Fixed

---

## 10. Bug: Seed Script 42-Minute Performance

**Symptom:** Seeding 10,000 participants took 42 minutes.

**Root cause analysis:**

| Problem | Impact |
|---|---|
| 3 sequential DB round-trips per batch | 50 batches × 3 = 150 sequential network calls |
| 200 individual upserts per `$transaction()` | No bulk SQL path |
| Batch size of 200 | 50 batches = 50× overhead |
| Fully sequential batches | Zero parallelism |

**Fix:** Rewrote using:
- Raw `pg` pool with `client.query()` (bypasses Prisma's parameter binding issues)
- Single bulk `INSERT ... ON CONFLICT DO NOTHING` per batch
- `BATCH_SIZE=500`, `CONCURRENT_BATCHES=4`
- `registrationRef = QB-LOAD-000001` (deterministic, index-based, no timestamp collisions)

**Result:** 10,000 records in **4.1 seconds** (630× faster)

**Status:** ✅ Fixed

---

## 11. Bug: Bulk SQL Parameter Binding

**Symptom:**
```
Raw query failed. Code: 08P01. 
bind message supplies 1503 parameters, but prepared statement "" requires 3
```

**Cause:** `prisma.$executeRawUnsafe()` mis-counts parameters when the VALUES table uses `$4..$N` alongside `$1..$3` anchor params. The `@prisma/adapter-pg` layer treats them as separate prepared statements.

**Fix:** Bypassed Prisma entirely for bulk SQL — used raw `pg` pool `client.query()` directly. The `pg` driver handles large parameter arrays correctly.

**Status:** ✅ Fixed

---

## 12. Bug: registrationRef Unique Constraint Collision

**Symptom:**
```
Raw query failed. Code: 23505. 
duplicate key value violates unique constraint "participants_registrationRef_key"
```

**Cause:** `registrationRef` was generated as `QB-${Date.now().toString(36)}-${emailSlice}`. With 4 concurrent batches running simultaneously within the same millisecond, and emails like `loadtest00001` and `loadtest10001` both ending in `0001`, collisions were inevitable.

**Fix:** Changed to deterministic index-based ref:
```javascript
const ref = `QB-LOAD-${String(i).padStart(6, "0")}`;
// QB-LOAD-000001, QB-LOAD-000002, ..., QB-LOAD-010000
```

**Status:** ✅ Fixed

---

## 13. Bug: OTP Rate Limiter on participant-login

**Symptom:**
```
HTTP 429 — {"message":"Too many OTP requests. Please try again later."}
```

**Cause:** `quiz-registration.routes.ts` applied `otpLimiter` to the `participant-login` endpoint:
```typescript
quizRegistrationRouter.post("/participant-login", otpLimiter, controller.participantLogin);
```
All 1000 k6 VUs shared one laptop IP address. Rate limit was 5 requests per 10 minutes per IP → exhausted immediately.

**Fix:** Removed `otpLimiter` from `participant-login` (no OTP is required for this endpoint — email identity was already verified during registration):
```typescript
quizRegistrationRouter.post("/participant-login", controller.participantLogin);
```

**Status:** ✅ Fixed

**Related fix:** `RATE_LIMIT_WINDOW=60000` in userdata was in milliseconds when config expects seconds → changed to `600` (600 seconds = 10 minutes).

---

## 14. Bug: k6 Script — Wrong Socket.IO Protocol

**Symptom:** 50% WebSocket connect success rate. Live Monitor showed 0 participants despite k6 showing connections open. `quiz:v1:join` events not appearing in backend logs.

**Root cause:** k6 is a raw WebSocket client. The script was sending plain JSON:
```javascript
socket.send(JSON.stringify({ event: "quiz:v1:join", data: {...} }));
```
But Socket.IO uses its own binary framing protocol (EIO4). The backend's Socket.IO server ignored raw JSON — it only understands EIO4 framing. Also, the backend uses the `/participant` namespace, which requires a separate namespace connect packet after the initial WebSocket handshake.

**The correct EIO4 protocol flow:**
```
1. WS opens → server sends: 0{"sid":"...","pingInterval":25000,...}
2. Client sends namespace connect: 40/participant,{"token":"<jwt>"}
3. Server ACKs: 40/participant,{"sid":"..."}
4. Client sends events: 42/participant,["quiz:v1:join",{...}]
5. Server sends events: 42/participant,["quiz:v1:start",{...}]
6. EIO PING keepalive: server "2" → client "3"
```

**Fix:** Rewrote `runQuizSession()` to speak proper EIO4 wire protocol:
```javascript
socket.on("message", (raw) => {
  if (raw.startsWith("0{")) {
    // EIO OPEN — send namespace connect with auth token
    socket.send(`40/participant,${JSON.stringify({ token: socketToken })}`);
  }
  if (raw === "2") socket.send("3"); // PING → PONG
  if (raw.startsWith("40/participant,")) {
    // Namespace ACK — now send join event
    wsConnectSuccess.add(true);
    socket.send(`42/participant,${JSON.stringify(["quiz:v1:join", {...}])}`);
  }
  if (raw.startsWith("42/participant,")) {
    // Parse and handle events
    const [eventName, data] = JSON.parse(raw.substring("42/participant,".length));
    // handle quiz:v1:start, quiz:v1:waiting_room_status, etc.
  }
});
```

**Status:** ✅ Fixed — confirmed 50/50 VUs appearing in Live Monitor

---

## 15. Bug: Participants Stuck in Waiting Room

**Symptom:** k6 VUs connected successfully (appeared in Live Monitor waiting room) but never moved to IN QUIZ. `quiz:v1:start` never fired. Backend logs showed zero socket join events. Only `participantLogin` logs visible.

**Root cause:** `joinWaitingRoom()` in `quiz.service.ts` always added participants to the waiting room regardless of contest status. When a participant joined a contest that was already `LIVE`, they went to the waiting room and waited for a `CONTEST_START` BullMQ job — which had already fired once and was gone.

**Fix:** Added `START_IMMEDIATELY` fast-path in `joinWaitingRoom`:
```typescript
// After adding to waiting room, check if contest is already LIVE
const liveContest = await prisma.contest.findUnique({
  where: { id: contestId },
  select: { status: true },
});
if (liveContest?.status === "LIVE") {
  return { participantCount: count, status: "START_IMMEDIATELY" };
}
```

And in `quiz.gateway.ts` `handleJoin`, if status is `START_IMMEDIATELY`, call `startQuizForParticipant()` directly instead of sending the participant to the waiting room.

**Status:** ✅ Fixed in code. **Not yet deployed** to running containers during testing sessions.

---

## 16. Bug: CONTEST_START Job Enqueued to Wrong Redis

**Symptom:** Contest went LIVE at scheduled time (status changed to LIVE in DB) but no participants moved from waiting room to IN QUIZ. `quiz-timer-worker` never fired `CONTEST_START`.

**Root cause — Primary:** The `reset-contest.js` script was run from the developer's laptop via SSH tunnel. The tunnel connects to `localhost:5433 → RDS` for the DB, but for Redis it connects to `127.0.0.1:6379` on the admin EC2 — which is the **local Docker Redis container**, not ElastiCache.

The `go-live.sh` script had already switched the admin EC2's `REDIS_HOST` to ElastiCache. So the worker was listening to ElastiCache. But the job was sitting in the Docker Redis container. Two different Redis instances — the job was invisible to the worker.

**Root cause — Secondary:** `reset-contest.js` ran **before** `go-live.sh`. At that time ElastiCache didn't exist yet. Job went into the Docker Redis container (correct for idle mode). After `go-live.sh`, the admin switched to ElastiCache — but the Docker Redis container still had the job and nobody was listening to it anymore.

**Fix — Immediate (manual trigger):**
```bash
# Run inside the backend container on admin EC2
# Container has REDIS_HOST=ElastiCache endpoint in its env
docker exec quizbuzz_backend node /app/trigger-contest-start.js
```

**Fix — Permanent:**
1. `reset-contest.js` must run **inside the backend container** after `go-live.sh`, not from laptop:
```bash
docker exec -e CONTEST_ID=xxx quizbuzz_backend node /app/reset-contest.js
```
2. Added `redis-migrate.js` to `go-live.sh` — copies ALL Redis keys from Docker container → ElastiCache before switching `REDIS_HOST`.
3. Added `redis-migrate.js` to `go-idle.sh` — copies ALL Redis keys from ElastiCache → Docker container before destroying ElastiCache.

**Status:** ✅ Code fixed. Recurring in practice because correct workflow not yet habitual.

---

## 17. Bug: OOM Crash — Node.js Heap Exhaustion

**Symptom:**
```
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
Mark-Compact 1521.2 (1559.2) -> 1519.6 MB
```

Both ASG instances crashed simultaneously during Stage 1 (1000 users) and Stage 2 (2000 users).

**Root cause:** Node.js defaults to ~512MB heap. With 500 concurrent WebSocket connections per instance, each holding ~19KB of session/answer data, plus Redis pub/sub subscriptions, event listener closures, and BullMQ job state, heap filled and GC couldn't keep pace.

The `NODE_OPTIONS` env var was added to the Terraform `userdata.sh.tpl` but the **already-running instances** booted from the old launch template and never got the fix.

**Memory per participant breakdown:**
| Data | Size |
|---|---|
| Session hash (13 fields) | 0.9 KB |
| Answers hash (100 questions) | 14.5 KB |
| Question order list | 2.7 KB |
| Meta + readiness | 0.4 KB |
| Set membership | 0.1 KB |
| **Total per participant** | **~18.6 KB** |

**1000 participants × 18.6 KB × 2× Redis overhead = ~37 MB** — well within limits. The issue was Node.js heap holding all socket objects + closures + event listeners simultaneously.

**Fix — Terraform userdata:**
```bash
NODE_OPTIONS=--max-old-space-size=1536
```
Also increased container memory limit from `1G` to `2G`.

**Fix — Running instances (must do manually each time until new launch template takes effect):**
```bash
for IP in 10.0.20.191 10.0.21.106; do
  ssh -J ec2-user@65.1.26.101 ec2-user@$IP \
    "grep -q NODE_OPTIONS /app/.env || echo 'NODE_OPTIONS=--max-old-space-size=1536' >> /app/.env && \
     cd /app && docker compose up -d --force-recreate backend worker"
done
```

**Status:** ✅ Fixed in Terraform template. ⚠️ Must be applied manually to running instances until replaced.

---

## 18. Bug: DB Connection Pool Exhaustion

**Symptom:**
```
timeout exceeded when trying to connect - pg-pool/index.js:45
PrismaClientKnownRequestError: Operation has timed out
```

**Cause:** `DB_POOL_MAX=5` with 1000 VUs ramping in 30 seconds = ~33 login requests/second. Each login needs a DB connection. 5 pool connections × ~100ms each = max ~50 req/s theoretical, but with 1000 simultaneous requests the pool queue filled instantly and connections timed out.

**Fix:**
```diff
- DB_POOL_MIN=2
- DB_POOL_MAX=5
- DB_QUERY_TIMEOUT=5000
+ DB_POOL_MIN=5
+ DB_POOL_MAX=20
+ DB_QUERY_TIMEOUT=10000
```

**Also fix:** Slow the k6 ramp from 30s to 120s (`rampUpSeconds: 120`). At 1000 users over 120s = 8 new connections/second. Pool of 20 handles this comfortably.

**Status:** ✅ Fixed in Terraform template.

---

## 19. Bug: AUTO_SUBMIT Only Reads `active` SET

**Symptom:** After contest ended, only 140 of ~1200 in-quiz participants were submitted. The rest had no submission record.

**Root cause:** When ASG instances OOM crashed, Node.js died without running disconnect handlers. `markDisconnected()` was never called. Those ~1100 participants remained in the `disconnected` Redis SET (they were moved there by previous partial disconnect handling).

`handleTimeExpiry()` in `quiz.service.ts` only read from `active`:
```typescript
const activeIds = await this.session.getSetMembers(contestId, "active");
// disconnected SET never checked — ~1100 participants missed
```

**Fix:**
```typescript
const [activeIds, disconnectedIds] = await Promise.all([
  this.session.getSetMembers(contestId, "active"),
  this.session.getSetMembers(contestId, "disconnected"),
]);
const allIds = [...new Set([...activeIds, ...disconnectedIds])];
// Now submits ALL in-quiz participants regardless of connection state
```

**Status:** ✅ Fixed in code. Commit pushed.

---

## 20. Bug: RATE_LIMIT_WINDOW Wrong Units

**Symptom:** OTP rate limiter in `quiz-registration.routes.ts` had an effective window of 600 **milliseconds** instead of 600 **seconds**.

**Root cause:** Two different rate limiter instances existed:
- `middlewares/rate-limit.ts`: `windowMs: (config.rateLimit.window || 15 * 60) * 1000` ✅ (correctly multiplied)
- `quiz-registration.routes.ts`: `windowMs: config.rateLimit.window` ❌ (raw seconds, not converted to ms)

With `RATE_LIMIT_WINDOW=600`, the local limiter had a 600ms window — effectively unlimited for normal use but shows the misconfiguration.

**Fix:**
```typescript
windowMs: config.rateLimit.window * 1000  // was: config.rateLimit.window
```

Also fixed `RATE_LIMIT_WINDOW=60000` in both `admin_instance` and `live_contest` userdata templates → `RATE_LIMIT_WINDOW=600` (seconds).

**Status:** ✅ Fixed

---

## 21. Bug: ElastiCache Eviction Policy volatile-lru

**Symptom:** Worker logs constantly:
```
IMPORTANT! Eviction policy is volatile-lru. It should be "noeviction"
```

**Root cause:** The Terraform `aws_elasticache_parameter_group` defined `maxmemory-policy = noeviction` but the parameter group was **not linked** to the replication group. The `parameter_group_name` attribute was missing from `aws_elasticache_replication_group`.

With `volatile-lru`, Redis evicts keys with TTLs under memory pressure. BullMQ sets TTLs on some internal metadata keys — these could be evicted, silently corrupting queue state and losing jobs.

**Fix:**
```hcl
resource "aws_elasticache_replication_group" "redis" {
  # ... other config
  parameter_group_name = aws_elasticache_parameter_group.redis.name  # was missing
}
```

**Status:** ✅ Fixed in Terraform. Takes effect on next `go-live.sh` (ElastiCache is recreated).

---

## 22. Bug: NOT_REGISTERED Errors in k6

**Symptom:**
```
HTTP 403 — {"code":"NOT_REGISTERED","message":"You are not registered for this contest"}
```

Specific VU numbers repeatedly failing (28, 53, 115, 126, 130, 162, 182, 331, 380, 391, 433, 460, etc.)

**Root cause — Participants seeded for previous contest ID, new contest created with same slug:**
The RDS was cleared and re-seeded before each test. However the seed script resolves the contest by slug (`load-test-contest`) and stores participants against that contest's ID. When a new contest was created with the same slug after clearing the DB, it got a new ULID. If the seed ran against the old contest ID (e.g. from a cached env var or a previous run) and the k6 script logged in against the new contest ID, the backend correctly returned 403 — those emails existed as contacts but had no `Participant` record for the new contest.

**Root cause — k6 rapid cancel/restart:**
When Stage 1 was cancelled and Stage 2 immediately started, the `AWSALB` sticky session cookies from Stage 1 were still valid. Some VUs from Stage 2 got routed to instances where their participant sessions didn't exist.

**Fix — For next test:**
- Always seed against the specific new contest ID
- Verify with: `SELECT COUNT(*) FROM participants WHERE contestId = 'new-id'` → should be exactly 10,000
- Never reuse the slug across test sessions — use unique slugs like `load-test-2026-06-29`
- Don't cancel and restart stages — let each complete

**Status:** ⚠️ Process fix needed. No code change required.

---

## 23. Bug: k6 Question Structure Wrong

**Symptom:** Backend logs:
```
[QuizGateway:answer] SAVED ✓ | questionId=undefined | answeredCount=1/20
```

**Cause:** k6 script sent answer events with `questionId: undefined`. The script assumed `data.questionId` but `quiz:v1:start` returns `data.questions[0].id` (an array of all questions, not one at a time).

**Wrong:**
```javascript
if (eventName === "quiz:v1:start") {
  sendEvent(socket, "quiz:v1:answer", {
    questionId: data.questionId,  // undefined — doesn't exist at top level
    selectedOptionId: data.options[0].id,
  });
}
```

**Fix:**
```javascript
if (eventName === "quiz:v1:start") {
  const questions = data.questions || [];
  for (const question of questions) {
    sleep(randomThinkTime());
    sendEvent(socket, "quiz:v1:answer", {
      questionId: question.id,           // correct
      selectedOptionId: question.options[0].id,
    });
  }
}
```

**Status:** ✅ Fixed

---

## 24. Bug: File Descriptor Limit Not Set

**Symptom:** Not directly observed but identified as a risk. Linux default `ulimit -n` is 1024. Each WebSocket connection consumes 1 file descriptor. At 1000 connections + DB pool + Redis + log files, the limit could be hit silently causing connections to fail without clear errors.

**Fix added to ASG userdata:**
```bash
# Set before Docker starts so daemon inherits the limit
cat > /etc/security/limits.d/quizbuzz.conf << 'LIMITS'
* soft nofile 65536
* hard nofile 65536
LIMITS

ulimit -n 65536

mkdir -p /etc/systemd/system/docker.service.d
cat > /etc/systemd/system/docker.service.d/limits.conf << 'EOF'
[Service]
LimitNOFILE=65536
EOF

systemctl daemon-reload
systemctl restart docker
```

**Status:** ✅ Added to Terraform template. Not tested yet on running instances.

---

## 25. Recurring Issue: Redis Migration on Mode Switch

**The problem:**
```
IDLE MODE:  Admin EC2 → Redis Docker container (localhost:6379)
GO-LIVE:    ElastiCache created (empty) → admin switches to ElastiCache
            Jobs scheduled in Docker Redis → invisible to worker on ElastiCache
```

This caused CONTEST_START, AUTO_SUBMIT, and other lifecycle jobs to be lost on every mode switch.

**Solution implemented:**
- `redis-migrate.js`: copies ALL keys (not just BullMQ) using Redis `DUMP/RESTORE` with TTL preservation
- Called in `go-live.sh` BEFORE switching admin to ElastiCache
- Called in `go-idle.sh` BEFORE destroying ElastiCache
- Both directions covered: idle→live and live→idle

**Important:** `redis-migrate.js` runs **inside the backend container** via SSM — guaranteed to use correct `REDIS_HOST` from container env.

**Memory analysis:** Worst case 1000 participants × 18.6KB × 2 = ~37MB + BullMQ jobs ~17MB = **~54MB total**. Redis container has `maxmemory 256mb` → 4.8× headroom. Safe.

**Status:** ✅ Implemented. Not yet tested end-to-end on a full mode switch.

---

## 26. Recurring Issue: ASG Scale-Out Wrong Metric

**The problem:** ASG scale-out policy triggers on **CPU utilization at 60%**. WebSocket connections are memory and I/O bound, not CPU bound. At 500 connections, CPU reads ~20% while heap is at 95%. The ASG sees "no scaling needed" until the OOM crash causes a brief CPU spike — by then it's too late. New instance takes 7 minutes to become healthy (420s grace period).

**What the metric should be:**
- Memory utilization (requires CloudWatch Agent on instances)
- Or active WebSocket connection count (requires custom CloudWatch metric from backend)
- Or pre-warming based on registered participant count (best for known workloads)

**Recommended approach for QuizBuzz:**
```bash
# In go-live.sh — pre-warm based on participant count
INSTANCES=$(( (PARTICIPANTS + 799) / 800 ))
aws autoscaling set-desired-capacity \
  --auto-scaling-group-name quizbuzz-quiz-asg \
  --desired-capacity $INSTANCES
```

800 connections per instance (conservative for t3.medium with 1.5GB heap). For 1000 participants → 2 instances pre-warmed. For 2000 → 3 instances. No reactive scaling needed during quiz.

**Status:** ⚠️ Not yet implemented. Identified and documented.

---

## 27. Architecture Decision: Single Instance vs Live Infrastructure

**Question raised:** The QuestionPro article achieved 10,000 concurrent WebSocket users on a single 2-CPU 4GB server. Can QuizBuzz do the same and avoid the ALB + ASG + ElastiCache cost?

**Key difference:** QuestionPro's polling app had connections lasting 2-5 minutes (short-lived, cycling through). QuizBuzz connections are sustained for the full quiz duration (30 min to 2 hours). All 10,000 sockets open simultaneously for the entire duration — fundamentally harder.

**Realistic capacity estimates:**

| Instance | Connections | Memory for WS | Verdict |
|---|---|---|---|
| t3.medium (4GB) | ~1000-2000 | 37-74 MB data + heap | ✅ Comfortable |
| t3.medium (4GB) | ~5000 | ~185 MB data + heap | ⚠️ Possible, risky |
| t3.medium (4GB) | ~10000 | ~370 MB data + heap | ❌ CPU bottleneck |

**Decision:** Keep dual architecture. Use single admin instance for contests under ~2000 participants (no infrastructure cost). Spin up live infrastructure (ASG + ElastiCache) only for contests over 2000 participants.

**Monthly cost impact:**
- Always-on (admin only): ~$50-60/month
- Per contest day (live mode, 2 instances): +$14-20/day
- For 2 contests/month: ~$80-100/month total

**Status:** ✅ Decision made. Implementation straightforward (go-live.sh already supports participant count parameter).

---

## 28. Test Results Summary

### Session 1 — June 27, 2026

| Stage | VUs | Result | Blocker |
|---|---|---|---|
| Stage 0 (smoke) | 50 | ❌ 50% WS fail | Wrong Socket.IO protocol |

### Session 2 — June 28, 2026

| Stage | VUs | Result | Notes |
|---|---|---|---|
| Stage 0 | 50 | ✅ 50/50 IN QUIZ | Protocol fix worked |
| Stage 1 | 1000 | ⚠️ Partial | OOM at ~500 conn/instance |
| Stage 1 (retry) | 1000 | ⚠️ Partial | Heap fix not applied to running instances |
| Stage 2 | 2000 | ⚠️ Partial | OOM recurred, ~1323 peak IN QUIZ |

**Best numbers achieved:**
- Peak IN QUIZ: **1323 participants simultaneously**
- Submissions processed: **140** (rest lost to OOM + auto_submit bug)
- Worker chain: **Confirmed working** (submit → evaluate → leaderboard)
- WebSocket protocol: **Confirmed working**
- ElastiCache connectivity: **Confirmed working**
- Admin dashboard live monitor: **Confirmed working**

---

## 29. Outstanding Items

### Must Fix Before Next Test

| # | Issue | Priority | Status |
|---|---|---|---|
| 1 | Apply `NODE_OPTIONS=--max-old-space-size=1536` to running ASG instances before test | 🔴 Critical | Manual step needed |
| 2 | Run `reset-contest.js` inside backend container (not via laptop tunnel) | 🔴 Critical | Process fix |
| 3 | Seed all 10,000 participants against the NEW contest ID | 🔴 Critical | Process fix |
| 4 | Slow k6 ramp: `rampUpSeconds: 120` in stages.json Stage 1 | 🔴 Critical | Config change needed |
| 5 | Verify `NOT_REGISTERED` participants — check seeded contest ID matches current | 🔴 Critical | Verification step |

### Should Fix Before Production

| # | Issue | Priority | Status |
|---|---|---|---|
| 6 | ALB health endpoint returns 503 when instance at capacity | 🟡 High | Not implemented |
| 7 | ASG scale-out metric: switch CPU → memory or pre-warm | 🟡 High | Not implemented |
| 8 | Test `handleTimeExpiry` fix (disconnected SET included) | 🟡 High | Code fixed, untested |
| 9 | Test `START_IMMEDIATELY` fast-path for late joiners | 🟡 High | Code fixed, untested |
| 10 | Test `redis-migrate.js` on full mode switch | 🟡 High | Implemented, untested |
| 11 | Test ulimit fix on new ASG instances | 🟡 High | In template, untested |
| 12 | ElastiCache `noeviction` policy fix (parameter group linked) | 🟡 High | Fixed in Terraform |

### Nice to Have

| # | Issue | Priority |
|---|---|---|
| 13 | Custom CloudWatch metric for active WS connections | 🟢 Low |
| 14 | Single-instance test: Stage 1 (1000) and Stage 2 (2000) on admin EC2 only | 🟢 Low |
| 15 | `handleSummary` in k6 writing to results/ directory | 🟢 Low |

---

## Key Lessons Learned

1. **Redis has TWO instances in this architecture** — Docker container (idle) and ElastiCache (live). Any job scheduled before `go-live.sh` switches the admin to ElastiCache goes into the wrong Redis and is invisible to workers.

2. **Socket.IO EIO4 protocol is not plain JSON** — raw WebSocket clients must implement the full framing protocol including namespace connect packets and PING/PONG keepalive.

3. **OOM doesn't show CPU pressure first** — WebSocket load is memory-bound. CPU at 20% while memory at 95% means the ASG's CPU-based scale-out policy never fires in time.

4. **`handleTimeExpiry` must cover `disconnected` SET** — when instances crash without graceful shutdown, participants move to `disconnected` without being submitted. AUTO_SUBMIT must include both `active` and `disconnected`.

5. **Node.js default heap (512MB) is too small** — must set `NODE_OPTIONS=--max-old-space-size=1536` explicitly. t3.medium has 4GB RAM; giving Node 1.5GB heap is safe and prevents OOM at 1000+ connections.

6. **Pool size must match load** — `DB_POOL_MAX=5` is appropriate for the admin instance handling light traffic. ASG instances handling 1000 logins/second need `DB_POOL_MAX=20`.

7. **Pre-warm, don't react** — for known workloads (you know exactly how many participants registered), pre-set ASG desired capacity before the quiz starts. Reactive scale-out is always too slow for a quiz that lasts 60 minutes.

---

*Document generated: June 28, 2026*  
*Next test session: After all "Must Fix" items above are resolved*
