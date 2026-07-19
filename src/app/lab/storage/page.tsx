'use client'

import { useState, useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { LazyCanvas } from '@/components/three/LazyCanvas'
import Storage from '@/components/3d/Storage'

function CameraAim({ target }: { target: [number, number, number] }) {
    const { camera } = useThree()
    useEffect(() => {
        camera.lookAt(...target)
    }, [camera, target])
    return null
}

/**
 * Dev-only split-screen validation harness for the Storage locker asset.
 * Left: live R3F render. Right: the supplied reference image. Not linked
 * from the site nav — visit /lab/storage directly.
 */
export default function StorageLabPage() {
    const [openDoor, setOpenDoor] = useState<0 | 1 | 2 | 3 | 4 | 5 | 6>(0)

    return (
        <div style={{ minHeight: '100vh', background: '#e5e7eb', padding: 24 }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                    <button
                        key={n}
                        onClick={() => setOpenDoor(n as typeof openDoor)}
                        style={{
                            padding: '6px 14px',
                            borderRadius: 6,
                            border: '1px solid #111',
                            background: openDoor === n ? '#111' : '#fff',
                            color: openDoor === n ? '#fff' : '#111',
                            fontFamily: 'monospace',
                            cursor: 'pointer',
                        }}
                    >
                        {n === 0 ? 'closed' : `door ${n}`}
                    </button>
                ))}
            </div>

            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 16,
                    height: '80vh',
                }}
            >
                <div style={{ position: 'relative', background: '#eceef0', borderRadius: 12, overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 8, left: 12, fontFamily: 'monospace', fontSize: 12, zIndex: 1 }}>
                        GENERATED ASSET
                    </div>
                    <LazyCanvas
                        camera={{ position: [3.2, 3.0, 4.2], fov: 32 }}
                        style={{ width: '100%', height: '100%' }}
                    >
                        <CameraAim target={[0, 0.5, 0]} />
                        <ambientLight intensity={0.75} />
                        <directionalLight position={[4, 8, 5]} intensity={1.2} />
                        <directionalLight position={[-5, 4, -3]} intensity={0.35} />
                        <Storage position={[0, -0.6, 0]} openDoor={openDoor === 0 ? null : openDoor} />
                    </LazyCanvas>
                </div>

                <div style={{ position: 'relative', background: '#eceef0', borderRadius: 12, overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 8, left: 12, fontFamily: 'monospace', fontSize: 12, zIndex: 1 }}>
                        REFERENCE IMAGE
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/ref-storage-pro.jpeg"
                        alt="Reference storage locker"
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                </div>
            </div>
        </div>
    )
}
