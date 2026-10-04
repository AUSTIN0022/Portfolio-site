'use client'

import { useEffect, useRef } from 'react'
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import 'lenis/dist/lenis.css'

if (typeof window !== 'undefined') gsap.registerPlugin(ScrollTrigger)

/**
 * The site-wide "feel" layer, mounted once in Providers:
 *  - Lenis inertia scroll, driven by GSAP's ticker so ScrollTrigger pins and
 *    scrubs read the same smoothed position (touch keeps native scroll).
 *  - Magnetic buttons: every `.btn-sketch` / `[data-magnetic]` leans toward
 *    the cursor and springs back on leave.
 *  - Cursor label: hovering anything with `data-cursor-label` floats a small
 *    mono pill beside the cursor (e.g. "View case study").
 * Fine pointers only for the last two; all of it off under reduced motion.
 */
export function MotionLayer() {
  const labelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const lenis = new Lenis({ lerp: 0.1, anchors: true, autoRaf: false })
    lenis.on('scroll', ScrollTrigger.update)
    const tick = (t: number) => lenis.raf(t * 1000)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)

    const cleanups = [() => { gsap.ticker.remove(tick); lenis.destroy() }]

    if (window.matchMedia('(pointer: fine)').matches) {
      const label = labelRef.current!
      const lx = gsap.quickTo(label, 'x', { duration: 0.45, ease: 'power3.out' })
      const ly = gsap.quickTo(label, 'y', { duration: 0.45, ease: 'power3.out' })
      let magnet: HTMLElement | null = null
      let labelled: HTMLElement | null = null

      const release = (el: HTMLElement) =>
        gsap.to(el, { x: 0, y: 0, duration: 0.8, ease: 'elastic.out(1, 0.45)' })

      const onMove = (e: PointerEvent) => {
        const t = e.target as Element
        const shoot = document.documentElement.classList.contains('shoot-mode-active')

        const m = shoot ? null : t.closest<HTMLElement>('.btn-sketch, [data-magnetic]')
        if (m !== magnet) {
          if (magnet) release(magnet)
          magnet = m
        }
        if (magnet) {
          const r = magnet.getBoundingClientRect()
          gsap.to(magnet, {
            x: (e.clientX - (r.left + r.width / 2)) * 0.28,
            y: (e.clientY - (r.top + r.height / 2)) * 0.38,
            duration: 0.4,
            ease: 'power3.out',
          })
        }

        const l = shoot ? null : t.closest<HTMLElement>('[data-cursor-label]')
        if (l !== labelled) {
          labelled = l
          if (l) label.textContent = l.dataset.cursorLabel ?? ''
          gsap.to(label, { scale: l ? 1 : 0, opacity: l ? 1 : 0, duration: l ? 0.35 : 0.2, ease: l ? 'back.out(2)' : 'power2.in' })
        }
        lx(e.clientX + 18)
        ly(e.clientY + 18)
      }
      const onLeave = () => {
        if (magnet) release(magnet)
        magnet = labelled = null
        gsap.to(label, { scale: 0, opacity: 0, duration: 0.2 })
      }

      window.addEventListener('pointermove', onMove, { passive: true })
      document.documentElement.addEventListener('pointerleave', onLeave)
      cleanups.push(() => {
        window.removeEventListener('pointermove', onMove)
        document.documentElement.removeEventListener('pointerleave', onLeave)
      })
    }

    return () => cleanups.forEach((f) => f())
  }, [])

  return <div ref={labelRef} className="cursor-label" aria-hidden />
}
