import type { MetadataRoute } from 'next'
import { SITE_URL, routes } from '@/lib/seo/site'

/** XML sitemap (served at /sitemap.xml) enumerating every indexable page. */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  return routes.map(({ path, priority, changeFrequency }) => ({
    url: `${SITE_URL}${path === '/' ? '' : path}`,
    lastModified,
    changeFrequency,
    priority,
  }))
}
