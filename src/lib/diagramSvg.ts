// Diagrams are pre-rendered Mermaid SVGs in public/diagrams/ (no Mermaid
// runtime on the page). Fetched once per id and inlined, so their text picks
// up the site's font variables.
const svgCache = new Map<string, string>()
const pending = new Map<string, Promise<string>>()

export function loadDiagramSvg(id: string): Promise<string> {
  const cached = svgCache.get(id)
  if (cached) return Promise.resolve(cached)
  let p = pending.get(id)
  if (!p) {
    p = fetch(`/diagrams/${id}.svg`)
      .then((r) => {
        if (!r.ok) throw new Error(`diagram ${id}: ${r.status}`)
        return r.text()
      })
      .then((svg) => {
        svgCache.set(id, svg)
        return svg
      })
      .finally(() => pending.delete(id))
    pending.set(id, p)
  }
  return p
}

export function getCachedDiagramSvg(id: string): string | undefined {
  return svgCache.get(id)
}
