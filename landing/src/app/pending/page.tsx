'use client'

import Link from 'next/link'
import { ClockIcon, ShieldCheckIcon } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { ThemeToggle, LangToggle } from '@/components/Controls'
import { useTx } from '@/lib/tx'
import { Button } from '@/components/ui/button'

export default function PendingApprovalPage() {
  const { tx } = useTx()

  return (
    <div className="relative flex min-h-svh items-center justify-center bg-background px-4">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 top-0 size-80 rounded-full bg-primary/12 blur-3xl" />
        <div className="absolute -right-16 bottom-0 size-72 rounded-full bg-primary/8 blur-3xl" />
      </div>
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-4 flex items-center justify-between">
          <Link href="/">
            <Logo size={28} />
          </Link>
          <div className="flex items-center gap-2">
            <LangToggle />
            <ThemeToggle />
          </div>
        </div>
        <div className="portal-hero p-6 text-center sm:p-8">
          <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-600">
            <ClockIcon className="size-7" />
          </span>
          <p className="portal-chip mx-auto w-fit">
            <ShieldCheckIcon className="size-3" />
            {tx('Chờ admin duyệt', 'Awaiting admin approval')}
          </p>
          <h1 className="mt-3 font-heading text-2xl font-semibold tracking-tight">
            {tx('Tài khoản đang chờ xác minh', 'Account pending verification')}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {tx(
              'Cả Startup và Intake đều phải được admin Nexora duyệt trước khi vào workspace. Bạn sẽ đăng nhập được ngay sau khi được phê duyệt.',
              'Both Startup and Intake accounts must be approved by a Nexora admin before workspace access. You can sign in as soon as you are approved.',
            )}
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Button className="w-full rounded-full" render={<Link href="/login" />} nativeButton={false}>
              {tx('Quay lại đăng nhập', 'Back to sign in')}
            </Button>
            <Button
              variant="outline"
              className="w-full rounded-full"
              render={<Link href="/" />}
              nativeButton={false}
            >
              {tx('Về trang chủ', 'Home')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
