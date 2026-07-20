'use client'

import { useRef, useState, type ReactNode } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { StudioLights, StudioEffects } from '@/components/three/StudioRig'
import Autoscaler from '@/components/3d/Autoscaler'
import Pipeline from '@/components/3d/Pipeline'
import RealtimeHub from '@/components/3d/RealtimeHub'
import DistributedLock from '@/components/3d/DistributedLock'
import IdempotencyFilter from '@/components/3d/IdempotencyFilter'
import Observability from '@/components/3d/Observability'
import DeployPipeline from '@/components/3d/DeployPipeline'
import RateLimiter from '@/components/3d/RateLimiter'
import CacheLookup from '@/components/3d/CacheLookup'
import CircuitBreaker from '@/components/3d/CircuitBreaker'
import Sharding from '@/components/3d/Sharding'
import ModeSwitch from '@/components/3d/ModeSwitch'
import PaymentsGlyph from '@/components/3d/Payments'
import StatGlyph from '@/components/3d/StatGlyph'
import EventBus from '@/components/3d/EventBus'
import HeartbeatGlyph from '@/components/3d/Heartbeat'
import BackupSnapshot from '@/components/3d/BackupSnapshot'
import Cache from '@/components/3d/Cache'
import LoadBalancer from '@/components/3d/LoadBalancer'
import Workers from '@/components/3d/Workers'
import Laptop from '@/components/3d/Laptop'
import Monitoring from '@/components/3d/Monitoring'

/**
 * /lab/playground — the harness for the behavioural glyphs in
 * `docs/3d-components-roadmap.md`. Nothing here is wired into the live site; this
 * is where a glyph earns its place before it replaces a node on a real card.
 *
 * One glyph at a time, deliberately. An earlier version showed every glyph and
 * every context at once and the browser dropped the WebGL contexts on the floor
 * ("Context Lost") — the per-page context limit is ~8 and each <Canvas> takes one.
 * Four canvases per view is the budget, which is exactly the four checks §6 asks
 * for: light card bg, black skills bg, 120px legibility, and the node it replaces.
 */

const STATIC = { showLabel: false, floating: false, interactive: false } as const

type GlyphId =
    | 'autoscaler' | 'pipeline' | 'realtime-hub'
    | 'lock' | 'idempotency' | 'observability' | 'deploy' | 'rate-limiter'
    | 'cache-lookup' | 'breaker' | 'sharding' | 'mode-switch' | 'payments'
    | 'stats' | 'event-bus' | 'heartbeat' | 'snapshots'

interface GlyphEntry {
    title: string
    story: string
    /** camera-space scale per context, tuned so each fills its frame like the real cards do */
    scale: { card: number; skills: number; thumb: number }
    render: (p: { freeze: boolean }) => ReactNode
    /** Only for glyphs that stand in for an existing node — most Priority B ones don't. */
    replaces?: string
    today?: ReactNode
}

const GLYPHS: Record<GlyphId, GlyphEntry> = {
    autoscaler: {
        title: 'A1 · AUTOSCALER — INFRA card',
        story: 'pressure builds → scales out → absorbs → relaxes. Blue fill = requests in, yellow tick = the high-water threshold that triggers a scale-out.',
        replaces: 'LoadBalancer',
        scale: { card: 1.15, skills: 0.85, thumb: 1.15 },
        render: ({ freeze }) => <Autoscaler {...STATIC} animationToggle={!freeze} forceReducedMotion={freeze} />,
        today: <LoadBalancer {...STATIC} animationToggle={false} />,
    },
    pipeline: {
        title: 'A2 · PIPELINE — SYSTEMS card',
        story: 'enqueue at the yellow hopper → a worker pulls and pulses → green completion in the tray. Every ~9th job bounces to the dead-letter bin and retries.',
        replaces: 'Workers',
        scale: { card: 1.1, skills: 0.8, thumb: 1.05 },
        render: ({ freeze }) => <Pipeline {...STATIC} animationToggle={!freeze} forceReducedMotion={freeze} />,
        today: <Workers {...STATIC} animationToggle={false} />,
    },
    'realtime-hub': {
        title: 'A3 · REALTIME HUB — QUIZBUZZ card',
        story: 'the hub broadcasts, a wave sweeps the ring of clients, they ack back to green. Every loop a surge of extra clients connects, then drops away.',
        replaces: 'Laptop',
        scale: { card: 1.05, skills: 0.78, thumb: 1.0 },
        render: ({ freeze }) => <RealtimeHub {...STATIC} animationToggle={!freeze} forceReducedMotion={freeze} />,
        today: <Laptop {...STATIC} animationToggle={false} />,
    },
    lock: {
        title: 'B1 · LOCK — distributed mutual exclusion',
        story: 'one worker acquires the green token; the other two press in and are held short. Clean round-robin hand-off, with the occasional amber lock-wait timeout.',
        scale: { card: 1.1, skills: 0.8, thumb: 1.05 },
        render: ({ freeze }) => <DistributedLock {...STATIC} animationToggle={!freeze} forceReducedMotion={freeze} />,
    },
    idempotency: {
        title: 'B2 · IDEMPOTENCY FILTER — dedupe',
        story: 'a first-seen id passes with a green flash and is recorded on the tan ledger; a duplicate presses against the membrane, greys out and dissolves.',
        scale: { card: 1.1, skills: 0.8, thumb: 1.05 },
        render: ({ freeze }) => <IdempotencyFilter {...STATIC} animationToggle={!freeze} forceReducedMotion={freeze} />,
    },
    observability: {
        title: 'B3 · OBSERVABILITY — logs / metrics / traces',
        story: 'the series scrolls at a calm baseline, a spike rises and an LED flips amber, a blue trace streaks the console, then the incident clears.',
        replaces: 'Monitoring',
        scale: { card: 1.35, skills: 1.0, thumb: 1.3 },
        render: ({ freeze }) => <Observability {...STATIC} animationToggle={!freeze} forceReducedMotion={freeze} />,
        today: <Monitoring {...STATIC} animationToggle={false} />,
    },
    deploy: {
        title: 'B4 · DEPLOY PIPELINE — CI/CD, zero-downtime',
        story: 'the token advances and each finished stage latches green. At DEPLOY the new version enters the live slot as the old one leaves — no gap. Every 3rd run TEST fails and rolls back.',
        scale: { card: 1.0, skills: 0.74, thumb: 0.95 },
        render: ({ freeze }) => <DeployPipeline {...STATIC} animationToggle={!freeze} forceReducedMotion={freeze} />,
    },
    'rate-limiter': {
        title: 'B5 · RATE LIMITER — token bucket / backpressure',
        story: 'requests spend a yellow token to pass. A burst drains the bucket, the gate shuts and requests pile up dimmed, then the refill drains the queue.',
        scale: { card: 1.05, skills: 0.78, thumb: 1.0 },
        render: ({ freeze }) => <RateLimiter {...STATIC} animationToggle={!freeze} forceReducedMotion={freeze} />,
    },
    'cache-lookup': {
        title: 'C1 · CACHE LOOKUP — hit vs miss',
        story: 'three fast hits bouncing off the green cache, then one miss that falls through to the DB, returns slower, and populates the cache on the way back.',
        replaces: 'Cache',
        scale: { card: 1.05, skills: 0.78, thumb: 1.0 },
        render: ({ freeze }) => <CacheLookup {...STATIC} animationToggle={!freeze} forceReducedMotion={freeze} />,
        today: <Cache {...STATIC} animationToggle={false} />,
    },
    breaker: {
        title: 'C2 · CIRCUIT BREAKER — closed / open / half-open',
        story: 'requests flow while closed; downstream sickens and the breaker trips red, bouncing requests away from it; after a cooldown one trial request goes through and it closes again.',
        scale: { card: 1.05, skills: 0.78, thumb: 1.0 },
        render: ({ freeze }) => <CircuitBreaker {...STATIC} animationToggle={!freeze} forceReducedMotion={freeze} />,
    },
    sharding: {
        title: 'C3 · SHARDING — partitioning by key',
        story: 'records fall into the router and deflect left / centre / right by key. The same key colour always lands in the same shard.',
        scale: { card: 1.0, skills: 0.76, thumb: 0.95 },
        render: ({ freeze }) => <Sharding {...STATIC} animationToggle={!freeze} forceReducedMotion={freeze} />,
    },
    'mode-switch': {
        title: 'C4 · MODE SWITCH — QuizBuzz idle ⇄ live',
        story: 'the switch throws, keys stream across the migration arc, and the live stack scales up and lights. Event ends, everything migrates back and retracts.',
        scale: { card: 1.05, skills: 0.78, thumb: 1.0 },
        render: ({ freeze }) => <ModeSwitch {...STATIC} animationToggle={!freeze} forceReducedMotion={freeze} />,
    },
    payments: {
        title: 'C5 · PAYMENTS — SmartFormFlow async flow',
        story: 'gateway → AUTH holds amber → CAPTURE confirms green → the tray emits a sealed certificate. Every third run the auth declines and nothing is issued.',
        scale: { card: 1.0, skills: 0.76, thumb: 0.95 },
        render: ({ freeze }) => <PaymentsGlyph {...STATIC} animationToggle={!freeze} forceReducedMotion={freeze} />,
    },
    stats: {
        title: 'C6 · STAT GLYPHS — the Stats strip micro-objects',
        story: 'three ≤80px glyphs that count up beside their number: a swarm multiplying (blue), a stack of shipped systems (tan), a ring sweeping to fill (green).',
        scale: { card: 1.5, skills: 1.1, thumb: 1.4 },
        // All three at once — they are only ever seen as a set, so they have to be
        // judged as a set: same weight, same rhythm, distinct silhouettes.
        render: ({ freeze }) => (
            <>
                <StatGlyph variant="users" position={[-1.5, 0, 0]} {...STATIC} animationToggle={!freeze} forceReducedMotion={freeze} />
                <StatGlyph variant="systems" position={[0, 0, 0]} {...STATIC} animationToggle={!freeze} forceReducedMotion={freeze} />
                <StatGlyph variant="experience" position={[1.5, 0, 0]} {...STATIC} animationToggle={!freeze} forceReducedMotion={freeze} />
            </>
        ),
    },
    'event-bus': {
        title: 'C7 · EVENT BUS — pub/sub fan-out',
        story: 'an event travels the spine; each subscriber it passes lights green and emits its own reaction packet. A second event ripples behind the first.',
        scale: { card: 1.05, skills: 0.78, thumb: 1.0 },
        render: ({ freeze }) => <EventBus {...STATIC} animationToggle={!freeze} forceReducedMotion={freeze} />,
    },
    heartbeat: {
        title: 'C8 · HEARTBEAT — liveness / health-check',
        story: 'a steady green pulse every 1.4s. Every fifth beat is missed — the ring skips and flips amber — then recovers.',
        scale: { card: 1.5, skills: 1.1, thumb: 1.45 },
        render: ({ freeze }) => <HeartbeatGlyph {...STATIC} animationToggle={!freeze} forceReducedMotion={freeze} />,
    },
    snapshots: {
        title: 'C9 · BACKUP SNAPSHOT — durability / retention',
        story: 'the DB peels off a snapshot tile that flies to the tray and lands on the stack, while the oldest tile fades out of the retention window.',
        scale: { card: 1.1, skills: 0.82, thumb: 1.05 },
        render: ({ freeze }) => <BackupSnapshot {...STATIC} animationToggle={!freeze} forceReducedMotion={freeze} />,
    },
}

/**
 * The exact rig ProjectCard and Skills mount, not a convenience
 * `ambientLight + directionalLight` pair. A glyph signed off under flat lighting
 * tells you nothing: the ceramic recipe in §2 is defined by the studio IBL, and
 * the crevices these glyphs are full of only read once N8AO is in the chain.
 */
function Stage({ dark, children }: { dark?: boolean; children: ReactNode }) {
    return (
        <>
            <StudioLights variant={dark ? 'dark' : 'light'} shadowExtent={2.5} shadowMapSize={512} />
            {children}
            <StudioEffects tier="card" aoRadius={0.4} aoIntensity={2.2} />
        </>
    )
}

/**
 * Mirrors `ProjectObject`'s presentation pose (fixed forward tilt + gentle yaw
 * rock) without importing it, so glyphs can be posed before they're added to its
 * type map.
 */
function Pose({ children, yaw0 = 0.35, still = false }: { children: ReactNode; yaw0?: number; still?: boolean }) {
    const spin = useRef<THREE.Group>(null)
    useFrame((state) => {
        if (!spin.current) return
        spin.current.rotation.y = yaw0 + (still ? 0 : Math.sin(state.clock.elapsedTime * 0.5) * 0.3)
    })
    return (
        <group rotation={[0.42, 0, 0]}>
            <group ref={spin}>{children}</group>
        </group>
    )
}

function Panel({ label, dark, height = 300, children }: {
    label: string; dark?: boolean; height?: number; children: ReactNode
}) {
    return (
        <div style={{ background: dark ? '#000' : '#e5e7eb', borderRadius: 16, height, position: 'relative', overflow: 'hidden' }}>
            <div
                style={{
                    position: 'absolute', top: 10, left: 14, zIndex: 1,
                    fontFamily: 'monospace', fontSize: 11, letterSpacing: 0.5,
                    color: dark ? '#fff' : '#111', opacity: 0.7,
                }}
            >
                {label}
            </div>
            <div
                style={{
                    width: '100%', height: '100%',
                    // the Skills section wraps its objects in this spotlight gradient
                    background: dark
                        ? 'radial-gradient(135% 120% at 50% 60%, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0.10) 38%, rgba(255,255,255,0.03) 62%, rgba(255,255,255,0) 82%)'
                        : undefined,
                }}
            >
                {children}
            </div>
        </div>
    )
}

const mono = { fontFamily: 'monospace' } as const

export default function PlaygroundPage() {
    const [id, setId] = useState<GlyphId>('autoscaler')
    // Forces the components' reduced-motion branch without touching OS settings,
    // so the resting frames can be signed off here.
    const [freeze, setFreeze] = useState(false)
    const g = GLYPHS[id]

    return (
        // border-box matters: without it the 18px padding is added OUTSIDE 100% width,
        // which overflows the viewport and lets the site's body colour show through.
        <div style={{ ...mono, padding: 18, background: '#e9eaec', minHeight: '100vh', width: '100%', boxSizing: 'border-box' }}>
            <header style={{ marginBottom: 18 }}>
                <h1 style={{ fontSize: 15, margin: 0 }}>3D GLYPH PLAYGROUND</h1>
                <p style={{ fontSize: 11, color: '#555', margin: '4px 0 12px' }}>
                    Priority A from docs/3d-components-roadmap.md. Nothing here is wired into the live site.
                </p>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {(Object.keys(GLYPHS) as GlyphId[]).map((key) => (
                        <button
                            key={key}
                            onClick={() => setId(key)}
                            style={{
                                ...mono, fontSize: 12, padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
                                border: '1px solid #b9bcc2',
                                background: key === id ? '#111' : '#f4f4f5',
                                color: key === id ? '#fff' : '#111',
                            }}
                        >
                            {key}
                        </button>
                    ))}
                    <label style={{ fontSize: 12, cursor: 'pointer', marginLeft: 12 }}>
                        <input type="checkbox" checked={freeze} onChange={(e) => setFreeze(e.target.checked)} />
                        {' '}simulate prefers-reduced-motion (hold the resting frame)
                    </label>
                </div>
            </header>

            <h2 style={{ fontSize: 13, margin: '0 0 2px', letterSpacing: 1 }}>{g.title}</h2>
            <p style={{ fontSize: 11, color: '#555', margin: '0 0 12px', maxWidth: 900 }}>{g.story}</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <Panel label="project-card context · light bg, camera z=5">
                    <Canvas shadows frameloop="always" dpr={[1, 1.5]} camera={{ position: [0, 0, 5], fov: 50 }}>
                        <Stage>
                            <group scale={g.scale.card}>
                                <Pose still={freeze}>{g.render({ freeze })}</Pose>
                            </group>
                        </Stage>
                    </Canvas>
                </Panel>
                <Panel label="skills context · black bg + spotlight, camera z=4" dark>
                    <Canvas shadows frameloop="always" dpr={[1, 1.5]} camera={{ position: [0, 0, 4], fov: 50 }}>
                        <Stage dark>
                            <group scale={g.scale.skills}>
                                <Pose still={freeze}>{g.render({ freeze })}</Pose>
                            </group>
                        </Stage>
                    </Canvas>
                </Panel>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 12, alignItems: 'start' }}>
                <div>
                    <div style={{ fontSize: 11, color: '#555', marginBottom: 6 }}>120px legibility</div>
                    <div style={{ width: 120, height: 120, borderRadius: 12, overflow: 'hidden', background: '#e5e7eb' }}>
                        <Canvas shadows frameloop="always" dpr={[1, 2]} camera={{ position: [0, 0, 5], fov: 50 }}>
                            <Stage>
                                <group scale={g.scale.thumb}>
                                    <Pose still={freeze}>{g.render({ freeze })}</Pose>
                                </group>
                            </Stage>
                        </Canvas>
                    </div>
                </div>

                <div>
                    <div style={{ fontSize: 11, color: '#555', marginBottom: 6 }}>
                        {g.today
                            ? `in production today · ${g.replaces} (the node this would replace)`
                            : 'no existing node — this concept is currently text-only in the Principles section'}
                    </div>
                    {g.today ? (
                        <Panel label={g.replaces ?? ''} height={220}>
                            <Canvas shadows frameloop="always" dpr={[1, 1.5]} camera={{ position: [0, 0, 5], fov: 50 }}>
                                <Stage>
                                    <Pose yaw0={0.6} still>
                                        <group scale={1.3}>{g.today}</group>
                                    </Pose>
                                </Stage>
                            </Canvas>
                        </Panel>
                    ) : (
                        <div
                            style={{
                                height: 220, borderRadius: 16, background: '#e5e7eb',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 11, color: '#8b8f96', padding: 24, textAlign: 'center',
                            }}
                        >
                            new component — nothing to compare against
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
