import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo/site'

/**
 * robots.txt (generated at /robots.txt by Next.js).
 *
 * Explicitly welcomes AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-
 * Extended, etc.) — this is a public portfolio whose entire purpose is to be
 * found and read by recruiters AND their AI screening tools. Only the internal
 * /lab dev harnesses and Next internals are kept out of the index.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/lab/', '/api/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
