'use client'

import { HeroDiagram } from '@/components/sections/HeroDiagram'

export default function HeroLabPage() {
    return (
        <div style={{ width: '100vw', height: '100vh', background: '#e9eaec', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '600px', height: '600px' }}>
                <HeroDiagram />
            </div>
        </div>
    )
}
