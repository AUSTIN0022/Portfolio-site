'use client'

import { MotionConfig } from 'framer-motion'

/**
 * App-wide motion configuration. `reducedMotion="user"` makes every
 * framer-motion animation honor the OS "reduce motion" setting: transform
 * and layout animations (the nav slide, hero rise, menu drop) resolve to
 * their end state instantly, while opacity fades — which are safe — still
 * play. Sits above Nav and every page's motion tree.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}
