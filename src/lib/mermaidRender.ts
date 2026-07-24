// Shared Mermaid render cache. mermaid.render() is a synchronous,
// main-thread-blocking layout pass (up to several hundred ms per diagram) —
// this module ensures that cost is ever paid once per diagram id, no matter
// how many places on the page need that diagram's SVG (the inline card, the
// gallery modal, a prefetch call for a neighboring slide).
let mermaidInitPromise: Promise<typeof import('mermaid').default> | null = null

function ensureMermaid() {
  if (!mermaidInitPromise) {
    mermaidInitPromise = import('mermaid').then((m) => {
      const mermaid = m.default
      mermaid.initialize({
        startOnLoad: false,
        theme: 'neutral',
        themeVariables: {
          primaryColor: '#f3f3f3',
          primaryTextColor: '#000000',
          primaryBorderColor: '#000000',
          lineColor: '#444444',
          secondaryColor: '#e5e7eb',
          tertiaryColor: '#ffffff',
          background: '#ffffff',
          mainBkg: '#f3f3f3',
          nodeBorder: '#000000',
          clusterBkg: '#f3f3f3',
          titleColor: '#000000',
          edgeLabelBackground: '#ffffff',
          fontFamily: 'var(--font-suisseintl), ui-sans-serif, system-ui, sans-serif',
        },
      })
      return mermaid
    })
  }
  return mermaidInitPromise
}

const svgCache = new Map<string, string>()
const pending = new Map<string, Promise<string>>()

/** Cached, de-duped Mermaid render — returns instantly if `id` was already rendered anywhere. */
export function renderMermaidDiagram(id: string, chart: string): Promise<string> {
  const cached = svgCache.get(id)
  if (cached) return Promise.resolve(cached)

  const inFlight = pending.get(id)
  if (inFlight) return inFlight

  const promise = ensureMermaid()
    .then((mermaid) => mermaid.render(id, chart))
    .then(({ svg }) => {
      svgCache.set(id, svg)
      pending.delete(id)
      return svg
    })
    .catch((err) => {
      pending.delete(id)
      throw err
    })

  pending.set(id, promise)
  return promise
}

export function getCachedMermaidSvg(id: string): string | undefined {
  return svgCache.get(id)
}
