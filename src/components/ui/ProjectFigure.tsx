'use client'

import { Branches, Relay } from '@lucasmarkes/hairline/react'
import { CustomFigure } from '@/components/ui/CustomFigure'
import type { Project } from '@/content/projects'

/**
 * Each project drawn as a Hairline line figure that acts out what it does —
 * the same figures as v2. Colours come from the nearest [data-accent]
 * ancestor (globals.css): a pastel panel and plate fill with strokes in a
 * deeper shade of the same hue, flipped for dark mode.
 */
export function ProjectFigure({ id, width }: { id: Project['id']; width: string }) {
  const style = { width, flex: 'none' }
  if (id === 'quizbuzz') return <Relay play intensity={0.6} style={style} aria-label="QuizBuzz: one request, hop by hop" />
  if (id === 'prsentinel') return <Branches play intensity={0.6} style={style} aria-label="PR Sentinel: a branch, reviewed" />
  return (
    <div style={style}>
      <CustomFigure name="dedupe" play />
    </div>
  )
}
