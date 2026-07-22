'use client'

import Image from 'next/image'

export default function StorageLabPage() {
    return (
        <div style={{ minHeight: '100vh', background: '#e5e7eb', padding: 24 }}>
            <h1 style={{ fontFamily: 'monospace', fontSize: 16, marginBottom: 16 }}>STORAGE VISUAL LAB</h1>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, height: '80vh' }}>
                <div style={{ position: 'relative', background: '#eceef0', borderRadius: 12, overflow: 'hidden', padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ position: 'relative', width: '80%', height: '80%' }}>
                        <Image src="/item-images/storage.jpeg" alt="Storage" fill style={{ objectFit: 'contain' }} />
                    </div>
                </div>
                <div style={{ position: 'relative', background: '#eceef0', borderRadius: 12, overflow: 'hidden', padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ position: 'relative', width: '80%', height: '80%' }}>
                        <Image src="/item-images/storage-pro.jpeg" alt="Storage Pro" fill style={{ objectFit: 'contain' }} />
                    </div>
                </div>
            </div>
        </div>
    )
}
