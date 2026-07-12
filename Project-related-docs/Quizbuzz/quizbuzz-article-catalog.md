# QuizBuzz Knowledge Base → Technical Article Catalog

Every story below is traceable to a specific section of `quizbuzz-engineering-knowledge-base.md`. I've excluded stories that don't have enough independent narrative weight to stand alone (e.g., the ts-node/tsconfig fix, the IPv4/IPv6 tunnel fix) — those appear as supporting beats *inside* other articles rather than as their own piece. One honest caveat before the list: several "Final implementation" claims in the source material are flagged there as "not yet implemented" or "not yet re-tested" (sticky sessions, slower ramp, ASG memory-based scaling, the 503 back-pressure endpoint, the Route53 fix). I've marked those articles **[UNVALIDATED]** — they're still good articles, but the honest framing is "here's the design and reasoning" rather than "here's what we shipped and the after-numbers," until you've actually run the next test and have real before/after data.

---

## Article 1
**Title:** "The Two-Redis Trap: How a Mode Switch Silently Killed Our Quiz Start Jobs"
**Audience:** Senior backend engineers, infra/platform engineers, anyone building dual-mode (cost-saving) infrastructure
**Difficulty:** Advanced
**Estimated reading time:** 9–11 min
**Key engineering lesson:** A system that switches its source of truth based on runtime mode needs either a single arbiter every script consults, or automatic data migration at the switch boundary — "remember to run X after Y" is not a real safeguard under time pressure.
**Architecture diagrams needed:**
- Idle vs. live Redis topology (admin EC2 local Redis vs. ElastiCache)
- Timeline diagram showing job enqueued → mode switch → job orphaned
- The `go-live.sh` sequence with the migration step inserted
**Metrics to include:** Time-to-detect (how many test cycles before root cause was found), job loss count per incident, the per-participant Redis memory budget table used to size the migration safety margin (256MB limit vs ~54MB worst case = 4.8x headroom)
**Production incidents to discuss:** The repeated "contest LIVE but nobody moves to IN QUIZ" failure across multiple test attempts; the manual `trigger-contest-start.js` workaround used live, twice, mid-incident
**Code snippets worth showing:** The `redis-migrate.js` DUMP/RESTORE pattern with dry-run-by-default; the `docker cp` + `docker exec` SSM pattern that guarantees script execution context matches the container's actual `REDIS_HOST`
**Interview questions this prepares you for:**
- "Tell me about a time you found and fixed a hard-to-reproduce production bug."
- "How would you design a system with two different infrastructure modes (cost-optimized vs. full-scale)?"
- "What's a time your mental model of a system was wrong, and how did you find out?"
**Rank rationale:** This is the single best story in the entire knowledge base — a real architectural blind spot, diagnosed correctly by reasoning (not by guessing), with both an immediate hotfix and a generalized permanent fix, plus a capacity-sizing follow-through. It has narrative arc, technical depth, and a clean "here's the principle" takeaway.

---

## Article 2
**Title:** "Reverse-Engineering Socket.IO's Wire Protocol to Load-Test 10,000 WebSocket Connections with k6"
**Audience:** Backend engineers working with Socket.IO, performance/load-testing engineers, anyone who's hit "k6 doesn't support Socket.IO natively"
**Difficulty:** Advanced
**Estimated reading time:** 10–12 min
**Key engineering lesson:** A successful WebSocket handshake (HTTP 101) does not mean your application protocol is being spoken correctly — there are independent layers (transport, framing, namespace, application event) that each need separate verification.
**Architecture diagrams needed:**
- The EIO4 frame sequence diagram (0{...} → 40/ns,{token} → 40/ns,{sid} → 42/ns,[event,data] → ping/pong)
- Before/after: k6 sending raw JSON vs. k6 speaking EIO4 frames
**Metrics to include:** ws_connect_success_rate before (50%) and after (near 100%) the fix; Live Monitor showing 0 participants vs. 50/50 IN QUIZ
**Production incidents to discuss:** The 50% WS connect-success threshold failure that initially looked like an infra problem but was a pure protocol bug; confirmed via manual curl handshake that infra was fine
**Code snippets worth showing:** The full `runQuizSession()` state machine — `namespaceAcked` gate before sending any application event, the byte-prefix branching logic, the PING/PONG keepalive handler
**Interview questions this prepares you for:**
- "Walk me through debugging a WebSocket issue in production."
- "How do load-testing tools handle protocols they don't natively support?"
- "Tell me about a time you had to read a protocol spec / reverse-engineer behavior instead of relying on documentation."
**Rank rationale:** Extremely strong, highly technical, demonstrates protocol-level systems thinking that most engineers never have to do. The "wrote a state machine by hand because the tool didn't support the protocol" angle is a great senior-level story.

---

## Article 3
**Title:** "From 42 Minutes to 4 Seconds: A Database Seeding Performance Postmortem"
**Audience:** Backend/data engineers, anyone using an ORM for bulk operations
**Difficulty:** Intermediate
**Estimated reading time:** 7–9 min
**Key engineering lesson:** ORMs are often the wrong tool for bulk operations — both because they default to N+1-style round-trips and because their raw-query escape hatches can have their own parameter-binding bugs. For bulk SQL, go around the ORM, not through it.
**Architecture diagrams needed:**
- Sequence diagram: original 3-round-trips-per-batch × 50 batches × sequential flow
- Sequence diagram: bulk INSERT × 4 concurrent batches flow
**Metrics to include:** The full before/after table (3 round trips → 2 SQL calls; 200 batch size → 500; 0 concurrency → 4; 42min → 4.1s, a 630x improvement)
**Production incidents to discuss:** The interactive-transaction-timeout failure over the SSH tunnel (30,239ms vs 30,000ms limit) as the symptom that triggered the investigation
**Code snippets worth showing:** Before (Prisma `$transaction([...200 upserts])`) vs. after (raw `pg.Pool` bulk `INSERT...VALUES...ON CONFLICT DO NOTHING`); the deterministic `QB-LOAD-000001` ref generator replacing the timestamp-based one
**Interview questions this prepares you for:**
- "Tell me about a performance optimization you're proud of — what was the before/after?"
- "How do you approach diagnosing a slow database operation?"
- "When would you bypass your ORM and write raw SQL?"
**Rank rationale:** Clean, quantifiable, classic "senior engineer optimizes a script" story with a dramatic and easily-stated number (630x). Very portfolio-friendly because the before/after is so concrete.

---

## Article 4
**Title:** "Two Bugs Hiding in One Symptom: Bulk SQL Parameter Binding and registrationRef Collisions"
**Audience:** Backend engineers working with Postgres/Prisma, anyone debugging "duplicate key" or parameter-count errors
**Difficulty:** Intermediate–Advanced
**Estimated reading time:** 6–8 min
**Key engineering lesson:** Concurrency exposes uniqueness assumptions that look safe in sequential testing — anything keyed on `Date.now()` is not actually unique once you have more than one writer per millisecond.
**Architecture diagrams needed:** Timeline showing 4 concurrent batches computing colliding refs within the same millisecond
**Metrics to include:** Postgres error codes (08P01, 23505) as the diagnostic signal; parameter count (1503 params, 3 expected) as the specific clue that led to the root cause
**Production incidents to discuss:** Both the `$executeRawUnsafe` mis-binding and the registrationRef collision, since they were found and fixed back-to-back during the same optimization pass
**Code snippets worth showing:** The mixed-anchor-and-VALUES-table parameter pattern that broke; the index-deterministic ref generator that replaced timestamp-based generation
**Interview questions this prepares you for:**
- "Tell me about a subtle concurrency bug you've fixed."
- "How do you choose a strategy for generating unique identifiers?"
**Rank rationale:** Good supporting technical depth, but narrower in scope than Articles 1–3 — best framed as a tight, focused "two related gotchas" piece rather than a flagship article.

---

## Article 5
**Title:** "When the Health Check Lies: Why CPU-Based Autoscaling Failed Our WebSocket Quiz App"
**Audience:** Infra/SRE engineers, anyone running stateful/long-lived-connection workloads on AWS ASG
**Difficulty:** Advanced
**Estimated reading time:** 8–10 min
**Key engineering lesson:** Autoscaling triggers must match your workload's actual bottleneck resource — CPU-based scaling is structurally wrong for memory/IO-bound, long-lived-connection workloads, and the failure mode (scale-out arrives only after the crash) is worse than no autoscaling at all.
**Architecture diagrams needed:**
- CPU% vs heap% over time during the incident (conceptual, even if reconstructed)
- The three scaling-trigger options (memory alarm, custom connection-count metric, pre-warming) as a decision tree
**Metrics to include:** "15-20% CPU while heap at 90%+"; ASG health-check grace period (420s/7min) vs. typical quiz session length; the pre-warming formula (`INSTANCES = ceil(PARTICIPANTS / 800)`)
**Production incidents to discuss:** The live incident where a third instance launched too late, both original instances had already OOM'd, and the admin dashboard itself became unresponsive
**Code snippets worth showing:** The pre-warming `aws autoscaling set-desired-capacity` snippet in `go-live.sh`
**Interview questions this prepares you for:**
- "How would you design autoscaling for a stateful/connection-heavy service?"
- "Tell me about a time a monitoring/alerting signal was misleading."
- "CPU-based vs. custom-metric-based autoscaling — when would you use each?"
**Rank rationale: [UNVALIDATED]** — the diagnosis is excellent and very interview-worthy, but the fix itself wasn't implemented in this session. Frame as "the investigation and the design," not "the fix and the results," until re-tested.

---

## Article 6
**Title:** "Why Doesn't My Server Just Say 'I'm Full'? Designing Back-Pressure for Load Balancers"
**Audience:** Mid-to-senior backend/infra engineers, system design interview prep
**Difficulty:** Advanced
**Estimated reading time:** 7–9 min
**Key engineering lesson:** Standard ALB health checks are a single binary liveness signal with no concept of readiness/capacity — a process can be "alive" and still return 200 on `/health` while genuinely unable to serve real traffic, because health checks are cheap enough to sneak through GC pauses that kill real requests.
**Architecture diagrams needed:** Liveness vs. readiness distinction diagram (conceptually borrowed from k8s, applied to ALB's single-endpoint limitation); the proposed `/health` decision logic (connection count / heap% / DB pool depth → 503)
**Metrics to include:** Proposed thresholds (90% of max connections, 85% heap, DB pool waiting > 5); 3-consecutive-failure requirement vs. ALB default of 2
**Production incidents to discuss:** Same OOM/scale-out-too-late incident as Article 5, but framed from the "what should the instance itself have done" angle rather than the "what should the ASG trigger have been" angle
**Code snippets worth showing:** The proposed `/health` handler with the three capacity checks
**Interview questions this prepares you for:**
- "Design a system that gracefully handles overload."
- "What's the difference between liveness and readiness probes?"
- "How would you prevent cascading failures when one instance becomes overloaded?"
**Rank rationale: [UNVALIDATED]** — this is a "design discussion" article, not an "implemented and measured" article. Still extremely strong for system-design interview prep precisely because it's a real, specific, reasoned design rather than a textbook answer.

---

## Article 7
**Title:** "The AUTO_SUBMIT Bug: How an OOM Crash Caused Silent Data Loss for 1,100 Quiz Participants"
**Audience:** Backend engineers, anyone building systems with Redis-backed ephemeral state + crash recovery
**Difficulty:** Advanced
**Estimated reading time:** 8–10 min
**Key engineering lesson:** A function that reads "active" state to decide what to act on must also account for every other terminal/intermediate state your failure modes can produce — an ungraceful crash skips your happy-path cleanup code, and your recovery logic needs to assume that.
**Architecture diagrams needed:** State diagram of the participant lifecycle (waiting → active → [disconnected | submitted]) showing the crash path that bypasses the normal active→disconnected transition cleanup
**Metrics to include:** The headline number — only 140 of ~1,323 peak "IN QUIZ" participants ended up submitted; the batched-Promise.allSettled fix processing in groups of 50
**Production incidents to discuss:** The full incident: OOM crash → ungraceful process death → disconnect handlers never run → AUTO_SUBMIT reads only `active` SET → ~1,100 participants' answers never persisted
**Code snippets worth showing:** Before/after of `handleTimeExpiry()` — single-SET read vs. the `Promise.all([active, disconnected])` + dedup + batched submission
**Interview questions this prepares you for:**
- "Tell me about a data-loss incident you've debugged and fixed."
- "How do you design recovery logic for ungraceful process crashes?"
- "Tell me about a bug where the root cause was several steps removed from the symptom."
**Rank rationale:** One of the strongest stories in the whole set — real measured data loss, a precise causal chain spanning infra (OOM) → runtime (crash) → app logic (incomplete state read) → business impact (lost submissions), and a clean, already-implemented fix. The user's own quote ("if we didn't trigger the start, it wouldn't have triggered the end either") is a great pull-quote showing pattern-matching instinct.

---

## Article 8
**Title:** "Polling vs. Sustained Connections: Why '10,000 Concurrent Users' Means Different Things"
**Audience:** Engineers/architects evaluating WebSocket scaling claims, technical decision-makers, system design interview prep
**Difficulty:** Intermediate–Advanced
**Estimated reading time:** 7–8 min
**Key engineering lesson:** "Concurrent users" is not a well-defined metric without specifying connection duration and overlap — a system handling 10,000 short-lived, rapidly-cycling connections is solving a fundamentally different problem than one holding 10,000 connections open simultaneously for an hour.
**Architecture diagrams needed:** Connection-duration histogram comparison (polling app: 2-5 min bursts vs. quiz app: 30-120 min sustained, all overlapping)
**Metrics to include:** The capacity table (1-2k comfortable / ~5k tight / 10k unrealistic on t3.medium for sustained connections); the heartbeat-callback math (667 callbacks/sec at 10k participants on 15s intervals)
**Production incidents to discuss:** None directly — this is an architecture-decision article, framed around the moment of reading an external benchmark and correctly identifying why it didn't transfer
**Code snippets worth showing:** None essential — this is a reasoning/estimation piece, could include the back-of-envelope memory math table from the knowledge base
**Interview questions this prepares you for:**
- "How would you estimate capacity for a new workload?"
- "Critique this benchmark/case study — does it apply to our use case?"
- "Tell me about a time you had to push back on an assumption using first-principles reasoning."
**Rank rationale:** Strong conceptual piece, very good for demonstrating judgment rather than just technical execution. Slightly softer because the capacity table is explicitly a "rough estimate," not measured data — frame accordingly.

---

## Article 9
**Title:** "Building a Threshold-Based Cost Model: When to Pay for Autoscaling Infrastructure"
**Audience:** Engineering managers, technical leads making infra cost/scale tradeoffs, startup engineers
**Difficulty:** Intermediate
**Estimated reading time:** 6–7 min
**Key engineering lesson:** Infrastructure decisions should be driven by a concrete, defensible threshold derived from actual capacity analysis — not a binary "always provision for the worst case" or "always run cheap" choice.
**Architecture diagrams needed:** Cost-vs-scale curve showing the always-on baseline plus the per-event marginal cost above the threshold
**Metrics to include:** ~2,000 participant threshold; ~$15-30/contest-day marginal live-infra cost; framing as client-facing guidance
**Production incidents to discuss:** None — pairs naturally as a "part 2" to Article 8
**Code snippets worth showing:** None essential, maybe the `go-live.sh` participant-count parameter usage
**Interview questions this prepares you for:**
- "How do you balance engineering cost against infrastructure cost?"
- "Tell me about a build-vs-buy or scale-up-vs-stay-simple decision you've made."
**Rank rationale:** Good business-engineering-bridge article, useful for portfolio breadth (shows you think about cost, not just performance), but lower technical depth than the top tier.

---

## Article 10
**Title:** "Debugging a Cookie That Wouldn't Stick: A Domain Migration Leftover That Broke Login Under Load"
**Audience:** Web/backend engineers, anyone who's done a domain migration
**Difficulty:** Intermediate
**Estimated reading time:** 5–6 min
**Key engineering lesson:** Stale configuration values survive silently until a specific routing path exercises them — this bug only manifested because the ALB's `/api/*` rule routed admin auth traffic to the quiz fleet (which had the stale config) instead of the admin instance.
**Architecture diagrams needed:** Request routing diagram showing `/api/*` going to quiz-tg instead of admin-tg, and why that mattered for cookie domain
**Metrics to include:** None numeric — this is a config-bug-diagnosis story
**Production incidents to discuss:** Admin dashboard login succeeding (200) but `/me` and `/refresh` failing with 401, diagnosed via DevTools `Set-Cookie` header inspection
**Code snippets worth showing:** The `COOKIE_DOMAIN` diff, and the live `sed` + `docker compose up -d --force-recreate` hotfix pattern
**Interview questions this prepares you for:**
- "Tell me about a config-related bug you've debugged using browser DevTools."
- "Walk me through your process for diagnosing an auth failure."
**Rank rationale:** Solid, relatable mid-tier story — good for showing methodical debugging (DevTools inspection) but the root cause is a known class of bug (stale config), not a novel architectural insight.

---

## Article 11
**Title:** "noeviction Isn't a Default: The ElastiCache Parameter Group That Wasn't Attached"
**Audience:** Backend engineers using Redis/BullMQ, infra engineers working with Terraform + ElastiCache
**Difficulty:** Intermediate
**Estimated reading time:** 5–6 min
**Key engineering lesson:** Defining a correct Terraform resource isn't the same as wiring it up — an `aws_elasticache_parameter_group` with the right settings does nothing if it's never attached via `parameter_group_name` on the replication group, and these errors won't show up at `plan` time.
**Architecture diagrams needed:** None essential, maybe a small diagram of the parameter group → replication group attachment
**Metrics to include:** None numeric — log-message-driven diagnosis (`IMPORTANT! Eviction policy is volatile-lru`)
**Production incidents to discuss:** Worker log spam as the symptom; the explanation of why `volatile-lru` specifically threatens BullMQ's TTL'd internal metadata keys
**Code snippets worth showing:** The before/after Terraform diff adding the missing `parameter_group_name` attribute
**Interview questions this prepares you for:**
- "Tell me about a Terraform/IaC bug where the resource was 'correct' but not actually applied."
- "How does Redis eviction policy interact with job queues like BullMQ?"
**Rank rationale:** Good, tight, single-cause-single-fix story. Useful but narrower scope — best as a shorter companion piece rather than a flagship.

---

## Article 12
**Title:** "Importing Orphaned Infrastructure: Recovering from a Partial Terraform Apply"
**Audience:** Infra/DevOps engineers, Terraform users
**Difficulty:** Intermediate–Advanced
**Estimated reading time:** 6–7 min
**Key engineering lesson:** When Terraform state and real-world AWS state diverge because an apply was interrupted, the fix is `plan` (to see exactly what's missing) plus targeted `import` (to adopt orphaned-but-real resources) — not blind re-apply, and not destroy/recreate.
**Architecture diagrams needed:** Diagram of "intended state vs Terraform state vs actual AWS state" as three overlapping but non-identical sets
**Metrics to include:** "6 to add, 0 to change, 0 to destroy" as the clean plan output that confirmed the fix
**Production incidents to discuss:** `https://ysmquizbuzz.com` timing out entirely while the ALB showed Active — the missing HTTPS listener and listener rules silently absent from state; the compounding Route53 CNAME-already-exists error during the fix attempt
**Code snippets worth showing:** The `terraform import 'module.dns.aws_route53_record.acm_validation["..."]' '...'` command and the resulting clean plan
**Interview questions this prepares you for:**
- "Tell me about a time infrastructure-as-code drifted from reality, and how you fixed it."
- "When would you use terraform import vs. destroy-and-recreate?"
**Rank rationale:** Strong, very concrete IaC story with a clean diagnostic methodology (state-file inspection → plan → import → apply). Good technical depth for an infra-focused portfolio piece.

---

## Article 13
**Title:** "The Route53 'Already Exists' Trap: Why count-Gated Resources Need an Adoption Path" **[UNVALIDATED / OPEN ISSUE]**
**Audience:** Terraform users, infra engineers
**Difficulty:** Intermediate
**Estimated reading time:** 5–6 min
**Key engineering lesson:** A `count`-gated Terraform resource with no corresponding `data` lookup or import strategy has no way to reconcile against a real-world resource that already exists — you need either a pre-flight import step, a `data` source check, or a deliberate lifecycle redesign.
**Architecture diagrams needed:** Decision tree of the three considered fixes (script-level import, lifecycle redesign, `data` source lookup + conditional create)
**Metrics to include:** None — this article should honestly be framed as "the diagnosis and the options," since no fix had shipped yet
**Production incidents to discuss:** The `go-idle` failure: `InvalidChangeBatch: [name='ysmquizbuzz.com.', type='A'] already exists`
**Code snippets worth showing:** The failing resource block; sketches of each of the three proposed fixes
**Interview questions this prepares you for:**
- "How do you handle Terraform resources that might already exist outside of state?"
- "Walk me through a currently-open bug you're working on and how you're thinking about the fix."
**Rank rationale: [UNVALIDATED]** — genuinely useful as a "here's how I think about an open problem" interview story (shows reasoning in real time), but it's not a finished postmortem. Don't publish this as a "we fixed it" piece until it's actually fixed.

---

## Article 14
**Title:** "Rate Limiters in the Wrong Place: When Defense-in-Depth Becomes Self-Inflicted Denial of Service"
**Audience:** Backend engineers implementing auth/rate-limiting
**Difficulty:** Intermediate
**Estimated reading time:** 5–6 min
**Key engineering lesson:** Rate-limiting middleware needs to be reasoned about per-endpoint based on what it's actually protecting — applying a generic OTP limiter to an endpoint that doesn't use OTP isn't "extra safety," it's a bug that happens to be invisible until concurrent load from a shared IP exposes it.
**Architecture diagrams needed:** None essential
**Metrics to include:** 5 requests/window/IP limit vs. 1000+ k6 VUs sharing one IP
**Production incidents to discuss:** The cascading 429 failures during load testing; the secondary discovery of the `windowMs` unit bug (ms vs. sec) found via a deliberate side-by-side audit of every rate limiter in the codebase
**Code snippets worth showing:** The route definition before/after removing the misapplied limiter; the `windowMs * 1000` unit fix in two separate files
**Interview questions this prepares you for:**
- "Tell me about a security/safety mechanism that backfired."
- "How do you audit a codebase for a class of bug, not just one instance?"
**Rank rationale:** Good mid-tier story, nice because it shows a *process* lesson (audit-the-whole-class-of-bug, not just patch-the-symptom) in addition to the specific fix.

---

## Article 15
**Title:** "What Load-Testing a WebSocket App Taught Us About Test Methodology Itself"
**Audience:** QA/performance engineers, backend engineers running their first load tests
**Difficulty:** Intermediate
**Estimated reading time:** 7–8 min
**Key engineering lesson:** Load-testing tooling and methodology have their own failure modes independent of the system under test — cancel/restart patterns, ramp speed, and stale test-data assumptions can all manufacture false signals that look like production bugs.
**Architecture diagrams needed:** Timeline showing overlapping deregistration windows from a cancelled Stage 1 colliding with a freshly-started Stage 2
**Metrics to include:** 300s ALB deregistration delay; 30s vs 120s ramp profile (33 vs 8 logins/sec)
**Production incidents to discuss:** The deliberate cancel/restart experimentation and its compounding effect; the `NOT_REGISTERED` mass-failure initially suspected to be a laptop/network issue, actually a stale contest-ID mismatch
**Code snippets worth showing:** None essential — this is a methodology/process article, could include the `participant.count` verification query as a "do this before every run" checklist item
**Interview questions this prepares you for:**
- "Tell me about a time your test results were misleading and why."
- "How do you design a load test that gives you trustworthy signal?"
**Rank rationale: [PARTIALLY UNVALIDATED]** — the diagnoses are solid and already happened, but the "fixes" (slower ramp, don't cancel/restart) are recommendations not yet re-validated by a clean run. Frame as lessons learned, not as "and then it worked perfectly."

---

## Article 16
**Title:** "Sizing a Redis Safety Net: A Memory Budget for Mid-Migration Data"
**Audience:** Backend/infra engineers working with Redis at scale
**Difficulty:** Intermediate
**Estimated reading time:** 5–6 min
**Key engineering lesson:** When asked "is this safe," do the actual math rather than reasoning from intuition — a structured per-record memory budget (broken into specific Redis data structures) turns a vague worry into a verifiable headroom number.
**Architecture diagrams needed:** The per-participant data-structure breakdown table as a visual (session hash / answers hash / question-order list / meta / readiness / set memberships)
**Metrics to include:** ~18.6 KB/participant; ~54 MB worst case for 1,000 participants; 256 MB configured limit → 4.8x headroom
**Production incidents to discuss:** None directly — this was a proactive capacity-planning exercise prompted by the user's explicit question, not a reactive incident
**Code snippets worth showing:** None essential, the memory budget table itself is the artifact
**Interview questions this prepares you for:**
- "How do you size memory/capacity for a Redis-backed system?"
- "Walk me through how you'd answer 'is this safe' with actual numbers instead of a guess."
**Rank rationale:** Nice example of rigorous estimation methodology, but it's a single calculation rather than a full incident — works best as a section within Article 1 (the Redis migration story) rather than its own full article, unless you want a short "how I estimate capacity" piece.

---

## Article 17
**Title:** "File Descriptors, ulimits, and the Silent Failure Mode Nobody Logs"
**Audience:** Backend/infra engineers running containerized Node.js at scale
**Difficulty:** Intermediate
**Estimated reading time:** 4–5 min
**Key engineering lesson:** Some resource limits (file descriptors) don't produce clean error messages when exhausted — they manifest as mysterious connection failures, which means proactively reading about other people's failure modes and pre-empting them is sometimes the only way to catch a class of bug before it bites you in production.
**Architecture diagrams needed:** None essential
**Metrics to include:** `65536` ulimit value chosen, with reasoning for why it's set before Docker starts
**Production incidents to discuss:** This was proactive, not reactive — found by reading an external case study (QuestionPro's "scaling LivePolls" writeup) and cross-checking the codebase for the equivalent gap, not from an observed crash
**Code snippets worth showing:** The `/etc/security/limits.d/` config and the matching systemd `LimitNOFILE` override for the Docker daemon, with the ordering requirement explained
**Interview questions this prepares you for:**
- "Tell me about a bug class you fixed proactively, before it caused an incident."
- "What OS-level resource limits matter for a high-connection-count service?"
**Rank rationale:** Short, useful, demonstrates good engineering instinct (learning from others' incidents) but it's the smallest/lowest-depth story in the set — good as a quick blog post, not a flagship piece.

---

## Article 18
**Title:** "A Sticky Situation: Why Disabling Session Affinity Made a Crash Worse"
**Audience:** Infra engineers, anyone running stateful services behind a load balancer
**Difficulty:** Intermediate
**Estimated reading time:** 5–6 min
**Key engineering lesson:** Even when your application architecture makes session affinity technically optional (e.g., Redis-backed shared state), it still changes your *failure* characteristics — without stickiness, a crashed instance's reconnecting clients scatter unpredictably and can pile onto a still-healthy neighbor rather than being absorbed gradually.
**Architecture diagrams needed:** Before/after diagram of reconnect distribution with and without sticky sessions
**Metrics to include:** `lb_cookie`, 86400s duration as the proposed config
**Production incidents to discuss:** Discovered via AWS console screenshot during the OOM incident triage, not as a standalone investigation
**Code snippets worth showing:** The Terraform stickiness config block
**Interview questions this prepares you for:**
- "When do you use session affinity even with a stateless-capable architecture?"
- "Tell me about a load balancer configuration choice and its tradeoffs."
**Rank rationale: [UNVALIDATED]** — identified, recommended, not yet confirmed applied or re-tested. Good supporting detail inside the bigger OOM/scaling narrative (Article 5) rather than a standalone piece on its own.

---

## Article 19
**Title:** "Building Idempotent Test-Data Tooling: Lessons from Resetting a Contest Mid-Test"
**Audience:** Backend engineers building internal tooling/scripts
**Difficulty:** Intermediate
**Estimated reading time:** 5–6 min
**Key engineering lesson:** Internal/ops tooling deserves the same correctness rigor as production code — a "reset" script that only mutates database rows without re-establishing the full downstream state (in this case, the entire BullMQ job lifecycle) creates a tool that looks like it worked but silently leaves the system in an inconsistent state.
**Architecture diagrams needed:** The contest lifecycle job sequence (CONTEST_START → 3x TIME_WARNING → AUTO_SUBMIT → AUTO_DECLARE_RESULTS) as a timeline
**Metrics to include:** None numeric — this is a tooling-design story
**Production incidents to discuss:** The progression from "update by slug fails" → "update by ID works but doesn't re-schedule jobs" → "full lifecycle re-enqueued"
**Code snippets worth showing:** The evolution of `reset-contest.js` from a single DB update to the full job-scheduling version
**Interview questions this prepares you for:**
- "Tell me about internal tooling you've built and how you made it reliable."
- "How do you think about idempotency in operational scripts?"
**Rank rationale:** Solid, relatable story about tooling craftsmanship — good mid-tier piece, somewhat overlaps with Article 1's narrative so consider merging or differentiating by focusing this one purely on the tooling-design angle rather than the Redis root cause.

---

## Article 20
**Title:** "From Architecture Decision to Validation Plan: Threshold-Testing a Cost-Saving Hypothesis"
**Audience:** Engineering leads, senior engineers making build/scale decisions
**Difficulty:** Intermediate
**Estimated reading time:** 6 min
**Key engineering lesson:** A good architectural hypothesis ("under 2,000 participants we don't need live infra") isn't worth much until you design a concrete, falsifiable experiment to test it — pairing a back-of-envelope estimate with a planned empirical validation (same load profile, single instance vs. full infra) is the discipline that separates a guess from an engineering decision.
**Architecture diagrams needed:** The two-phase test plan diagram (Phase 1: live infra validation; Phase 2: single-instance ceiling test, same Stage 1/2 profiles)
**Metrics to include:** None yet — by definition this article is about the *plan*, with results to follow in a sequel
**Production incidents to discuss:** None — this is the meta-narrative tying Articles 5, 7, and 8 together as "why we were testing this at all"
**Code snippets worth showing:** None essential
**Interview questions this prepares you for:**
- "How do you validate an architectural assumption before committing to it?"
- "Tell me about a time you designed an experiment to answer an engineering question."
**Rank rationale:** This works best as a short connective/framing piece — almost a "part 0" or "part 6 (conclusion, what's next)" rather than a standalone deep technical article, but it's valuable for showing planning discipline.

---

# Top 20, Ranked by Impact for Demonstrating Senior Engineering Thinking

This ranking weighs: (a) technical depth, (b) whether the story is *resolved* with real before/after data vs. still a design/diagnosis, (c) how well it isolates a single transferable principle, and (d) how distinctive the story is (i.e., not a commonly-told bug class).

| Rank | Article | Why it ranks here |
|---|---|---|
| 1 | **#1 — The Two-Redis Trap** | Best combination of architectural depth, correct root-cause reasoning under pressure, both immediate and permanent fixes, and a clean generalizable principle. The flagship piece. |
| 2 | **#7 — The AUTO_SUBMIT Bug (data loss)** | Real measured impact (1,323 → 140), spans infra→runtime→app-logic→business-impact, already fixed in code. Second-strongest narrative arc in the set. |
| 3 | **#2 — Reverse-Engineering Socket.IO's Protocol** | Rare, highly technical, demonstrates protocol-level systems thinking most engineers never need. Distinctive and hard to fake in an interview. |
| 4 | **#3 — 42 Minutes to 4 Seconds** | Cleanest quantifiable win in the whole set (630x), very portfolio-friendly, easy to tell concisely in an interview. |
| 5 | **#12 — Importing Orphaned Infrastructure** | Strong, complete IaC story with clear methodology (state inspection → plan → import → apply) and a clean resolution. |
| 6 | **#5 — When the Health Check Lies (autoscaling)** | Excellent diagnostic depth and very interview-relevant (system design staple), but unvalidated — rank reflects "great design discussion," capped because no after-numbers exist yet. |
| 7 | **#6 — Why Doesn't My Server Just Say I'm Full (back-pressure design)** | Same caveat as #5 — strong conceptual/design piece, no shipped fix yet, but extremely good for system-design interview prep specifically. |
| 8 | **#8 — Polling vs. Sustained Connections** | Strong conceptual/judgment piece; shows you can correctly evaluate whether an external benchmark transfers to your context — valuable but inherently more "reasoning" than "engineering execution." |
| 9 | **#10 — The Cookie That Wouldn't Stick** | Solid, methodical debugging story (DevTools-driven), but the underlying bug class (stale config post-migration) is common; ranks mid-pack on distinctiveness. |
| 10 | **#14 — Rate Limiters in the Wrong Place** | Good process lesson (audit-the-class-not-the-instance), moderate technical depth, useful but not flagship-level. |
| 11 | **#11 — noeviction Isn't a Default** | Tight, real, correctly diagnosed — but narrow in scope; best as a focused short piece. |
| 12 | **#4 — Two Bugs Hiding in One Symptom (SQL binding + collisions)** | Good technical content but somewhat overlaps with #3's narrative; works better merged into #3 than standalone. |
| 13 | **#19 — Building Idempotent Test-Data Tooling** | Decent tooling-craftsmanship story, but substantially overlaps with #1's narrative — differentiate clearly or fold into #1. |
| 14 | **#9 — Threshold-Based Cost Model** | Good business-engineering bridge, useful for portfolio breadth, but technically shallow relative to the top tier. |
| 15 | **#15 — What Load-Testing Taught Us About Methodology** | Useful, but it's a "lessons learned, not yet re-validated" piece — solid for showing self-awareness, not for showing a finished result. |
| 16 | **#18 — A Sticky Situation (session affinity)** | Genuinely useful detail, but thin as a standalone piece — much stronger folded into #5/#7 as supporting evidence. |
| 17 | **#20 — From Architecture Decision to Validation Plan** | Valuable for showing planning discipline, but it's connective tissue more than a self-contained technical story. |
| 18 | **#13 — The Route53 'Already Exists' Trap** | Honest and useful as a "here's how I think about an open bug" interview story, but explicitly unresolved — weakest as a published artifact until fixed. |
| 19 | **#16 — Sizing a Redis Safety Net** | Good methodology example, but it's really a sub-section of #1, not enough independent material for a full article. |
| 20 | **#17 — File Descriptors and ulimits** | Real and useful, but the smallest/shallowest story in the set — best as a quick-hit blog post, not a portfolio centerpiece. |

**One honest flag for your planning:** five of your top 8 (#1, #5, #6, #7 partially, #8) either rely on data you don't fully have yet or describe fixes not yet validated by a clean re-run. Before you write these up as finished case studies, I'd strongly recommend actually completing the Phase 1/Phase 2 validation plan from Article 20 first — running the tests with the fixes applied and getting real before/after numbers will make #1, #5, #7, and #8 dramatically stronger (and turn #6 from "here's a design idea" into "here's a design idea I shipped and measured"). Right now you have excellent diagnosis and design content; the next session's test run is what turns the unvalidated ones into complete stories.
