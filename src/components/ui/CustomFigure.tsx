'use client'

import { useEffect, useRef } from 'react'

/**
 * CustomFigure — mounts a figure drawn with the `hairline-create` skill
 * (public/figures/<name>.js) on the unmodified Hairline kernel, the way
 * the skill's bench page does, minus the bench's controls. Same 5:4 box, same
 * --hairline-* theme tokens as the package figures beside it.
 */

type Figure = {
  name: string
  means: string
  range: [number, number, number]
  tour: ([number, number] | null)[] | null
  mount: (
    host: { stage: HTMLElement; svg: SVGSVGElement; read: { textContent: string | null } },
    value: number,
  ) => { set: (v: number) => void; destroy: () => void }
}
type HLApi = {
  inject: (root: Document) => void
  mk: (tag: string, attrs: Record<string, string>, parent: Element) => SVGSVGElement
  tour: (stage: HTMLElement, stops: Figure['tour'], onStop?: (i: number) => void) => { stop: () => void }
  LAP: Figure['tour']
}
type HLWindow = Window & { HL?: HLApi; hairline?: (f: Figure) => void }

const BASE = '/figures'
const figures = new Map<string, Promise<Figure>>()
const waiting = new Map<string, (f: Figure) => void>()
let kernel: Promise<void> | null = null

function loadScript(src: string, module = false) {
  return new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    if (module) s.type = 'module'
    s.src = src
    s.onload = () => resolve()
    s.onerror = () => reject(new Error(`hairline: failed to load ${src}`))
    document.head.appendChild(s)
  })
}

function loadFigure(name: string): Promise<Figure> {
  const w = window as HLWindow
  kernel ??= loadScript(`${BASE}/kernel.js`).then(() => {
    // Each figure module ends by calling hairline(figure); route it to its loader.
    w.hairline = (f) => waiting.get(f.name)?.(f)
  })
  let p = figures.get(name)
  if (!p) {
    p = kernel.then(
      () =>
        new Promise<Figure>((resolve, reject) => {
          waiting.set(name, resolve)
          loadScript(`${BASE}/${name}.js`, true).catch(reject)
        }),
    )
    figures.set(name, p)
  }
  return p
}

export function CustomFigure({
  name,
  play = false,
  onRead,
  className,
}: {
  name: string
  play?: boolean
  onRead?: (text: string) => void
  className?: string
}) {
  const stageRef = useRef<HTMLDivElement>(null)
  const readRef = useRef(onRead)
  readRef.current = onRead

  useEffect(() => {
    let cleanup = () => {}
    let dead = false
    loadFigure(name)
      .then((fig) => {
        if (dead) return
        const HL = (window as HLWindow).HL!
        const stage = stageRef.current!
        HL.inject(document)
        stage.setAttribute('aria-label', fig.means)
        const svg = HL.mk('svg', { viewBox: '0 0 400 320', 'aria-hidden': 'true' }, stage)
        let text: string | null = null
        const read = {
          get textContent() {
            return text
          },
          set textContent(v: string | null) {
            text = v == null ? '' : String(v)
            readRef.current?.(text)
          },
        }
        const handle = fig.mount({ stage, svg, read }, fig.range[1])
        const walk = play ? HL.tour(stage, fig.tour || HL.LAP) : null
        cleanup = () => {
          walk?.stop()
          handle.destroy()
          svg.remove()
        }
      })
      .catch((e) => console.error(e))
    return () => {
      dead = true
      cleanup()
    }
  }, [name, play])

  return <div ref={stageRef} data-hairline={name} role="img" className={className} />
}
