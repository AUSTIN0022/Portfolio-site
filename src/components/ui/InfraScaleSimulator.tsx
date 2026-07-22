'use client'

/**
 * InfraScaleSimulator — the production-engineering chapter. A live model of the
 * QuizBuzz AWS footprint that can be watched OR driven.
 *
 *   STORY MODE   — pinned, scroll-driven: idle → traffic → spike → autoscale →
 *                  steady. Recruiters just watch it happen.
 *   PLAYGROUND   — "Take control": scroll-drive stops and the viewer runs it —
 *                  set concurrent participants, simulate a spike, KILL an
 *                  instance (ALB reroutes, the ASG launches a replacement) or
 *                  DISCONNECT Redis (cache collapses, then fails over to the
 *                  replica). A tiny AWS simulator.
 *
 * One instance state-machine + a `simulate()` deriver feed everything, driven
 * either by scroll or the control panel. All per-frame work is imperative in a
 * rAF loop; React state only flips the story/playground UI + captions.
 */

import { useEffect, useMemo, useRef, useState } from 'react'

/* ── Canvas ─────────────────────────────────────────────────────── */
const VB_W = 1220
const VB_H = 780
const MAX_INSTANCES = 8
const LIFECYCLE_MS = 460 // per boot stage
const LIFE_STAGES = ['pending', 'initializing', 'health check', 'healthy']
const REDIS_FAILOVER_MS = 5200
const DEAD_FADE_MS = 2200
const SCALE_THRESHOLD = 80 // CPU % that trips the scaling policy

const C = {
  infra: '#7a00fb',
  realtime: '#22d3f5',
  worker: '#44f87a',
  payment: '#ff6924',
  danger: '#ff3b3b',
  core: '#fff100',
}

const SLOTS = Array.from({ length: MAX_INSTANCES }, (_, i) => {
  const col = i % 4
  const row = Math.floor(i / 4)
  return { x: 150 + col * 150, y: 350 + row * 130 }
})
const ROUTE53 = { x: 375, y: 90 }
const ALB = { x: 375, y: 220 }
const REDIS = { x: 250, y: 660 }
const RDS = { x: 560, y: 660 }
const POOL_REDIS = { x: 250, y: 560 }
const POOL_RDS = { x: 560, y: 560 }


/* ── Beats (story mode) ─────────────────────────────────────────── */
type Beat = {
  key: string
  index: string
  title: string
  subtitle: string
  why?: string
  mode: 'idle' | 'live'
  participants: number
  target: number
}

const BEATS: Beat[] = [
  { key: 'idle', index: '01', title: 'Idle mode', subtitle: 'Between contests, one small instance runs everything. Near-zero cost.', why: 'A single t3.medium hosts backend, worker and a local Docker Redis — about $35/month.', mode: 'idle', participants: 0, target: 1 },
  { key: 'open', index: '02', title: 'Registration opens', subtitle: 'The first few hundred participants arrive. The load balancer comes online.', mode: 'live', participants: 800, target: 2 },
  { key: 'ramp', index: '03', title: '2,500 participants', subtitle: 'Numbers climb toward the live contest. Utilisation rises but holds.', mode: 'live', participants: 2500, target: 4 },
  { key: 'spike', index: '04', title: 'The contest goes live', subtitle: '7,000 connect at once. CPU pins past its threshold, latency balloons — under stress.', why: 'WebSocket load is memory- and IO-bound, so the crunch shows up as heap + latency, not only CPU.', mode: 'live', participants: 7000, target: 4 },
  { key: 'scale', index: '05', title: 'Auto Scaling responds', subtitle: 'CPU crosses 80%, the policy trips, and fresh t3.medium instances boot. The ALB spreads the load.', why: 'Peak demand is known in advance from registrations, so capacity is pre-warmed — not reactively chased.', mode: 'live', participants: 7000, target: 8 },
  { key: 'steady', index: '06', title: 'Steady at scale', subtitle: 'Eight instances, load balanced near 55%, latency flat — 7,500 live participants.', mode: 'live', participants: 7500, target: 8 },
  { key: 'control', index: '07', title: 'Now you drive it', subtitle: 'Take control: set the participant count, simulate a spike, kill an instance, or drop Redis — and watch it survive.', mode: 'live', participants: 5000, target: 5 },
]

/* ── Helpers ────────────────────────────────────────────────────── */
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
const fmt = (n: number) => Math.round(n).toLocaleString('en-US')
const pad = (n: number) => String(n).padStart(2, '0')

type Sim = {
  rps: number
  participants: number
  cpu: number
  mem: number
  latency: number
  cacheHit: number
  costLabel: string
  stressed: boolean
}

function simulate(participants: number, mode: 'idle' | 'live', healthy: number, redisDown: boolean): Sim {
  const h = Math.max(healthy, 1)
  if (mode === 'idle') {
    return { rps: 20, participants: 0, cpu: 12, mem: 24, latency: 18, cacheHit: 99, costLabel: '$35 / month', stressed: false }
  }
  const load = clamp(participants / 10000, 0, 1)
  const rps = Math.round(lerp(120, 5400, Math.pow(load, 1.15)))
  const cpu = clamp(Math.round((rps / h / 1150) * 100), 6, 99)
  const mem = clamp(Math.round((participants / h / 1400) * 100), 12, 97)
  let latency = 23 + Math.max(0, cpu - 68) * 7
  if (redisDown) latency = latency * 2.4 + 60
  if (healthy === 0) latency = 900
  const cacheHit = redisDown ? Math.max(2, 8 - 0) : clamp(Math.round(97 - load * 4), 92, 99)
  const dayCost = 14 + (healthy - 1) * 2.4
  return {
    rps,
    participants,
    cpu,
    mem,
    latency: Math.round(latency),
    cacheHit,
    costLabel: `+ $${dayCost.toFixed(0)} / contest-day`,
    stressed: cpu >= 88 || redisDown || healthy === 0,
  }
}

type Inst = { state: 'pending' | 'healthy' | 'dead'; since: number; stage: number }

export function InfraScaleSimulator() {
  const trackRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [beatIdx, setBeatIdx] = useState(0)
  const [playground, setPlayground] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [pgP, setPgP] = useState(5000)
  const [simMode, setSimMode] = useState<'idle' | 'live'>('live')

  // Mobile layout state
  const [isMobile, setIsMobile] = useState(false)
  const [islandExpanded, setIslandExpanded] = useState(false)
  const [sheetLevel, setSheetLevel] = useState(1)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          document.body.classList.add('in-simulator-mode')
        } else {
          document.body.classList.remove('in-simulator-mode')
        }
      },
      { threshold: 0.1 }
    )
    if (trackRef.current) {
      observer.observe(trackRef.current)
    }
    return () => {
      observer.disconnect()
      document.body.classList.remove('in-simulator-mode')
    }
  }, [])

  const scene = useMemo(() => <SimScene isMobile={isMobile} />, [isMobile])

  const ctrl = useRef({
    playground: false,
    participants: 5000,
    lastParticipants: 0,
    mode: 'live' as 'idle' | 'live',
    redisDownUntil: 0,
    cmd: null as string | null,
    noticeMsg: null as string | null,
    noticeUntil: 0,
  })

  const flash = (msg: string, ms = 3200) => {
    ctrl.current.noticeMsg = msg
    ctrl.current.noticeUntil = performance.now() + ms
  }

  const jumpToBeat = (i: number) => {
    const track = trackRef.current
    if (!track) return
    const top = window.scrollY + track.getBoundingClientRect().top
    const dist = track.offsetHeight - window.innerHeight
    window.scrollTo({ top: top + (i / (BEATS.length - 1)) * dist, behavior: 'smooth' })
  }

  useEffect(() => engine(trackRef, wrapRef, ctrl, setBeatIdx, setNotice), [])

  // Playground control handlers
  const onParticipants = (v: number) => { 
    setPgP(v)
    ctrl.current.participants = v
    if (ctrl.current.mode === 'idle') {
      ctrl.current.mode = 'live'
      setSimMode('live')
    }
  }
  const onIdle = () => { 
    ctrl.current.mode = 'idle'
    setSimMode('idle')
  }
  const onLive = () => { 
    ctrl.current.mode = 'live'
    setSimMode('live')
  }
  const onSpike = () => { 
    ctrl.current.mode = 'live'
    setSimMode('live')
    setPgP(10000)
    ctrl.current.participants = 10000
    flash('⚡ Traffic spike — 10,000 participants surged in')
  }
  const onKill = () => { ctrl.current.cmd = 'kill'; flash('✕ Instance terminated — ALB rerouting, ASG launching a replacement…') }
  const onRedis = () => { ctrl.current.redisDownUntil = performance.now() + REDIS_FAILOVER_MS; flash('⚠ Redis primary lost — cache misses hitting RDS, failing over to replica…', REDIS_FAILOVER_MS) }

  const beat = BEATS[beatIdx]
  const capTitle = playground ? 'You have the controls' : beat.title
  const capSub = playground
    ? 'Set the participant count, simulate a spike, kill an instance, or drop Redis. The ASG, load balancer and gauges all respond live.'
    : beat.subtitle
  const capWhy = playground ? undefined : beat.why

  const enterPlayground = () => {
    const p = Math.round(ctrl.current.lastParticipants || 5000)
    ctrl.current.participants = p
    ctrl.current.mode = 'live'
    setPgP(p)
    ctrl.current.playground = true
    setPlayground(true)
  }
  const resumeStory = () => {
    ctrl.current.playground = false
    ctrl.current.redisDownUntil = 0
    ctrl.current.cmd = null
    setPlayground(false)
    setNotice(null)
  }

  const handleSpike = () => {
    if (!playground) enterPlayground()
    onSpike()
  }
  const handleKill = () => {
    if (!playground) enterPlayground()
    onKill()
  }
  const handleRedis = () => {
    if (!playground) enterPlayground()
    onRedis()
  }
  const handleToggleMode = () => {
    if (!playground) {
      enterPlayground()
      onLive()
    } else {
      if (ctrl.current.mode === 'idle') {
        onLive()
      } else {
        onIdle()
      }
    }
  }

  return (
    <div ref={trackRef} style={{ position: 'relative', height: `${BEATS.length * 92}vh` }}>
      <div style={{ position: 'sticky', top: 0, height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="is-panel" ref={wrapRef} data-stress="0" data-mode-ui={playground ? 'play' : 'story'} data-island-open={islandExpanded ? '1' : '0'}>
          {scene}

          {/* Failure notice banner */}
          <div className="is-notice" data-show={notice ? '1' : '0'}>{notice}</div>

          {!isMobile ? (
            <>
              {/* Right rail — mission control */}
              <div className="is-rail-right">
                <div className="is-mission">
                  <div className="is-mission-top">
                    <span className="is-chip" data-readout="mode" data-mode="idle">🌙 IDLE</span>
                    <span className="is-clock" data-readout="clock">--:--:--</span>
                  </div>
                  <div className="is-mission-big">
                    <span className="is-mission-num" data-readout="participants">0</span>
                    <span className="is-mission-lab">concurrent participants</span>
                  </div>
                  <div className="is-mission-grid">
                    <div><span className="is-mg-lab">Contest</span><span className="is-mg-val" data-readout="status">Idle</span></div>
                    <div><span className="is-mg-lab">Autoscaling</span><span className="is-mg-val" data-readout="asg">Enabled</span></div>
                    <div><span className="is-mg-lab">Instances</span><span className="is-mg-val" data-readout="instances">1×</span></div>
                    <div><span className="is-mg-lab">Elapsed</span><span className="is-mg-val" data-readout="elapsed">00:00</span></div>
                  </div>
                </div>

                <div className="is-gauges">
                  <Gauge name="cpu" label="CPU" />
                  <Gauge name="mem" label="Memory" />
                  <Gauge name="rps" label="Requests / sec" />
                  <Gauge name="lat" label="P95 latency" />
                  <Gauge name="cache" label="Redis hit rate" />
                  <Gauge name="cost" label="Cost" isText />
                </div>

                <div className="is-threshold" data-tripped="0">
                  <span data-readout="thresholdtext">CPU 12% · threshold 80%</span>
                </div>

                {/* Story vs Playground controls */}
                {!playground ? (
                  <div className="is-controls">
                    <div className="is-ctrl-head"><span>STORY MODE</span><span className="is-live-dot">SCROLL-DRIVEN</span></div>
                    <p className="is-ctrl-note">Scroll to watch it scale — or step in and run the system yourself.</p>
                    <button type="button" className="is-btn-primary" onClick={enterPlayground}>⚙ Take control</button>
                  </div>
                ) : (
                  <div className="is-controls" data-live="1">
                    <div className="is-ctrl-head"><span>PLAYGROUND</span><span className="is-live-dot" data-on="1">LIVE</span></div>
                    <div className="is-toggle">
                      <button type="button" onClick={onIdle}>Idle</button>
                      <button type="button" onClick={onLive}>Live Contest</button>
                    </div>
                    <label className="is-slider-label">
                      Participants — {fmt(pgP)}
                      <input type="range" min={0} max={10000} step={100} value={pgP} onChange={(e) => onParticipants(Number(e.target.value))} />
                    </label>
                    <div className="is-ops">
                      <button type="button" onClick={onSpike} className="is-op is-op-spike">⚡ Spike</button>
                      <button type="button" onClick={onKill} className="is-op is-op-kill">✕ Kill instance</button>
                      <button type="button" onClick={onRedis} className="is-op is-op-redis">⚠ Drop Redis</button>
                    </div>
                    <button type="button" className="is-btn-ghost" onClick={resumeStory}>← Back to story</button>
                  </div>
                )}
              </div>

              {/* HUD — beat counter */}
              <div className="is-hud">
                <div className="is-counter">
                  <span className="is-counter-cur">{playground ? '⚙' : beat.index}</span>
                  {!playground && <span className="is-counter-tot">/ {String(BEATS.length).padStart(2, '0')}</span>}
                </div>
              </div>

              {/* Caption */}
              <div className="is-caption">
                <div className="is-kicker">{playground ? '// LIVE — PLAYGROUND' : '// PRODUCTION ENGINEERING'}</div>
                <h3 className="is-title" key={capTitle}>{capTitle}</h3>
                <p className="is-sub">{capSub}</p>
                {capWhy && (
                  <p className="is-why" key={capTitle + '-why'}>
                    <span className="is-why-tag">WHY</span>
                    {capWhy}
                  </p>
                )}
              </div>

              {/* Milestone rail (story only) */}
              {!playground && (
                <div className="is-rail">
                  <div className="is-rail-fill" style={{ transform: `scaleX(${(beatIdx / (BEATS.length - 1)).toFixed(4)})` }} />
                  <div className="is-rail-ticks">
                    {BEATS.map((b, i) => (
                      <button key={b.key} type="button" className="is-tick" data-on={i <= beatIdx ? '1' : '0'} data-cur={i === beatIdx ? '1' : '0'} onClick={() => jumpToBeat(i)} aria-label={`Jump to beat ${i + 1}: ${b.title}`} />
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Mobile Simulator Dynamic Island (Floating metrics status) */}
              <div
                className="sim-island"
                data-expanded={islandExpanded ? 'true' : 'false'}
                onClick={() => setIslandExpanded((e) => !e)}
              >
                {/* Collapsed view */}
                <div className="sim-island-collapsed">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span data-readout="island-status-dot" style={{ fontSize: '11px' }}>🟢</span>
                    <span data-readout="island-status-text" style={{ fontFamily: 'var(--font-suisseintlcond)', fontWeight: 700, fontSize: '12px', letterSpacing: '-0.2px' }}>
                      Stable · 1 EC2
                    </span>
                  </div>
                  <span data-readout="island-mini-info" style={{ fontFamily: 'var(--font-suisseintlmono)', fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontVariantNumeric: 'tabular-nums' }}>
                    1 EC2 · 0 Users
                  </span>
                </div>

                {/* Expanded view */}
                <div className="sim-island-expanded">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span data-readout="island-status-dot" style={{ fontSize: '13px' }}>🟢</span>
                      <span style={{ fontFamily: 'var(--font-suisseintlcond)', fontWeight: 700, fontSize: '14px', letterSpacing: '-0.2px' }}>System Heartbeat</span>
                    </div>
                    <span style={{ fontSize: '10px', opacity: 0.4, fontFamily: 'var(--font-suisseintlmono)' }}>Tap to collapse</span>
                  </div>

                  {/* Two iOS Control Center-style cards side by side */}
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                    
                    {/* CARD 1 (LEFT): Circular Metrics Grid */}
                    <div style={{
                      flex: 1,
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: '20px',
                      padding: '12px 6px',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center'
                    }}>
                      <span style={{ fontFamily: 'var(--font-suisseintlmono)', fontSize: '8px', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.2px', marginBottom: '10px', fontWeight: 600 }}>SYSTEM METRICS</span>
                      
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: '1fr 1fr', 
                        gap: '10px 14px', 
                        justifyItems: 'center', 
                        alignItems: 'center'
                      }}>
                        {/* CPU */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                          <svg width="42" height="42" viewBox="0 0 66 66">
                            <circle cx="33" cy="33" r="28" stroke="rgba(255,255,255,0.06)" strokeWidth="5.5" fill="none" />
                            <circle data-ring-fill="cpu" cx="33" cy="33" r="28" stroke={C.worker} strokeWidth="5.5" fill="none" strokeDasharray="175.93" strokeDashoffset="175.93" strokeLinecap="round" transform="rotate(-90 33 33)" style={{ transition: 'stroke-dashoffset 0.35s ease' }} />
                            <text data-ring-text="cpu" x="33" y="38" textAnchor="middle" fill="#fff" fontSize="13px" fontWeight="700" fontFamily="var(--font-suisseintlcond)">0%</text>
                          </svg>
                          <span style={{ fontFamily: 'var(--font-suisseintlmono)', fontSize: '8px', color: 'rgba(255,255,255,0.4)' }}>CPU</span>
                        </div>

                        {/* Memory */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                          <svg width="42" height="42" viewBox="0 0 66 66">
                            <circle cx="33" cy="33" r="28" stroke="rgba(255,255,255,0.06)" strokeWidth="5.5" fill="none" />
                            <circle data-ring-fill="mem" cx="33" cy="33" r="28" stroke={C.infra} strokeWidth="5.5" fill="none" strokeDasharray="175.93" strokeDashoffset="175.93" strokeLinecap="round" transform="rotate(-90 33 33)" style={{ transition: 'stroke-dashoffset 0.35s ease' }} />
                            <text data-ring-text="mem" x="33" y="38" textAnchor="middle" fill="#fff" fontSize="13px" fontWeight="700" fontFamily="var(--font-suisseintlcond)">0%</text>
                          </svg>
                          <span style={{ fontFamily: 'var(--font-suisseintlmono)', fontSize: '8px', color: 'rgba(255,255,255,0.4)' }}>Memory</span>
                        </div>

                        {/* Latency */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                          <svg width="42" height="42" viewBox="0 0 66 66">
                            <circle cx="33" cy="33" r="28" stroke="rgba(255,255,255,0.06)" strokeWidth="5.5" fill="none" />
                            <circle data-ring-fill="lat" cx="33" cy="33" r="28" stroke={C.realtime} strokeWidth="5.5" fill="none" strokeDasharray="175.93" strokeDashoffset="175.93" strokeLinecap="round" transform="rotate(-90 33 33)" style={{ transition: 'stroke-dashoffset 0.35s ease' }} />
                            <text data-ring-text="lat" x="33" y="38" textAnchor="middle" fill="#fff" fontSize="13px" fontWeight="700" fontFamily="var(--font-suisseintlcond)">0ms</text>
                          </svg>
                          <span style={{ fontFamily: 'var(--font-suisseintlmono)', fontSize: '8px', color: 'rgba(255,255,255,0.4)' }}>Latency</span>
                        </div>

                        {/* RPS */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                          <svg width="42" height="42" viewBox="0 0 66 66">
                            <circle cx="33" cy="33" r="28" stroke="rgba(255,255,255,0.06)" strokeWidth="5.5" fill="none" />
                            <circle data-ring-fill="rps" cx="33" cy="33" r="28" stroke={C.core} strokeWidth="5.5" fill="none" strokeDasharray="175.93" strokeDashoffset="175.93" strokeLinecap="round" transform="rotate(-90 33 33)" style={{ transition: 'stroke-dashoffset 0.35s ease' }} />
                            <text data-ring-text="rps" x="33" y="38" textAnchor="middle" fill="#fff" fontSize="13px" fontWeight="700" fontFamily="var(--font-suisseintlcond)">0</text>
                          </svg>
                          <span style={{ fontFamily: 'var(--font-suisseintlmono)', fontSize: '8px', color: 'rgba(255,255,255,0.4)' }}>RPS</span>
                        </div>
                      </div>
                    </div>

                    {/* CARD 2 (RIGHT): Live Status & Concurrent Users */}
                    <div style={{
                      flex: 1,
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: '20px',
                      padding: '12px 10px',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', alignItems: 'center', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px' }}>
                        <span data-readout="participants" style={{ fontFamily: 'var(--font-suisseintlcond)', fontSize: '20px', fontWeight: 800, color: '#fff', lineHeight: 1.1 }}>0</span>
                        <span style={{ fontFamily: 'var(--font-suisseintlmono)', fontSize: '7px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1px' }}>CONCURRENT PARTICIPANTS</span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, justifyContent: 'center', paddingTop: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontFamily: 'var(--font-suisseintlmono)', fontSize: '7.5px', color: 'rgba(255,255,255,0.4)' }}>CONTEST</span>
                          <span data-readout="status" style={{ fontFamily: 'var(--font-suisseintlcond)', fontSize: '9px', fontWeight: 700, color: 'var(--color-electric-yellow)' }}>Idle</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontFamily: 'var(--font-suisseintlmono)', fontSize: '7.5px', color: 'rgba(255,255,255,0.4)' }}>AUTOSCALING</span>
                          <span data-readout="asg" style={{ fontFamily: 'var(--font-suisseintlcond)', fontSize: '9px', fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>Enabled</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontFamily: 'var(--font-suisseintlmono)', fontSize: '7.5px', color: 'rgba(255,255,255,0.4)' }}>INSTANCES</span>
                          <span data-readout="instances" style={{ fontFamily: 'var(--font-suisseintlcond)', fontSize: '9px', fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>1×</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontFamily: 'var(--font-suisseintlmono)', fontSize: '7.5px', color: 'rgba(255,255,255,0.4)' }}>ELAPSED</span>
                          <span data-readout="elapsed" style={{ fontFamily: 'var(--font-suisseintlcond)', fontSize: '9px', fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>00:00</span>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              </div>

              {/* Mobile story mode caption (displayed normally on the screen, just like in desktop mode) */}
              {!playground && (
                <div className="is-caption">
                  <div className="is-kicker">// PRODUCTION ENGINEERING</div>
                  <h3 className="is-title" key={capTitle}>{capTitle}</h3>
                  <p className="is-sub">{capSub}</p>
                  {capWhy && (
                    <p className="is-why" key={capTitle + '-why'}>
                      <span className="is-why-tag">WHY</span>
                      {capWhy}
                    </p>
                  )}
                </div>
              )}

              {/* Mobile Floating Pill Controls near thumb area */}
              <div 
                className="sim-mobile-pill" 
                style={{
                  position: 'absolute',
                  bottom: '20px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 'calc(100% - 32px)',
                  maxWidth: '340px',
                  background: 'rgba(10, 10, 13, 0.95)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: playground ? '28px' : '999px',
                  padding: playground ? '14px 16px' : '10px 14px',
                  boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)',
                  zIndex: 35,
                  color: '#fff',
                  transition: 'all 0.4s cubic-bezier(0.19, 1, 0.22, 1)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                {/* Slider Row (only visible in Playground Mode) */}
                {playground && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontFamily: 'var(--font-suisseintlmono)', fontSize: '8px', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.2px' }}>PARTICIPANTS</span>
                      <span style={{ fontFamily: 'var(--font-suisseintlcond)', fontSize: '11px', fontWeight: 700, color: '#fff' }}>{fmt(pgP)}</span>
                    </div>
                    <input 
                      type="range" 
                      min={0} 
                      max={10000} 
                      step={100} 
                      value={pgP} 
                      onChange={(e) => onParticipants(Number(e.target.value))}
                      style={{
                        width: '100%',
                        height: '4px',
                        borderRadius: '2px',
                        background: 'rgba(255,255,255,0.1)',
                        outline: 'none',
                        accentColor: 'var(--color-electric-yellow)',
                        cursor: 'pointer'
                      }}
                    />
                  </div>
                )}

                {/* Buttons Row (5 circular buttons) */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  {/* 1. Story / Playground Toggle */}
                  <button 
                    type="button" 
                    onClick={playground ? resumeStory : enterPlayground}
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      border: 'none',
                      background: playground ? 'var(--color-electric-yellow)' : 'rgba(255,255,255,0.08)',
                      color: playground ? '#000' : '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: playground ? '0 0 10px rgba(255,241,0,0.3)' : 'none'
                    }}
                    aria-label={playground ? "Back to Story Mode" : "Take Control (Playground)"}
                    title={playground ? "Story Mode" : "Playground Mode"}
                  >
                    {playground ? (
                      // Book icon (Back to story)
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                        <path d="M6 2v20H20V2H6Z" />
                      </svg>
                    ) : (
                      // Tools / slider icon (Take Control)
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="4" y1="21" x2="4" y2="14" />
                        <line x1="4" y1="10" x2="4" y2="3" />
                        <line x1="12" y1="21" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12" y2="3" />
                        <line x1="20" y1="21" x2="20" y2="16" />
                        <line x1="20" y1="12" x2="20" y2="3" />
                        <line x1="2" y1="14" x2="6" y2="14" />
                        <line x1="10" y1="8" x2="14" y2="8" />
                        <line x1="18" y1="16" x2="22" y2="16" />
                      </svg>
                    )}
                  </button>

                  {/* 2. Idle / Live Toggle */}
                  <button 
                    type="button" 
                    onClick={handleToggleMode}
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      border: 'none',
                      background: !playground ? 'rgba(255,255,255,0.04)' : simMode === 'live' ? 'var(--color-electric-yellow)' : 'rgba(255,255,255,0.08)',
                      color: !playground ? 'rgba(255,255,255,0.3)' : simMode === 'live' ? '#000' : '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: playground && simMode === 'live' ? '0 0 10px rgba(255,241,0,0.3)' : 'none'
                    }}
                    title="Toggle Idle/Live"
                  >
                    {simMode === 'idle' ? (
                      // Moon icon
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                      </svg>
                    ) : (
                      // Lightning bolt
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                      </svg>
                    )}
                  </button>

                  {/* 3. Spike Action */}
                  <button 
                    type="button" 
                    onClick={handleSpike}
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      background: !playground ? 'rgba(255,255,255,0.04)' : 'rgba(255,102,0,0.15)',
                      color: !playground ? 'rgba(255,255,255,0.3)' : '#ff6600',
                      border: playground ? '1px solid rgba(255,102,0,0.3)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    title="Simulate Spike"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                      <polyline points="16 7 22 7 22 13" />
                    </svg>
                  </button>

                  {/* 4. Kill EC2 Action */}
                  <button 
                    type="button" 
                    onClick={handleKill}
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      background: !playground ? 'rgba(255,255,255,0.04)' : 'rgba(255,59,59,0.15)',
                      color: !playground ? 'rgba(255,255,255,0.3)' : '#ff3b3b',
                      border: playground ? '1px solid rgba(255,59,59,0.3)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    title="Kill EC2 Instance"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>

                  {/* 5. Drop Redis Action */}
                  <button 
                    type="button" 
                    onClick={handleRedis}
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      background: !playground ? 'rgba(255,255,255,0.04)' : 'rgba(122,0,251,0.15)',
                      color: !playground ? 'rgba(255,255,255,0.3)' : '#b98cff',
                      border: playground ? '1px solid rgba(122,0,251,0.3)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    title="Drop Redis Cache"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <ellipse cx="12" cy="5" rx="9" ry="3" />
                      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                      <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
                    </svg>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      <SimStyles />
    </div>
  )
}

/* ── The imperative engine (rAF loop + control wiring) ──────────── */
function engine(
  trackRef: React.RefObject<HTMLDivElement | null>,
  wrapRef: React.RefObject<HTMLDivElement | null>,
  ctrl: React.RefObject<{ playground: boolean; participants: number; lastParticipants: number; mode: 'idle' | 'live'; redisDownUntil: number; cmd: string | null; noticeMsg: string | null; noticeUntil: number }>,
  setBeatIdx: (n: number) => void,
  setNotice: (s: string | null) => void,
) {
  const track = trackRef.current
  const wrap = wrapRef.current
  if (!track || !wrap) return () => {}
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // ── Cache DOM References once on mount ──
  const slotEls = Array.from(wrap.querySelectorAll<SVGGElement>('[data-slot]'))
  const albEl = wrap.querySelector<SVGGElement>('[data-node="alb"]')
  const redisEl = wrap.querySelector<SVGGElement>('[data-node="redis"]')

  // Slot element sub-references
  const slotCaches = slotEls.map((el, i) => ({
    el,
    albWire: wrap.querySelector(`[data-alb-wire="${i}"]`),
    albPacket: wrap.querySelector(`[data-alb-packet="${i}"]`),
    redPacket: wrap.querySelector(`[data-packet="red-slot-${i}"]`),
    rdsPacket: wrap.querySelector(`[data-packet="rds-slot-${i}"]`),
    redWire: wrap.querySelector(`[data-wire="red-wire-${i}"]`),
    rdsWire: wrap.querySelector(`[data-wire="rds-wire-${i}"]`),
    lifeLab: el.querySelector('[data-life]'),
    cpuBar: el.querySelector<SVGRectElement>('[data-bar="cpu"]'),
    memBar: el.querySelector<SVGRectElement>('[data-bar="mem"]'),
  }))

  const readoutMap = new Map<string, Element[]>()
  wrap.querySelectorAll('[data-readout]').forEach((el) => {
    const key = el.getAttribute('data-readout')
    if (key) {
      const list = readoutMap.get(key) || []
      list.push(el)
      readoutMap.set(key, list)
    }
  })

  const gaugeMap = new Map<string, { fill: HTMLElement | null; val: HTMLElement | null }>()
  ;['cpu', 'mem', 'rps', 'lat', 'cache', 'cost'].forEach((name) => {
    gaugeMap.set(name, {
      fill: wrap.querySelector<HTMLElement>(`[data-gauge="${name}"] [data-fill]`),
      val: wrap.querySelector<HTMLElement>(`[data-gauge="${name}"] [data-val]`),
    })
  })

  const ringGaugeMap = new Map<string, { circle: SVGCircleElement | null; label: SVGElement | null }>()
  ;['cpu', 'mem', 'lat', 'rps'].forEach((name) => {
    ringGaugeMap.set(name, {
      circle: wrap.querySelector<SVGCircleElement>(`[data-ring-fill="${name}"]`),
      label: wrap.querySelector<SVGElement>(`[data-ring-text="${name}"]`),
    })
  })

  const redPoolPackets = Array.from(wrap.querySelectorAll('[data-pool-packet="redis"]'))
  const rdsPoolPackets = Array.from(wrap.querySelectorAll('[data-pool-packet="rds"]'))
  const costFill = wrap.querySelector<HTMLElement>('[data-gauge="cost"] [data-fill]')
  const costVal = wrap.querySelector<HTMLElement>('[data-gauge="cost"] [data-val]')
  const islandCostVal = wrap.querySelector<HTMLElement>('[data-readout="island-cost"]')
  const islandDot = wrap.querySelector<HTMLElement>('[data-readout="island-status-dot"]')
  const islandText = wrap.querySelector<HTMLElement>('[data-readout="island-status-text"]')
  const islandMiniInfo = wrap.querySelector<HTMLElement>('[data-readout="island-mini-info"]')
  const modeChip = wrap.querySelector<HTMLElement>('[data-readout="mode"]')
  const th = wrap.querySelector<HTMLElement>('.is-threshold')

  let instances: Inst[] = [{ state: 'healthy', since: 0, stage: 3 }]
  let liveStart = 0
  let raf = 0
  let isVisible = true
  let lastBeat = -1
  let lastNoticeShown: string | null = null

  // Haptic feedback tracking variables
  let lastMode: 'idle' | 'live' | null = null
  let lastHealthyCount = 1
  let lastTripped = false

  // Viewport observer to freeze rAF loop when offscreen
  const io = new IntersectionObserver(
    ([entry]) => {
      const prev = isVisible
      isVisible = entry.isIntersecting
      if (!prev && isVisible) {
        raf = requestAnimationFrame(frame)
      }
    },
    { threshold: 0.05 }
  )
  io.observe(track)

  const setSlot = (c: (typeof slotCaches)[0], inst: Inst | undefined, cpu: number, mem: number) => {
    if (c.albWire) {
      const targetOp = inst && inst.state === 'healthy' ? '0.3' : inst && inst.state === 'pending' ? '0.12' : '0'
      if (c.albWire.getAttribute('opacity') !== targetOp) c.albWire.setAttribute('opacity', targetOp)
    }
    if (c.albPacket) {
      const targetOp = inst && inst.state === 'healthy' ? '0.8' : '0'
      if (c.albPacket.getAttribute('opacity') !== targetOp) c.albPacket.setAttribute('opacity', targetOp)
    }

    if (!inst) {
      if (c.el.dataset.state !== 'off') c.el.dataset.state = 'off'
      if (c.redPacket && c.redPacket.getAttribute('opacity') !== '0') c.redPacket.setAttribute('opacity', '0')
      if (c.rdsPacket && c.rdsPacket.getAttribute('opacity') !== '0') c.rdsPacket.setAttribute('opacity', '0')
      if (c.redWire) {
        if (c.redWire.getAttribute('opacity') !== '0.12') c.redWire.setAttribute('opacity', '0.12')
        if (c.redWire.getAttribute('stroke') !== '#3a3a46') c.redWire.setAttribute('stroke', '#3a3a46')
      }
      if (c.rdsWire) {
        if (c.rdsWire.getAttribute('opacity') !== '0.12') c.rdsWire.setAttribute('opacity', '0.12')
        if (c.rdsWire.getAttribute('stroke') !== '#3a3a46') c.rdsWire.setAttribute('stroke', '#3a3a46')
      }
      return
    }
    if (c.el.dataset.state !== inst.state) c.el.dataset.state = inst.state
    if (inst.state === 'pending' && c.lifeLab) {
      const text = LIFE_STAGES[Math.min(inst.stage, 3)]
      if (c.lifeLab.textContent !== text) c.lifeLab.textContent = text
    }
    const hot = cpu >= 88
    const show = inst.state === 'healthy'
    if (c.cpuBar) {
      c.cpuBar.setAttribute('width', `${(show ? cpu : 0) * 0.7}`)
      const fill = hot ? C.danger : C.worker
      if (c.cpuBar.getAttribute('fill') !== fill) c.cpuBar.setAttribute('fill', fill)
    }
    if (c.memBar) c.memBar.setAttribute('width', `${(show ? mem : 0) * 0.7}`)

    if (c.redPacket) {
      const op = show ? '0.7' : '0'
      if (c.redPacket.getAttribute('opacity') !== op) c.redPacket.setAttribute('opacity', op)
    }
    if (c.rdsPacket) {
      const op = show ? '0.7' : '0'
      if (c.rdsPacket.getAttribute('opacity') !== op) c.rdsPacket.setAttribute('opacity', op)
    }

    if (c.redWire) {
      const op = show ? '0.45' : '0.12'
      const stroke = show ? C.infra : '#3a3a46'
      if (c.redWire.getAttribute('opacity') !== op) c.redWire.setAttribute('opacity', op)
      if (c.redWire.getAttribute('stroke') !== stroke) c.redWire.setAttribute('stroke', stroke)
    }
    if (c.rdsWire) {
      const op = show ? '0.45' : '0.12'
      const stroke = show ? C.infra : '#3a3a46'
      if (c.rdsWire.getAttribute('opacity') !== op) c.rdsWire.setAttribute('opacity', op)
      if (c.rdsWire.getAttribute('stroke') !== stroke) c.rdsWire.setAttribute('stroke', stroke)
    }
  }

  const setGauge = (name: string, pct: number, value: string, danger = false) => {
    const g = gaugeMap.get(name)
    if (!g) return
    if (g.fill) {
      g.fill.style.transform = `scaleX(${clamp(pct, 0, 100) / 100})`
      g.fill.dataset.danger = danger ? '1' : '0'
    }
    if (g.val && g.val.textContent !== value) g.val.textContent = value
  }
  const setText = (name: string, value: string) => {
    const list = readoutMap.get(name)
    if (!list) return
    for (let i = 0; i < list.length; i++) {
      if (list[i].textContent !== value) list[i].textContent = value
    }
  }
  const setRingGauge = (name: string, value: number, textVal: string) => {
    const CIRC = 175.93
    const rg = ringGaugeMap.get(name)
    if (!rg) return
    if (rg.circle) {
      const offset = CIRC - (clamp(value, 0, 100) / 100) * CIRC
      const sOffset = String(offset)
      if (rg.circle.getAttribute('stroke-dashoffset') !== sOffset) rg.circle.setAttribute('stroke-dashoffset', sOffset)
    }
    if (rg.label && rg.label.textContent !== textVal) rg.label.textContent = textVal
  }

  const frame = (now: number) => {
    if (!isVisible) return

    const rect = track.getBoundingClientRect()
    const vh = window.innerHeight
    const total = rect.height - vh
    const p = clamp(total > 0 ? -rect.top / total : 0, 0, 1)

    const fi = p * (BEATS.length - 1)
    const active = Math.round(fi)
    const man = ctrl.current
    const redisDown = now < man.redisDownUntil

    if (man.cmd === 'kill') {
      const victim = [...instances].reverse().find((i) => i.state === 'healthy')
      if (victim) { victim.state = 'dead'; victim.since = now }
      man.cmd = null
    }

    let participants: number
    let mode: 'idle' | 'live'
    let desired: number
    if (man.playground) {
      mode = man.mode
      participants = mode === 'idle' ? 0 : man.participants
      const rps = simulate(participants, mode, MAX_INSTANCES, false).rps
      desired = mode === 'idle' ? 1 : clamp(Math.ceil(rps / 640), 1, MAX_INSTANCES)
    } else {
      const i0 = clamp(Math.floor(fi), 0, BEATS.length - 1)
      const i1 = Math.min(i0 + 1, BEATS.length - 1)
      const f = easeInOut(fi - i0)
      participants = Math.round(lerp(BEATS[i0].participants, BEATS[i1].participants, f))
      mode = BEATS[active].mode
      desired = BEATS[active].target
    }
    man.lastParticipants = participants

    if (mode === 'live' && liveStart === 0) liveStart = now
    if (mode === 'idle') liveStart = 0

    const healthyCount = () => instances.filter((i) => i.state === 'healthy').length
    const pendingCount = () => instances.filter((i) => i.state === 'pending').length
    instances.forEach((inst) => {
      if (inst.state === 'pending' && now - inst.since > (reduce ? 60 : LIFECYCLE_MS)) {
        inst.stage += 1
        inst.since = now
        if (inst.stage >= 3) inst.state = 'healthy'
      }
    })
    instances = instances.filter((inst) => !(inst.state === 'dead' && now - inst.since > DEAD_FADE_MS))
    const eff = healthyCount() + pendingCount()
    if (mode === 'idle') {
      if (eff > 1) {
        const extra = instances.filter((i) => i.state === 'healthy').slice(1)
        extra.forEach((i) => { i.state = 'dead'; i.since = now })
      }
      if (healthyCount() === 0 && pendingCount() === 0) instances.push({ state: 'healthy', since: now, stage: 3 })
    } else if (desired > eff && instances.filter((i) => i.state !== 'dead').length < MAX_INSTANCES) {
      instances.push({ state: 'pending', since: now, stage: 0 })
    } else if (desired < healthyCount() && pendingCount() === 0 && !instances.some((i) => i.state === 'dead')) {
      const lastHealthy = [...instances].reverse().find((i) => i.state === 'healthy')
      if (lastHealthy) { lastHealthy.state = 'dead'; lastHealthy.since = now }
    }

    const healthy = healthyCount()
    const sim = simulate(participants, mode, healthy, redisDown)

    slotCaches.forEach((c, i) => {
      const inst = instances[i]
      const jitter = inst?.state === 'healthy' ? Math.sin(now / 500 + i) * 3 : 0
      setSlot(c, inst, sim.cpu + jitter, sim.mem)
    })
    if (albEl) {
      const targetOp = mode === 'idle' ? '0.28' : '1'
      if (albEl.style.opacity !== targetOp) albEl.style.opacity = targetOp
    }
    if (redisEl) {
      const targetDown = redisDown ? '1' : '0'
      if (redisEl.dataset.down !== targetDown) redisEl.dataset.down = targetDown
    }

    const showRed = healthy > 0 && !redisDown
    const showRds = healthy > 0
    const targetRedOp = showRed ? '0.8' : '0'
    const targetRdsOp = showRds ? '0.8' : '0'
    redPoolPackets.forEach((p) => {
      if (p.getAttribute('opacity') !== targetRedOp) p.setAttribute('opacity', targetRedOp)
    })
    rdsPoolPackets.forEach((p) => {
      if (p.getAttribute('opacity') !== targetRdsOp) p.setAttribute('opacity', targetRdsOp)
    })

    setGauge('cpu', sim.cpu, `${sim.cpu}%`, sim.cpu >= 88)
    setGauge('mem', sim.mem, `${sim.mem}%`, sim.mem >= 90)
    setGauge('rps', (sim.rps / 5600) * 100, fmt(sim.rps))
    setGauge('lat', clamp((sim.latency / 300) * 100, 0, 100), `${sim.latency} ms`, sim.latency > 150)
    setGauge('cache', sim.cacheHit, `${sim.cacheHit}%`, redisDown)
    if (costFill) costFill.style.transform = `scaleX(${mode === 'idle' ? 0.15 : clamp(healthy / MAX_INSTANCES, 0, 1)})`
    if (costVal && costVal.textContent !== sim.costLabel) costVal.textContent = sim.costLabel

    const tripped = mode === 'live' && sim.cpu >= SCALE_THRESHOLD

    setRingGauge('cpu', sim.cpu, `${sim.cpu}%`)
    setRingGauge('mem', sim.mem, `${sim.mem}%`)
    setRingGauge('lat', clamp((sim.latency / 300) * 100, 0, 100), `${sim.latency}ms`)
    setRingGauge('rps', (sim.rps / 5600) * 100, fmt(sim.rps))
    
    if (islandCostVal && islandCostVal.textContent !== sim.costLabel) islandCostVal.textContent = sim.costLabel

    let dotColor = '🟢'
    let statusText = ''
    let miniInfoText = `${healthy} EC2 · ${mode === 'idle' ? '0' : fmt(participants)} Users`

    if (mode === 'idle') {
      dotColor = '🌙'
      statusText = `Idle · 1 EC2 · ${sim.cpu}% CPU`
    } else if (redisDown) {
      dotColor = '🔴'
      statusText = `Simulated Failure · Recovering`
    } else if (tripped) {
      dotColor = '🟠'
      statusText = `Scaling Out · Launching EC2 #${instances.length + 1}`
    } else if (sim.stressed) {
      dotColor = '⚡'
      statusText = `Contest Live · ${fmt(participants)} participants`
    } else {
      dotColor = '🟢'
      statusText = `Stable · ${healthy} EC2 · ${sim.latency}ms P95`
    }
    
    if (islandDot && islandDot.textContent !== dotColor) islandDot.textContent = dotColor
    if (islandText && islandText.textContent !== statusText) islandText.textContent = statusText
    if (islandMiniInfo && islandMiniInfo.textContent !== miniInfoText) islandMiniInfo.textContent = miniInfoText

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      if (lastMode !== null && lastMode !== mode) {
        navigator.vibrate(15)
      }
      if (healthy > lastHealthyCount) {
        navigator.vibrate(25)
      }
      if (tripped && !lastTripped) {
        navigator.vibrate(80)
      }
    }
    lastMode = mode
    lastHealthyCount = healthy
    lastTripped = tripped

    setText('participants', mode === 'idle' ? '0' : fmt(participants))
    setText('instances', `${healthy}×`)
    setText('status', mode === 'idle' ? 'Idle' : redisDown ? 'Degraded' : sim.stressed ? 'Under load' : 'Running')
    setText('asg', tripped ? 'Triggered' : 'Enabled')
    if (modeChip) {
      const text = mode === 'idle' ? '🌙 IDLE' : '⚡ LIVE'
      if (modeChip.textContent !== text) modeChip.textContent = text
      if (modeChip.dataset.mode !== mode) modeChip.dataset.mode = mode
    }
    const d = new Date()
    setText('clock', `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`)
    const elapsed = liveStart ? Math.floor((now - liveStart) / 1000) : 0
    setText('elapsed', `${pad(Math.floor(elapsed / 60))}:${pad(elapsed % 60)}`)
    if (th) {
      const targetTripped = tripped ? '1' : '0'
      if (th.dataset.tripped !== targetTripped) th.dataset.tripped = targetTripped
    }
    setText('thresholdtext', tripped ? `CPU ${sim.cpu}% · threshold ${SCALE_THRESHOLD}% — scaling policy triggered` : `CPU ${sim.cpu}% · threshold ${SCALE_THRESHOLD}%`)

    const targetStress = sim.stressed ? '1' : '0'
    if (wrap.dataset.stress !== targetStress) wrap.dataset.stress = targetStress

    const showMsg = now < man.noticeUntil ? man.noticeMsg : null
    if (showMsg !== lastNoticeShown) { lastNoticeShown = showMsg; setNotice(showMsg) }

    if (active !== lastBeat) { lastBeat = active; setBeatIdx(active) }

    raf = requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame)

  return () => {
    io.disconnect()
    if (raf) cancelAnimationFrame(raf)
  }
}

function Gauge({ name, label, isText }: { name: string; label: string; isText?: boolean }) {
  return (
    <div className="is-gauge" data-gauge={name}>
      <div className="is-gauge-top">
        <span className="is-gauge-lab">{label}</span>
        <span className={isText ? 'is-gauge-val is-gauge-val-sm' : 'is-gauge-val'} data-val>—</span>
      </div>
      <div className="is-gauge-track">
        <div className="is-gauge-fill" data-fill />
      </div>
    </div>
  )
}

/* ── Static SVG topology ────────────────────────────────────────── */
function SimScene({ isMobile }: { isMobile?: boolean }) {
  const vbW = isMobile ? 750 : VB_W
  return (
    <svg viewBox={`0 0 ${vbW} ${VB_H}`} preserveAspectRatio="xMidYMid meet" className="is-svg">
      <defs>
        <radialGradient id="is-bg" cx="34%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#16161c" />
          <stop offset="100%" stopColor="#08080a" />
        </radialGradient>
      </defs>
      <rect x={0} y={0} width={vbW} height={VB_H} fill="url(#is-bg)" />

      <g stroke={C.infra} strokeWidth={2} fill="none" opacity={0.5}>
        <path d={`M ${ROUTE53.x} ${ROUTE53.y + 30} L ${ALB.x} ${ALB.y - 30}`} />
      </g>
      <g stroke={C.realtime} strokeWidth={1.6} fill="none">
        {SLOTS.map((s, i) => (<path key={i} data-alb-wire={i} opacity={0} d={`M ${ALB.x} ${ALB.y + 30} L ${s.x} ${s.y - 34}`} />))}
      </g>
      {/* Instances → Pools connection wires */}
      <g stroke="#3a3a46" strokeWidth={1.2} fill="none">
        {SLOTS.map((s, i) => (<path key={`red-${i}`} data-wire={`red-wire-${i}`} opacity={0.12} d={`M ${s.x} ${s.y + 34} L ${POOL_REDIS.x} ${POOL_REDIS.y - 12}`} />))}
        {SLOTS.map((s, i) => (<path key={`rds-${i}`} data-wire={`rds-wire-${i}`} opacity={0.12} d={`M ${s.x} ${s.y + 34} L ${POOL_RDS.x} ${POOL_RDS.y - 12}`} />))}
      </g>

      {/* Pools → DB wires (4 distinct wires side-by-side representing the pool capacity) */}
      <g stroke={C.infra} strokeWidth={1.4} fill="none" opacity={0.65}>
        {[-9, -3, 3, 9].map((offset, idx) => (
          <path key={`w-red-${idx}`} d={`M ${POOL_REDIS.x + offset} ${POOL_REDIS.y + 12} L ${REDIS.x + offset} ${REDIS.y - 30}`} />
        ))}
        {[-9, -3, 3, 9].map((offset, idx) => (
          <path key={`w-rds-${idx}`} d={`M ${POOL_RDS.x + offset} ${POOL_RDS.y + 12} L ${RDS.x + offset} ${RDS.y - 30}`} />
        ))}
      </g>

      {/* ALB → instance packets */}
      <g>
        {SLOTS.map((s, i) => (
          <circle key={i} data-alb-packet={i} r={3.5} fill={C.realtime} opacity={0}>
            <animateMotion dur={`${(1.5 + (i % 3) * 0.2).toFixed(2)}s`} begin={`${(i * 0.12).toFixed(2)}s`} repeatCount="indefinite" path={`M ${ALB.x} ${ALB.y + 30} L ${s.x} ${s.y - 34}`} />
          </circle>
        ))}
      </g>

      {/* Instances → Redis Pool packets */}
      <g>
        {SLOTS.map((s, i) => (
          <circle key={`p-red-${i}`} r={3} fill="#a855f7" opacity={0} data-packet={`red-slot-${i}`}>
            <animateMotion dur={`${(1.4 + (i % 3) * 0.25).toFixed(2)}s`} begin={`${(i * 0.15).toFixed(2)}s`} repeatCount="indefinite" path={`M ${s.x} ${s.y + 34} L ${POOL_REDIS.x} ${POOL_REDIS.y - 12}`} />
          </circle>
        ))}
      </g>

      {/* Instances → RDS Pool packets */}
      <g>
        {SLOTS.map((s, i) => (
          <circle key={`p-rds-${i}`} r={3} fill="#a855f7" opacity={0} data-packet={`rds-slot-${i}`}>
            <animateMotion dur={`${(1.6 + (i % 3) * 0.2).toFixed(2)}s`} begin={`${(i * 0.1).toFixed(2)}s`} repeatCount="indefinite" path={`M ${s.x} ${s.y + 34} L ${POOL_RDS.x} ${POOL_RDS.y - 12}`} />
          </circle>
        ))}
      </g>

      {/* Redis Pool → Redis DB packets (4 streams corresponding to active wires) */}
      <g>
        {[-9, -3, 3, 9].map((offset, idx) => (
          <circle key={`pb-red-${idx}`} r={3} fill="#a855f7" opacity={0.8} data-pool-packet="redis">
            <animateMotion dur={`${(1.0 + idx * 0.15).toFixed(2)}s`} begin={`${(idx * 0.2).toFixed(2)}s`} repeatCount="indefinite" path={`M ${POOL_REDIS.x + offset} ${POOL_REDIS.y + 12} L ${REDIS.x + offset} ${REDIS.y - 30}`} />
          </circle>
        ))}
      </g>

      {/* RDS Pool → RDS DB packets (4 streams corresponding to active wires) */}
      <g>
        {[-9, -3, 3, 9].map((offset, idx) => (
          <circle key={`pb-rds-${idx}`} r={3} fill="#a855f7" opacity={0.8} data-pool-packet="rds">
            <animateMotion dur={`${(1.2 + idx * 0.1).toFixed(2)}s`} begin={`${(idx * 0.15).toFixed(2)}s`} repeatCount="indefinite" path={`M ${POOL_RDS.x + offset} ${POOL_RDS.y + 12} L ${RDS.x + offset} ${RDS.y - 30}`} />
          </circle>
        ))}
      </g>

      {/* Connection Pool Nodes */}
      <g>
        {/* ElastiCache Redis Pool Box */}
        <rect x={POOL_REDIS.x - 24} y={POOL_REDIS.y - 12} width={48} height={24} rx={6} fill="#141418" stroke={C.infra} strokeWidth={1.6} />
        <text x={POOL_REDIS.x} y={POOL_REDIS.y + 3.5} textAnchor="middle" fill="#b98cff" fontSize="8px" fontWeight="800" fontFamily="var(--font-suisseintlmono)">POOL</text>

        {/* RDS Postgres Pool Box */}
        <rect x={POOL_RDS.x - 24} y={POOL_RDS.y - 12} width={48} height={24} rx={6} fill="#141418" stroke={C.infra} strokeWidth={1.6} />
        <text x={POOL_RDS.x} y={POOL_RDS.y + 3.5} textAnchor="middle" fill="#b98cff" fontSize="8px" fontWeight="800" fontFamily="var(--font-suisseintlmono)">POOL</text>
      </g>

      <PillNode x={ROUTE53.x} y={ROUTE53.y} w={210} h={62} color={C.core} label="Route 53" sub="ysmquizbuzz.com" />
      <g data-node="alb"><PillNode x={ALB.x} y={ALB.y} w={250} h={62} color={C.realtime} label="Application LB" sub="socket.io · api/quiz" /></g>
      <g data-node="redis" data-down="0" className="is-redis"><PillNode x={REDIS.x} y={REDIS.y} w={200} h={62} color={C.infra} label="ElastiCache" sub="Redis · primary+replica" /></g>
      <PillNode x={RDS.x} y={RDS.y} w={200} h={62} color={C.infra} label="RDS Postgres" sub="durable store" />

      {SLOTS.map((s, i) => (<InstanceCard key={i} i={i} x={s.x} y={s.y} />))}
    </svg>
  )
}

function PillNode({ x, y, w, h, color, label, sub }: { x: number; y: number; w: number; h: number; color: string; label: string; sub: string }) {
  return (
    <g>
      <rect className="is-pill-box" x={x - w / 2} y={y - h / 2} width={w} height={h} rx={14} fill="#141418" stroke={color} strokeWidth={2.2} />
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
      <text x={-w / 2 + 12} y={h / 2 - 26} className="is-slot-tag" fill="#7a7a82">CPU</text>
      <rect x={-w / 2 + 40} y={h / 2 - 34} width={70} height={8} rx={4} fill="#26262c" />
      <rect data-bar="cpu" x={-w / 2 + 40} y={h / 2 - 34} width={0} height={8} rx={4} fill={C.worker} />
      <text x={-w / 2 + 12} y={h / 2 - 8} className="is-slot-tag" fill="#7a7a82">MEM</text>
      <rect x={-w / 2 + 40} y={h / 2 - 16} width={70} height={8} rx={4} fill="#26262c" />
      <rect data-bar="mem" x={-w / 2 + 40} y={h / 2 - 16} width={0} height={8} rx={4} fill={C.infra} />
      {/* pending */}
      <circle className="is-slot-spin" cx={0} cy={-4} r={15} fill="none" stroke={C.core} strokeWidth={3} strokeDasharray="24 60" />
      <text data-life x={0} y={26} textAnchor="middle" className="is-slot-pending" fill={C.core}>pending</text>
      {/* dead */}
      <text className="is-slot-dead" x={0} y={4} textAnchor="middle" fill={C.danger}>✕ stopping...</text>
    </g>
  )
}

/* ── Styles ─────────────────────────────────────────────────────── */
function SimStyles() {
  return (
    <style>{`
      .is-panel { position: relative; width: 100%; height: min(88vh, 780px); border-radius: 32px; overflow: hidden; background: #08080a; box-shadow: 0 40px 120px -40px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.06); }
      .is-panel::after { content: ''; position: absolute; inset: 0; pointer-events: none; border-radius: 32px; box-shadow: inset 0 0 120px 10px rgba(255,59,59,0); transition: box-shadow .5s ease; }
      .is-panel[data-stress='1']::after { box-shadow: inset 0 0 120px 12px rgba(255,59,59,0.26); }
      .is-svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }

      /* Mobile layout adjustments */
      @media (max-width: 767px) {
        .is-panel {
          height: min(92vh, 800px);
          border-radius: 24px;
        }
        .is-svg {
          transition: transform 0.55s cubic-bezier(0.19, 1, 0.22, 1), filter 0.55s ease;
        }
        .is-panel[data-island-open='1'] .is-svg {
          transform: translateY(68px) scale(0.92);
          filter: blur(2px);
        }
        
        /* Mobile Simulator Dynamic Island */
        .sim-island {
          position: absolute;
          top: 16px;
          left: 50%;
          transform: translateX(-50%);
          width: calc(100% - 32px);
          max-width: 340px;
          background: rgba(10, 10, 13, 0.94);
          backdrop-filter: blur(14px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 24px;
          z-index: 40;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
          transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.1); /* spring-like wobble */
          overflow: hidden;
          color: #fff;
          cursor: pointer;
        }
        .sim-island[data-expanded='true'] {
          border-radius: 28px;
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.68);
          max-width: 350px;
        }
        .sim-island-collapsed {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 16px;
          height: 46px;
          opacity: 1;
          transition: opacity 0.2s ease, height 0.3s ease;
        }
        .sim-island[data-expanded='true'] .sim-island-collapsed {
          opacity: 0;
          height: 0;
          padding: 0;
          pointer-events: none;
        }
        .sim-island-expanded {
          opacity: 0;
          height: 0;
          overflow: hidden;
          pointer-events: none;
          transition: opacity 0.25s ease, height 0.35s ease, padding 0.35s ease;
          padding: 0;
        }
        .sim-island[data-expanded='true'] .sim-island-expanded {
          opacity: 1;
          height: auto;
          pointer-events: auto;
          padding: 18px;
        }
        
        /* Mobile Story Mode Caption positioning */
        .is-caption {
          position: absolute !important;
          left: 16px !important;
          right: 16px !important;
          bottom: 96px !important; /* sit beautifully above the floating control pill */
          max-width: none !important;
          pointer-events: auto !important;
          z-index: 25 !important;
          background: linear-gradient(180deg, transparent, rgba(10,10,13,0.85) 40%, rgba(10,10,13,0.95)) !important;
          padding: 20px 16px 12px 16px !important;
          border-radius: 0 0 24px 24px !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 4px !important;
          animation: is-rise .5s cubic-bezier(0.2,0.7,0.2,1) both !important;
        }
        .is-caption .is-kicker {
          font-size: 10px !important;
          margin-bottom: 4px !important;
        }
        .is-caption .is-title {
          font-size: 22px !important;
          margin-bottom: 6px !important;
          line-height: 1.1 !important;
        }
        .is-caption .is-sub {
          font-size: 12.5px !important;
          line-height: 1.4 !important;
          color: rgba(255,255,255,0.7) !important;
        }
        .is-caption .is-why {
          margin-top: 8px !important;
          font-size: 11.5px !important;
          padding-left: 10px !important;
        }

        /* Mobile range slider customizations inside floating pill */
        .sim-mobile-pill input[type='range'] {
          -webkit-appearance: none;
          appearance: none;
          height: 4px;
          border-radius: 2px;
          background: rgba(255, 255, 255, 0.15) !important;
          outline: none;
        }
        .sim-mobile-pill input[type='range']::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: var(--color-electric-yellow,#fff100) !important;
          box-shadow: 0 0 8px rgba(255, 241, 0, 0.5);
          cursor: grab;
        }
        .sim-mobile-pill input[type='range']::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border: 0;
          border-radius: 50%;
          background: var(--color-electric-yellow,#fff100) !important;
          box-shadow: 0 0 8px rgba(255, 241, 0, 0.5);
          cursor: grab;
        }
      }
      .is-node-label { font-family: var(--font-suisseintlcond), sans-serif; font-weight: 700; font-size: 20px; letter-spacing: -0.4px; }
      .is-node-sub { font-family: var(--font-suisseintlmono), monospace; font-size: 12px; }
      .is-redis[data-down='1'] .is-pill-box { stroke: ${C.danger}; filter: drop-shadow(0 0 12px rgba(255,59,59,0.6)); }

      .is-slot { transition: opacity .4s ease; }
      .is-slot[data-state='off'] { opacity: 0; }
      .is-slot-box { transition: stroke .3s ease, filter .3s ease; }
      .is-slot[data-state='on'] .is-slot-box, .is-slot[data-state='healthy'] .is-slot-box { filter: drop-shadow(0 0 10px rgba(68,248,122,0.45)); }
      .is-slot[data-state='pending'] .is-slot-box { stroke: ${C.core}; stroke-dasharray: 6 6; }
      .is-slot[data-state='dead'] .is-slot-box { stroke: ${C.danger}; filter: drop-shadow(0 0 12px rgba(255,59,59,0.5)); opacity: .5; }
      .is-slot-name { font-family: var(--font-suisseintlcond), sans-serif; font-weight: 700; font-size: 17px; }
      .is-slot-state { font-family: var(--font-suisseintlmono), monospace; font-size: 11px; }
      .is-slot-tag { font-family: var(--font-suisseintlmono), monospace; font-size: 10px; }
      .is-slot-spin, .is-slot-pending, .is-slot-dead { opacity: 0; }
      .is-slot[data-state='pending'] .is-slot-name, .is-slot[data-state='pending'] .is-slot-state, .is-slot[data-state='pending'] .is-slot-tag, .is-slot[data-state='pending'] [data-bar] { opacity: 0; }
      .is-slot[data-state='pending'] .is-slot-spin { opacity: 1; animation: is-spin .9s linear infinite; transform-box: fill-box; transform-origin: center; }
      .is-slot[data-state='pending'] .is-slot-pending { opacity: 1; }
      .is-slot[data-state='dead'] .is-slot-name { opacity: .5; }
      .is-slot[data-state='dead'] .is-slot-state, .is-slot[data-state='dead'] .is-slot-tag, .is-slot[data-state='dead'] [data-bar] { opacity: 0; }
      .is-slot[data-state='dead'] .is-slot-dead { opacity: 1; }
      @keyframes is-spin { to { transform: rotate(360deg); } }

      .is-notice { position: absolute; top: 16px; left: 50%; transform: translateX(-50%) translateY(-8px); z-index: 5; background: rgba(20,20,24,0.92); border: 1px solid rgba(255,59,59,0.5); color: #fff; font-family: var(--font-suisseintlmono), monospace; font-size: 12px; padding: 8px 16px; border-radius: 20px; opacity: 0; transition: opacity .3s ease, transform .3s ease; pointer-events: none; max-width: 80%; text-align: center; backdrop-filter: blur(6px); }
      .is-notice[data-show='1'] { opacity: 1; transform: translateX(-50%) translateY(0); }

      .is-rail-right { position: absolute; top: 20px; right: 20px; width: min(320px, 42%); display: flex; flex-direction: column; gap: 11px; }
      .is-mission { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 12px 14px; backdrop-filter: blur(6px); }
      .is-mission-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
      .is-chip { font-family: var(--font-suisseintlmono), monospace; font-size: 11px; letter-spacing: 0.3px; padding: 4px 10px; border-radius: 20px; background: rgba(255,255,255,0.08); color: #fff; }
      .is-chip[data-mode='live'] { background: rgba(34,211,245,0.16); color: ${C.realtime}; }
      .is-clock { font-family: var(--font-suisseintlmono), monospace; font-size: 12px; color: rgba(255,255,255,0.55); font-variant-numeric: tabular-nums; }
      .is-mission-big { display: flex; flex-direction: column; margin-bottom: 10px; }
      .is-mission-num { font-family: var(--font-suisseintlcond), sans-serif; font-weight: 700; font-size: 40px; line-height: 1; letter-spacing: -1.5px; color: #fff; font-variant-numeric: tabular-nums; }
      .is-mission-lab { font-family: var(--font-suisseintlmono), monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; color: rgba(255,255,255,0.42); margin-top: 3px; }
      .is-mission-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 12px; }
      .is-mission-grid > div { display: flex; justify-content: space-between; align-items: baseline; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 5px; }
      .is-mg-lab { font-family: var(--font-suisseintlmono), monospace; font-size: 10px; text-transform: uppercase; color: rgba(255,255,255,0.4); }
      .is-mg-val { font-family: var(--font-suisseintlmono), monospace; font-size: 12px; color: #fff; }

      .is-gauges { display: grid; grid-template-columns: 1fr 1fr; gap: 9px 14px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 12px 14px; backdrop-filter: blur(6px); }
      .is-gauge-top { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 5px; }
      .is-gauge-lab { font-family: var(--font-suisseintlmono), monospace; font-size: 10px; text-transform: uppercase; color: rgba(255,255,255,0.45); }
      .is-gauge-val { font-family: var(--font-suisseintlcond), sans-serif; font-weight: 700; font-size: 16px; color: #fff; letter-spacing: -0.3px; font-variant-numeric: tabular-nums; }
      .is-gauge-val-sm { font-size: 12px; }
      .is-gauge-track { height: 6px; border-radius: 3px; background: rgba(255,255,255,0.1); overflow: hidden; }
      .is-gauge-fill { height: 100%; width: 100%; border-radius: 3px; background: linear-gradient(90deg, #22d3f5, #44f87a); transform: scaleX(0); transform-origin: left center; transition: transform .35s cubic-bezier(.4,0,.2,1); }
      .is-gauge-fill[data-danger='1'] { background: ${C.danger}; }

      .is-threshold { font-family: var(--font-suisseintlmono), monospace; font-size: 11px; color: rgba(255,255,255,0.5); padding: 8px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.02); transition: all .3s ease; }
      .is-threshold[data-tripped='1'] { color: ${C.core}; border-color: rgba(255,241,0,0.4); background: rgba(255,241,0,0.06); }

      .is-controls { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 13px 14px; display: flex; flex-direction: column; gap: 11px; backdrop-filter: blur(6px); }
      .is-ctrl-head { display: flex; justify-content: space-between; align-items: center; font-family: var(--font-suisseintlmono), monospace; font-size: 10px; letter-spacing: 0.4px; color: rgba(255,255,255,0.5); }
      .is-live-dot { padding: 2px 8px; border-radius: 20px; background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.5); }
      .is-live-dot[data-on='1'] { background: rgba(68,248,122,0.18); color: ${C.worker}; }
      .is-ctrl-note { font-family: var(--font-suisseintl), sans-serif; font-size: 12px; line-height: 1.4; color: rgba(255,255,255,0.55); margin: 0; }
      .is-btn-primary { font-family: var(--font-suisseintlmono), monospace; font-size: 13px; padding: 11px; border-radius: 10px; border: 0; cursor: pointer; background: var(--color-electric-yellow,#fff100); color: #000; font-weight: 500; transition: transform .15s ease, filter .2s ease; }
      .is-btn-primary:hover { transform: translateY(-1px); filter: brightness(1.05); }
      .is-btn-ghost { font-family: var(--font-suisseintlmono), monospace; font-size: 12px; padding: 8px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.14); background: transparent; color: rgba(255,255,255,0.7); cursor: pointer; }
      .is-btn-ghost:hover { color: #fff; border-color: rgba(255,255,255,0.35); }
      .is-toggle { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
      .is-toggle button { font-family: var(--font-suisseintlmono), monospace; font-size: 12px; padding: 8px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.03); color: rgba(255,255,255,0.7); cursor: pointer; transition: all .2s ease; }
      .is-toggle button:hover { border-color: rgba(255,255,255,0.35); color: #fff; }
      .is-slider-label { font-family: var(--font-suisseintlmono), monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.3px; color: rgba(255,255,255,0.5); display: flex; flex-direction: column; gap: 8px; }
      .is-slider-label input[type='range'] { -webkit-appearance: none; appearance: none; height: 6px; border-radius: 3px; background: linear-gradient(90deg, #22d3f5, #fff100); outline: none; cursor: pointer; }
      .is-slider-label input[type='range']::-webkit-slider-thumb { -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%; background: #fff; box-shadow: 0 0 10px rgba(255,255,255,0.6); cursor: grab; }
      .is-slider-label input[type='range']::-moz-range-thumb { width: 18px; height: 18px; border: 0; border-radius: 50%; background: #fff; box-shadow: 0 0 10px rgba(255,255,255,0.6); cursor: grab; }
      .is-ops { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; }
      .is-op { font-family: var(--font-suisseintlmono), monospace; font-size: 11px; padding: 9px 4px; border-radius: 10px; border: 0; cursor: pointer; transition: transform .15s ease, filter .2s ease; }
      .is-op:hover { transform: translateY(-1px); filter: brightness(1.1); }
      .is-op-spike { background: ${C.payment}; color: #fff; }
      .is-op-kill { background: rgba(255,59,59,0.16); color: ${C.danger}; border: 1px solid rgba(255,59,59,0.4); }
      .is-op-redis { background: rgba(122,0,251,0.18); color: #b98cff; border: 1px solid rgba(122,0,251,0.45); }

      .is-hud { position: absolute; top: 20px; left: 24px; pointer-events: none; }
      .is-counter { font-family: var(--font-suisseintlcond), sans-serif; font-weight: 700; display: flex; align-items: baseline; gap: 6px; color: #fff; }
      .is-counter-cur { font-size: 32px; letter-spacing: -1px; line-height: 1; }
      .is-counter-tot { font-size: 13px; color: rgba(255,255,255,0.4); }

      .is-caption { position: absolute; left: 24px; bottom: 58px; max-width: min(470px, 52%); pointer-events: none; }
      .is-kicker { font-family: var(--font-suisseintlmono), monospace; font-size: 12px; letter-spacing: 0.4px; color: rgba(255,255,255,0.45); margin-bottom: 10px; }
      .is-title { font-family: var(--font-suisseintlcond), sans-serif; font-weight: 700; font-size: clamp(26px, 3.4vw, 40px); line-height: 0.98; letter-spacing: -1.2px; color: #fff; margin: 0 0 12px; text-wrap: balance; animation: is-rise .5s cubic-bezier(0.2,0.7,0.2,1) both; }
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
        .is-rail-right { width: 47%; top: 14px; right: 14px; gap: 8px; }
        .is-gauges { grid-template-columns: 1fr; gap: 7px; }
        .is-caption { max-width: 48%; bottom: 52px; }
        .is-mission-num { font-size: 32px; }
      }
      @media (prefers-reduced-motion: reduce) { .is-title, .is-why { animation: none; } }
    `}</style>
  )
}
