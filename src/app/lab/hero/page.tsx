'use client'

import { Canvas } from '@react-three/fiber'
import { HeroScene } from '@/components/three/HeroScene'

/**
 * Dev-only harness for the hero infrastructure diagram. Renders HeroScene in a
 * RAW Canvas with frameloop="always" so it draws even when the preview browser
 * reports document.hidden (which gates the production LazyCanvas). Not linked
 * from nav — visit /lab/hero directly.
 */
export default function HeroLabPage() {
    return (
        <div style={{ width: '100vw', height: '100vh', background: '#e9eaec' }}>
            <Canvas frameloop="always" dpr={[1, 1.5]} camera={{ position: [4.9, 18.8, 35], fov: 26 }}>
                <HeroScene />
            </Canvas>
        </div>
    )
}
