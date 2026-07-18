/** Server-safe JSON-LD for public SEO (Organization + SoftwareApplication). */

const BASE = 'https://nexora-flow.cloud'

export function SiteJsonLd() {
  const org = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Nexora Flow',
    url: BASE,
    logo: `${BASE}/favicon.svg`,
    description:
      'AI deal-flow matchmaker for the National Innovation Center (NIC): pitch-deck screening, evidence-bound partner ranking, intro drafts. AI suggests, humans approve.',
    sameAs: [] as string[],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      url: `${BASE}/login`,
    },
  }

  const app = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Nexora Flow',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: BASE,
    description:
      'From pitch deck to the right meeting: AI-assisted startup intake, partner matching with scores and evidence, controlled intros.',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Nexora Flow',
      url: BASE,
    },
  }

  const website = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Nexora Flow',
    url: BASE,
    inLanguage: ['vi-VN', 'en'],
    potentialAction: {
      '@type': 'RegisterAction',
      target: `${BASE}/register`,
      name: 'Register',
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(org) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(app) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(website) }}
      />
    </>
  )
}
