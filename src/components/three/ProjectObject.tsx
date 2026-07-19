'use client'

import { useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { useReducedMotion } from 'framer-motion'
import * as THREE from 'three'
import Database from '@/components/3d/Database'
import Workers from '@/components/3d/Workers'
import Queue from '@/components/3d/Queue'
import Laptop from '@/components/3d/Laptop'
import LoadBalancer from '@/components/3d/LoadBalancer'

export type ObjectType = 'monitor' | 'forms' | 'systems' | 'backend' | 'infra'

// Render each icon with its own polished infrastructure component instead of the
// old crude placeholder geometry. Labels/hover/self-animation are off — the card
// already names the item, and the wrapper below owns the presentation spin.
const STATIC = { showLabel: false, floating: false, interactive: false, animationToggle: false } as const

// Per-type component + scale, vertical offset, and a base yaw. `yaw0` is the resting
// angle the object rocks around: a ~45° corner for the blocks (clean isometric read of
// top + two faces) and a front-facing angle for the laptop (its screen must face us).
const NODES: Record<ObjectType, { el: ReactNode; scale: number; y: number; yaw0: number }> = {
    monitor: { el: <Laptop {...STATIC} />, scale: 1.3, y: -0.1, yaw0: -0.5 }, //  QUIZBUZZ — real-time platform
    forms: { el: <Queue {...STATIC} />, scale: 1.3, y: -0.2, yaw0: 0.15 }, //     SMARTFORMFLOW — async/forms (front-facing so the stacked tiers read)
    systems: { el: <Workers {...STATIC} />, scale: 1.3, y: 0, yaw0: 0.6 }, //     distributed queues/pipelines
    backend: { el: <Database {...STATIC} />, scale: 1.25, y: -0.1, yaw0: 0.6 }, // APIs + PostgreSQL
    infra: { el: <LoadBalancer {...STATIC} />, scale: 1.3, y: 0, yaw0: 0.6 }, //  AWS auto-scaling / infra
}

/**
 * The small 3D showcase object inside a project / skill card. A fixed forward tilt
 * reveals the top faces (the card cameras look straight on), and the object gently
 * ROCKS around its resting yaw for a subtle 3D life without ever swinging to an
 * unflattering back view. Motion is paused under reduced motion.
 */
export function ProjectObject({ type, scale = 1 }: { type: ObjectType; scale?: number }) {
    const spinRef = useRef<THREE.Group>(null)
    const reduceMotion = useReducedMotion()
    const node = NODES[type]

    useFrame((state) => {
        if (!spinRef.current) return
        const t = state.clock.elapsedTime
        spinRef.current.rotation.y = node.yaw0 + (reduceMotion ? 0 : Math.sin(t * 0.5) * 0.3)
    })

    return (
        <group scale={scale}>
            {/* tilt the whole assembly so a head-on camera sees the tops */}
            <group rotation={[0.42, 0, 0]}>
                <group ref={spinRef} position={[0, node.y, 0]} scale={node.scale}>
                    {node.el}
                </group>
            </group>
        </group>
    )
}
