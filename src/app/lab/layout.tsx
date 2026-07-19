import type { Metadata } from 'next'

/**
 * /lab/* are internal dev harnesses for tuning 3D scenes — not portfolio
 * content. Keep them out of search indexes and AI crawls (robots.ts also
 * disallows the path; this adds a per-page noindex meta as a backstop).
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function LabLayout({ children }: { children: React.ReactNode }) {
  return children
}
