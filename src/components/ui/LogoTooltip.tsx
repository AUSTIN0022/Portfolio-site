'use client'

import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Hover label for a single LogoLoop item. Two things would clip or
 * mis-place a naive `position: absolute` tooltip here: the loop's wrapper
 * clips horizontally (`overflow: hidden`) so the scrolling track doesn't
 * spill past the section, and `scaleOnHover`'s CSS `transform` on the
 * icon's own hover state creates a new containing block for any fixed/
 * absolute descendant right when the tooltip would show. Portaling to
 * `document.body` sidesteps both — the tooltip's real DOM parent is never
 * inside either box, so it positions purely off the viewport coordinates
 * captured from the hovered element's own getBoundingClientRect().
 */
export function LogoTooltip({ label, children }: { label: string; children: ReactNode }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        setPos({ top: r.top, left: r.left + r.width / 2 })
      }}
      onMouseLeave={() => setPos(null)}
    >
      {children}
      {pos &&
        createPortal(
          <span
            role="tooltip"
            style={{
              position: 'fixed',
              top: pos.top - 10,
              left: pos.left,
              transform: 'translate(-50%, -100%)',
              background: 'var(--color-ink-black)',
              color: 'var(--color-pure-white)',
              fontFamily: 'var(--font-suisseintlmono)',
              fontSize: '11px',
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
              padding: '6px 10px',
              borderRadius: '999px',
              boxShadow: '0 8px 20px rgba(0,0,0,0.25)',
              pointerEvents: 'none',
              zIndex: 200,
            }}
          >
            {label}
            <span
              aria-hidden
              style={{
                position: 'absolute',
                top: '100%',
                left: '50%',
                transform: 'translateX(-50%)',
                width: 0,
                height: 0,
                borderLeft: '5px solid transparent',
                borderRight: '5px solid transparent',
                borderTop: '5px solid var(--color-ink-black)',
              }}
            />
          </span>,
          document.body
        )}
    </span>
  )
}
