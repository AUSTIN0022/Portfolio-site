import type { CSSProperties, ElementType, ReactNode } from 'react'

import './StarBorder.css'

interface StarBorderProps {
  /** Wrapping tag for the decorative frame. Defaults to 'span' — this
   * component wraps an already-interactive child (an <a> or <button>),
   * it isn't meant to become the interactive element itself. */
  as?: ElementType
  className?: string
  /** Border color, fades to transparent. Defaults to this site's electric
   * yellow — the same accent already used for the focus ring and hover
   * emphasis (see DESIGN.md), so the effect reads as "this site's motion",
   * not a bolted-on component. */
  color?: string
  /** Sweep speed. Kept slow by default (this is a hover accent, not a
   * loading spinner). */
  speed?: string
  /** Ring thickness in px. Default 2 — thin enough to read as a border,
   * not a glow. */
  thickness?: number
  /** Outer/inner corner radius. Defaults to 4px, this site's button
   * radius (see DESIGN.md's Shape Consistency Lock) — NOT the vendored
   * component's 20px pill default, which would mismatch every button here. */
  radius?: number | string
  children: ReactNode
  style?: CSSProperties
}

/**
 * React Bits' StarBorder, adapted:
 *  - Hover/focus-only. The vendored version runs its sweep continuously;
 *    here the two gradient bars sit at opacity 0 and `animation-play-state:
 *    paused` until `:hover`/`:focus-within`, so the border only appears
 *    while the user is actually interacting with the button.
 *  - Pure decorative frame, not a button replacement. Children keep their
 *    own background/color/border/radius/padding entirely untouched — this
 *    just wraps them with a thin padded frame that reveals the rotating
 *    gradient underneath. That's what makes it safe to drop around any
 *    existing button on the site without restyling it.
 */
export default function StarBorder({
  as: Component = 'span',
  className = '',
  color = 'var(--color-electric-yellow)',
  speed = '5s',
  thickness = 2,
  radius = 4,
  children,
  style,
}: StarBorderProps) {
  // `as any`: same polymorphic-`as`-prop escape hatch used in ScrollFloat —
  // TS narrows a generic ElementType to `never` against JSX.IntrinsicElements
  // otherwise. Public props stay fully typed via StarBorderProps above.
  const Frame = Component as any
  return (
    <Frame
      className={`star-border-container ${className}`}
      style={{ borderRadius: radius, ...style }}
    >
      <div
        className="border-gradient-bottom"
        style={{ background: `radial-gradient(circle, ${color}, transparent 10%)`, animationDuration: speed }}
      />
      <div
        className="border-gradient-top"
        style={{ background: `radial-gradient(circle, ${color}, transparent 10%)`, animationDuration: speed }}
      />
      <div className="star-border-inner" style={{ padding: thickness }}>
        {children}
      </div>
    </Frame>
  )
}
