# QuizBuzz Decisions → Engineering Maturity Map

A note on honesty before this starts: a few of the entries below are decisions you actually shipped and verified (the bulk-SQL seeding fix, the Terraform import, the EIO4 protocol implementation). Several others are *designs you reasoned through correctly but did not yet implement or validate* (CPU→memory/pre-warm autoscaling, the 503 back-pressure endpoint, sticky sessions). I've labeled each with **[SHIPPED]** or **[DESIGNED, NOT YET VALIDATED]**. In an interview, the honest version of the unshipped ones is still a strong answer — "here's a problem I diagnosed and the design I proposed, and here's what I'd measure before calling it done" is exactly what senior interviewers want to hear, and it's a *better* answer than overclaiming a fix you haven't tested. Don't round these up to "I built X" — say what you actually did.

---

## Decision 1 — Migrating ALL Redis data on mode switch, not just BullMQ keys
**[SHIPPED — tool built; not yet validated end-to-end on a full go-live cycle]**

**Why this was a good engineering decision:**
The first version of this fix scoped the migration narrowly to `*:bull:*` keys, reasoning that job-queue data was the only thing that mattered. When asked to think about a concrete failure scenario — an operator running `go-idle` shortly after contest-end, before the submission worker had drained in-flight answer payloads from Redis — the scope was correctly widened to cover all participant session/answer state, not just queue metadata. This is the difference between fixing the bug you found and fixing the *class* of bug you found.

**Software engineering principle:** Defense in depth / fixing the invariant, not the instance. The narrow fix satisfied the literal bug report; the broad fix satisfied the actual guarantee the system needs ("no participant data is lost across a mode switch"), which is a different and stronger thing to optimize for.

**System design concept:** Data durability vs. data locality tradeoffs in a system with multiple storage backends. Specifically: identifying that "ephemeral cache" and "durable system of record" assumptions had quietly blurred — Redis was *supposed* to be ephemeral/recomputable, but in this system it was also the only copy of in-flight answers until a worker persisted them, which makes it transiently durable and changes what "safe to discard" means.

**Design pattern it resembles:** Closest to a **write-ahead-log / staging-buffer migration pattern** — treat the source-of-truth-in-transition as something that must be fully drained or fully copied before the old location is decommissioned, similar to how databases handle WAL replay during failover rather than only copying committed-and-flushed pages.

**Distributed systems concept it relates to:** This is a **dual-write / data-migration consistency problem**, adjacent to the broader class of "split-brain during topology change." You have two Redis instances that are each authoritative during different windows, and the danger is a window where data exists in one but the readers have already moved to the other — structurally the same shape as a leader-election handoff where in-flight writes can be stranded on the old leader.

**Interview question this could answer:**
"Tell me about a time you found a bug, fixed it, and then deliberately widened the fix because the narrow version didn't actually satisfy the guarantee you needed."
Also fits: "Describe a data consistency problem you've solved in a distributed system."

**How to explain it in an interview:**
"We had a dual-mode infrastructure — cheap single-instance mode normally, and a scaled-out mode with a separate Redis (ElastiCache) during live events. Job data was getting stranded when we switched modes, because anything scheduled before the switch was written to the old Redis and the workers after the switch never looked there. My first fix only migrated job-queue keys, but when I thought through the actual failure scenario — someone scaling down right after an event ends, before in-flight submissions are flushed to the database — I realized participant answer data could be lost the same way. So I widened the migration to cover all relevant key prefixes, built it as an idempotent, dry-run-by-default tool using Redis DUMP/RESTORE to preserve types and TTLs exactly, and wired it into both directions of the mode switch. The lesson I took from it: when you fix a bug, ask what *invariant* you're actually trying to protect, not just what symptom you're trying to silence."

---

## Decision 2 — Bypassing Prisma's `$executeRawUnsafe` for bulk SQL in favor of a raw `pg.Pool`
**[SHIPPED — measured: 42 minutes → 4.1 seconds]**

**Why this was a good engineering decision:**
Rather than fighting the ORM's raw-query parameter-binding bug (mixing small "anchor" params with a large dynamically-sized VALUES table), the decision was to recognize that bulk operations are categorically outside what an ORM's abstraction is designed for, and to drop down a layer to the underlying driver, which handles large parameter arrays correctly. This is choosing the right abstraction level for the job rather than forcing the wrong tool to work harder.

**Software engineering principle:** "Use the right tool for the job" / knowing when an abstraction is leaking. An ORM exists to make the common case (single-row CRUD, type-safe relations) ergonomic; it is not obligated to make every case — including bulk inserts of 10,000 rows — equally good, and recognizing that boundary instead of fighting it is itself the skill.

**System design concept:** Throughput optimization via batching and reducing round-trips. The core fix wasn't really "avoid Prisma," it was "reduce 150 sequential network round-trips to a small number of large batched operations run concurrently" — a classic chatty-vs-chunky API tradeoff.

**Design pattern it resembles:** **Bulk operation / batch gateway pattern** — collapsing many small remote calls into fewer, larger ones, similar to how a Unit of Work pattern batches changes before a single commit, or how GraphQL DataLoader batches N+1 queries into one.

**Distributed systems concept it relates to:** Latency amortization over a high-RTT link. The SSH-tunnel ~100ms round-trip made the *number* of round-trips the dominant cost, not the work done per round-trip — this is the same reasoning behind why distributed systems batch RPCs, why TCP has Nagle's algorithm, and why chatty microservice calls across a network are a known anti-pattern.

**Interview question this could answer:**
"Tell me about a performance optimization you made — what was the before and after, and how did you find the bottleneck?"
Also: "When would you bypass your ORM and write raw SQL?"

**How to explain it in an interview:**
"I had a script seeding 10,000 database rows that was taking 42 minutes. I broke down the cost explicitly instead of guessing: it was doing 3 sequential round-trips per batch of 200, fully sequential across 50 batches — so roughly 150 network round-trips, each one paying the SSH-tunnel latency cost individually. I rewrote it as bulk `INSERT ... VALUES (...), (...), ... ON CONFLICT DO NOTHING` statements with 500 rows per batch and 4 batches running concurrently, executed through the raw Postgres driver rather than the ORM's raw-query wrapper, because the ORM had its own parameter-binding bug at that scale anyway. That took it from 42 minutes to about 4 seconds. The generalizable lesson is that for bulk operations, round-trip count usually dominates over query complexity, so the first question to ask is 'how many times am I crossing the network,' not 'how can I make each query faster.'"

---

## Decision 3 — Replacing timestamp-based uniqueness with index-deterministic keys
**[SHIPPED — verified, zero collisions after fix]**

**Why this was a good engineering decision:**
The original `registrationRef` generator combined `Date.now()` with a slice of the email — a strategy that looks unique under sequential, single-threaded testing but silently breaks the moment you introduce concurrency at sub-millisecond granularity. Replacing it with a value derived purely from the loop index removes randomness and timing from the uniqueness guarantee entirely, making correctness provable rather than probabilistic.

**Software engineering principle:** Prefer deterministic invariants over probabilistic ones when the domain allows it. "Probably unique" is a liability that will eventually surface as a production bug under exactly the kind of load you're trying to test for in the first place.

**System design concept:** ID generation strategy selection — this is the same family of decision as choosing between UUIDs, Snowflake-style sortable IDs, or database sequences, where the real question is "what concurrency model does this ID generator need to survive," not just "is this string statistically unlikely to repeat."

**Design pattern it resembles:** Closest to a **deterministic key derivation** pattern, the same principle behind idempotency keys in payment systems — if the key can be derived purely from inputs you already have and control, you eliminate an entire class of race condition rather than trying to detect and recover from it after the fact.

**Distributed systems concept it relates to:** This is directly the **distributed unique-ID-generation problem** — the same problem Twitter's Snowflake, Postgres sequences, and UUID v4/v7 all solve differently. The lesson is recognizing *which* concurrency property you actually need (in this case: uniqueness under N concurrent writers within the same millisecond) and picking a generator that structurally guarantees it instead of one that merely makes collisions unlikely.

**Interview question this could answer:**
"Tell me about a subtle concurrency bug you've found and fixed."
Also: "How do you generate unique identifiers in a distributed or concurrent system?"

**How to explain it in an interview:**
"I had a unique-key generator that combined a timestamp with part of an email address. It worked fine in testing because tests ran sequentially, but once I parallelized the seeding script to 4 concurrent batches, I started getting unique-constraint violations — two different records computing the identical key within the same millisecond. The fix was to stop deriving uniqueness from anything time-based and instead derive it purely from the record's own index in a known, non-overlapping range. That turns 'probably won't collide' into 'cannot collide, full stop,' which is the property you actually want once concurrency is in play."

---

## Decision 4 — Running operational scripts inside the live container rather than via a developer's tunnel
**[SHIPPED — adopted as a process rule after being diagnosed as the root cause of a recurring incident]**

**Why this was a good engineering decision:**
After discovering that a script run from a laptop via SSH tunnel was silently writing to the wrong Redis instance (because the tunnel always pointed at the admin EC2's local Redis container, regardless of which Redis was actually authoritative at the time), the fix wasn't just "remember to check which mode we're in" — it was to change *where the script executes* so that it inherits its configuration from the actual runtime environment (`docker cp` + `docker exec` into the live backend container) rather than from a developer's local assumptions.

**Software engineering principle:** Eliminate the human-memory dependency from correctness-critical operations. "Always remember to do X in the right order" is not a control; it's a hope. Moving execution context so the *system* guarantees correct configuration (the container's own env vars) rather than the *operator* remembering to set it correctly is a structurally stronger fix.

**System design concept:** Configuration source-of-truth and environment parity — this is the same category of problem as "works on my machine," generalized to operational tooling. The fix establishes that any script touching production state should run *in* the environment whose configuration it needs to match, not adjacent to it.

**Design pattern it resembles:** Resembles the **sidecar / exec-into-context pattern** common in container orchestration debugging (e.g., `kubectl exec` into a running pod to inspect/act with that pod's actual service account, network policy, and env vars, rather than trying to replicate them locally).

**Distributed systems concept it relates to:** Configuration consistency across a system with multiple valid-at-different-times configurations — directly related to why service meshes and orchestrators favor environment-derived configuration (env vars, mounted secrets, service discovery) over operator-supplied connection strings, specifically because the latter goes stale the moment topology changes.

**Interview question this could answer:**
"Tell me about an incident caused by configuration drift or environment mismatch, and how you fixed it structurally rather than just patching the symptom."

**How to explain it in an interview:**
"We had a script that kept writing to the wrong backend because it connected based on what the developer assumed the environment was, not what it actually was. Rather than just documenting 'run this after that,' I changed how the script executes — it now runs inside the actual live container, so it always inherits the real, current configuration instead of a guess. That converts an operational-discipline problem, which fails under time pressure, into a structural guarantee."

---

## Decision 5 — Reverse-engineering and explicitly implementing the EIO4 wire protocol instead of treating the WebSocket as "just JSON"
**[SHIPPED — measured: WS connect success rate 50% → ~100%]**

**Why this was a good engineering decision:**
When the test client's connections were silently failing, the response was not to add retries or increase timeouts — it was to drop down a layer, manually verify the raw protocol with `curl`, confirm the infrastructure was healthy, and then correctly conclude the bug was at the application-protocol layer, not the transport layer. This is the discipline of isolating *which layer* a failure belongs to before attempting a fix.

**Software engineering principle:** Don't fix a symptom at the wrong layer of the stack. A 50% connection failure rate could plausibly be "infrastructure flakiness," "rate limiting," or "load," and treating it as any of those would have wasted significant effort; correctly isolating it to "the client and server are not speaking the same framing protocol" required deliberately testing one layer at a time.

**System design concept:** Protocol layering and the value of testing each layer independently — transport (TCP/TLS) → WebSocket upgrade (HTTP 101) → Engine.IO framing → Socket.IO namespace handshake → application events. A success at one layer tells you nothing about the layers above it.

**Design pattern it resembles:** This is essentially implementing a **state machine / protocol adapter** by hand — the rewritten test client tracks explicit states (`namespaceAcked` before any application event may be sent) the same way a real protocol implementation would, rather than treating the connection as a single send/receive black box.

**Distributed systems concept it relates to:** Protocol compatibility and the cost of implicit framing assumptions — directly related to why systems like gRPC, Thrift, and Cap'n Proto define explicit wire formats rather than relying on "just send JSON," and why testing a system at the protocol boundary (not just the application boundary) catches an entire class of bug that integration tests using the "real" client library would never surface.

**Interview question this could answer:**
"Walk me through debugging a WebSocket or real-time system issue in production."
Also: "Tell me about a time you had to understand a protocol at a lower level than the library/SDK normally requires."

**How to explain it in an interview:**
"Our load-testing tool used a raw WebSocket client with no built-in Socket.IO support, and our connections were failing at a 50% rate with no clear error. Rather than guessing, I manually tested the raw WebSocket handshake with curl to rule out the infrastructure layer — that came back clean, a proper 101 upgrade with the expected Engine.IO open packet. That told me the bug had to be above the transport layer, so I read the actual Engine.IO/Socket.IO wire protocol spec and reimplemented the client's connection logic as an explicit state machine — sending the right framed packets in the right order, including the per-namespace handshake our server required, and responding to keepalive pings correctly. That's the kind of bug you can only fix by understanding what's actually being sent on the wire, not by treating the library as a black box."

---

## Decision 6 — Reading the `handleTimeExpiry` symptom and predicting the symmetric bug before confirming it in code
**[SHIPPED — the predicted bug was confirmed and fixed]**

**Why this was a good engineering decision:**
After diagnosing that the "start quiz" trigger had been lost due to the Redis mode-switch issue, the explicit reasoning — "if we didn't trigger the start, we probably didn't trigger the end either" — was used to *predict* a second, not-yet-observed bug before going to look for it. The prediction was correct: the AUTO_SUBMIT logic had its own independent bug (only reading the `active` Redis set, ignoring `disconnected`), causing roughly 1,100 of ~1,300 in-quiz participants to never have their answers persisted.

**Software engineering principle:** Generalizing from a confirmed root cause to its likely symmetric failure mode, rather than treating each bug as an isolated incident. This is the difference between reactive debugging (wait for the next symptom) and hypothesis-driven debugging (use what you just learned about the system to predict where else it's probably broken).

**System design concept:** Lifecycle symmetry — any system with a "start" and "end" trigger pair (here: contest start and contest end/auto-submit) should be audited as a pair, because they frequently share the same underlying dependency (in this case, both relied on the BullMQ scheduler being correctly wired to the currently-authoritative Redis) and a bug in one is a strong prior for a bug in the other.

**Design pattern it resembles:** Not a code-structure pattern so much as a **debugging heuristic pattern**: "if X's trigger mechanism is broken, audit every other consumer of the same trigger mechanism," which is the practical analogue of blast-radius analysis after finding a root cause.

**Distributed systems concept it relates to:** Failure mode correlation — in distributed systems, root causes (a stale config, a partition, a dependency outage) rarely affect only the one code path you happened to observe failing; they affect every code path sharing that dependency, which is why post-incident reviews always ask "what else uses this same mechanism."

**Interview question this could answer:**
"Tell me about a bug where the root cause was several steps removed from the symptom, or where finding one bug helped you find another."
Also strong for: "How do you think about blast radius when investigating an incident?"

**How to explain it in an interview:**
"Once I confirmed that our 'start the quiz' job was getting lost because of a Redis topology issue, I reasoned that the 'end the quiz / auto-submit' job almost certainly shared the same trigger mechanism — and if one was broken, the other probably was too, or had its own latent bug nobody had hit yet because we'd never gotten that far in a test. Auditing it directly, I found a real and independent bug: the auto-submit logic only checked one of two possible participant states in Redis, so when instances crashed ungracefully — which skips the normal cleanup that would move a participant into the state auto-submit was checking — about 85% of in-progress submissions were silently never saved. The instinct to go look for the symmetric failure, rather than waiting to trip over it separately, is what caught it before it became its own multi-hour incident."

---

## Decision 7 — Diagnosing that CPU-based autoscaling is structurally wrong for this workload, and proposing connection-count or pre-warming alternatives
**[DESIGNED, NOT YET VALIDATED — diagnosis is solid; none of the three proposed fixes had been implemented or re-tested by session end]**

**Why this was a good engineering decision (as a diagnosis):**
Rather than treating the late-arriving autoscale-out as "scale-out needs to be faster" (a tuning fix), the actual question asked and answered was "is CPU even the right signal for this workload." The answer — that WebSocket connection load is memory/IO-bound while sustained, with CPU staying low until GC thrashing causes a brief spike right as the system is already failing — correctly identifies a category mismatch between the chosen metric and the actual bottleneck resource, rather than just turning a threshold dial.

**Software engineering principle:** Match your monitoring/alerting signal to your actual bottleneck resource, not to whatever's conveniently available by default. A correct-looking alarm (CPU at 60%) that fires too late is more dangerous than no alarm, because it creates false confidence that the system is being protected.

**System design concept:** Autoscaling trigger selection, and more broadly, the gap between *leading* and *lagging* indicators of saturation. CPU was a lagging indicator here (it only moved once the system was already in GC-thrashing distress); connection count or memory percentage would have been leading indicators (rising steadily and predictably as load increased, well before failure).

**Design pattern it resembles:** This maps to **predictive vs. reactive scaling** as a category — Option C (pre-warming based on known registered-participant count) is essentially **capacity reservation based on known demand**, the same principle behind pre-scaling for a scheduled batch job or a known traffic event, as opposed to relying purely on reactive autoscaling for inherently unpredictable traffic.

**Distributed systems concept it relates to:** Backpressure and load-shedding signal selection — the broader distributed-systems lesson is that the metric you alarm on must causally precede the failure you're trying to prevent, and for stateful/long-lived-connection workloads specifically, CPU is frequently the wrong proxy because such workloads are characteristically memory- and connection-bound rather than compute-bound.

**Interview question this could answer:**
"How would you design autoscaling for a stateful or connection-heavy service?"
Also a strong fit for: "Tell me about a monitoring/alerting signal that was misleading, and how you identified the right one."

**How to explain it in an interview:**
"We had an autoscaling policy that triggered on CPU utilization, and during a load test, a new instance came up only after the existing instances had already crashed from memory exhaustion. I worked through why: our workload holds long-lived WebSocket connections where participants spend most of their time idle between actions, so CPU stays low even as memory climbs steadily toward the ceiling — CPU only spikes briefly once garbage collection starts thrashing, which is essentially the same moment the system is already failing. I proposed three alternatives with different tradeoffs: a memory-percentage CloudWatch alarm as a more direct fix, a custom connection-count metric as the most accurate signal since it's the literal resource being exhausted, and — since this product always knows registered-participant-count in advance, unlike a generic public web service — pre-warming the instance count before the event starts as the most robust option, since reactive scaling is structurally too slow for a session that only lasts an hour. I'd treat the pre-warming as the primary defense and the CloudWatch alarms as a secondary safety net, and I'd want to validate the chosen approach with an actual load test before calling it fixed, which is the next thing on my list."

---

## Decision 8 — Proposing capacity-aware health checks (`/health` returning 503 under saturation) instead of relying solely on external scaling
**[DESIGNED, NOT YET VALIDATED — explicitly a recommendation, not implemented in code]**

**Why this was a good engineering decision (as a design):**
The question that prompted this — "why can't the instance just say it's full?" — correctly identifies that external-only health checks (a binary, infrequent poll of "did this endpoint return 200") cannot distinguish "alive and healthy" from "alive but functionally saturated," and that the fix belongs partly *inside* the service, not only in the orchestration layer watching it from outside.

**Software engineering principle:** Make a component self-aware of its own degradation rather than relying entirely on an external observer to infer it indirectly. A service that can answer "am I currently able to take more work" more precisely than a generic health ping is fundamentally more debuggable and more safely operable.

**System design concept:** This is precisely the **liveness vs. readiness** distinction — whether a process should be killed/replaced (liveness) is a different question from whether it should currently receive new traffic (readiness), and conflating them into one health check, as ALB structurally forces you to, is a known limitation worth designing around explicitly rather than ignoring.

**Design pattern it resembles:** Directly the **circuit breaker / load shedding pattern**, applied at the server side rather than the client side — instead of a caller deciding to stop calling a struggling dependency, the dependency itself signals "stop sending me work" via its own health/readiness contract.

**Distributed systems concept it relates to:** Backpressure propagation — a core distributed-systems concept where a downstream component under load needs a way to signal upstream components to slow down or redirect, rather than silently queueing/timing out/crashing. This is the server-side half of the same problem TCP flow control and reactive-streams backpressure solve at lower layers.

**Interview question this could answer:**
"Design a system that gracefully handles overload." (Very common system-design prompt.)
Also: "What's the difference between liveness and readiness checks, and why does it matter?"

**How to explain it in an interview:**
"I noticed that our load balancer's health check could only tell whether a process was alive, not whether it was actually able to accept more work — a server can be technically responsive to a cheap health-check ping while genuinely failing on real requests because of memory pressure or connection saturation. I designed a readiness check that would have the health endpoint itself report connection count, heap usage, and database pool queue depth, and return a 503 once any of those crossed a threshold — which the load balancer would interpret as 'stop routing new traffic here' while letting existing sticky connections drain naturally rather than abruptly cutting them. I also had to think through a real limitation: this load balancer doesn't support separate liveness and readiness endpoints the way Kubernetes does, so I proposed requiring three consecutive failed checks instead of the default two, specifically so a brief, recoverable GC pause wouldn't trigger an unnecessary and disruptive deregistration. I hadn't shipped or load-tested this by the time I moved on to other priorities, so I'd want to validate the thresholds empirically before calling it done."

---

## Decision 9 — Treating an external benchmark claim ("10,000 concurrent users on one server") as needing context, not as a transferable fact
**[ANALYSIS — correctly reasoned, not an implementation decision per se]**

**Why this was a good engineering decision:**
Rather than either dismissing or blindly adopting an external case study's headline number, the workload's actual characteristics were compared against the cited system's actual characteristics — specifically, connection *duration and overlap*, which turned out to be the dominant variable the headline number was hiding. "10,000 concurrent users" meant something fundamentally different for a polling app (short bursts, rapid turnover) than for a quiz app (all 10,000 connected simultaneously, for the full session duration).

**Software engineering principle:** Benchmarks and case studies transfer only insofar as the underlying workload shape matches — the discipline here is decomposing a headline metric into the assumptions baked into it before applying it to your own system.

**System design concept:** Workload characterization — before any capacity planning is meaningful, you need to characterize *how* load behaves over time (burst vs. sustained, read-heavy vs. write-heavy, connection lifetime), not just its peak magnitude. Two systems with an identical "concurrent users" number can have wildly different actual resource-pressure profiles.

**Design pattern it resembles:** Not a code pattern; closer to an **estimation/Fermi-reasoning discipline** — breaking a claim into its constituent assumptions (connection count × connection duration × per-connection resource cost) and checking each one against your own system rather than treating the conclusion as portable on its own.

**Distributed systems concept it relates to:** Little's Law, informally — concurrency, arrival rate, and duration are related (`L = λW`), and a system that achieves high *instantaneous* concurrency through short *duration* per connection is solving a different problem than one achieving the same instantaneous concurrency through long duration. Conflating the two is a common capacity-planning mistake.

**Interview question this could answer:**
"How do you evaluate whether a benchmark, case study, or industry best practice applies to your specific system?"
Also useful for: "Tell me about a time you had to push back on an assumption using first-principles reasoning."

**How to explain it in an interview:**
"I read a case study claiming 10,000 concurrent WebSocket users on a single small server, and the natural question was whether we could skip a chunk of our infrastructure cost based on that. Before assuming it applied, I broke down what 'concurrent' actually meant in their system versus ours — theirs was a polling app where each connection lasted a couple of minutes and constantly cycled, so their sustained simultaneous load was much lower than the headline number suggested. Ours holds every connection open simultaneously for the full quiz duration, sometimes over an hour, so the same nominal number represents a dramatically higher sustained resource commitment. That distinction — duration and overlap, not just peak count — is usually the thing a 'we handled N concurrent users' claim is hiding, and checking it before adopting someone else's number is a habit I rely on for any capacity decision."

---

## Decision 10 — Setting a participant-count threshold as the basis for an infrastructure cost decision, rather than a binary always-on/always-scaled choice
**[DESIGNED — directly follows from Decision 9's analysis; explicitly the next thing to be empirically validated]**

**Why this was a good engineering decision:**
Instead of resolving "should we always run the expensive infrastructure" or "should we never run it" as a binary, the decision was structured as a threshold derived from actual capacity analysis (under ~2,000 participants comfortably fits the always-on instance; above that, the cost of scaled infrastructure is justified) — turning an infrastructure cost question into something concrete enough to communicate to a customer as a guarantee.

**Software engineering principle:** Avoid false binaries in architecture decisions; look for the parameterized middle ground that's actually justified by the data, and make the threshold explicit and defensible rather than a gut-feel default.

**System design concept:** Tiered/elastic infrastructure provisioning — deliberately operating two cost/capacity tiers and choosing between them based on a measurable input (registered participant count, known in advance) rather than either over-provisioning permanently or under-provisioning and hoping reactive scaling saves you.

**Design pattern it resembles:** Resembles a **strategy pattern at the infrastructure level** — selecting one of two fully different execution strategies (single-instance vs. full ALB/ASG/ElastiCache stack) based on an input parameter known before execution begins, rather than trying to make one strategy handle every case.

**Distributed systems concept it relates to:** Cost-aware capacity planning / right-sizing, and specifically the idea that **elasticity should be driven by predictable signals when they're available** — this system has the unusual advantage that demand (participant count) is known in advance because registration closes before the event, which is a much stronger signal than the unpredictable traffic most public-facing systems have to plan for, and the design correctly exploits that advantage rather than ignoring it in favor of generic autoscaling.

**Interview question this could answer:**
"Tell me about a build-vs-buy, or scale-up-vs-keep-simple, decision you've made, and how you decided where to draw the line."
Also fits: "How do you balance engineering/operational cost against infrastructure cost?"

**How to explain it in an interview:**
"We had two ways to run this system — a cheap always-on single instance, or a fully scaled-out, more expensive setup with load balancing and a managed cache cluster. Rather than picking one permanently, I did the capacity math to find roughly where the single instance stopped being safely sufficient — around 2,000 simultaneous long-lived connections, for our specific workload — and proposed that as an explicit threshold: under that, run cheap; above it, spin up the scaled infrastructure just for that event. Because this product always knows attendee count in advance, that threshold is something we can actually act on deterministically, rather than guessing. The number itself was a first-pass estimate, so the next step I had planned was to empirically validate it by running the same load profile against both configurations and confirming the threshold holds under real conditions, not just on paper."

---

## Decision 11 — Using `terraform plan` and `terraform import` to reconcile drifted state, instead of destroy/recreate
**[SHIPPED — clean plan output ("6 to add, 0 to change, 0 to destroy") confirmed the fix]**

**Why this was a good engineering decision:**
When Terraform state and real AWS state had diverged because a prior apply was interrupted partway through, the response was to diagnose precisely what was missing from state (by inspecting it directly) before acting, then use `import` to adopt the one resource that already existed in AWS rather than letting Terraform try to recreate everything and fight existing resources, and only then run `apply` for the genuinely missing pieces. This avoided any risk of destructive action against a live, in-use ALB and DNS zone.

**Software engineering principle:** Diagnose before acting, especially when the action is destructive or hard to reverse — `terraform plan` exists specifically to let you see consequences before committing to them, and using it deliberately (rather than running `apply` and hoping) is the difference between careful infrastructure operation and reckless infrastructure operation.

**System design concept:** Infrastructure-as-code state reconciliation — the core insight is that "desired state" (your `.tf` files), "recorded state" (the state file), and "actual state" (what's really in AWS) are three distinct things that can diverge, and a mature IaC workflow treats reconciling them as its own deliberate step, not something `apply` is trusted to figure out blindly.

**Design pattern it resembles:** Closest to a **reconciliation loop** pattern, the same control-loop idea Kubernetes controllers use (compare desired vs. actual, compute the minimal diff, apply only that diff) — `import` is the manual equivalent of telling the reconciler "this resource already satisfies part of the desired state, adopt it rather than recreating it."

**Distributed systems concept it relates to:** Idempotent state convergence — the same principle behind idempotent APIs and eventually-consistent reconciliation systems: an operation that converges current state toward desired state should be safe to retry and should not blindly assume "missing from my record" means "missing from reality."

**Interview question this could answer:**
"Tell me about a time infrastructure-as-code drifted from the real world, and how you recovered safely."
Also: "When would you use `terraform import` versus destroying and recreating a resource?"

**How to explain it in an interview:**
"A previous deploy had been interrupted partway through, so our Terraform state was missing several resources — an HTTPS listener and its routing rules — that we needed, but one dependent resource, a DNS validation record, actually already existed in AWS from that same interrupted run. Running `apply` blindly would have either tried to recreate something that already existed and failed, or worse, tried to reconcile by destroying live resources serving real traffic. Instead, I ran `plan` first to see exactly what Terraform thought needed to change, used `import` to bring the one already-existing resource into state without modifying it, and then ran `apply` for only the genuinely missing pieces — confirmed by `plan` showing a clean six-resources-to-add, zero-to-destroy diff before I executed anything. The discipline is to always understand the diff before you apply it, especially on infrastructure that's actively serving production traffic."

---

## Decision 12 — Auditing an entire class of rate-limiter bug after finding one instance of it
**[SHIPPED — both the misapplied limiter and the unit bug were found and fixed]**

**Why this was a good engineering decision:**
After finding that one rate limiter was misapplied to an endpoint that didn't need it, the response was not to patch that single route and move on — it was to deliberately audit every rate limiter in the codebase, which surfaced a second, independent, real correctness bug (a `windowMs` unit mismatch making one limiter's window 600 milliseconds instead of 600 seconds) that had nothing to do with the original load-testing context and would otherwise have shipped unnoticed.

**Software engineering principle:** When you find one instance of a bug class, audit for the whole class rather than assuming it's isolated — bugs introduced by copy-paste, by inconsistent units, or by misunderstanding a shared utility tend to recur across a codebase, and a targeted audit after the first discovery is cheap relative to finding each instance independently in production.

**System design concept:** Configuration correctness and unit consistency across a codebase — specifically the hazard of multiple independent implementations of "the same" cross-cutting concern (rate limiting, here implemented in at least two separate places) silently drifting out of sync with each other.

**Design pattern it resembles:** Less a code pattern, more a **code-review/audit heuristic**: "grep for every usage of the pattern that just bit you." This is the same instinct behind running a linter rule across an entire codebase once you've manually found one violation of it, rather than fixing only the one you tripped over.

**Distributed systems concept it relates to:** Not directly a distributed-systems concept — this is a code-quality/correctness discipline — but it's adjacent to the operational practice of **blast-radius auditing** after any incident: once you know a class of misconfiguration exists, you check every place that configuration is used, not just the one that paged you.

**Interview question this could answer:**
"Tell me about a bug you fixed that turned out to be part of a larger pattern across the codebase."
Also: "How do you decide when a bug fix is 'done' — patch the symptom, or audit further?"

**How to explain it in an interview:**
"We were getting rate-limited during load testing because a generic OTP rate limiter had been attached to an endpoint that doesn't actually use OTP — the limiter was logically misapplied, not just inconveniently strict. Instead of just removing it from that one route and moving on, I did a quick audit of every rate limiter in the codebase to check for similar issues, since misapplied middleware tends not to be a one-off. That audit found a real, separate bug: a second rate limiter computed its time window directly from a config value that was actually in seconds, without the unit conversion the 'canonical' limiter elsewhere in the codebase correctly applied — so its effective window was 600 milliseconds instead of 600 seconds, a bug with zero relationship to load testing that would have shipped unnoticed otherwise. The lesson is that finding one instance of a bug class is a good moment to check for siblings, not just to close the ticket."

---

## Summary — Quick-Reference Table

| # | Decision | Status | Core principle | Best interview frame |
|---|---|---|---|---|
| 1 | Migrate all Redis data, not just job keys, on mode switch | Shipped | Fix the invariant, not the instance | Data consistency in distributed systems |
| 2 | Bypass ORM raw-query layer for bulk SQL | Shipped, measured (630x) | Right abstraction for the job | Performance optimization |
| 3 | Deterministic index-based keys instead of timestamp-based | Shipped, verified | Probabilistic vs. provable correctness | Concurrency bug debugging |
| 4 | Run ops scripts inside the live container, not via tunnel | Shipped (process fix) | Eliminate human-memory dependency | Config drift / environment parity |
| 5 | Hand-implement EIO4 protocol after isolating the failing layer | Shipped, measured (50%→100%) | Debug at the correct protocol layer | Real-time systems debugging |
| 6 | Predict the symmetric AUTO_SUBMIT bug from the CONTEST_START bug | Shipped | Generalize root cause to blast radius | Hypothesis-driven debugging |
| 7 | Diagnose CPU-based autoscaling as wrong metric | **Designed, not validated** | Match signal to actual bottleneck | Autoscaling system design |
| 8 | Design capacity-aware `/health` returning 503 | **Designed, not validated** | Liveness vs. readiness, self-reported backpressure | Graceful degradation system design |
| 9 | Contextualize an external benchmark before trusting it | Analysis | Workload characterization before capacity planning | Evaluating claims/benchmarks |
| 10 | Threshold-based infra cost decision | Designed, next step is validation | Avoid false binaries; exploit known-in-advance demand | Build-vs-scale tradeoff |
| 11 | `terraform plan` + `import` over destroy/recreate | Shipped, verified | Diagnose before destructive action | IaC state reconciliation |
| 12 | Audit the whole rate-limiter class after finding one bug | Shipped, found 2nd real bug | Bug-class auditing, not one-off patching | Code review discipline |

**One last calibration note for interview prep:** the strongest, most defensible stories to lead with are #1, #2, #3, #5, #6, #11, and #12 — these are shipped, measured, and you can state real before/after numbers without hedging. #7, #8, and #10 are genuinely good *design thinking* stories, but you should frame them explicitly as "here's what I diagnosed and proposed, here's what I'd validate next" rather than implying they're finished and measured — that framing is honest and, frankly, often more impressive to a senior interviewer than a suspiciously tidy success story, because it shows you know the difference between a design and a result.
