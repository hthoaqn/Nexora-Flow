import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Nộp hồ sơ chương trình',
  description:
    'Nộp hồ sơ khởi nghiệp vào chương trình Intake trên Nexora Flow.',
  alternates: { canonical: 'https://nexora-flow.cloud/apply' },
  openGraph: {
    title: 'Nộp hồ sơ · Nexora Flow',
    url: 'https://nexora-flow.cloud/apply',
  },
}

export default function ApplyLayout({ children }: { children: React.ReactNode }) {
  return children
}
