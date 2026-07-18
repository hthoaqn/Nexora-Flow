'use client'

/**
 * Intake home — kept short: (1) search existing programs (2) pick the best one to work on.
 */

import { useTx } from '@/lib/tx'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRightIcon,
  FolderKanbanIcon,
  GitCompareArrowsIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  SparklesIcon,
  StarIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth/session'
import { useIntakeMode } from '@/lib/intake-mode'
import {
  listPrograms,
  getOrganizationMe,
  upsertOrganization,
} from '@/lib/api/client'
import type { Program } from '@/lib/api/types'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { ErrorAlert } from '@/components/dashboard/ErrorAlert'
import { PageSkeleton } from '@/components/dashboard/LoadingBlock'
import { StatusBadge } from '@/components/dashboard/StatusBadge'
import { PageShell, Section } from '@/components/dashboard/Section'
import { AiDisclosure } from '@/components/dashboard/AiDisclosure'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

function programRankScore(p: Program): number {
  // Prefer OPEN, higher quota, more sectors defined
  let s = 0
  if (p.status === 'OPEN') s += 100
  else if (p.status === 'DRAFT') s += 40
  else if (p.status === 'CLOSED') s += 10
  s += Math.min(50, Number(p.expectedSelections || 0) * 2)
  s += Math.min(30, (p.priorityIndustries || []).length * 5)
  s += Math.min(20, (p.acceptedStages || []).length * 4)
  return s
}

export default function ProgramsPage() {
  const { tx } = useTx()
  const { session } = useAuth()
  const { mode } = useIntakeMode()
  const [items, setItems] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [orgName, setOrgName] = useState<string | null>(null)
  const [q, setQ] = useState('')

  const load = useCallback(async () => {
    if (!session) return
    setLoading(true)
    setError(null)
    try {
      const fallbackOrgTitle =
        session.organizationId === 'nexora-flow'
          ? 'Nexora Flow'
          : session.organizationId
            ? session.organizationId
                .split('-')
                .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(' ')
            : 'Workspace'

      try {
        const me = await getOrganizationMe(session)
        const raw = (me.name || '').trim()
        const looksPersonal =
          raw.length > 0 &&
          raw.split(/\s+/).length >= 2 &&
          !/flow|inc|corp|lab|fund|ventures|studio|org|team|workspace/i.test(raw)
        if (raw && !looksPersonal) {
          setOrgName(raw)
        } else {
          setOrgName(fallbackOrgTitle)
          if (
            looksPersonal &&
            (session.role === 'owner' || session.role === 'admin')
          ) {
            try {
              await upsertOrganization(session, {
                name: fallbackOrgTitle,
                website: me.website || '',
                description: me.description || '',
              })
            } catch {
              /* ignore */
            }
          }
        }
      } catch {
        setOrgName(fallbackOrgTitle)
      }

      const page = await listPrograms(session, { limit: 50 })
      setItems(page.items || [])
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : tx('Không tải được chương trình', 'Could not load programs')
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [session, tx])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return items
    return items.filter(
      (p) =>
        p.name?.toLowerCase().includes(s) ||
        p.objective?.toLowerCase().includes(s) ||
        (p.priorityIndustries || []).some((i) => i.toLowerCase().includes(s)),
    )
  }, [items, q])

  /** Best programs to continue work on (not the search list) */
  const recommended = useMemo(() => {
    return [...items]
      .sort((a, b) => programRankScore(b) - programRankScore(a))
      .slice(0, 3)
  }, [items])

  if (loading) return <PageSkeleton />

  return (
    <PageShell>
      <PageHeader
        title={
          mode === 'search'
            ? tx('Chọn chương trình để tìm hồ sơ', 'Pick a program to find apps')
            : orgName || tx('Chọn lọc dự án', 'Shortlist projects')
        }
        description={
          mode === 'search'
            ? tx(
                'Chế độ tìm hồ sơ: chọn chương trình rồi chạy so khớp thesis với hồ sơ đã nộp.',
                'Find-apps mode: pick a program, then match its thesis against submitted apps.',
              )
            : tx(
                'Chế độ chọn lọc: chọn chương trình → nhận hồ sơ → xếp hạng → rút gọn dự án tốt nhất.',
                'Shortlist mode: pick a program → receive apps → rank → export the best projects.',
              )
        }
        meta={
          <>
            <Badge variant="secondary">
              {items.length} {tx('chương trình', 'programs')}
            </Badge>
            <Badge
              variant="outline"
              className={
                mode === 'search'
                  ? 'border-sky-500/40 text-sky-700 dark:text-sky-300'
                  : undefined
              }
            >
              {mode === 'search'
                ? tx('Tìm hồ sơ', 'Find apps')
                : tx('Chọn lọc', 'Shortlist')}
            </Badge>
          </>
        }
        actions={
          <>
            {mode === 'search' ? (
              <Button
                size="sm"
                className="rounded-full"
                render={<Link href="/matching" />}
                nativeButton={false}
              >
                <GitCompareArrowsIcon data-icon="inline-start" />
                {tx('Chạy so khớp', 'Run matching')}
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => void load()}
            >
              <RefreshCwIcon data-icon="inline-start" />
              {tx('Làm mới', 'Refresh')}
            </Button>
            {session?.role !== 'reviewer' && mode === 'select' ? (
              <Button
                size="sm"
                className="rounded-full"
                render={<Link href="/programs/new" />}
                nativeButton={false}
              >
                <PlusIcon data-icon="inline-start" />
                {tx('Tạo mới', 'Create')}
              </Button>
            ) : null}
          </>
        }
      />

      {mode === 'select' ? <AiDisclosure /> : null}

      {error ? <ErrorAlert message={error} onRetry={load} /> : null}

      {items.length === 0 ? (
        <EmptyState
          icon={<FolderKanbanIcon />}
          title={tx('Chưa có chương trình', 'No programs yet')}
          description={tx(
            'Tạo chương trình đầu tiên để nhận hồ sơ và chạy chấm điểm.',
            'Create your first program to receive applications and run scoring.',
          )}
          action={
            session?.role !== 'reviewer' ? (
              <Button
                size="sm"
                className="rounded-full"
                render={<Link href="/programs/new" />}
                nativeButton={false}
              >
                <PlusIcon data-icon="inline-start" />
                {tx('Tạo chương trình', 'Create program')}
              </Button>
            ) : null
          }
        />
      ) : (
        <>
          <Section
            title={
              mode === 'search'
                ? tx('Chương trình để so khớp', 'Programs to match against')
                : tx('1. Tìm chương trình có sẵn', '1. Find an existing program')
            }
            description={
              mode === 'search'
                ? tx(
                    'Chọn chương trình → mở tổng quan hoặc chạy so khớp trực tiếp.',
                    'Pick a program → open overview or run matching directly.',
                  )
                : tx(
                    'Gõ tên, mục tiêu hoặc ngành để lọc danh sách.',
                    'Type a name, goal, or sector to filter the list.',
                  )
            }
          >
            <div className="relative max-w-xl">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-11 pl-10 text-sm"
                placeholder={tx(
                  'Tìm tên, mục tiêu, ngành…',
                  'Search name, goal, sector…',
                )}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                autoComplete="off"
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {tx('Hiển thị', 'Showing')}{' '}
              <span className="font-medium text-foreground">
                {filtered.length}
              </span>{' '}
              / {items.length}
            </p>

            {filtered.length === 0 ? (
              <EmptyState
                icon={<SearchIcon />}
                title={tx('Không tìm thấy', 'No matches')}
                description={tx(
                  'Thử từ khóa khác hoặc xóa ô tìm kiếm.',
                  'Try another keyword or clear the search box.',
                )}
              />
            ) : (
              <ul className="mt-3 divide-y rounded-xl border">
                {filtered.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/programs/${p.id}/overview`}
                      className="flex flex-col gap-2 px-3 py-3 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-4"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-semibold">{p.name}</p>
                          <StatusBadge status={p.status} kind="program" />
                        </div>
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                          {p.objective ||
                            (p.priorityIndustries || []).slice(0, 3).join(' · ') ||
                            '—'}
                        </p>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary">
                        {tx('Mở', 'Open')}
                        <ArrowRightIcon className="size-3.5" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section
            title={
              mode === 'search'
                ? tx('Gợi ý chương trình để tìm hồ sơ', 'Suggested programs for discovery')
                : tx(
                    '2. Chọn chương trình tốt nhất để làm tiếp',
                    '2. Pick the best program to continue',
                  )
            }
            description={
              mode === 'search'
                ? tx(
                    'Mở so khớp trên chương trình đang mở — xếp hồ sơ theo độ phù hợp thesis.',
                    'Open matching on open programs — rank apps by thesis fit.',
                  )
                : tx(
                    'Gợi ý theo trạng thái đang mở, chỉ tiêu và mức độ thiết lập — bấm một cái để vào làm việc.',
                    'Suggested by open status, quota, and setup depth — open one and continue.',
                  )
            }
          >
            {recommended.length === 0 ? (
              <p className="text-sm text-muted-foreground">—</p>
            ) : (
              <div
                className={cn(
                  'grid w-full gap-3',
                  recommended.length === 1
                    ? 'grid-cols-1'
                    : recommended.length === 2
                      ? 'grid-cols-1 sm:grid-cols-2'
                      : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
                )}
              >
                {recommended.map((p, idx) => (
                  <Link
                    key={p.id}
                    href={`/programs/${p.id}/overview`}
                    className={cn(
                      'flex w-full min-w-0 flex-col rounded-2xl border bg-card/60 p-4 transition-colors hover:border-primary/40 hover:bg-primary/5',
                      idx === 0 && 'border-primary/35 bg-primary/5',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {idx === 0 ? (
                          <StarIcon className="size-4 fill-primary text-primary" />
                        ) : (
                          <SparklesIcon className="size-4 text-muted-foreground" />
                        )}
                        <Badge
                          variant={idx === 0 ? 'default' : 'secondary'}
                          className="text-[10px]"
                        >
                          {idx === 0
                            ? tx('Gợi ý hàng đầu', 'Top pick')
                            : tx(`Gợi ý ${idx + 1}`, `Pick ${idx + 1}`)}
                        </Badge>
                      </div>
                      <StatusBadge status={p.status} kind="program" />
                    </div>
                    <p className="mt-2 line-clamp-2 font-heading text-base font-semibold leading-snug">
                      {p.name}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {p.objective ||
                        tx('Chưa có mô tả mục tiêu', 'No objective yet')}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {(p.priorityIndustries || []).slice(0, 3).map((i) => (
                        <Badge
                          key={i}
                          variant="outline"
                          className="text-[10px]"
                        >
                          {i}
                        </Badge>
                      ))}
                    </div>
                    <div className="mt-auto flex items-center justify-between pt-4 text-xs text-muted-foreground">
                      <span>
                        {tx('Chỉ tiêu', 'Quota')}:{' '}
                        <span className="font-semibold text-foreground">
                          {p.expectedSelections ?? '—'}
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-1 font-semibold text-primary">
                        {tx('Làm tiếp', 'Continue')}
                        <ArrowRightIcon className="size-3.5" />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                render={<Link href="/matching" />}
                nativeButton={false}
              >
                {tx('So khớp giao thoa', 'Cross matching')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                render={<Link href="/settings/organization" />}
                nativeButton={false}
              >
                {tx('Duyệt hồ sơ tổ chức', 'Org moderation')}
              </Button>
            </div>
          </Section>
        </>
      )}
    </PageShell>
  )
}
