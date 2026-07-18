// @ts-nocheck
'use client'

/**
 * §7.2 Startup list of validation cases — additive UI, filters, progress.
 * Hidden entirely when validation feature flag is off.
 */

import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ClipboardCheck,
  ArrowRight,
  Clock,
  AlertCircle,
} from 'lucide-react'
import { useAuthStore } from '../store/useAuthStore'
import { usePortalI18n } from '../i18n'
import { isValidationEnabled } from '@/investor/flags'
import {
  filterEvaluationCases,
  type CaseListFilter,
} from '@/investor/lib/evaluationStore'
import { DemoDataBadge } from '@/investor/components/DemoDataBadge'
import type { EvaluationCase } from '@/investor/types'
import {
  PortalHero,
  PortalEmpty,
  SoftButton,
} from '../components/PortalUI'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const FILTERS: { id: CaseListFilter; vi: string; en: string }[] = [
  { id: 'all', vi: 'Tất cả', en: 'All' },
  { id: 'waiting', vi: 'Đang chờ', en: 'Waiting' },
  { id: 'active', vi: 'Đang làm', en: 'Active' },
  { id: 'needs_info', vi: 'Cần bổ sung', en: 'Needs info' },
  { id: 'completed', vi: 'Hoàn thành', en: 'Done' },
  { id: 'rejected', vi: 'Từ chối', en: 'Rejected' },
  { id: 'withdrawn', vi: 'Đã rút', en: 'Withdrawn' },
]

function progressPct(c: EvaluationCase): number {
  const st = c.status
  if (st === 'completed') return 100
  if (st === 'withdrawn' || st === 'rejected' || st === 'cancelled') return 0
  if (st === 'waiting_for_startup_acceptance') return 5
  if (st.startsWith('round_1') || st === 'waiting_for_investor_review') return 25
  if (st.startsWith('round_2')) return 50
  if (st.startsWith('round_3')) return 75
  if (st === 'ready_for_final_review') return 90
  return 10
}

function nextTask(c: EvaluationCase, lang: string) {
  const st = c.status
  const openInfo = (c.infoRequests || []).filter((r) => r.status === 'open')
    .length
  if (openInfo > 0)
    return lang === 'en'
      ? `${openInfo} info request(s)`
      : `${openInfo} yêu cầu bổ sung`
  if (st === 'waiting_for_startup_acceptance')
    return lang === 'en' ? 'Accept journey' : 'Chấp nhận hành trình'
  if (st === 'round_1_ready' || st === 'round_1_in_progress')
    return lang === 'en' ? 'Record pitch' : 'Ghi pitch'
  if (st === 'round_2_ready' || st === 'round_2_in_progress')
    return lang === 'en' ? 'Run simulation' : 'Chạy mô phỏng'
  if (st === 'round_3_ready' || st === 'round_3_in_progress')
    return lang === 'en' ? 'Submit product video' : 'Nộp video sản phẩm'
  if (st === 'ready_for_final_review')
    return lang === 'en' ? 'Await final decision' : 'Chờ quyết định cuối'
  if (st === 'completed') return lang === 'en' ? 'View result' : 'Xem kết quả'
  return lang === 'en' ? 'Open case' : 'Mở hồ sơ'
}

export default function Evaluations() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { t, lang } = usePortalI18n()
  const inv = t.inv
  const enabled = isValidationEnabled()
  const [filter, setFilter] = useState<CaseListFilter>('all')
  const [cases, setCases] = useState<EvaluationCase[]>([])

  useEffect(() => {
    if (!enabled || !user?.id) return
    setCases(filterEvaluationCases(user.id, filter))
  }, [enabled, user?.id, filter])

  const statusLabel = (status: string) =>
    inv.caseStatus[status] || status.replace(/_/g, ' ')

  if (!enabled) {
    return (
      <PortalEmpty title={inv.disabledTitle} description={inv.disabledDesc} />
    )
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <PortalHero
        eyebrow={
          <>
            <ClipboardCheck className="size-3" />
            {lang === 'en'
              ? 'Investment validation journey'
              : 'Hành trình kiểm chứng đầu tư'}
          </>
        }
        title={
          lang === 'en'
            ? 'My validation cases'
            : 'Hồ sơ kiểm chứng của tôi'
        }
        description={
          lang === 'en'
            ? 'One private case per investor match. Matching stays unchanged. Accept only after you review terms.'
            : 'Mỗi nhà đầu tư một hồ sơ riêng. Matching không đổi. Chỉ chấp nhận sau khi đọc điều khoản.'
        }
        actions={
          <SoftButton
            size="sm"
            variant="outline"
            className="rounded-full"
            onClick={() => navigate('/investor-matches')}
          >
            {inv.goMatches}
          </SoftButton>
        }
      />

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
              filter === f.id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:border-primary/40',
            )}
          >
            {lang === 'en' ? f.en : f.vi}
          </button>
        ))}
      </div>

      {cases.length === 0 ? (
        <PortalEmpty
          icon={<ClipboardCheck className="size-5" />}
          title={inv.noCasesTitle}
          description={inv.noCasesDesc}
          action={
            <SoftButton size="sm" onClick={() => navigate('/investor-matches')}>
              {inv.goMatchesCta}
            </SoftButton>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {cases.map((c) => {
            const snap = c.sourceMatchingSnapshot
            const openInfo = (c.infoRequests || []).filter(
              (r) => r.status === 'open',
            ).length
            const pct = progressPct(c)
            return (
              <li
                key={c.id}
                className="rounded-2xl border bg-card/60 p-4 transition-colors hover:border-primary/30"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="font-heading text-base font-semibold">
                        {c.investor?.name || c.investorId}
                      </p>
                      {c.is_demo ? <DemoDataBadge /> : null}
                      <Badge variant="outline" className="text-[10px]">
                        {statusLabel(c.status)}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {lang === 'en' ? 'Round' : 'Vòng'}{' '}
                        {c.currentRound || '—'}
                      </Badge>
                      {openInfo > 0 ? (
                        <Badge className="gap-1 text-[10px]">
                          <AlertCircle className="size-3" />
                          {openInfo}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                      {snap ? (
                        <span>
                          Match {snap.totalScore}%
                          {snap.matchedReasons?.[0]
                            ? ` · ${snap.matchedReasons[0]}`
                            : ''}
                        </span>
                      ) : null}
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3" />
                        {c.deadlineAt
                          ? new Date(c.deadlineAt).toLocaleDateString()
                          : '—'}
                      </span>
                      <span>
                        {lang === 'en' ? 'Updated' : 'Cập nhật'}{' '}
                        {new Date(c.updatedAt).toLocaleString()}
                      </span>
                    </p>
                    <div className="max-w-xs space-y-1">
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>{nextTask(c, lang)}</span>
                        <span className="tabular-nums">{pct}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    {c.aiScore != null &&
                    c.sharePermissions?.shareAiScoreWithStartup !== false ? (
                      <p className="text-[11px] text-muted-foreground">
                        AI score: <strong>{c.aiScore}</strong>
                        {c.investorScore != null
                          ? ` · ${lang === 'en' ? 'Investor' : 'NĐT'}: ${c.investorScore}`
                          : ''}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    size="sm"
                    className="shrink-0 rounded-full"
                    onClick={() => navigate(`/evaluations/${c.id}`)}
                  >
                    {inv.open}
                    <ArrowRight className="size-3.5" />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
