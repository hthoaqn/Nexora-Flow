'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRightIcon,
  FolderKanbanIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  SparklesIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth/session'
import { listPrograms, getOrganizationMe, upsertOrganization } from '@/lib/api/client'
import type { Program } from '@/lib/api/types'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { ErrorAlert } from '@/components/dashboard/ErrorAlert'
import { PageSkeleton } from '@/components/dashboard/LoadingBlock'
import { StatusBadge } from '@/components/dashboard/StatusBadge'
import { StatCard, StatGrid } from '@/components/dashboard/StatCard'
import { DataPanel, PageShell, Toolbar } from '@/components/dashboard/Section'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

export default function ProgramsPage() {
  const { session } = useAuth()
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
      // Org title must be workspace name — never a person's displayName
      // (old bug: first Google login wrote "Viet Hoang Nguyen" as org name → all testers saw it)
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
        // Heuristic: if org name looks like a personal full name, prefer workspace label
        const looksPersonal =
          raw.length > 0 &&
          raw.split(/\s+/).length >= 2 &&
          !/flow|inc|corp|lab|fund|ventures|studio|org|team|workspace/i.test(raw)
        if (raw && !looksPersonal) {
          setOrgName(raw)
        } else {
          setOrgName(fallbackOrgTitle)
          // Best-effort rename polluted org once (owner/admin only)
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
              /* ignore rename failures */
            }
          }
        }
      } catch {
        setOrgName(fallbackOrgTitle)
        if (session.role === 'owner' || session.role === 'admin') {
          try {
            await upsertOrganization(session, { name: fallbackOrgTitle })
          } catch {
            /* optional */
          }
        }
      }
      const page = await listPrograms(session, { limit: 50 })
      setItems(page.items || [])
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Không tải được chương trình'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [session])

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

  const openCount = items.filter((p) => p.status === 'OPEN').length
  const draftCount = items.filter((p) => p.status === 'DRAFT').length
  const totalSelections = items.reduce((s, p) => s + (p.expectedSelections || 0), 0)

  if (loading) return <PageSkeleton />

  return (
    <PageShell>
      <PageHeader
        title={orgName || 'Chương trình'}
        description="Pipeline deal-flow: nhận hồ sơ, chấm điểm, ranking và shortlist."
        meta={
          <>
            <Badge variant="secondary">{items.length} chương trình</Badge>
            <Badge variant="outline">{openCount} đang mở</Badge>
          </>
        }
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              <RefreshCwIcon data-icon="inline-start" />
              Làm mới
            </Button>
            {session?.role !== 'reviewer' ? (
              <Button size="sm" render={<Link href="/programs/new" />} nativeButton={false}>
                <PlusIcon data-icon="inline-start" />
                Tạo mới
              </Button>
            ) : null}
          </>
        }
      />

      <StatGrid>
        <StatCard label="Tổng chương trình" value={items.length} icon={FolderKanbanIcon} hint="Trong workspace" />
        <StatCard label="Đang mở" value={openCount} icon={SparklesIcon} hint="Nhận hồ sơ" />
        <StatCard label="Bản nháp" value={draftCount} hint="Chưa public" />
        <StatCard label="Chỉ tiêu chọn" value={totalSelections} hint="Tổng expected selections" />
      </StatGrid>

      {error ? <ErrorAlert message={error} onRetry={load} /> : null}

      <Toolbar>
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 pl-8"
            placeholder="Tìm tên, mục tiêu, ngành…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <p className="text-xs text-muted-foreground sm:ml-auto">
          Hiển thị <span className="font-medium text-foreground">{filtered.length}</span> / {items.length}
        </p>
      </Toolbar>

      {items.length === 0 ? (
        <EmptyState
          icon={<FolderKanbanIcon />}
          title="Chưa có chương trình"
          description="Tạo chương trình đầu tiên để nhận pitch deck và chạy screening."
          action={
            session?.role !== 'reviewer' ? (
              <Button size="sm" render={<Link href="/programs/new" />} nativeButton={false}>
                <PlusIcon data-icon="inline-start" />
                Tạo chương trình
              </Button>
            ) : null
          }
        />
      ) : (
        <>
          {/* Dense card grid */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((p) => (
              <Card key={p.id} size="sm" className="hover:shadow-md">
                <CardHeader className="border-b [.border-b]:pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="line-clamp-1">{p.name}</CardTitle>
                    <StatusBadge status={p.status} kind="program" />
                  </div>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {p.objective || 'Chưa có mục tiêu'}
                  </p>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 pt-0">
                  <div className="flex flex-wrap gap-1">
                    {(p.priorityIndustries || []).slice(0, 4).map((i) => (
                      <Badge key={i} variant="secondary" className="text-[10px]">
                        {i}
                      </Badge>
                    ))}
                    {(p.priorityIndustries || []).length > 4 ? (
                      <Badge variant="outline" className="text-[10px]">
                        +{(p.priorityIndustries || []).length - 4}
                      </Badge>
                    ) : null}
                    {!p.priorityIndustries?.length ? (
                      <span className="text-xs text-muted-foreground">Chưa gắn ngành</span>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-muted/50 px-2.5 py-2">
                      <p className="text-muted-foreground">Chỉ tiêu</p>
                      <p className="font-semibold tabular-nums">{p.expectedSelections ?? '—'}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 px-2.5 py-2">
                      <p className="text-muted-foreground">Giai đoạn</p>
                      <p className="truncate font-semibold">
                        {(p.acceptedStages || []).slice(0, 2).join(', ') || '—'}
                      </p>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    {(p.acceptedStages || []).length} stages · {(p.locations || []).length} locations
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    render={<Link href={`/programs/${p.id}/overview`} />}
                    nativeButton={false}
                  >
                    Mở
                    <ArrowRightIcon data-icon="inline-end" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={<SearchIcon />}
              title="Không khớp bộ lọc"
              description="Thử từ khóa khác hoặc xóa ô tìm kiếm."
            />
          ) : null}

          {/* Compact table for overview */}
          <DataPanel
            footer={
              <>
                <span>{filtered.length} dòng</span>
                <span>Click để mở overview</span>
              </>
            }
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tên</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="hidden md:table-cell">Ngành</TableHead>
                  <TableHead className="hidden sm:table-cell text-right">Chỉ tiêu</TableHead>
                  <TableHead className="w-[1%]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={`row-${p.id}`}>
                    <TableCell className="max-w-[200px]">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{p.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{p.objective || '—'}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={p.status} kind="program" />
                    </TableCell>
                    <TableCell className="hidden max-w-[180px] truncate text-xs text-muted-foreground md:table-cell">
                      {(p.priorityIndustries || []).join(', ') || '—'}
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">
                      {p.expectedSelections ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        render={<Link href={`/programs/${p.id}/overview`} />}
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
        </>
      )}
    </PageShell>
  )
}
