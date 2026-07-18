'use client'

/**
 * Intake workspace ↔ Deal-flow (API thật https://api.nexora-flow.cloud).
 * Inbox kiểm duyệt kết nối từ Startup Portal: duyệt → Vòng 1 (video call 1-1 /
 * yêu cầu riêng) → Vòng 2 (câu hỏi, startup trả lời text/video) → chấp thuận.
 * Kèm trình soạn Hồ sơ đối tác & JD hiển thị cho startup khi so khớp.
 */

import * as React from 'react'
import {
  CheckIcon,
  ClockIcon,
  FileTextIcon,
  HandshakeIcon,
  InboxIcon,
  ListChecksIcon,
  RefreshCwIcon,
  SaveIcon,
  VideoIcon,
  XIcon,
} from 'lucide-react'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { PageShell, Section } from '@/components/dashboard/Section'
import { StatCard, StatGrid } from '@/components/dashboard/StatCard'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { LoadingBlock } from '@/components/dashboard/LoadingBlock'
import { ErrorAlert } from '@/components/dashboard/ErrorAlert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/lib/auth/session'
import type { AuthSession } from '@/lib/api/types'

// ─── Real deal-flow API (same-origin rewrite → api.nexora-flow.cloud) ───────

const API_BASE = '/intake-api/api'
const fileUrl = (id: string) => `${API_BASE}/files/${id}`

async function dealflowFetch<T>(
  session: AuthSession,
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const headers = new Headers(init?.headers)
  headers.set('x-user-id', session.userId)
  headers.set('x-user-email', session.email)
  headers.set('x-organization-id', session.organizationId)
  headers.set('x-user-role', session.role)
  let body = init?.body
  if (init?.json !== undefined) {
    headers.set('content-type', 'application/json')
    body = JSON.stringify(init.json)
  }
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers, body, cache: 'no-store' })
  const parsed = await res.json().catch(() => null)
  if (!res.ok) {
    const msg =
      parsed?.message ||
      (typeof parsed?.detail === 'object' ? parsed?.detail?.message : parsed?.detail) ||
      `HTTP ${res.status}`
    throw new Error(String(msg))
  }
  // Envelope { success, data } hoặc DTO trần đều chấp nhận
  if (parsed && typeof parsed === 'object' && 'success' in parsed) {
    if (!parsed.success) throw new Error(parsed.message || 'API error')
    return parsed.data as T
  }
  return parsed as T
}

// ─── Types (mirror DTO backend) ──────────────────────────────────────────────

type Round1 = {
  mode: 'video_call' | 'custom'
  meetingLink: string | null
  scheduledAt: string | null
  note: string | null
}

type Round2Answer = { question?: string; text: string; videoFileId: string | null }

type Connection = {
  id: string
  status:
    | 'pending'
    | 'round1'
    | 'round2'
    | 'round2_submitted'
    | 'accepted'
    | 'rejected'
    | 'cancelled'
  message: string
  matchScore: number | null
  startupName?: string
  startupProfile?: {
    startupName?: string
    description?: string
    industries?: string[]
    technologies?: string[]
    markets?: string[]
    stage?: string
    website?: string | null
    contactEmail?: string | null
    fundingNeed?: number | null
    currency?: string
    profileCompletion?: number
  }
  round1?: Round1 | null
  round2?: { questions: string[]; answers: Round2Answer[]; submittedAt: string | null } | null
  timeline?: Array<{ at: string; actor: string; type: string; note?: string }>
  decisionNote?: string | null
  createdAt: string
  updatedAt: string
}

type Partner = {
  id: string
  organizationName: string
  organizationType: string
  website: string | null
  description: string
  interestedIndustries: string[]
  interestedTechnologies: string[]
  preferredStages: string[]
  preferredMarkets: string[]
  partnershipTypes: string[]
  investmentRange: { min: number | null; max: number | null; currency: string }
  requiredCapabilities: string[]
  requiredConditions: string[]
  excludedConditions: string[]
  challengeDescription: string | null
  contactEmail: string | null
  contactPerson?: string | null
  phoneNumber?: string | null
  round2Questions?: string[]
  round1Note?: string | null
  isActive: boolean
}

type Overview = {
  partner: Partner
  counts: {
    total: number
    pending: number
    round1: number
    round2: number
    round2_submitted: number
    accepted: number
    rejected: number
  }
}

// ─── Status chips ────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; className: string }> = {
  pending: { label: 'Chờ kiểm duyệt', className: 'bg-amber-500/10 text-amber-600 border-amber-500/30' },
  round1: { label: 'Vòng 1 · Phỏng vấn', className: 'bg-sky-500/10 text-sky-600 border-sky-500/30' },
  round2: { label: 'Vòng 2 · Chờ startup', className: 'bg-violet-500/10 text-violet-600 border-violet-500/30' },
  round2_submitted: {
    label: 'Vòng 2 · Chờ kiểm duyệt',
    className: 'bg-orange-500/10 text-orange-600 border-orange-500/30',
  },
  accepted: { label: 'Đã chấp thuận', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' },
  rejected: { label: 'Đã từ chối', className: 'bg-rose-500/10 text-rose-600 border-rose-500/30' },
  cancelled: { label: 'Startup đã rút', className: 'bg-muted text-muted-foreground border-border' },
}

function StatusChip({ status }: { status: string }) {
  const meta = STATUS_META[status] || STATUS_META.pending
  return (
    <Badge variant="outline" className={meta.className}>
      {meta.label}
    </Badge>
  )
}

function fmt(dt?: string | null) {
  if (!dt) return '—'
  try {
    return new Date(dt).toLocaleString('vi-VN')
  } catch {
    return dt
  }
}

const splitList = (v: string) =>
  v
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean)

const splitLines = (v: string) =>
  v
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)

// ─── Decision dialogs ────────────────────────────────────────────────────────

type ActFn = (id: string, body: unknown) => Promise<void>

function ApprovePendingDialog({
  conn,
  onDone,
  onClose,
  act,
}: {
  conn: Connection
  onDone: () => void
  onClose: () => void
  act: ActFn
}) {
  const [mode, setMode] = React.useState<'video_call' | 'custom'>('video_call')
  const [scheduledAt, setScheduledAt] = React.useState('')
  const [note, setNote] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await act(conn.id, {
        action: 'approve',
        round1: {
          mode,
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
          note: note || null,
        },
      })
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Có lỗi xảy ra')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o: boolean) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Duyệt kết nối · thiết lập Vòng 1</DialogTitle>
          <DialogDescription>
            Chấp nhận yêu cầu của {conn.startupName} và mời họ vào Vòng 1.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode('video_call')}
              className={`rounded-lg border p-3 text-left text-sm transition ${
                mode === 'video_call' ? 'border-primary bg-primary/10' : 'hover:bg-muted/50'
              }`}
            >
              <VideoIcon className="mb-1.5 size-4 text-primary" />
              <p className="font-medium">Video call 1-1</p>
              <p className="text-xs text-muted-foreground">Link phòng họp tạo tự động</p>
            </button>
            <button
              type="button"
              onClick={() => setMode('custom')}
              className={`rounded-lg border p-3 text-left text-sm transition ${
                mode === 'custom' ? 'border-primary bg-primary/10' : 'hover:bg-muted/50'
              }`}
            >
              <ListChecksIcon className="mb-1.5 size-4 text-primary" />
              <p className="font-medium">Yêu cầu khác</p>
              <p className="text-xs text-muted-foreground">Tự mô tả yêu cầu Vòng 1</p>
            </button>
          </div>
          {mode === 'video_call' ? (
            <div>
              <label className="mb-1 block text-sm font-medium">
                Thời gian phỏng vấn (tùy chọn)
              </label>
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </div>
          ) : null}
          <div>
            <label className="mb-1 block text-sm font-medium">
              {mode === 'custom' ? 'Mô tả yêu cầu Vòng 1' : 'Ghi chú cho startup (tùy chọn)'}
            </label>
            <Textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                mode === 'custom'
                  ? 'VD: Gửi demo sản phẩm + tài liệu tài chính 12 tháng gần nhất…'
                  : 'VD: Chuẩn bị pitch 10 phút về traction…'
              }
            />
          </div>
          {error ? <ErrorAlert message={error} /> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Hủy
          </Button>
          <Button onClick={submit} disabled={busy || (mode === 'custom' && !note.trim())}>
            <CheckIcon data-icon="inline-start" />
            {busy ? 'Đang duyệt…' : 'Duyệt & mở Vòng 1'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PassRound1Dialog({
  conn,
  defaultQuestions,
  onDone,
  onClose,
  act,
}: {
  conn: Connection
  defaultQuestions: string[]
  onDone: () => void
  onClose: () => void
  act: ActFn
}) {
  const [questions, setQuestions] = React.useState(defaultQuestions.join('\n'))
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await act(conn.id, { action: 'approve', questions: splitLines(questions) })
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Có lỗi xảy ra')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o: boolean) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Đạt Vòng 1 · gửi câu hỏi Vòng 2</DialogTitle>
          <DialogDescription>
            {conn.startupName} sẽ trả lời từng câu bằng văn bản hoặc video tự quay.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium">
            Câu hỏi Vòng 2 (mỗi dòng một câu, tối đa 10)
          </label>
          <Textarea
            rows={6}
            value={questions}
            onChange={(e) => setQuestions(e.target.value)}
            placeholder={'VD:\nMô tả lợi thế cạnh tranh cốt lõi của bạn?\nKế hoạch sử dụng vốn 18 tháng tới?'}
          />
          {error ? <ErrorAlert message={error} /> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Hủy
          </Button>
          <Button onClick={submit} disabled={busy || splitLines(questions).length === 0}>
            <CheckIcon data-icon="inline-start" />
            {busy ? 'Đang chuyển…' : 'Chuyển sang Vòng 2'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RejectDialog({
  conn,
  onDone,
  onClose,
  act,
}: {
  conn: Connection
  onDone: () => void
  onClose: () => void
  act: ActFn
}) {
  const [note, setNote] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await act(conn.id, { action: 'reject', note })
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Có lỗi xảy ra')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o: boolean) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Từ chối yêu cầu</DialogTitle>
          <DialogDescription>
            Startup sẽ thấy trạng thái bị từ chối kèm lý do (nếu có).
          </DialogDescription>
        </DialogHeader>
        <Textarea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Lý do từ chối (tùy chọn)…"
        />
        {error ? <ErrorAlert message={error} /> : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Hủy
          </Button>
          <Button variant="destructive" onClick={submit} disabled={busy}>
            <XIcon data-icon="inline-start" />
            {busy ? 'Đang gửi…' : 'Từ chối'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ReviewRound2Dialog({
  conn,
  onDone,
  onClose,
  act,
}: {
  conn: Connection
  onDone: () => void
  onClose: () => void
  act: ActFn
}) {
  const [note, setNote] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const decide = async (action: 'approve' | 'reject') => {
    setBusy(true)
    setError(null)
    try {
      await act(conn.id, { action, note })
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Có lỗi xảy ra')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o: boolean) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kiểm duyệt Vòng 2 · {conn.startupName}</DialogTitle>
          <DialogDescription>
            Nộp lúc {fmt(conn.round2?.submittedAt)} · duyệt để kết nối chính thức.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {(conn.round2?.answers || []).map((a, i) => (
            <div key={i} className="rounded-lg border p-3">
              <p className="text-sm font-semibold">
                Câu {i + 1}. {a.question || conn.round2?.questions?.[i] || ''}
              </p>
              {a.text ? (
                <p className="mt-2 text-sm whitespace-pre-wrap text-muted-foreground">
                  {a.text}
                </p>
              ) : null}
              {a.videoFileId ? (
                <video
                  controls
                  preload="metadata"
                  className="mt-2 max-h-64 w-full rounded-md bg-black"
                  src={fileUrl(a.videoFileId)}
                />
              ) : null}
            </div>
          ))}
          <Textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ghi chú quyết định (tùy chọn)…"
          />
          {error ? <ErrorAlert message={error} /> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Đóng
          </Button>
          <Button variant="destructive" onClick={() => decide('reject')} disabled={busy}>
            <XIcon data-icon="inline-start" />
            Loại
          </Button>
          <Button onClick={() => decide('approve')} disabled={busy}>
            <HandshakeIcon data-icon="inline-start" />
            {busy ? 'Đang xử lý…' : 'Chấp thuận kết nối'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Connection card ─────────────────────────────────────────────────────────

function ConnectionCard({
  conn,
  partner,
  refresh,
  act,
}: {
  conn: Connection
  partner: Partner | null
  refresh: () => void
  act: ActFn
}) {
  const [dialog, setDialog] = React.useState<
    'approve' | 'round1pass' | 'reject' | 'review' | null
  >(null)
  const p = conn.startupProfile
  const done = () => {
    setDialog(null)
    refresh()
  }

  return (
    <div className="dash-card flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-heading text-base font-semibold">
              {conn.startupName || 'Startup'}
            </h3>
            <StatusChip status={conn.status} />
            {conn.matchScore != null ? (
              <Badge variant="secondary" className="tabular-nums">
                Match {Math.round(conn.matchScore)}%
              </Badge>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Gửi {fmt(conn.createdAt)} · cập nhật {fmt(conn.updatedAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {conn.status === 'pending' ? (
            <>
              <Button size="sm" onClick={() => setDialog('approve')}>
                <CheckIcon data-icon="inline-start" />
                Duyệt · mở Vòng 1
              </Button>
              <Button size="sm" variant="outline" onClick={() => setDialog('reject')}>
                Từ chối
              </Button>
            </>
          ) : null}
          {conn.status === 'round1' ? (
            <>
              {conn.round1?.meetingLink ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    window.open(conn.round1?.meetingLink || '', '_blank', 'noreferrer')
                  }
                >
                  <VideoIcon data-icon="inline-start" />
                  Mở phòng phỏng vấn
                </Button>
              ) : null}
              <Button size="sm" onClick={() => setDialog('round1pass')}>
                <CheckIcon data-icon="inline-start" />
                Đạt Vòng 1
              </Button>
              <Button size="sm" variant="outline" onClick={() => setDialog('reject')}>
                Loại
              </Button>
            </>
          ) : null}
          {conn.status === 'round2' ? (
            <Badge variant="outline" className="self-center">
              <ClockIcon className="size-3.5" />
              Chờ startup nộp bài
            </Badge>
          ) : null}
          {conn.status === 'round2_submitted' ? (
            <Button size="sm" onClick={() => setDialog('review')}>
              <FileTextIcon data-icon="inline-start" />
              Xem bài nộp & kiểm duyệt
            </Button>
          ) : null}
        </div>
      </div>

      {p ? (
        <div className="rounded-lg bg-muted/40 p-3 text-sm">
          <p className="line-clamp-2 text-muted-foreground">
            {p.description || 'Chưa có mô tả.'}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {p.stage ? <Badge variant="secondary">{p.stage}</Badge> : null}
            {(p.industries || []).slice(0, 4).map((x) => (
              <Badge key={x} variant="outline">
                {x}
              </Badge>
            ))}
            {(p.markets || []).slice(0, 3).map((x) => (
              <Badge key={x} variant="outline">
                {x}
              </Badge>
            ))}
          </div>
          {conn.status === 'accepted' && p.contactEmail ? (
            <p className="mt-2 text-xs">
              Liên hệ: <span className="font-medium">{p.contactEmail}</span>
              {p.website ? <> · {p.website}</> : null}
            </p>
          ) : null}
        </div>
      ) : null}

      {conn.message ? (
        <p className="border-l-2 border-primary/40 pl-3 text-sm text-muted-foreground italic">
          &ldquo;{conn.message}&rdquo;
        </p>
      ) : null}

      {conn.round1 &&
      (conn.status === 'round1' ||
        conn.status === 'round2' ||
        conn.status === 'round2_submitted') ? (
        <p className="text-xs text-muted-foreground">
          Vòng 1: {conn.round1.mode === 'video_call' ? 'Video call 1-1' : 'Yêu cầu tùy chỉnh'}
          {conn.round1.scheduledAt ? ` · ${fmt(conn.round1.scheduledAt)}` : ''}
          {conn.round1.note ? ` · ${conn.round1.note}` : ''}
        </p>
      ) : null}

      {conn.timeline && conn.timeline.length > 0 ? (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer font-medium select-none">
            Nhật ký ({conn.timeline.length})
          </summary>
          <ul className="mt-1.5 flex flex-col gap-1 border-l pl-3">
            {conn.timeline.map((t, i) => (
              <li key={i}>
                <span className="tabular-nums">{fmt(t.at)}</span> — {t.note || t.type}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {dialog === 'approve' ? (
        <ApprovePendingDialog conn={conn} onDone={done} onClose={() => setDialog(null)} act={act} />
      ) : null}
      {dialog === 'round1pass' ? (
        <PassRound1Dialog
          conn={conn}
          defaultQuestions={partner?.round2Questions || []}
          onDone={done}
          onClose={() => setDialog(null)}
          act={act}
        />
      ) : null}
      {dialog === 'reject' ? (
        <RejectDialog conn={conn} onDone={done} onClose={() => setDialog(null)} act={act} />
      ) : null}
      {dialog === 'review' ? (
        <ReviewRound2Dialog conn={conn} onDone={done} onClose={() => setDialog(null)} act={act} />
      ) : null}
    </div>
  )
}

// ─── JD / partner profile form ───────────────────────────────────────────────

const ORG_TYPES: Array<{ value: string; label: string }> = [
  { value: 'corporation', label: 'Doanh nghiệp' },
  { value: 'investment_fund', label: 'Quỹ đầu tư' },
  { value: 'investor', label: 'Nhà đầu tư' },
  { value: 'university', label: 'Trường đại học' },
  { value: 'research_institution', label: 'Viện nghiên cứu' },
  { value: 'innovation_organization', label: 'Tổ chức đổi mới sáng tạo' },
]

function FieldRow({
  label,
  children,
  hint,
}: {
  label: string
  children: React.ReactNode
  hint?: string
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      {children}
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function PartnerProfileForm({
  partner,
  onSaved,
  save,
}: {
  partner: Partner
  onSaved: () => void
  save: (body: unknown) => Promise<void>
}) {
  const [form, setForm] = React.useState(() => ({
    organizationName: partner.organizationName || '',
    organizationType: partner.organizationType || 'innovation_organization',
    website: partner.website || '',
    description: partner.description || '',
    challengeDescription: partner.challengeDescription || '',
    interestedIndustries: (partner.interestedIndustries || []).join(', '),
    interestedTechnologies: (partner.interestedTechnologies || []).join(', '),
    preferredStages: (partner.preferredStages || []).join(', '),
    preferredMarkets: (partner.preferredMarkets || []).join(', '),
    partnershipTypes: (partner.partnershipTypes || []).join(', '),
    requiredCapabilities: (partner.requiredCapabilities || []).join(', '),
    requiredConditions: (partner.requiredConditions || []).join(', '),
    excludedConditions: (partner.excludedConditions || []).join(', '),
    investmentMin: partner.investmentRange?.min?.toString() || '',
    investmentMax: partner.investmentRange?.max?.toString() || '',
    currency: partner.investmentRange?.currency || 'USD',
    contactEmail: partner.contactEmail || '',
    contactPerson: partner.contactPerson || '',
    phoneNumber: partner.phoneNumber || '',
    round1Note: partner.round1Note || '',
    round2Questions: (partner.round2Questions || []).join('\n'),
    isActive: partner.isActive,
  }))
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [saved, setSaved] = React.useState(false)

  const set = (k: string, v: string | boolean) => {
    setForm((f) => ({ ...f, [k]: v }))
    setSaved(false)
  }

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await save({
        organizationName: form.organizationName,
        organizationType: form.organizationType,
        website: form.website || '',
        description: form.description,
        challengeDescription: form.challengeDescription || '',
        interestedIndustries: splitList(form.interestedIndustries),
        interestedTechnologies: splitList(form.interestedTechnologies),
        preferredStages: splitList(form.preferredStages),
        preferredMarkets: splitList(form.preferredMarkets),
        partnershipTypes: splitList(form.partnershipTypes),
        requiredCapabilities: splitList(form.requiredCapabilities),
        requiredConditions: splitList(form.requiredConditions),
        excludedConditions: splitList(form.excludedConditions),
        investmentRange: {
          min: form.investmentMin ? Number(form.investmentMin) : null,
          max: form.investmentMax ? Number(form.investmentMax) : null,
          currency: form.currency,
        },
        contactEmail: form.contactEmail || '',
        contactPerson: form.contactPerson || '',
        phoneNumber: form.phoneNumber || '',
        round1Note: form.round1Note || '',
        round2Questions: splitLines(form.round2Questions),
        isActive: form.isActive,
      })
      setSaved(true)
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lưu thất bại')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Section
        title="Thông tin tổ chức"
        description="Hiển thị cho startup trong Danh bạ đối tác và kết quả so khớp."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldRow label="Tên tổ chức *">
            <Input
              value={form.organizationName}
              onChange={(e) => set('organizationName', e.target.value)}
            />
          </FieldRow>
          <FieldRow label="Loại hình">
            <select
              className="border-input focus-visible:ring-ring h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-2"
              value={form.organizationType}
              onChange={(e) => set('organizationType', e.target.value)}
            >
              {ORG_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </FieldRow>
          <FieldRow label="Website">
            <Input value={form.website} onChange={(e) => set('website', e.target.value)} />
          </FieldRow>
          <FieldRow label="Email liên hệ">
            <Input value={form.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} />
          </FieldRow>
          <FieldRow label="Người đại diện">
            <Input
              value={form.contactPerson}
              onChange={(e) => set('contactPerson', e.target.value)}
            />
          </FieldRow>
          <FieldRow label="SĐT / Zalo">
            <Input value={form.phoneNumber} onChange={(e) => set('phoneNumber', e.target.value)} />
          </FieldRow>
        </div>
        <div className="mt-4">
          <FieldRow label="Giới thiệu tổ chức">
            <Textarea
              rows={3}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </FieldRow>
        </div>
      </Section>

      <Section
        title="JD & tiêu chí thiết yếu"
        description="Startup xem JD này; thuật toán chấm điểm so khớp dựa trên các tiêu chí bên dưới."
      >
        <div className="flex flex-col gap-4">
          <FieldRow
            label="JD / Bài toán cần startup giải quyết"
            hint="Mô tả đề bài, phạm vi hợp tác, kỳ vọng đầu ra."
          >
            <Textarea
              rows={4}
              value={form.challengeDescription}
              onChange={(e) => set('challengeDescription', e.target.value)}
            />
          </FieldRow>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldRow label="Lĩnh vực quan tâm" hint="Phân tách bằng dấu phẩy">
              <Input
                value={form.interestedIndustries}
                onChange={(e) => set('interestedIndustries', e.target.value)}
                placeholder="Fintech, AI, Logistics"
              />
            </FieldRow>
            <FieldRow label="Công nghệ quan tâm" hint="Phân tách bằng dấu phẩy">
              <Input
                value={form.interestedTechnologies}
                onChange={(e) => set('interestedTechnologies', e.target.value)}
                placeholder="Machine Learning, Blockchain"
              />
            </FieldRow>
            <FieldRow label="Giai đoạn ưu tiên" hint="idea, mvp, seed, growth…">
              <Input
                value={form.preferredStages}
                onChange={(e) => set('preferredStages', e.target.value)}
              />
            </FieldRow>
            <FieldRow label="Thị trường ưu tiên">
              <Input
                value={form.preferredMarkets}
                onChange={(e) => set('preferredMarkets', e.target.value)}
                placeholder="Vietnam, SEA"
              />
            </FieldRow>
            <FieldRow label="Hình thức hợp tác">
              <Input
                value={form.partnershipTypes}
                onChange={(e) => set('partnershipTypes', e.target.value)}
                placeholder="investment, pilot, co-development"
              />
            </FieldRow>
            <FieldRow label="Năng lực bắt buộc">
              <Input
                value={form.requiredCapabilities}
                onChange={(e) => set('requiredCapabilities', e.target.value)}
              />
            </FieldRow>
            <FieldRow label="Điều kiện bắt buộc">
              <Input
                value={form.requiredConditions}
                onChange={(e) => set('requiredConditions', e.target.value)}
              />
            </FieldRow>
            <FieldRow label="Điều kiện loại trừ">
              <Input
                value={form.excludedConditions}
                onChange={(e) => set('excludedConditions', e.target.value)}
              />
            </FieldRow>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <FieldRow label="Đầu tư tối thiểu">
              <Input
                type="number"
                value={form.investmentMin}
                onChange={(e) => set('investmentMin', e.target.value)}
              />
            </FieldRow>
            <FieldRow label="Đầu tư tối đa">
              <Input
                type="number"
                value={form.investmentMax}
                onChange={(e) => set('investmentMax', e.target.value)}
              />
            </FieldRow>
            <FieldRow label="Tiền tệ">
              <select
                className="border-input focus-visible:ring-ring h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-2"
                value={form.currency}
                onChange={(e) => set('currency', e.target.value)}
              >
                <option value="USD">USD</option>
                <option value="VND">VND</option>
              </select>
            </FieldRow>
          </div>
        </div>
      </Section>

      <Section
        title="Thiết lập các vòng kiểm duyệt"
        description="Áp dụng cho mọi yêu cầu kết nối mới từ startup."
      >
        <div className="flex flex-col gap-4">
          <FieldRow
            label="Yêu cầu mặc định Vòng 1"
            hint="Gợi ý hiển thị cho startup bên cạnh buổi video call 1-1."
          >
            <Textarea
              rows={2}
              value={form.round1Note}
              onChange={(e) => set('round1Note', e.target.value)}
              placeholder="VD: Chuẩn bị demo trực tiếp sản phẩm trong buổi phỏng vấn…"
            />
          </FieldRow>
          <FieldRow
            label="Bộ câu hỏi Vòng 2"
            hint="Mỗi dòng một câu hỏi — startup trả lời bằng văn bản hoặc video tự quay rồi nộp lại."
          >
            <Textarea
              rows={5}
              value={form.round2Questions}
              onChange={(e) => set('round2Questions', e.target.value)}
              placeholder={'Lợi thế cạnh tranh cốt lõi của bạn là gì?\nKế hoạch sử dụng vốn 18 tháng tới?'}
            />
          </FieldRow>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-primary size-4"
              checked={form.isActive}
              onChange={(e) => set('isActive', e.target.checked)}
            />
            Kích hoạt — hiển thị tổ chức trong hệ thống so khớp của Startup Portal
          </label>
        </div>
      </Section>

      {error ? <ErrorAlert message={error} /> : null}
      <div className="flex items-center gap-3">
        <Button onClick={submit} disabled={busy || !form.organizationName.trim()}>
          <SaveIcon data-icon="inline-start" />
          {busy ? 'Đang lưu…' : 'Lưu hồ sơ & JD'}
        </Button>
        {saved ? (
          <span className="inline-flex items-center gap-1 text-sm text-emerald-600">
            <CheckIcon className="size-4" /> Đã lưu
          </span>
        ) : null}
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function DealflowPage() {
  const { session, ready } = useAuth()
  const [overview, setOverview] = React.useState<Overview | null>(null)
  const [connections, setConnections] = React.useState<Connection[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [filter, setFilter] = React.useState<string>('all')

  const load = React.useCallback(async () => {
    if (!session) return
    try {
      const [ov, conns] = await Promise.all([
        dealflowFetch<Overview>(session, '/intake/overview'),
        dealflowFetch<Connection[] | { items?: Connection[] }>(session, '/intake/connections'),
      ])
      setOverview(ov)
      setConnections(Array.isArray(conns) ? conns : conns?.items || [])
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được dữ liệu deal-flow')
    } finally {
      setLoading(false)
    }
  }, [session])

  React.useEffect(() => {
    void load()
    const timer = setInterval(() => void load(), 25000)
    return () => clearInterval(timer)
  }, [load])

  const act = React.useCallback<ActFn>(
    async (id, body) => {
      if (!session) throw new Error('Chưa đăng nhập')
      await dealflowFetch(session, `/intake/connections/${id}/decision`, {
        method: 'POST',
        json: body,
      })
    },
    [session],
  )

  const savePartner = React.useCallback(
    async (body: unknown) => {
      if (!session) throw new Error('Chưa đăng nhập')
      await dealflowFetch(session, '/intake/partner-profile', { method: 'PUT', json: body })
    },
    [session],
  )

  if (!ready || !session) return <LoadingBlock />

  const counts = overview?.counts
  const needAction = (counts?.pending || 0) + (counts?.round2_submitted || 0)
  const visible =
    filter === 'all'
      ? connections
      : filter === 'action'
        ? connections.filter((c) => c.status === 'pending' || c.status === 'round2_submitted')
        : connections.filter((c) => c.status === filter)

  return (
    <PageShell>
      <PageHeader
        title="Kết nối Startup (Deal-flow)"
        description="Kiểm duyệt yêu cầu kết nối, điều phối Vòng 1 phỏng vấn và Vòng 2 câu hỏi, quản lý JD hiển thị cho startup."
        actions={
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCwIcon data-icon="inline-start" />
            Tải lại
          </Button>
        }
        meta={
          overview && !overview.partner.isActive ? (
            <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-600">
              Hồ sơ chưa kích hoạt — startup chưa thấy tổ chức của bạn trong so khớp
            </Badge>
          ) : null
        }
      />

      {error ? <ErrorAlert message={error} onRetry={() => void load()} /> : null}

      <StatGrid>
        <StatCard
          label="Chờ kiểm duyệt"
          value={counts?.pending ?? 0}
          icon={InboxIcon}
          hint="Yêu cầu kết nối mới"
        />
        <StatCard
          label="Vòng 1 · Phỏng vấn"
          value={counts?.round1 ?? 0}
          icon={VideoIcon}
          hint="Video call 1-1 / yêu cầu riêng"
        />
        <StatCard
          label="Vòng 2 · Chờ duyệt"
          value={counts?.round2_submitted ?? 0}
          icon={FileTextIcon}
          hint={`${counts?.round2 ?? 0} startup đang trả lời`}
        />
        <StatCard
          label="Đã kết nối"
          value={counts?.accepted ?? 0}
          icon={HandshakeIcon}
          hint={`${counts?.rejected ?? 0} bị từ chối`}
        />
      </StatGrid>

      <Tabs defaultValue="inbox">
        <TabsList>
          <TabsTrigger value="inbox">
            Hộp thư kết nối
            {needAction > 0 ? (
              <span className="bg-primary text-primary-foreground ml-1.5 inline-flex size-5 items-center justify-center rounded-full text-[11px] font-bold">
                {needAction}
              </span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="profile">Hồ sơ đối tác & JD</TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="mt-3">
          <div className="mb-3 flex flex-wrap gap-1.5">
            {[
              ['all', 'Tất cả'],
              ['action', `Cần xử lý${needAction ? ` (${needAction})` : ''}`],
              ['round1', 'Vòng 1'],
              ['round2', 'Vòng 2'],
              ['accepted', 'Đã kết nối'],
              ['rejected', 'Từ chối'],
            ].map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setFilter(v)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  filter === v
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'hover:bg-muted/60'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {loading ? (
            <LoadingBlock />
          ) : visible.length === 0 ? (
            <EmptyState
              icon={<InboxIcon className="size-5" />}
              title="Chưa có yêu cầu kết nối"
              description="Khi startup bấm kết nối với tổ chức của bạn trên Startup Portal, yêu cầu sẽ xuất hiện tại đây để kiểm duyệt."
            />
          ) : (
            <div className="flex flex-col gap-3">
              {visible.map((c) => (
                <ConnectionCard
                  key={c.id}
                  conn={c}
                  partner={overview?.partner || null}
                  refresh={() => void load()}
                  act={act}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="profile" className="mt-3">
          {overview ? (
            <PartnerProfileForm
              partner={overview.partner}
              onSaved={() => void load()}
              save={savePartner}
            />
          ) : (
            <LoadingBlock />
          )}
          <Separator className="my-5" />
          <p className="text-xs text-muted-foreground">
            Hồ sơ này chính là &ldquo;đối tác&rdquo; startup nhìn thấy khi chạy so khớp trên Startup
            Portal — điểm match được chấm từ JD và tiêu chí phía trên.
          </p>
        </TabsContent>
      </Tabs>
    </PageShell>
  )
}
