'use client'

import Image from 'next/image'

const GLYPHS = [
    { title: 'LOAD BALANCER', src: '/item-images/load-balancer.webp' },
    { title: 'API LAYER', src: '/item-images/api-layer.webp' },
    { title: 'APP SERVER', src: '/item-images/app-server.webp' },
    { title: 'DATABASE', src: '/item-images/database.webp' },
    { title: 'QUEUE', src: '/item-images/queue.webp' },
    { title: 'CACHE', src: '/item-images/cache.webp' },
    { title: 'WORKERS', src: '/item-images/workers.webp' },
    { title: 'INSTANCE', src: '/item-images/instance.webp' },
    { title: 'MONITORING', src: '/item-images/monitoring.webp' },
    { title: 'SPEAKER', src: '/item-images/speaker.webp' },
]

export default function PlaygroundPage() {
    return (
        <div style={{ padding: 24, background: '#111', color: '#fff', minHeight: '100vh', fontFamily: 'monospace' }}>
            <h1 style={{ fontSize: 18, marginBottom: 8 }}>COMPONENT ASSETS PLAYGROUND</h1>
            <p style={{ fontSize: 12, color: '#888', marginBottom: 24 }}>Pre-rendered transparent PNG component assets (Optimized image pipeline)</p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
                {GLYPHS.map((g) => (
                    <div key={g.title} style={{ background: '#1c1c1e', borderRadius: 16, padding: 16, height: 220, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ fontSize: 11, color: '#aaa', width: '100%', marginBottom: 12 }}>{g.title}</div>
                        <div style={{ position: 'relative', width: '80%', height: '80%' }}>
                            <Image src={g.src} alt={g.title} fill style={{ objectFit: 'contain' }} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
