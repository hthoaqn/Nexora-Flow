import type { Metadata, Viewport } from 'next'
import { Providers } from '@/components/Providers'
import { SiteJsonLd } from '@/components/seo/JsonLd'
import './globals.css'
import { cn } from '@/lib/utils'

const SITE = 'https://nexora-flow.cloud'
const TITLE_VI = 'Nexora Flow — Từ pitch deck đến đúng cuộc họp'
const TITLE_EN = 'Nexora Flow — From pitch deck to the right meeting'
const DESC_VI =
  'Nền tảng AI kết nối startup với doanh nghiệp, viện trường và quỹ đầu tư — so khớp có điểm số, có bằng chứng, con người duyệt. Sản phẩm deal-flow cho Trung tâm Đổi mới sáng tạo Quốc gia (NIC).'
const DESC_EN =
  'AI deal-flow matchmaker for the National Innovation Center (NIC): pitch-deck screening, evidence-bound partner ranking, intro drafts. AI suggests, humans approve.'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf8fc' },
    { media: '(prefers-color-scheme: dark)', color: '#1a1028' },
  ],
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: TITLE_VI,
    template: '%s · Nexora Flow',
  },
  description: DESC_VI,
  keywords: [
    'Nexora Flow',
    'deal-flow',
    'startup matching',
    'AI matchmaking',
    'NIC',
    'Trung tâm Đổi mới sáng tạo Quốc gia',
    'National Innovation Center',
    'pitch deck',
    'investor matching',
    'so khớp startup',
    'matching nhà đầu tư',
  ],
  authors: [{ name: 'Nexora Flow', url: SITE }],
  creator: 'Nexora Flow',
  publisher: 'Nexora Flow',
  applicationName: 'Nexora Flow',
  category: 'technology',
  generator: 'Next.js',
  referrer: 'origin-when-cross-origin',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: SITE,
    languages: {
      'vi-VN': SITE,
      en: SITE,
      'x-default': SITE,
    },
  },
  openGraph: {
    title: TITLE_VI,
    description: DESC_VI,
    url: SITE,
    siteName: 'Nexora Flow',
    locale: 'vi_VN',
    alternateLocale: ['en_US'],
    type: 'website',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: TITLE_EN,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE_EN,
    description: DESC_EN,
    images: ['/opengraph-image'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    apple: '/favicon.svg',
    shortcut: '/favicon.svg',
  },
  manifest: '/site.webmanifest',
  verification: {
    // Add Search Console / Bing tokens via env when available
    ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
      ? {
          google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
        }
      : {}),
  },
  other: {
    'msapplication-TileColor': '#1a1028',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning className={cn('font-sans')}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700&family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-svh bg-background text-foreground">
        <SiteJsonLd />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
