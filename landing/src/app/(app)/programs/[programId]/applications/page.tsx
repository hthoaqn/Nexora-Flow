'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { FileTextIcon, RefreshCwIcon, UploadIcon } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth/session'
import {
  listApplications,
  uploadApplications,
  asApplicationList,
  displayName,
  getProgram,
} from '@/lib/api/client'
import type { Application, ApplicationStatus, Program } from '@/lib/api/types'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { ErrorAlert } from '@/components/dashboard/ErrorAlert'
import { LoadingBlock } from '@/components/dashboard/LoadingBlock'
import { StatusBadge } from '@/components/dashboard/StatusBadge'
import { StatCard, StatGrid } from '@/components/dashboard/StatCard'
import { DataPanel, PageShell, Section, Toolbar } from '@/components/dashboard/Section'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Spinner } from '@/components/ui/spinner'
import { APP_STATUS_LABEL } from '@/lib/status'

function sourceLabel(source?: string) {
  if (!source) return '—'
  const map: Record<string, string> = {
    public_upload: 'Công khai',
    public_form: 'Form',
    reviewer_upload: 'Nội bộ',
    reviewer_batch_upload: 'Batch',
    reviewer_form: 'Form nội bộ',
  }
  return map[source] || source.replace(/_/g, ' ')
}

export default function ApplicationsPage() {
  const { session } = useAuth()
  const params = useParams()
  const programId = String(params?.programId ?? "")

  const [program, setProgram] = useState<Program | null>(null)
  const [items, setItems] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [status, setStatus] = useState<ApplicationStatus | ''>('')
  const [industry, setIndustry] = useState('')
  const [stage, setStage] = useState('')
  const [missingData, setMissingData] = useState(false)
  const [matchingOptIn, setMatchingOptIn] = useState(false)

  const load = useCallback(async () => {
    if (!session) return
    setLoading(true)
    setError(null)
    try {
      const [p, page] = await Promise.all([
        getProgram(session, programId),
        listApplications(session, programId, {
          status: status || undefined,
          industry: industry || undefined,
          stage: stage || undefined,
          missingData: missingData || null,
          limit: 100,
        }),
      ])
      setProgram(p)
      setItems(page.items || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được hồ sơ')
    } finally {
      setLoading(false)
    }
  }, [session, programId, status, industry, stage, missingData])

  useEffect(() => {
    void load()
  }, [load])

  const onUpload = async (files: FileList | null) => {
    if (!session || !files?.length) return
    setUploading(true)
    try {
      const res = await uploadApplications(session, programId, Array.from(files), matchingOptIn)
      const list = asApplicationList(res)
      toast.success(`Đã nhận ${list.length || files.length} file`)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload thất bại')
    } finally {
      setUploading(false)
    }
  }

  const statuses = useMemo(() => Object.keys(APP_STATUS_LABEL) as ApplicationStatus[], [])
  const optInCount = items.filter((a) => a.matchingOptIn).length
  const needsReview = items.filter((a) => a.status === 'NEEDS_REVIEW').length
  // Prioritize moderation queue then newest
  const ordered = useMemo(() => {
    const rank = (s: string) => (s === 'NEEDS_REVIEW' ? 0 : s === 'ELIGIBLE' ? 1 : 2)
    return [...items].sort((a, b) => rank(a.status) - rank(b.status))
  }, [items])

  return (
    <PageShell>
      <PageHeader
        title="Hồ sơ"
        description={program?.name || 'Pipeline hồ sơ'}
        meta={
          <>
            <Badge variant="secondary">{items.length} hồ sơ</Badge>
            {needsReview > 0 ? (
              <Badge variant="default">{needsReview} chờ duyệt</Badge>
            ) : null}
          </>
        }
        actions={
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCwIcon data-icon="inline-start" />
            Làm mới
          </Button>
        }
      />

      <StatGrid>
        <StatCard label="Tổng" value={items.length} icon={FileTextIcon} />
        <StatCard label="Chờ duyệt" value={needsReview} hint="NEEDS_REVIEW" />
        <StatCard label="Matching" value={optInCount} />
        <StatCard label="Sẵn sàng chấm" value={items.filter((a) => a.status === 'ELIGIBLE').length} />
      </StatGrid>

      <Section
        title="Upload & bộ lọc"
        description="Nhận deck PDF/PPT · lọc theo trạng thái / ngành / stage"
        size="sm"
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <Label
              htmlFor="file-upload"
              className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-4 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
            >
              <input
                id="file-upload"
                type="file"
                className="sr-only"
                multiple
                accept=".pdf,.ppt,.pptx,application/pdf"
                disabled={uploading}
                onChange={(e) => void onUpload(e.target.files)}
              />
              {uploading ? <Spinner className="size-3.5" /> : <UploadIcon className="size-3.5" />}
              {uploading ? 'Đang tải…' : 'Upload deck'}
            </Label>
            <div className="flex items-center gap-1.5">
              <Checkbox
                id="optin"
                checked={matchingOptIn}
                onCheckedChange={(v) => setMatchingOptIn(v === true)}
              />
              <Label htmlFor="optin" className="text-xs font-normal">
                Bật matching khi upload
              </Label>
            </div>
          </div>

          <Toolbar className="border-0 bg-muted/30 p-2 shadow-none sm:items-end">
            <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="flex flex-col gap-1">
                <Label className="text-[10px] text-muted-foreground">Trạng thái</Label>
                <Select
                  value={status || 'all'}
                  onValueChange={(v) => setStatus(!v || v === 'all' ? '' : (v as ApplicationStatus))}
                >
                  <SelectTrigger size="sm" className="w-full">
                    <SelectValue placeholder="Trạng thái" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="all">Tất cả</SelectItem>
                      {statuses.map((s) => (
                        <SelectItem key={s} value={s}>
                          {APP_STATUS_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-[10px] text-muted-foreground">Ngành</Label>
                <Input
                  className="h-8"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  placeholder="AgriTech…"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-[10px] text-muted-foreground">Giai đoạn</Label>
                <Input
                  className="h-8"
                  value={stage}
                  onChange={(e) => setStage(e.target.value)}
                  placeholder="Seed…"
                />
              </div>
              <div className="flex items-end gap-2 pb-1">
                <Checkbox
                  id="missing"
                  checked={missingData}
                  onCheckedChange={(v) => setMissingData(v === true)}
                />
                <Label htmlFor="missing" className="text-xs font-normal">
                  Chỉ thiếu data
                </Label>
              </div>
            </div>
          </Toolbar>
        </div>
      </Section>

      {error ? <ErrorAlert message={error} onRetry={load} /> : null}

      {loading ? (
        <LoadingBlock />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<FileTextIcon />}
          title="Chưa có hồ sơ"
          description="Upload deck hoặc gửi link nộp từ Tổng quan."
        />
      ) : (
        <DataPanel
          footer={
            <>
              <span>
                {items.length} hồ sơ · {optInCount} matching
              </span>
              <span>Mở chi tiết để xác nhận profile</span>
            </>
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Startup</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="hidden sm:table-cell">Nguồn</TableHead>
                <TableHead className="hidden md:table-cell">Ngành</TableHead>
                <TableHead className="hidden md:table-cell">Match</TableHead>
                <TableHead className="w-[1%]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {ordered.map((app) => (
                <TableRow key={app.id}>
                  <TableCell className="max-w-[200px] font-medium">
                    <span className="block truncate">{displayName(app)}</span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={app.status} />
                  </TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
                    {sourceLabel(app.source)}
                  </TableCell>
                  <TableCell className="hidden max-w-[120px] truncate text-xs text-muted-foreground md:table-cell">
                    {formatIndustry(app) || '—'}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge
                      variant={app.matchingOptIn ? 'default' : 'outline'}
                      className="text-[10px]"
                    >
                      {app.matchingOptIn ? 'On' : 'Off'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      render={<Link href={`/applications/${app.id}`} />}
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

function formatIndustry(app: Application): string {
  const p = app.confirmedProfile || app.submittedProfile || {}
  const v = p.industry
  if (Array.isArray(v)) return v.join(', ')
  if (typeof v === 'string') return v
  return ''
}
