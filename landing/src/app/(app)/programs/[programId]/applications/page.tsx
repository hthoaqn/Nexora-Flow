'use client'

/**
 * Applications pipeline — compact header, large drop zone, simple list.
 */

import { useTx } from '@/lib/tx'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  FileTextIcon,
  Loader2Icon,
  RefreshCwIcon,
  Trash2Icon,
  UploadIcon,
  XIcon,
  CloudUploadIcon,
} from 'lucide-react'
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
import {
  UPLOAD_ACCEPT,
  UPLOAD_ACCEPT_LABEL_EN,
  UPLOAD_ACCEPT_LABEL_VI,
  filterAllowedFiles,
  formatFileSize,
} from '@/lib/upload-types'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { ErrorAlert } from '@/components/dashboard/ErrorAlert'
import { LoadingBlock } from '@/components/dashboard/LoadingBlock'
import { StatusBadge } from '@/components/dashboard/StatusBadge'
import { PageShell } from '@/components/dashboard/Section'
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
import { Spinner } from '@/components/ui/spinner'
import { APP_STATUS_LABEL } from '@/lib/status'
import { cn } from '@/lib/utils'

function isProcessingStatus(status: string) {
  return status === 'RECEIVED' || status === 'EXTRACTING'
}

function formatIndustry(app: Application): string {
  const p = app.confirmedProfile || app.submittedProfile || {}
  const v = p.industry ?? p.industries
  if (Array.isArray(v)) return v.join(', ')
  if (typeof v === 'string') return v
  return ''
}

export default function ApplicationsPage() {
  const { tx } = useTx()
  const { session } = useAuth()
  const params = useParams()
  const programId = String(params?.programId ?? '')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [program, setProgram] = useState<Program | null>(null)
  const [items, setItems] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadPhase, setUploadPhase] = useState<
    'idle' | 'uploading' | 'processing'
  >('idle')
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [status, setStatus] = useState<ApplicationStatus | ''>('')
  const [q, setQ] = useState('')
  const [matchingOptIn, setMatchingOptIn] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const sessionKey = session
    ? `${session.userId}|${session.organizationId}`
    : ''
  const loadInFlight = useRef(false)

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!session || !programId) return
      if (loadInFlight.current && !opts?.silent) return
      loadInFlight.current = true
      if (!opts?.silent) setLoading(true)
      setError(null)
      try {
        const [p, page] = await Promise.all([
          getProgram(session, programId),
          listApplications(session, programId, {
            status: status || undefined,
            limit: 100,
          }),
        ])
        setProgram(p)
        setItems(page.items || [])
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : tx('Không tải được hồ sơ', 'Could not load applications'),
        )
      } finally {
        loadInFlight.current = false
        if (!opts?.silent) setLoading(false)
      }
    },
    [session, programId, status, tx],
  )

  useEffect(() => {
    if (!sessionKey || !programId) return
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey, programId, status])

  const processingCount = items.filter((a) =>
    isProcessingStatus(a.status),
  ).length
  useEffect(() => {
    if (!session || processingCount === 0) return
    const t = window.setInterval(() => {
      void load({ silent: true })
    }, 5000)
    return () => window.clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey, processingCount, programId])

  const pickFiles = (list: FileList | File[] | null) => {
    if (!list || (Array.isArray(list) ? list.length === 0 : !list.length))
      return
    const { accepted, rejected } = filterAllowedFiles(list)
    if (rejected.length) {
      toast.error(
        tx(
          `${rejected.length} file không hỗ trợ`,
          `${rejected.length} unsupported file(s)`,
        ),
      )
    }
    if (!accepted.length) return
    setPendingFiles((prev) => {
      const names = new Set(prev.map((f) => `${f.name}:${f.size}`))
      const next = [...prev]
      for (const f of accepted) {
        const k = `${f.name}:${f.size}`
        if (!names.has(k)) next.push(f)
      }
      return next
    })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removePending = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const onSubmitUpload = async () => {
    if (!session || pendingFiles.length === 0) return
    const fileCount = pendingFiles.length
    const files = [...pendingFiles]
    setUploading(true)
    setUploadPhase('uploading')
    try {
      const res = await uploadApplications(
        session,
        programId,
        files,
        matchingOptIn,
      )
      const list = asApplicationList(res)
      setPendingFiles([])
      setUploadPhase('processing')
      toast.success(
        tx(
          `Đã nộp ${list.length || fileCount} file`,
          `Submitted ${list.length || fileCount} file(s)`,
        ),
      )
      await load({ silent: true })
      window.setTimeout(() => setUploadPhase('idle'), 2000)
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : tx('Upload thất bại', 'Upload failed'),
      )
      setUploadPhase('idle')
    } finally {
      setUploading(false)
    }
  }

  const statuses = useMemo(
    () => Object.keys(APP_STATUS_LABEL) as ApplicationStatus[],
    [],
  )
  const needsReview = items.filter((a) => a.status === 'NEEDS_REVIEW').length
  const eligible = items.filter((a) => a.status === 'ELIGIBLE').length

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    let list = items
    if (s) {
      list = list.filter((a) => {
        const name = displayName(a).toLowerCase()
        const ind = formatIndustry(a).toLowerCase()
        return name.includes(s) || ind.includes(s)
      })
    }
    const rank = (st: string) =>
      st === 'EXTRACTING'
        ? 0
        : st === 'RECEIVED'
          ? 1
          : st === 'NEEDS_REVIEW'
            ? 2
            : st === 'ELIGIBLE'
              ? 3
              : 4
    return [...list].sort((a, b) => rank(a.status) - rank(b.status))
  }, [items, q])

  const acceptLabel = tx(UPLOAD_ACCEPT_LABEL_VI, UPLOAD_ACCEPT_LABEL_EN)
  const busy = uploading || uploadPhase === 'processing'

  return (
    <PageShell>
      <PageHeader
        title={tx('Hồ sơ', 'Applications')}
        description={program?.name || undefined}
        meta={
          <>
            <Badge variant="secondary">
              {items.length} {tx('hồ sơ', 'apps')}
            </Badge>
            {needsReview > 0 ? (
              <Badge variant="default">
                {needsReview} {tx('chờ duyệt', 'review')}
              </Badge>
            ) : null}
            {eligible > 0 ? (
              <Badge variant="outline">
                {eligible} {tx('sẵn sàng', 'ready')}
              </Badge>
            ) : null}
            {processingCount > 0 ? (
              <Badge variant="outline" className="gap-1">
                <Loader2Icon className="size-3 animate-spin" />
                {processingCount}
              </Badge>
            ) : null}
          </>
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <RefreshCwIcon data-icon="inline-start" />
            )}
            {tx('Làm mới', 'Refresh')}
          </Button>
        }
      />

      {/* ── LARGE drop zone ── */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={(e) => {
          // only leave when exiting the zone (not child)
          if (e.currentTarget.contains(e.relatedTarget as Node)) return
          setDragOver(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          pickFiles(e.dataTransfer.files)
        }}
        onClick={() => {
          if (!busy) fileInputRef.current?.click()
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            if (!busy) fileInputRef.current?.click()
          }
        }}
        className={cn(
          'relative flex min-h-[220px] cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-all sm:min-h-[280px] sm:py-14',
          dragOver
            ? 'scale-[1.01] border-primary bg-primary/15 shadow-md'
            : 'border-primary/35 bg-primary/5 hover:border-primary/55 hover:bg-primary/10',
          busy && 'pointer-events-none opacity-60',
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="sr-only"
          multiple
          accept={UPLOAD_ACCEPT}
          disabled={busy}
          onChange={(e) => {
            pickFiles(e.target.files)
          }}
          onClick={(e) => e.stopPropagation()}
        />
        <span
          className={cn(
            'flex size-16 items-center justify-center rounded-2xl sm:size-20',
            dragOver
              ? 'bg-primary text-primary-foreground'
              : 'bg-primary/15 text-primary',
          )}
        >
          <CloudUploadIcon className="size-8 sm:size-10" />
        </span>
        <div className="space-y-1">
          <p className="font-heading text-base font-semibold sm:text-lg">
            {dragOver
              ? tx('Thả file vào đây', 'Drop files here')
              : tx(
                  'Kéo thả file vào đây — hoặc bấm để chọn',
                  'Drag & drop files here — or click to browse',
                )}
          </p>
          <p className="mx-auto max-w-md text-xs text-muted-foreground sm:text-sm">
            {acceptLabel}
            {' · '}
            {tx('Nhiều file cùng lúc', 'Multiple files OK')}
          </p>
        </div>
        <div
          className="flex flex-wrap items-center justify-center gap-3"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            type="button"
            size="sm"
            className="rounded-full"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadIcon data-icon="inline-start" />
            {tx('Chọn file', 'Choose files')}
          </Button>
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <Checkbox
              checked={matchingOptIn}
              onCheckedChange={(v) => setMatchingOptIn(v === true)}
              disabled={busy}
            />
            {tx('Bật so khớp khi nộp', 'Enable matching on submit')}
          </label>
        </div>
      </div>

      {/* Pending files queue */}
      {pendingFiles.length > 0 ? (
        <div className="rounded-2xl border bg-card/60 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">
              {pendingFiles.length}{' '}
              {tx('file chờ nộp', 'file(s) ready')}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="rounded-full"
                onClick={() => setPendingFiles([])}
                disabled={busy}
              >
                <XIcon data-icon="inline-start" />
                {tx('Xoá hết', 'Clear')}
              </Button>
              <Button
                type="button"
                size="sm"
                className="rounded-full"
                disabled={busy}
                onClick={() => void onSubmitUpload()}
              >
                {uploading ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <UploadIcon data-icon="inline-start" />
                )}
                {uploading
                  ? tx('Đang nộp…', 'Submitting…')
                  : tx(
                      `Nộp ${pendingFiles.length} file`,
                      `Submit ${pendingFiles.length}`,
                    )}
              </Button>
            </div>
          </div>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {pendingFiles.map((f, i) => (
              <li
                key={`${f.name}-${f.size}-${i}`}
                className="flex items-center gap-2 rounded-xl border bg-background/70 px-3 py-2 text-xs"
              >
                <FileTextIcon className="size-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1 truncate font-medium">
                  {f.name}
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {formatFileSize(f.size)}
                </span>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="size-7 shrink-0"
                  disabled={busy}
                  onClick={() => removePending(i)}
                >
                  <Trash2Icon className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {(busy || processingCount > 0) && (
        <div className="flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm">
          <Spinner className="size-4 shrink-0 text-primary" />
          <p className="font-medium">
            {uploadPhase === 'uploading'
              ? tx('Đang tải lên…', 'Uploading…')
              : processingCount > 0
                ? tx(
                    `${processingCount} hồ sơ AI đang xử lý`,
                    `${processingCount} app(s) processing`,
                  )
                : tx('AI đang trích xuất…', 'AI extracting…')}
          </p>
        </div>
      )}

      {/* Compact filter row */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          className="h-9 flex-1"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={tx('Tìm tên / ngành…', 'Search name / sector…')}
        />
        <Select
          value={status || 'all'}
          onValueChange={(v) =>
            setStatus(!v || v === 'all' ? '' : (v as ApplicationStatus))
          }
        >
          <SelectTrigger size="sm" className="w-full sm:w-44">
            <SelectValue placeholder={tx('Trạng thái', 'Status')} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">{tx('Tất cả', 'All')}</SelectItem>
              {statuses.map((s) => (
                <SelectItem key={s} value={s}>
                  {APP_STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {error ? <ErrorAlert message={error} onRetry={() => void load()} /> : null}

      {loading ? (
        <LoadingBlock />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<FileTextIcon />}
          title={tx('Chưa có hồ sơ', 'No applications')}
          description={tx(
            'Kéo thả deck / PDF vào vùng phía trên.',
            'Drop a deck / PDF into the zone above.',
          )}
        />
      ) : (
        <ul className="divide-y overflow-hidden rounded-2xl border">
          {filtered.map((app) => {
            const processing = isProcessingStatus(app.status)
            return (
              <li key={app.id}>
                <Link
                  href={`/applications/${app.id}`}
                  className={cn(
                    'flex items-center gap-3 px-3 py-3 transition-colors hover:bg-muted/40 sm:px-4',
                    processing && 'bg-primary/5',
                    processing && 'pointer-events-none opacity-70',
                  )}
                  aria-disabled={processing}
                  onClick={(e) => {
                    if (processing) e.preventDefault()
                  }}
                >
                  {processing ? (
                    <Loader2Icon className="size-4 shrink-0 animate-spin text-primary" />
                  ) : (
                    <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {displayName(app)}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {formatIndustry(app) ||
                        (processing
                          ? tx('Đang xử lý…', 'Processing…')
                          : '—')}
                    </p>
                  </div>
                  <StatusBadge status={app.status} />
                  <span className="hidden text-xs font-medium text-primary sm:inline">
                    {processing ? tx('Chờ', 'Wait') : tx('Mở', 'Open')}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </PageShell>
  )
}
