'use client'

import Image from 'next/image'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { MouseEvent } from 'react'

export function HeroDiagram() {
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [6, -6]), { stiffness: 200, damping: 25 })
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-6, 6]), { stiffness: 200, damping: 25 })

  function handleMouseMove(e: MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const width = rect.width
    const height = rect.height
    const mouseXPos = (e.clientX - rect.left) / width - 0.5
    const mouseYPos = (e.clientY - rect.top) / height - 0.5
    mouseX.set(mouseXPos)
    mouseY.set(mouseYPos)
  }

  function handleMouseLeave() {
    mouseX.set(0)
    mouseY.set(0)
  }

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        perspective: '1000px',
      }}
    >
      <motion.div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '560px',
          aspectRatio: '1/1',
          rotateX,
          rotateY,
          transformStyle: 'preserve-3d',
        }}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Soft Ambient Radial Glow behind the illustration */}
        <div
          style={{
            position: 'absolute',
            inset: '-10%',
            background: 'radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.12) 0%, rgba(255, 255, 255, 0) 70%)',
            pointerEvents: 'none',
            borderRadius: '50%',
            filter: 'blur(30px)',
          }}
        />

        {/* Main Pre-rendered Isometric Diagram Layer */}
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            filter: 'drop-shadow(0 20px 30px rgba(0,0,0,0.08))',
          }}
        >
          <Image
            src="/item-images/hero-illustration-1x1.webp"
            alt="Backend Infrastructure Architecture Diagram"
            fill
            priority
            sizes="(max-width: 768px) 100vw, 560px"
            style={{ objectFit: 'contain' }}
          />
        </motion.div>

        {/* Dynamic Overlay Badges */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          style={{
            position: 'absolute',
            top: '8%',
            right: '4%',
            background: 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(0, 0, 0, 0.08)',
            boxShadow: '0 8px 20px rgba(0, 0, 0, 0.06)',
            borderRadius: '20px',
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#10b981',
              boxShadow: '0 0 8px #10b981',
            }}
          />
          <span
            style={{
              fontFamily: 'var(--font-suisseintlmono)',
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--color-ink-black)',
              letterSpacing: '-0.2px',
            }}
          >
            7.5K WS CONCURRENT
          </span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.6 }}
          style={{
            position: 'absolute',
            bottom: '12%',
            left: '2%',
            background: 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(0, 0, 0, 0.08)',
            boxShadow: '0 8px 20px rgba(0, 0, 0, 0.06)',
            borderRadius: '20px',
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#3b82f6',
              boxShadow: '0 0 8px #3b82f6',
            }}
          />
          <span
            style={{
              fontFamily: 'var(--font-suisseintlmono)',
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--color-ink-black)',
              letterSpacing: '-0.2px',
            }}
          >
            SYSTEMS: DISTRIBUTED
          </span>
        </motion.div>
      </motion.div>
    </div>
  )
}
