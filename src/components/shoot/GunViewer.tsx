'use client'

import * as React from 'react'
import { Canvas, type ThreeElements, useFrame } from '@react-three/fiber'
import { Html, useGLTF } from '@react-three/drei'
import type { Group } from 'three'

type GroupProps = ThreeElements['group']

type GunModelProps = GroupProps & {
  url: string
}

function GunModel({ url, ...props }: GunModelProps) {
  const gltf = useGLTF(url)
  return <primitive object={gltf.scene} {...props} />
}

type GunViewerProps = {
  aimX: number
  aimY: number
}

function ModelLoadingFallback(): React.JSX.Element {
  return (
    <Html center>
      <div
        style={{
          height: '20px',
          width: '20px',
          borderRadius: '50%',
          border: '2px solid rgba(0,0,0,0.15)',
          borderTopColor: 'rgba(0,0,0,0.5)',
          animation: 'spin 0.8s linear infinite',
        }}
      />
    </Html>
  )
}

function GunRig({ aimX, aimY }: GunViewerProps): React.JSX.Element {
  const yawRef = React.useRef<Group | null>(null)
  const pitchRef = React.useRef<Group | null>(null)
  // Neutral facing direction when cursor is centered.
  const baseY = Math.PI * 1.2
  const baseX = -0.08

  useFrame(() => {
    const yawGroup = yawRef.current
    const pitchGroup = pitchRef.current
    if (!yawGroup || !pitchGroup) return

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

export default function GunViewer({ aimX, aimY }: GunViewerProps): React.JSX.Element {
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
      <div style={{ height: '300px', width: 'min(88vw, 384px)' }}>
        <Canvas
          dpr={[1, 1.5]}
          camera={{ position: [1.75, 0.85, 2.1], fov: 36 }}
          gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
        >
          <React.Suspense fallback={<ModelLoadingFallback />}>
            <ambientLight intensity={0.9} />
            <directionalLight position={[2, 2, 2]} intensity={1.2} />
            <GunRig aimX={aimX} aimY={aimY} />
          </React.Suspense>
        </Canvas>
      </div>
    </div>
  )
}

useGLTF.preload('/paintball_gun.glb')
