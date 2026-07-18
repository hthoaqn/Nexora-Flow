import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const base = 'https://nexora-flow.cloud'
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin',
          '/pending',
          '/auth/',
          '/intake-api/',
          '/dashboard',
          '/setup',
          '/matches',
          '/connections',
          '/partners',
          '/sandbox',
          '/investor-matches',
          '/evaluations',
          '/programs',
          '/applications',
          '/settings',
          '/onboarding',
          '/matching',
          '/workspace/',
          '/my-application/',
          '/startup/',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}
