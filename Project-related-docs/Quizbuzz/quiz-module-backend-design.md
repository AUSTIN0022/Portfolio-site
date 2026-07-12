# Quiz Module — Complete Backend Design
**Quizbuzz v2 | Engineering Spec**

---

## Table of Contents

1. [Module Overview & Scope](#1-module-overview--scope)
2. [Directory Structure](#2-directory-structure)
3. [Config Layer](#3-config-layer)
4. [Redis Key Schema](#4-redis-key-schema)
5. [HTTP Routes — Auth (Contact)](#5-http-routes--authcontact)
6. [HTTP Routes — Quiz Join](#6-http-routes--quiz-join)
7. [WebSocket Gateway](#7-websocket-gateway)
8. [WebSocket Handlers — Deep Design](#8-websocket-handlers--deep-design)
9. [BullMQ Workers](#9-bullmq-workers)
10. [Proctoring Events (WebSocket)](#10-proctoring-events-websocket)
11. [Concurrency & Edge Cases](#11-concurrency--edge-cases)
12. [Complete File-by-File Code](#12-complete-file-by-file-code)

---

## 1. Module Overview & Scope

The quiz module is the **core real-time engine** of Quizbuzz. It owns:

| Responsibility | Transport |
|---|---|
| OTP request + verification | REST |
| Quiz-join identity check | REST |
| Socket token issuance | REST |
| Waiting room management | WebSocket |
| Quiz broadcast (start) | WebSocket (Redis pub/sub) |
| Question delivery | WebSocket |
| Answer progress save (Redis) | WebSocket |
| Heartbeat tracking | WebSocket |
| Proctoring event ingest | WebSocket |
| Auto-submit on timeout | BullMQ worker |
| Submission flush (Redis → DB) | BullMQ worker |
| Evaluation (scoring) | BullMQ worker |

**What this module does NOT own:**
- Leaderboard computation (separate worker)
- Certificate generation (separate worker)
- Analytics snapshots (separate worker)
- Payment processing (payment module)

---

## 2. Directory Structure

```
src/
├── config/
│   ├── index.ts                   ← exports merged config object
│   ├── app.config.ts
│   ├── redis.config.ts
│   ├── queue.config.ts
│   ├── auth.config.ts
│   └── quiz.config.ts             ← all quiz-specific tunables
│
├── modules/
│   └── quiz/
│       ├── quiz.module.ts         ← registers all routes + WS gateway
│       │
│       ├── http/
│       │   ├── contact-auth.routes.ts
│       │   ├── contact-auth.controller.ts
│       │   ├── contact-auth.service.ts
│       │   ├── contact-auth.repository.ts
│       │   ├── contact-auth.validator.ts
│       │   │
│       │   ├── quiz-join.routes.ts
│       │   ├── quiz-join.controller.ts
│       │   ├── quiz-join.service.ts
│       │   ├── quiz-join.repository.ts
│       │   └── quiz-join.validator.ts
│       │
│       ├── ws/
│       │   ├── quiz.gateway.ts         ← Socket.IO namespace setup + auth middleware
│       │   ├── quiz.gateway.types.ts
│       │   │
│       │   ├── handlers/
│       │   │   ├── waiting-room.handler.ts
│       │   │   ├── questions.handler.ts
│       │   │   ├── progress.handler.ts
│       │   │   ├── heartbeat.handler.ts
│       │   │   ├── submit.handler.ts
│       │   │   └── proctoring.handler.ts
│       │   │
│       │   └── services/
│       │       ├── session.service.ts       ← QuizSession CRUD + Redis
│       │       ├── questions.service.ts     ← fetch + shuffle + serve
│       │       ├── progress.service.ts      ← save answers to Redis
│       │       ├── submit.service.ts        ← flush to DB, enqueue eval
│       │       ├── proctoring.service.ts    ← event ingest + flag logic
│       │       └── broadcast.service.ts     ← Redis pub/sub wrapper
│       │
│       ├── workers/
│       │   ├── auto-submit.worker.ts       ← force-submit at endTime
│       │   ├── evaluation.worker.ts        ← score answers, write Submission
│       │   └── proctoring-score.worker.ts  ← aggregate proctoring events
│       │
│       ├── jobs/
│       │   ├── quiz.queues.ts             ← BullMQ queue definitions
│       │   └── quiz.schedulers.ts         ← schedule jobs at publish time
│       │
│       └── quiz.types.ts                  ← shared interfaces/enums
```

---

## 3. Config Layer

All tunables live in `src/config/quiz.config.ts`. Zero magic numbers in services.

```typescript
// src/config/quiz.config.ts
import { z } from 'zod';

const quizConfigSchema = z.object({
  // Redis TTLs (seconds)
  SESSION_TTL_SECS:          z.coerce.number().default(7200),   // 2hr — active session
  ANSWERS_TTL_SECS:          z.coerce.number().default(86400),  // 24hr — safety net
  HEARTBEAT_TTL_SECS:        z.coerce.number().default(60),     // 1min — dead-man switch
  QUESTIONS_CACHE_TTL_SECS:  z.coerce.number().default(3600),   // 1hr — question cache

  // Heartbeat
  WS_HEARTBEAT_INTERVAL_MS:  z.coerce.number().default(15000),  // 15s
  WS_HEARTBEAT_GRACE_MS:     z.coerce.number().default(45000),  // 45s — 3 missed = dead

  // Time warnings (seconds remaining)
  TIME_WARNINGS_SECS:        z.string().default('600,300,60'),  // 10m, 5m, 1m

  // Socket token
  SOCKET_TOKEN_SECRET:       z.string(),
  SOCKET_TOKEN_TTL_SECS:     z.coerce.number().default(14400),  // 4hr

  // OTP
  OTP_TTL_SECS:              z.coerce.number().default(300),    // 5min
  OTP_LENGTH:                z.coerce.number().default(6),

  // Proctoring thresholds
  PROCTORING_FLAG_SCORE:     z.coerce.number().default(50),     // violation score to flag
  PROCTORING_DISQUALIFY_SCORE: z.coerce.number().default(100),  // auto-disqualify

  // BullMQ
  EVAL_QUEUE_CONCURRENCY:    z.coerce.number().default(50),
  AUTOSUBMIT_BUFFER_SECS:    z.coerce.number().default(5),      // submit 5s before endTime

  // Shuffle seed salt
  SHUFFLE_SALT:              z.string().default('quizbuzz'),
});

export const quizConfig = quizConfigSchema.parse(process.env);
```

---

## 4. Redis Key Schema

All keys follow the convention: `quiz:{contestId}:{dataType}:{participantId}`

```
quiz:{contestId}:session:{participantId}          → Hash  (session state)
quiz:{contestId}:answers:{participantId}          → Hash  (questionId → selectedOptionId)
quiz:{contestId}:heartbeat:{participantId}        → String (timestamp, TTL = HEARTBEAT_TTL_SECS)
quiz:{contestId}:questions:{participantId}        → String (JSON serialised question order for this participant)
quiz:{contestId}:waiting_room                     → Set   (participantId members)
quiz:{contestId}:status                           → String (ContestStatus, TTL = contest.endTime)
quiz:{contestId}:questions_cache                  → String (JSON, shuffled off — base question list)
quiz:locks:submit:{participantId}                 → String (NX lock, 10s TTL)
quiz:locks:session:{participantId}                → String (NX lock, 5s TTL)
```

**Session hash fields:**
```
socketId         current socket connection id
participantId
contestId
startedAt        ISO string
currentQuestion  integer index
status           IN_WAITING | IN_QUIZ | SUBMITTED
deviceFingerprint
ipAddress
sessionId        DB QuizSession.id
```

---

## 5. HTTP Routes — Auth (Contact)

### `POST /api/v1/auth/contact/request-otp`

**Validator:**
```typescript
z.object({
  email: z.string().email(),
  phone: z.string().regex(/^\+[1-9]\d{6,14}$/),  // E.164
  purpose: z.enum(['REGISTRATION', 'QUIZ_JOIN']),
})
```

**Service logic:**
1. Find or accept contact by email (no DB write yet — OTP is pre-auth)
2. Generate cryptographically random 6-digit OTP: `crypto.randomInt(100000, 999999).toString()`
3. Store in Redis: `otp:{purpose}:{email}` → `{ otp: bcrypt-hash, attempts: 0 }`, TTL = `OTP_TTL_SECS`
4. Enqueue WhatsApp/Email message via BullMQ messaging queue (never block HTTP thread)
5. Return `{ channel, expiresInSeconds }`

**Rate limiting:** `5 requests per email per 10 minutes` (Redis counter, separate key)

---

### `POST /api/v1/auth/contact/verify-otp`

**Validator:**
```typescript
z.object({
  email: z.string().email(),
  otp:   z.string().length(6),
  purpose: z.enum(['REGISTRATION', 'QUIZ_JOIN']),
})
```

**Service logic:**
1. Fetch Redis key `otp:{purpose}:{email}`
2. If missing → `410 Gone` (expired)
3. Check `attempts >= 5` → `429 Too Many Requests`, delete key
4. `bcrypt.compare(otp, storedHash)` → if wrong, increment attempts, return `400`
5. On success: delete OTP key (single-use)
6. Sign `contactToken` JWT: `{ sub: email, purpose, iat, exp: now + 1hr }`
7. Return `{ contactToken, isNewContact }` (isNewContact = whether DB contact exists)

**Key insight:** `contactToken` is NOT a session. It's a one-time-use proof of identity for registration.

---

### `POST /api/v1/auth/contact/quiz-join`

This is the **most security-critical REST endpoint** in the quiz flow.

**Validator:**
```typescript
z.object({
  registrationRef: z.string().regex(/^QB-\d{4}-\d{5}$/),
  joinCode:        z.string().min(4).max(20).toUpperCase(),
  contestId:       z.string(),
})
```

**Service logic (in a DB transaction):**
```
1. Find Participant by registrationRef + contestId
   → 404 if not found
   
2. Verify participant.status is REGISTERED or CHECKED_IN
   → 403 if SUBMITTED / DISQUALIFIED / ABSENT

3. Fetch Contest by contestId
   → Check contest.status === 'PUBLISHED' | 'REGISTRATION_CLOSED' | 'LIVE'
   → 403 "Contest not yet open" if DRAFT
   → 403 "Contest has ended" if EVALUATION | RESULTS_OUT | COMPLETED

4. Verify joinCode === contest.joinCode (constant-time compare: timingSafeEqual)
   → 400 if wrong

5. Update participant.status = 'CHECKED_IN', participant.checkedInAt = now()
   [DB transaction]

6. Invalidate any existing QuizSession for this participant (set isActive = false)
   Also: publish 'session-invalidated' to Redis channel so old socket gets kicked

7. Create new QuizSession in DB (without socketId yet — assigned on WS connect)

8. Sign socketToken JWT:
   payload: {
     sub:           participantId,
     contestId:     contestId,
     sessionId:     newQuizSession.id,
     orgId:         contest.organizationId,
     iat:           now,
     exp:           contest.endTime + 1hr buffer   ← token valid until contest is over
   }
   secret: config.quiz.SOCKET_TOKEN_SECRET

9. Return { socketToken, participantId, contestId, status: 'CHECKED_IN' }
```

**Why create DB session here?** We need the `sessionId` in the JWT so the WS gateway can locate the session without a DB lookup on every message. The socketId is set when the WS connection is established.

---

## 6. HTTP Routes — Quiz Join

The quiz-join endpoint is part of the contact-auth group above. No separate REST routes are needed beyond what the API docs define for the quiz flow itself. The HTTP layer is thin — the heavy lifting is in the WebSocket gateway.

---

## 7. WebSocket Gateway

### File: `src/modules/quiz/ws/quiz.gateway.ts`

```typescript
// Pseudocode — full code in Section 12

import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';

export function createQuizGateway(httpServer: HttpServer, redisClient: Redis) {
  const io = new Server(httpServer, {
    cors: { origin: config.app.CORS_ORIGINS },
    transports: ['websocket'],          // no long-polling — reduces complexity
    pingInterval: config.quiz.WS_HEARTBEAT_INTERVAL_MS,
    pingTimeout:  config.quiz.WS_HEARTBEAT_GRACE_MS,
    maxHttpBufferSize: 1e4,             // 10KB max payload — prevents abuse
  });

  // Redis adapter — mandatory for horizontal scaling
  // All events broadcast through Redis pub/sub
  io.adapter(createAdapter(redisPub, redisSub));

  const quizNamespace = io.of('/quiz');

  // ── Auth middleware ────────────────────────────────────────────────────────
  quizNamespace.use(async (socket, next) => {
    const token = socket.handshake.auth.token
               || socket.handshake.query.token as string;

    if (!token) return next(new WsError('WS_AUTH_FAILED', 'No token'));

    try {
      const payload = jwt.verify(token, config.quiz.SOCKET_TOKEN_SECRET) as SocketTokenPayload;

      // Attach to socket for downstream handlers
      socket.data.participantId = payload.sub;
      socket.data.contestId     = payload.contestId;
      socket.data.sessionId     = payload.sessionId;
      socket.data.orgId         = payload.orgId;

      // Guard: check participant is not disqualified (Redis fast-path)
      const sessionRaw = await redis.hgetall(
        `quiz:${payload.contestId}:session:${payload.sub}`
      );
      if (sessionRaw?.status === 'SUBMITTED') {
        return next(new WsError('WS_ALREADY_SUBMITTED', 'Already submitted'));
      }

      next();
    } catch (err) {
      next(new WsError('WS_AUTH_FAILED', 'Invalid or expired token'));
    }
  });

  // ── Connection handler ─────────────────────────────────────────────────────
  quizNamespace.on('connection', async (socket: QuizSocket) => {
    const { participantId, contestId, sessionId } = socket.data;

    // 1. Update QuizSession.socketId in DB (non-blocking — fire and forget is fine)
    sessionService.updateSocketId(sessionId, socket.id).catch(logger.error);

    // 2. Update Redis session hash
    await redis.hset(`quiz:${contestId}:session:${participantId}`, {
      socketId: socket.id,
    });

    // 3. Subscribe to personal channel for cross-instance messages
    //    (e.g., session-invalidated from quiz-join on another instance)
    const personalChannel = `quiz:personal:${participantId}`;
    redisSub.subscribe(personalChannel);
    redisSub.on('message', (channel, message) => {
      if (channel === personalChannel) {
        const event = JSON.parse(message);
        socket.emit(event.type, event.payload);
        if (event.type === 'session-invalidated') socket.disconnect(true);
      }
    });

    // 4. Register event handlers
    socket.on('join-waiting-room', waitingRoomHandler(socket, redis));
    socket.on('get-questions',     questionsHandler(socket, redis));
    socket.on('save-progress',     progressHandler(socket, redis));
    socket.on('heartbeat',         heartbeatHandler(socket, redis));
    socket.on('submit-quiz',       submitHandler(socket, redis, queues));
    socket.on('proctoring-event',  proctoringHandler(socket, redis, queues));

    // 5. Handle disconnect
    socket.on('disconnect', async () => {
      await redis.hdel(`quiz:${contestId}:session:${participantId}`, 'socketId');
      redisSub.unsubscribe(personalChannel);
    });
  });

  return io;
}
```

### Key Design Decisions

| Decision | Reason |
|---|---|
| `transports: ['websocket']` | Long-polling adds server state complexity. Modern browsers all support WS. |
| Redis adapter | Required for multi-instance. Events broadcast via Redis, not memory. |
| JWT in `handshake.auth.token` | More secure than query params (doesn't appear in server logs). Query param is fallback for older clients. |
| Personal Redis channel per participant | Lets another API instance push `session-invalidated` when the participant logs in from a new device. |
| Non-blocking session DB update on connect | Socket connects in <5ms. DB round-trip should not block the handshake. |

---

## 8. WebSocket Handlers — Deep Design

### 8.1 `join-waiting-room`

```
Client emits: { contestId }

Handler:
1. Validate contestId matches socket.data.contestId (prevent spoofing)
2. Check contest status via Redis:
   key: quiz:{contestId}:status
   → if LIVE: skip waiting room, immediately emit quiz-started + load questions
   → if not PUBLISHED/REGISTRATION_CLOSED: emit error WS_CONTEST_NOT_LIVE
3. Add participantId to Redis Set: quiz:{contestId}:waiting_room (SADD)
4. Update participant status in DB: IN_WAITING
5. Update Redis session: status = IN_WAITING
6. Join socket room: socket.join(`contest:${contestId}`)
7. Get waiting count: SCARD quiz:{contestId}:waiting_room
8. Emit to socket: joined-waiting-room { waitingCount, startsAt: contest.startTime }

Edge case — reconnect during quiz:
If Redis session exists AND status = IN_QUIZ:
  → emit resume-quiz { currentQuestion, savedAnswers }
  → do NOT add to waiting room again
```

### 8.2 `get-questions`

This is the most complex handler. It must be **idempotent** — if the client calls it twice (reconnect), it returns the same shuffled order.

```
Client emits: { contestId }

Handler:
1. Acquire Redis lock: quiz:locks:session:{participantId} (NX, PX=5000)
   → If lock fails: someone else is fetching, wait and retry once
   
2. Check if questions already cached for this participant:
   key: quiz:{contestId}:questions:{participantId}
   → If exists: use cached order (deterministic shuffle)

3. If NOT cached:
   a. Fetch base question list:
      key: quiz:{contestId}:questions_cache
      → If miss: query DB ContestQuestion, include Question + Options
                 Store in Redis with TTL = QUESTIONS_CACHE_TTL_SECS
   
   b. If contest.shuffleQuestions:
      Shuffle using seeded PRNG:
      seed = hash(participantId + contestId + config.quiz.SHUFFLE_SALT)
      → same participant always gets same order (deterministic)
   
   c. If contest.shuffleOptions:
      For each question, shuffle options with same seed strategy
   
   d. Store participant-specific order:
      redis.setex(
        quiz:{contestId}:questions:{participantId},
        QUESTIONS_CACHE_TTL_SECS,
        JSON.stringify(shuffledQuestionIds)
      )

4. Release lock

5. Build response — STRIP isCorrect from all options:
   questions: [{ id, text, options: [{ id, text, position }] }]

6. Check for existing progress (reconnect scenario):
   saved = redis.hgetall(quiz:{contestId}:answers:{participantId})
   resumeFromIndex = last answered question index OR 0

7. Update participant status in DB: IN_QUIZ
   Update Redis session: status = IN_QUIZ, startedAt

8. Emit to socket: questions-loaded { questions, sessionId, resumeFromIndex }
   If reconnect: also emit resume-quiz { currentQuestion, savedAnswers }

CRITICAL: Never include isCorrect in the response.
          Strip it server-side, not by trusting the ORM projection.
```

### 8.3 `save-progress`

```
Client emits: { contestId, questionId, selectedOptionId }

Handler:
1. Validate contestId matches socket
2. Validate questionId belongs to this contest (check against participant's question list in Redis)
   → reject invalid questionIds (prevents answer injection for other contests)
3. Validate selectedOptionId belongs to questionId (check cached question data)
   → reject invalid option ids

4. Write to Redis Hash (fire-and-forget — sub-millisecond):
   HSET quiz:{contestId}:answers:{participantId} {questionId} {selectedOptionId}
   EXPIRE quiz:{contestId}:answers:{participantId} ANSWERS_TTL_SECS

5. Update currentQuestion in Redis session hash

6. Emit back: progress-saved { questionId }

DESIGN: We do NOT write to DB here. DB writes happen only at submission time.
         Redis is the source of truth for in-progress answers.
         This makes save-progress extremely fast (< 2ms).
```

### 8.4 `heartbeat`

```
Client emits: { contestId, currentQuestion }

Handler:
1. Update Redis heartbeat key:
   SETEX quiz:{contestId}:heartbeat:{participantId} {HEARTBEAT_TTL_SECS} {timestamp}
   
2. Update currentQuestion in Redis session hash

3. Check time remaining:
   endTime = contest.endTime (from Redis or session)
   remaining = endTime - now()
   
4. If remaining matches a warning threshold (600, 300, 60):
   Emit time-warning { secondsRemaining } to this socket only

5. No DB write. No emit needed (time-warning is the only conditional emit).

HEARTBEAT is the dead-man's switch:
  If heartbeat key expires (HEARTBEAT_TTL_SECS = 60s, client sends every 15s):
  → participant is considered disconnected
  → auto-submit worker picks them up at endTime
```

### 8.5 `submit-quiz`

The most critical handler. Must be **exactly-once**.

```
Client emits: { contestId }

Handler:
1. Acquire distributed lock:
   SETNX quiz:locks:submit:{participantId} "1" PX=10000
   → If lock already held: emit error "Submission already in progress"

2. Check idempotency:
   session = redis.hgetall(quiz:{contestId}:session:{participantId})
   if session.status === 'SUBMITTED':
     release lock, emit submission-ack with existing submissionId
     return

3. Read all saved answers from Redis:
   answers = HGETALL quiz:{contestId}:answers:{participantId}

4. Calculate timeTakenSecs:
   startedAt = session.startedAt
   submittedAt = now()
   timeTakenSecs = (submittedAt - startedAt) / 1000

5. In a DB transaction:
   a. Create Submission record (status=SUBMITTED)
   b. Create Answer records (one per question, selectedOptionId from Redis hash)
   c. Update Participant.status = SUBMITTED
   d. Update QuizSession.endedAt = now(), isActive = false

6. Update Redis session: status = SUBMITTED
   (Keep Redis state — leaderboard worker may read it)

7. Enqueue evaluation job:
   queue: 'quiz-evaluation'
   payload: { submissionId, contestId, participantId, orgId }
   priority: normal

8. Remove from waiting room set (cleanup):
   SREM quiz:{contestId}:waiting_room participantId

9. Release lock

10. Emit: submission-ack { submissionId, submittedAt }

EXACTLY-ONCE GUARANTEE:
  - Redis NX lock prevents duplicate in-flight submissions
  - Idempotency check (step 2) handles the case where submission succeeded
    but the ack was lost (client retries)
  - DB transaction ensures Submission + Answers are atomic
```

---

## 9. BullMQ Workers

### 9.1 Auto-Submit Worker

**Purpose:** Force-submit participants who did not submit before `contest.endTime`.

**Scheduled:** When a contest is published, schedule a job for `contest.endTime + AUTOSUBMIT_BUFFER_SECS`.

```typescript
// Queue: 'quiz-auto-submit'
// Job name: 'force-submit-contest'
// Payload: { contestId, orgId }

async function autoSubmitProcessor(job: Job) {
  const { contestId } = job.data;

  // 1. Find all participants who are IN_QUIZ or IN_WAITING but not SUBMITTED
  const unsubmitted = await participantRepo.findUnsubmitted(contestId);

  for (const participant of unsubmitted) {
    // 2. Broadcast force-submit event via Redis pub/sub to whichever instance holds the socket
    await broadcastService.toContest(contestId, 'quiz-force-submit', {
      reason: 'time_expired',
    });

    // 3. Trigger submission for each participant
    //    Using the same submit service — idempotency handles duplicates
    await submitService.forceSubmit({
      participantId: participant.id,
      contestId,
      reason: 'time_expired',
    });
  }

  // 4. Transition contest status: LIVE → EVALUATION
  await contestRepo.updateStatus(contestId, 'EVALUATION');

  // 5. Enqueue evaluation jobs for all submitted participants
  //    (those who submitted manually already have eval jobs)
}
```

### 9.2 Evaluation Worker

**Purpose:** Score a submission. Called once per submitted participant.

```typescript
// Queue: 'quiz-evaluation'
// Job name: 'evaluate-submission'
// Payload: { submissionId, contestId, participantId, orgId }
// Concurrency: config.quiz.EVAL_QUEUE_CONCURRENCY (default 50)

async function evaluationProcessor(job: Job) {
  const { submissionId, contestId } = job.data;

  // 1. Fetch submission with all answers
  const submission = await submissionRepo.findWithAnswers(submissionId);

  // 2. Fetch correct answers for this contest's questions
  //    (uses ContestQuestion join → QuestionOption where isCorrect=true)
  const answerKey = await questionRepo.getAnswerKey(contestId);
  // answerKey: Map<questionId, { correctOptionId, marks, negativeMark }>

  // 3. Score each answer
  let totalScore = 0;
  let correct = 0, wrong = 0, skipped = 0;

  for (const answer of submission.answers) {
    const key = answerKey.get(answer.questionId);
    if (!answer.selectedOptionId) {
      skipped++;
      // Update answer: isCorrect=false, marksAwarded=0
    } else if (answer.selectedOptionId === key.correctOptionId) {
      correct++;
      totalScore += key.marks;
      // Update answer: isCorrect=true, marksAwarded=key.marks
    } else {
      wrong++;
      totalScore -= key.negativeMark;
      // Update answer: isCorrect=false, marksAwarded=-key.negativeMark
    }
  }

  const percentage = (totalScore / totalPossibleMarks) * 100;

  // 4. Update Submission in DB (transaction)
  await submissionRepo.updateEvaluation(submissionId, {
    status: 'EVALUATED',
    correct, wrong, skipped,
    score: Math.max(0, totalScore),  // no negative total
    percentage: Math.max(0, percentage),
    totalQuestions: submission.answers.length,
    attempted: correct + wrong,
    evaluatedAt: new Date(),
  });

  // 5. Update all Answer records (batch update)
  await answerRepo.batchUpdateCorrectness(submissionId, answerResults);

  // 6. Check if all submissions for this contest are evaluated
  //    If yes: trigger leaderboard computation job
  const allEvaluated = await submissionRepo.allEvaluated(contestId);
  if (allEvaluated) {
    await queues.leaderboard.add('compute-leaderboard', { contestId });
  }
}
```

### 9.3 Proctoring Score Worker

**Purpose:** Aggregate proctoring events and update violation score in real-time.

```typescript
// Queue: 'proctoring-score'
// Job name: 'update-proctoring-score'
// Payload: { participantId, contestId, eventType, severity, orgId }

async function proctoringScoreProcessor(job: Job) {
  const { participantId, contestId, eventType, severity } = job.data;

  // Severity weights from config (not hardcoded)
  const weight = config.proctoring.SEVERITY_WEIGHTS[severity]; // 1=1, 2=5, 3=20

  // Atomic upsert in DB
  await proctoringRepo.upsertScore(participantId, contestId, {
    incrementTotalEvents: 1,
    incrementHighSeverity: severity >= 2 ? 1 : 0,
    incrementViolationScore: weight,
  });

  const score = await proctoringRepo.getScore(participantId);

  // Auto-flag
  if (score.violationScore >= config.quiz.PROCTORING_FLAG_SCORE && !score.isFlagged) {
    await proctoringRepo.setFlagged(participantId);
  }

  // Auto-disqualify (push through socket)
  if (score.violationScore >= config.quiz.PROCTORING_DISQUALIFY_SCORE) {
    await participantRepo.disqualify(participantId, 'Proctoring threshold exceeded');
    await broadcastService.toParticipant(participantId, 'session-invalidated', {
      reason: 'disqualified',
    });
  }
}
```

---

## 10. Proctoring Events (WebSocket)

The proctoring handler is a **separate WS event** from the quiz flow. It receives events from the frontend (face detection, tab switch, etc.) and is designed to be non-blocking.

```
Client emits: proctoring-event {
  contestId,
  type: 'FACE_NOT_DETECTED' | 'MULTIPLE_FACES' | 'TAB_SWITCH' | 'FULLSCREEN_EXIT' | 'AUDIO_DETECTED' | 'COPY_PASTE_DETECTED',
  severity: 1 | 2 | 3,
  metadata: { ... }   // e.g. { confidence: 0.92, faceCount: 2 }
}

Handler:
1. Validate event type is a valid ViolationType enum
2. Validate severity is 1, 2, or 3
3. Write to DB immediately (audit trail — do not skip this):
   ProctoringEvent { participantId, contestId, type, severity, metadata, occurredAt }
   Note: This is a fire-and-forget insert. Use prisma.$executeRawUnsafe for high throughput
         or batch with a Redis list + periodic flush worker.

4. Enqueue proctoring score update (BullMQ):
   queue: 'proctoring-score'
   payload: { participantId, contestId, eventType, severity, orgId }

5. No emit back to client for proctoring events (silent ingest)
```

**Batched DB write strategy for high-throughput proctoring:**
```
Instead of one DB insert per event:

1. RPUSH quiz:{contestId}:proctoring_events:{participantId} {serialised_event}
2. Worker flushes every 10 seconds:
   LRANGE ... 0 -1
   Bulk INSERT into proctoring_events table
   DEL the list key

This reduces DB write pressure from ~20 events/min to 1 bulk insert/10s per participant.
Configurable: PROCTORING_FLUSH_INTERVAL_MS in config.
```

---

## 11. Concurrency & Edge Cases

### 11.1 Duplicate Submission (Submit + Force-Submit race)

**Scenario:** Client submits manually at T=0s. Force-submit worker fires at T=+5s.

**Solution:** Redis NX lock on `quiz:locks:submit:{participantId}` + idempotency check on `session.status === SUBMITTED`. The second submission attempt finds the key already SUBMITTED and returns the existing submissionId.

### 11.2 Multiple Device Login

**Scenario:** Participant joins on laptop, then opens on phone.

**Solution:**
1. `POST /auth/contact/quiz-join` invalidates the old QuizSession in DB.
2. Publishes `session-invalidated` to Redis personal channel `quiz:personal:{participantId}`.
3. All instances subscribed to that channel forward it to the old socket.
4. Old socket disconnects. New device gets a fresh `socketToken`.

### 11.3 Reconnect During Quiz

**Scenario:** Participant's internet drops for 30 seconds, then reconnects.

**Solution:**
1. Client reconnects with same `socketToken` (still valid — TTL = endTime + buffer).
2. WS auth middleware checks Redis session — sees `status: IN_QUIZ`.
3. `join-waiting-room` handler detects active session → skips waiting room.
4. `get-questions` handler finds cached question order → returns same order.
5. Handler also reads Redis answers hash → emits `resume-quiz { currentQuestion, savedAnswers }`.
6. Client restores state from resume-quiz event.

### 11.4 Question Order Determinism (Shuffle)

**Problem:** If the server restarts and Redis is empty, a reconnecting participant would get a different question order.

**Solution:** Seeded PRNG using `participantId + contestId + SHUFFLE_SALT`. Same seed → same shuffle. The Redis cache is just an optimisation. The seed always produces the same result.

```typescript
function seededShuffle<T>(arr: T[], seed: string): T[] {
  // Mulberry32 PRNG seeded with hash of the seed string
  const s = cyrb128(seed);
  const rand = mulberry32(s[0]);
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
```

### 11.5 Redis Failure Fallback

**Scenario:** Redis goes down mid-quiz.

**Strategy:**
- All answer saves fail → client should buffer locally and retry.
- Heartbeat fails → participant appears disconnected but is still answering.
- At submission: if Redis answers are lost, fall back to answers stored in `QuizSession.savedAnswers` (if we maintain a DB backup — optional, controlled by `QUIZ_ENABLE_DB_BACKUP=true`).
- All Redis operations are wrapped in try/catch with structured error logs.

### 11.6 Time Warning Deduplication

**Problem:** Multiple instances could all send time warnings to the same socket.

**Solution:** Time warnings are emitted by the **client's assigned instance** via the heartbeat handler — not broadcast. Each socket handles its own timer. No Redis coordination needed.

---

## 12. Complete File-by-File Code

---

### `src/modules/quiz/quiz.types.ts`

```typescript
import { Socket } from 'socket.io';

export interface SocketTokenPayload {
  sub:        string;   // participantId
  contestId:  string;
  sessionId:  string;
  orgId:      string;
  iat:        number;
  exp:        number;
}

export interface QuizSocketData {
  participantId: string;
  contestId:     string;
  sessionId:     string;
  orgId:         string;
}

export type QuizSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  {},
  QuizSocketData
>;

export interface ClientToServerEvents {
  'join-waiting-room': (payload: { contestId: string }) => void;
  'get-questions':     (payload: { contestId: string }) => void;
  'save-progress':     (payload: SaveProgressPayload)   => void;
  'heartbeat':         (payload: HeartbeatPayload)      => void;
  'submit-quiz':       (payload: { contestId: string }) => void;
  'proctoring-event':  (payload: ProctoringEventPayload) => void;
}

export interface ServerToClientEvents {
  'joined-waiting-room': (data: WaitingRoomData)    => void;
  'quiz-started':        (data: QuizStartedData)    => void;
  'questions-loaded':    (data: QuestionsLoadedData) => void;
  'resume-quiz':         (data: ResumeQuizData)     => void;
  'progress-saved':      (data: { questionId: string }) => void;
  'submission-ack':      (data: SubmissionAckData)  => void;
  'time-warning':        (data: { secondsRemaining: number }) => void;
  'quiz-force-submit':   (data: { reason: string }) => void;
  'session-invalidated': (data: { reason: string }) => void;
  'error':               (data: WsErrorPayload)     => void;
}

export interface SaveProgressPayload {
  contestId:        string;
  questionId:       string;
  selectedOptionId: string;
}

export interface HeartbeatPayload {
  contestId:       string;
  currentQuestion: number;
}

export interface ProctoringEventPayload {
  contestId: string;
  type:      string;
  severity:  1 | 2 | 3;
  metadata?: Record<string, unknown>;
}

export interface QuizSessionRedis {
  socketId:          string;
  participantId:     string;
  contestId:         string;
  startedAt:         string;
  currentQuestion:   string;
  status:            'IN_WAITING' | 'IN_QUIZ' | 'SUBMITTED';
  deviceFingerprint: string;
  ipAddress:         string;
  sessionId:         string;
}

export interface WsErrorPayload {
  code:    string;
  message: string;
}

export class WsError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

// Outbound data shapes
export interface WaitingRoomData  { waitingCount: number; startsAt: string; }
export interface QuizStartedData  { contestId: string; totalQuestions: number; durationSeconds: number; }
export interface QuestionsLoadedData {
  questions:       QuizQuestion[];
  sessionId:       string;
  resumeFromIndex: number;
}
export interface ResumeQuizData   { currentQuestion: number; savedAnswers: SavedAnswer[]; }
export interface SubmissionAckData { submissionId: string; submittedAt: string; }

export interface QuizQuestion {
  id:      string;
  text:    string;
  options: QuizOption[];
}

export interface QuizOption {
  id:       string;
  text:     string;
  position: number;
}

export interface SavedAnswer {
  questionId:       string;
  selectedOptionId: string | null;
}
```

---

### `src/modules/quiz/ws/services/session.service.ts`

```typescript
import { prisma }  from '@/lib/prisma';
import { redis }   from '@/lib/redis';
import { config }  from '@/config';
import { QuizSessionRedis } from '../../quiz.types';

export const sessionService = {

  async getRedisSession(contestId: string, participantId: string): Promise<QuizSessionRedis | null> {
    const raw = await redis.hgetall(`quiz:${contestId}:session:${participantId}`);
    if (!raw || !raw.participantId) return null;
    return raw as QuizSessionRedis;
  },

  async createRedisSession(data: {
    participantId: string;
    contestId:     string;
    sessionId:     string;
    orgId:         string;
    socketId:      string;
    ipAddress:     string;
  }): Promise<void> {
    const key = `quiz:${data.contestId}:session:${data.participantId}`;
    await redis.hset(key, {
      socketId:        data.socketId,
      participantId:   data.participantId,
      contestId:       data.contestId,
      sessionId:       data.sessionId,
      status:          'IN_WAITING',
      currentQuestion: '0',
      startedAt:       '',
      ipAddress:       data.ipAddress,
    });
    await redis.expire(key, config.quiz.SESSION_TTL_SECS);
  },

  async updateSocketId(sessionId: string, socketId: string): Promise<void> {
    await prisma.quizSession.update({
      where: { id: sessionId },
      data:  { socketId, lastHeartbeatAt: new Date() },
    });
  },

  async markStarted(contestId: string, participantId: string, sessionId: string): Promise<void> {
    const key = `quiz:${contestId}:session:${participantId}`;
    await redis.hset(key, { status: 'IN_QUIZ', startedAt: new Date().toISOString() });

    await prisma.$transaction([
      prisma.participant.update({
        where: { id: participantId },
        data:  { status: 'IN_QUIZ', joinedAt: new Date() },
      }),
      prisma.quizSession.update({
        where: { id: sessionId },
        data:  { startedAt: new Date() },
      }),
    ]);
  },

  async updateCurrentQuestion(contestId: string, participantId: string, idx: number): Promise<void> {
    await redis.hset(`quiz:${contestId}:session:${participantId}`, {
      currentQuestion: idx.toString(),
    });
  },

  async markSubmitted(contestId: string, participantId: string): Promise<void> {
    await redis.hset(`quiz:${contestId}:session:${participantId}`, { status: 'SUBMITTED' });
  },

  async invalidateOldSessions(participantId: string): Promise<void> {
    await prisma.quizSession.updateMany({
      where:  { participantId, isActive: true },
      data:   { isActive: false, endedAt: new Date() },
    });
  },
};
```

---

### `src/modules/quiz/ws/services/questions.service.ts`

```typescript
import { prisma }  from '@/lib/prisma';
import { redis }   from '@/lib/redis';
import { config }  from '@/config';
import { QuizQuestion } from '../../quiz.types';
import { seededShuffle, cyrb128, mulberry32 } from '@/lib/shuffle';

export const questionsService = {

  async getQuestionsForParticipant(
    contestId:     string,
    participantId: string,
    shuffleQuestions: boolean,
    shuffleOptions:   boolean,
  ): Promise<{ questions: QuizQuestion[]; resumeFromIndex: number }> {

    // 1. Get or build base question list (contest-level cache)
    let baseQuestions = await this._getContestQuestionsCache(contestId);
    if (!baseQuestions) {
      baseQuestions = await this._fetchFromDB(contestId);
      await redis.setex(
        `quiz:${contestId}:questions_cache`,
        config.quiz.QUESTIONS_CACHE_TTL_SECS,
        JSON.stringify(baseQuestions),
      );
    }

    // 2. Check participant-specific order cache
    const cachedOrder = await redis.get(`quiz:${contestId}:questions:${participantId}`);
    let orderedQuestions: QuizQuestion[];

    if (cachedOrder) {
      // Reconstruct from stored ID order
      const idOrder: string[] = JSON.parse(cachedOrder);
      const qMap = new Map(baseQuestions.map(q => [q.id, q]));
      orderedQuestions = idOrder.map(id => qMap.get(id)!).filter(Boolean);
    } else {
      orderedQuestions = [...baseQuestions];

      if (shuffleQuestions) {
        const seed = `${participantId}:${contestId}:${config.quiz.SHUFFLE_SALT}`;
        orderedQuestions = seededShuffle(orderedQuestions, seed);
      }

      if (shuffleOptions) {
        orderedQuestions = orderedQuestions.map(q => ({
          ...q,
          options: seededShuffle(q.options, `opt:${participantId}:${q.id}`),
        }));
      }

      // Cache the ID order (not full objects — saves memory)
      await redis.setex(
        `quiz:${contestId}:questions:${participantId}`,
        config.quiz.QUESTIONS_CACHE_TTL_SECS,
        JSON.stringify(orderedQuestions.map(q => q.id)),
      );
    }

    // 3. Determine resume index from saved answers
    const savedAnswers = await redis.hgetall(`quiz:${contestId}:answers:${participantId}`);
    const answeredIds = new Set(Object.keys(savedAnswers || {}));
    let resumeFromIndex = 0;
    for (let i = orderedQuestions.length - 1; i >= 0; i--) {
      if (answeredIds.has(orderedQuestions[i].id)) {
        resumeFromIndex = i + 1;
        break;
      }
    }

    return { questions: orderedQuestions, resumeFromIndex };
  },

  async _getContestQuestionsCache(contestId: string): Promise<QuizQuestion[] | null> {
    const raw = await redis.get(`quiz:${contestId}:questions_cache`);
    return raw ? JSON.parse(raw) : null;
  },

  async _fetchFromDB(contestId: string): Promise<QuizQuestion[]> {
    const contestQuestions = await prisma.contestQuestion.findMany({
      where:   { contestId },
      orderBy: { position: 'asc' },
      include: {
        question: {
          include: {
            options: {
              select: { id: true, text: true, position: true },  // NO isCorrect
              orderBy: { position: 'asc' },
            },
          },
        },
      },
    });

    return contestQuestions.map(cq => ({
      id:      cq.question.id,
      text:    cq.question.questionText,
      options: cq.question.options,
    }));
  },

  async getSavedAnswers(contestId: string, participantId: string) {
    const raw = await redis.hgetall(`quiz:${contestId}:answers:${participantId}`);
    return Object.entries(raw || {}).map(([questionId, selectedOptionId]) => ({
      questionId,
      selectedOptionId: selectedOptionId || null,
    }));
  },
};
```

---

### `src/modules/quiz/ws/services/submit.service.ts`

```typescript
import { prisma }  from '@/lib/prisma';
import { redis }   from '@/lib/redis';
import { queues }  from '@/modules/quiz/jobs/quiz.queues';
import { sessionService } from './session.service';
import { logger }  from '@/lib/logger';

export const submitService = {

  async submit(params: {
    participantId: string;
    contestId:     string;
    sessionId:     string;
    orgId:         string;
    forced?:       boolean;
  }): Promise<{ submissionId: string; submittedAt: string } | null> {

    const { participantId, contestId, orgId } = params;
    const lockKey = `quiz:locks:submit:${participantId}`;

    // 1. Acquire distributed lock (10s TTL)
    const locked = await redis.set(lockKey, '1', 'NX', 'PX', 10000);
    if (!locked) {
      // Another instance is processing — idempotent: return nothing, client will get ack
      return null;
    }

    try {
      // 2. Idempotency check
      const session = await redis.hgetall(`quiz:${contestId}:session:${participantId}`);
      if (session?.status === 'SUBMITTED') {
        const existing = await prisma.submission.findUnique({
          where:  { participantId },
          select: { id: true, submittedAt: true },
        });
        if (existing) {
          return { submissionId: existing.id, submittedAt: existing.submittedAt!.toISOString() };
        }
      }

      // 3. Read answers from Redis
      const answers = await redis.hgetall(`quiz:${contestId}:answers:${participantId}`);

      // 4. Get all questions for this contest to include skipped answers
      const contestQuestions = await prisma.contestQuestion.findMany({
        where:   { contestId },
        select:  { questionId: true },
      });

      const submittedAt = new Date();
      const startedAt   = session?.startedAt ? new Date(session.startedAt) : submittedAt;
      const timeTakenSecs = Math.floor((submittedAt.getTime() - startedAt.getTime()) / 1000);

      // 5. DB transaction
      const submission = await prisma.$transaction(async (tx) => {
        const sub = await tx.submission.create({
          data: {
            organizationId: orgId,
            participantId,
            contestId,
            status:         'SUBMITTED',
            submittedAt,
            timeTakenSecs,
            totalQuestions: contestQuestions.length,
          },
        });

        // Create Answer records for ALL questions (answered + skipped)
        await tx.answer.createMany({
          data: contestQuestions.map(cq => ({
            organizationId:   orgId,
            submissionId:     sub.id,
            questionId:       cq.questionId,
            selectedOptionId: answers[cq.questionId] || null,
            answeredAt:       answers[cq.questionId] ? submittedAt : null,
          })),
        });

        await tx.participant.update({
          where: { id: participantId },
          data:  { status: 'SUBMITTED' },
        });

        await tx.quizSession.update({
          where: { id: params.sessionId },
          data:  { endedAt: submittedAt, isActive: false },
        });

        return sub;
      });

      // 6. Update Redis session state
      await sessionService.markSubmitted(contestId, participantId);

      // 7. Cleanup waiting room set
      await redis.srem(`quiz:${contestId}:waiting_room`, participantId);

      // 8. Enqueue evaluation
      await queues.evaluation.add('evaluate-submission', {
        submissionId:  submission.id,
        contestId,
        participantId,
        orgId,
      });

      logger.info('quiz:submit:success', { participantId, submissionId: submission.id });

      return { submissionId: submission.id, submittedAt: submittedAt.toISOString() };

    } finally {
      await redis.del(lockKey);
    }
  },

  async forceSubmit(params: {
    participantId: string;
    contestId:     string;
    orgId:         string;
    reason:        string;
  }) {
    const session = await prisma.quizSession.findFirst({
      where:   { participantId: params.participantId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    await this.submit({
      participantId: params.participantId,
      contestId:     params.contestId,
      sessionId:     session?.id ?? '',
      orgId:         params.orgId,
      forced:        true,
    });
  },
};
```

---

### `src/modules/quiz/ws/services/broadcast.service.ts`

```typescript
import { redisPub } from '@/lib/redis';
import { quizNamespace } from '../quiz.gateway';

export const broadcastService = {

  // Broadcast to ALL participants in a contest (across all instances via Redis adapter)
  async toContest(contestId: string, event: string, payload: unknown): Promise<void> {
    quizNamespace.to(`contest:${contestId}`).emit(event, payload);
  },

  // Send to a specific participant (may be on any instance)
  // Uses Redis pub/sub personal channel (gateway subscribes on connect)
  async toParticipant(participantId: string, event: string, payload: unknown): Promise<void> {
    await redisPub.publish(
      `quiz:personal:${participantId}`,
      JSON.stringify({ type: event, payload }),
    );
  },

  // Schedule time warnings via Redis pub/sub to the contest room
  async scheduleTimeWarnings(contestId: string, endTimestamp: number): Promise<void> {
    const warnings = [600, 300, 60]; // seconds remaining — from config
    const now = Date.now();

    for (const secs of warnings) {
      const fireAt = endTimestamp - (secs * 1000);
      const delay  = fireAt - now;
      if (delay > 0) {
        setTimeout(() => {
          broadcastService.toContest(contestId, 'time-warning', { secondsRemaining: secs });
        }, delay);
        // NOTE: For production with multiple instances, use BullMQ delayed jobs instead of setTimeout
        // setTimeout is only safe on single-instance or if the instance manages the contest
      }
    }
  },
};
```

---

### `src/modules/quiz/ws/handlers/waiting-room.handler.ts`

```typescript
import { redis }          from '@/lib/redis';
import { prisma }         from '@/lib/prisma';
import { QuizSocket }     from '../../quiz.types';
import { sessionService } from '../services/session.service';
import { logger }         from '@/lib/logger';

export function waitingRoomHandler(socket: QuizSocket, redisClient: typeof redis) {
  return async (payload: { contestId: string }) => {
    const { participantId, contestId, sessionId, orgId } = socket.data;

    try {
      // Guard: contestId must match token claim
      if (payload.contestId !== contestId) {
        socket.emit('error', { code: 'WS_INVALID_PAYLOAD', message: 'Contest ID mismatch' });
        return;
      }

      // 1. Check existing session (reconnect scenario)
      const existing = await sessionService.getRedisSession(contestId, participantId);
      if (existing?.status === 'IN_QUIZ') {
        // Reconnecting during quiz — skip waiting room
        socket.join(`contest:${contestId}`);
        // questions handler will emit resume-quiz
        return;
      }

      if (existing?.status === 'SUBMITTED') {
        socket.emit('error', { code: 'WS_ALREADY_SUBMITTED', message: 'Already submitted' });
        return;
      }

      // 2. Check contest status (Redis first, DB fallback)
      const contestStatus = await redisClient.get(`quiz:${contestId}:status`);

      if (contestStatus === 'LIVE') {
        // Quiz already started — join and immediately signal quiz-started
        socket.join(`contest:${contestId}`);
        await redisClient.sadd(`quiz:${contestId}:waiting_room`, participantId);

        const contest = await prisma.contest.findUnique({
          where:  { id: contestId },
          select: { startTime: true, duration: true, _count: { select: { questions: true } } },
        });

        socket.emit('quiz-started', {
          contestId,
          totalQuestions:  contest!._count.questions,
          durationSeconds: contest!.duration * 60,
        });
        return;
      }

      if (!['PUBLISHED', 'REGISTRATION_CLOSED'].includes(contestStatus ?? '')) {
        // Fetch from DB if Redis key missing
        const contest = await prisma.contest.findUnique({
          where:  { id: contestId },
          select: { status: true, startTime: true, duration: true, _count: { select: { questions: true } } },
        });

        if (!contest || !['PUBLISHED', 'REGISTRATION_CLOSED', 'LIVE'].includes(contest.status)) {
          socket.emit('error', { code: 'WS_CONTEST_NOT_LIVE', message: 'Contest is not open' });
          return;
        }

        // Cache it
        await redisClient.set(`quiz:${contestId}:status`, contest.status, 'EX', 3600);

        if (contest.status === 'LIVE') {
          socket.join(`contest:${contestId}`);
          socket.emit('quiz-started', {
            contestId,
            totalQuestions:  contest._count.questions,
            durationSeconds: contest.duration * 60,
          });
          return;
        }
      }

      // 3. Add to waiting room
      socket.join(`contest:${contestId}`);
      await redisClient.sadd(`quiz:${contestId}:waiting_room`, participantId);
      await redisClient.expire(`quiz:${contestId}:waiting_room`, 86400);

      // Create/refresh Redis session
      await sessionService.createRedisSession({
        participantId,
        contestId,
        sessionId,
        orgId,
        socketId:  socket.id,
        ipAddress: socket.handshake.address,
      });

      const waitingCount = await redisClient.scard(`quiz:${contestId}:waiting_room`);
      const contest = await prisma.contest.findUnique({
        where:  { id: contestId },
        select: { startTime: true },
      });

      socket.emit('joined-waiting-room', {
        waitingCount,
        startsAt: contest!.startTime.toISOString(),
      });

      logger.info('quiz:waiting-room:joined', { participantId, contestId, waitingCount });

    } catch (err) {
      logger.error('quiz:waiting-room:error', { err, participantId, contestId });
      socket.emit('error', { code: 'INTERNAL_ERROR', message: 'Something went wrong' });
    }
  };
}
```

---

### `src/modules/quiz/ws/handlers/submit.handler.ts`

```typescript
import { QuizSocket }   from '../../quiz.types';
import { submitService } from '../services/submit.service';
import { logger }        from '@/lib/logger';

export function submitHandler(socket: QuizSocket, redis: any, queues: any) {
  return async (payload: { contestId: string }) => {
    const { participantId, contestId, sessionId, orgId } = socket.data;

    if (payload.contestId !== contestId) {
      socket.emit('error', { code: 'WS_INVALID_PAYLOAD', message: 'Contest ID mismatch' });
      return;
    }

    try {
      const result = await submitService.submit({ participantId, contestId, sessionId, orgId });

      if (result) {
        socket.emit('submission-ack', result);
        socket.leave(`contest:${contestId}`);
        logger.info('quiz:submit:ack-sent', { participantId, submissionId: result.submissionId });
      }
      // If result is null: lock was held by another instance — client will get ack from that instance

    } catch (err) {
      logger.error('quiz:submit:error', { err, participantId });
      socket.emit('error', { code: 'SUBMIT_FAILED', message: 'Submission failed, please retry' });
    }
  };
}
```

---

### `src/modules/quiz/jobs/quiz.queues.ts`

```typescript
import { Queue } from 'bullmq';
import { redis }  from '@/lib/redis';
import { config } from '@/config';

const connection = redis; // BullMQ uses ioredis

export const queues = {
  evaluation: new Queue('quiz-evaluation', {
    connection,
    defaultJobOptions: {
      attempts:    config.queue.RETRY_ATTEMPTS,
      backoff:     { type: 'exponential', delay: 2000 },
      removeOnComplete: 100,
      removeOnFail:     50,
    },
  }),

  autoSubmit: new Queue('quiz-auto-submit', {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff:  { type: 'exponential', delay: 5000 },
    },
  }),

  proctoringScore: new Queue('proctoring-score', {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff:  { type: 'fixed', delay: 1000 },
    },
  }),
};
```

---

### `src/modules/quiz/jobs/quiz.schedulers.ts`

Called when a contest is **published**. Schedules all time-critical BullMQ jobs.

```typescript
import { queues }  from './quiz.queues';
import { prisma }  from '@/lib/prisma';
import { config }  from '@/config';

export async function scheduleQuizJobs(contestId: string): Promise<void> {
  const contest = await prisma.contest.findUnique({
    where:  { id: contestId },
    select: { startTime: true, endTime: true, duration: true, organizationId: true },
  });
  if (!contest) throw new Error(`Contest ${contestId} not found`);

  const now = Date.now();

  // 1. Quiz start job — transitions REGISTRATION_CLOSED → LIVE
  //    Broadcasts quiz-started to all sockets in contest room
  const startDelay = contest.startTime.getTime() - now;
  if (startDelay > 0) {
    await queues.autoSubmit.add(
      'quiz-start',
      { contestId, orgId: contest.organizationId, action: 'START' },
      { delay: startDelay, jobId: `quiz-start-${contestId}` },
    );
  }

  // 2. Auto-submit job — fires at endTime + buffer
  const endDelay = contest.endTime.getTime() - now + (config.quiz.AUTOSUBMIT_BUFFER_SECS * 1000);
  if (endDelay > 0) {
    await queues.autoSubmit.add(
      'force-submit-contest',
      { contestId, orgId: contest.organizationId, action: 'FORCE_SUBMIT' },
      { delay: endDelay, jobId: `quiz-force-submit-${contestId}` },
    );
  }

  // 3. Registration-close job — transitions PUBLISHED → REGISTRATION_CLOSED
  // (Handled by contest module scheduler — not quiz module's responsibility)
}
```

---

### `src/modules/quiz/workers/evaluation.worker.ts`

```typescript
import { Worker, Job } from 'bullmq';
import { prisma }      from '@/lib/prisma';
import { redis }       from '@/lib/redis';
import { queues }      from '../jobs/quiz.queues';
import { config }      from '@/config';
import { logger }      from '@/lib/logger';

interface EvalJobPayload {
  submissionId:  string;
  contestId:     string;
  participantId: string;
  orgId:         string;
}

async function evaluationProcessor(job: Job<EvalJobPayload>) {
  const { submissionId, contestId, orgId } = job.data;

  logger.info('eval:start', { submissionId, contestId });

  // 1. Fetch submission + answers
  const submission = await prisma.submission.findUniqueOrThrow({
    where:   { id: submissionId },
    include: { answers: true },
  });

  // 2. Fetch scoring key for this contest
  const contestQuestions = await prisma.contestQuestion.findMany({
    where:   { contestId },
    include: {
      question: {
        include: {
          options: { where: { isCorrect: true }, select: { id: true } },
        },
      },
    },
  });

  const answerKey = new Map(
    contestQuestions.map(cq => [
      cq.questionId,
      {
        correctOptionId: cq.question.options[0]?.id ?? null,
        marks:           cq.marks,
        negativeMark:    Number(cq.negativeMark),
      },
    ])
  );

  // 3. Score
  let totalScore    = 0;
  let totalPossible = 0;
  let correct = 0, wrong = 0, skipped = 0;

  const answerUpdates: Array<{
    id:           string;
    isCorrect:    boolean;
    marksAwarded: number;
  }> = [];

  for (const answer of submission.answers) {
    const key = answerKey.get(answer.questionId);
    if (!key) continue;

    totalPossible += key.marks;

    if (!answer.selectedOptionId) {
      skipped++;
      answerUpdates.push({ id: answer.id, isCorrect: false, marksAwarded: 0 });
    } else if (answer.selectedOptionId === key.correctOptionId) {
      correct++;
      totalScore += key.marks;
      answerUpdates.push({ id: answer.id, isCorrect: true, marksAwarded: key.marks });
    } else {
      wrong++;
      const deduction = key.negativeMark;
      totalScore -= deduction;
      answerUpdates.push({ id: answer.id, isCorrect: false, marksAwarded: -deduction });
    }
  }

  const finalScore  = Math.max(0, totalScore);
  const percentage  = totalPossible > 0 ? (finalScore / totalPossible) * 100 : 0;

  // 4. DB transaction — update submission + all answers
  await prisma.$transaction([
    prisma.submission.update({
      where: { id: submissionId },
      data: {
        status:     'EVALUATED',
        correct,
        wrong,
        skipped,
        attempted:  correct + wrong,
        score:      finalScore,
        percentage: parseFloat(percentage.toFixed(2)),
        totalQuestions: submission.answers.length,
        evaluatedAt:    new Date(),
      },
    }),
    ...answerUpdates.map(u =>
      prisma.answer.update({
        where: { id: u.id },
        data:  { isCorrect: u.isCorrect, marksAwarded: u.marksAwarded },
      })
    ),
  ]);

  logger.info('eval:complete', { submissionId, score: finalScore, correct, wrong, skipped });

  // 5. Check if all submissions for this contest are evaluated
  const [totalSubmissions, evaluatedCount] = await Promise.all([
    prisma.submission.count({ where: { contestId, status: { not: 'PENDING' } } }),
    prisma.submission.count({ where: { contestId, status: 'EVALUATED' } }),
  ]);

  if (evaluatedCount >= totalSubmissions) {
    // Trigger leaderboard computation (separate module)
    await redis.publish('leaderboard:compute', JSON.stringify({ contestId, orgId }));
    logger.info('eval:all-done:triggering-leaderboard', { contestId });
  }
}

export const evaluationWorker = new Worker(
  'quiz-evaluation',
  evaluationProcessor,
  {
    connection:  redis,
    concurrency: config.quiz.EVAL_QUEUE_CONCURRENCY,
  }
);

evaluationWorker.on('failed', (job, err) => {
  logger.error('eval:job-failed', { jobId: job?.id, err });
});
```

---

### `src/lib/shuffle.ts`

```typescript
// Deterministic PRNG utilities
// Same seed → always same result — critical for reconnect correctness

export function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703, h2 = 3144134277,
      h3 = 1013904242, h4 = 2773480762;
  for (let i = 0, k; i < str.length; i++) {
    k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [
    (h1 ^ h2 ^ h3 ^ h4) >>> 0,
    (h2 ^ h1)           >>> 0,
    (h3 ^ h1)           >>> 0,
    (h4 ^ h1)           >>> 0,
  ];
}

export function mulberry32(a: number) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(arr: T[], seed: string): T[] {
  const [s] = cyrb128(seed);
  const rand = mulberry32(s);
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
```

---

## Summary — Critical Design Decisions

| Decision | What | Why |
|---|---|---|
| Redis as source of truth during quiz | All answers, session state, heartbeats in Redis | Sub-millisecond writes; DB can't handle 10k concurrent answer saves |
| Seeded PRNG for shuffle | Deterministic by `participantId + contestId + SALT` | Reconnect returns same question order without Redis |
| Distributed NX lock on submit | `quiz:locks:submit:{participantId}` | Prevents double-submission from reconnect + auto-submit race |
| Personal Redis pub/sub channel | `quiz:personal:{participantId}` | Session invalidation works across multiple API instances |
| Socket token TTL = contest endTime + buffer | JWT expires after contest ends | Token is valid for entire quiz duration, not just 30 minutes |
| No business logic in WS handlers | All logic in services | Handlers only validate + delegate; testable services |
| BullMQ for evaluation | All heavy work is async | HTTP/WS threads never block on scoring |
| No DB writes in `save-progress` | Redis only | 10,000 answers/sec is impossible in Postgres; Redis handles it |
| Batch answer flush at submit | All answers written in one DB transaction | Single atomic write; consistent submission state |
| `transports: ['websocket']` | No long-polling | No sticky sessions needed; instances are truly stateless |
