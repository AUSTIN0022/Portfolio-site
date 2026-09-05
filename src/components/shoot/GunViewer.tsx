'use client'

import * as React from 'react'
import { Canvas, type ThreeElements, useFrame } from '@react-three/fiber'
import { useGLTF, useProgress } from '@react-three/drei'
import type { Group } from 'three'

type GroupProps = ThreeElements['group']

type GunModelProps = GroupProps & {
  url: string
}

function GunModel({ url, ...props }: GunModelProps) {
  const gltf = useGLTF(url)
  return <primitive object={gltf.scene} {...props} />
}

// `aim` is a mutable ref, not React state: the caller (FloatingShootToggle)
// writes to it on every `pointermove` — dozens of times a second while shoot
// mode is on. Before this fix those coordinates lived in `useState`, so every
// mouse pixel re-rendered this whole Canvas tree (this component sits at the
// app root, mounted on every page). `useFrame` below already runs once per
// rendered frame regardless of React's render cycle, so reading the latest
// aim straight out of the ref each frame gets the same visual result — the
// gun still tracks the cursor smoothly — with zero React re-renders in the
// hot path. This is what was producing the reported "hovering anywhere causes
// repeated re-renders" behavior; a plain CSS :hover (e.g. `.btn-sketch`) was
// never the cause, but any mouse movement anywhere on the page while shoot
// mode was on (it persists across visits via localStorage) re-rendered this
// tree, which read as jitter well beyond just this gun HUD.
type AimRef = React.RefObject<{ x: number; y: number }>

type GunViewerProps = {
  aimRef: AimRef
}

function GunRig({ aimRef }: { aimRef: AimRef }): React.JSX.Element {
  const yawRef = React.useRef<Group | null>(null)
  const pitchRef = React.useRef<Group | null>(null)
  // Neutral facing direction when cursor is centered.
  const baseY = Math.PI * 1.2
  const baseX = -0.08

  useFrame(() => {
    const yawGroup = yawRef.current
    const pitchGroup = pitchRef.current
    if (!yawGroup || !pitchGroup) return

    const { x: aimX, y: aimY } = aimRef.current

    // Keep both sides closer in feel, but retain slight right bias.
    const yawLeftStrength = 1.2
    const yawRightStrength = 1.2
    const yawOffset = aimX < 0 ? -aimX * yawLeftStrength : -(aimX * yawRightStrength)

    const targetY = baseY + yawOffset
    const pitchUpStrength = 0.5
    const pitchDownStrength = 0.58
    const pitchOffset = aimY < 0 ? -aimY * pitchUpStrength : -(aimY * pitchDownStrength)
    const targetX = baseX - pitchOffset

    yawGroup.rotation.y += (targetY - yawGroup.rotation.y) * 0.12
    pitchGroup.rotation.x += (targetX - pitchGroup.rotation.x) * 0.12
  })

  return (
    <group ref={yawRef}>
      <group ref={pitchRef}>
        <GunModel url="/paintball_gun.glb" scale={1.2} position={[0, -0.03, 0]} />
      </group>
    </group>
  )
}

export default function GunViewer({ aimRef }: GunViewerProps): React.JSX.Element {
  // Tracks THREE's global loading manager instead of the in-canvas Suspense
  // fallback: r3f's Suspense boundary can resolve/retry faster than the
  // fallback paints, so it's not a reliable place to show loading state for a
  // ~10MB GLB fetch. Lifted above the Canvas (useProgress reads a global
  // store, not R3F context, so this works outside it) so the spinner and the
  // canvas can cross-fade off the same signal instead of the model just
  // popping in the instant loading finishes.
  const active = useProgress((state) => state.active)
  // Initialized from `active` rather than fixed defaults: if the GLB is
  // already cached/preloaded by the time this mounts, skip the fade dance
  // entirely instead of flashing a spinner that has nothing to wait for.
  const [showOverlay, setShowOverlay] = React.useState(active)
  const [canvasReady, setCanvasReady] = React.useState(!active)

  React.useEffect(() => {
    if (active) {
      setShowOverlay(true)
      setCanvasReady(false)
      return
    }
    setCanvasReady(true)
    // Keep the spinner mounted just long enough to fade out (matches its own
    // transition below) instead of unmounting on the same tick the model
    // appears.
    const id = window.setTimeout(() => setShowOverlay(false), 150)
    return () => window.clearTimeout(id)
  }, [active])

  return (
    <div
      style={{
        height: '320px',
        width: 'min(92vw, 480px)',
        overflow: 'visible',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      <div style={{ position: 'relative', height: '300px', width: 'min(88vw, 384px)' }}>
        <Canvas
          style={{ opacity: canvasReady ? 1 : 0, transition: 'opacity 0.2s ease-out' }}
          dpr={[1, 1.5]}
          camera={{ position: [1.75, 0.85, 2.1], fov: 36 }}
          gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
        >
          <React.Suspense fallback={null}>
            <ambientLight intensity={0.9} />
            <directionalLight position={[2, 2, 2]} intensity={1.2} />
            <GunRig aimRef={aimRef} />
          </React.Suspense>
        </Canvas>
        {showOverlay && (
          <div
            className="shoot-gun-loading"
            style={{ opacity: active ? 1 : 0, transition: 'opacity 150ms ease-out' }}
            aria-hidden="true"
          >
            <div className="shoot-spinner" />
          </div>
        )}
      </div>
    </div>
  )
}

useGLTF.preload('/paintball_gun.glb')
