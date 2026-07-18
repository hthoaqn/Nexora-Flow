import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Đăng nhập',
  description:
    'Đăng nhập Nexora Flow — cổng khởi nghiệp và không gian Intake (NIC).',
  alternates: { canonical: 'https://nexora-flow.cloud/login' },
  openGraph: {
    title: 'Đăng nhập · Nexora Flow',
    url: 'https://nexora-flow.cloud/login',
  },
  robots: { index: true, follow: true },
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
