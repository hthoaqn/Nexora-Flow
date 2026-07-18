'use client'

import { useTx } from '@/lib/tx'
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { DownloadIcon, HistoryIcon, RefreshCwIcon } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth/session'
import { listAuditEvents, exportProgramResults } from '@/lib/api/client'
import type { AuditEvent } from '@/lib/api/types'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { ErrorAlert } from '@/components/dashboard/ErrorAlert'
import { LoadingBlock } from '@/components/dashboard/LoadingBlock'
import { StatCard, StatGrid } from '@/components/dashboard/StatCard'
import { DataPanel, PageShell } from '@/components/dashboard/Section'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Spinner } from '@/components/ui/spinner'

function actionLabel(action?: string) {
  if (!action) return 'Hoạt động'
  const map: Record<string, string> = {
    'program.created': 'Tạo program',
    'program.updated': 'Sửa program',
    'application.uploaded': 'Nhận hồ sơ',
    'application.confirmed': 'Xác nhận',
    'application.decision': 'Quyết định',
    'screening.started': 'Bắt đầu chấm',
    'screening.completed': 'Xong chấm',
  }
  return map[action] || action.replace(/\./g, ' · ')
}

export default function AuditPage() {
  const { tx } = useTx()
  const { session } = useAuth()
  const params = useParams()
  const programId = String(params?.programId ?? "")
  const [items, setItems] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const load = useCallback(async () => {
    if (!session) return
    setLoading(true)
    try {
      const page = await listAuditEvents(session, programId, { limit: 100 })
      setItems(page.items || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : tx('Lỗi', 'Error'))
    } finally {
      setLoading(false)
    }
  }, [session, programId])

  useEffect(() => {
    void load()
  }, [load])

  const onExport = async () => {
    if (!session) return
    setExporting(true)
    try {
      const data = await exportProgramResults(session, programId)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `export-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(tx('Đã xuất', 'Exported'))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tx('Lỗi xuất', 'Export failed'))
    } finally {
      setExporting(false)
    }
  }

  const uniqueActors = new Set(items.map((e) => e.actorId).filter(Boolean)).size
  const uniqueActions = new Set(items.map((e) => e.action).filter(Boolean)).size

  return (
    <PageShell>
      <PageHeader
        title={tx('Nhật ký')}
        description={tx('Audit trail — mọi thao tác trên program được ghi lại.', 'Audit trail — every program action is recorded.')}
        meta={<Badge variant="secondary">{items.length} {tx('sự kiện', 'events')}</Badge>}
        actions={
          <>
            <Button size="sm" disabled={exporting} onClick={() => void onExport()}>
              {exporting ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <DownloadIcon data-icon="inline-start" />
              )}
              {tx('Xuất JSON', 'Export JSON')}
            </Button>
            <Button variant="outline" size="icon-sm" onClick={load}>
              <RefreshCwIcon />
            </Button>
          </>
        }
      />

      <StatGrid>
        <StatCard label={tx('Sự kiện', 'Events')} value={items.length} icon={HistoryIcon} />
        <StatCard label={tx('Loại action', 'Action types')} value={uniqueActions} />
        <StatCard label="Actors" value={uniqueActors} />
        <StatCard
          label={tx('Mới nhất', 'Latest')}
          value={
            items[0]?.createdAt
              ? new Date(items[0].createdAt).toLocaleDateString('vi-VN')
              : '—'
          }
        />
      </StatGrid>

      {error ? <ErrorAlert message={error} onRetry={load} /> : null}
      {loading ? (
        <LoadingBlock />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<HistoryIcon />}
          title={tx('Chưa có hoạt động', 'No activity yet')}
          description={tx('Upload hồ sơ, chấm điểm hoặc sửa program sẽ xuất hiện tại đây.', 'Uploads, scoring runs, and program edits will appear here.')}
        />
      ) : (
        <DataPanel
          footer={
            <>
              <span>{items.length} events</span>
              <span>{tx('Mới → cũ', 'Newest → oldest')}</span>
            </>
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px]">{tx('Thời gian', 'Time')}</TableHead>
                <TableHead>{tx('Hoạt động', 'Activity')}</TableHead>
                <TableHead className="hidden sm:table-cell">Action key</TableHead>
                <TableHead className="hidden md:table-cell">Actor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((ev) => (
                <TableRow key={ev.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {ev.createdAt ? new Date(ev.createdAt).toLocaleString('vi-VN') : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[10px]">
                      {tx(actionLabel(ev.action))}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden font-mono text-[11px] text-muted-foreground sm:table-cell">
                    {ev.action || '—'}
                  </TableCell>
                  <TableCell className="hidden max-w-[120px] truncate text-xs text-muted-foreground md:table-cell">
                    {ev.actorId || '—'}
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
