'use client'

import { Canvas } from '@react-three/fiber'
import { ProjectObject, type ObjectType } from '@/components/three/ProjectObject'

// Mirrors the two real contexts: project cards (light bg, camera z=5) and the
// skills columns (black bg, camera z=4, scale 0.7).
const PROJECT_CARDS: { name: string; type: ObjectType }[] = [
    { name: 'QUIZBUZZ (monitor)', type: 'monitor' },
    { name: 'SMARTFORMFLOW (forms)', type: 'forms' },
]
const SKILL_CARDS: { name: string; type: ObjectType }[] = [
    { name: 'SYSTEMS', type: 'systems' },
    { name: 'BACKEND', type: 'backend' },
    { name: 'INFRA', type: 'infra' },
]

function Lights() {
    return (
        <>
            <ambientLight intensity={0.7} />
            <directionalLight position={[2, 3, 2]} intensity={1} />
        </>
    )
}

export default function ObjectsLabPage() {
    return (
        <div style={{ padding: 12, background: '#e9eaec' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                {PROJECT_CARDS.map((c) => (
                    <div key={c.type} style={{ background: '#e5e7eb', borderRadius: 16, height: 280, position: 'relative' }}>
                        <div style={{ position: 'absolute', top: 8, left: 12, zIndex: 1, fontFamily: 'monospace', fontSize: 12 }}>{c.name}</div>
                        <Canvas frameloop="always" dpr={[1, 1.5]} camera={{ position: [0, 0, 5], fov: 50 }}>
                            <Lights />
                            <ProjectObject type={c.type} />
                        </Canvas>
                    </div>
                ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                {SKILL_CARDS.map((c) => (
                    <div key={c.type} style={{ background: '#000000', borderRadius: 16, padding: 20, position: 'relative' }}>
                        <div style={{ position: 'absolute', top: 8, left: 12, zIndex: 1, fontFamily: 'monospace', fontSize: 12, color: '#fff' }}>{c.name}</div>
                        <div
                            style={{
                                height: 160,
                                borderRadius: 16,
                                overflow: 'hidden',
                                border: '1px solid rgba(255,255,255,0.09)',
                                background:
                                    'radial-gradient(120% 115% at 50% 42%, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.035) 45%, rgba(255,255,255,0) 78%)',
                            }}
                        >
                            <Canvas frameloop="always" dpr={[1, 1.5]} camera={{ position: [0, 0, 4], fov: 50 }}>
                                <Lights />
                                <ProjectObject type={c.type} scale={0.7} />
                            </Canvas>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
