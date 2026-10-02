'use client'

import { useRef } from 'react'
import { CardScrollbar } from '@/components/ui/CardScrollbar'

/**
 * One-card-at-a-time gallery for a run of `DecisionCard`s: a horizontal
 * scroll-snap track where every card is full width, paged by swipe or the
 * prev/next buttons. Renders
 * `children` (existing `DecisionCard` elements, untouched) as flex items;
 * their width/flex-shrink come from the `.decision-track > *` rule in
 * globals.css, so `DecisionCard` itself needs no prop changes.
 */
export function DecisionCardTrack({ children }: { children: React.ReactNode }) {
  const trackRef = useRef<HTMLDivElement>(null)

  const scrollBy = (dir: 1 | -1) => {
    const track = trackRef.current
    // One full card (100% width) plus the 24px gap per press.
    if (track) track.scrollBy({ left: dir * (track.clientWidth + 24), behavior: 'smooth' })
  }

  return (
    <div data-shoot-scroll-interactive="1">
      <div
        ref={trackRef}
        id="decisions-track"
        className="card-track decision-track"
        style={{
          display: 'flex',
          gap: '24px',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          paddingBottom: '4px',
        }}
      >
        {children}
      </div>

      <div
        style={{
          marginTop: '24px',
          display: 'flex',
          gap: '20px',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <button
          onClick={() => scrollBy(-1)}
          aria-label="Scroll to previous decision"
          className="icon-btn"
          style={{
            flexShrink: 0,
            width: '48px',
            height: '48px',
            border: '1px solid var(--color-fg)',
            borderRadius: '50%',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: '18px',
          }}
        >
          <span aria-hidden>←</span>
        </button>

        <div style={{ flex: 1, maxWidth: '420px' }}>
          <CardScrollbar trackRef={trackRef} trackId="decisions-track" />
        </div>

        <button
          onClick={() => scrollBy(1)}
          aria-label="Scroll to next decision"
          className="icon-btn"
          style={{
            flexShrink: 0,
            width: '48px',
            height: '48px',
            border: '1px solid var(--color-fg)',
            borderRadius: '50%',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: '18px',
          }}
        >
          <span aria-hidden>→</span>
        </button>
      </div>
    </div>
  )
}
