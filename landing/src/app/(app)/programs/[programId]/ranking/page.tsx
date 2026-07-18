'use client'

import { useTx } from '@/lib/tx'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  GitCompareArrowsIcon,
  PlayIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  TrophyIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth/session'
import {
  listResults,
  listApplications,
  startScreening,
  getScreeningRun,
  retryScreeningRun,
  displayName,
} from '@/lib/api/client'
import type { Application, ScreeningResult, ScreeningRun } from '@/lib/api/types'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { ErrorAlert } from '@/components/dashboard/ErrorAlert'
import { LoadingBlock } from '@/components/dashboard/LoadingBlock'
import { ScoreBadge, ConfidenceIndicator } from '@/components/dashboard/ScoreBadge'
import { StatusBadge } from '@/components/dashboard/StatusBadge'
import { StatCard, StatGrid } from '@/components/dashboard/StatCard'
import { DataPanel, PageShell, Section } from '@/components/dashboard/Section'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Spinner } from '@/components/ui/spinner'

export default function RankingPage() {
  const { tx } = useTx()
  const { session } = useAuth()
  const params = useParams()
  const programId = String(params?.programId ?? "")

  const [results, setResults] = useState<ScreeningResult[]>([])
  const [eligibleApps, setEligibleApps] = useState<Application[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [run, setRun] = useState<ScreeningRun | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [minScore, setMinScore] = useState(0)
  const [eligibleOnly, setEligibleOnly] = useState(false)
  const [starting, setStarting] = useState(false)

  const sessionKey = session
    ? `${session.userId}|${session.organizationId}`
    : ''
  // Debounce minScore so typing doesn't spam API
  const [appliedMinScore, setAppliedMinScore] = useState(0)
  useEffect(() => {
    const t = window.setTimeout(() => setAppliedMinScore(minScore), 400)
    return () => window.clearTimeout(t)
  }, [minScore])

  const loadResults = useCallback(async () => {
    if (!session) return
    setLoading(true)
    setError(null)
    try {
      const [resPage, appsPage, scored] = await Promise.all([
        listResults(session, programId, {
          minScore: appliedMinScore,
          eligible: eligibleOnly ? true : null,
          limit: 100,
        }),
        listApplications(session, programId, { status: 'ELIGIBLE', limit: 100 }),
        listApplications(session, programId, {
          status: 'SCORED',
          limit: 50,
        }).catch(() => ({ items: [] as Application[] })),
      ])
      setResults(resPage.items || [])
      setEligibleApps([...(appsPage.items || []), ...(scored.items || [])])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load rankings')
    } finally {
      setLoading(false)
    }
  }, [session, programId, appliedMinScore, eligibleOnly])

  useEffect(() => {
    if (!sessionKey || !programId) return
    void loadResults()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey, programId, appliedMinScore, eligibleOnly])

  useEffect(() => {
    if (!session || !run || run.status === 'COMPLETED' || run.status === 'FAILED') return
    const id = window.setInterval(async () => {
      try {
        const next = await getScreeningRun(session, run.id)
        setRun(next)
        if (next.status === 'COMPLETED' || next.status === 'FAILED') {
          void loadResults()
          if (next.status === 'COMPLETED') {
            toast.success(tx('Chấm xong', 'Scoring complete'))
          }
          if (next.status === 'FAILED') {
            const detail =
              next.message ||
              next.errors
                ?.map((e) => e.error)
                .filter(Boolean)
                .slice(0, 2)
                .join(' · ')
            toast.error(
              detail
                ? `${tx('Chấm thất bại', 'Scoring failed')}: ${detail}`
                : tx(
                    'Chấm thất bại — không có kết quả. Kiểm tra hồ sơ ELIGIBLE và thử lại.',
                    'Scoring failed — no results. Check ELIGIBLE apps and retry.',
                  ),
            )
          }
        }
      } catch {
        /* poll */
      }
    }, 3000)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey, run?.id, run?.status])

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const onStart = async () => {
    if (!session) return
    setStarting(true)
    try {
      const body = selected.length === 0 ? {} : { applicationIds: selected }
      setRun(await startScreening(session, programId, body))
      toast.message(tx('Đang chấm…', 'Scoring…'))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tx('Lỗi', 'Error'))
    } finally {
      setStarting(false)
    }
  }

  const sorted = [...results].sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0))
  const avgScore =
    sorted.length > 0
      ? Math.round(sorted.reduce((s, r) => s + (r.totalScore ?? 0), 0) / sorted.length)
      : 0
  const topScore = sorted[0]?.totalScore ?? 0

  return (
    <PageShell>
      <PageHeader
        title={tx('Xếp hạng')}
        description={tx(
          'Chấm hồ sơ đã xác nhận — điểm cuối do backend. Confidence = tin cậy dữ liệu. Eligible = hard filter, không phải ACCEPT/REJECT.',
          'Score confirmed apps — final score from backend. Confidence = data trust. Eligible = hard filter, not ACCEPT/REJECT.',
        )}
        meta={
          <>
            <Badge variant="secondary">{results.length} {tx('kết quả', 'results')}</Badge>
            <Badge variant="outline">{eligibleApps.length} {tx('sẵn sàng chấm', 'ready to score')}</Badge>
            <Badge variant="outline" className="border-primary/30 text-primary">
              {tx('Người chốt', 'Human final')}
            </Badge>
          </>
        }
        actions={
          <>
            <Button size="sm" disabled={starting} onClick={() => void onStart()}>
              {starting ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <PlayIcon data-icon="inline-start" />
              )}
              {selected.length ? tx(`Chấm ${selected.length}`, `Score ${selected.length}`) : tx('Chấm tất cả', 'Score all')}
            </Button>
            <Button variant="outline" size="icon-sm" onClick={loadResults}>
              <RefreshCwIcon />
            </Button>
          </>
        }
      />

      <div className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm">
        <p className="font-semibold">
          {eligibleApps.length === 0
            ? tx(
                'Chưa có hồ sơ sẵn sàng chấm — mở Hồ sơ và xác nhận trước.',
                'No apps ready to score — open Applications and confirm first.',
              )
            : results.length === 0
              ? tx(
                  `Có ${eligibleApps.length} hồ sơ sẵn sàng. Bấm «Chấm tất cả» ở trên.`,
                  `${eligibleApps.length} apps ready. Click “Score all” above.`,
                )
              : tx(
                  'Đã có điểm. Mở Hồ sơ → tab Quyết định để rút gọn hoặc chấp nhận.',
                  'Scores ready. Open Applications → Decision tab to shortlist or accept.',
                )}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {eligibleApps.length > 0 && results.length === 0 ? (
            <Button size="sm" className="rounded-full" disabled={starting} onClick={() => void onStart()}>
              {tx('Chấm tất cả ngay', 'Score all now')}
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            render={<Link href={`/programs/${programId}/applications`} />}
            nativeButton={false}
          >
            {tx('Mở hồ sơ', 'Open applications')}
          </Button>
        </div>
      </div>

      <StatGrid>
        <StatCard label={tx('Kết quả', 'Results')} value={results.length} icon={TrophyIcon} />
        <StatCard label={tx('Điểm TB', 'Avg score')} value={avgScore} hint={tx('Trong bộ lọc', 'Within filter')} />
        <StatCard label={tx('Điểm cao nhất', 'Top score')} value={topScore} />
        <StatCard label={tx('Sẵn sàng chấm', 'Ready to score')} value={eligibleApps.length} />
      </StatGrid>

      {run ? (
        <Section
          title={tx('Lượt chấm', 'Screening run')}
          description={tx('Tiến độ chấm hiện tại', 'Current scoring progress')}
          size="sm"
          action={
            run.status === 'FAILED' ? (
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                disabled={starting}
                onClick={async () => {
                  if (!session || !run) return
                  setStarting(true)
                  try {
                    setRun(await retryScreeningRun(session, run.id))
                    toast.message(tx('Đang thử lại…', 'Retrying…'))
                  } catch (e) {
                    toast.error(
                      e instanceof Error
                        ? e.message
                        : tx('Thử lại thất bại', 'Retry failed'),
                    )
                  } finally {
                    setStarting(false)
                  }
                }}
              >
                {starting ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <RotateCcwIcon data-icon="inline-start" />
                )}
                {tx('Thử lại', 'Retry')}
              </Button>
            ) : null
          }
        >
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <StatusBadge status={String(run.status)} kind="run" />
              <Progress
                value={Math.round((run.progress ?? 0) * 100)}
                className="h-2 w-full min-w-0 flex-1"
              />
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {Math.round((run.progress ?? 0) * 100)}% ·{' '}
                {run.resultIds?.length ?? 0}{' '}
                {tx('kết quả', 'results')}
              </span>
            </div>

            {String(run.status).toUpperCase() === 'FAILED' ? (
              <div className="rounded-xl border border-destructive/35 bg-destructive/10 px-3 py-3 text-xs leading-relaxed">
                <p className="font-semibold text-destructive">
                  {tx(
                    'Chấm thất bại — 0 kết quả',
                    'Scoring failed — 0 results',
                  )}
                </p>
                {(run.message ||
                  (Array.isArray(run.errors) && run.errors.length > 0)) && (
                  <p className="mt-1.5 break-words text-muted-foreground">
                    {run.message ||
                      run.errors
                        ?.map((e) => e.error || e.applicationId)
                        .filter(Boolean)
                        .join(' · ')}
                  </p>
                )}
                {!run.message &&
                !(Array.isArray(run.errors) && run.errors.length) ? (
                  <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">
                    <li>
                      {tx(
                        'Chưa có hồ sơ ELIGIBLE (xác nhận profile xong) — hoặc chưa chọn hồ sơ để chấm.',
                        'No ELIGIBLE apps (profile confirmed) — or none selected to score.',
                      )}
                    </li>
                    <li>
                      {tx(
                        'Hệ thống AI lỗi hoặc hết hạn ngạch — thử lại sau.',
                        'AI engine error or quota exceeded — retry later.',
                      )}
                    </li>
                    <li>
                      {tx(
                        'Hồ sơ thiếu trường bắt buộc sau xác nhận — mở hồ sơ và bổ sung.',
                        'Confirmed profile still missing required fields — open the app and fill them.',
                      )}
                    </li>
                  </ul>
                ) : null}
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Button
                    size="sm"
                    className="h-9 w-full rounded-full sm:w-auto"
                    disabled={starting || eligibleApps.length === 0}
                    onClick={() => void onStart()}
                  >
                    <PlayIcon data-icon="inline-start" />
                    {eligibleApps.length
                      ? tx(
                          `Chấm lại (${eligibleApps.length} hồ sơ)`,
                          `Score again (${eligibleApps.length} apps)`,
                        )
                      : tx('Không có hồ sơ để chấm', 'No apps to score')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 w-full rounded-full sm:w-auto"
                    render={<Link href={`/programs/${programId}/applications`} />}
                    nativeButton={false}
                  >
                    {tx('Xem danh sách hồ sơ', 'View applications')}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </Section>
      ) : null}

      <Section
        title={tx('Bộ lọc & chọn hồ sơ', 'Filters & selection')}
        description={tx('Min score · chỉ eligible · chọn subset để chấm', 'Min score · eligible only · pick a subset to score')}
        size="sm"
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">{tx('Min điểm', 'Min score')}</Label>
              <Input
                type="number"
                className="h-8 w-24"
                min={0}
                max={100}
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value) || 0)}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <Checkbox
                id="elig"
                checked={eligibleOnly}
                onCheckedChange={(v) => setEligibleOnly(v === true)}
              />
              <Label htmlFor="elig" className="text-xs font-normal">
                {tx('Chỉ đủ điều kiện', 'Eligible only')}
              </Label>
            </div>
            <p className="text-xs text-muted-foreground sm:ml-auto">
              {tx('Đã chọn', 'Selected')} <span className="font-medium text-foreground">{selected.length}</span> {tx('hồ sơ', 'applications')}
            </p>
          </div>

          {!loading && eligibleApps.length > 0 ? (
            <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto rounded-lg border bg-muted/30 p-2">
              {eligibleApps.map((a) => (
                <label
                  key={a.id}
                  className="inline-flex max-w-[10rem] items-center gap-1.5 truncate rounded-md border bg-background px-2 py-1 text-[11px]"
                >
                  <Checkbox
                    checked={selected.includes(a.id)}
                    onCheckedChange={() => toggle(a.id)}
                  />
                  <span className="truncate">{displayName(a)}</span>
                </label>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {tx('Chưa có hồ sơ ELIGIBLE/SCORED — xác nhận profile trước khi chấm.', 'No ELIGIBLE/SCORED applications — confirm profiles before scoring.')}
            </p>
          )}
        </div>
      </Section>

      {error ? <ErrorAlert message={error} onRetry={loadResults} /> : null}

      {loading ? (
        <LoadingBlock />
      ) : results.length === 0 ? (
        <EmptyState
          icon={<TrophyIcon />}
          title={tx('Chưa có kết quả', 'No results yet')}
          description={tx('Chạy chấm điểm sau khi xác nhận hồ sơ.', 'Run scoring after confirming applications.')}
        />
      ) : (
        <DataPanel
          footer={
            <>
              <span>
                {sorted.length} {tx('dòng', 'rows')} · {tx('TB', 'avg')} {avgScore}
              </span>
              <span>{tx('Sort theo final score Backend ↓', 'Sorted by Backend final score ↓')}</span>
            </>
          }
        >
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10">#</TableHead>
                <TableHead>Startup</TableHead>
                <TableHead className="w-24 text-center" title={tx('Final score (Backend)', 'Final score (Backend)')}>
                  {tx('Final', 'Final')}
                </TableHead>
                <TableHead className="hidden sm:table-cell" title={tx('Độ tin cậy dữ liệu', 'Data confidence')}>
                  Confidence
                </TableHead>
                <TableHead className="hidden md:table-cell" title={tx('Hard filter — không phải quyết định nhận/từ chối', 'Hard filter — not accept/reject')}>
                  {tx('Đủ ĐK', 'Eligible')}
                </TableHead>
                <TableHead className="hidden lg:table-cell">{tx('Gợi ý', 'Recommendation')}</TableHead>
                <TableHead className="w-[1%]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((r, i) => (
                <TableRow key={r.id || r.applicationId + i} className="group">
                  <TableCell className="text-xs text-muted-foreground tabular-nums">
                    {i + 1}
                  </TableCell>
                  <TableCell className="max-w-[160px] truncate font-medium">
                    {r.startupName || 'Startup'}
                  </TableCell>
                  <TableCell className="text-center">
                    <ScoreBadge
                      score={
                        r.totalScore ??
                        (r as { finalScore?: number }).finalScore
                      }
                    />
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <ConfidenceIndicator confidence={r.confidence} />
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge
                      variant={r.eligible ? 'default' : 'outline'}
                      className="text-[10px]"
                    >
                      {r.eligible ? 'Yes' : 'No'}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden max-w-[140px] truncate text-xs text-muted-foreground lg:table-cell">
                    {r.recommendation?.replace(/_/g, ' ') || '—'}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-full opacity-80 group-hover:opacity-100"
                      render={<Link href={`/applications/${r.applicationId}`} />}
                      nativeButton={false}
                    >
                      {tx('Mở', 'Open')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataPanel>
      )}
    </PageShell>
  )
}
