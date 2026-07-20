# 3D Glyphs — Build Review & Improvements

Evaluation of the built glyphs (`/lab/playground`) against the specs in
[`3d-components-roadmap.md`](./3d-components-roadmap.md). Judged from the rendered
frames in both contexts (light project-card bg, black spotlight bg) **and the 120px
legibility thumbnail** — because that thumbnail is the size these actually ship at.

**Headline:** this is a strong, coherent set. The house style holds across all 17 —
frosted ceramic, black plinth, disciplined accents, blue as the "energy" color. The
reduced-motion toggle and the 120px legibility strip in the playground are exactly the
right guard-rails. Most glyphs read instantly. The notes below are polish, not rework —
except three that need a real second pass (`lock`, `idempotency`, `deploy`).

---

## 1. Verdict per glyph

| Glyph | Reads at full size | Reads at **120px** | Verdict |
|---|---|---|---|
| `autoscaler` (A1) | ✅ excellent | ✅ | **Ship** — beaker + blue fill + yellow high-water is a bullseye |
| `pipeline` (A2) | ✅ | ⚠️ busy | **Polish** — workers look like laptops; lane crowded |
| `realtime-hub` (A3) | ✅ | ✅ | **Ship** — hub + client ring + blue broadcast reads |
| `lock` (B1) | ⚠️ ambiguous | ❌ unreadable | **Rework** — central socket reads as an abstract "S/ring" |
| `idempotency` (B2) | ⚠️ static-dependent | ⚠️ | **Rework** — the whole story is in the (frozen-invisible) dedupe beat |
| `observability` (B3) | ✅ excellent | ✅ | **Ship** — dashboard screen + LEDs is unmistakable |
| `deploy` (B4) | ✅ | ❌ too busy | **Rework** — 4 stages + swap slots + arbitrary shapes overload the thumbnail |
| `rate-limiter` (B5) | ✅ excellent | ✅ | **Ship** — token bucket is textbook-clear |
| `cache-lookup` (C1) | ✅ | ✅ | **Ship** — cache→DB relationship reads |
| `breaker` (C2) | ✅ | ⚠️ | **Polish** — red ring is great; the lever is a tiny nub |
| `sharding` (C3) | ✅ | ⚠️ | **Polish** — shard identities too subtle |
| `mode-switch` (C4) | ✅ | ✅ | **Ship** — two stacks + migration arc reads |
| `payments` (C5) | ⚠️ generic | ⚠️ | **Polish** — reads as "a row of cylinders"; the certificate payoff is buried |
| `stats` (C6) | ✅ excellent | ✅ | **Ship** — swarm / stack / ring all legible |
| `event-bus` (C7) | ✅ | ✅ | **Ship** — spine + taps + blue event reads |
| `heartbeat` (C8) | ✅ excellent | ✅ | **Ship** — ring pulse is perfectly minimal |
| `snapshots` (C9) | ✅ | ✅ | **Ship** — DB + growing tile stack reads |

**Ship as-is (11):** autoscaler, realtime-hub, observability, rate-limiter, cache-lookup, mode-switch, stats, event-bus, heartbeat, snapshots — plus autoscaler's tiny nit below.
**Polish (4):** pipeline, breaker, sharding, payments.
**Rework (3):** lock, idempotency, deploy.

---

## 2. Cross-cutting improvements (apply to the whole set)

These lift the *system*, and several of the per-glyph issues are really instances of these.

### 2.1 The 120px legibility test is the real bar
The Skills columns and project cards render these small. The winners (`heartbeat`,
`stats`, `autoscaler`, `rate-limiter`) all follow **"one big idea, one accent."** The
strugglers (`deploy`, `pipeline`, `payments`, `lock`) all try to stage **multiple small
elements**. Rule going forward: *if it doesn't read as a single silhouette at 120px, cut
elements until it does.* Detail is a reward for zooming in, never a requirement to
understand it.

### 2.2 Reserve green for **state**, not decoration
The roadmap palette gives green a meaning — *healthy / active / live*. But green is
currently used as a purely structural **top-cap** on `mode-switch` stacks, `event-bus`
subscribers, `snapshots` tile, `heartbeat` cube, and the `lock` workers. That dilutes the
signal. Make structural caps **neutral ceramic**, and let green appear **only** when
something is actively healthy/succeeding/receiving. Same discipline for amber (only when
alerting/holding) and red (only when failing).

### 2.3 The "blue screen" worker motif reads as a laptop
`pipeline`'s workers and (to a lesser degree) other compute blocks carry a blue
rectangular screen-face, which makes them read as *monitors/laptops*, not *workers*. Keep
a literal screen **only** where a UI is the point (`observability`, arguably
`realtime-hub`). Everywhere else, a plain ceramic cube that **pulses** on work is clearer
and cheaper.

### 2.4 Normalize plinth size & framing
Base slabs are inconsistent: `autoscaler`/`heartbeat`/`rate-limiter` sit on tidy plinths,
while `breaker`, `payments`, `sharding`, `mode-switch`, `event-bus` have **oversized
slabs** that shrink the actual object and make the set feel uneven card-to-card. Target: a
**thin plinth** (like the hero nodes) with the object filling ~65–70% of the frame, and a
single shared camera-fit so every glyph occupies the same relative area.

### 2.5 Verify accents on **both** backgrounds
Tan and pale-green accents wash out on the light project-card background. Confirm every
accent clears a contrast bar on **both** the light card and the black spotlight before
sign-off (the playground already shows both — use it as the gate).

---

## 3. Per-glyph fixes

### Rework
- **`lock` (B1)** — The central form reads as an abstract ring-with-an-arm ("S"/"G"), not a lock; at 120px it's unreadable. Make the lock **unmistakable**: a clear recessed **keyhole** (circle + slot) on a raised pedestal, *or* a padlock **shackle arc**. Make the held token a single bright **upright green pin** that's obviously "in the slot." Simplify the workers (neutral caps per §2.2) and consider **2 workers instead of 3** so the eye lands on the token. This is the weakest of the set — worth the most effort.
- **`idempotency` (B2)** — The entire concept lives in the dedupe *beat*, which is invisible in a frozen frame (and at 120px). Add a **static-survivable cue**: keep a duplicate visibly **pinned and greying against the membrane** in the resting frame, make the **ledger/tally** bigger and show it *incrementing*, and widen the pass-slot so "one goes through" is obvious even without motion.
- **`deploy` (B4)** — Busiest glyph; four stages + two swap slots + pyramid/torus markers overload the thumbnail, and the shapes are arbitrary. **Cut to 3 stages**, use one consistent marker (a per-stage **fill bar that latches green**), and make the **zero-downtime version-swap the dominant motion** — that's the whole story; everything else is supporting.

### Polish
- **`pipeline` (A2)** — Swap the laptop-looking workers for **plain ceramic cubes that pulse** (§2.3). Let the **yellow hopper** (intake) and **green output tray** be the two anchors; thin out the lane so it reads at 120px.
- **`breaker` (C2)** — The red ring is excellent; keep it. Make the **lever a real, large switch** that visibly flips between CLOSED↕OPEN (currently a tiny nub). Trim the plinth (§2.4).
- **`sharding` (C3)** — Shard identity is too subtle. **Band each shard cylinder** with its own accent stripe and route the same-colored record to the matching band, so "same key → same shard" reads even in a still. Add a small directional notch on the router so the deflection is legible frozen.
- **`payments` (C5)** — Reads as "a row of cylinders." Make the **certificate tile the hero output** — bigger, sliding out of the tray with a clear **green seal** — so the payoff lands. Strengthen the AUTH(amber) vs CAPTURE(green) contrast so the two-step is obvious.

### Ship — with one nit
- **`autoscaler` (A1)** — Excellent. Only nit: the **scaled-out instance blocks** are small and half-hidden behind the vessel; bring them forward and make them **pop up** clearly so the "scale-out" beat reads, not just the fill level.
- **`realtime-hub` (A3)** — Good. Consider a **denser client ring** to sell "10,000 concurrent," and make sure the broadcast wave is visible in motion.

---

## 4. Suggested order

1. **`lock`** rework (weakest read, high-value concept).
2. **`deploy`** simplification (worst 120px parse).
3. **`idempotency`** static-cue pass.
4. Cross-cutting **§2.2 green discipline** + **§2.4 plinth/framing** normalization (one sweep, touches many glyphs, biggest "feels like one system" payoff).
5. **`payments`**, **`pipeline`**, **`sharding`**, **`breaker`** polish.
6. `autoscaler` instance nit + `realtime-hub` density.

---

## 5. What's already right (keep doing it)

- Consistent ceramic material + black plinth + blue-energy language across all 17.
- The reduced-motion toggle and the **120px legibility thumbnail** in the playground — keep these as the sign-off gate for every future glyph.
- The strongest glyphs prove the thesis from the roadmap: **a glyph that performs one concept, big and simple, beats a detailed diorama.** Push the rest toward that bar.
