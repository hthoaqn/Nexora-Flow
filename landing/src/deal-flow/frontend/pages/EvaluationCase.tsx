// @ts-nocheck
'use client'

/**
 * Module 5–9 evaluation hub — rounds, event hash chain, info requests, final review.
 */

import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ClipboardCheck,
  CheckCircle,
  XCircle,
  Video,
  History,
  Gamepad2,
  Target,
  MessageSquare,
  ArrowRight,
  Lock,
  Sparkles,
} from 'lucide-react'
import { useAuthStore } from '../store/useAuthStore'
import { usePortalI18n } from '../i18n'
import { isInvestorPipelineEnabled } from '@/investor/flags'
import {
  getEvaluationCase,
  acceptEvaluationCase,
  rejectEvaluationCase,
  respondInfoRequest,
  seedDemoInfoRequest,
  demoInvestorFinalDecision,
  startSimulation,
  generateProofChallenge,
} from '@/investor/lib/evaluationStore'
import { useStartupStore } from '../store/useStartupStore'
import { DemoDataBadge } from '@/investor/components/DemoDataBadge'
import type { EvaluationCase as CaseT, RoundKey } from '@/investor/types'
import {
  PortalHero,
  PortalSection,
  PortalEmpty,
  SoftButton,
} from '../components/PortalUI'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const ROUND_ORDER: { key: RoundKey; n: number; icon: typeof Video }[] = [
  { key: 'round_1_pitch', n: 1, icon: Video },
  { key: 'round_2_simulation', n: 2, icon: Gamepad2 },
  { key: 'round_3_proof', n: 3, icon: Target },
]

export default function EvaluationCasePage() {
  const { caseId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { confirmedProfile } = useStartupStore()
  const { t, lang } = usePortalI18n()
  const inv = t.inv
  const tx = (vi, en) => (lang === 'en' ? en : vi)
  const enabled = isInvestorPipelineEnabled()
  const [item, setItem] = useState(null)
  const [answerDraft, setAnswerDraft] = useState({})
  const [recordingOk, setRecordingOk] = useState(false)
  const [dataShareOk, setDataShareOk] = useState(false)

  const reload = () => {
    if (!caseId || !user?.id) return
    setItem(getEvaluationCase(caseId, user.id))
  }

  useEffect(() => {
    reload()
  }, [caseId, user?.id])

  if (!enabled) {
    return (
      <PortalEmpty title={inv.disabledTitle} description={inv.disabledDesc} />
    )
  }

  if (!item) {
    return (
      <PortalEmpty
        title={inv.caseNotFound}
        action={
          <SoftButton size="sm" onClick={() => navigate('/evaluations')}>
            {inv.back}
          </SoftButton>
        }
      />
    )
  }

  const onAccept = () => {
    if (!recordingOk || !dataShareOk) {
      toast.error(
        tx(
          'Cần đồng ý ghi hình và chia sẻ dữ liệu trước khi chấp nhận.',
          'Accept recording + data sharing before joining.',
        ),
      )
      return
    }
    try {
      const next = acceptEvaluationCase(item.id, user.id, {
        recordingAccepted: recordingOk,
        dataSharingAccepted: dataShareOk,
      })
      if (next) {
        setItem(next)
        toast.success(inv.acceptedToast)
      }
    } catch (e) {
      toast.error(String(e?.message || e))
    }
  }

  const onReject = () => {
    const next = rejectEvaluationCase(item.id, user.id)
    if (next) {
      setItem(next)
      toast.message(inv.withdrawnToast)
    }
  }

  const statusLabel =
    inv.caseStatus[item.status] || item.status.replace(/_/g, ' ')

  const goRound = (n: number) => {
    if (n === 1) navigate(`/evaluations/${item.id}/pitch`)
    if (n === 2) {
      startSimulation(item.id, user.id, confirmedProfile)
      navigate(`/evaluations/${item.id}/simulation`)
    }
    if (n === 3) {
      if (!item.proofChallenge) generateProofChallenge(item.id, user.id)
      navigate(`/evaluations/${item.id}/proof`)
    }
  }

  const openReqs = (item.infoRequests || []).filter(
    (r) => r.status === 'open' || r.status === 'answered',
  )

  return (
    <div className="flex w-full flex-col gap-4">
      <PortalHero
        eyebrow={
          <>
            <ClipboardCheck className="size-3" />
            {inv.caseEyebrow}
          </>
        }
        title={item.investor?.name || item.investorId}
        description={item.investor?.investmentThesis}
        actions={
          <>
            {item.is_demo ? <DemoDataBadge /> : null}
            <Badge variant="outline">{statusLabel}</Badge>
            <Badge variant="secondary">v{item.caseVersion}</Badge>
          </>
        }
      />

      <Alert>
        <AlertTitle>{inv.privateTitle}</AlertTitle>
        <AlertDescription className="text-xs">{inv.privateBody}</AlertDescription>
      </Alert>

      {/* Round pipeline */}
      <div className="grid gap-2 sm:grid-cols-3">
        {ROUND_ORDER.map(({ key, n, icon: Icon }) => {
          const st = item.rounds?.[key] || 'locked'
          const locked = st === 'locked'
          const active =
            (n === 1 &&
              ['round_1_ready', 'round_1_in_progress', 'round_1_submitted'].includes(
                item.status,
              )) ||
            (n === 2 &&
              ['round_2_ready', 'round_2_in_progress', 'round_2_submitted'].includes(
                item.status,
              )) ||
            (n === 3 &&
              ['round_3_ready', 'round_3_in_progress', 'round_3_submitted'].includes(
                item.status,
              ))
          return (
            <button
              key={key}
              type="button"
              disabled={locked}
              onClick={() => !locked && goRound(n)}
              className={cn(
                'flex flex-col gap-2 rounded-2xl border p-4 text-left transition-colors',
                locked && 'opacity-50',
                active && 'border-primary/40 bg-primary/5',
                st === 'passed' && 'border-emerald-500/30 bg-emerald-500/5',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="flex size-9 items-center justify-center rounded-xl bg-muted">
                  {locked ? (
                    <Lock className="size-4" />
                  ) : (
                    <Icon className="size-4 text-primary" />
                  )}
                </span>
                <Badge variant="outline" className="text-[10px] capitalize">
                  {st.replace(/_/g, ' ')}
                </Badge>
              </div>
              <p className="text-sm font-semibold">
                {n === 1
                  ? tx('Vòng 1 · Pitch + AI Q&A', 'Round 1 · Pitch + AI Q&A')
                  : n === 2
                    ? tx('Vòng 2 · Mô phỏng', 'Round 2 · Simulation')
                    : tx('Vòng 3 · Minh chứng', 'Round 3 · Proof')}
              </p>
              {!locked ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                  {tx('Mở', 'Open')} <ArrowRight className="size-3" />
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      {/* Matching snapshot — read-only (§4.2) */}
      {item.sourceMatchingSnapshot ? (
        <PortalSection
          title={tx('Snapshot Matching', 'Matching snapshot')}
          description={tx(
            'Chỉ lưu bản sao — không sửa Matching gốc.',
            'Copy only — source Matching is never mutated.',
          )}
        >
          <div className="flex flex-wrap gap-3 text-sm">
            <Badge variant="secondary">
              Score {item.sourceMatchingSnapshot.totalScore}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {item.sourceMatchingSnapshot.matchingVersion}
            </span>
            {(item.sourceMatchingSnapshot.matchedReasons || [])
              .slice(0, 3)
              .map((r) => (
                <Badge key={r} variant="outline" className="text-[10px]">
                  {r}
                </Badge>
              ))}
          </div>
        </PortalSection>
      ) : null}

      {item.status === 'waiting_for_startup_acceptance' ? (
        <PortalSection
          title={inv.acceptTitle}
          description={tx(
            'Không tự chấp nhận vì đã Matching. Cần consent ghi hình + chia sẻ dữ liệu.',
            'Matching alone never auto-accepts. Recording + data-sharing consent required.',
          )}
        >
          <div className="mb-4 space-y-3 rounded-xl border p-3 text-xs">
            <label className="flex items-start gap-2.5">
              <Checkbox
                checked={recordingOk}
                onCheckedChange={(v) => setRecordingOk(v === true)}
              />
              <span>
                <strong>
                  {tx('Đồng ý ghi hình / micro', 'Agree to camera / mic recording')}
                </strong>
                <span className="mt-0.5 block text-muted-foreground">
                  {tx(
                    'Dùng cho Pitch & video minh chứng. Không bắt buộc source code.',
                    'For Pitch & product proof. Source code is never required.',
                  )}
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2.5">
              <Checkbox
                checked={dataShareOk}
                onCheckedChange={(v) => setDataShareOk(v === true)}
              />
              <span>
                <strong>
                  {tx(
                    'Đồng ý chia sẻ dữ liệu kiểm chứng với NĐT này',
                    'Share validation data with this investor only',
                  )}
                </strong>
                <span className="mt-0.5 block text-muted-foreground">
                  {tx(
                    'Tách biệt từng Case — NĐT khác không thấy.',
                    'Per-case isolation — other investors cannot see this.',
                  )}
                </span>
              </span>
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              className="rounded-full"
              disabled={!recordingOk || !dataShareOk}
              onClick={onAccept}
            >
              <CheckCircle className="size-4" />
              {inv.acceptCta}
            </Button>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={onReject}
            >
              <XCircle className="size-4" />
              {inv.withdrawCta}
            </Button>
          </div>
        </PortalSection>
      ) : null}

      {/* Score separation § AI vs Investor */}
      {(item.aiScore != null || item.investorScore != null) &&
      item.sharePermissions?.shareAiScoreWithStartup !== false ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border p-4">
            <p className="text-[10px] text-muted-foreground">
              {tx('Điểm AI (sơ bộ)', 'AI preliminary score')}
            </p>
            <p className="font-heading text-2xl font-semibold tabular-nums">
              {item.aiScore ?? '—'}
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {tx(
                'Không phải quyết định đầu tư.',
                'Not an investment decision.',
              )}
            </p>
          </div>
          <div className="rounded-xl border p-4">
            <p className="text-[10px] text-muted-foreground">
              {tx('Điểm Nhà đầu tư', 'Investor reviewed score')}
            </p>
            <p className="font-heading text-2xl font-semibold tabular-nums">
              {item.investorScore ?? '—'}
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {tx(
                'Tách biệt — NĐT có thể điều chỉnh sau AI.',
                'Separate — investor may adjust after AI.',
              )}
            </p>
          </div>
        </div>
      ) : null}

      {item.pitchAiJob?.publicFeedback ? (
        <PortalSection
          title={tx('Phản hồi AI (công khai)', 'Public AI feedback')}
        >
          <div className="grid gap-3 text-xs sm:grid-cols-3">
            <div>
              <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                Strengths
              </p>
              <ul className="mt-1 list-inside list-disc text-muted-foreground">
                {item.pitchAiJob.publicFeedback.strengths.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-semibold text-amber-700 dark:text-amber-400">
                Unclear
              </p>
              <ul className="mt-1 list-inside list-disc text-muted-foreground">
                {item.pitchAiJob.publicFeedback.unclear.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-semibold">
                {tx('Cần bổ sung', 'Needs more')}
              </p>
              <ul className="mt-1 list-inside list-disc text-muted-foreground">
                {item.pitchAiJob.publicFeedback.needsMore.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          </div>
        </PortalSection>
      ) : null}

      {/* Info requests (M9) */}
      <PortalSection
        title={tx('Yêu cầu thông tin', 'Information requests')}
        description={tx(
          'Investor hỏi bổ sung — trả lời plain text.',
          'Investor follow-ups — answer in plain text.',
        )}
      >
        {openReqs.length === 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs text-muted-foreground">
              {tx('Chưa có yêu cầu mở.', 'No open requests.')}
            </p>
            {item.is_demo ? (
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                onClick={() => {
                  const n = seedDemoInfoRequest(item.id)
                  if (n) setItem(n)
                  toast.message(tx('Đã tạo yêu cầu demo', 'Demo request created'))
                }}
              >
                <MessageSquare className="size-3.5" />
                {tx('Tạo yêu cầu demo', 'Seed demo request')}
              </Button>
            ) : null}
          </div>
        ) : (
          <ul className="space-y-3">
            {openReqs.map((r) => (
              <li key={r.id} className="rounded-xl border p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    {r.status}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(r.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm font-medium">{r.question}</p>
                {r.status === 'open' ? (
                  <div className="mt-2 space-y-2">
                    <Textarea
                      rows={3}
                      value={answerDraft[r.id] || ''}
                      onChange={(e) =>
                        setAnswerDraft((d) => ({
                          ...d,
                          [r.id]: e.target.value,
                        }))
                      }
                      placeholder={tx('Trả lời…', 'Your answer…')}
                    />
                    <Button
                      size="sm"
                      className="rounded-full"
                      onClick={() => {
                        const text = (answerDraft[r.id] || '').trim()
                        if (!text) return
                        const n = respondInfoRequest(
                          item.id,
                          user.id,
                          r.id,
                          text,
                        )
                        if (n) setItem(n)
                        toast.success(tx('Đã gửi trả lời', 'Answer sent'))
                      }}
                    >
                      {tx('Gửi trả lời', 'Send answer')}
                    </Button>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap">
                    {r.answer}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </PortalSection>

      {/* Final review (M9) */}
      {item.finalReview ? (
        <PortalSection
          title={tx('Tổng hợp cuối (Module 9)', 'Final review (Module 9)')}
          description={tx(
            'Điểm tổng hợp: Matching 15% · Pitch+Q&A 35% · Sim 25% · Proof 25%.',
            'Consolidated score weights as in the walkthrough.',
          )}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border p-3">
              <p className="text-[10px] text-muted-foreground">
                {tx('Điểm hệ thống', 'System score')}
              </p>
              <p className="font-heading text-2xl font-semibold tabular-nums">
                {item.finalReview.systemScore}
              </p>
            </div>
            <div className="rounded-xl border p-3">
              <p className="text-[10px] text-muted-foreground">Confidence</p>
              <p className="font-heading text-2xl font-semibold tabular-nums">
                {Math.round(item.finalReview.confidence * 100)}%
              </p>
            </div>
            <div className="rounded-xl border p-3">
              <p className="text-[10px] text-muted-foreground">
                {tx('Quyết định', 'Decision')}
              </p>
              <p className="text-sm font-semibold">
                {item.finalReview.decision ||
                  tx('Chờ investor', 'Awaiting investor')}
              </p>
            </div>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                Strengths
              </p>
              <ul className="list-inside list-disc text-xs text-muted-foreground">
                {item.finalReview.strengths.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
                Concerns
              </p>
              <ul className="list-inside list-disc text-xs text-muted-foreground">
                {item.finalReview.concerns.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          </div>
          {item.finalReview.limitations?.length ? (
            <Alert className="mt-3">
              <Sparkles className="size-4" />
              <AlertTitle className="text-sm">
                {tx('Ranh giới AI', 'AI limitations')}
              </AlertTitle>
              <AlertDescription className="text-xs">
                <ul className="list-inside list-disc">
                  {item.finalReview.limitations.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          ) : null}
          {item.status === 'ready_for_final_review' && item.is_demo ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                className="rounded-full"
                onClick={() => {
                  try {
                    const n = demoInvestorFinalDecision(
                      item.id,
                      'proceed_to_due_diligence',
                    )
                    if (n) setItem(n)
                    toast.success('proceed_to_due_diligence')
                  } catch (e) {
                    toast.error(String(e.message || e))
                  }
                }}
              >
                {tx('Demo: Due diligence', 'Demo: Due diligence')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                onClick={() => {
                  try {
                    const n = demoInvestorFinalDecision(
                      item.id,
                      'not_proceeding',
                    )
                    if (n) setItem(n)
                  } catch (e) {
                    toast.error(String(e.message || e))
                  }
                }}
              >
                not_proceeding
              </Button>
            </div>
          ) : null}
        </PortalSection>
      ) : null}

      {/* Event log with hash chain */}
      <PortalSection title={inv.eventLog} description={inv.eventLogDesc}>
        <ul className="flex flex-col gap-2">
          {(item.events || []).length === 0 ? (
            <li className="text-sm text-muted-foreground">—</li>
          ) : (
            [...(item.events || [])].reverse().map((e) => (
              <li
                key={e.id}
                className="flex items-start gap-2 rounded-lg border px-3 py-2 text-xs"
              >
                <History className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{e.eventType}</p>
                  <p className="text-muted-foreground">
                    {e.actorType} · {new Date(e.createdAt).toLocaleString()}
                  </p>
                  {e.eventHash ? (
                    <p className="mt-0.5 font-mono text-[10px] text-muted-foreground/80">
                      hash {e.eventHash}
                      {e.prevEventHash ? ` ← ${e.prevEventHash}` : ' (genesis)'}
                    </p>
                  ) : null}
                </div>
              </li>
            ))
          )}
        </ul>
      </PortalSection>
    </div>
  )
}
