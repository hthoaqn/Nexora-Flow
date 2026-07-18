// @ts-nocheck
'use client'

/**
 * Startup home — same density as Intake overview:
 * path pills → one primary CTA → optional evaluation strip (M5–9) → recent lists.
 */

import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useStartupStore } from '../store/useStartupStore'
import { useAuthStore } from '../store/useAuthStore'
import { usePortalI18n } from '../i18n'
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Sparkles,
  UserRound,
  Link2,
  Gamepad2,
  Handshake,
  Upload,
  RefreshCw,
  Award,
  MessageSquare,
  ClipboardCheck,
  Video,
  Target,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  isInvestorPipelineEnabled,
  isValidationEnabled,
} from '@/investor/flags'
import { listEvaluationCases } from '@/investor/lib/evaluationStore'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

function caseNextAction(c, tx) {
  const st = String(c.status || '')
  const round = Number(c.currentRound) || 0
  if (st === 'waiting_for_startup_acceptance') {
    return {
      label: tx(
        'Chấp nhận hành trình kiểm chứng',
        'Accept validation journey',
      ),
      body: tx(
        'Đọc điều khoản · consent ghi hình — không tự động từ Matching.',
        'Review terms · recording consent — never auto from Matching.',
      ),
      icon: ClipboardCheck,
      to: `/evaluations/${c.id}`,
    }
  }
  if (st === 'round_1_ready' || st === 'round_1_in_progress') {
    return {
      label: tx('Vòng 1 — Pitch video', 'Round 1 — Video pitch'),
      body: tx(
        'Ghi / nộp pitch · AI hỏi đáp.',
        'Record / submit pitch · AI Q&A.',
      ),
      icon: Video,
      to: `/evaluations/${c.id}/pitch`,
    }
  }
  if (st === 'round_1_submitted' || st === 'waiting_for_investor_review') {
    return {
      label: tx('Chờ nhà đầu tư duyệt pitch', 'Wait for investor pitch review'),
      body: tx(
        'Pitch đã nộp. Theo dõi trạng thái case.',
        'Pitch submitted. Track case status.',
      ),
      icon: ClipboardCheck,
      to: `/evaluations/${c.id}`,
    }
  }
  if (round >= 2 || /sim|round_2/i.test(st)) {
    return {
      label: tx('Vòng 2 — Mô phỏng kinh doanh', 'Round 2 — Business sim'),
      body: tx(
        'Ra quyết định theo kịch bản (Module 7).',
        'Decide by scenario (Module 7).',
      ),
      icon: Gamepad2,
      to: `/evaluations/${c.id}`,
    }
  }
  if (round >= 3 || /proof|round_3/i.test(st)) {
    return {
      label: tx('Vòng 3 — Video minh chứng', 'Round 3 — Proof video'),
      body: tx(
        'Nộp video chứng minh sản phẩm (Module 8).',
        'Submit product proof video (Module 8).',
      ),
      icon: Target,
      to: `/evaluations/${c.id}`,
    }
  }
  if (st === 'completed') {
    return {
      label: tx('Hoàn tất kiểm chứng', 'Evaluation complete'),
      body: tx('Xem kết quả / tóm tắt.', 'View result / summary.'),
      icon: CheckCircle2,
      to: `/evaluations/${c.id}`,
    }
  }
  return {
    label: tx('Mở hồ sơ kiểm chứng', 'Open evaluation case'),
    body: tx(
      'Pitch · mô phỏng · minh chứng · quyết định cuối.',
      'Pitch · simulation · proof · final decision.',
    ),
    icon: ClipboardCheck,
    to: `/evaluations/${c.id}`,
  }
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { isDirty, confirmedProfile, setConfirmedProfile } = useStartupStore()
  const { t, lang } = usePortalI18n()
  const tx = (vi, en) => (lang === 'en' ? en : vi)
  const invOn = isInvestorPipelineEnabled()
  const validationOn = isValidationEnabled()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sandboxCompleted, setSandboxCompleted] = useState(false)
  const [runningMatch, setRunningMatch] = useState(false)
  const [evalCases, setEvalCases] = useState([])

  const refreshSandboxProgress = async () => {
    const uid = user?.id
    if (!uid) return
    try {
      const { isSandboxCompleted, markSandboxCompleted } = await import(
        '../lib/sandboxProgress'
      )
      let done = isSandboxCompleted(uid)
      try {
        const res = await api.get('/startup/sandbox/active')
        if (res.data?.success && res.data.data) {
          const sim = res.data.data
          const st = String(sim.status || '').toLowerCase()
          if (st === 'completed' || sim.report) {
            done = true
            markSandboxCompleted(uid, { simId: sim.id })
          }
        }
      } catch {
        /* keep */
      }
      setSandboxCompleted(done)
    } catch {
      setSandboxCompleted(false)
    }
  }

  const load = async () => {
    try {
      const [dash, prof] = await Promise.all([
        api.get('/startup/dashboard').catch(() => null),
        api.get('/startup/profile').catch(() => null),
      ])
      if (dash?.data?.success) {
        const raw = dash.data.data || {}
        const counts = raw.connectionCounts || {}
        setData({
          ...raw,
          totalMatches: raw.totalMatches ?? raw.matchCount ?? 0,
          highMatchCount: raw.highMatchCount ?? 0,
          pendingConnections:
            raw.pendingConnections ?? counts.pending ?? counts.PENDING ?? 0,
          acceptedConnections:
            raw.acceptedConnections ?? counts.accepted ?? counts.ACCEPTED ?? 0,
          profileCompletion: raw.profileCompletion ?? 0,
          recentMatches: Array.isArray(raw.recentMatches)
            ? raw.recentMatches
            : [],
          recentConnections: Array.isArray(raw.recentConnections)
            ? raw.recentConnections
            : [],
        })
      }
      if (prof?.data?.success && prof.data.data) {
        setConfirmedProfile(prof.data.data)
      } else if (prof?.data?.success && !prof.data.data) {
        setConfirmedProfile(null)
      }
      if (validationOn && user?.id) {
        setEvalCases(listEvaluationCases(user.id) || [])
      }
    } finally {
      setLoading(false)
      void refreshSandboxProgress()
    }
  }

  useEffect(() => {
    void load()
  }, [isDirty, user?.id])

  useEffect(() => {
    const onProgress = () => void refreshSandboxProgress()
    window.addEventListener('nf:sandbox-progress', onProgress)
    window.addEventListener('focus', () => {
      void refreshSandboxProgress()
      if (validationOn && user?.id)
        setEvalCases(listEvaluationCases(user.id) || [])
    })
    return () => {
      window.removeEventListener('nf:sandbox-progress', onProgress)
    }
  }, [user?.id, validationOn])

  const completion = Number(data?.profileCompletion || 0)
  const hasProfile = !!confirmedProfile
  const matches = Number(data?.totalMatches || 0)
  const highMatches = Number(data?.highMatchCount || 0)
  const pending = Number(data?.pendingConnections || 0)
  const accepted = Number(data?.acceptedConnections || 0)
  const recentMatches = data?.recentMatches || []
  const recentConnections = data?.recentConnections || []
  const startupName =
    confirmedProfile?.startupName || data?.startupName || t.unnamed

  const activeCases = useMemo(
    () =>
      evalCases.filter(
        (c) =>
          c.status !== 'completed' &&
          c.status !== 'rejected' &&
          c.status !== 'withdrawn',
      ),
    [evalCases],
  )
  const topCase = activeCases[0]
  const topCaseAction = topCase ? caseNextAction(topCase, tx) : null

  /** Primary = evaluation case first (M5–9), else classic partner path */
  const primary = useMemo(() => {
    if (topCase && topCaseAction) {
      return {
        title: topCaseAction.label,
        body: `${topCase.investor?.name || tx('Nhà đầu tư', 'Investor')} · ${topCaseAction.body}`,
        cta: tx('Tiếp tục kiểm chứng', 'Continue evaluation'),
        to: topCaseAction.to,
        icon: topCaseAction.icon,
        tone: 'eval',
      }
    }
    if (!hasProfile) {
      return {
        title: tx('Bước 1 — Tạo hồ sơ', 'Step 1 — Create profile'),
        body: tx(
          'Tải deck hoặc điền form, rồi xác nhận.',
          'Upload a deck or fill the form, then confirm.',
        ),
        cta: tx('Mở hồ sơ', 'Open profile'),
        to: '/setup',
        icon: UserRound,
      }
    }
    if (isDirty) {
      return {
        title: tx('Lưu bản nháp hồ sơ', 'Save profile draft'),
        body: tx(
          'So khớp vẫn dùng bản chính thức cũ.',
          'Matching still uses the last official version.',
        ),
        cta: tx('Lưu hồ sơ', 'Save profile'),
        to: '/setup',
        icon: Upload,
      }
    }
    if (matches === 0) {
      return {
        title: tx('Bước 2 — So khớp đối tác', 'Step 2 — Match partners'),
        body: tx(
          'Chạy một lần để lấy danh sách đối tác phù hợp.',
          'Run once to get fitting partners.',
        ),
        cta: tx('Chạy so khớp', 'Run matching'),
        to: '/matches',
        icon: Sparkles,
        runMatch: true,
      }
    }
    if (accepted === 0 && pending === 0) {
      return {
        title: tx('Bước 3 — Gửi lời giới thiệu', 'Step 3 — Send intro'),
        body: tx(
          `${matches} đối tác · ${highMatches} điểm cao.`,
          `${matches} partners · ${highMatches} high scores.`,
        ),
        cta: tx('Mở so khớp', 'Open matches'),
        to: '/matches',
        icon: MessageSquare,
      }
    }
    if (accepted === 0) {
      return {
        title: tx(`${pending} kết nối đang chờ`, `${pending} pending connection(s)`),
        body: tx('Theo dõi hoặc gửi thêm intro.', 'Track or send more intros.'),
        cta: tx('Kết nối', 'Connections'),
        to: '/connections',
        icon: Link2,
      }
    }
    if (!sandboxCompleted) {
      return {
        title: tx(
          'Bước 4 — Phòng giả lập (Module 7)',
          'Step 4 — Sandbox sim (Module 7)',
        ),
        body: tx(
          'Ra quyết định theo lượt — báo cáo năng lực founder.',
          'Turn-based decisions — founder capability report.',
        ),
        cta: tx('Mở giả lập', 'Open sandbox'),
        to: '/sandbox',
        icon: Gamepad2,
      }
    }
    if (validationOn) {
      return {
        title: tx(
          'Hành trình kiểm chứng đầu tư',
          'Investment validation journey',
        ),
        body: tx(
          'So khớp NĐT → mutual → chấp nhận → pitch · mô phỏng · minh chứng (additive).',
          'Investor match → mutual → accept → pitch · sim · proof (additive).',
        ),
        cta: tx('So khớp NĐT', 'Investor match'),
        to: '/investor-matches',
        icon: Handshake,
      }
    }
    return {
      title: tx('Bạn đang tiến tốt', "You're on track"),
      body: tx('Xem kết nối hoặc chạy lại so khớp.', 'Review connections or re-run matching.'),
      cta: tx('Kết nối', 'Connections'),
      to: '/connections',
      icon: CheckCircle2,
    }
  }, [
    topCase,
    topCaseAction,
    hasProfile,
    isDirty,
    matches,
    highMatches,
    pending,
    accepted,
    sandboxCompleted,
    validationOn,
    lang,
  ])

  const pathSteps = [
    {
      n: 1,
      label: tx('Hồ sơ', 'Profile'),
      done: hasProfile && completion >= 40,
      to: '/setup',
    },
    {
      n: 2,
      label: tx('So khớp', 'Match'),
      done: matches > 0,
      to: '/matches',
    },
    {
      n: 3,
      label: tx('Kết nối', 'Connect'),
      done: accepted > 0,
      to: '/connections',
    },
    {
      n: 4,
      label: tx('Giả lập', 'Sim'),
      done: sandboxCompleted,
      to: '/sandbox',
    },
    ...(validationOn
      ? [
          {
            n: 5,
            label: tx('Kiểm chứng', 'Validate'),
            done: evalCases.some((c) => c.status === 'completed'),
            to: activeCases.length ? '/evaluations' : '/investor-matches',
          },
        ]
      : []),
  ]

  const runMatchNow = async () => {
    if (!hasProfile) {
      navigate('/setup')
      return
    }
    setRunningMatch(true)
    const id = toast.loading(tx('Đang so khớp…', 'Matching…'))
    try {
      const res = await api.post('/startup/matches/run', { confirmedProfile })
      if (res.data?.success) {
        toast.success(tx('Xong', 'Done'), { id })
        navigate('/matches')
      }
    } catch (e) {
      const code = e?.response?.data?.error?.code || ''
      toast.error(
        code === 'PROFILE_NOT_CONFIRMED'
          ? tx('Xác nhận hồ sơ trước', 'Confirm profile first')
          : e?.response?.data?.message || tx('Lỗi so khớp', 'Match failed'),
        { id },
      )
      if (code === 'PROFILE_NOT_CONFIRMED') navigate('/setup')
    } finally {
      setRunningMatch(false)
    }
  }

  if (loading) {
    return (
      <div className="flex w-full flex-1 flex-col gap-4">
        <div className="h-16 animate-pulse rounded-2xl bg-muted/50" />
        <div className="h-10 animate-pulse rounded-full bg-muted/40" />
        <div className="h-36 animate-pulse rounded-2xl bg-muted/40" />
      </div>
    )
  }

  const name = user?.fullName || user?.email?.split('@')[0] || 'Founder'
  const PrimaryIcon = primary.icon

  return (
    <div className="flex w-full min-w-0 flex-1 flex-col gap-4">
      {/* Header — intake style compact */}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">
            {tx('Xin chào', 'Hi')}, {name}
          </p>
          <h1 className="font-heading truncate text-xl font-semibold sm:text-2xl">
            {startupName}
          </h1>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="tabular-nums">
            {completion}%
          </Badge>
          <Badge variant="secondary" className="tabular-nums">
            {matches} {tx('khớp', 'fit')}
          </Badge>
          <Button
            size="sm"
            variant="ghost"
            className="size-8 rounded-full p-0"
            onClick={() => void load()}
          >
            <RefreshCw className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Path pills */}
      <div className="flex flex-wrap items-center gap-1.5">
        {pathSteps.map((s, i) => (
          <React.Fragment key={s.n}>
            <button
              type="button"
              onClick={() => navigate(s.to)}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium transition-colors',
                s.done
                  ? 'border-primary/30 bg-primary/10 text-primary'
                  : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/30',
              )}
            >
              {s.done ? (
                <CheckCircle2 className="size-3" />
              ) : (
                <Circle className="size-3" />
              )}
              {s.n}. {s.label}
            </button>
            {i < pathSteps.length - 1 ? (
              <span className="hidden text-muted-foreground/50 sm:inline">
                →
              </span>
            ) : null}
          </React.Fragment>
        ))}
      </div>

      {/* ONE primary */}
      <div
        className={cn(
          'rounded-2xl border p-4 sm:p-5',
          primary.tone === 'eval'
            ? 'border-violet-500/35 bg-violet-500/5'
            : 'border-primary/30 bg-primary/5',
        )}
      >
        <Badge
          className="mb-2"
          variant={primary.tone === 'eval' ? 'secondary' : 'default'}
        >
          {tx('Làm ngay', 'Do now')}
        </Badge>
        <div className="flex items-start gap-3">
          <span
            className={cn(
              'flex size-10 shrink-0 items-center justify-center rounded-xl text-white',
              primary.tone === 'eval' ? 'bg-violet-600' : 'bg-primary',
            )}
          >
            <PrimaryIcon className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-heading text-base font-semibold sm:text-lg">
              {primary.title}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              {primary.body}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {primary.runMatch ? (
                <Button
                  size="sm"
                  className="h-9 rounded-full"
                  disabled={runningMatch}
                  onClick={() => void runMatchNow()}
                >
                  {runningMatch ? (
                    <RefreshCw className="size-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="size-3.5" />
                  )}
                  {primary.cta}
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="h-9 rounded-full"
                  onClick={() => navigate(primary.to)}
                >
                  {primary.cta}
                  <ArrowRight className="size-3.5" />
                </Button>
              )}
              {!hasProfile ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 rounded-full"
                  onClick={() => navigate('/setup')}
                >
                  <Upload className="size-3.5" />
                  {tx('Tải deck', 'Upload deck')}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
        {hasProfile ? (
          <div className="mt-3 space-y-1 border-t border-border/50 pt-3">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{tx('Hồ sơ', 'Profile')}</span>
              <span className="tabular-nums">{completion}%</span>
            </div>
            <Progress value={completion} className="h-1" />
          </div>
        ) : null}
      </div>

      {/* Additive §7.1 — Hành trình kiểm chứng (hidden if flag off) */}
      {validationOn && activeCases.length > 0 ? (
        <section className="rounded-2xl border border-violet-500/25 bg-violet-500/5 p-3.5">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-violet-800 dark:text-violet-200">
              {tx(
                'Hành trình kiểm chứng đầu tư',
                'Investment validation journey',
              )}
            </h3>
            <button
              type="button"
              className="text-[11px] font-medium text-violet-700 dark:text-violet-300"
              onClick={() => navigate('/evaluations')}
            >
              {tx('Tất cả', 'All')}
            </button>
          </div>
          <ul className="space-y-1.5">
            {activeCases.slice(0, 3).map((c) => {
              const act = caseNextAction(c, tx)
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => navigate(act.to)}
                    className="flex w-full items-center gap-2 rounded-xl border border-violet-500/15 bg-background/60 px-3 py-2.5 text-left hover:bg-background"
                  >
                    <act.icon className="size-4 shrink-0 text-violet-600" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold">
                        {c.investor?.name || c.investorId}
                      </p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {act.label}
                      </p>
                    </div>
                    <ArrowRight className="size-3.5 shrink-0 text-violet-600" />
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      {/* Recent — 2 columns, compact */}
      <div className="grid gap-3 sm:grid-cols-2">
        <section className="rounded-2xl border p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold">
              {tx('Đối tác khớp', 'Matches')}
            </h3>
            <button
              type="button"
              className="text-[11px] font-medium text-primary"
              onClick={() => navigate('/matches')}
            >
              {tx('Mở', 'Open')}
            </button>
          </div>
          {recentMatches.length === 0 ? (
            <p className="py-3 text-center text-[11px] text-muted-foreground">
              {tx('Chưa có', 'None yet')}
            </p>
          ) : (
            <ul className="space-y-1">
              {recentMatches.slice(0, 3).map((m) => {
                const p = m.partner || {}
                return (
                  <li key={m.id || p.id}>
                    <button
                      type="button"
                      onClick={() => navigate('/matches')}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-muted/50"
                    >
                      <Award className="size-3.5 text-primary" />
                      <span className="min-w-0 flex-1 truncate text-xs">
                        {p.organizationName || p.name || '—'}
                      </span>
                      <span className="tabular-nums text-[11px] font-medium">
                        {Number(m.totalScore) || 0}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold">
              {tx('Kết nối', 'Connections')}
            </h3>
            <button
              type="button"
              className="text-[11px] font-medium text-primary"
              onClick={() => navigate('/connections')}
            >
              {tx('Mở', 'Open')}
            </button>
          </div>
          {recentConnections.length === 0 ? (
            <p className="py-3 text-center text-[11px] text-muted-foreground">
              {tx('Chưa có', 'None yet')}
            </p>
          ) : (
            <ul className="space-y-1">
              {recentConnections.slice(0, 3).map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => navigate('/connections')}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-muted/50"
                  >
                    <Link2 className="size-3.5 text-primary" />
                    <span className="min-w-0 flex-1 truncate text-xs">
                      {c.partnerName || '—'}
                    </span>
                    <Badge variant="outline" className="text-[9px] capitalize">
                      {String(c.status || '').toLowerCase() === 'accepted'
                        ? 'OK'
                        : tx('Chờ', 'Wait')}
                    </Badge>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
