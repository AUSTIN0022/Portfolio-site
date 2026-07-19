# 3D Components Roadmap

A design + build plan for the site's 3D infrastructure elements. This is a **spec, not code** — it defines what components we still need, exactly how each should look, and (most importantly) how each should *behave*, so that a viewer understands the concept from the object alone.

---

## 1. Why this document exists

Every 3D object currently on the site was **extracted from the hero diagram** (`src/components/3d/*` — `AppServer`, `Database`, `Queue`, `Workers`, `LoadBalancer`, `Laptop`, `Cache`, `Monitoring`, `Storage`, …). In the hero they are perfect: they are *nodes on a wiring diagram*, labelled, and their job is only to sit there and be connected by pipes.

But reused elsewhere they are only **approximately** right:

- **INFRA card** uses `LoadBalancer`. It renders a small disc with a fan/spoke top and a plug. It does *not* communicate "AWS auto-scaling, Docker, CI/CD, zero-downtime deploys." It reads as an anonymous gadget.
- **SYSTEMS card** uses `Workers` (a 2×2 block of cubes). It's a reasonable stand-in for "distributed," but it doesn't show *queues*, *locking*, or *async pipelines* — the actual words in the copy.
- **SMARTFORMFLOW card** uses `Queue`. Correct object, but it was reading side-on like a brick stack until we rotated it front-facing.

The lesson, and the rule going forward:

> **A hero node is a noun. A section icon needs to be a verb.** For each placement, the object should *act out the concept* — motion is the message. When an existing node can't do that, we build a purpose-made component instead of forcing a reuse.

This document lists the purpose-made components we want, in priority order.

---

## 2. Shared design system (every new component MUST follow this)

These rules keep new components visually identical to the existing family so the site reads as one system.

### Material & color
- **Body:** frosted ceramic white. `meshPhysicalMaterial`, `color ≈ #e4e2d9`, `roughness ≈ 0.34`, `clearcoat ≈ 0.6`, `metalness 0`. (Same recipe as the polished pipe/blocks — see `HeroScene.tsx` `PipeMaterial` and `RoundedInfrastructureBlock`.)
- **Base:** near-black plinth under each block (the "floating on a dark slab" look).
- **One accent per component**, drawn from the existing palette only:
  - green `#3ecf8e`-ish (cache / healthy / live)
  - yellow `#f4d100`-ish (queue / workers / pending work)
  - tan/kraft band (database / storage / persistence)
  - blue `#3b82f6` **reserved for data-in-motion** (the packet, request flow, live traffic) — this is our "energy" color and should glow via bloom.
- Never introduce a new hue without a reason; accents carry meaning (see palette meanings above).

### Form
- Rounded-cube / rounded-cylinder language via the existing `RoundedInfrastructureBlock` helper. Soft fillets, no hard edges.
- Silhouette must be **legible at ~120×120px** (the card icon size). If you can't tell what it is at thumbnail size, the form is too busy.

### Motion (this is the important part)
- Motion **is** the explanation. Each component has a **looping micro-animation** (2–5s) that literally performs the concept it represents.
- Idle presentation pose: fixed forward tilt (~0.42 rad) + gentle yaw rock (±0.3 rad, `sin(t·0.5)`), matching `ProjectObject.tsx`. The concept animation plays *on top of* that pose.
- Data/energy that moves should be the **blue bloom** treatment (emissive, `toneMapped={false}`, picked up by the `EffectComposer` bloom pass) — consistent with the hero packet.

### Accessibility & performance
- Respect `useReducedMotion()`: freeze the concept animation on a representative "resting" frame (e.g. the load-balancer half-full, the pipeline mid-way lit). Never just stop dead on an empty/ambiguous frame.
- Keep it cheap: reuse geometry, cap segments, no per-frame allocation. These render inside `LazyCanvas` (mount-on-approach, `frameloop` gated by visibility) — keep that intact.

### API & wiring conventions
- Same props shape as today's nodes (`InfrastructureNodeProps`: `position`, `rotation`, `scale`, `showLabel`, `floating`, `interactive`, `animationToggle`).
- Card usage goes through `ProjectObject.tsx` (`type` → component map) with `showLabel/floating/interactive/animationToggle` off; the wrapper owns the pose.
- Prototype every new component in `/lab/objects` (the gallery harness) before wiring it into a section.

---

## 3. Priority A — fix the current weak placements

### A1. `autoscaler` — replace `LoadBalancer` on the **INFRA** card
**Represents:** AWS auto-scaling + load balancing + zero-downtime — the core of "INFRA."

**Form:** a translucent-ceramic **vessel/container** (a rounded open-top tank) sitting on the black base. Inside it, a **fill level** made of small stacked request-units (or a translucent blue liquid column with the bloom energy tint). Beside/behind it, **instance blocks** (little rounded server cubes) that can appear and disappear.

**Behavior (the loop — this is the whole point):**
1. Blue request-units **pour in** from the top; the fill level **rises**.
2. When the fill crosses a "high-water" line, a **new instance block scales out** (pops up beside it with a soft ceramic "settle" animation) and the fill **drops** as load is distributed across instances.
3. Traffic eases; the extra instance **scales back in** (retracts) and the fill settles to a calm baseline.
4. Loop. The felt story is *"pressure builds → it scales → it absorbs → it relaxes,"* i.e. elastic capacity.

**Accent:** blue for the rising request fill (energy), yellow tick-mark for the high-water threshold line.

**Reduced-motion resting frame:** vessel ~40% full, two instances present.

---

### A2. `pipeline` — replace `Workers` on the **SYSTEMS** card
**Represents:** distributed job queues, event-driven architecture, fault-tolerant **async pipelines** (the literal copy).

**Form:** a short horizontal **conveyor / queue lane**: an intake hopper on the left (the queue, yellow-based), a couple of **worker cubes** straddling the lane in the middle, an output tray on the right. Optionally a small "dead-letter" side-bin.

**Behavior (loop):**
1. Blue job-packets **enqueue** on the left, spaced out along the lane.
2. A worker **pulls** a packet, **pulses** (brief scale + accent glow = "processing"), releases it to the output.
3. Every few cycles, one packet **fails** → bounces to the dead-letter bin, then **retries** back into the lane (nods to *idempotency* + *design-for-failure* from the Principles section).

**Accent:** yellow at the queue intake, green flash on successful completion, a single amber blip on the retry.

**Reduced-motion resting frame:** one packet mid-lane over a worker mid-pulse.

> Keep `Workers` as-is for the hero; this `pipeline` is a *systems-story* variant, not a replacement of the hero node.

---

### A3. `realtime-hub` — optional upgrade for **QUIZBUZZ** (currently `Laptop`)
**Represents:** 10,000 concurrent WebSocket users, real-time fan-out (the QuizBuzz headline).

**Form:** a central rounded hub node with a ring of **many small connection dots** around it (the crowd). Thin translucent spokes connect dots to hub.

**Behavior (loop):** connection dots **light up in waves** (blue bloom pulses radiating out from the hub and back = broadcast → ack), with the ring occasionally getting **denser** (a surge of concurrent users) then settling. Conveys "live, many, at once."

**Accent:** blue pulses; green = connected/healthy dots.

**Note:** the `Laptop` is a fine, clear placeholder today. Only build this if we want QuizBuzz to *feel* real-time rather than just "an app." Lower priority than A1/A2.

---

## 4. Priority B — components for the concepts we talk about but don't show

The **Principles** section ("HOW I BUILD") states five ideas in text only. Each is a great candidate for a tiny 3D glyph. These are the strongest brand fit because they're *this engineer's* differentiators. Written to the same depth as Priority A so each can go straight to image generation.

### B1. `lock` — distributed lock / mutual exclusion
**Represents:** Redis-backed locking that "doesn't deadlock" — the concurrency-safety story (hero copy, Systems card, and the *Idempotency / Design-for-failure* principles).

**Form:** a low, wide ceramic pedestal with a single **token socket** recessed dead-center on top (a shallow keyhole holding a short upright cylindrical token). Three identical worker cubes sit around it at 120° spacing, each with a small notch/arm on the face pointing at the socket. The token is the only thing that glows; everything else is neutral ceramic on the usual black base.

**Behavior (the loop):**
1. Idle: all three workers neutral, the center token free and softly lit.
2. One worker **slides in and acquires** the token — it snaps to that worker, turns solid **green**, and that worker brightens ("holding the lock").
3. The other two **press in and stop short** — visibly held back and dimmed (contention / waiting).
4. Holder finishes → **releases** → token returns to center → the next waiting worker takes it. Clean round-robin hand-off.
5. Every few cycles a waiter that's waited too long flashes **amber** (lock-wait timeout) and backs off.

**Accent:** green = the holder + held token; amber = a timed-out waiter. Everything else neutral.

**Reduced-motion resting frame:** one worker holding the green token, the other two held short beside it.

---

### B2. `idempotency-filter` — dedupe / "safe to run twice"
**Represents:** the *Idempotency is non-negotiable* principle; SmartFormFlow's global contact **deduplication**.

**Form:** a **gate block** like a doorway: an in-tray on the left, a vertical translucent-ceramic **filter membrane** in the middle with a single pass-slot, an out-tray on the right. A small **ledger/tally block** perched above the gate "remembers" the ids it has seen (a little stack of tan tabs).

**Behavior (the loop):**
1. Packets approach from the left, each stamped with an **id tag** (a small colored chip).
2. A **new** id reaches the membrane, **passes through** with a green flash, and its tag is recorded on the ledger (a tan tab ticks up).
3. A **duplicate** id arrives (tag already on the ledger) → the membrane **rejects it**: it presses against the wall, dims, and **dissolves** — it never reaches the out-tray, so nothing is emitted twice downstream.
4. Loop with a deliberate mix of new + duplicate ids so "one-through, dupes-absorbed" is unmistakable.

**Accent:** green = accepted / first-seen; tan = the persistence ledger; rejected duplicates fade to grey (they die quietly, no accent).

**Reduced-motion resting frame:** one packet mid-pass (green) and one duplicate pinned and dissolving at the membrane.

---

### B3. `observability` — logs / metrics / traces
**Represents:** the *Observability by default* principle; also INFRA "monitoring." An upgrade of the existing `Monitoring` node.

**Form:** keep the `Monitoring` silhouette (ceramic body, black base, green base-strip) but turn its front/top face into a recessed **live dashboard panel** — a small screen showing a scrolling line graph (or a short bar series) with a row of 2–3 status LEDs along the bottom edge, behind a thin bezel.

**Behavior (the loop):**
1. The graph line **scrolls right-to-left** at a calm baseline.
2. A **spike rises**; a status LED flips **green → amber** (anomaly detected).
3. A blue **trace packet** streaks across the panel (a request being traced), leaving a short glowing tail.
4. The spike subsides and the LED returns to green ("incident cleared"). Loop.

**Accent:** green (healthy LED / base-strip), amber (alerting), blue (trace packet). The graph line itself is soft ceramic-grey with a blue leading dot.

**Reduced-motion resting frame:** graph mid-scroll with a small spike, one LED amber, and a trace tail frozen mid-panel.

---

### B4. `deploy-pipeline` — CI/CD, zero-downtime
**Represents:** INFRA "CI/CD pipelines, zero-downtime deployments."

**Form:** a **row of four rounded stage blocks** on a shared rail, distinguished by a shape/notch rather than text — BUILD (a cube mid-assembly), TEST (a check notch), DEPLOY (an up-arrow), LIVE (a small ring/globe). To the right of LIVE, two swap-slots hold an "old version" and a "new version" block.

**Behavior (the loop):**
1. A blue **build token** enters BUILD and **advances stage by stage**; each stage it leaves **lights green and stays lit** (progress accumulates).
2. At DEPLOY, the **new-version block slides into the LIVE slot while the old-version block slides out the back — simultaneously, no gap.** This zero-downtime swap is the money shot; hold a beat on it.
3. All stages flash fully green (success), then reset to neutral for the next run.
4. Roughly every third loop a stage (usually TEST) **flashes red, the token halts and rolls back**, stages go dark — then it retries clean (the guardrail).

**Accent:** green = a passed stage; blue = the moving token; red = a failing / rolled-back stage.

**Reduced-motion resting frame:** token at DEPLOY mid-swap, earlier stages green, the two version blocks crossing.

---

### B5. `rate-limiter` — token bucket / backpressure
**Represents:** rate limiting + backpressure + fault-tolerance (QuizBuzz load testing, SmartFormFlow).

**Form:** a **transparent-ceramic bucket** (a rounded open cylinder) holding a visible number of small **token discs**, a slow drip **spout** above it that refills the tokens, and a front entry lane where requests queue to grab a token before reaching the exit.

**Behavior (the loop):**
1. Tokens **drip in** from the spout at a steady rate; the token level in the bucket rises.
2. Requests arrive and each **consumes one token** to pass — the token pops and the request exits with a small green "go."
3. Under a burst, tokens **deplete faster than they refill**; the bucket **empties** and incoming requests **pile up and bounce at the gate** (backpressure — visibly waiting, dimmed).
4. Refill catches up, the queue **drains**, normal flow resumes. Loop.

**Accent:** yellow = tokens (the work-permits); green = a request that got through; waiting / bounced requests dim to grey (denied for now).

**Reduced-motion resting frame:** bucket ~half full, one request consuming a token, two waiting at the gate.

---

## 5. Priority C — nice-to-have / future surfaces

Same format. Some of these upgrade an existing node; some are new. All optional, but each earns its place by telling a specific part of *this* engineer's story.

### C1. `cache-lookup` — cache hit vs miss (upgrade of `Cache`)
**Represents:** Redis cache sitting in front of PostgreSQL — the latency win.

**Form:** the existing green-topped `Cache` block on the left, a `Database` cylinder on the right, a short ceramic pipe between them, and a request entry at the front-left. The cache's green top is the "hot store."

**Behavior (the loop):**
1. A request hits the **cache first**.
2. **HIT** (most cycles): the cache top pulses green and the request **bounces straight back fast** — a short, snappy path.
3. **MISS** (occasionally): the cache dims, the request **falls through the pipe to the DB**, the DB band pulses tan, the value returns **slower**, and on the way back it **populates the cache** (the cache top briefly fills green — "now cached").
4. Loop at ~3 hits per miss so the hit/miss ratio and the latency difference both read.

**Accent:** green = cache hit / populate; tan = DB fetch; blue = the request packet in motion.

**Reduced-motion resting frame:** a request mid-flight on the MISS path between cache and DB, cache half-populated.

---

### C2. `circuit-breaker` — trip / half-open / closed
**Represents:** fault tolerance; "degrade without taking the rest down" (*Design-for-failure*).

**Form:** an inline **breaker housing** on a pipe run — a rounded block with a **pivoting lever** on top and a status ring around it. An upstream caller on one side, a flaky downstream service on the other.

**Behavior (the loop):**
1. **CLOSED (green):** requests flow through normally.
2. Downstream starts **failing** (red blips return); after a few failures the breaker **TRIPS OPEN** — the lever flips, the ring turns **red**, and requests are **rejected instantly at the breaker** (they bounce back fast, never reaching the sick service — protecting the system).
3. After a cooldown it goes **HALF-OPEN (amber):** one **trial request** is allowed through. Success → snaps back to CLOSED/green; failure → back to OPEN/red.
4. Loop through the three states.

**Accent:** green (closed / healthy), amber (half-open / trial), red (open / tripped).

**Reduced-motion resting frame:** breaker OPEN (red) with a request bouncing off it, downstream dark.

---

### C3. `sharding` — partitioning by key
**Represents:** horizontal scale, data partitioning (the systems / scale story).

**Form:** an intake **router block** at the top splitting down into **three shard blocks** side by side, each a small DB-ish cylinder with a distinct subtle marker (A/B/C notch or a different accent stripe).

**Behavior (the loop):**
1. A stream of **records** flows into the router, each carrying a key (a colored tag).
2. The router **routes each record by key** — deflecting it left / center / right into the matching shard, and always sending the same tag color to the same shard (consistent hashing).
3. Shards **fill evenly** over time. Occasionally one runs hot and a record **re-routes** (rebalance).

**Accent:** three muted accent stripes (one per shard) so routing is legible; blue for records in motion.

**Reduced-motion resting frame:** three records frozen mid-deflection into their respective shards.

---

### C4. `mode-switch` — QuizBuzz idle ⇄ live infrastructure migration
**Represents:** QuizBuzz's signature "two infrastructure stacks, data migrated at the switch" case study — the most portfolio-specific glyph here.

**Form:** **two stacks side by side** — a small dim "IDLE" stack (one modest block) and a taller bright "LIVE" stack (more instances) — joined by a **migration pipe** arcing between them that carries little key/record glyphs. A throw-switch sits between them.

**Behavior (the loop):**
1. State starts on **IDLE** (live stack dark and retracted).
2. The **switch throws** → records **stream across the migration pipe** idle → live (a Redis DUMP/RESTORE feel: key glyphs flowing), and the LIVE stack **scales up and lights**.
3. Event ends → switch throws back → data migrates **live → idle**, the live stack scales down and darkens. Loop.

**Accent:** blue for the migrating keys; green marks the "active / serving" stack; the inactive stack dims to neutral.

**Reduced-motion resting frame:** keys mid-flight across the pipe with the live stack half-scaled-up.

---

### C5. `payments` — SmartFormFlow Razorpay async flow
**Represents:** SmartFormFlow payments → certificate issuance pipeline.

**Form:** a short pipeline — **request → gateway block (a card slot) → a two-step latch (AUTH then CAPTURE) → an output tray** that emits a small **certificate tile** (a ceramic card with a seal).

**Behavior (the loop):**
1. A payment request enters the gateway.
2. **AUTH** lights (reserve / hold — amber), then **CAPTURE** confirms (green).
3. On success the output tray **emits a certificate tile** with a green seal that slides out — the async post-payment job completing.
4. Occasionally an auth **declines** (red) and the request exits without a certificate. Loop.

**Accent:** amber (auth / hold), green (captured / success + certificate seal), red (declined).

**Reduced-motion resting frame:** CAPTURE just turned green with a certificate tile half-emitted.

---

### C6. Stat glyphs — micro-objects for the Stats strip
**Represents:** the `CONCURRENT USERS` / `PRODUCTION SYSTEMS` / `INDUSTRY EXPERIENCE` counters — a tiny object (≤80px) beside each number.

**Form + behavior (three tiny glyphs):**
- **CONCURRENT USERS** — a tight **cluster of connection dots** that **multiplies** (dots pop in) as the counter counts up, then holds. A swarm. *Accent: blue (energy).*
- **PRODUCTION SYSTEMS** — a **stack of shipped blocks** that **adds a block per increment** and stands. *Accent: tan (persistence).*
- **INDUSTRY EXPERIENCE** — a **ring/arc that sweeps to fill** as the number rises (time accrued). *Accent: green arc.*

**Reduced-motion resting frame:** each at its final count — full swarm / full stack / full ring.

---

### C7. `event-bus` — pub/sub fan-out
**Represents:** event-driven architecture (Systems copy).

**Form:** a central **spine bus** (a long rounded bar) with several **subscriber blocks** tapped along its length.

**Behavior (the loop):** an event **published at one end travels the bus**; each subscriber it passes **lights up and emits its own little reaction packet** (fan-out). A second event can ripple behind the first. *Accent:* blue event on the bus, green flash on each subscriber that receives it.

**Reduced-motion resting frame:** an event mid-bus with two subscribers lit.

---

### C8. `heartbeat` — liveness / health-check
**Represents:** health probes, uptime, observability.

**Form:** a small node with a **pulsing ring** (or a short EKG line across its face).

**Behavior (the loop):** a steady green **pulse**; occasionally a **missed beat** — the ring skips and flips amber — then recovers. *Accent:* green pulse, amber on a missed beat.

**Reduced-motion resting frame:** mid-pulse, ring bright green.

---

### C9. `backup-snapshot` — durability / persistence
**Represents:** backups, retention, "disks fill" (*Design-for-failure*).

**Form:** a `Database` cylinder with a small **snapshot tray** beside it.

**Behavior (the loop):** periodically the DB **emits a snapshot tile** — a copy peels off and stacks in the tray; the stack grows and the oldest tile fades out (retention window). *Accent:* tan (persistence), green flash on a completed snapshot.

**Reduced-motion resting frame:** a snapshot tile mid-peel above a short stack.

---

## 6. Build order & checklist

**Workflow — image first.** For each component: (1) generate/finalize a **still image** of it — the Form, rendered in the house style (frosted ceramic, black base, the one accent), ideally at a representative *mid-animation* frame so the concept is visible; (2) sign off on the look; (3) only then build the actual 3D geometry + the looping animation. The **Form** and **Reduced-motion resting frame** fields in each spec above are written to be used directly as the image prompt and the sign-off frame.

**Suggested order:** A1 `autoscaler` → A2 `pipeline` → B3 `observability` → B1 `lock` → B4 `deploy-pipeline` → the rest as time allows.

For each new component:

- [ ] Follows the material/palette/form rules in §2 (frosted ceramic, black base, one meaningful accent, blue = motion).
- [ ] Has a **looping concept animation** that reads at 120px, plus a sensible **reduced-motion resting frame**.
- [ ] Same `InfrastructureNodeProps` API; prototyped in `/lab/objects`.
- [ ] Wired via `ProjectObject.tsx` if it's a card icon; given a pose (tilt + rock) by the wrapper.
- [ ] Cheap enough to run inside `LazyCanvas` without dropping frames; no per-frame allocations.
- [ ] Verified on **both** backgrounds it may appear on (light `--color-canvas-mist` project cards, and the pure-black Skills section with its spotlight wrapper).

---

## 7. One-line summary

We have a beautiful set of **static nodes**. The next phase is a set of **behavioral glyphs** — each one small, ceramic, and *doing the thing it names* — so the portfolio doesn't just say "I build reliable distributed systems," it **shows** it, one tiny looping animation at a time.
