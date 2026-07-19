'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ClockIcon, Loader2Icon, ShieldCheckIcon, CheckCircle2Icon } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { ThemeToggle, LangToggle } from '@/components/Controls'
import { useTx } from '@/lib/tx'
import { Button } from '@/components/ui/button'
import {
  autoApproveAllPending,
  autoApproveUser,
} from '@/lib/auto-approve-client'
import { useAuthStore } from '@/deal-flow/frontend/store/useAuthStore'

/**
 * Pending wall — for hackathon/judges, auto-approve then send to dashboard.
 * Disable auto: AUTO_APPROVE_PENDING=false on server.
 */
export default function PendingApprovalPage() {
  const { tx } = useTx()
  const user = useAuthStore((s) => s.user)
  const setAuth = useAuthStore((s) => s.setAuth)
  const accessToken = useAuthStore((s) => s.accessToken)
  const refreshToken = useAuthStore((s) => s.refreshToken)

  const [phase, setPhase] = useState<'working' | 'done' | 'stuck'>('working')
  const [detail, setDetail] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setPhase('working')
      setDetail(
        tx(
          'Đang tự động duyệt tài khoản (chế độ demo giám khảo)…',
          'Auto-approving account (judges demo mode)…',
        ),
      )

      const userId = user?.id
      let ok = false

      if (userId) {
        const r = await autoApproveUser(String(userId))
        ok = r.ok
        if (!cancelled) {
          setDetail(
            r.ok
              ? tx('Đã duyệt — chuyển vào portal…', 'Approved — entering portal…')
              : r.error || 'approve failed',
          )
        }
      } else {
        // No local session — sweep pending then ask to re-login
        const sweep = await autoApproveAllPending()
        ok = !!sweep.ok
        if (!cancelled) {
          setDetail(
            sweep.ok
              ? tx(
                  `Đã duyệt ${sweep.approvedCount ?? 0} tài khoản pending. Đăng nhập lại nhé.`,
                  `Approved ${sweep.approvedCount ?? 0} pending accounts. Please sign in again.`,
                )
              : sweep.error || 'sweep failed',
          )
        }
      }

      if (cancelled) return

      if (ok && userId && accessToken && user) {
        setAuth(
          { ...user, status: 'active' },
          accessToken,
          refreshToken || '',
        )
        setPhase('done')
        const role = String(user?.role || 'startup').toLowerCase()
        const dest =
          role === 'startup' || role === 'founder' ? '/dashboard' : '/programs'
        window.setTimeout(() => {
          window.location.href = dest
        }, 600)
        return
      }

      if (ok && !userId) {
        setPhase('done')
        window.setTimeout(() => {
          window.location.href = '/login'
        }, 1200)
        return
      }

      await autoApproveAllPending()
      if (!cancelled) setPhase('stuck')
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

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
          <span
            className={`mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl border ${
              phase === 'done'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-600'
            }`}
          >
            {phase === 'working' ? (
              <Loader2Icon className="size-7 animate-spin" />
            ) : phase === 'done' ? (
              <CheckCircle2Icon className="size-7" />
            ) : (
              <ClockIcon className="size-7" />
            )}
          </span>
          <p className="portal-chip mx-auto w-fit">
            <ShieldCheckIcon className="size-3" />
            {phase === 'done'
              ? tx('Đã duyệt', 'Approved')
              : tx('Tự động duyệt (demo giám khảo)', 'Auto-approve (judges demo)')}
          </p>
          <h1 className="mt-3 font-heading text-2xl font-semibold tracking-tight">
            {phase === 'done'
              ? tx('Tài khoản đã kích hoạt', 'Account activated')
              : phase === 'working'
                ? tx('Đang phê duyệt…', 'Approving…')
                : tx('Chưa duyệt được tự động', 'Could not auto-approve')}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {detail ||
              tx(
                'Hackathon mode: hệ thống tự duyệt pending để giám khảo demo nhanh.',
                'Hackathon mode: pending accounts are auto-approved for judges.',
              )}
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Button
              className="w-full rounded-full"
              render={<Link href="/login" />}
              nativeButton={false}
            >
              {tx('Quay lại đăng nhập', 'Back to sign in')}
            </Button>
            <Button
              variant="outline"
              className="w-full rounded-full"
              onClick={() => {
                void autoApproveAllPending().then(() => {
                  window.location.href = '/login'
                })
              }}
            >
              {tx('Duyệt toàn bộ pending & đăng nhập', 'Approve all pending & sign in')}
            </Button>
            <Button
              variant="ghost"
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
