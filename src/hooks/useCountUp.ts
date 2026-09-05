'use client'

import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
}

/**
 * Counts a number up from 0 to `target` once the element carrying `ref` is
 * ~85% into view, then holds. Mirrors the `gsap.matchMedia` pattern in
 * `useScrollAnimation.ts`: reduced-motion users get the final value
 * immediately, everyone else gets a driven tween. `once: true` means the
 * ScrollTrigger tears itself down after firing — no repeated cost on
 * further scrolling past the element.
 */
export function useCountUp(target: number, opts: { decimals?: number; suffix?: string } = {}) {
  const { decimals = 0, suffix = '' } = opts
  const ref = useRef<HTMLDivElement>(null)
  const [display, setDisplay] = useState((0).toFixed(decimals) + suffix)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const mm = gsap.matchMedia()

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const obj = { val: 0 }
      gsap.to(obj, {
        val: target,
        duration: 1.4,
        ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 85%', once: true },
        onUpdate: () => setDisplay(obj.val.toFixed(decimals) + suffix),
      })
    })
    mm.add('(prefers-reduced-motion: reduce)', () => {
      setDisplay(target.toFixed(decimals) + suffix)
    })

    return () => mm.revert()
  }, [target, decimals, suffix])

  return { ref, display }
}
