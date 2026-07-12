# QuizBuzz Engineering Knowledge Base — Load Testing & Live Infrastructure Session

**Scope note:** This document reconstructs only what is verifiable from the current chat session. It covers the load-testing and live-infrastructure-validation phase of the project (seed tooling, Socket.IO protocol debugging, OOM incidents, BullMQ/Redis mode-switch failures, ASG scaling behavior, and the Route53 conflict). Earlier architectural work referenced in passing (modular monolith structure, Provider Pattern, auth design, etc.) is *mentioned* in memory context but its reasoning, experiments, and decisions were not conducted in this conversation, so it is intentionally excluded rather than fabricated. Anything below is grounded in an actual exchange; where I'm inferring intent rather than quoting a stated fact, I've flagged it.

---

## 1. Session Context & Starting State

**Problem:** Validate whether QuizBuzz's live-contest infrastructure (ALB + Auto Scaling Group + ElastiCache) could support 10,000 concurrent WebSocket-connected quiz participants, and separately, whether a single admin instance could handle smaller contests without the cost of spinning up live infrastructure.

**Pre-existing system facts established early in the session:**
- Multi-tenant quiz platform, NestJS-style modular backend, Prisma ORM, PostgreSQL RDS, Redis (local Docker in idle mode / ElastiCache in live mode), BullMQ, Socket.IO.
- Two-mode infrastructure: *idle* (single admin EC2 t3.medium running all containers) and *live* (idle instance + ALB + ASG of t3.medium quiz instances + ElastiCache replication group), switched via `go-live.sh` / `go-idle.sh` Terraform wrapper scripts.
- A prior load-testing campaign (referenced via project memory, not re-derived in this session) had already produced a Stage-1 fix list: heap limits, DB pool sizing, worker circular-import fix, WS counter fix, NAT EIP leak fix.

This session's job was to actually **run** the tests, hit the next layer of bugs, and fix them.

---

## 2. Database Seeding — Performance Engineering

### 2.1 Original problem
Needed 10,000 `Contact` + `Participant` rows seeded against a specific contest for k6 to log in against. RDS sits in a private subnet, reachable only via SSH tunnel through the admin EC2's public IP.

### 2.2 Failed approach #1 — TypeScript via ts-node
**Symptom:** `Cannot find module '@prisma/client'`, `Cannot find module 'dotenv'`, implicit-`any` TS errors.
**Root cause:** Backend's `tsconfig.json` has `rootDir: ./src`, excluding the seed script (which lived in a sibling `load-testing/` directory) from compilation scope; `strict: true` flagged untyped params; `ts-node` wasn't a backend devDependency so `npx ts-node` pulled a version with no access to local `node_modules`.
**Attempted fixes, in order:**
1. `NODE_PATH` pointing at backend `node_modules` — fixed module resolution but not the tsconfig rootDir exclusion.
2. `--transpile-only --skip-project` flags on ts-node — bypassed type-checking and rootDir restriction entirely. This worked but was fragile.

### 2.3 Failed approach #2 — Prisma v7 engine mismatch
**Symptom:** `PrismaClientConstructorValidationError: Using engine type "client" requires either "adapter" or "accelerateUrl"`.
**Root cause:** Prisma v7 dropped the bundled Rust query engine; the project's Prisma version requires an explicit driver adapter.
**Fix:** Switched to `@prisma/adapter-pg`, passing a `pg.Pool` (or connection string) explicitly into `PrismaPg`.

### 2.4 Failed approach #3 — SSH tunnel networking
**Symptom:** `Test-NetConnection -ComputerName localhost -Port 5433` succeeded, but Prisma still timed out.
**Root cause:** Windows resolved `localhost` to `::1` (IPv6); the SSH tunnel was bound to `127.0.0.1` (IPv4) only.
**Fix:** Replace `localhost` with `127.0.0.1` explicitly in `DATABASE_URL`.

### 2.5 Failed approach #4 — Prisma interactive transactions over a high-latency link
**Symptom:** `Transaction API error: A rollback cannot be executed on an expired transaction. … 30239 ms passed` against a 30000ms timeout.
**Root cause:** Original script wrapped ~200 individual `upsert()` calls per batch inside a single `prisma.$transaction([...])`. Each upsert was a separate network round-trip over the SSH tunnel (~100ms latency observed). 200 × 100ms ≈ 20s+ before even accounting for query execution, blowing past the interactive-transaction timeout.
**Fix attempt A (intermediate):** Drop transactions, do individual sequential upserts with progress logging. This *worked* but was catastrophically slow.

### 2.6 The 42-minute seed problem — root cause analysis
**Measured result:** 10,000 participants took **42 minutes** to seed.
**Diagnosis performed:** Broke the cost down explicitly:
| Factor | Impact |
|---|---|
| 3 sequential DB round-trips per batch (upsert contacts → re-fetch IDs → upsert participants) | 50 batches × 3 = 150 sequential network calls |
| Individual `upsert()` per record inside per-batch `$transaction()` | No bulk SQL path — N statements instead of 1 |
| Batch size 200 | 50 batches → high per-batch overhead |
| Fully sequential, zero concurrency | No parallelism between batches |

**Fix implemented:**
- Replaced Prisma's row-by-row upserts with hand-built bulk `INSERT … VALUES (…),(…),… ON CONFLICT DO NOTHING` statements, executed via a **raw `pg.Pool`**, not Prisma's `$executeRawUnsafe`.
- Batch size raised to 500, with 4 batches running concurrently (`CONCURRENT_BATCHES=4`).
- `registrationRef` generation changed from `QB-${Date.now().toString(36)}-${emailSlice}` to a fully deterministic `QB-LOAD-${String(i).padStart(6,'0')}` keyed off the participant's loop index.

**Result:** 10,000 records in **4.1 seconds** locally; **~15–25 seconds** estimated/observed over the SSH tunnel to RDS — roughly a **630× improvement**.

### 2.7 Why `$executeRawUnsafe` specifically had to be abandoned
**Symptom:** `Raw query failed. Code: 08P01. bind message supplies 1503 parameters, but prepared statement "" requires 3`.
**Root cause:** When a query mixes a small set of "anchor" parameters (`$1`, `$2`, `$3`) with a large dynamically-built `VALUES` table (`$4…$1503`), Prisma's `@prisma/adapter-pg` layer mis-binds them — it appears to treat the anchors and the VALUES placeholders as belonging to different prepared-statement contexts. The pg driver itself handles large parameter arrays correctly; the bug is specifically in Prisma's raw-unsafe parameter counting.
**Fix:** Bypassed Prisma's `$executeRawUnsafe` entirely for bulk operations. Used `pool.connect()` → `client.query(sql, paramsArray)` directly. This is a durable lesson: **for bulk parameterized SQL, go around the ORM's raw-query layer, not through it.**

### 2.8 registrationRef collision under concurrency
**Symptom:** `duplicate key value violates unique constraint "participants_registrationRef_key"` (Postgres code `23505`).
**Root cause:** The original ref generator used `Date.now().toString(36)` as a uniqueness component. With 4 concurrent batches executing within the same millisecond, and some seeded emails sharing trailing digits (e.g. `loadtest00001` / `loadtest10001` both ending `0001`), two different rows could compute an identical ref.
**Fix:** Replaced timestamp-based uniqueness with pure index-based determinism: `QB-LOAD-000001` … `QB-LOAD-010000`. No randomness, no timestamp, no possible collision — uniqueness is guaranteed by the loop index itself.
**Lesson:** Timestamp-based "uniqueness" is not safe once you introduce concurrency at sub-millisecond granularity. Prefer deterministic, index-derived keys whenever the domain allows it.

---

## 3. Contest Reset Tooling — A Recurring Source of Production Bugs

### 3.1 The original need
A way to reset a load-test contest's `startTime`/`endTime`/`registrationDeadline` and flip its status back to `PUBLISHED` between test runs, without manually editing rows.

### 3.2 First implementation and its failures
- First attempt used `prisma.contest.update({ where: { slug: "load-test-contest" } })` — failed because Prisma's generated `ContestWhereUniqueInput` doesn't expose `slug` as a unique-enough field (`Argument 'where' of type ContestWhereUniqueInput needs at least one of 'id' or 'organizationId_slug'`). Fixed by switching to `where: { id: <contestId> }`.
- A subsequent run hit `User was denied access on the database 'quizbuzz'` even though `Test-NetConnection` reported the tunnel port open — diagnosed as the SSH tunnel having silently dropped/reused while the TCP listener stayed bound locally; the actual RDS-side session was gone. Fix was operational: kill stale `ssh` processes and re-open a fresh tunnel before retrying, and explicitly re-print `$env:DATABASE_URL` to confirm it pointed at the tunnel, not the raw RDS endpoint.

### 3.3 The deeper architectural bug this surfaced: two Redis instances, one mental model
This is the most important recurring failure of the whole session and deserves its own root-cause writeup.

**Symptom chain (appeared repeatedly across multiple test attempts):**
- Contest correctly flips to `LIVE` in the database (status field updated, dashboard shows "● LIVE").
- Participants who join via k6 land in the Waiting Room and **never** transition to "IN QUIZ."
- Backend logs show zero `quiz:v1:start` emissions, zero `CONTEST_START` job processing.
- Manually re-running the reset script does **not** fix it.

**Root cause, fully diagnosed by the user mid-session (and confirmed):**
> "I think the job to start the quiz must have been lost because I had scheduled it around two hours before the test. At that time, it was running on the admin instance, and it was running on the Redis container that was on the admin instance… Later on, when we spun up the infrastructure and used Elastic Cache, the admin also switched to using Elastic Cache… maybe that quiz [job] was still left in that Redis over there and not over here."

This diagnosis was correct. The architecture has exactly two distinct Redis backends depending on mode:
```
IDLE MODE:  REDIS_HOST → local Docker Redis container on the admin EC2
LIVE MODE:  REDIS_HOST → ElastiCache replication group endpoint
```
`go-live.sh` performs a `terraform apply` (creating ElastiCache) and **then** rewrites the admin instance's `.env` to point `REDIS_HOST` at ElastiCache and force-recreates its containers. Any BullMQ job enqueued **before** that switch — including via the reset/SSH-tunnel script, which connects directly to `127.0.0.1:6379` on the admin EC2 (the local container) regardless of what mode the system is currently in — is invisible to every worker that subsequently boots against ElastiCache. The job isn't lost in the sense of being deleted; it's stranded in a Redis instance nobody is listening to anymore.

**Immediate/manual remediation used during live testing:** A one-off `trigger-contest-start.js` was written and copied into the running `quizbuzz_backend` container via `docker cp` + `docker exec`, deliberately reading `REDIS_HOST` from the **container's own environment** (guaranteeing it talks to whichever Redis is currently authoritative) and enqueuing a fresh `CONTEST_START` BullMQ job with `delay: 0`. This was used at least twice in the session to manually unstick a stalled contest.

**Permanent fix implemented:**
- `reset-contest.js` was rewritten to enqueue the **full BullMQ lifecycle** for a contest — `CONTEST_START`, three `TIME_WARNING` jobs (10/5/1 minutes before end), `AUTO_SUBMIT`, and `AUTO_DECLARE_RESULTS` — rather than only mutating database rows and leaving job scheduling to whatever mechanism originally published the contest.
- The process rule established: **run `reset-contest.js` only after `go-live.sh` has completed**, and run it via `docker cp` + `docker exec` into the live `quizbuzz_backend` container — never via the laptop's SSH tunnel — so it inherits the container's `REDIS_HOST` and is guaranteed to write into the same Redis the workers are reading from.
- A second, more general tool (`redis-migrate.js`) was built per the user's explicit request to make mode-switches loss-proof at the infrastructure level rather than relying on operational discipline alone (see Section 5).

**Lesson, stated plainly:** Any system with a "two backends depending on mode" architecture needs either (a) a single source of truth for *which* backend is authoritative that every script consults, or (b) automatic data migration at the mode-switch boundary. Discipline ("always remember to run X after Y") fails under time pressure — and this session repeatedly proved it, including after the permanent fix had already been designed but before it had been applied to a fresh `go-live.sh` run.

---

## 4. Socket.IO / WebSocket Protocol Debugging — k6 Load Test Client

### 4.1 Original problem
k6's native `ws` module is a raw WebSocket client with no Socket.IO awareness. The first version of the test script sent plain JSON over the socket (`socket.send(JSON.stringify({event: "quiz:v1:join", data: {...}}))`).

### 4.2 Symptom and diagnosis
- k6 reported `ws_connect_success_rate: 0.5` (50%) against a >99% threshold.
- Admin Live Monitor showed **0 participants** despite k6 logs showing open connections.
- Backend logs showed zero `quiz:v1:join` events received.

**Root cause:** Socket.IO does not speak plain JSON over the raw WebSocket transport — it uses its own Engine.IO v4 (EIO4) text-framing protocol layered on top of the WebSocket, plus a separate per-namespace handshake. The server's Socket.IO layer was silently ignoring every message because it didn't match the expected frame format. The backend also used a non-default namespace (`/participant`), which requires its own explicit `CONNECT` packet after the engine-level handshake — connecting to the default `/` namespace (which is what k6 was implicitly doing) is not equivalent.

**Confirmed via manual `curl` WebSocket handshake test:**
```
GET /socket.io/?EIO=4&transport=websocket HTTP/1.1
Upgrade: websocket
...
< HTTP/1.1 101 Switching Protocols
...
{"sid":"F8N38MzXmfYrax7rADsG","upgrades":[],"pingInterval":25000,"pingTimeout":20000,"maxPayload":2000000}
```
This confirmed the **infrastructure** (ALB routing, TLS termination, WebSocket upgrade) was entirely healthy — the failure was purely in the application-layer protocol the k6 script was speaking.

### 4.3 The correct EIO4 + Socket.IO wire protocol, as reverse-engineered and implemented
```
1. Raw WS opens.
2. Server sends EIO "open" packet:           0{"sid":"...","pingInterval":25000,...}
3. Client must reply with a namespace CONNECT packet, including auth payload:
                                              40/participant,{"token":"<jwt>"}
4. Server ACKs the namespace:                40/participant,{"sid":"..."}
5. Only now can application events be sent:  42/participant,["quiz:v1:join",{...}]
6. Server emits application events the same way:
                                              42/participant,["quiz:v1:start",{...}]
7. Engine-level keepalive: server sends "2" (PING) periodically; client must reply "3" (PONG)
   or the connection is dropped as stale.
```
The k6 script's `runQuizSession()` function was rewritten from scratch to implement this state machine explicitly (tracking `namespaceAcked` before allowing any application-level send, branching on the `4`-prefixed Engine.IO message-type byte, and replying to PING with PONG).

**Result after fix:** Confirmed via Live Monitor screenshot — 50/50 k6 virtual users appeared as "IN QUIZ" simultaneously, each independently answering and progressing through their question set. This was the first fully clean smoke test (Stage 0) of the session.

### 4.4 Secondary bug surfaced once the protocol was fixed: wrong event payload shape
**Symptom:** Backend logs showed `[QuizGateway:answer] SAVED ✓ | questionId=undefined | answeredCount=1/20` — answers were being accepted but with no question identifier.
**Root cause:** The `quiz:v1:start` server event delivers the **entire question set at once** as `{ questions: [...] }`, not one question per event with a flat `data.questionId`/`data.options` shape. The k6 script had assumed a single-question-per-event model that did not match the actual API contract.
**Fix:** Rewrote the handler to iterate `data.questions`, sending one `quiz:v1:answer` event per question with the correct `questionId` pulled from each array element, with think-time sleep between each.
**Lesson:** A successful connection and a successful protocol handshake do not guarantee the payload contract is correct — these are two independently-verifiable layers, and this bug only became visible once the lower layer was fixed and logs could finally show what was happening at the application layer.

### 4.5 Rate-limiting collision specific to single-origin load testing
**Symptom:** `HTTP 429 — "Too many OTP requests. Please try again later."` on essentially every `participant-login` call once VU count rose.
**Root cause:** `otpLimiter` middleware (5 requests / window / IP) was attached to the `participant-login` route even though that route does **not** require OTP verification (participant identity was already established at registration time — `quiz-auth.service.ts`'s `participantLogin()` explicitly bypasses OTP checks). Because k6 runs from a single laptop, every one of 1000+ virtual users shared one source IP, so the limiter exhausted almost instantly regardless of real load characteristics.
**Fix:** Removed `otpLimiter` from the `participant-login` route entirely — it was logically misapplied, not just operationally inconvenient for testing.
**Secondary bug found during the same audit:** A *separate, locally-defined* `otpLimiter` instance inside `quiz-registration.routes.ts` computed `windowMs: config.rateLimit.window` directly, without the `* 1000` multiplication present in the canonical limiter in `middlewares/rate-limit.ts`. Since `RATE_LIMIT_WINDOW` is configured in seconds, this meant the local limiter's actual window was 600 **milliseconds**, not 600 seconds — a real correctness bug, independent of the load-test context, that was only discovered because of a manual side-by-side audit of every rate limiter in the codebase prompted by the 429s. Fixed by aligning units. The same incorrect raw-seconds value (`60000`, clearly meant as milliseconds by whoever wrote it) was found hardcoded in **both** the admin-instance and live-contest Terraform userdata templates and corrected to `600`.

---

## 5. The "Two Redis Instances" Problem, Generalized — Redis Migration Tooling

### 5.1 The user's design question (verbatim reasoning, paraphrased)
After the `CONTEST_START`-lost-in-the-wrong-Redis incident was diagnosed, the user asked, in effect: rather than relying on remembering to run scripts in the right order, can the infrastructure itself guarantee no data is lost on a mode switch — i.e., before `go-idle`/`go-live` tears anything down, copy whatever is currently in the *source* Redis into the *destination* Redis automatically?

### 5.2 Initial scope decision and a course-correction
**First implementation** scoped the migration narrowly to BullMQ's own key namespace (`*:bull:*`), reasoning that quiz session state in Redis has short TTLs and "expires naturally," so only job-queue data needed protecting.

**User pushed back with a concrete failure scenario:** if the operator runs `go-idle.sh` shortly after a contest ends — before the submission worker has had time to drain Redis-held answer payloads into Postgres — a participant's full set of in-memory answers (which exist in Redis specifically because the submit flow optimistically acknowledges the user immediately and processes the DB write asynchronously via a queued job) could be sitting in Redis with no corresponding BullMQ job yet, or with a job that itself depends on session keys with a different prefix.

**Resulting decision:** broadened the migration to copy **all** Redis keys under the relevant prefix, not just `*:bull:*` — explicitly described in-script as "BullMQ job data, participant session state, and saved answers," with shorter-TTL keys (OTP, heartbeats) considered harmless to copy redundantly since they'll simply expire on their own in the destination.

### 5.3 Final implementation (`redis-migrate.js`)
- Standalone Node script taking `--from <host:port> --to <host:port> [--pattern] [--execute]`.
- Defaults to **dry-run** unless `--execute` is explicitly passed — printing a sample of keys and a per-queue-prefix breakdown of what *would* be migrated, as a safety gate against accidentally running it destructively.
- Uses Redis `DUMP` / `RESTORE` (not `GET`/`SET`) specifically to preserve exact value types (hashes, sets, lists) and original TTLs without needing per-type-aware copy logic.
- Restore is intentionally non-destructive toward the destination: if a key already exists there (`BUSYKEY` error), it's counted as "skipped," not overwritten — migration is additive/idempotent, not a destructive sync.
- Wired into both `go-live.sh` (runs *after* ElastiCache is created by Terraform but *before* the admin instance's `REDIS_HOST` is rewritten) and `go-idle.sh` (runs *before* ElastiCache is destroyed), in both cases executed via `aws ssm send-command` that base64-encodes the script, decodes it onto the admin EC2, `docker cp`s it into the running `quizbuzz_backend` container, and runs it there with `node` — guaranteeing it always uses the container's actual current `REDIS_HOST` rather than a value assumed by whoever is running the migration from their laptop.

### 5.4 Capacity sizing analysis performed for this mechanism
Given the user's explicit ask — "check if the container running the Redis container has enough memory… let's assume it should at least store more than 1,000 users' ready submissions, 100 questions each" — a from-scratch memory budget was computed (not estimated loosely):

Per-participant Redis footprint, broken down by actual data structure:
| Structure | Approx. size |
|---|---|
| Session hash (13 fields: phase, seed, timestamps, etc.) | ~0.9 KB |
| Answers hash (100 questions × {selectedOptionId, answeredAt, optionText}) | ~14.5 KB |
| Question-order list (100 ULIDs) | ~2.7 KB |
| Meta hash (name, contactId) | ~0.2 KB |
| Readiness hash (otp/camera/joincode flags) | ~0.2 KB |
| Set memberships (active/waiting/submitted/disconnected) | ~0.1 KB |
| **Total per participant** | **~18.6 KB** |

For 1,000 participants: ~37 MB of session+answer data (including a 2× allocator-overhead factor), plus ~17 MB of estimated BullMQ submission+evaluation job payloads — **~54 MB worst case**.

Cross-checked against the actual Redis container configuration discovered in the admin-instance userdata template (`--maxmemory 256mb --maxmemory-policy noeviction`, already present from earlier project work, not introduced this session): **256 MB ÷ 54 MB ≈ 4.8× headroom** even in the theoretical worst case of migrating immediately after a crash with zero jobs yet processed. In the realistic case — where workers typically clear submission/evaluation jobs within seconds and TTL'd session keys have started expiring — actual data volume at a typical `go-idle` time was assessed as well under 10 MB.

**Conclusion reached and stated to the user:** the existing 256 MB limit is sufficient with comfortable margin for the tested scale; no change to the container's memory ceiling was made.

---

## 6. Production Incident: Out-Of-Memory Crashes on Live Quiz Instances

### 6.1 First occurrence
**Symptom (raw logs captured):**
```
<--- Last few GCs --->
[1:0x7fe1464b3650]  3213593 ms: Mark-Compact 499.1 (522.0) -> 498.1 (522.0) MB, ...
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
```
Occurred on **both** ASG instances simultaneously during a Stage 1 (1000-user) run, accompanied by mass WebSocket disconnects (`websocket: close 1005 (no status)`) and `participant-login` request timeouts on the ALB-fronted instances.

### 6.2 Root-cause investigation
1. **Heap math performed:** at the previously-computed ~18.6 KB/participant, 500 concurrent connections on one instance is only ~9.3 MB of *application data* — nowhere near a typical Node.js default heap ceiling. The crash could not be explained by session-state size alone.
2. **Default Node.js heap identified as the actual ceiling:** Node.js' V8 default `--max-old-space-size` is roughly 512 MB unless explicitly overridden. With Socket.IO socket objects, per-connection Redis pub/sub subscriptions, event-listener closures, and per-connection BullMQ-adjacent state all living on the heap alongside the ~9 MB of "real" data, the default ceiling was being hit well before connection count alone would predict.
3. **Confirmed the fix had been specified in Terraform but not yet deployed:** `NODE_OPTIONS=--max-old-space-size=1536` had been added to the `live_contest` userdata template, but the **already-running** ASG instances had booted from the prior launch template version before that change existed — Terraform updating the template does not retroactively change instances already in service.

### 6.3 Fix, applied at two levels
- **Immediate/operational:** SSH-jumped through the admin EC2 into each private-subnet ASG instance and appended `NODE_OPTIONS=--max-old-space-size=1536` to the running container's `.env`, then `docker compose up -d --force-recreate backend worker` to apply it without a full instance replacement.
- **Permanent/infrastructure:** Terraform userdata template updated (already in progress before the second crash) to bake the heap flag in from first boot, plus container memory limit raised from `1G` to `2G` in the same compose block, on the reasoning that t3.medium's 4 GB total RAM split across backend (2G), worker (1G), leaves ~1G for OS/Docker overhead — sized deliberately, not arbitrarily.

### 6.4 Second occurrence — heap fix didn't fully prevent recurrence
Even after the heap-size fix was applied, a second OOM was observed on a subsequent test run, heap reported around **1521 MB** — just under the 1536 MB ceiling, meaning the limit itself wasn't the bug this time; GC simply couldn't reclaim memory fast enough once approaching the ceiling under sustained load (`Mark-Compact … allocation failure; scavenge might not succeed` appearing repeatedly in the GC log immediately before the fatal error). This was correctly read as a symptom of genuine sustained memory pressure, not a misconfiguration — i.e., the *system* was actually handling more simultaneous load than the heap ceiling, the question count per participant, and instance count combination could sustain, which is a capacity-planning finding, not a config bug.

### 6.5 Compounding root cause discovered alongside the second OOM: DB connection pool exhaustion
**Symptom (same crash window):**
```
timeout exceeded when trying to connect - pg-pool/index.js:45
PrismaClientKnownRequestError: Operation has timed out
```
**Root cause:** `DB_POOL_MAX=5` (a value appropriate for the lightly-loaded admin instance) was also being used on ASG quiz instances handling rapid `participant-login` traffic. At k6's original Stage-1 ramp profile (1000 VUs in 30 seconds ≈ 33 new logins/sec, each requiring a DB round-trip), a 5-connection pool queues almost everything immediately, and requests pile up until they exceed `DB_QUERY_TIMEOUT`.
**Fix:** `DB_POOL_MIN=2/DB_POOL_MAX=5/DB_QUERY_TIMEOUT=5000` → `DB_POOL_MIN=5/DB_POOL_MAX=20/DB_QUERY_TIMEOUT=10000` in the live-contest userdata template. Paired with a **process** recommendation (see Section 8) to also slow the k6 ramp profile itself rather than relying on pool size alone to absorb arbitrarily steep connection ramps.

### 6.6 Downstream data-integrity consequence of the OOM crashes: AUTO_SUBMIT undercounting
**Symptom:** After a contest ended and `AUTO_SUBMIT` ran, only **140** of an observed peak of **~1,323** "IN QUIZ" participants ended up with submission records.
**Root cause, fully traced through the code:** `handleTimeExpiry()` (invoked by the `AUTO_SUBMIT` BullMQ job) read participant IDs to force-submit **only from the Redis `active` SET**. When an ASG instance OOM-crashes, the Node.js process dies abruptly with no graceful shutdown — the socket `disconnect` handler that normally calls `markDisconnected()` (moving a participant from the `active` SET into a `disconnected` SET) never runs for any connection that was live at the moment of the crash, **and** for connections that *had* already disconnected cleanly before the crash (i.e., were already correctly in the `disconnected` SET from an earlier, unrelated reconnect cycle), `handleTimeExpiry()` simply never looked at that set at all. Either way, any participant sitting in `disconnected` instead of `active` at the moment AUTO_SUBMIT ran was silently skipped — their in-progress answers, which were still present in Redis, were never persisted to Postgres.
**Fix implemented:**
```typescript
const [activeIds, disconnectedIds] = await Promise.all([
  this.session.getSetMembers(contestId, "active"),
  this.session.getSetMembers(contestId, "disconnected"),
]);
const allIds = [...new Set([...activeIds, ...disconnectedIds])];
```
Batched into groups of 50 with `Promise.allSettled` to avoid overwhelming Redis with one giant burst, each ID independently routed through the existing `submitQuiz(contestId, pid, "TIMEOUT")` path so a single participant's failure doesn't abort the batch.
**Lesson, stated explicitly in conversation:** "if we did not trigger the start of the quiz, it would not have triggered also the end of the quiz" — the user correctly generalized from one missing-trigger incident to predict a symmetric class of bug before it was even confirmed in code, which is exactly what the audit then found.

---

## 7. ASG Scaling Behavior — Diagnosed Live, Mid-Incident

### 7.1 The observed failure
During a test run, a third ASG instance *did* eventually launch, but came up too late — by the time it reached "Initializing"/healthy, the two original instances had already OOM-crashed and dropped connections, and the admin dashboard itself became unresponsive ("context not found," described as the database being exhausted from the user's vantage point).

### 7.2 The user's diagnostic question, and the answer derived
> "What is the threshold when the new instance is spun up? Is it because the script is running too fast?"

**Root cause identified:** The ASG's scale-out policy triggers on **CPU utilization crossing 60%**. WebSocket-connection load for this workload is fundamentally **memory- and I/O-bound, not CPU-bound** — with participants spending 10–30 seconds "thinking" between answers, an instance holding 500 idle-but-open sockets shows perhaps 15–20% CPU while its heap is already at 90%+. The CPU-based alarm simply never fires until GC thrashing itself causes a brief CPU spike — by which point the crash has effectively already happened. Compounding this, the ASG's health-check grace period (`420s` / 7 minutes) means even a correctly-triggered scale-out can't possibly help during a quiz session shorter than ~7 minutes from trigger to relief.

### 7.3 Solutions discussed (not all implemented — see Section 9 outstanding items)
Three approaches were laid out with explicit tradeoffs:
- **Option A — memory-based CloudWatch alarm** replacing/supplementing the CPU alarm, via CloudWatch Agent publishing `mem_used_percent`, threshold ~70%. Most direct fix for the actual bottleneck, but requires the agent to be installed and configured.
- **Option B — custom WebSocket-connection-count metric**, published from inside the backend itself (`io.engine.clientsCount`) to CloudWatch every ~30s, scaling out at e.g. 800/1000 connections per instance — the most *accurate* signal since it's the literal resource being exhausted, at the cost of needing application-level instrumentation.
- **Option C — pre-warming based on known registered-participant count**, calculated in `go-live.sh` itself (`INSTANCES = ceil(PARTICIPANTS / 800)`, then `aws autoscaling set-desired-capacity`) — reasoned as the *best fit specifically for this product*, since unlike a generic web service, the operator always knows participant count in advance (it's a closed-registration quiz) and reactive autoscaling is structurally too slow for a session lasting under an hour. This was the option ultimately recommended as primary, with the CloudWatch-based approaches as defense-in-depth rather than the first line.

### 7.4 A second, related architectural question raised and answered: why doesn't the instance just refuse new connections itself?
**User's question, paraphrased:** rather than depending entirely on the ALB's external health check to *infer* instance distress, why can't the instance proactively tell the load balancer "I'm full" and have the ALB route elsewhere?

**Answer developed:** ALB target-group health checks are a single binary HTTP-200-or-not signal, polled on an interval (here, 15s) — there is no separate notion of "alive but not accepting new work" (the liveness/readiness distinction Kubernetes has natively). A `/health` endpoint that merely checks "is the process responding" can return 200 from a process that is technically alive but functionally saturated, because health checks are cheap/fast and can sneak through even while real request-handling is failing.

**Design proposed (not yet implemented in code during this session — captured as a recommendation):**
- Have `/health` itself compute and report capacity signals — active WS connection count vs. configured max, heap-used percentage, DB pool queue depth — and return **HTTP 503** once any threshold is crossed, which the ALB target-group health check natively interprets as "stop sending new traffic here," while existing sticky connections continue draining normally rather than being abruptly cut.
- Explicitly flagged the nuance that a single combined health endpoint conflates *liveness* (should I be replaced?) and *readiness* (should I get new traffic?) — ALB doesn't natively support the two-endpoint pattern Kubernetes uses, so the pragmatic compromise discussed was requiring **3 consecutive failed checks** (not the default 2) before deregistration, to avoid a brief, recoverable GC pause from triggering an unnecessary and disruptive deregistration.
- This remains a **documented recommendation, not a shipped fix**, by the end of the session.

---

## 8. Load-Test Methodology Lessons (k6-specific)

### 8.1 Sticky sessions were found disabled
Discovered via AWS console screenshot during incident triage: the quiz target group's `TargetGroupStickinessConfig` showed `Enabled: False`. Combined with the OOM-crash analysis, this was identified as a contributing factor to uneven load redistribution after a crash — without stickiness, reconnecting clients can land anywhere, and a thundering-herd of reconnects from one dead instance can pile onto a still-healthy one rather than being absorbed gradually. Enabling ALB cookie-based stickiness (`lb_cookie`, 86400s duration) was recommended as a companion fix to the scaling-trigger work in Section 7, on the reasoning that even though Socket.IO's Redis adapter makes session state technically shareable across instances, the *failure mode during a crash* still benefits from predictable, gradual reconnect distribution rather than an all-at-once pile-on.

### 8.2 Stage cancel/restart pattern identified as actively harmful
Observed directly: the user ran Stage 1 (1000 VUs), let it partially complete, cancelled it, started Stage 2 (2000 VUs), cancelled again, and re-ran — explicitly described as deliberate experimentation ("I did it just to test the system and how far it goes"). This was diagnosed as compounding the instability: ALB target-group `deregistration_delay` was configured at 300 seconds (5 minutes), meaning cancelled-but-still-draining connections from one run overlap with fresh connections from the next, pushing both instances well past their intended per-instance connection target simultaneously. **Recommendation given:** treat each stage as atomic — let it complete or fully tear down (`go-idle`/`go-live`) between attempts, never cancel-and-immediately-restart.

### 8.3 Ramp speed and DB pool sizing are coupled, not independent variables
Connected directly to Section 6.5: the original `stages.json` Stage 1 used a 30-second ramp to 1000 users (~33 logins/sec). Even after raising `DB_POOL_MAX` to 20, the recommendation was also to slow the ramp profile itself (30s → 120s, ≈8 logins/sec) — reasoning explicitly stated that increasing pool size alone treats only the symptom; an arbitrarily steep ramp can still outrun any fixed pool size, whereas matching ramp speed to realistic registration-opening behavior (participants trickling in over minutes, not all logging in within 30 seconds) is both more realistic *and* inherently gentler on every downstream resource.

### 8.4 The `NOT_REGISTERED` failure class and its actual cause
Initially the user suspected their own laptop/network as the cause of mass `403 NOT_REGISTERED` errors mid-run. Diagnosed instead as a **seed/contest-ID mismatch**: the RDS was cleared and reseeded between sessions, but the seed script resolves the target contest by `slug`, and a freshly-created contest with a reused slug gets a new database ID (ULID) — so if seeding ran against a stale/cached contest ID (or against the contest that existed *before* the most recent reset) while k6 logged in against the *current* contest, previously-valid participant emails would correctly receive a 403, because they had a `Contact` row but no `Participant` row tied to the new contest's ID. **Verification step prescribed going forward:** explicitly query `participant.count` filtered to the specific contest ID immediately before running k6, rather than trusting that "the seed ran recently" implies it targeted the currently-active contest.

---

## 9. Infrastructure-as-Code Issues Encountered During `go-live`/`go-idle` Cycling

### 9.1 Stale Terraform state lock
**Symptom:** `Error acquiring the state lock … ConditionalCheckFailedException`.
**Cause:** A terminal was closed mid-`apply`, leaving a DynamoDB lock-table row that nothing ever released.
**Fix:** `terraform force-unlock <lock-id>` — used at least twice across the session, both times after an interrupted run.

### 9.2 HTTPS listener silently absent from the ALB
**Symptom:** `https://ysmquizbuzz.com` timed out entirely even though the ALB itself showed `Active` and an HTTP:80 listener (redirecting to 443) existed.
**Root cause:** A prior `terraform apply` had failed partway through creating the `aws_lb_listener.https` resource and its associated listener rules (`websocket`, `api`, `frontend`) and `aws_acm_certificate_validation` — these resources existed in *intent* but were never actually created, and critically, were also **absent from Terraform state entirely** (confirmed by parsing the state file directly and finding zero `aws_lb_listener*` resources). This meant a plain `terraform apply` would attempt to *create* them fresh.
**Complication:** one of the dependent resources — a Route53 CNAME used for ACM domain validation — *did* already exist in AWS (left over from an earlier, also-partial apply), so a naive `apply` failed again with `InvalidChangeBatch: … already exists`. Resolved by explicitly `terraform import`-ing that specific record into state before re-running `apply`, after which the plan cleanly showed "6 to add, 0 to change, 0 to destroy" and succeeded.
**Lesson:** when Terraform state and real-world AWS state diverge because an apply was interrupted, `terraform plan` is the correct first diagnostic step (used explicitly, on request, before applying) — and `import` is the right tool for adopting orphaned-but-real resources rather than fighting them via destroy/recreate.

### 9.3 Recurring `aws_route53_record … already exists` on the idle-mode A record
**Symptom (end of session, explicitly the next item flagged for fixing):**
```
Error: creating Route53 Record: ... InvalidChangeBatch: [Tried to create resource record set
[name='ysmquizbuzz.com.', type='A'] but it already exists]
with module.dns.aws_route53_record.api_idle[0]
```
**Diagnosis in progress at end of session:** the `dns` module's `aws_route53_record.api_idle` resource is written as a plain `count`-gated create (`count = var.is_live ? 0 : 1`) with no corresponding state-import or data-source lookup — so any time the *real* AWS record already exists (e.g., from manual console intervention, a prior apply that succeeded at the AWS layer but failed to persist state, or simply re-running `go-idle` when the record was never destroyed in between) Terraform has no way to reconcile and instead tries a hard create, which AWS correctly rejects. The user's explicit request — to make `go-live`/`go-idle` **fetch/adopt** the existing record rather than attempt to (re-)create it — points toward either (a) converting the resource to use `import` as part of the wrapper scripts' pre-flight, or (b) restructuring the resource with a `terraform import`-friendly lifecycle, or (c) using a `data "aws_route53_record"` lookup combined with conditional logic to skip creation when a matching record is found. **This was the open item the session ended on; no fix had yet been written.**

---

## 10. Other Terraform/Application Config Bugs Found Via Direct Code Audit

These were not discovered through a runtime symptom but through an explicit, requested cross-verification pass ("Cross verify everything is correctly done in the script or not") after the OOM/scaling incidents, treating it as a checklist exercise rather than reactive debugging:

- **`COOKIE_DOMAIN=.ysminfosolution.com`** hardcoded in the live-contest userdata template — a leftover from the project's prior domain (`ysminfosolution.com`) before migration to `ysmquizbuzz.com`. This specifically broke admin-dashboard login when traffic was routed through the ALB to ASG instances (the `/api/*` listener rule sends *all* API traffic, including admin auth, to the quiz target group, not the admin target group) — confirmed via browser DevTools showing the login response's `Set-Cookie: Domain=.ysminfosolution.com` not matching the actual site domain, so the browser silently refused to send the cookie back on subsequent `/me`/`/refresh` calls. Fixed in the template; also patched live on the two already-running instances via `sed` + `docker compose up -d --force-recreate`.
- **ElastiCache `volatile-lru` eviction policy** — discovered via worker log spam (`IMPORTANT! Eviction policy is volatile-lru. It should be "noeviction"`), traced to the `aws_elasticache_parameter_group` resource existing in Terraform with `maxmemory-policy = noeviction` defined correctly, but **never actually attached** to the replication group — the `parameter_group_name` attribute was simply missing from `aws_elasticache_replication_group`. Under memory pressure with `volatile-lru` active, Redis can evict TTL'd keys, which is dangerous for BullMQ's internal metadata keys. Fixed by adding the missing attribute, with the explicit caveat that the fix only takes effect on a fresh ElastiCache cluster (i.e., the next `go-live`), since parameter-group association can't be hot-applied to an existing cluster in this setup.
- **File-descriptor limits never set on ASG instances** — identified proactively (not from an observed symptom) by reading an external engineering writeup (QuestionPro's "scaling LivePolls to 10k concurrent users") that explicitly called out FD exhaustion as a silent failure mode, and cross-checking that QuizBuzz's userdata template had no equivalent safeguard. Added `* soft/hard nofile 65536` via `/etc/security/limits.d/`, plus a matching `LimitNOFILE=65536` override for the Docker daemon's systemd unit, applied **before** Docker starts so the daemon itself inherits the raised limit (ordering called out explicitly as load-bearing — setting it after Docker is already running would not retroactively apply to the running daemon).

---

## 11. Architecture Decision: Single-Instance vs. Live-Infrastructure Threshold

### 11.1 The question
Prompted by reading the QuestionPro article mid-session: if QuestionPro achieved 10,000 concurrent users on a single 2-vCPU/4GB server, could QuizBuzz skip the ALB+ASG+ElastiCache cost entirely and run everything — even at high participant counts — on the single admin instance?

### 11.2 The critical distinction identified (by the user, independently, then confirmed)
> "Their application was a polling application... the user joins in for a couple of minutes, answers their poll... and disconnects... In our case, they are constantly connected to the setting duration of the quiz."

This was treated as the decisive factor, not a minor caveat. QuestionPro's 10,000 "concurrent" users were achieved through rapid connection *turnover* — short-lived sessions cycling continuously — whereas QuizBuzz's WebSocket connections are **sustained for the entire quiz duration** (potentially 30 minutes to 2+ hours), with all participants connected *simultaneously* for that whole window. The same nominal "10,000 concurrent" label describes fundamentally different sustained-resource-pressure profiles.

### 11.3 Capacity estimate derived from this distinction, combined with the session's own measured data
Using the per-participant memory figure from Section 5.4 plus the observed CPU/heartbeat-callback math (667 heartbeat callbacks/sec system-wide at 10,000 participants on 15s intervals), a rough single-instance ceiling table was produced:
| Participant count (single t3.medium) | Verdict |
|---|---|
| 1,000–2,000 | Comfortable — heap and CPU well within bounds |
| ~5,000 | Possible but tight — would need a larger instance (t3.xlarge/c6i.large) and careful tuning, little headroom |
| 10,000 (sustained, full quiz duration) | Not realistic on this tier — Node's single-threaded event loop becomes the bottleneck independent of available RAM |

### 11.4 Resulting product/cost recommendation
Rather than a binary "always live infra" or "always single instance" choice, the recommendation was a **threshold-based default**: contests under ~2,000 registered participants run entirely on the existing always-on admin instance with zero additional infrastructure or cost; only contests exceeding that threshold trigger `go-live.sh` and incur the live-infrastructure cost (~$15–30/contest-day, per the project's own existing cost breakdown) for that specific event. This was explicitly framed as something that could become **client-facing guidance** — i.e., a concrete number to tell a customer ("under 2,000 participants, no extra cost; above that, here's the marginal cost") — which the user stated as their actual goal for running the next round of tests.

### 11.5 The two-phase validation plan agreed for the next session
1. **Phase 1 (live infrastructure):** finish validating the ALB+ASG+ElastiCache path with all the session's fixes applied — confirm scaling triggers correctly, confirm no data loss across a mode switch, get clean Stage 1/Stage 2 numbers.
2. **Phase 2 (single instance):** return to idle mode and re-run the *same* Stage 1 (1000) and Stage 2 (2000) profiles directly against the admin instance alone, to empirically establish the actual single-instance ceiling rather than relying on the back-of-envelope estimate in 11.3.

This plan was being executed live during the session (Phase 1 testing), and produced the OOM/scaling/AUTO_SUBMIT incidents documented in Sections 6–8, before the session ended on the unresolved Route53 issue in Section 9.3.

---

## 12. Summary Table — Every Distinct Bug/Incident, By Final Disposition

| # | Issue | Layer | Status at session end |
|---|---|---|---|
| 1 | ts-node couldn't resolve modules / tsconfig rootDir exclusion | Tooling | Fixed (transpile-only + NODE_PATH, later moot — switched to plain JS) |
| 2 | Prisma v7 requires explicit adapter | ORM | Fixed (`@prisma/adapter-pg`) |
| 3 | SSH tunnel IPv4/IPv6 mismatch | Networking | Fixed (`127.0.0.1` explicit) |
| 4 | Interactive transaction timeout on bulk seed | DB | Fixed (removed transactions, then bulk SQL) |
| 5 | Seed took 42 minutes | DB/perf | Fixed (4.1s — bulk raw-pg SQL, concurrency, deterministic refs) |
| 6 | `$executeRawUnsafe` parameter mis-binding | ORM | Fixed (bypassed via raw `pg.Pool`) |
| 7 | `registrationRef` collisions under concurrency | Data integrity | Fixed (index-deterministic refs) |
| 8 | Contest reset by slug instead of ID | Tooling | Fixed |
| 9 | CONTEST_START job lost across Redis-mode switch | Architecture | Fixed (reset script runs in-container; `redis-migrate.js` built) |
| 10 | k6 sending plain JSON instead of EIO4/Socket.IO frames | Protocol | Fixed |
| 11 | k6 assuming wrong `quiz:v1:start` payload shape | Protocol | Fixed |
| 12 | `otpLimiter` misapplied to `participant-login` | Auth/rate-limit | Fixed |
| 13 | Rate-limiter `windowMs` unit bug (ms vs sec) | Config | Fixed (two locations) |
| 14 | `COOKIE_DOMAIN` stale domain in live userdata | Config | Fixed (template + live patch) |
| 15 | ElastiCache `volatile-lru` not actually `noeviction` | Infra config | Fixed (effective on next fresh cluster) |
| 16 | No file-descriptor limit on ASG instances | Infra config | Fixed (proactive, untested under real load at session end) |
| 17 | Node default heap (~512MB) OOM under WS load | Infra/runtime | Fixed in template + live-patched; **recurred once near new ceiling** |
| 18 | DB pool exhaustion under fast k6 ramp | Infra config | Fixed (pool size raised; ramp-speed reduction recommended, not yet re-tested) |
| 19 | AUTO_SUBMIT undercounting disconnected participants | Data integrity | Fixed in code |
| 20 | ASG scale-out trigger (CPU) wrong metric for WS workload | Architecture | **Diagnosed and documented; not implemented** |
| 21 | No instance-side back-pressure/503 on saturation | Architecture | **Designed/recommended; not implemented** |
| 22 | Sticky sessions disabled on quiz target group | Infra config | **Identified; fix recommended, not confirmed applied** |
| 23 | Stage cancel/restart causing overlapping load | Process | **Identified; process rule stated, not yet validated by a clean re-run** |
| 24 | `NOT_REGISTERED` from stale/mismatched contest ID | Process | **Root-caused; verification step prescribed, not yet re-tested** |
| 25 | Stale Terraform state lock (DynamoDB) | IaC | Fixed each time it occurred (`force-unlock`) |
| 26 | ALB HTTPS listener + rules missing from state | IaC | Fixed (import + apply) |
| 27 | Route53 `api_idle` A-record "already exists" on `go-idle` | IaC | **Open at end of session — explicitly the next thing to fix** |

---

## 13. What This Document Deliberately Does Not Cover

To be precise about scope: this session's conversation does not contain the original design discussions, experiments, or decision logs for the broader architectural topics referenced only in passing via project memory — the Provider Pattern, Repository/Service/Controller layering, authentication/authorization design, the Modular Monolith decision, frontend architecture, AI integration, proctoring system design, Storage/Messaging provider evolution, or "Version 1 vs Version 2" product history. Those clearly exist as prior work on this project, but reconstructing *their* reasoning, tradeoffs, and lessons-learned would require the actual conversations in which they happened, which are not present in this chat. Producing detailed write-ups for those categories here would mean inventing plausible-sounding but unverifiable engineering narratives, which defeats the purpose of a knowledge base meant to ground future resume/case-study/interview material in things that actually happened.
