'use client'

import { MotionConfig } from 'framer-motion'
import { HelloLoader } from '@/components/ui/HelloLoader'
import { WaterRipple } from '@/components/ui/WaterRipple'
import { MotionLayer } from '@/components/ui/MotionLayer'

/**
 * App-wide motion configuration. `reducedMotion="user"` makes every
 * framer-motion animation honor the OS "reduce motion" setting: transform
 * and layout animations (the nav slide, hero rise, menu drop) resolve to
 * their end state instantly, while opacity fades — which are safe — still
 * play. Sits above Nav and every page's motion tree.
 *
 * Also mounts the global effects: `HelloLoader`, the multi-language
 * greeting screen shown once while the app boots (this component itself
 * only mounts on a hard page load — client-side route changes keep this
 * layout mounted, so it never reappears mid-session), and `WaterRipple`,
 * which treats the whole page as still water — the cursor leaves a faint
 * wake and a click drops a stone; and `MotionLayer` — smooth scroll,
 * magnetic buttons and the cursor label.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <HelloLoader />
      <WaterRipple />
      <MotionLayer />
      {children}
    </MotionConfig>
  )
}
