'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

/**
 * CardScrollbar — an always-visible, draggable pill that mirrors and drives the
 * horizontal scroll position of a card track. Replaces the native scrollbar
 * (hidden via the `.card-track` class). Renders nothing when the track has no
 * overflow to scroll.
 */
export function CardScrollbar({
  trackRef,
}: {
  trackRef: RefObject<HTMLDivElement | null>
}) {
  const barRef = useRef<HTMLDivElement>(null)
  const [thumb, setThumb] = useState({ width: 100, left: 0 })
  const [scrollable, setScrollable] = useState(false)

  // Keep the thumb geometry in sync with the track's scroll + dimensions.
  useEffect(() => {
    const track = trackRef.current
    if (!track) return

    const sync = () => {
      const { scrollWidth, clientWidth, scrollLeft } = track
      if (scrollWidth - clientWidth <= 1) {
        setScrollable(false)
        return
      }
      setScrollable(true)
      setThumb({
        width: (clientWidth / scrollWidth) * 100,
        left: (scrollLeft / scrollWidth) * 100,
      })
    }

    sync()
    track.addEventListener('scroll', sync, { passive: true })
    const ro = new ResizeObserver(sync)
    ro.observe(track)
    return () => {
      track.removeEventListener('scroll', sync)
      ro.disconnect()
    }
  }, [trackRef])

  // Map a pointer x on the bar to a scrollLeft, centering the thumb on the
  // cursor so click-to-jump and drag both feel natural.
  const scrubTo = (clientX: number) => {
    const track = trackRef.current
    const bar = barRef.current
    if (!track || !bar) return
    const rect = bar.getBoundingClientRect()
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1)
    const thumbRatio = track.clientWidth / track.scrollWidth
    const target = track.scrollWidth * (ratio - thumbRatio / 2)
    track.scrollLeft = clamp(target, 0, track.scrollWidth - track.clientWidth)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    scrubTo(e.clientX)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (e.buttons !== 1) return
    scrubTo(e.clientX)
  }

  if (!scrollable) return null

  return (
    <div
      ref={barRef}
      className="card-scrollbar"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      role="scrollbar"
      aria-controls="work-track"
      aria-orientation="horizontal"
      aria-label="Scroll projects"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(thumb.left)}
    >
      <div
        className="card-scrollbar-thumb"
        style={{ width: `${thumb.width}%`, left: `${thumb.left}%` }}
      />
    </div>
  )
}
