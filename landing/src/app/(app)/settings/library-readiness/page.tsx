'use client'

import { useTx } from '@/lib/tx'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRightIcon, FileTextIcon, FolderKanbanIcon, SparklesIcon } from 'lucide-react'
import { useAuth, orgLabel } from '@/lib/auth/session'
import { listPrograms, getProgramSummary } from '@/lib/api/client'
import type { Program, ProgramSummary } from '@/lib/api/types'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { LoadingBlock } from '@/components/dashboard/LoadingBlock'
import { ErrorAlert } from '@/components/dashboard/ErrorAlert'
import { StatusBadge } from '@/components/dashboard/StatusBadge'
import { PageShell, Section } from '@/components/dashboard/Section'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type Row = { program: Program; summary: ProgramSummary | null }

export default function LibraryReadinessPage() {
  const { tx } = useTx()
  const { session } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<Row[]>([])

  const load = useCallback(async () => {
    if (!session) return
    setLoading(true)
    setError(null)
    try {
      const page = await listPrograms(session, { limit: 50 })
      const items = page.items || []
      const next = await Promise.all(
        items.map(async (p) => {
          try {
            return { program: p, summary: await getProgramSummary(session, p.id) }
          } catch {
            return { program: p, summary: null }
          }
        }),
      )
      setRows(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : tx('Lỗi', 'Error'))
    } finally {
      setLoading(false)
    }
  }, [session])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) return <LoadingBlock />

  const programs = rows.length
  const apps = rows.reduce((s, r) => s + (r.summary?.totalApplications || 0), 0)
  const results = rows.reduce((s, r) => s + (r.summary?.totalResults || 0), 0)
  const pending = rows.reduce(
    (s, r) => s + (Number(r.summary?.statusCounts?.NEEDS_REVIEW) || 0),
    0,
  )
  const targetApps = 100
  const pct = Math.min(100, Math.round((apps / targetApps) * 100))

  return (
    <PageShell>
      <PageHeader
        title={tx('Thư viện')}
        description={`${tx('Sẵn sàng matching', 'Matching readiness')} · ${orgLabel(session?.organizationId)}`}
        meta={<Badge variant={apps >= targetApps ? 'default' : 'secondary'}>{pct}%</Badge>}
        actions={
          <Button size="sm" render={<Link href="/programs" />} nativeButton={false}>
            {tx('Chương trình')}
            <ArrowRightIcon className="size-3.5" />
          </Button>
        }
      />

      {error ? <ErrorAlert message={error} onRetry={load} /> : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { icon: FolderKanbanIcon, label: tx('Chương trình'), value: programs },
          { icon: FileTextIcon, label: tx('Hồ sơ'), value: apps },
          { icon: SparklesIcon, label: tx('Đã chấm', 'Scored'), value: results },
          { icon: FileTextIcon, label: tx('Chờ duyệt', 'Pending review'), value: pending },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border bg-card p-4">
            <k.icon className="mb-2 size-4 text-primary" />
            <p className="font-heading text-2xl font-semibold tabular-nums">{k.value}</p>
            <p className="text-xs text-muted-foreground">{k.label}</p>
          </div>
        ))}
      </div>

      <Section title={tx('Tiến độ hồ sơ', 'Application progress')} description={`${tx('Mục tiêu gợi ý:', 'Suggested target:')} ${targetApps} ${tx('hồ sơ', 'applications')}`}>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Library fill</span>
          <span className="font-semibold tabular-nums">
            {apps}/{targetApps}
          </span>
        </div>
        <Progress value={pct} className="mt-2 h-2.5" />
        {pending > 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            {tx('Có', 'There are')} {pending} {tx('hồ sơ chờ duyệt', 'applications pending review')} —{' '}
            <Link href="/settings/organization" className="text-primary hover:underline">
              {tx('mở kiểm duyệt', 'open moderation')}
            </Link>
          </p>
        ) : null}
      </Section>

      <Section title={tx('Theo chương trình', 'By program')}>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {tx('Chưa có chương trình.', 'No programs yet.')}{' '}
            <Link href="/programs/new" className="text-primary hover:underline">
              {tx('Tạo mới', 'Create')}
            </Link>
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tx('Tên', 'Name')}</TableHead>
                  <TableHead>TT</TableHead>
                  <TableHead className="text-right">{tx('Hồ sơ')}</TableHead>
                  <TableHead className="text-right">{tx('Chấm', 'Scored')}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ program, summary }) => (
                  <TableRow key={program.id}>
                    <TableCell className="max-w-[200px] truncate font-medium">
                      {program.name}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={program.status} kind="program" />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {summary?.totalApplications ?? '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {summary?.totalResults ?? '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        render={<Link href={`/programs/${program.id}/applications`} />}
                        nativeButton={false}
                      >
                        {tx('Mở', 'Open')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>
    </PageShell>
  )
}
