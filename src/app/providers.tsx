'use client'

import { MotionConfig } from 'framer-motion'
import ClickSpark from '@/components/ui/ClickSpark'
import { HelloLoader } from '@/components/ui/HelloLoader'

/**
 * App-wide motion configuration. `reducedMotion="user"` makes every
 * framer-motion animation honor the OS "reduce motion" setting: transform
 * and layout animations (the nav slide, hero rise, menu drop) resolve to
 * their end state instantly, while opacity fades — which are safe — still
 * play. Sits above Nav and every page's motion tree.
 *
 * Also mounts two global effects: `HelloLoader`, the multi-language
 * greeting screen shown once while the app boots (this component itself
 * only mounts on a hard page load — client-side route changes keep this
 * layout mounted, so it never reappears mid-session), and `ClickSpark`,
 * which wraps every page's content so a click anywhere spawns a small
 * spark burst at the cursor.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <HelloLoader />
      <ClickSpark sparkColor="#000000" sparkSize={10} sparkRadius={18} sparkCount={8} duration={500}>
        {children}
      </ClickSpark>
    </MotionConfig>
  )
}
