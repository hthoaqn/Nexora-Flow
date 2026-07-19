'use client'

/**
 * Full match analysis A–Z:
 * overview, 7-dim diagram, contribution table, strengths/weaknesses,
 * next actions, reasons/risks, auto DeepSeek narrative, open chat.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  analyzeMatch,
  DIM_META,
  type DimKey,
  type MatchInsight,
} from '@/lib/match-analysis'
import { coachFetch } from '@/lib/ai/coach-client'
import { useTx } from '@/lib/tx'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  ArrowRightIcon,
  Loader2Icon,
  SparklesIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  ListChecksIcon,
  ScaleIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  RefreshCwIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  match: any
  startupProfile?: any
  lang?: 'vi' | 'en'
  className?: string
  onOpenChat?: () => void
  /** Auto call /api/ai/match-analysis with useLlm (default true) */
  autoDeepAnalysis?: boolean
}

function levelColor(level: string) {
  switch (level) {
    case 'strong':
      return 'bg-emerald-500'
    case 'ok':
      return 'bg-sky-500'
    case 'weak':
      return 'bg-amber-500'
    default:
      return 'bg-rose-500'
  }
}

function levelBadge(level: string, L: boolean) {
  const map: Record<string, { vi: string; en: string; cls: string }> = {
    strong: {
      vi: 'Mạnh',
      en: 'Strong',
      cls: 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300',
    },
    ok: {
      vi: 'Ổn',
      en: 'OK',
      cls: 'border-sky-500/40 text-sky-700 dark:text-sky-300',
    },
    weak: {
      vi: 'Yếu',
      en: 'Weak',
      cls: 'border-amber-500/40 text-amber-700 dark:text-amber-300',
    },
    critical: {
      vi: 'Rất yếu',
      en: 'Critical',
      cls: 'border-rose-500/40 text-rose-700 dark:text-rose-300',
    },
  }
  const m = map[level] || map.weak
  return (
    <Badge variant="outline" className={cn('h-5 text-[10px]', m.cls)}>
      {L ? m.en : m.vi}
    </Badge>
  )
}

/** Normalize various backend field names into analysis input */
function normalizeMatchPayload(match: any, startupProfile: any, lang: string) {
  const b =
    match?.scoreBreakdown ||
    match?.breakdown ||
    match?.scores ||
    match?.dimensionScores ||
    {}
  // Some APIs nest partner under partnerProfile
  const partner = match?.partner || match?.partnerProfile || {}
  return {
    totalScore: match?.totalScore ?? match?.score ?? match?.fitScore,
    scoreBreakdown: b as Partial<Record<DimKey, number>>,
    matchedReasons:
      match?.matchedReasons || match?.reasons || match?.matchReasons || [],
    risks: match?.risks || match?.riskFlags || [],
    missingRequirements:
      match?.missingRequirements || match?.missing || match?.gaps || [],
    recommendation: match?.recommendation || match?.verdict || '',
    startupName:
      startupProfile?.startupName ||
      startupProfile?.name ||
      (lang === 'vi' ? 'Startup của bạn' : 'Your startup'),
    partnerName:
      partner?.organizationName ||
      partner?.name ||
      match?.partnerName ||
      'Partner',
    partner,
  }
}

export function MatchInsightPanel({
  match,
  startupProfile,
  lang: langProp,
  className,
  onOpenChat,
  autoDeepAnalysis = true,
}: Props) {
  const { tx, lang: siteLang } = useTx()
  const lang = langProp || (siteLang === 'en' ? 'en' : 'vi')
  const [insight, setInsight] = useState<MatchInsight | null>(null)
  const [llmText, setLlmText] = useState<string | null>(null)
  const [loadingLlm, setLoadingLlm] = useState(false)
  const [llmErr, setLlmErr] = useState<string | null>(null)
  const [llmModel, setLlmModel] = useState<string | null>(null)
  const [source, setSource] = useState<string>('heuristic')
  const ranFor = useRef<string>('')

  const norm = useMemo(
    () => normalizeMatchPayload(match, startupProfile, lang),
    [match, startupProfile, lang],
  )

  const local = useMemo(
    () =>
      analyzeMatch({
        totalScore: norm.totalScore,
        scoreBreakdown: norm.scoreBreakdown,
        matchedReasons: norm.matchedReasons,
        risks: norm.risks,
        missingRequirements: norm.missingRequirements,
        recommendation: norm.recommendation,
        startupName: norm.startupName,
        partnerName: norm.partnerName,
      }),
    [norm],
  )

  const matchKey = String(
    match?.id || match?.partnerId || match?.partner?.id || norm.partnerName,
  )

  useEffect(() => {
    setInsight(local)
    setLlmText(null)
    setLlmErr(null)
    setLlmModel(null)
    setSource('heuristic')
    ranFor.current = ''
  }, [local, matchKey])

  const runLlm = useCallback(async () => {
    setLoadingLlm(true)
    setLlmErr(null)
    try {
      const res = await coachFetch('/match-analysis', {
        method: 'POST',
        body: JSON.stringify({
          match: {
            ...match,
            totalScore: norm.totalScore,
            scoreBreakdown: {
              ...Object.fromEntries(
                (Object.keys(DIM_META) as DimKey[]).map((k) => [
                  k,
                  Number(
                    (norm.scoreBreakdown as any)?.[k] ??
                      match?.scoreBreakdown?.[k] ??
                      match?.breakdown?.[k] ??
                      0,
                  ),
                ]),
              ),
            },
            matchedReasons: norm.matchedReasons,
            risks: norm.risks,
            missingRequirements: norm.missingRequirements,
            recommendation: norm.recommendation,
            partner: norm.partner,
          },
          startupProfile,
          lang,
          useLlm: true,
        }),
      })
      const body = await res.json()
      const data = body?.data ?? body
      if (data?.insight) setInsight(data.insight)
      if (data?.llmNarrative) {
        setLlmText(data.llmNarrative)
        setSource(data.source || 'heuristic+ollama')
      } else if (data?.llmError) {
        setLlmErr(data.llmError)
        setSource(data.source || 'heuristic')
      } else if (!res.ok) {
        setLlmErr(
          typeof body?.detail === 'string'
            ? body.detail
            : body?.message || `HTTP ${res.status}`,
        )
      }
      if (data?.llmModel) setLlmModel(data.llmModel)
    } catch (e) {
      setLlmErr(e instanceof Error ? e.message : 'failed')
    } finally {
      setLoadingLlm(false)
    }
  }, [match, startupProfile, lang, norm])

  // Auto deep analysis when panel opens / match changes
  useEffect(() => {
    if (!autoDeepAnalysis) return
    if (!matchKey) return
    if (ranFor.current === matchKey) return
    ranFor.current = matchKey
    void runLlm()
  }, [autoDeepAnalysis, matchKey, runLlm])

  if (!insight) return null
  const L = lang === 'en'
  const contribTotal = insight.all.reduce((s, d) => s + d.weighted, 0)

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Score + summary */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              {tx('Tổng quan fit', 'Fit overview')}
            </p>
            <p className="mt-1 text-sm leading-relaxed">
              {L ? insight.summaryEn : insight.summaryVi}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge variant="secondary" className="text-[10px]">
                {insight.strengths.length} {L ? 'strengths' : 'điểm mạnh'}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {insight.weaknesses.length} {L ? 'weaknesses' : 'điểm yếu'}
              </Badge>
              {norm.recommendation ? (
                <Badge variant="outline" className="text-[10px] capitalize">
                  {String(norm.recommendation)}
                </Badge>
              ) : null}
              <Badge variant="outline" className="text-[10px]">
                {source}
                {llmModel ? ` · ${llmModel}` : ''}
              </Badge>
            </div>
          </div>
          <div className="rounded-2xl border border-primary/30 bg-primary/10 px-4 py-2 text-center">
            <p className="font-heading text-3xl font-bold tabular-nums text-primary">
              {insight.totalScore}
            </p>
            <p className="text-[10px] text-muted-foreground">/ 100</p>
          </div>
        </div>
      </div>

      {/* Diagram: startup --dims-- partner */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="mb-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          {tx('Sơ đồ so khớp 7 chiều', '7-dimension match diagram')}
        </p>
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="rounded-xl border border-primary/25 bg-primary/10 px-3 py-3 text-center sm:max-w-[28%]">
            <p className="text-[10px] text-muted-foreground">Startup</p>
            <p className="font-heading text-sm font-semibold line-clamp-2">
              {insight.diagram.startupLabel}
            </p>
          </div>

          <div className="min-w-0 flex-1 space-y-1.5">
            {insight.diagram.edges.map((e) => (
              <div key={e.key} className="flex items-center gap-2 text-[11px]">
                <span className="w-16 shrink-0 truncate text-muted-foreground sm:w-20">
                  {L ? e.labelEn : e.labelVi}
                </span>
                <div className="relative h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      e.score >= 80
                        ? 'bg-emerald-500'
                        : e.score >= 55
                          ? 'bg-sky-500'
                          : e.score >= 30
                            ? 'bg-amber-500'
                            : 'bg-rose-500',
                    )}
                    style={{ width: `${Math.max(2, e.score)}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right tabular-nums font-medium">
                  {e.score}
                </span>
              </div>
            ))}
          </div>

          <div className="hidden sm:flex items-center text-primary">
            <ArrowRightIcon className="size-5" />
          </div>

          <div className="rounded-xl border border-border bg-muted/40 px-3 py-3 text-center sm:max-w-[28%]">
            <p className="text-[10px] text-muted-foreground">Partner</p>
            <p className="font-heading text-sm font-semibold line-clamp-2">
              {insight.diagram.partnerLabel}
            </p>
          </div>
        </div>
        <p className="mt-3 text-[10px] text-muted-foreground">
          {tx(
            'Thanh màu = điểm chiều (0–100). Xanh = mạnh · Vàng/Đỏ = yếu — đó là lý do tổng thấp.',
            'Bar = dimension score (0–100). Green = strong · Amber/Red = weak — why total is low.',
          )}
        </p>
      </div>

      {/* Contribution table — why total is X */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          <ScaleIcon className="size-3.5 text-primary" />
          {tx(
            'Bảng đóng góp (điểm × trọng số)',
            'Contribution table (score × weight)',
          )}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[320px] text-left text-xs">
            <thead>
              <tr className="border-b text-[10px] text-muted-foreground uppercase">
                <th className="py-1.5 pr-2 font-medium">
                  {L ? 'Dimension' : 'Chiều'}
                </th>
                <th className="py-1.5 pr-2 font-medium text-right">
                  {L ? 'Score' : 'Điểm'}
                </th>
                <th className="py-1.5 pr-2 font-medium text-right">
                  {L ? 'Weight' : 'TS'}
                </th>
                <th className="py-1.5 pr-2 font-medium text-right">
                  {L ? 'Contrib' : 'Đóng góp'}
                </th>
                <th className="py-1.5 font-medium">{L ? 'Level' : 'Mức'}</th>
              </tr>
            </thead>
            <tbody>
              {[...insight.all]
                .sort((a, b) => a.score - b.score)
                .map((d) => (
                  <tr key={d.key} className="border-b border-border/50">
                    <td className="py-1.5 pr-2 font-medium">
                      {L ? d.labelEn : d.labelVi}
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">
                      {d.score}
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums text-muted-foreground">
                      {Math.round(d.weight * 100)}%
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums font-semibold">
                      {d.weighted}
                    </td>
                    <td className="py-1.5">{levelBadge(d.level, L)}</td>
                  </tr>
                ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td className="pt-2" colSpan={3}>
                  {L ? 'Weighted sum' : 'Tổng có trọng số'}
                </td>
                <td className="pt-2 text-right tabular-nums text-primary">
                  ≈ {Math.round(contribTotal * 10) / 10}
                </td>
                <td className="pt-2 text-[10px] text-muted-foreground">
                  → {insight.totalScore}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">
          {tx(
            'Chiều yếu + trọng số cao (vd. Lĩnh vực 25%) kéo tổng xuống mạnh nhất.',
            'Weak dims with high weight (e.g. Industry 25%) drag the total the most.',
          )}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            <ThumbsUpIcon className="size-3.5" />
            {tx('Điểm mạnh', 'Strengths')}
          </p>
          {insight.strengths.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {tx('Chưa có chiều nào ≥ 55.', 'No dimension ≥ 55 yet.')}
            </p>
          ) : (
            <ul className="space-y-2">
              {insight.strengths.map((d) => (
                <li key={d.key} className="text-xs">
                  <div className="mb-0.5 flex justify-between gap-2">
                    <span className="font-medium">
                      {L ? d.labelEn : d.labelVi}
                    </span>
                    <div className="flex items-center gap-1">
                      {levelBadge(d.level, L)}
                      <Badge
                        variant="outline"
                        className="h-5 tabular-nums text-[10px]"
                      >
                        {d.score}
                      </Badge>
                    </div>
                  </div>
                  <Progress value={d.score} className="h-1.5" />
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {L ? d.tipEn : d.tipVi}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-rose-500/25 bg-rose-500/5 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300">
            <ThumbsDownIcon className="size-3.5" />
            {tx('Điểm yếu (vì sao thấp)', 'Weaknesses (why low)')}
          </p>
          {insight.weaknesses.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {tx('Không có chiều yếu rõ.', 'No clear weak dimensions.')}
            </p>
          ) : (
            <ul className="space-y-2">
              {insight.weaknesses.map((d) => (
                <li key={d.key} className="text-xs">
                  <div className="mb-0.5 flex justify-between gap-2">
                    <span className="font-medium">
                      {L ? d.labelEn : d.labelVi}
                    </span>
                    <span className="flex items-center gap-1">
                      <span
                        className={cn(
                          'size-1.5 rounded-full',
                          levelColor(d.level),
                        )}
                      />
                      {levelBadge(d.level, L)}
                      <Badge
                        variant="outline"
                        className="h-5 tabular-nums text-[10px]"
                      >
                        {d.score}
                      </Badge>
                    </span>
                  </div>
                  <Progress value={d.score} className="h-1.5" />
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {L ? d.tipEn : d.tipVi}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-3">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
          <ListChecksIcon className="size-3.5 text-primary" />
          {tx('Việc nên làm tiếp', 'Next actions')}
        </p>
        <ol className="list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
          {(L ? insight.nextActionsEn : insight.nextActionsVi).map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ol>
      </div>

      {(norm.matchedReasons?.length ||
        norm.risks?.length ||
        norm.missingRequirements?.length) && (
        <div className="grid gap-2 sm:grid-cols-3 text-xs">
          {norm.matchedReasons?.length ? (
            <div className="rounded-lg border bg-muted/20 p-2">
              <p className="mb-1 flex items-center gap-1 font-semibold">
                <CheckCircle2Icon className="size-3 text-emerald-600" />
                {tx('Lý do khớp', 'Match reasons')}
              </p>
              <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
                {norm.matchedReasons.slice(0, 6).map((r: string, i: number) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {norm.risks?.length ? (
            <div className="rounded-lg border bg-muted/20 p-2">
              <p className="mb-1 flex items-center gap-1 font-semibold">
                <AlertTriangleIcon className="size-3 text-amber-600" />
                {tx('Rủi ro', 'Risks')}
              </p>
              <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
                {norm.risks.slice(0, 6).map((r: string, i: number) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {norm.missingRequirements?.length ? (
            <div className="rounded-lg border bg-muted/20 p-2">
              <p className="mb-1 font-semibold">
                {tx('Thiếu yêu cầu', 'Missing requirements')}
              </p>
              <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
                {norm.missingRequirements
                  .slice(0, 6)
                  .map((r: string, i: number) => (
                    <li key={i}>{r}</li>
                  ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}

      {/* AI narrative */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-primary">
          <SparklesIcon className="size-3.5" />
          {tx(
            'Phân tích AI (DeepSeek R1)',
            'AI analysis (DeepSeek R1)',
          )}
          {loadingLlm ? (
            <Loader2Icon className="size-3.5 animate-spin" />
          ) : null}
        </p>
        {loadingLlm && !llmText ? (
          <p className="text-xs text-muted-foreground">
            {tx(
              'Đang gọi api.nexora-flow.cloud · deepseek-r1:8b — có thể 20–60s…',
              'Calling api.nexora-flow.cloud · deepseek-r1:8b — may take 20–60s…',
            )}
          </p>
        ) : null}
        {llmText ? (
          <div className="text-xs leading-relaxed whitespace-pre-wrap">
            {llmText}
          </div>
        ) : null}
        {llmErr && !llmText ? (
          <p className="text-[11px] text-amber-700 dark:text-amber-300">
            {tx(
              'AI narrative chưa sẵn — đang dùng heuristic đầy đủ ở trên.',
              'AI narrative unavailable — full heuristic above still applies.',
            )}{' '}
            ({llmErr})
          </p>
        ) : null}
        {!loadingLlm && !llmText && !llmErr ? (
          <p className="text-xs text-muted-foreground">
            {tx(
              'Bấm làm mới để lấy narrative DeepSeek.',
              'Click refresh for DeepSeek narrative.',
            )}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 pb-1">
        <Button
          size="sm"
          variant="outline"
          className="rounded-full"
          disabled={loadingLlm}
          onClick={() => void runLlm()}
        >
          {loadingLlm ? (
            <Loader2Icon className="size-3.5 animate-spin" />
          ) : (
            <RefreshCwIcon className="size-3.5" />
          )}
          {tx('Làm mới AI', 'Refresh AI')}
        </Button>
        {onOpenChat ? (
          <Button size="sm" className="rounded-full" onClick={onOpenChat}>
            <SparklesIcon className="size-3.5" />
            {tx('Chat với AI Coach', 'Chat with AI Coach')}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
