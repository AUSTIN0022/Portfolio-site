'use client'

/**
 * InfraScaleSimulator — the second cinematic chapter. Where the Architecture
 * Journey answers "how does it work?", this answers "how did you make it
 * survive 10,000 people at once?".
 *
 * A single simulation model (offered load 0..1 + mode) drives everything, fed
 * two ways:
 *   1. SCROLL — a pinned narrative ramps load through idle → traffic → spike →
 *      autoscale → steady. The Auto-Scaling launch *lag* is what produces the
 *      "CPU hits 98%, then new instances boot and it drops" drama on its own.
 *   2. CONTROLS — a CloudWatch-style panel (Idle/Live toggle, traffic slider,
 *      Simulate Spike, Reset) lets the viewer take over and watch the ASG,
 *      ALB, gauges and cost react live.
 *
 * All per-frame work is imperative (DOM writes in a rAF loop) so scrolling and
 * dragging never thrash React or restart the SMIL packet flows.
 */

import { useEffect, useMemo, useRef, useState } from 'react'

/* ── Canvas ─────────────────────────────────────────────────────── */
const VB_W = 1220
const VB_H = 780
const MAX_INSTANCES = 8

const C = {
  infra: '#7a00fb',
  realtime: '#22d3f5',
  worker: '#44f87a',
  payment: '#ff6924',
  danger: '#ff3b3b',
  core: '#fff100',
}

/* Instance slot positions (grid, left region of the canvas) */
const SLOTS = Array.from({ length: MAX_INSTANCES }, (_, i) => {
  const col = i % 4
  const row = Math.floor(i / 4)
  return { x: 150 + col * 150, y: 350 + row * 130 }
})

const ROUTE53 = { x: 375, y: 90 }
const ALB = { x: 375, y: 220 }
const REDIS = { x: 250, y: 660 }
const RDS = { x: 560, y: 660 }

/* ── Beats (scroll narrative) ───────────────────────────────────── */
type Beat = {
  key: string
  index: string
  title: string
  subtitle: string
  why?: string
  mode: 'idle' | 'live'
  load: number
  target: number // target healthy instances (choreographed)
}

const BEATS: Beat[] = [
  {
    key: 'idle',
    index: '01',
    title: 'Idle mode',
    subtitle: 'Between contests, one small instance runs everything. Near-zero cost.',
    why: 'A single t3.medium hosts backend, worker and a local Docker Redis — about $35/month.',
    mode: 'idle',
    load: 0.05,
    target: 1,
  },
  {
    key: 'open',
    index: '02',
    title: 'Registration opens',
    subtitle: 'Traffic trickles in. The load balancer comes online; one instance is plenty.',
    mode: 'live',
    load: 0.18,
    target: 2,
  },
  {
    key: 'ramp',
    index: '03',
    title: 'Participants pour in',
    subtitle: 'Requests climb toward the live contest. Utilisation rises but holds.',
    mode: 'live',
    load: 0.5,
    target: 4,
  },
  {
    key: 'spike',
    index: '04',
    title: 'The contest goes live',
    subtitle: 'Everyone connects at once. CPU pins to 98%, latency balloons — the system is under stress.',
    why: 'WebSocket load is memory- and IO-bound, so the crunch shows up as heap + latency, not just CPU.',
    mode: 'live',
    load: 0.9,
    target: 4,
  },
  {
    key: 'scale',
    index: '05',
    title: 'Auto Scaling responds',
    subtitle: 'The group launches fresh t3.medium instances. As each turns healthy, the ALB spreads the load.',
    why: 'Peak demand is known in advance from registrations, so capacity is pre-warmed — not reactively chased.',
    mode: 'live',
    load: 0.9,
    target: 8,
  },
  {
    key: 'steady',
    index: '06',
    title: 'Steady at scale',
    subtitle: 'Eight instances, load balanced near 55%, latency flat — 7,500 live participants.',
    mode: 'live',
    load: 1,
    target: 8,
  },
  {
    key: 'control',
    index: '07',
    title: 'Now you drive it',
    subtitle: 'Take the controls. Drag the traffic, flip the mode, or simulate a spike — and watch it scale.',
    mode: 'live',
    load: 0.6,
    target: 5,
  },
]

/* ── Helpers ────────────────────────────────────────────────────── */
function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}
function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

type Sim = {
  rps: number
  participants: number
  connections: number
  cpu: number // avg across healthy
  mem: number
  latency: number
  cacheHit: number
  costLabel: string
  stressed: boolean
}

/** Derive all metrics from healthy instance count `h`, offered load, mode. */
function simulate(load: number, mode: 'idle' | 'live', h: number): Sim {
  if (mode === 'idle') {
    const rps = Math.round(lerp(8, 70, load))
    return {
      rps,
      participants: 0,
      connections: Math.round(lerp(2, 40, load)),
      cpu: Math.round(lerp(6, 22, load)),
      mem: 24,
      latency: 19,
      cacheHit: 99,
      costLabel: '$35 / month',
      stressed: false,
    }
  }
  const rps = Math.round(lerp(120, 5200, Math.pow(load, 1.25)))
  const participants = Math.round(lerp(0, 7500, load))
  const connections = participants
  const cpu = clamp(Math.round((rps / h / 1150) * 100), 6, 99)
  const mem = clamp(Math.round((connections / h / 1400) * 100), 12, 97)
  const latency = Math.round(23 + Math.max(0, cpu - 68) * 7)
  const cacheHit = clamp(Math.round(97 - load * 4), 92, 99)
  const dayCost = 14 + (h - 1) * 2.4
  return {
    rps,
    participants,
    connections,
    cpu,
    mem,
    latency,
    cacheHit,
    costLabel: `+ $${dayCost.toFixed(0)} / contest-day`,
    stressed: cpu >= 88,
  }
}

const fmt = (n: number) => n.toLocaleString('en-US')

export function InfraScaleSimulator() {
  const trackRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [beatIdx, setBeatIdx] = useState(0)
  const [progress, setProgress] = useState(0)
  const [interactive, setInteractive] = useState(false)

  const scene = useMemo(() => <SimScene />, [])

  // Shared mutable control state (avoids re-renders in the rAF loop).
  const ctrl = useRef({
    manual: false,
    manualLoad: 0.6,
    manualMode: 'live' as 'idle' | 'live',
    spikeUntil: 0,
  })

  const jumpToBeat = (i: number) => {
    const track = trackRef.current
    if (!track) return
    const top = window.scrollY + track.getBoundingClientRect().top
    const dist = track.offsetHeight - window.innerHeight
    window.scrollTo({ top: top + (i / (BEATS.length - 1)) * dist, behavior: 'smooth' })
  }

  useEffect(() => {
    const track = trackRef.current
    const wrap = wrapRef.current
    if (!track || !wrap) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const $ = <T extends Element>(sel: string) => wrap.querySelector<T>(sel)
    const $$ = <T extends Element>(sel: string) => Array.from(wrap.querySelectorAll<T>(sel))
    const slotEls = $$<SVGGElement>('[data-slot]')
    const albEl = $<SVGGElement>('[data-node="alb"]')
    const trafficInput = $<HTMLInputElement>('[data-ctrl="traffic"]')

    // Autoscaler state
    let h = 1 // current healthy
    let pendingSince = 0
    let pending = false
    let raf = 0
    let last = performance.now()
    let lastBeat = -1
    let lastP = 0

    const setSlot = (el: SVGGElement, state: 'off' | 'pending' | 'on', cpu: number, mem: number) => {
      el.dataset.state = state
      const cpuBar = el.querySelector<SVGRectElement>('[data-bar="cpu"]')
      const memBar = el.querySelector<SVGRectElement>('[data-bar="mem"]')
      const hot = cpu >= 88
      if (cpuBar) {
        cpuBar.setAttribute('width', `${(state === 'on' ? cpu : 0) * 0.86}`)
        cpuBar.setAttribute('fill', hot ? C.danger : C.worker)
      }
      if (memBar) memBar.setAttribute('width', `${(state === 'on' ? mem : 0) * 0.86}`)
    }

    const setGauge = (name: string, pct: number, value: string, danger = false) => {
      const fill = $<HTMLElement>(`[data-gauge="${name}"] [data-fill]`)
      const val = $<HTMLElement>(`[data-gauge="${name}"] [data-val]`)
      if (fill) {
        fill.style.transform = `scaleX(${clamp(pct, 0, 100) / 100})`
        fill.dataset.danger = danger ? '1' : '0'
      }
      if (val) val.textContent = value
    }

    const frame = (now: number) => {
      raf = 0
      const dt = Math.min(64, now - last)
      last = now

      const rect = track.getBoundingClientRect()
      const vh = window.innerHeight
      const total = rect.height - vh
      const p = clamp(total > 0 ? -rect.top / total : 0, 0, 1)
      lastP = p

      // Which beat + interpolated scroll load/target
      const fi = p * (BEATS.length - 1)
      const i0 = clamp(Math.floor(fi), 0, BEATS.length - 1)
      const i1 = Math.min(i0 + 1, BEATS.length - 1)
      const f = easeInOut(fi - i0)
      const active = Math.round(fi)
      const scrollLoad = lerp(BEATS[i0].load, BEATS[i1].load, f)
      const scrollMode = BEATS[active].mode
      const scrollTarget = BEATS[active].target

      // Resolve effective load/mode/target from scroll or manual controls
      const man = ctrl.current
      let load: number
      let mode: 'idle' | 'live'
      let target: number
      if (man.manual) {
        // spike easing
        if (now < man.spikeUntil) {
          const k = (man.spikeUntil - now) / 2600
          man.manualLoad = clamp(Math.max(man.manualLoad, 0.55 + 0.45 * k), 0, 1)
        }
        load = man.manualLoad
        mode = man.manualMode
        target = mode === 'idle' ? 1 : clamp(Math.ceil(simulate(load, 'live', MAX_INSTANCES).rps / 700), 1, MAX_INSTANCES)
      } else {
        load = scrollLoad
        mode = scrollMode
        target = scrollTarget
        // keep the slider reflecting scroll-driven load
        if (trafficInput && document.activeElement !== trafficInput) trafficInput.value = `${Math.round(load * 100)}`
      }

      // Autoscaler: ease healthy count toward target with launch lag
      if (mode === 'idle') {
        h = 1
        pending = false
      } else if (target > h && !pending) {
        pending = true
        pendingSince = now
      } else if (pending && now - pendingSince > (reduce ? 100 : 1300)) {
        h = clamp(h + 1, 1, MAX_INSTANCES)
        pending = false
      } else if (target < h && !pending) {
        h = clamp(h - 1, 1, MAX_INSTANCES)
      }

      const sim = simulate(load, mode, h)

      // Camera-less: instances render/update
      slotEls.forEach((el, i) => {
        let state: 'off' | 'pending' | 'on' = 'off'
        if (i < h) state = 'on'
        else if (pending && i === h) state = 'pending'
        // small per-instance jitter so the row feels alive
        const jitter = state === 'on' ? Math.sin(now / 500 + i) * 3 : 0
        setSlot(el, state, sim.cpu + jitter, sim.mem)
      })

      // ALB emphasis (dim in idle)
      if (albEl) albEl.style.opacity = mode === 'idle' ? '0.28' : '1'

      // Gauges
      setGauge('cpu', sim.cpu, `${sim.cpu}%`, sim.cpu >= 88)
      setGauge('mem', sim.mem, `${sim.mem}%`, sim.mem >= 90)
      setGauge('conn', (sim.connections / 8000) * 100, fmt(sim.connections))
      setGauge('rps', (sim.rps / 5500) * 100, fmt(sim.rps))
      setGauge('lat', clamp((sim.latency / 300) * 100, 0, 100), `${sim.latency} ms`, sim.latency > 150)
      setGauge('cache', sim.cacheHit, `${sim.cacheHit}%`)

      // Cost + instance count + mode readouts
      const costEl = $<HTMLElement>('[data-readout="cost"]')
      if (costEl) costEl.textContent = sim.costLabel
      const instEl = $<HTMLElement>('[data-readout="instances"]')
      if (instEl) instEl.textContent = `${h}×`
      const modeChip = $<HTMLElement>('[data-readout="mode"]')
      if (modeChip) {
        modeChip.textContent = mode === 'idle' ? '🌙 IDLE' : '⚡ LIVE'
        modeChip.dataset.mode = mode
      }

      // Panel stress vignette
      wrap.dataset.stress = sim.stressed ? '1' : '0'

      // React state (throttled to changes)
      if (active !== lastBeat) {
        lastBeat = active
        setBeatIdx(active)
      }
      setProgress(p)
      setInteractive(man.manual)

      raf = requestAnimationFrame(frame)
    }

    raf = requestAnimationFrame(frame)

    // ── Controls wiring ──
    const onTraffic = (e: Event) => {
      const v = Number((e.target as HTMLInputElement).value) / 100
      ctrl.current.manual = true
      ctrl.current.manualLoad = v
      if (ctrl.current.manualMode === 'idle') ctrl.current.manualMode = 'live'
    }
    const onIdle = () => {
      ctrl.current.manual = true
      ctrl.current.manualMode = 'idle'
    }
    const onLive = () => {
      ctrl.current.manual = true
      ctrl.current.manualMode = 'live'
    }
    const onSpike = () => {
      ctrl.current.manual = true
      ctrl.current.manualMode = 'live'
      ctrl.current.manualLoad = 1
      ctrl.current.spikeUntil = performance.now() + 2600
    }
    const onReset = () => {
      ctrl.current.manual = false
      ctrl.current.spikeUntil = 0
    }
    trafficInput?.addEventListener('input', onTraffic)
    $<HTMLButtonElement>('[data-ctrl="idle"]')?.addEventListener('click', onIdle)
    $<HTMLButtonElement>('[data-ctrl="live"]')?.addEventListener('click', onLive)
    $<HTMLButtonElement>('[data-ctrl="spike"]')?.addEventListener('click', onSpike)
    $<HTMLButtonElement>('[data-ctrl="reset"]')?.addEventListener('click', onReset)

    return () => {
      if (raf) cancelAnimationFrame(raf)
      trafficInput?.removeEventListener('input', onTraffic)
    }
  }, [])

  const beat = BEATS[beatIdx]
  const capKey = interactive ? 'manual' : beat.key
  const capTitle = interactive ? 'You have the controls' : beat.title
  const capSub = interactive
    ? 'Drag the traffic, flip the mode, or hit Simulate spike — the Auto Scaling group, load balancer and gauges all respond live. Press Reset to hand it back.'
    : beat.subtitle
  const capWhy = interactive ? undefined : beat.why

  return (
    <div ref={trackRef} style={{ position: 'relative', height: `${BEATS.length * 92}vh` }}>
      <div style={{ position: 'sticky', top: 0, height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="is-panel" ref={wrapRef} data-stress="0">
          {scene}

          {/* Control panel + gauges (right rail) */}
          <div className="is-rail-right">
            <div className="is-modebar">
              <span className="is-chip" data-readout="mode" data-mode="idle">🌙 IDLE</span>
              <span className="is-cost" data-readout="cost">$35 / month</span>
            </div>

            <div className="is-gauges">
              <Gauge name="cpu" label="CPU" />
              <Gauge name="mem" label="Memory" />
              <Gauge name="conn" label="Connections" />
              <Gauge name="rps" label="Requests / sec" />
              <Gauge name="lat" label="P95 latency" />
              <Gauge name="cache" label="Redis hit rate" />
            </div>

            <div className="is-controls" data-live={interactive ? '1' : '0'}>
              <div className="is-ctrl-head">
                <span>CONTROL PANEL</span>
                <span className="is-live-dot" data-on={interactive ? '1' : '0'}>{interactive ? 'LIVE' : 'AUTO'}</span>
              </div>
              <div className="is-toggle">
                <button type="button" data-ctrl="idle">Idle</button>
                <button type="button" data-ctrl="live">Live Contest</button>
              </div>
              <label className="is-slider-label">
                Traffic
                <input data-ctrl="traffic" type="range" min={0} max={100} defaultValue={60} />
              </label>
              <div className="is-buttons">
                <button type="button" data-ctrl="spike" className="is-btn-spike">⚡ Simulate spike</button>
                <button type="button" data-ctrl="reset" className="is-btn-reset">Reset</button>
              </div>
            </div>
          </div>

          {/* HUD — beat counter + instance count */}
          <div className="is-hud">
            <div className="is-counter">
              <span className="is-counter-cur">{beat.index}</span>
              <span className="is-counter-tot">/ {String(BEATS.length).padStart(2, '0')}</span>
            </div>
            <div className="is-online">
              <span className="is-online-num" data-readout="instances">1×</span>
              <span className="is-online-lab">t3.medium</span>
            </div>
          </div>

          {/* Caption */}
          <div className="is-caption">
            <div className="is-kicker">{interactive ? '// LIVE — MANUAL CONTROL' : '// PRODUCTION ENGINEERING'}</div>
            <h3 className="is-title" key={capKey}>{capTitle}</h3>
            <p className="is-sub">{capSub}</p>
            {capWhy && (
              <p className="is-why" key={capKey + '-why'}>
                <span className="is-why-tag">WHY</span>
                {capWhy}
              </p>
            )}
          </div>

          {/* Milestone rail */}
          <div className="is-rail">
            <div className="is-rail-fill" style={{ transform: `scaleX(${progress})` }} />
            <div className="is-rail-ticks">
              {BEATS.map((b, i) => (
                <button
                  key={b.key}
                  type="button"
                  className="is-tick"
                  data-on={i <= beatIdx ? '1' : '0'}
                  data-cur={i === beatIdx ? '1' : '0'}
                  onClick={() => jumpToBeat(i)}
                  aria-label={`Jump to beat ${i + 1}: ${b.title}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
      <SimStyles />
    </div>
  )
}

function Gauge({ name, label }: { name: string; label: string }) {
  return (
    <div className="is-gauge" data-gauge={name}>
      <div className="is-gauge-top">
        <span className="is-gauge-lab">{label}</span>
        <span className="is-gauge-val" data-val>—</span>
      </div>
      <div className="is-gauge-track">
        <div className="is-gauge-fill" data-fill />
      </div>
    </div>
  )
}

/* ── Static SVG topology ────────────────────────────────────────── */
function SimScene() {
  const alive = { dur: 1.5 }
  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="xMidYMid meet" className="is-svg">
      <defs>
        <radialGradient id="is-bg" cx="34%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#16161c" />
          <stop offset="100%" stopColor="#08080a" />
        </radialGradient>
      </defs>
      <rect x={0} y={0} width={VB_W} height={VB_H} fill="url(#is-bg)" />

      {/* Connectors */}
      <g stroke={C.infra} strokeWidth={2} fill="none" opacity={0.5}>
        <path d={`M ${ROUTE53.x} ${ROUTE53.y + 30} L ${ALB.x} ${ALB.y - 30}`} />
      </g>
      <g stroke={C.realtime} strokeWidth={1.6} fill="none" opacity={0.35}>
        {SLOTS.map((s, i) => (
          <path key={i} data-link={`alb-${i}`} d={`M ${ALB.x} ${ALB.y + 30} L ${s.x} ${s.y - 34}`} />
        ))}
      </g>
      <g stroke="#555" strokeWidth={1.4} fill="none" opacity={0.3}>
        {SLOTS.map((s, i) => (
          <path key={i} d={`M ${s.x} ${s.y + 34} L ${REDIS.x} ${REDIS.y - 30}`} />
        ))}
        {SLOTS.map((s, i) => (
          <path key={`r${i}`} d={`M ${s.x} ${s.y + 34} L ${RDS.x} ${RDS.y - 30}`} />
        ))}
      </g>

      {/* ALB → instance request packets (SMIL) */}
      <g>
        {SLOTS.map((s, i) => (
          <circle key={i} r={3.5} fill={C.realtime} opacity={0.85}>
            <animateMotion dur={`${(alive.dur + (i % 3) * 0.2).toFixed(2)}s`} begin={`${(i * 0.12).toFixed(2)}s`} repeatCount="indefinite" path={`M ${ALB.x} ${ALB.y + 30} L ${s.x} ${s.y - 34}`} />
          </circle>
        ))}
      </g>

      {/* Route53 + ALB + Redis + RDS */}
      <PillNode x={ROUTE53.x} y={ROUTE53.y} w={210} h={62} color={C.core} label="Route 53" sub="ysmquizbuzz.com" />
      <g data-node="alb">
        <PillNode x={ALB.x} y={ALB.y} w={250} h={62} color={C.realtime} label="Application LB" sub="socket.io · api/quiz" />
      </g>
      <PillNode x={REDIS.x} y={REDIS.y} w={200} h={62} color={C.infra} label="ElastiCache" sub="Redis · primary+replica" />
      <PillNode x={RDS.x} y={RDS.y} w={200} h={62} color={C.infra} label="RDS Postgres" sub="durable store" />

      {/* Instance slots */}
      {SLOTS.map((s, i) => (
        <InstanceCard key={i} i={i} x={s.x} y={s.y} />
      ))}
    </svg>
  )
}

function PillNode({ x, y, w, h, color, label, sub }: { x: number; y: number; w: number; h: number; color: string; label: string; sub: string }) {
  return (
    <g>
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={14} fill="#141418" stroke={color} strokeWidth={2.2} />
      <rect x={x - w / 2} y={y - h / 2 + 12} width={4} height={h - 24} rx={2} fill={color} />
      <text x={x} y={y - 4} textAnchor="middle" className="is-node-label" fill="#fff">{label}</text>
      <text x={x} y={y + 15} textAnchor="middle" className="is-node-sub" fill="#8b8b93">{sub}</text>
    </g>
  )
}

function InstanceCard({ i, x, y }: { i: number; x: number; y: number }) {
  const w = 122
  const h = 92
  return (
    <g data-slot={i} data-state="off" className="is-slot" transform={`translate(${x} ${y})`}>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={12} className="is-slot-box" fill="#111114" stroke={C.worker} strokeWidth={2} />
      <text x={-w / 2 + 12} y={-h / 2 + 22} className="is-slot-name" fill="#fff">EC2 {String.fromCharCode(65 + i)}</text>
      <text x={-w / 2 + 12} y={-h / 2 + 40} className="is-slot-state" fill={C.worker}>healthy</text>
      {/* CPU bar */}
      <text x={-w / 2 + 12} y={h / 2 - 26} className="is-slot-tag" fill="#7a7a82">CPU</text>
      <rect x={-w / 2 + 44} y={h / 2 - 34} width={86} height={8} rx={4} fill="#26262c" />
      <rect data-bar="cpu" x={-w / 2 + 44} y={h / 2 - 34} width={0} height={8} rx={4} fill={C.worker} />
      {/* MEM bar */}
      <text x={-w / 2 + 12} y={h / 2 - 8} className="is-slot-tag" fill="#7a7a82">MEM</text>
      <rect x={-w / 2 + 44} y={h / 2 - 16} width={86} height={8} rx={4} fill="#26262c" />
      <rect data-bar="mem" x={-w / 2 + 44} y={h / 2 - 16} width={0} height={8} rx={4} fill={C.infra} />
      {/* pending spinner */}
      <circle className="is-slot-spin" cx={0} cy={0} r={16} fill="none" stroke={C.core} strokeWidth={3} strokeDasharray="26 60" />
      <text x={0} y={26} textAnchor="middle" className="is-slot-pending" fill={C.core}>launching…</text>
    </g>
  )
}

/* ── Styles ─────────────────────────────────────────────────────── */
function SimStyles() {
  return (
    <style>{`
      .is-panel {
        position: relative; width: 100%; height: min(88vh, 780px);
        border-radius: 32px; overflow: hidden; background: #08080a;
        box-shadow: 0 40px 120px -40px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.06);
      }
      .is-panel::after {
        content: ''; position: absolute; inset: 0; pointer-events: none; border-radius: 32px;
        box-shadow: inset 0 0 120px 10px rgba(255,59,59,0); transition: box-shadow .5s ease;
      }
      .is-panel[data-stress='1']::after { box-shadow: inset 0 0 120px 12px rgba(255,59,59,0.28); animation: is-shake .5s ease-in-out infinite; }
      @keyframes is-shake { 0%,100%{ transform: translate(0,0);} 25%{ transform: translate(1px,-1px);} 75%{ transform: translate(-1px,1px);} }

      .is-svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
      .is-node-label { font-family: var(--font-suisseintlcond), sans-serif; font-weight: 700; font-size: 20px; letter-spacing: -0.4px; }
      .is-node-sub { font-family: var(--font-suisseintlmono), monospace; font-size: 12px; }

      .is-slot { transition: opacity .4s ease; }
      .is-slot[data-state='off'] { opacity: 0; }
      .is-slot[data-state='pending'] { opacity: 1; }
      .is-slot[data-state='on'] { opacity: 1; }
      .is-slot-box { transition: stroke .3s ease, filter .3s ease; }
      .is-slot[data-state='on'] .is-slot-box { filter: drop-shadow(0 0 10px rgba(68,248,122,0.5)); }
      .is-slot[data-state='pending'] .is-slot-box { stroke: ${C.core}; stroke-dasharray: 6 6; }
      .is-slot-name { font-family: var(--font-suisseintlcond), sans-serif; font-weight: 700; font-size: 17px; }
      .is-slot-state { font-family: var(--font-suisseintlmono), monospace; font-size: 11px; }
      .is-slot-tag { font-family: var(--font-suisseintlmono), monospace; font-size: 10px; }
      .is-slot[data-state='pending'] .is-slot-name,
      .is-slot[data-state='pending'] .is-slot-state,
      .is-slot[data-state='pending'] .is-slot-tag,
      .is-slot[data-state='pending'] [data-bar] { opacity: 0; }
      .is-slot-spin, .is-slot-pending { opacity: 0; }
      .is-slot[data-state='pending'] .is-slot-spin { opacity: 1; animation: is-spin 0.9s linear infinite; transform-box: fill-box; transform-origin: center; }
      .is-slot[data-state='pending'] .is-slot-pending { opacity: 1; }
      @keyframes is-spin { to { transform: rotate(360deg); } }

      /* Right rail — gauges + controls */
      .is-rail-right {
        position: absolute; top: 22px; right: 22px; width: min(310px, 40%);
        display: flex; flex-direction: column; gap: 14px;
      }
      .is-modebar { display: flex; align-items: center; justify-content: space-between; }
      .is-chip { font-family: var(--font-suisseintlmono), monospace; font-size: 12px; letter-spacing: 0.4px; padding: 5px 12px; border-radius: 20px; background: rgba(255,255,255,0.08); color: #fff; }
      .is-chip[data-mode='live'] { background: rgba(34,211,245,0.16); color: ${C.realtime}; }
      .is-cost { font-family: var(--font-suisseintlmono), monospace; font-size: 12px; color: var(--color-electric-yellow,#fff100); }

      .is-gauges { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 14px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 14px; backdrop-filter: blur(6px); }
      .is-gauge-top { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 5px; }
      .is-gauge-lab { font-family: var(--font-suisseintlmono), monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.2px; color: rgba(255,255,255,0.45); }
      .is-gauge-val { font-family: var(--font-suisseintlcond), sans-serif; font-weight: 700; font-size: 16px; color: #fff; letter-spacing: -0.3px; }
      .is-gauge-track { height: 6px; border-radius: 3px; background: rgba(255,255,255,0.1); overflow: hidden; }
      .is-gauge-fill { height: 100%; width: 100%; border-radius: 3px; background: linear-gradient(90deg, #22d3f5, #44f87a); transform: scaleX(0); transform-origin: left center; transition: transform .35s cubic-bezier(.4,0,.2,1), background .3s ease; }
      .is-gauge-fill[data-danger='1'] { background: ${C.danger} !important; }

      .is-controls { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 12px; backdrop-filter: blur(6px); }
      .is-ctrl-head { display: flex; justify-content: space-between; align-items: center; font-family: var(--font-suisseintlmono), monospace; font-size: 10px; letter-spacing: 0.4px; color: rgba(255,255,255,0.5); }
      .is-live-dot { padding: 2px 8px; border-radius: 20px; background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.5); }
      .is-live-dot[data-on='1'] { background: rgba(68,248,122,0.18); color: ${C.worker}; }
      .is-toggle { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
      .is-toggle button { font-family: var(--font-suisseintlmono), monospace; font-size: 12px; padding: 8px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.03); color: rgba(255,255,255,0.7); cursor: pointer; transition: all .2s ease; }
      .is-toggle button:hover { border-color: rgba(255,255,255,0.35); color: #fff; }
      .is-slider-label { font-family: var(--font-suisseintlmono), monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.3px; color: rgba(255,255,255,0.5); display: flex; flex-direction: column; gap: 8px; }
      .is-slider-label input[type='range'] { -webkit-appearance: none; appearance: none; height: 6px; border-radius: 3px; background: linear-gradient(90deg, #22d3f5, #fff100); outline: none; cursor: pointer; }
      .is-slider-label input[type='range']::-webkit-slider-thumb { -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%; background: #fff; box-shadow: 0 0 10px rgba(255,255,255,0.6); cursor: grab; }
      .is-slider-label input[type='range']::-moz-range-thumb { width: 18px; height: 18px; border: 0; border-radius: 50%; background: #fff; box-shadow: 0 0 10px rgba(255,255,255,0.6); cursor: grab; }
      .is-buttons { display: grid; grid-template-columns: 1.4fr 1fr; gap: 6px; }
      .is-buttons button { font-family: var(--font-suisseintlmono), monospace; font-size: 12px; padding: 9px; border-radius: 10px; border: 0; cursor: pointer; transition: transform .15s ease, filter .2s ease; }
      .is-buttons button:hover { filter: brightness(1.1); transform: translateY(-1px); }
      .is-btn-spike { background: ${C.payment}; color: #fff; font-weight: 500; }
      .is-btn-reset { background: rgba(255,255,255,0.1); color: #fff; }

      .is-hud { position: absolute; top: 20px; left: 24px; display: flex; align-items: flex-start; gap: 22px; pointer-events: none; }
      .is-counter { font-family: var(--font-suisseintlcond), sans-serif; font-weight: 700; display: flex; align-items: baseline; gap: 6px; color: #fff; }
      .is-counter-cur { font-size: 32px; letter-spacing: -1px; line-height: 1; }
      .is-counter-tot { font-size: 13px; color: rgba(255,255,255,0.4); }
      .is-online { text-align: left; }
      .is-online-num { font-family: var(--font-suisseintlcond), sans-serif; font-weight: 700; font-size: 32px; letter-spacing: -1px; line-height: 1; color: ${C.worker}; display: block; }
      .is-online-lab { font-family: var(--font-suisseintlmono), monospace; font-size: 10px; letter-spacing: 0.2px; text-transform: uppercase; color: rgba(255,255,255,0.4); }

      .is-caption { position: absolute; left: 24px; bottom: 60px; max-width: min(500px, 52%); pointer-events: none; }
      .is-kicker { font-family: var(--font-suisseintlmono), monospace; font-size: 12px; letter-spacing: 0.4px; color: rgba(255,255,255,0.45); margin-bottom: 12px; }
      .is-title { font-family: var(--font-suisseintlcond), sans-serif; font-weight: 700; font-size: clamp(26px, 3.6vw, 42px); line-height: 0.98; letter-spacing: -1.2px; color: #fff; margin: 0 0 12px; text-wrap: balance; animation: is-rise .5s cubic-bezier(0.2,0.7,0.2,1) both; }
      .is-sub { font-family: var(--font-suisseintl), sans-serif; font-size: clamp(13px, 1.3vw, 16px); line-height: 1.45; letter-spacing: -0.2px; color: rgba(255,255,255,0.64); margin: 0; text-wrap: pretty; }
      .is-why { display: flex; gap: 10px; align-items: baseline; margin: 14px 0 0; font-family: var(--font-suisseintl), sans-serif; font-size: clamp(12px, 1.15vw, 14px); line-height: 1.4; color: rgba(255,255,255,0.55); border-left: 2px solid var(--color-electric-yellow,#fff100); padding-left: 12px; animation: is-rise .5s .1s cubic-bezier(0.2,0.7,0.2,1) both; }
      .is-why-tag { font-family: var(--font-suisseintlmono), monospace; font-size: 10px; letter-spacing: 0.5px; color: var(--color-electric-yellow,#fff100); flex-shrink: 0; }
      @keyframes is-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }

      .is-rail { position: absolute; left: 24px; right: 24px; bottom: 26px; }
      .is-rail-fill { height: 2px; background: linear-gradient(90deg, #7a00fb, #44f87a); transform-origin: left center; transform: scaleX(0); border-radius: 2px; }
      .is-rail-ticks { position: absolute; inset: -7px 0; display: flex; justify-content: space-between; align-items: center; }
      .is-tick { width: 14px; height: 14px; padding: 0; border: 0; border-radius: 50%; background: rgba(255,255,255,0.16); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.25); cursor: pointer; transition: background .3s ease, box-shadow .3s ease, transform .3s ease; }
      .is-tick:hover { transform: scale(1.25); }
      .is-tick[data-on='1'] { background: #fff; box-shadow: 0 0 8px rgba(255,255,255,0.6); }
      .is-tick[data-cur='1'] { background: ${C.worker}; box-shadow: 0 0 12px rgba(68,248,122,0.8); transform: scale(1.3); }

      @media (max-width: 900px) {
        .is-rail-right { position: absolute; width: 46%; top: 16px; right: 16px; gap: 10px; }
        .is-gauges { grid-template-columns: 1fr; }
        .is-caption { max-width: 48%; bottom: 54px; }
      }
      @media (prefers-reduced-motion: reduce) {
        .is-title, .is-why { animation: none; }
        .is-panel[data-stress='1']::after { animation: none; }
      }
    `}</style>
  )
}
