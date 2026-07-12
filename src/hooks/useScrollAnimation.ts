'use client'

import { useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
}

export function useScrollAnimation() {
  useEffect(() => {
    // gsap.matchMedia scopes every tween created inside the callback to the
    // media query: they only run when the user has NOT asked to reduce
    // motion, and mm.revert() restores the original inline styles otherwise.
    // Result: reduced-motion users see fully-visible content with no reveal
    // (gsap.from never sets opacity:0 for them), and the reveals never leave
    // a section stuck hidden.
    const mm = gsap.matchMedia()

    const buildReveals = () =>
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        document.querySelectorAll('[data-gsap="heading"]').forEach((el) => {
          gsap.from(el, {
            scrollTrigger: { trigger: el, start: 'top 80%' },
            y: 40,
            opacity: 0,
            duration: 0.8,
            ease: 'power3.out',
          })
        })

        document.querySelectorAll('[data-gsap="card"]').forEach((el, i) => {
          gsap.from(el, {
            scrollTrigger: { trigger: el, start: 'top 75%' },
            y: 60,
            opacity: 0,
            delay: i * 0.15,
            duration: 0.7,
            ease: 'power2.out',
          })
        })

        document.querySelectorAll('[data-gsap="stat"]').forEach((el) => {
          gsap.from(el, {
            scrollTrigger: { trigger: el, start: 'top 85%' },
            opacity: 0,
            y: 20,
            duration: 0.6,
            ease: 'power2.out',
          })
        })

        document.querySelectorAll('[data-gsap="tags"]').forEach((el) => {
          gsap.from(el.children, {
            scrollTrigger: { trigger: el, start: 'top 85%' },
            opacity: 0,
            y: 10,
            stagger: 0.04,
            duration: 0.4,
            ease: 'power2.out',
          })
        })
      })

    // gsap.from hides each element up front (opacity:0) and relies on rAF to
    // reveal it — but rAF is paused on hidden/background tabs and headless
    // renderers, which would ship the sections blank. So only arm the reveals
    // once the tab is actually visible; a load that never becomes visible
    // keeps content at its natural, fully-visible default.
    if (document.hidden) {
      const onVisible = () => {
        if (document.hidden) return
        document.removeEventListener('visibilitychange', onVisible)
        buildReveals()
      }
      document.addEventListener('visibilitychange', onVisible)
      return () => {
        document.removeEventListener('visibilitychange', onVisible)
        mm.revert()
      }
    }

    buildReveals()
    return () => mm.revert()
  }, [])
}
