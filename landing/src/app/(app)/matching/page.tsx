'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRightIcon,
  Building2Icon,
  GitCompareArrowsIcon,
  RefreshCwIcon,
  RocketIcon,
  SparklesIcon,
  FilterIcon,
  SearchIcon,
} from 'lucide-react'
import { useTx } from '@/lib/tx'
import { useAuth, orgLabel } from '@/lib/auth/session'
import { listPrograms, listApplications, getProgram } from '@/lib/api/client'
import type { Application, Program } from '@/lib/api/types'
import {
  matchApplicationsToProgram,
  scoreTone,
  type CrossMatchResult,
  CROSS_MATCH_WEIGHTS,
} from '@/lib/cross-match'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { LoadingBlock } from '@/components/dashboard/LoadingBlock'
import { ErrorAlert } from '@/components/dashboard/ErrorAlert'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { StatusBadge } from '@/components/dashboard/StatusBadge'
import { PageShell, Section, Toolbar } from '@/components/dashboard/Section'
import { StatCard, StatGrid } from '@/components/dashboard/StatCard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Spinner } from '@/components/ui/spinner'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { ApiError } from '@/lib/api/client'
import { cn } from '@/lib/utils'

const DIMS = Object.keys(CROSS_MATCH_WEIGHTS) as (keyof typeof CROSS_MATCH_WEIGHTS)[]

export default function MatchingHubPage() {
  const { tx } = useTx()
  const { session } = useAuth()

  // Stable session identity for effect deps (avoid object churn)
  const sessionKey = session
    ? `${session.userId}|${session.organizationId}|${session.role}`
    : ''

  const [programs, setPrograms] = useState<Program[]>([])
  const [programId, setProgramId] = useState('')
  const [program, setProgram] = useState<Program | null>(null)
  const [apps, setApps] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rateLimited, setRateLimited] = useState(false)

  const [optInOnly, setOptInOnly] = useState(false)
  const [minScore, setMinScore] = useState(0)
  const [q, setQ] = useState('')
  const [detail, setDetail] = useState<CrossMatchResult | null>(null)

  const programsLoadedFor = useRef('')
  const matchInFlight = useRef(false)
  const lastMatchKey = useRef('')
  const sessionRef = useRef(session)
  sessionRef.current = session

  // ── Load program list once per session ───────────────────────
  useEffect(() => {
    const s = sessionRef.current
    if (!s || !sessionKey) return
    if (programsLoadedFor.current === sessionKey) return
    if (rateLimited) return

    let cancelled = false
    programsLoadedFor.current = sessionKey
    setLoading(true)
    setError(null)

    void listPrograms(s, { limit: 50 })
      .then((page) => {
        if (cancelled) return
        const items = page.items || []
        setPrograms(items)
        setProgramId((prev) => prev || items[0]?.id || '')
      })
      .catch((e) => {
        if (cancelled) return
        programsLoadedFor.current = '' // allow retry
        if (e instanceof ApiError && e.status === 429) {
          setRateLimited(true)
          setError(
            tx(
              'Rate limit — đợi vài giây rồi bấm Làm mới.',
              'Rate limited — wait then click Refresh.',
            ),
          )
        } else {
          setError(
            e instanceof Error
              ? e.message
              : tx('Không tải được chương trình', 'Could not load programs'),
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when session identity changes
  }, [sessionKey])

  // ── Match for selected program (once per programId, or manual force) ──
  const runMatch = useCallback(
    async (opts?: { force?: boolean }) => {
      const s = sessionRef.current
      if (!s || !programId) return
      if (rateLimited && !opts?.force) return
      if (matchInFlight.current) return

      const key = `${sessionKey}|${programId}`
      if (!opts?.force && lastMatchKey.current === key) return

      matchInFlight.current = true
      lastMatchKey.current = key
      setRunning(true)
      setError(null)

      try {
        // One list call (not 8× status fan-out) — avoids rate limits
        const [p, page] = await Promise.all([
          getProgram(s, programId),
          listApplications(s, programId, { limit: 100 }),
        ])
        setProgram(p)
        setApps(page.items || [])
        setRateLimited(false)
      } catch (e) {
        lastMatchKey.current = '' // allow retry
        if (e instanceof ApiError && e.status === 429) {
          setRateLimited(true)
          setError(
            tx(
              'Rate limit — đợi 30–60s rồi bấm Chạy lại match.',
              'Rate limited — wait 30–60s then re-run match.',
            ),
          )
        } else {
          setError(
            e instanceof Error
              ? e.message
              : tx('So khớp thất bại', 'Matching failed'),
          )
        }
      } finally {
        matchInFlight.current = false
        setRunning(false)
      }
    },
    [programId, sessionKey, rateLimited, tx],
  )

  useEffect(() => {
    if (!programId || !sessionKey) return
    void runMatch()
  }, [programId, sessionKey, runMatch])

  const matches = useMemo(() => {
    if (!program) return [] as CrossMatchResult[]
    return matchApplicationsToProgram(apps, program, {
      requireOptIn: optInOnly,
      minScore,
    })
  }, [apps, program, optInOnly, minScore])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return matches
    return matches.filter(
      (m) =>
        m.startupName.toLowerCase().includes(needle) ||
        m.applicationId.toLowerCase().includes(needle) ||
        m.matchedReasons.some((r) => r.toLowerCase().includes(needle)),
    )
  }, [matches, q])

  const stats = useMemo(() => {
    const high = matches.filter((m) => m.totalScore >= 80).length
    const mid = matches.filter((m) => m.totalScore >= 60 && m.totalScore < 80).length
    const optIn = apps.filter((a) => a.matchingOptIn).length
    const avg =
      matches.length === 0
        ? 0
        : Math.round(matches.reduce((s, m) => s + m.totalScore, 0) / matches.length)
    return { high, mid, optIn, avg, total: matches.length }
  }, [matches, apps])

  const hardRefresh = () => {
    setRateLimited(false)
    programsLoadedFor.current = ''
    lastMatchKey.current = ''
    // re-trigger program load
    if (sessionKey) {
      programsLoadedFor.current = ''
      setLoading(true)
      const s = sessionRef.current
      if (!s) return
      void listPrograms(s, { limit: 50 })
        .then((page) => {
          const items = page.items || []
          setPrograms(items)
          programsLoadedFor.current = sessionKey
          const id = programId || items[0]?.id || ''
          if (id && id !== programId) setProgramId(id)
          else if (id) {
            lastMatchKey.current = ''
            void runMatch({ force: true })
          }
        })
        .catch((e) => {
          setError(e instanceof Error ? e.message : 'Error')
        })
        .finally(() => setLoading(false))
    }
  }

  if (!session) return <LoadingBlock />
  if (loading && programs.length === 0) return <LoadingBlock />

  return (
    <PageShell>
      <PageHeader
        title={tx('Tìm hồ sơ phù hợp', 'Find fitting applications')}
        description={tx(
          'Chế độ tìm hồ sơ: chấm độ phù hợp thesis chương trình với hồ sơ đã nộp — không cần xếp hạng trước. Bạn quyết định, hệ thống chỉ gợi ý.',
          'Find-apps mode: score how program thesis fits submitted apps — no ranking required first. You decide; the system only suggests.',
        )}
        meta={
          <>
            <Badge variant="secondary" className="gap-1">
              <GitCompareArrowsIcon className="size-3" />
              {tx('Tìm hồ sơ', 'Find apps')}
            </Badge>
            <Badge variant="outline">{orgLabel(session.organizationId)}</Badge>
          </>
        }
        actions={
          <Button
            size="sm"
            className="w-full rounded-full sm:w-auto"
            disabled={running || !programId}
            onClick={() => {
              setRateLimited(false)
              lastMatchKey.current = ''
              void runMatch({ force: true })
            }}
          >
            {running ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <RefreshCwIcon data-icon="inline-start" />
            )}
            <span className="sm:hidden">{tx('Chạy lại', 'Re-run')}</span>
            <span className="hidden sm:inline">
              {tx('Chạy lại so khớp', 'Re-run match')}
            </span>
          </Button>
        }
      />

      <Alert className="border-sky-500/30 bg-sky-500/5">
        <SearchIcon className="size-4 shrink-0 text-sky-600" />
        <AlertTitle className="text-sm sm:text-base">
          {tx(
            'Flow riêng: tìm hồ sơ (không phải chọn lọc)',
            'Separate flow: find apps (not shortlist)',
          )}
        </AlertTitle>
        <AlertDescription className="text-[11px] leading-relaxed sm:text-xs">
          {tx(
            '1) Chọn chương trình → 2) Chạy so khớp → 3) Lọc điểm cao → 4) Mở hồ sơ. Muốn chấm điểm & rút gọn danh sách thì chuyển chế độ «Chọn lọc» trên sidebar.',
            '1) Pick program → 2) Run match → 3) Filter high scores → 4) Open app. For scoring & shortlist, switch to Shortlist mode in the sidebar.',
          )}
        </AlertDescription>
      </Alert>

      {error ? (
        <ErrorAlert
          message={error}
          onRetry={() => {
            setRateLimited(false)
            hardRefresh()
          }}
        />
      ) : null}

      <Section
        title={tx(
          'Chọn định hướng chương trình',
          'Pick program focus',
        )}
        description={tx(
          'Program priority industries / stages / locations = partner-side mandate',
          'Program priority industries / stages / locations = partner-side mandate',
        )}
        size="sm"
      >
        <Toolbar className="border-0 bg-muted/30 p-2 shadow-none">
          <div className="grid w-full min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end">
            <div className="flex min-w-0 flex-col gap-1 sm:col-span-2 lg:col-span-1">
              <Label className="text-[10px] text-muted-foreground">
                {tx('Chương trình', 'Program')}
              </Label>
              <Select
                value={programId}
                onValueChange={(v) => {
                  if (!v || v === programId) return
                  lastMatchKey.current = ''
                  setProgramId(v)
                }}
              >
                <SelectTrigger className="w-full min-w-0">
                  <SelectValue placeholder={tx('Chọn chương trình', 'Select program')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {programs.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <span className="truncate">
                          {p.name} · {p.status}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 sm:pb-1">
              <Checkbox
                id="optin"
                checked={optInOnly}
                onCheckedChange={(v) => setOptInOnly(v === true)}
              />
              <Label htmlFor="optin" className="text-xs font-normal leading-snug">
                {tx(
                  'Chỉ hồ sơ đã đồng ý so khớp',
                  'Opt-in only',
                )}
              </Label>
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <Label className="text-[10px] text-muted-foreground">
                {tx('Điểm tối thiểu', 'Min score')}
              </Label>
              <Input
                type="number"
                min={0}
                max={100}
                className="h-9 w-full sm:w-24"
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value) || 0)}
              />
            </div>
          </div>
        </Toolbar>

        {program ? (
          <div className="mt-3 grid gap-2 grid-cols-1 xs:grid-cols-2 sm:grid-cols-3">
            <div className="min-w-0 rounded-lg border bg-muted/20 px-3 py-2 text-xs">
              <p className="text-muted-foreground">{tx('Ngành ưu tiên', 'Priority industries')}</p>
              <p className="mt-1 break-words font-medium">
                {(program.priorityIndustries || []).join(', ') || '—'}
              </p>
            </div>
            <div className="min-w-0 rounded-lg border bg-muted/20 px-3 py-2 text-xs">
              <p className="text-muted-foreground">{tx('Giai đoạn', 'Stages')}</p>
              <p className="mt-1 break-words font-medium">
                {(program.acceptedStages || []).join(', ') || '—'}
              </p>
            </div>
            <div className="min-w-0 rounded-lg border bg-muted/20 px-3 py-2 text-xs sm:col-span-1 col-span-1">
              <p className="text-muted-foreground">{tx('Địa bàn', 'Regions')}</p>
              <p className="mt-1 break-words font-medium">
                {(program.locations || []).join(', ') || '—'}
              </p>
            </div>
          </div>
        ) : null}
      </Section>

      <StatGrid>
        <StatCard
          label={tx('Hồ sơ đã chấm', 'Profiles scored')}
          value={stats.total}
          icon={RocketIcon}
          hint={`${apps.length} ${tx('trong quy trình', 'in process')}`}
        />
        <StatCard
          label={tx('Độ khớp từ 80', 'Fit 80+')}
          value={stats.high}
          icon={SparklesIcon}
          hint={tx('Ưu tiên giới thiệu', 'Prioritize introductions')}
        />
        <StatCard
          label={tx('Độ khớp 60 đến 79', 'Fit 60 to 79')}
          value={stats.mid}
          icon={GitCompareArrowsIcon}
        />
        <StatCard
          label={tx('Đã đồng ý so khớp', 'Matching opt-in')}
          value={stats.optIn}
          icon={Building2Icon}
          hint={tx(
            `Điểm trung bình ${stats.avg}`,
            `Average score ${stats.avg}`,
          )}
        />
      </StatGrid>

      <Section
        title={tx('Bảng giao thoa', 'Intersection table')}
        description={tx(
          'Khởi nghiệp trong quy trình × định hướng chương trình — chấm tại máy, không gọi API lặp',
          'Startups in process × program focus — scored locally, no repeated API calls',
        )}
        action={
          <div className="relative w-full sm:w-auto">
            <FilterIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-8 w-full pl-8 text-xs sm:w-48"
              placeholder={tx('Lọc tên…', 'Filter name…')}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        }
      >
        {running ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Spinner className="size-4" />
            {tx('Đang tính giao thoa…', 'Computing intersection…')}
          </div>
        ) : !programId || programs.length === 0 ? (
          <EmptyState
            icon={<Building2Icon />}
            title={tx('Chưa có chương trình', 'No programs yet')}
            description={tx(
              'Tạo chương trình Intake trước, rồi chạy matching.',
              'Create an Intake program first, then run matching.',
            )}
            action={
              <Button size="sm" render={<Link href="/programs/new" />} nativeButton={false}>
                {tx('Tạo chương trình', 'New program')}
              </Button>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<GitCompareArrowsIcon />}
            title={tx('Chưa có giao thoa', 'No intersections yet')}
            description={tx(
              'Upload / nhận hồ sơ startup, hoặc hạ min score.',
              'Upload / receive startup applications, or lower min score.',
            )}
            action={
              programId ? (
                <Button
                  size="sm"
                  variant="outline"
                  render={<Link href={`/programs/${programId}/applications`} />}
                  nativeButton={false}
                >
                  {tx('Mở hồ sơ', 'Open applications')}
                  <ArrowRightIcon className="size-3.5" />
                </Button>
              ) : null
            }
          />
        ) : (
          <>
            {/* Mobile: stacked cards */}
            <div className="flex flex-col gap-2 md:hidden">
              {filtered.map((m, idx) => {
                const tone = scoreTone(m.totalScore)
                return (
                  <button
                    key={m.applicationId}
                    type="button"
                    onClick={() => setDetail(m)}
                    className="flex w-full min-w-0 flex-col gap-2 rounded-xl border bg-card p-3 text-left transition-colors hover:bg-muted/40 active:scale-[0.99]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] tabular-nums text-muted-foreground">
                          #{idx + 1}
                        </p>
                        <p className="truncate font-medium leading-snug">{m.startupName}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {m.application.fileMetadata?.fileName ||
                            m.applicationId.slice(0, 8)}
                        </p>
                      </div>
                      <Badge
                        className={cn(
                          'shrink-0 tabular-nums',
                          tone === 'high' && 'bg-primary/15 text-primary',
                          tone === 'mid' &&
                            'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
                          tone === 'low' && 'bg-muted text-muted-foreground',
                        )}
                        variant={tone === 'high' ? 'default' : 'outline'}
                      >
                        {m.totalScore}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusBadge status={m.status} />
                      <Badge
                        variant={m.matchingOptIn ? 'default' : 'outline'}
                        className="text-[10px]"
                      >
                        {m.matchingOptIn
                          ? tx('Đã đồng ý', 'Opted in')
                          : tx('Chưa đồng ý', 'Not opted in')}
                      </Badge>
                    </div>
                    {m.matchedReasons[0] ? (
                      <p className="line-clamp-2 text-[11px] text-muted-foreground">
                        {m.matchedReasons[0]}
                      </p>
                    ) : null}
                    <div
                      className="flex justify-end"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-full"
                        render={<Link href={`/applications/${m.applicationId}`} />}
                        nativeButton={false}
                      >
                        {tx('Mở hồ sơ', 'Open')}
                        <ArrowRightIcon data-icon="inline-end" />
                      </Button>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Desktop / tablet: table */}
            <div className="hidden overflow-x-auto rounded-xl border md:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>{tx('Startup', 'Startup')}</TableHead>
                    <TableHead>{tx('Fit', 'Fit')}</TableHead>
                    <TableHead className="hidden lg:table-cell">
                      {tx('Trạng thái', 'Status')}
                    </TableHead>
                    <TableHead className="hidden lg:table-cell">Match</TableHead>
                    <TableHead className="hidden xl:table-cell">
                      {tx('Lý do chính', 'Top reason')}
                    </TableHead>
                    <TableHead className="pr-4 text-right">
                      {tx('Thao tác', 'Actions')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((m, idx) => {
                    const tone = scoreTone(m.totalScore)
                    return (
                      <TableRow
                        key={m.applicationId}
                        className="cursor-pointer"
                        onClick={() => setDetail(m)}
                      >
                        <TableCell className="tabular-nums text-muted-foreground">
                          {idx + 1}
                        </TableCell>
                        <TableCell className="max-w-[180px] lg:max-w-[220px]">
                          <p className="truncate font-medium">{m.startupName}</p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {m.application.fileMetadata?.fileName ||
                              m.applicationId.slice(0, 8)}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={cn(
                              'tabular-nums',
                              tone === 'high' && 'bg-primary/15 text-primary',
                              tone === 'mid' &&
                                'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
                              tone === 'low' && 'bg-muted text-muted-foreground',
                            )}
                            variant={tone === 'high' ? 'default' : 'outline'}
                          >
                            {m.totalScore}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <StatusBadge status={m.status} />
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <Badge
                            variant={m.matchingOptIn ? 'default' : 'outline'}
                            className="text-[10px]"
                          >
                            {m.matchingOptIn
                          ? tx('Đã đồng ý', 'Opted in')
                          : tx('Chưa đồng ý', 'Not opted in')}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden max-w-[200px] truncate text-xs text-muted-foreground xl:table-cell">
                          {m.matchedReasons[0] || '—'}
                        </TableCell>
                        <TableCell
                          className="pr-4 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            size="sm"
                            variant="ghost"
                            className="rounded-full"
                            render={
                              <Link href={`/applications/${m.applicationId}`} />
                            }
                            nativeButton={false}
                          >
                            {tx('Mở', 'Open')}
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </Section>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <Section
          title={tx('Luồng khởi nghiệp', 'Startup flow')}
          description={tx(
            'Phía cổng người sáng lập',
            'Founder portal side',
          )}
        >
          <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <RocketIcon className="mt-0.5 size-4 shrink-0 text-primary" />
              {tx(
                'Thiết lập hồ sơ, xác nhận, rồi so khớp với đối tác.',
                'Set up profile, confirm, then match against partners.',
              )}
            </li>
            <li className="flex gap-2">
              <GitCompareArrowsIcon className="mt-0.5 size-4 shrink-0 text-primary" />
              {tx(
                'Gửi yêu cầu kết nối, đối tác chấp nhận, mở phòng giả lập.',
                'Send a connection request, partner accepts, open the sandbox.',
              )}
            </li>
          </ul>
          <Button
            size="sm"
            variant="outline"
            className="mt-4 rounded-full"
            render={<Link href="/matches" />}
            nativeButton={false}
          >
            {tx('Mở so khớp khởi nghiệp', 'Open startup matches')}
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        </Section>

        <Section
          title={tx('Trọng số giao thoa', 'Intersection weights')}
          description="industry 25% · tech 15% · stage 15% · partnership 15% · funding 10% · market 10% · capability 10%"
        >
          <div className="flex flex-col gap-2">
            {DIMS.map((d) => (
              <div key={d} className="flex items-center gap-3 text-xs">
                <span className="w-24 capitalize text-muted-foreground">{d}</span>
                <Progress value={CROSS_MATCH_WEIGHTS[d] * 100} className="h-1.5 flex-1" />
                <span className="w-10 tabular-nums text-right">
                  {Math.round(CROSS_MATCH_WEIGHTS[d] * 100)}%
                </span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[min(90vh,720px)] w-[calc(100%-1.5rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-start gap-2 text-base sm:text-lg">
              <SparklesIcon className="mt-0.5 size-5 shrink-0 text-primary" />
              <span className="min-w-0 break-words">{detail?.startupName}</span>
            </DialogTitle>
            <DialogDescription className="flex flex-wrap items-center gap-2 pt-1">
              {detail ? (
                <Badge className="tabular-nums bg-primary/15 text-primary">
                  Fit {detail.totalScore}
                </Badge>
              ) : null}
              {detail ? <StatusBadge status={detail.status} /> : null}
              {detail?.matchingOptIn ? (
                <Badge variant="secondary">matchingOptIn</Badge>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          {detail ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">{detail.recommendation}</p>
              <div className="flex flex-col gap-2">
                {DIMS.map((d) => (
                  <div key={d} className="flex items-center gap-3 text-xs">
                    <span className="w-24 capitalize text-muted-foreground">{d}</span>
                    <Progress value={detail.scoreBreakdown[d]} className="h-1.5 flex-1" />
                    <span className="w-8 tabular-nums text-right">
                      {detail.scoreBreakdown[d]}
                    </span>
                  </div>
                ))}
              </div>
              {detail.matchedReasons.length ? (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {tx('Khớp', 'Matched')}
                  </p>
                  <ul className="list-inside list-disc text-sm">
                    {detail.matchedReasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {detail.risks.length ? (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Risks
                  </p>
                  <ul className="list-inside list-disc text-sm text-amber-700 dark:text-amber-400">
                    {detail.risks.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            {detail ? (
              <Button
                className="rounded-full"
                render={<Link href={`/applications/${detail.applicationId}`} />}
                nativeButton={false}
              >
                {tx('Mở hồ sơ chi tiết', 'Open application')}
              </Button>
            ) : null}
            <Button variant="ghost" className="rounded-full" onClick={() => setDetail(null)}>
              {tx('Đóng', 'Close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  )
}
