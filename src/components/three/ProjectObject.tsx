'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useReducedMotion } from 'framer-motion'
import * as THREE from 'three'

export type ObjectType = 'monitor' | 'forms' | 'systems' | 'backend' | 'infra'

export function ProjectObject({ type, scale = 1 }: { type: ObjectType; scale?: number }) {
  const groupRef = useRef<THREE.Group>(null)
  const reduceMotion = useReducedMotion()

  useFrame(() => {
    if (!reduceMotion && groupRef.current) groupRef.current.rotation.y += 0.004
  })

  const stoneMat = { color: '#d4cfc9', roughness: 0.85, metalness: 0 }

  return (
    <group ref={groupRef} scale={scale}>
      {type === 'monitor' && (
        <>
          <mesh position={[0, 0.3, 0]}>
            <boxGeometry args={[2.2, 1.4, 0.15]} />
            <meshStandardMaterial {...stoneMat} />
          </mesh>
          <mesh position={[0, 0.3, 0.09]}>
            <boxGeometry args={[1.9, 1.1, 0.02]} />
            <meshStandardMaterial color="#d1ffca" emissive="#d1ffca" emissiveIntensity={0.25} />
          </mesh>
          <mesh position={[0, -0.5, 0]}>
            <boxGeometry args={[0.3, 0.4, 0.15]} />
            <meshStandardMaterial {...stoneMat} />
          </mesh>
        </>
      )}

      {type === 'forms' && (
        <>
          {[0, 0.5, -0.5].map((y, i) => (
            <mesh key={i} position={[i * 0.1, y, 0]} rotation={[0, 0, i * 0.05]}>
              <boxGeometry args={[1.6, 0.25, 1.2]} />
              <meshStandardMaterial color={i === 1 ? '#fff100' : '#d4cfc9'} emissive={i === 1 ? '#fff100' : '#000000'} emissiveIntensity={i === 1 ? 0.25 : 0} roughness={0.8} />
            </mesh>
          ))}
        </>
      )}

      {type === 'systems' && (
        <>
          <mesh position={[0, 0.5, 0]}>
            <boxGeometry args={[0.7, 0.7, 0.7]} />
            <meshStandardMaterial color="#d1ffca" emissive="#d1ffca" emissiveIntensity={0.2} />
          </mesh>
          <mesh position={[-0.7, -0.3, 0.2]}>
            <boxGeometry args={[0.6, 0.6, 0.6]} />
            <meshStandardMaterial {...stoneMat} />
          </mesh>
          <mesh position={[0.7, -0.3, -0.2]}>
            <boxGeometry args={[0.6, 0.6, 0.6]} />
            <meshStandardMaterial color="#fff100" emissive="#fff100" emissiveIntensity={0.25} />
          </mesh>
        </>
      )}

      {type === 'backend' && (
        <>
          {[0, 0.5, 1.0].map((y, i) => (
            <mesh key={i} position={[0, y - 0.5, 0]}>
              <cylinderGeometry args={[0.7, 0.7, 0.35, 24]} />
              <meshStandardMaterial {...stoneMat} />
            </mesh>
          ))}
        </>
      )}

      {type === 'infra' && (
        <>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[1.4, 1.4, 1.4]} />
            <meshStandardMaterial {...stoneMat} wireframe={false} />
          </mesh>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[1.6, 1.6, 1.6]} />
            <meshStandardMaterial color="#e040fb" emissive="#e040fb" emissiveIntensity={0.15} wireframe />
          </mesh>
        </>
      )}
    </group>
  )
}
