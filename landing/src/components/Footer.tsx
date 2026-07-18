'use client'

import Link from 'next/link'
import {
  ArrowUpRightIcon,
  GlobeIcon,
  MailIcon,
  ShieldCheckIcon,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { Logo } from './Logo'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

export function Footer() {
  const { t, lang } = useI18n()
  const year = new Date().getFullYear()

  const cols =
    lang === 'vi'
      ? [
          {
            title: 'Sản phẩm',
            links: [
              { label: 'Quy trình', href: '#process' },
              { label: 'Đối tượng', href: '#sides' },
              { label: 'Nền tảng', href: '#platform' },
              { label: 'FAQ', href: '#faq' },
            ],
          },
          {
            title: 'Đối tượng',
            links: [
              { label: 'Startup', href: '#sides' },
              { label: 'Doanh nghiệp', href: '#sides' },
              { label: 'Viện & quỹ', href: '#sides' },
              { label: 'Đăng nhập', href: '/login' },
            ],
          },
          {
            title: 'Liên hệ',
            links: [
              { label: 'Early access', href: '#cta' },
              { label: 'Workspace', href: '/programs' },
              { label: 'nexora-flow.cloud', href: 'https://nexora-flow.cloud' },
            ],
          },
        ]
      : [
          {
            title: 'Product',
            links: [
              { label: 'Process', href: '#process' },
              { label: 'Sides', href: '#sides' },
              { label: 'Platform', href: '#platform' },
              { label: 'FAQ', href: '#faq' },
            ],
          },
          {
            title: 'Audience',
            links: [
              { label: 'Startups', href: '#sides' },
              { label: 'Corporates', href: '#sides' },
              { label: 'Labs & funds', href: '#sides' },
              { label: 'Sign in', href: '/login' },
            ],
          },
          {
            title: 'Contact',
            links: [
              { label: 'Early access', href: '#cta' },
              { label: 'Workspace', href: '/programs' },
              { label: 'nexora-flow.cloud', href: 'https://nexora-flow.cloud' },
            ],
          },
        ]

  return (
    <footer className="relative overflow-hidden border-t border-border/60 bg-muted/25">
      {/* Ambient */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 bottom-0 size-72 rounded-full bg-primary/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 top-10 size-56 rounded-full bg-primary/8 blur-3xl"
      />

      <div className="relative mx-auto max-w-6xl px-4 pt-14 pb-8 sm:px-6 sm:pt-16">
        {/* Top CTA strip */}
        <div className="mb-12 flex flex-col gap-4 rounded-2xl border border-border/70 bg-card/80 p-5 shadow-sm backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="min-w-0">
            <p className="font-heading text-lg font-semibold tracking-tight sm:text-xl">
              {lang === 'vi' ? 'Sẵn sàng mở pipeline?' : 'Ready to open your pipeline?'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {lang === 'vi'
                ? 'Vào workspace intake hoặc xin early access matchmaker.'
                : 'Jump into the intake workspace or request matchmaker early access.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="rounded-full" render={<Link href="/login" />} nativeButton={false}>
              {lang === 'vi' ? 'Đăng nhập' : 'Sign in'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-full"
              render={<a href="#cta" />}
              nativeButton={false}
            >
              {lang === 'vi' ? 'Early access' : 'Early access'}
            </Button>
          </div>
        </div>

        {/* Link columns */}
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="sm:col-span-2 lg:col-span-1">
            <Logo size={28} showWordmark />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              {lang === 'vi'
                ? 'AI deal-flow matchmaker — kết nối startup với doanh nghiệp, viện trường và quỹ. Match có điểm số, có bằng chứng.'
                : 'AI deal-flow matchmaker — startups × corporates × labs × funds. Scored matches with receipts.'}
            </p>
            <div className="mt-5 flex items-center gap-2">
              <Button
                variant="outline"
                size="icon-sm"
                className="rounded-full"
                render={<a href="mailto:hello@nexora-flow.cloud" aria-label="Email" />}
                nativeButton={false}
              >
                <MailIcon />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                className="rounded-full"
                render={
                  <a
                    href="https://nexora-flow.cloud"
                    aria-label="Website"
                    target="_blank"
                    rel="noreferrer"
                  />
                }
                nativeButton={false}
              >
                <GlobeIcon />
              </Button>
            </div>
          </div>

          {cols.map((col) => (
            <div key={col.title}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {col.title}
              </p>
              <ul className="mt-4 flex flex-col gap-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="group inline-flex items-center gap-1 text-sm text-foreground/80 transition-colors hover:text-primary"
                    >
                      {link.label}
                      {link.href.startsWith('http') ? (
                        <ArrowUpRightIcon className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
                      ) : null}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <Separator className="my-8 bg-border/70" />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            © {year} Nexora Flow · {t.footerLeft}
          </p>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card/60 px-2.5 py-1">
              <ShieldCheckIcon className="size-3.5 text-primary" />
              {t.footerRight}
            </span>
            <a href="#top" className="hover:text-foreground">
              {lang === 'vi' ? 'Lên đầu trang' : 'Back to top'}
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
