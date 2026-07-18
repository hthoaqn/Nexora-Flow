import type { MetadataRoute } from 'next'

const base = 'https://nexora-flow.cloud'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  const publicPages: {
    path: string
    changeFrequency: MetadataRoute.Sitemap[0]['changeFrequency']
    priority: number
  }[] = [
    { path: '', changeFrequency: 'weekly', priority: 1 },
    { path: '/login', changeFrequency: 'monthly', priority: 0.85 },
    { path: '/register', changeFrequency: 'monthly', priority: 0.8 },
    { path: '/apply', changeFrequency: 'weekly', priority: 0.75 },
    { path: '/privacy', changeFrequency: 'yearly', priority: 0.35 },
    { path: '/terms', changeFrequency: 'yearly', priority: 0.35 },
  ]

  return publicPages.map((p) => ({
    url: `${base}${p.path}`,
    lastModified: now,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }))
}
