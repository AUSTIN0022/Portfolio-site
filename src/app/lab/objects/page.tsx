'use client'

import Image from 'next/image'

const ITEMS = [
    { name: 'QUIZBUZZ (monitor)', src: '/item-images/monitor.webp' },
    { name: 'SMARTFORMFLOW (laptop)', src: '/item-images/laptop.webp' },
    { name: 'SYSTEMS (queue)', src: '/item-images/queue.webp' },
    { name: 'BACKEND (app-server)', src: '/item-images/app-server.webp' },
    { name: 'INFRA (instance)', src: '/item-images/instance.webp' },
]

export default function ObjectsLabPage() {
    return (
        <div style={{ padding: 24, background: '#e9eaec', minHeight: '100vh' }}>
            <h1 style={{ fontFamily: 'monospace', fontSize: 16, marginBottom: 16 }}>COMPONENT VISUALS GALLERY</h1>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                {ITEMS.map((item) => (
                    <div key={item.name} style={{ background: '#fff', borderRadius: 16, padding: 20, height: 260, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ fontFamily: 'monospace', fontSize: 12, marginBottom: 12, width: '100%' }}>{item.name}</div>
                        <div style={{ position: 'relative', width: '80%', height: '80%' }}>
                            <Image src={item.src} alt={item.name} fill style={{ objectFit: 'contain' }} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
