'use client'

import { useThree, useFrame } from '@react-three/fiber'
import { EffectComposer, Bloom, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { useEffect, useMemo, useRef, Fragment } from 'react'
import * as THREE from 'three'
import AppServer from '@/components/3d/AppServer'
import APILayer from '@/components/3d/APILayer'
import Queue from '@/components/3d/Queue'
import Database from '@/components/3d/Database'
import Cache from '@/components/3d/Cache'
import Monitoring from '@/components/3d/Monitoring'
import Workers from '@/components/3d/Workers'
import Storage from '@/components/3d/Storage'

// ---- Adaptive framing --------------------------------------------------------
// The hero canvas's aspect ratio swings widely across breakpoints (~0.55 portrait
// right at the 1024px two-column boundary, up to ~2.1 on mobile). A single fixed
// camera clips on the narrow end or looks tiny on the wide end. Instead we fix the
// camera's DIRECTION (azimuth + elevation) for a consistent isometric look, and
// solve for the DISTANCE that fits the diagram for whatever aspect the canvas
// currently has — recomputed on every resize.
const CAM_AZ = (8 * Math.PI) / 180
const CAM_EL = (36 * Math.PI) / 180
const CAM_FOV = 26
// Allow content to reach a hair past the frustum edge so the diagram fills more
// of the frame (a subtle zoom-in, as requested).
const FIT_MARGIN = 1.08
const CAM_DIR = new THREE.Vector3(
    Math.cos(CAM_EL) * Math.sin(CAM_AZ),
    Math.sin(CAM_EL),
    Math.cos(CAM_EL) * Math.cos(CAM_AZ)
)

// Bounding half-extents of every node, used to solve the minimal camera distance
// that keeps everything in frame. Mirrors the node layout below — keep in sync.
// Grid tightened again (side ring ±3.0, rows ±2.9) so nodes sit closer and the
// auto-fit dollies the camera in for a more filled, zoomed-in frame.
const CONTENT_NODES: { p: [number, number]; rx: number; rz: number }[] = [
    { p: [0, 0], rx: 1.1, rz: 1.1 }, // APP SERVER
    { p: [-1.6, -2.9], rx: 0.82, rz: 0.82 }, // API LAYER
    { p: [3.0, -2.9], rx: 0.62, rz: 0.5 }, // QUEUE
    { p: [-3.0, 0], rx: 0.67, rz: 0.67 }, // CACHE
    { p: [3.0, 0], rx: 0.68, rz: 0.68 }, // DATABASE
    { p: [-3.0, 2.9], rx: 0.6, rz: 0.58 }, // STORAGE
    { p: [0, 2.9], rx: 0.85, rz: 0.85 }, // WORKERS
    { p: [3.0, 2.9], rx: 0.62, rz: 0.62 }, // MONITORING
]
const CONTENT_POINTS: THREE.Vector3[] = CONTENT_NODES.flatMap((n) =>
    [-n.rx, n.rx].flatMap((dx) =>
        [-n.rz, n.rz].flatMap((dz) =>
            [-0.2, 0.9].map((dy) => new THREE.Vector3(n.p[0] + dx, dy, n.p[1] + dz))
        )
    )
)

/**
 * Aims and dollies the camera so the whole diagram stays in frame at the canvas's
 * current aspect ratio. LazyCanvas exposes neither a lookAt nor a responsive
 * camera, so this reaches into the canvas tree to drive both.
 */
function FitCamera() {
    const { camera, size, invalidate } = useThree()
    useEffect(() => {
        const persp = camera as THREE.PerspectiveCamera
        persp.fov = CAM_FOV
        persp.aspect = size.width / size.height

        // Binary-search the smallest distance along CAM_DIR where every content
        // point still projects inside a small margin of the NDC frustum.
        let lo = 5
        let hi = 200
        for (let i = 0; i < 30; i++) {
            const dist = (lo + hi) / 2
            persp.position.copy(CAM_DIR).multiplyScalar(dist)
            persp.lookAt(0, 0, 0)
            persp.updateMatrixWorld()
            persp.updateProjectionMatrix()
            const fits = CONTENT_POINTS.every((p) => {
                const v = p.clone().project(persp)
                return Math.abs(v.x) <= FIT_MARGIN && Math.abs(v.y) <= FIT_MARGIN
            })
            if (fits) hi = dist
            else lo = dist
        }
        persp.position.copy(CAM_DIR).multiplyScalar(hi)
        persp.lookAt(0, 0, 0)
        persp.updateProjectionMatrix()
        invalidate()
    }, [camera, size.width, size.height, invalidate])
    return null
}

// Nodes hold still (no float / self-rotation) so pipes stay welded to their faces.
// Axis-aligned rotation [0,0,0] — the isometric look comes from the CAMERA azimuth,
// which keeps every block face square to the world axes so pipes meet them head-on.
const AXIS: [number, number, number] = [0, 0, 0]
const STATIC = {
    rotation: AXIS,
    floating: false,
    animationToggle: false,
    interactive: false,
} as const

// Keep every block's base on the same ground plane after down-scaling.
// base sits at local y = -0.24; world base = y + (-0.24 * scale), so y = -0.24*(1-scale).
const baseY = (scale: number) => -0.24 * (1 - scale)

// ---- PIPE NETWORK ----------------------------------------------------------
// Routes are Manhattan poly-lines on the ground plane ([x, z] at PIPE_Y). Each
// corner is rounded with a fillet so the tube reads as a smoothly-bent pipe (like
// the reference illustration) rather than a hard right angle. Ceramic connector
// blocks sit centred on each BEND — the black squares in the sketch — not on the
// node faces where the pipe plugs in.
const PIPE_Y = 0
const PIPE_RADIUS = 0.052 // a touch thicker so it reads as a rounded tube, not a line
const FILLET = 0.35
type Pt = [number, number]

/**
 * Builds a smooth curve through a Manhattan poly-line: straight segments joined by
 * rounded (quadratic-bezier) fillets at each interior corner. Skips zero-length
 * pieces so TubeGeometry's arc-length sampling never divides by zero.
 */
function roundedCurve(points: THREE.Vector3[], fillet: number): THREE.CurvePath<THREE.Vector3> {
    const path = new THREE.CurvePath<THREE.Vector3>()
    let cursor = points[0].clone()
    for (let i = 1; i < points.length - 1; i++) {
        const curr = points[i]
        const inDir = new THREE.Vector3().subVectors(curr, points[i - 1])
        const outDir = new THREE.Vector3().subVectors(points[i + 1], curr)
        const r = Math.min(fillet, inDir.length() * 0.5, outDir.length() * 0.5)
        inDir.normalize()
        outDir.normalize()
        const start = curr.clone().addScaledVector(inDir, -r)
        const end = curr.clone().addScaledVector(outDir, r)
        if (cursor.distanceTo(start) > 1e-4) path.add(new THREE.LineCurve3(cursor.clone(), start.clone()))
        path.add(new THREE.QuadraticBezierCurve3(start.clone(), curr.clone(), end.clone()))
        cursor = end
    }
    const last = points[points.length - 1]
    if (cursor.distanceTo(last) > 1e-4) path.add(new THREE.LineCurve3(cursor.clone(), last.clone()))
    return path
}

/**
 * Frosted ceramic pipe. Transmission is kept LOW so diffuse shading dominates — that
 * light/shadow gradient across the tube is what makes it read as a rounded pipe rather
 * than a flat white line (high transmission refracted the pale background through the
 * tube and washed the form out). A clearcoat adds the glossy specular highlight line
 * along the top of the tube; a little translucency remains so the bright bloomed packet
 * still glows through from inside.
 */
function PipeMaterial() {
    return (
        <meshPhysicalMaterial
            color="#e4e2d9"
            roughness={0.34}
            metalness={0}
            transmission={0.4}
            thickness={0.5}
            ior={1.4}
            clearcoat={0.6}
            clearcoatRoughness={0.4}
            transparent
            opacity={0.94}
        />
    )
}

/**
 * Ceramic coupling that wraps the pipe at a joint — a short ROUND sleeve (a pipe
 * union / nut) centred ON the tube and rotated so its axis runs along the pipe, so
 * it hugs the tube like a real fitting instead of floating beside it as a loose cube.
 * `dir` is the pipe's tangent (in the XZ plane) at that point.
 */
function Joint({ at, dir }: { at: Pt; dir?: [number, number] }) {
    const quaternion = useMemo(() => {
        const d = dir ? new THREE.Vector3(dir[0], 0, dir[1]) : new THREE.Vector3(1, 0, 0)
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())
        return [q.x, q.y, q.z, q.w] as [number, number, number, number]
    }, [dir])
    return (
        <mesh position={[at[0], PIPE_Y, at[1]]} quaternion={quaternion}>
            <cylinderGeometry args={[PIPE_RADIUS * 1.75, PIPE_RADIUS * 1.75, 0.12, 20]} />
            <meshStandardMaterial color="#f2f0e8" roughness={0.5} metalness={0} />
        </mesh>
    )
}

/**
 * Where the coupling sits at an interior corner, and which way it points. The rounded
 * fillet means the tube never passes through the sharp corner itself — it curves to
 * the INSIDE of the bend — so we place the coupling on the fillet's midpoint (the
 * t=0.5 point of the quadratic bezier), which lies exactly on the tube, and orient it
 * along the tube's tangent there (∝ inDir + outDir).
 */
function bendJoint(
    prev: THREE.Vector3,
    curr: THREE.Vector3,
    next: THREE.Vector3,
    fillet: number
): { pos: Pt; dir: [number, number] } {
    const inSeg = new THREE.Vector3().subVectors(curr, prev)
    const outSeg = new THREE.Vector3().subVectors(next, curr)
    const r = Math.min(fillet, inSeg.length() * 0.5, outSeg.length() * 0.5)
    const inDir = inSeg.clone().normalize()
    const outDir = outSeg.clone().normalize()
    // Bezier(0.5) = corner + 0.25·r·(outDir − inDir); tangent ∝ (inDir + outDir).
    const p = curr.clone().add(outDir.clone().sub(inDir).multiplyScalar(0.25 * r))
    const t = inDir.clone().add(outDir).normalize()
    return { pos: [p.x, p.z], dir: [t.x, t.z] }
}

/**
 * One full pipe run: a smoothly-bent tube plus a round coupling centred on every
 * INTERIOR corner (bends only — endpoints plug into node faces, so no joint there).
 */
function RoutePipe({ points }: { points: Pt[] }) {
    const v = useMemo(() => points.map(([x, z]) => new THREE.Vector3(x, PIPE_Y, z)), [points])
    const geom = useMemo(() => {
        const curve = roundedCurve(v, FILLET)
        const tubular = Math.max(16, Math.round(curve.getLength() * 10))
        return new THREE.TubeGeometry(curve, tubular, PIPE_RADIUS, 12, false)
    }, [v])
    return (
        <>
            <mesh geometry={geom}>
                <PipeMaterial />
            </mesh>
            {v.slice(1, -1).map((_, i) => {
                const j = bendJoint(v[i], v[i + 1], v[i + 2], FILLET)
                return <Joint key={i} at={j.pos} dir={j.dir} />
            })}
        </>
    )
}

// Poly-lines for each connection, transcribed from the top-down sketch. Each
// endpoint is the real scaled port on the named side of its node; interior points
// are the routed bends. Comments name which SIDE of each node the pipe meets.
const ROUTES: Pt[][] = [
    // API LAYER (bottom) → APP SERVER (north face). The ONE and ONLY pipe on the API
    // layer: a request lands here and is handed straight to the app server. Bends in
    // (down, right, down) since the API layer sits left of the hub.
    [[-1.6, -2.12], [-1.6, -1.4], [-0.5, -1.4], [-0.5, -1.0]],
    // QUEUE (left face) → APP SERVER (north face). Exits the queue's LEFT side and
    // heads toward the hub: left along the top, then drops into the north face.
    [[2.4, -2.9], [0.5, -2.9], [0.5, -1.0]],
    // CACHE (right) → APP SERVER (west face). Straight.
    [[-2.37, -0.25], [-1.0, -0.25]],
    // APP SERVER (east face) → DATABASE (left). Straight.
    [[1.0, -0.25], [2.35, -0.25]],
    // APP SERVER (west face, lower) → STORAGE (top). Drops in a column RIGHT of the
    // cache, runs below it, then up into STORAGE — mirrors the monitoring run so the
    // pipe never crosses the cache.
    [[-1.0, 0.6], [-1.9, 0.6], [-1.9, 2.2], [-3.0, 2.2], [-3.0, 2.35]],
    // APP SERVER (south face) → WORKERS (top). Straight down.
    [[0, 1.0], [0, 2.1]],
    // APP SERVER (east face, lower) → MONITORING (top). Drops in a column LEFT of the
    // database, runs below it, then up into MONITORING — never crosses the cylinder.
    [[1.0, 0.6], [1.9, 0.6], [1.9, 2.2], [3.0, 2.2], [3.0, 2.32]],
    // STORAGE (right) ↔ WORKERS (left). Peer link — a worker reads/writes storage.
    [[-2.45, 2.9], [-0.8, 2.9]],
    // WORKERS (right) ↔ MONITORING (left). Peer link — monitoring watches the workers.
    [[0.8, 2.9], [2.42, 2.9]],
]

// No standalone joints anymore — every connector is an interior bend of some route.
const EXTRA_JOINTS: Pt[] = []

// ---- DATA PACKET FLOW ------------------------------------------------------
// A glowing blue packet rides the request/response cycle THROUGH the translucent
// pipes: a request enters at the API layer, reaches the hub, the hub fans out to
// each service (and the packet returns), then the response travels back to the API
// layer — looping forever. The tour is an ordered list of "legs"; each leg is a pipe
// poly-line (a ROUTE, forward or reversed). Consecutive legs either share an endpoint
// (a U-turn at a leaf service) or are bridged by a short straight hop hidden inside a
// block (the packet being handled at the hub / a service).
const rev = (p: Pt[]): Pt[] => [...p].reverse()

function polyCurves(points: Pt[]): THREE.Curve<THREE.Vector3>[] {
    const v = points.map(([x, z]) => new THREE.Vector3(x, PIPE_Y, z))
    return roundedCurve(v, FILLET).curves
}

function buildFlowPath(): THREE.CurvePath<THREE.Vector3> {
    const R = ROUTES
    const legs: Pt[][] = [
        R[0], //            API → hub        (request in)
        rev(R[2]), //       hub → cache
        R[2], //            cache → hub
        R[3], //            hub → database
        rev(R[3]), //       database → hub
        rev(R[1]), //       hub → queue
        R[1], //            queue → hub
        R[4], //            hub → storage
        R[7], //            storage → workers   (peer link)
        R[8], //            workers → monitoring (peer link)
        rev(R[6]), //       monitoring → hub
        rev(R[0]), //       hub → API        (response back)
    ]
    const path = new THREE.CurvePath<THREE.Vector3>()
    const pt = (p: Pt) => new THREE.Vector3(p[0], PIPE_Y, p[1])
    let end: THREE.Vector3 | null = null
    for (const leg of legs) {
        const start = pt(leg[0])
        if (end && end.distanceTo(start) > 1e-4) path.add(new THREE.LineCurve3(end.clone(), start))
        for (const c of polyCurves(leg)) path.add(c)
        end = pt(leg[leg.length - 1])
    }
    const first = pt(legs[0][0])
    if (end && end.distanceTo(first) > 1e-4) path.add(new THREE.LineCurve3(end.clone(), first))
    return path
}

/** The glowing blue data packet, animated at constant speed along the flow path. */
function FlowPacket() {
    const ref = useRef<THREE.Group>(null)
    const { path, length } = useMemo(() => {
        const p = buildFlowPath()
        return { path: p, length: p.getLength() }
    }, [])
    const dist = useRef(0)
    useFrame((_, delta) => {
        if (!ref.current) return
        dist.current = (dist.current + delta * 2.4) % length
        ref.current.position.copy(path.getPointAt(dist.current / length))
    })
    return (
        <group ref={ref}>
            <mesh>
                <sphereGeometry args={[0.034, 16, 16]} />
                <meshStandardMaterial color="#1d4ed8" emissive="#3b82f6" emissiveIntensity={3} toneMapped={false} />
            </mesh>
            {/* soft additive halo so it reads as a light beam glowing through the pipe */}
            <mesh>
                <sphereGeometry args={[0.09, 16, 16]} />
                <meshBasicMaterial
                    color="#60a5fa"
                    transparent
                    opacity={0.35}
                    toneMapped={false}
                    blending={THREE.AdditiveBlending}
                    depthWrite={false}
                />
            </mesh>
            {/* a small blue light so the packet subtly lights the pipe it's inside */}
            <pointLight color="#3b82f6" intensity={0.5} distance={1.2} />
        </group>
    )
}

/**
 * Live R3F recreation of the hero infrastructure diagram as a request/response star:
 * APP SERVER is the sole hub. The API LAYER has exactly ONE pipe — straight to the
 * hub (a request in, handed off). Every other service (QUEUE, CACHE, DATABASE,
 * STORAGE, WORKERS, MONITORING) is its own spoke into the hub. On top of that, the
 * back-of-house services keep their peer links across the front row (STORAGE↔WORKERS,
 * WORKERS↔MONITORING) — a worker touches storage; monitoring watches the workers.
 */
export function HeroScene() {
    return (
        <>
            <FitCamera />

            {/* LIGHTING — assets ship none; without this the scene is black */}
            <ambientLight intensity={0.7} />
            <directionalLight position={[6, 12, 8]} intensity={1.1} />
            <directionalLight position={[-8, 6, -6]} intensity={0.4} />

            {/* ---- NODES ---- (3×3 grid; scales calibrated to the reference illustration) */}
            <AppServer position={[0, 0, 0]} scale={1.0} {...STATIC} />

            <APILayer position={[-1.6, 0, -2.9]} scale={0.78} {...STATIC} />
            <Queue position={[3.0, baseY(0.6), -2.9]} scale={0.6} {...STATIC} />

            <Cache position={[-3.0, baseY(0.63), 0]} scale={0.63} {...STATIC} />
            <Database position={[3.0, baseY(0.65), 0]} scale={0.65} {...STATIC} />

            <Storage position={[-3.0, baseY(0.55), 2.9]} scale={0.55} rotation={AXIS} />
            <Workers position={[0, baseY(0.8), 2.9]} scale={0.8} {...STATIC} />
            <Monitoring position={[3.0, baseY(0.58), 2.9]} scale={0.58} {...STATIC} />

            {/* ---- PIPES ---- */}
            {ROUTES.map((points, i) => (
                <Fragment key={`route${i}`}>
                    <RoutePipe points={points} />
                </Fragment>
            ))}
            {EXTRA_JOINTS.map((p, i) => (
                <Joint key={`xj${i}`} at={p} />
            ))}

            {/* ---- DATA PACKET ---- (request/response cycle flowing through the pipes) */}
            <FlowPacket />

            {/* Bloom makes ONLY the bright (>1 luminance, un-tonemapped) blue packet glow;
                the ceramic blocks stay below the threshold so they don't wash out.
                EffectComposer takes over rendering and drops R3F's default ACES tone
                mapping, so we re-apply it as the LAST pass — otherwise the light ceramic
                pipes render at near-white and disappear into the background. */}
            <EffectComposer>
                <Bloom
                    mipmapBlur
                    luminanceThreshold={1.0}
                    luminanceSmoothing={0.25}
                    intensity={1.8}
                    radius={0.75}
                />
                <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
            </EffectComposer>
        </>
    )
}
