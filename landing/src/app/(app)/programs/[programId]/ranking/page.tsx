'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { PlayIcon, RefreshCwIcon, RotateCcwIcon, TrophyIcon } from 'lucide-react'
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
import { AiDisclosure } from '@/components/dashboard/AiDisclosure'
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

  const loadResults = useCallback(async () => {
    if (!session) return
    setLoading(true)
    setError(null)
    try {
      const [resPage, appsPage] = await Promise.all([
        listResults(session, programId, {
          minScore,
          eligible: eligibleOnly ? true : null,
          limit: 100,
        }),
        listApplications(session, programId, { status: 'ELIGIBLE', limit: 100 }),
      ])
      const scored = await listApplications(session, programId, {
        status: 'SCORED',
        limit: 50,
      }).catch(() => ({ items: [] as Application[] }))
      setResults(resPage.items || [])
      setEligibleApps([...(appsPage.items || []), ...(scored.items || [])])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải xếp hạng')
    } finally {
      setLoading(false)
    }
  }, [session, programId, minScore, eligibleOnly])

  useEffect(() => {
    void loadResults()
  }, [loadResults])

  useEffect(() => {
    if (!session || !run || run.status === 'COMPLETED' || run.status === 'FAILED') return
    const id = window.setInterval(async () => {
      try {
        const next = await getScreeningRun(session, run.id)
        setRun(next)
        if (next.status === 'COMPLETED' || next.status === 'FAILED') {
          void loadResults()
          if (next.status === 'COMPLETED') toast.success('Xong')
          if (next.status === 'FAILED') toast.error('Chấm thất bại')
        }
      } catch {
        /* poll */
      }
    }, 2000)
    return () => window.clearInterval(id)
  }, [session, run, loadResults])

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const onStart = async () => {
    if (!session) return
    setStarting(true)
    try {
      const body = selected.length === 0 ? {} : { applicationIds: selected }
      setRun(await startScreening(session, programId, body))
      toast.message('Đang chấm…')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi')
    } finally {
      setStarting(false)
    }
  }

  const sorted = [...results].sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0))
  const avgScore =
    sorted.length > 0
      ? Math.round(sorted.reduce((s, r) => s + (r.totalScore ?? 0), 0) / sorted.length)
      : 0
  const eligibleResults = sorted.filter((r) => r.eligible).length
  const topScore = sorted[0]?.totalScore ?? 0

  return (
    <PageShell>
      <PageHeader
        title="Xếp hạng"
        description="Chấm hồ sơ đã xác nhận bằng AI — kết quả có confidence & eligibility."
        meta={
          <>
            <Badge variant="secondary">{results.length} kết quả</Badge>
            <Badge variant="outline">{eligibleApps.length} sẵn sàng chấm</Badge>
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
              {selected.length ? `Chấm ${selected.length}` : 'Chấm tất cả'}
            </Button>
            <Button variant="outline" size="icon-sm" onClick={loadResults}>
              <RefreshCwIcon />
            </Button>
          </>
        }
      />

      <AiDisclosure />

      <StatGrid>
        <StatCard label="Kết quả" value={results.length} icon={TrophyIcon} />
        <StatCard label="Điểm TB" value={avgScore} hint="Trong filter" />
        <StatCard label="Top score" value={topScore} />
        <StatCard label="Đủ điều kiện" value={eligibleResults} hint="Eligible = yes" />
      </StatGrid>

      {run ? (
        <Section title="Screening run" description="Tiến độ chấm hiện tại" size="sm">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={String(run.status)} kind="run" />
            <Progress value={Math.round((run.progress ?? 0) * 100)} className="h-2 min-w-[8rem] flex-1" />
            <span className="text-xs text-muted-foreground tabular-nums">
              {Math.round((run.progress ?? 0) * 100)}% · {run.resultIds?.length ?? 0} results
            </span>
            {run.status === 'FAILED' ? (
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  if (!session || !run) return
                  setRun(await retryScreeningRun(session, run.id))
                }}
              >
                <RotateCcwIcon data-icon="inline-start" />
                Retry
              </Button>
            ) : null}
          </div>
        </Section>
      ) : null}

      <Section
        title="Bộ lọc & chọn hồ sơ"
        description="Min score · chỉ eligible · chọn subset để chấm"
        size="sm"
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Min điểm</Label>
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
                Chỉ đủ điều kiện
              </Label>
            </div>
            <p className="text-xs text-muted-foreground sm:ml-auto">
              Đã chọn <span className="font-medium text-foreground">{selected.length}</span> hồ sơ
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
              Chưa có hồ sơ ELIGIBLE/SCORED — xác nhận profile trước khi chấm.
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
          title="Chưa có kết quả"
          description="Chạy chấm điểm sau khi xác nhận hồ sơ."
        />
      ) : (
        <DataPanel
          footer={
            <>
              <span>
                {sorted.length} dòng · TB {avgScore}
              </span>
              <span>Sắp xếp theo total score ↓</span>
            </>
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Startup</TableHead>
                <TableHead className="w-20 text-center">Điểm</TableHead>
                <TableHead className="hidden sm:table-cell">Confidence</TableHead>
                <TableHead className="hidden md:table-cell">Đủ ĐK</TableHead>
                <TableHead className="hidden lg:table-cell">Gợi ý</TableHead>
                <TableHead className="w-[1%]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((r, i) => (
                <TableRow key={r.id || r.applicationId + i}>
                  <TableCell className="text-xs text-muted-foreground tabular-nums">
                    {i + 1}
                  </TableCell>
                  <TableCell className="max-w-[160px] truncate font-medium">
                    {r.startupName || 'Startup'}
                  </TableCell>
                  <TableCell className="text-center">
                    <ScoreBadge score={r.totalScore} />
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <ConfidenceIndicator confidence={r.confidence} />
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant={r.eligible ? 'default' : 'outline'} className="text-[10px]">
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
                      render={<Link href={`/applications/${r.applicationId}`} />}
                      nativeButton={false}
                    >
                      Mở
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
