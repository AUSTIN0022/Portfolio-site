'use client'

import { useEffect } from 'react'

/**
 * This site ships no service worker, but the `localhost` / production origin
 * may still be controlled by a stale one registered by a previous app on the
 * same origin (service workers are origin-scoped, not project-scoped). A
 * broken leftover worker throws `sw.js … o.handle is not a function` and turns
 * every request into a `FetchEvent … network error`.
 *
 * On mount we unregister any registered workers and drop their caches, so the
 * origin returns to being served directly by the network. Renders nothing.
 */
export function ServiceWorkerCleanup() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => {
        if (regs.length === 0) return
        regs.forEach((reg) => reg.unregister())
        // Drop any caches the stale worker populated so it can't keep serving
        // them.
        if ('caches' in window) {
          caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)))
        }
        // Reload once (guarded so we can't loop) to escape the worker's
        // control on this page view now that it's unregistered.
        const KEY = 'sw-cleanup-reloaded'
        if (navigator.serviceWorker.controller && !sessionStorage.getItem(KEY)) {
          sessionStorage.setItem(KEY, '1')
          window.location.reload()
        }
      })
      .catch(() => {
        /* getRegistrations can reject in private modes — nothing to clean up */
      })
  }, [])

  return null
}
