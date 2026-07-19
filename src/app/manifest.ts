import type { MetadataRoute } from 'next'
import { person } from '@/lib/seo/site'

/** Web app manifest (/manifest.webmanifest) — PWA/install + richer SERP data. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${person.name} — ${person.jobTitle}`,
    short_name: person.name,
    description: person.headline,
    start_url: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#000000',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  }
}
