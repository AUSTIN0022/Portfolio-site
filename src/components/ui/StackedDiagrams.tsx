/**
 * Pure-CSS "stack of cards" depth effect for a run of `ArchDiagram`s — each
 * child sticks at a slightly increasing `top` offset and a higher `z-index`
 * than the one before it (`.diagram-stack > *` in globals.css), so as the
 * page scrolls each new diagram slides up and settles on top of the last.
 * Deliberately no JS/scroll-linked motion here: this page is already
 * carrying two heavy scroll-driven visualizations (the architecture journey
 * and the scale simulator), so this effect stays native-sticky-positioning
 * only — zero extra runtime cost.
 */
export function StackedDiagrams({ children }: { children: React.ReactNode }) {
  return <div className="diagram-stack">{children}</div>
}
