import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Đăng ký',
  description:
    'Tạo tài khoản Nexora Flow cho startup hoặc tổ chức Intake.',
  alternates: { canonical: 'https://nexora-flow.cloud/register' },
  openGraph: {
    title: 'Đăng ký · Nexora Flow',
    url: 'https://nexora-flow.cloud/register',
  },
}

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
