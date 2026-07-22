'use client'

/**
 * ArchitectureJourney — a scroll-pinned, cinematic build-up of the QuizBuzz
 * system. A single dark "theater" canvas stays pinned while the camera flies
 * across a virtual architecture (Google-Earth style), nodes are *born* (grow +
 * bounce + settle), connections *draw themselves*, dense particle traffic runs
 * on the live wires, and one glowing request token travels the entire path —
 * payment → participant → socket → submission → queue → worker → certificate —
 * narrated by movie-subtitle captions.
 *
 * Every per-frame update (camera, node/edge emphasis, the hero token) is done
 * imperatively against the DOM inside a rAF loop — never through React state —
 * so scrolling never re-renders the SVG and never restarts the SMIL packet
 * animations. Only the caption + counters (which change once per beat) use state.
 */

import { useEffect, useMemo, useRef, useState } from 'react'

/* ── Virtual canvas ─────────────────────────────────────────────── */
const VB_W = 1800
const VB_H = 1050

/* ── Semantic domain palette (author-specified) ─────────────────── */
const DOMAIN = {
  core: '#fff100', // Contest / core domain
  infra: '#7a00fb', // AWS · Docker · Redis
  realtime: '#22d3f5', // WebSockets · Socket.IO
  worker: '#44f87a', // Workers · background jobs
  payment: '#ff6924', // Payments · critical events
  analytics: '#ff7df1', // Analytics · certificates
} as const
type Domain = keyof typeof DOMAIN

const LEGEND: { domain: Domain; label: string }[] = [
  { domain: 'core', label: 'Core domain' },
  { domain: 'payment', label: 'Payments' },
  { domain: 'realtime', label: 'Real-time' },
  { domain: 'worker', label: 'Workers' },
  { domain: 'infra', label: 'Infrastructure' },
  { domain: 'analytics', label: 'Analytics' },
]

/* ── Nodes ──────────────────────────────────────────────────────── */
type NodeDef = {
  id: string
  label: string
  sub?: string
  x: number
  y: number
  w: number
  h: number
  domain: Domain
  appear: number
}

const NODES: NodeDef[] = [
  { id: 'org', label: 'Organization', sub: 'Tenant · host', x: 800, y: 140, w: 230, h: 92, domain: 'core', appear: 0 },
  { id: 'contest', label: 'Contest', sub: 'The core entity', x: 800, y: 360, w: 280, h: 120, domain: 'core', appear: 0 },
  { id: 'questionBank', label: 'Question Bank', sub: 'Randomized pool', x: 400, y: 360, w: 240, h: 96, domain: 'core', appear: 1 },
  { id: 'participant', label: 'Participant', sub: 'Paid registration', x: 1200, y: 470, w: 240, h: 96, domain: 'core', appear: 1 },
  { id: 'payment', label: 'Payment', sub: 'Razorpay webhook', x: 1200, y: 270, w: 240, h: 96, domain: 'payment', appear: 1 },
  { id: 'gateway', label: 'Socket.IO Gateway', sub: 'EIO4 · 10k sockets', x: 800, y: 600, w: 300, h: 108, domain: 'realtime', appear: 2 },
  { id: 'liveq', label: 'Live Questions', sub: 'Synchronized delivery', x: 430, y: 610, w: 240, h: 96, domain: 'realtime', appear: 2 },
  { id: 'redis', label: 'Redis', sub: 'Live state · pub/sub', x: 800, y: 790, w: 220, h: 92, domain: 'infra', appear: 2 },
  { id: 'postgres', label: 'PostgreSQL', sub: 'Durable store', x: 430, y: 860, w: 240, h: 96, domain: 'infra', appear: 4 },
  { id: 'submission', label: 'Submission', sub: 'Locked · idempotent', x: 1200, y: 660, w: 240, h: 96, domain: 'worker', appear: 3 },
  { id: 'bullmq', label: 'BullMQ', sub: '6 queues', x: 1200, y: 830, w: 220, h: 92, domain: 'worker', appear: 3 },
  { id: 'worker', label: 'Worker', sub: 'Evaluation · certs', x: 830, y: 920, w: 240, h: 96, domain: 'worker', appear: 3 },
  { id: 'messaging', label: 'Messaging', sub: 'SMS · Email', x: 1560, y: 300, w: 210, h: 92, domain: 'analytics', appear: 5 },
  { id: 'analytics', label: 'Analytics', sub: 'Daily rollups', x: 1580, y: 480, w: 210, h: 92, domain: 'analytics', appear: 5 },
  { id: 'leaderboard', label: 'Leaderboard', sub: 'Live ranking', x: 1580, y: 660, w: 210, h: 92, domain: 'analytics', appear: 5 },
  { id: 'certificate', label: 'Certificate', sub: 'PDF → S3', x: 1560, y: 840, w: 210, h: 92, domain: 'analytics', appear: 5 },
]

/* ── Edges ──────────────────────────────────────────────────────── */
type EdgeDef = {
  from: string
  to: string
  appear: number
  animated?: boolean
  alive?: boolean // dense, continuous traffic
  color?: Domain
}

const EDGES: EdgeDef[] = [
  { from: 'org', to: 'contest', appear: 0 },
  { from: 'questionBank', to: 'contest', appear: 1 },
  { from: 'payment', to: 'participant', appear: 1, animated: true, color: 'payment' },
  { from: 'participant', to: 'contest', appear: 1 },
  { from: 'participant', to: 'gateway', appear: 2, animated: true, alive: true, color: 'realtime' },
  { from: 'gateway', to: 'liveq', appear: 2, animated: true, alive: true, color: 'realtime' },
  { from: 'gateway', to: 'redis', appear: 2, animated: true, alive: true, color: 'realtime' },
  { from: 'gateway', to: 'submission', appear: 3 },
  { from: 'submission', to: 'bullmq', appear: 3, animated: true, alive: true, color: 'worker' },
  { from: 'bullmq', to: 'worker', appear: 3, animated: true, alive: true, color: 'worker' },
  { from: 'redis', to: 'bullmq', appear: 4, animated: true, alive: true, color: 'infra' },
  { from: 'worker', to: 'postgres', appear: 4 },
  { from: 'worker', to: 'leaderboard', appear: 5, animated: true, color: 'analytics' },
  { from: 'worker', to: 'certificate', appear: 5, animated: true, color: 'analytics' },
  { from: 'worker', to: 'analytics', appear: 5, animated: true, color: 'analytics' },
  { from: 'worker', to: 'messaging', appear: 5, animated: true, color: 'analytics' },
]

/* ── Stages (story beats) ───────────────────────────────────────── */
type Stage = {
  key: string
  index: string
  title: string
  subtitle: string
  why?: string
  focus: { x: number; y: number; scale: number }
  active: string[] | 'ALL'
}

const STAGES: Stage[] = [
  {
    key: 'intro',
    index: '01',
    title: 'You are looking at QuizBuzz',
    subtitle: 'Every contest begins as a single entity. Everything else grows out of it.',
    focus: { x: 800, y: 350, scale: 2.6 },
    active: ['org', 'contest'],
  },
  {
    key: 'register',
    index: '02',
    title: 'A participant joins',
    subtitle: 'Registration is paid and verified before a single question is served.',
    why: 'Money clears via the Razorpay webhook before any compute is spent — no free load on the system.',
    focus: { x: 1030, y: 380, scale: 1.5 },
    active: ['contest', 'questionBank', 'payment', 'participant'],
  },
  {
    key: 'live',
    index: '03',
    title: 'The doors open',
    subtitle: '10,000 WebSocket connections open at once, on one synchronized clock.',
    why: 'Redis holds the shared live state, so a socket survives across any server instance.',
    focus: { x: 700, y: 650, scale: 1.7 },
    active: ['participant', 'gateway', 'liveq', 'redis'],
  },
  {
    key: 'submit',
    index: '04',
    title: 'An answer is submitted',
    subtitle: 'It locks idempotently, then hands off to a background queue.',
    why: 'Heavy work runs async on BullMQ so the API stays under 100 ms during the peak.',
    focus: { x: 1050, y: 800, scale: 1.7 },
    active: ['gateway', 'submission', 'bullmq', 'worker', 'redis'],
  },
  {
    key: 'infra',
    index: '05',
    title: 'The system holds',
    subtitle: 'Redis keeps the live state and every job; Postgres makes the result durable.',
    focus: { x: 620, y: 820, scale: 1.6 },
    active: ['redis', 'bullmq', 'worker', 'postgres'],
  },
  {
    key: 'results',
    index: '06',
    title: 'Results, automatically',
    subtitle: 'One worker fans out: score, leaderboard, certificate, and messaging — per participant.',
    focus: { x: 1350, y: 560, scale: 1.4 },
    active: ['worker', 'leaderboard', 'certificate', 'analytics', 'messaging'],
  },
  {
    key: 'whole',
    index: '07',
    title: 'That’s the whole system.',
    subtitle: 'Payments, real-time, queues, workers, infrastructure — assembled in front of you.',
    focus: { x: 940, y: 540, scale: 0.8 },
    active: 'ALL',
  },
]

/* ── The travelling request — one token's path through the system ── */
const REQUEST_PATH = ['payment', 'participant', 'gateway', 'submission', 'bullmq', 'worker', 'certificate']
const REQUEST_LABELS = [
  'registration paid ✓',
  'websocket opened',
  'answer submitted',
  'queued for evaluation',
  'worker scoring…',
  'certificate issued ✓',
]

/* ── Helpers ────────────────────────────────────────────────────── */
const nodeById = new Map(NODES.map((n) => [n.id, n]))

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}
function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}
function edgePath(from: NodeDef, to: NodeDef) {
  return `M ${from.x} ${from.y} L ${to.x} ${to.y}`
}

/** Point + segment index along a polyline of node centres, param t∈[0,1]. */
function pointOnPath(ids: string[], t: number) {
  const pts = ids.map((id) => nodeById.get(id)!)
  const segs = pts.length - 1
  const ft = clamp(t, 0, 1) * segs
  const i = clamp(Math.floor(ft), 0, segs - 1)
  const f = easeInOut(ft - i)
  return {
    x: lerp(pts[i].x, pts[i + 1].x, f),
    y: lerp(pts[i].y, pts[i + 1].y, f),
    seg: i,
    target: pts[i + 1],
  }
}

export function ArchitectureJourney() {
  const trackRef = useRef<HTMLDivElement>(null)
  const svgWrapRef = useRef<HTMLDivElement>(null)
  const railFillRef = useRef<HTMLDivElement>(null)
  const [stageIdx, setStageIdx] = useState(0)
  const [nodesOnline, setNodesOnline] = useState(2)

  // Memoized so caption/counter state changes never reconcile the SVG.
  const scene = useMemo(() => <Scene />, [])

  const jumpToBeat = (i: number) => {
    const track = trackRef.current
    if (!track) return
    const top = window.scrollY + track.getBoundingClientRect().top
    const dist = track.offsetHeight - window.innerHeight
    window.scrollTo({ top: top + (i / (STAGES.length - 1)) * dist, behavior: 'smooth' })
  }

  useEffect(() => {
    const track = trackRef.current
    const wrap = svgWrapRef.current
    const camera = wrap?.querySelector<SVGGElement>('[data-camera]')
    if (!track || !wrap || !camera) return

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const nodeEls = new Map<string, SVGGElement>()
    const edgeEls = new Map<string, { el: SVGGElement; path: SVGPathElement | null; packet: SVGGElement | null }>()
    const edgeLen = new Map<string, number>()
    wrap.querySelectorAll<SVGGElement>('[data-node]').forEach((el) => nodeEls.set(el.dataset.node!, el))
    wrap.querySelectorAll<SVGGElement>('[data-edge]').forEach((el) => {
      const key = el.dataset.edge!
      const path = el.querySelector<SVGPathElement>('path')
      const packet = el.querySelector<SVGGElement>('[data-packet]')
      edgeEls.set(key, { el, path, packet })
      if (path) {
        const len = path.getTotalLength()
        edgeLen.set(key, len)
        path.style.strokeDasharray = `${len}`
        path.style.strokeDashoffset = `${len}`
      }
    })
    const hero = wrap.querySelector<SVGGElement>('[data-hero]')
    const heroLabel = wrap.querySelector<SVGTextElement>('[data-hero-label]')
    const swarm = wrap.querySelector<SVGGElement>('[data-swarm]')
    const born = new Set<string>()

    let raf = 0
    let isVisible = true
    let lastStage = -1
    let lastOnline = -1
    let lastP = 0
    let lastSeg = -1

    const io = new IntersectionObserver(
      ([entry]) => {
        const prev = isVisible
        isVisible = entry.isIntersecting
        if (!prev && isVisible) {
          render()
        }
      },
      { threshold: 0.05 }
    )
    io.observe(track)

    const render = () => {
      raf = 0
      if (!isVisible) return

      const rect = track.getBoundingClientRect()
      const vh = window.innerHeight
      const total = rect.height - vh
      const p = clamp(total > 0 ? -rect.top / total : 0, 0, 1)
      const vel = Math.abs(p - lastP)
      lastP = p

      // Camera — interpolate between the two nearest keyframes.
      const fi = p * (STAGES.length - 1)
      const i0 = clamp(Math.floor(fi), 0, STAGES.length - 1)
      const i1 = Math.min(i0 + 1, STAGES.length - 1)
      const f = easeInOut(fi - i0)
      const fx = lerp(STAGES[i0].focus.x, STAGES[i1].focus.x, f)
      const fy = lerp(STAGES[i0].focus.y, STAGES[i1].focus.y, f)
      const fs = lerp(STAGES[i0].focus.scale, STAGES[i1].focus.scale, f)
      const tx = VB_W / 2 - fx * fs
      const ty = VB_H / 2 - fy * fs
      camera.setAttribute('transform', `translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${fs.toFixed(4)})`)
      const blur = reduce ? 0 : clamp(vel * 260, 0, 1.6)
      const targetFilter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : 'none'
      if (camera.style.filter !== targetFilter) camera.style.filter = targetFilter

      const active = Math.round(fi)
      const stage = STAGES[active]
      const isAll = stage.active === 'ALL'
      const activeSet = isAll ? null : new Set(stage.active as string[])

      // Nodes — build state, emphasis, one-shot birth, glow.
      let online = 0
      NODES.forEach((n) => {
        const el = nodeEls.get(n.id)
        if (!el) return
        const built = n.appear <= active
        if (built) online++
        const on = isAll || activeSet!.has(n.id)
        const targetOp = built ? (on ? '1' : '0.18') : '0'
        if (el.style.opacity !== targetOp) el.style.opacity = targetOp
        const targetGlow = built && on && !reduce ? '16px' : '0px'
        el.style.setProperty('--glow', targetGlow)
        const targetOn = built && on ? '1' : '0'
        if (el.dataset.on !== targetOn) el.dataset.on = targetOn
        if (built && !born.has(n.id)) {
          born.add(n.id)
          if (!reduce) {
            el.classList.remove('aj-birth')
            void el.getBBox()
            el.classList.add('aj-birth')
          }
        } else if (!built && born.has(n.id)) {
          born.delete(n.id)
          el.classList.remove('aj-birth')
        }
      })

      // Edges — draw-in, emphasis, packet visibility.
      EDGES.forEach((e) => {
        const key = `${e.from}__${e.to}`
        const cached = edgeEls.get(key)
        if (!cached) return
        const built = e.appear <= active
        const on = isAll || (activeSet!.has(e.from) && activeSet!.has(e.to))
        const targetOp = built ? (on ? '1' : '0.12') : '0'
        if (cached.el.style.opacity !== targetOp) cached.el.style.opacity = targetOp
        const len = edgeLen.get(key) ?? 0
        if (cached.path) {
          const targetOffset = built ? '0' : `${len}`
          if (cached.path.style.strokeDashoffset !== targetOffset) cached.path.style.strokeDashoffset = targetOffset
        }
        if (cached.packet) {
          const targetDisplay = on && e.animated && !reduce ? 'block' : 'none'
          if (cached.packet.style.display !== targetDisplay) cached.packet.style.display = targetDisplay
        }
      })

      // Hero request token — travels the whole path, narrated per hop.
      if (hero) {
        const ht = clamp((p - 0.12) / (0.9 - 0.12), 0, 1)
        const visible = p > 0.12 && p < 0.98
        const targetOp = visible ? '1' : '0'
        if (hero.style.opacity !== targetOp) hero.style.opacity = targetOp
        if (visible) {
          const pos = pointOnPath(REQUEST_PATH, ht)
          hero.setAttribute('transform', `translate(${pos.x.toFixed(1)} ${pos.y.toFixed(1)})`)
          const glowColor = DOMAIN[pos.target.domain]
          hero.style.setProperty('--hero-glow', glowColor)
          if (pos.seg !== lastSeg && heroLabel) {
            lastSeg = pos.seg
            heroLabel.textContent = REQUEST_LABELS[pos.seg] ?? ''
          }
        }
      }

      // Convergence swarm — "10k sockets" streaming in, live/submit beats.
      if (swarm) {
        const targetDisplay = !reduce && (active === 2 || active === 3) ? 'block' : 'none'
        if (swarm.style.display !== targetDisplay) swarm.style.display = targetDisplay
      }

      if (active !== lastStage) {
        lastStage = active
        setStageIdx(active)
      }
      if (online !== lastOnline) {
        lastOnline = online
        setNodesOnline(online)
      }
      if (railFillRef.current) {
        railFillRef.current.style.transform = `scaleX(${p.toFixed(4)})`
      }
    }

    const onScroll = () => {
      if (!isVisible) return
      if (!raf) raf = requestAnimationFrame(render)
    }
    render()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      io.disconnect()
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  const stage = STAGES[stageIdx]

  return (
    <div ref={trackRef} style={{ position: 'relative', height: `${STAGES.length * 92}vh` }}>
      <div
        style={{
          position: 'sticky',
          top: 0,
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div className="aj-panel" ref={svgWrapRef}>
          {scene}

          {/* Legend */}
          <div className="aj-legend" aria-hidden="true">
            {LEGEND.map((l) => (
              <span key={l.domain} className="aj-legend-item">
                <span className="aj-dot" style={{ background: DOMAIN[l.domain], color: DOMAIN[l.domain] }} />
                {l.label}
              </span>
            ))}
          </div>

          {/* HUD — beat counter + nodes online */}
          <div className="aj-hud" aria-hidden="true">
            <div className="aj-counter">
              <span className="aj-counter-cur">{stage.index}</span>
              <span className="aj-counter-tot">/ {String(STAGES.length).padStart(2, '0')}</span>
            </div>
            <div className="aj-online">
              <span className="aj-online-num">{String(nodesOnline).padStart(2, '0')}</span>
              <span className="aj-online-lab">nodes online</span>
            </div>
          </div>

          {/* Caption */}
          <div className="aj-caption" aria-hidden="true">
            <div className="aj-kicker">// ARCHITECTURE JOURNEY</div>
            <h3 className="aj-title" key={stage.key}>
              {stage.title}
            </h3>
            <p className="aj-sub">{stage.subtitle}</p>
            {stage.why && (
              <p className="aj-why" key={stage.key + '-why'}>
                <span className="aj-why-tag">WHY</span>
                {stage.why}
              </p>
            )}
          </div>

          {/* Milestone rail — clickable */}
          <div className="aj-rail">
            <div ref={railFillRef} className="aj-rail-fill" style={{ transform: 'scaleX(0)' }} />
            <div className="aj-rail-ticks">
              {STAGES.map((s, i) => (
                <button
                  key={s.key}
                  type="button"
                  className="aj-tick"
                  data-on={i <= stageIdx ? '1' : '0'}
                  data-cur={i === stageIdx ? '1' : '0'}
                  onClick={() => jumpToBeat(i)}
                  aria-label={`Jump to beat ${i + 1}: ${s.title}`}
                />
              ))}
            </div>
          </div>

          {/* Scroll hint (first beat only) */}
          <div className="aj-hint" data-show={stageIdx === 0 ? '1' : '0'} aria-hidden="true">
            scroll to build ↓
          </div>
        </div>
      </div>
      <JourneyStyles />
    </div>
  )
}

/* ── Static SVG scene (rendered once) ───────────────────────────── */
function Scene() {
  // Precompute the swarm's converging streaks toward the gateway.
  const gw = nodeById.get('gateway')!
  const swarm = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2
    const r = 320 + (i % 3) * 60
    const sx = gw.x + Math.cos(a) * r
    const sy = gw.y + Math.sin(a) * r * 0.62
    return { d: `M ${sx.toFixed(0)} ${sy.toFixed(0)} L ${gw.x} ${gw.y}`, dur: (1.4 + (i % 5) * 0.25).toFixed(2), begin: ((i * 0.13) % 2).toFixed(2) }
  })

  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="xMidYMid meet" className="aj-svg">
      <defs>
        <radialGradient id="aj-bg" cx="50%" cy="42%" r="75%">
          <stop offset="0%" stopColor="#191920" />
          <stop offset="100%" stopColor="#08080a" />
        </radialGradient>
        <pattern id="aj-grid" width="46" height="46" patternUnits="userSpaceOnUse" patternTransform="translate(0 0)">
          <circle cx="1" cy="1" r="1.1" fill="#ffffff" fillOpacity="0.05">
            <animate attributeName="fill-opacity" values="0.03;0.08;0.03" dur="6s" repeatCount="indefinite" />
          </circle>
        </pattern>
      </defs>

      {/* Backdrop (fills far beyond the viewBox so pans never reveal an edge) */}
      <rect x={-VB_W} y={-VB_H} width={VB_W * 3} height={VB_H * 3} fill="url(#aj-bg)" />
      <rect x={-VB_W} y={-VB_H} width={VB_W * 3} height={VB_H * 3} fill="url(#aj-grid)" />

      {/* Ambient drifting motes (screen space — subtle parallax) */}
      <g className="aj-ambient" aria-hidden="true">
        {Array.from({ length: 14 }, (_, i) => {
          const x = (i * 137) % VB_W
          const y = (i * 271) % VB_H
          return (
            <circle key={i} cx={x} cy={y} r={1.6} fill="#ffffff" opacity={0.14}>
              <animate attributeName="cy" values={`${y};${y - 40};${y}`} dur={`${8 + (i % 5)}s`} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.05;0.2;0.05" dur={`${6 + (i % 4)}s`} repeatCount="indefinite" />
            </circle>
          )
        })}
      </g>

      {/* Camera group */}
      <g data-camera="">
        {/* Edges under nodes */}
        <g>
          {EDGES.map((e) => {
            const from = nodeById.get(e.from)!
            const to = nodeById.get(e.to)!
            const d = edgePath(from, to)
            const color = e.color ? DOMAIN[e.color] : '#8a8a92'
            const count = e.alive ? 6 : 3
            const dur = e.alive ? 2.2 : 1.9
            return (
              <g key={`${e.from}__${e.to}`} data-edge={`${e.from}__${e.to}`} style={{ opacity: 0 }}>
                <path className="aj-edge-path" d={d} fill="none" stroke={color} strokeWidth={2.5} strokeOpacity={0.7} strokeLinecap="round" />
                {e.animated && (
                  <g data-packet="" style={{ display: 'none' }}>
                    {Array.from({ length: count }, (_, i) => (
                      <circle key={i} r={e.alive ? 5 : 6} fill={color}>
                        <animateMotion dur={`${dur}s`} begin={`${((i * dur) / count).toFixed(2)}s`} repeatCount="indefinite" path={d} />
                      </circle>
                    ))}
                  </g>
                )}
              </g>
            )
          })}
        </g>

        {/* Convergence swarm — hidden until the live/submit beats */}
        <g data-swarm="" style={{ display: 'none' }}>
          {swarm.map((s, i) => (
            <circle key={i} r={2.6} fill={DOMAIN.realtime} opacity={0.75}>
              <animateMotion dur={`${s.dur}s`} begin={`${s.begin}s`} repeatCount="indefinite" path={s.d} />
              <animate attributeName="opacity" values="0;0.8;0" dur={`${s.dur}s`} begin={`${s.begin}s`} repeatCount="indefinite" />
            </circle>
          ))}
        </g>

        {/* Nodes over edges */}
        <g>
          {NODES.map((n) => (
            <NodeShape key={n.id} n={n} />
          ))}
        </g>

        {/* Hero request token — on top of everything */}
        <g data-hero="" style={{ opacity: 0 }}>
          <circle className="aj-hero-ring" r={20} fill="none" stroke="var(--hero-glow, #fff)" strokeWidth={2} />
          <circle className="aj-hero-core" r={9} fill="#ffffff" />
          <circle r={4} fill="var(--hero-glow, #fff)" />
          <text data-hero-label="" className="aj-hero-label" x={0} y={-30} textAnchor="middle" fill="#ffffff" />
        </g>
      </g>
    </svg>
  )
}

function NodeShape({ n }: { n: NodeDef }) {
  const color = DOMAIN[n.domain]
  const x = n.x - n.w / 2
  const y = n.y - n.h / 2
  return (
    <g data-node={n.id} className="aj-node" style={{ opacity: 0, ['--gc' as string]: color }}>
      <rect x={x} y={y} width={n.w} height={n.h} rx={16} fill="#141417" stroke={color} strokeWidth={2.5} />
      <rect x={x} y={y + 14} width={4} height={n.h - 28} rx={2} fill={color} />
      <text x={n.x} y={n.sub ? n.y - 4 : n.y + 8} textAnchor="middle" className="aj-node-label" fill="#ffffff">
        {n.label}
      </text>
      {n.sub && (
        <text x={n.x} y={n.y + 26} textAnchor="middle" className="aj-node-sub" fill="#9a9aa2">
          {n.sub}
        </text>
      )}
    </g>
  )
}

/* ── Scoped styles ──────────────────────────────────────────────── */
function JourneyStyles() {
  return (
    <style>{`
      .aj-panel {
        position: relative; width: 100%; height: min(86vh, 760px);
        border-radius: 32px; overflow: hidden; background: #08080a;
        box-shadow: 0 40px 120px -40px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.06);
      }
      .aj-svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }

      .aj-node {
        transition: opacity .5s ease;
        transform-box: fill-box; transform-origin: center;
        filter: drop-shadow(0 0 var(--glow, 0px) var(--gc));
      }
      .aj-node:hover { --glow: 24px !important; cursor: default; }
      .aj-node.aj-birth { animation: aj-birth .58s cubic-bezier(.2,.85,.25,1) both; }
      @keyframes aj-birth {
        0% { transform: scale(.5); }
        62% { transform: scale(1.08); }
        100% { transform: scale(1); }
      }
      .aj-node-label { font-family: var(--font-suisseintlcond), sans-serif; font-weight: 700; font-size: 26px; letter-spacing: -0.5px; }
      .aj-node-sub { font-family: var(--font-suisseintlmono), monospace; font-weight: 400; font-size: 15px; letter-spacing: -0.3px; }

      [data-edge] { transition: opacity .5s ease; }
      .aj-edge-path { transition: stroke-dashoffset .7s cubic-bezier(.4,0,.2,1); }

      .aj-hero-core { filter: drop-shadow(0 0 10px #fff); }
      .aj-hero-ring { opacity: .55; animation: aj-pulse 1.6s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
      @keyframes aj-pulse { 0%,100% { transform: scale(.7); opacity: .6; } 50% { transform: scale(1.15); opacity: .15; } }
      [data-hero] { transition: opacity .4s ease; filter: drop-shadow(0 0 14px var(--hero-glow, #fff)); }
      .aj-hero-label {
        font-family: var(--font-suisseintlmono), monospace; font-size: 17px; letter-spacing: -0.3px;
        paint-order: stroke; stroke: #08080a; stroke-width: 5px; stroke-linejoin: round;
      }

      .aj-ambient { pointer-events: none; }

      .aj-legend { position: absolute; top: 20px; left: 24px; display: flex; flex-wrap: wrap; gap: 8px 16px; max-width: 58%; pointer-events: none; }
      .aj-legend-item { display: inline-flex; align-items: center; gap: 7px; font-family: var(--font-suisseintlmono), monospace; font-size: 11px; letter-spacing: -0.2px; color: rgba(255,255,255,0.55); text-transform: uppercase; }
      .aj-dot { width: 9px; height: 9px; border-radius: 50%; box-shadow: 0 0 8px currentColor; }

      .aj-hud { position: absolute; top: 18px; right: 26px; display: flex; align-items: flex-start; gap: 22px; pointer-events: none; }
      .aj-counter { font-family: var(--font-suisseintlcond), sans-serif; font-weight: 700; display: flex; align-items: baseline; gap: 6px; color: #fff; }
      .aj-counter-cur { font-size: 34px; letter-spacing: -1px; line-height: 1; }
      .aj-counter-tot { font-size: 14px; color: rgba(255,255,255,0.4); }
      .aj-online { text-align: right; }
      .aj-online-num { font-family: var(--font-suisseintlcond), sans-serif; font-weight: 700; font-size: 34px; letter-spacing: -1px; line-height: 1; color: var(--color-electric-yellow, #fff100); display: block; }
      .aj-online-lab { font-family: var(--font-suisseintlmono), monospace; font-size: 10px; letter-spacing: 0.2px; text-transform: uppercase; color: rgba(255,255,255,0.4); }

      .aj-caption { position: absolute; left: 26px; bottom: 62px; max-width: min(560px, 80%); pointer-events: none; }
      .aj-kicker { font-family: var(--font-suisseintlmono), monospace; font-size: 12px; letter-spacing: 0.4px; color: rgba(255,255,255,0.45); margin-bottom: 12px; }
      .aj-title { font-family: var(--font-suisseintlcond), sans-serif; font-weight: 700; font-size: clamp(28px, 4vw, 46px); line-height: 0.98; letter-spacing: -1.4px; color: #fff; margin: 0 0 12px; text-wrap: balance; animation: aj-rise .5s cubic-bezier(0.2,0.7,0.2,1) both; }
      .aj-sub { font-family: var(--font-suisseintl), sans-serif; font-weight: 400; font-size: clamp(14px, 1.4vw, 17px); line-height: 1.45; letter-spacing: -0.2px; color: rgba(255,255,255,0.64); margin: 0; text-wrap: pretty; }
      .aj-why { display: flex; gap: 10px; align-items: baseline; margin: 14px 0 0; font-family: var(--font-suisseintl), sans-serif; font-size: clamp(13px, 1.25vw, 15px); line-height: 1.4; color: rgba(255,255,255,0.55); border-left: 2px solid var(--color-electric-yellow, #fff100); padding-left: 12px; animation: aj-rise .5s .1s cubic-bezier(0.2,0.7,0.2,1) both; }
      .aj-why-tag { font-family: var(--font-suisseintlmono), monospace; font-size: 10px; letter-spacing: 0.5px; color: var(--color-electric-yellow, #fff100); flex-shrink: 0; }
      @keyframes aj-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }

      .aj-rail { position: absolute; left: 26px; right: 26px; bottom: 28px; }
      .aj-rail-fill { height: 2px; background: linear-gradient(90deg, #fff100, #22d3f5); transform-origin: left center; transform: scaleX(0); border-radius: 2px; }
      .aj-rail-ticks { position: absolute; inset: -7px 0; display: flex; justify-content: space-between; align-items: center; }
      .aj-tick { width: 14px; height: 14px; padding: 0; border: 0; border-radius: 50%; background: rgba(255,255,255,0.16); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.25); cursor: pointer; transition: background .3s ease, box-shadow .3s ease, transform .3s ease; }
      .aj-tick:hover { transform: scale(1.25); }
      .aj-tick[data-on='1'] { background: #fff; box-shadow: 0 0 8px rgba(255,255,255,0.6); }
      .aj-tick[data-cur='1'] { background: var(--color-electric-yellow, #fff100); box-shadow: 0 0 12px rgba(255,241,0,0.8); transform: scale(1.3); }

      .aj-hint { position: absolute; right: 26px; bottom: 58px; font-family: var(--font-suisseintlmono), monospace; font-size: 12px; color: rgba(255,255,255,0.5); transition: opacity .4s ease; animation: aj-bob 1.8s ease-in-out infinite; pointer-events: none; }
      .aj-hint[data-show='0'] { opacity: 0; }
      @keyframes aj-bob { 50% { transform: translateY(4px); } }

      @media (prefers-reduced-motion: reduce) {
        .aj-title, .aj-why, .aj-hint, .aj-hero-ring, .aj-node.aj-birth { animation: none; }
      }
    `}</style>
  )
}
