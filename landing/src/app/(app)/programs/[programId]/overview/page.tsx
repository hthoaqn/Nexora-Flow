'use client'

/**
 * Program home — two distinct modes via useIntakeMode:
 * - select: receive → score → shortlist (classic funnel)
 * - search: find fits → open apps → decide (discovery)
 */

import { useTx } from '@/lib/tx'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  CheckIcon,
  CopyIcon,
  FileTextIcon,
  LinkIcon,
  TrophyIcon,
  UsersIcon,
  ArrowRightIcon,
  GitCompareArrowsIcon,
  SearchIcon,
  ListFilterIcon,
  SparklesIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth/session'
import { getProgram, getProgramSummary } from '@/lib/api/client'
import type { Program, ProgramSummary } from '@/lib/api/types'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { ErrorAlert } from '@/components/dashboard/ErrorAlert'
import { PageSkeleton } from '@/components/dashboard/LoadingBlock'
import { StatusBadge } from '@/components/dashboard/StatusBadge'
import { PageShell, Section } from '@/components/dashboard/Section'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { APP_STATUS_LABEL } from '@/lib/status'
import { cn } from '@/lib/utils'
import { useIntakeMode } from '@/lib/intake-mode'

export default function ProgramOverviewPage() {
  const { tx } = useTx()
  const { session } = useAuth()
  const { mode, setMode } = useIntakeMode()
  const router = useRouter()
  const params = useParams()
  const programId = String(params?.programId ?? '')
  const [program, setProgram] = useState<Program | null>(null)
  const [summary, setSummary] = useState<ProgramSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    if (!session) return
    setLoading(true)
    setError(null)
    try {
      const [p, s] = await Promise.all([
        getProgram(session, programId),
        getProgramSummary(session, programId),
      ])
      setProgram(p)
      setSummary(s)
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : tx('Không tải được chương trình', 'Could not load the program'),
      )
    } finally {
      setLoading(false)
    }
  }, [session, programId, tx])

  useEffect(() => {
    void load()
  }, [load])

  const publicUrl =
    typeof window !== 'undefined' && program?.submissionToken
      ? `${window.location.origin}/apply/${program.submissionToken}`
      : ''

  const copyLink = async () => {
    if (!publicUrl) return
    await navigator.clipboard.writeText(publicUrl)
    setCopied(true)
    toast.success(tx('Đã sao chép liên kết', 'Link copied'))
    setTimeout(() => setCopied(false), 1200)
  }

  const counts = summary?.statusCounts || {}
  const needsReview = Number(counts.NEEDS_REVIEW || 0)
  const eligible = Number(counts.ELIGIBLE || 0)
  const scored = Number(counts.SCORED || 0)
  const totalApps = summary?.totalApplications ?? 0
  const totalResults = summary?.totalResults ?? 0

  /** Mode SELECT — shortlist funnel */
  const primarySelect = useMemo(() => {
    if (needsReview > 0) {
      return {
        title: tx(
          `Duyệt ${needsReview} hồ sơ cần kiểm tra`,
          `Review ${needsReview} apps that need review`,
        ),
        body: tx(
          'Xác nhận hồ sơ trước khi chấm điểm và rút gọn.',
          'Confirm profiles before scoring and shortlisting.',
        ),
        cta: tx('Mở hồ sơ', 'Open applications'),
        href: `/programs/${programId}/applications` as string | null,
        icon: FileTextIcon,
        copy: false,
      }
    }
    if (eligible > 0 && totalResults === 0) {
      return {
        title: tx('Chấm xếp hạng hồ sơ sẵn sàng', 'Score ready applications'),
        body: tx(
          `${eligible} hồ sơ sẵn sàng. Chạy xếp hạng rồi chọn dự án tốt nhất.`,
          `${eligible} apps ready. Run ranking, then pick the best projects.`,
        ),
        cta: tx('Mở xếp hạng', 'Open ranking'),
        href: `/programs/${programId}/ranking`,
        icon: TrophyIcon,
        copy: false,
      }
    }
    if (scored > 0 || totalResults > 0) {
      return {
        title: tx(
          'Chọn lọc & ghi quyết định',
          'Shortlist & record decisions',
        ),
        body: tx(
          'Mở hồ sơ → tab Quyết định → rút gọn hoặc chấp nhận.',
          'Open an app → Decision tab → shortlist or accept.',
        ),
        cta: tx('Mở hồ sơ', 'Open applications'),
        href: `/programs/${programId}/applications`,
        icon: CheckIcon,
        copy: false,
      }
    }
    return {
      title: tx('Nhận hồ sơ để chọn lọc', 'Receive apps to shortlist'),
      body: tx(
        'Sao chép liên kết công khai — startup nộp, bạn chọn dự án phù hợp nhất.',
        'Copy the public link — startups apply, you pick the best projects.',
      ),
      cta: tx('Sao chép liên kết nộp', 'Copy apply link'),
      href: null as string | null,
      icon: LinkIcon,
      copy: true,
    }
  }, [needsReview, eligible, scored, totalResults, programId, tx])

  /** Mode SEARCH — discovery / fit finding */
  const primarySearch = useMemo(() => {
    if (totalApps === 0) {
      return {
        title: tx(
          'Chưa có hồ sơ — gửi link hoặc đổi chương trình',
          'No apps yet — share link or pick another program',
        ),
        body: tx(
          'Chế độ tìm hồ sơ cần dữ liệu. Sao chép link nộp hoặc chạy so khớp trên chương trình khác.',
          'Find-apps mode needs data. Copy apply link or match against another program.',
        ),
        cta: tx('Sao chép liên kết', 'Copy link'),
        href: null as string | null,
        icon: LinkIcon,
        copy: true,
      }
    }
    return {
      title: tx(
        'Tìm hồ sơ khớp thesis chương trình',
        'Find apps that fit this program thesis',
      ),
      body: tx(
        `${totalApps} hồ sơ trong chương trình. Chạy so khớp để xếp theo độ phù hợp — không cần chấm điểm trước.`,
        `${totalApps} apps in this program. Run matching to rank by fit — no scoring required first.`,
      ),
      cta: tx('Chạy so khớp ngay', 'Run matching now'),
      href: '/matching',
      icon: GitCompareArrowsIcon,
      copy: false,
    }
  }, [totalApps, tx])

  const primary = mode === 'search' ? primarySearch : primarySelect

  const jobsSelect = [
    {
      href: `/programs/${programId}/applications`,
      title: tx('1. Hồ sơ', '1. Applications'),
      body: tx('Nhận, xem, xác nhận hồ sơ.', 'Receive, view, confirm apps.'),
      icon: FileTextIcon,
    },
    {
      href: `/programs/${programId}/ranking`,
      title: tx('2. Xếp hạng', '2. Ranking'),
      body: tx(
        'Chấm điểm hồ sơ đã xác nhận.',
        'Score confirmed applications.',
      ),
      icon: TrophyIcon,
    },
    {
      href: `/programs/${programId}/report`,
      title: tx('3. Báo cáo', '3. Report'),
      body: tx(
        'Xuất danh sách rút gọn gửi mentor.',
        'Export shortlist for mentors.',
      ),
      icon: UsersIcon,
    },
  ]

  const jobsSearch = [
    {
      href: '/matching',
      title: tx('1. So khớp độ phù hợp', '1. Fit matching'),
      body: tx(
        'Xếp hồ sơ theo thesis chương trình (lĩnh vực, giai đoạn…).',
        'Rank apps by program thesis (sector, stage…).',
      ),
      icon: GitCompareArrowsIcon,
    },
    {
      href: `/programs/${programId}/applications`,
      title: tx('2. Mở hồ sơ khớp', '2. Open fitting apps'),
      body: tx(
        'Đọc chi tiết các hồ sơ điểm cao từ so khớp.',
        'Read details of high-fit apps from matching.',
      ),
      icon: SearchIcon,
    },
    {
      href: `/programs/${programId}/applications`,
      title: tx('3. Ghi chú / quyết định', '3. Notes / decisions'),
      body: tx(
        'Đánh dấu quan tâm — không bắt buộc xếp hạng trước.',
        'Mark interest — ranking not required first.',
      ),
      icon: SparklesIcon,
    },
  ]

  const jobs = mode === 'search' ? jobsSearch : jobsSelect

  if (loading) return <PageSkeleton />
  if (error) return <ErrorAlert message={error} onRetry={load} />
  if (!program) return null

  const PrimaryIcon = primary.icon

  return (
    <PageShell>
      <PageHeader
        title={program.name}
        description={
          mode === 'search'
            ? tx(
                'Chế độ tìm hồ sơ: so khớp thesis → mở hồ sơ khớp. Khác với chọn lọc (xếp hạng → rút gọn).',
                'Find-apps mode: match thesis → open fits. Different from shortlist (rank → export).',
              )
            : program.objective ||
              tx(
                'Chế độ chọn lọc: nhận hồ sơ → chấm → rút gọn dự án tốt nhất.',
                'Shortlist mode: receive → score → pick the best projects.',
              )
        }
        meta={
          <>
            <StatusBadge status={program.status} kind="program" />
            <Badge variant="secondary">
              {totalApps} {tx('hồ sơ', 'apps')}
            </Badge>
            <Badge
              variant="outline"
              className={
                mode === 'search'
                  ? 'border-sky-500/40 text-sky-700 dark:text-sky-300'
                  : 'border-primary/40 text-primary'
              }
            >
              {mode === 'search'
                ? tx('Tìm hồ sơ', 'Find apps')
                : tx('Chọn lọc', 'Shortlist')}
            </Badge>
          </>
        }
      />

      {/* Mode hint + switch */}
      <div className="flex flex-col gap-2 rounded-xl border border-dashed border-border/80 bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {mode === 'search'
            ? tx(
                'Bạn đang tìm hồ sơ phù hợp thesis — không bắt buộc xếp hạng.',
                'You are finding apps that fit thesis — ranking not required.',
              )
            : tx(
                'Bạn đang chọn lọc dự án tốt nhất — hồ sơ → xếp hạng → báo cáo.',
                'You are shortlisting the best projects — apps → rank → report.',
              )}
        </p>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 rounded-full"
          onClick={() => {
            const next = mode === 'search' ? 'select' : 'search'
            setMode(next)
            if (next === 'search') router.push('/matching')
          }}
        >
          {mode === 'search' ? (
            <>
              <ListFilterIcon data-icon="inline-start" />
              {tx('Sang chọn lọc', 'Switch to shortlist')}
            </>
          ) : (
            <>
              <SearchIcon data-icon="inline-start" />
              {tx('Sang tìm hồ sơ', 'Switch to find apps')}
            </>
          )}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {Object.entries(counts).length === 0 ? (
          <Badge variant="outline">
            {tx('Chưa có hồ sơ', 'No applications yet')}
          </Badge>
        ) : (
          Object.entries(counts).map(([k, v]) => (
            <Badge key={k} variant="outline">
              {APP_STATUS_LABEL[k as keyof typeof APP_STATUS_LABEL] || k}: {v}
            </Badge>
          ))
        )}
      </div>

      <div
        className={cn(
          'rounded-2xl border p-5 sm:p-6',
          mode === 'search'
            ? 'border-sky-500/35 bg-sky-500/5'
            : 'border-primary/30 bg-primary/5',
        )}
      >
        <Badge
          className="mb-3"
          variant={mode === 'search' ? 'secondary' : 'default'}
        >
          {tx('Làm ngay', 'Do this now')}
        </Badge>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <span
            className={cn(
              'flex size-11 shrink-0 items-center justify-center rounded-xl text-primary-foreground',
              mode === 'search' ? 'bg-sky-600' : 'bg-primary',
            )}
          >
            <PrimaryIcon className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-heading text-lg font-semibold sm:text-xl">
              {primary.title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{primary.body}</p>
            {primary.copy ? (
              <Button
                size="lg"
                className="mt-4 h-11 w-full rounded-full sm:w-auto"
                onClick={() => void copyLink()}
                disabled={!publicUrl}
              >
                {copied ? (
                  <CheckIcon data-icon="inline-start" />
                ) : (
                  <CopyIcon data-icon="inline-start" />
                )}
                {copied ? tx('Đã chép', 'Copied') : primary.cta}
              </Button>
            ) : (
              <Button
                size="lg"
                className="mt-4 h-11 w-full rounded-full sm:w-auto"
                render={<Link href={primary.href!} />}
                nativeButton={false}
              >
                {primary.cta}
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <Section
        title={
          mode === 'search'
            ? tx('Ba bước tìm hồ sơ', 'Three find-apps steps')
            : tx('Ba việc chọn lọc', 'Three shortlist jobs')
        }
        description={
          mode === 'search'
            ? tx(
                'Flow riêng: so khớp độ phù hợp trước, xếp hạng không bắt buộc.',
                'Separate flow: fit-match first, ranking optional.',
              )
            : tx(
                'Flow riêng: nhận → chấm → xuất danh sách rút gọn.',
                'Separate flow: receive → score → export shortlist.',
              )
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {jobs.map((card, i) => (
            <Link
              key={`${card.href}-${i}`}
              href={card.href}
              className={cn(
                'flex flex-col rounded-2xl border bg-card/60 p-4 transition-colors',
                mode === 'search'
                  ? 'hover:border-sky-500/40 hover:bg-sky-500/5'
                  : 'hover:border-primary/40 hover:bg-primary/5',
              )}
            >
              <card.icon
                className={cn(
                  'mb-2 size-5',
                  mode === 'search' ? 'text-sky-600' : 'text-primary',
                )}
              />
              <p className="font-semibold">{card.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{card.body}</p>
              <span
                className={cn(
                  'mt-3 inline-flex items-center gap-1 text-xs font-semibold',
                  mode === 'search' ? 'text-sky-700 dark:text-sky-300' : 'text-primary',
                )}
              >
                {tx('Mở', 'Open')}
                <ArrowRightIcon className="size-3.5" />
              </span>
            </Link>
          ))}
        </div>
      </Section>

      {mode === 'select' ? (
        <Section
          title={tx('Liên kết nộp hồ sơ', 'Application link')}
          description={tx(
            'Gửi cho startup. Liên kết đầy đủ chỉ hiện khi sao chép.',
            'Share with startups. Full link only appears when you copy.',
          )}
          size="sm"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1 rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              {publicUrl
                ? `${typeof window !== 'undefined' ? window.location.origin : ''}/apply/••••••••`
                : tx('Chưa có liên kết công khai', 'No public link yet')}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="rounded-full"
                onClick={() => void copyLink()}
                disabled={!publicUrl}
              >
                {copied ? (
                  <CheckIcon data-icon="inline-start" />
                ) : (
                  <CopyIcon data-icon="inline-start" />
                )}
                {copied ? tx('Đã chép', 'Copied') : tx('Sao chép', 'Copy')}
              </Button>
              {program.submissionToken ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  render={
                    <Link
                      href={`/apply/${program.submissionToken}`}
                      target="_blank"
                    />
                  }
                  nativeButton={false}
                >
                  <LinkIcon data-icon="inline-start" />
                  {tx('Mở form', 'Open form')}
                </Button>
              ) : null}
            </div>
          </div>
        </Section>
      ) : (
        <Section
          title={tx('Gợi ý chế độ tìm hồ sơ', 'Find-apps tip')}
          description={tx(
            'Chọn chương trình ở trang So khớp, bật lọc điểm, mở hồ sơ điểm cao.',
            'Pick a program on Matching, filter by score, open high-fit apps.',
          )}
          size="sm"
        >
          <Button
            size="sm"
            className="rounded-full"
            render={<Link href="/matching" />}
            nativeButton={false}
          >
            <GitCompareArrowsIcon data-icon="inline-start" />
            {tx('Mở so khớp', 'Open matching')}
          </Button>
        </Section>
      )}
    </PageShell>
  )
}
