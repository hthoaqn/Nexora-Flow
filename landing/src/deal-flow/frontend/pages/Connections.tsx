// @ts-nocheck
'use client'

/**
 * Kết nối của tôi — pipeline nhiều vòng với tổ chức Intake (API thật):
 * pending → round1 (video call 1-1 / yêu cầu riêng) → round2 (trả lời câu hỏi
 * bằng văn bản hoặc video tự quay) → round2_submitted → accepted / rejected.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { usePortalI18n } from '../i18n'
import { toast } from 'sonner'
import {
  Link2,
  CheckCircle,
  XCircle,
  Clock,
  Trash2,
  Gamepad2,
  Mail,
  User,
  Phone,
  RefreshCw,
  Video,
  Send,
  Circle,
  StopCircle,
  RotateCcw,
  CalendarClock,
  ClipboardList,
  ExternalLink,
} from 'lucide-react'
import {
  PortalHero,
  PortalEmpty,
  SoftButton,
  DemoBadge,
} from '../components/PortalUI'
import { Badge } from '@/components/ui/badge'

/** Browser streams files through the same-origin rewrite (see next.config.ts) */
const fileUrl = (id) => `/intake-api/api/files/${id}`

const norm = (s) => String(s || '').toLowerCase()

/** Keep newest connection per partner — API/demo may create duplicates */
function dedupeConnections(list) {
  const byPartner = new Map()
  const rank = (s) => {
    switch (norm(s)) {
      case 'accepted':
        return 6
      case 'round2_submitted':
        return 5
      case 'round2':
        return 4
      case 'round1':
        return 3
      case 'pending':
        return 2
      case 'rejected':
        return 1
      default:
        return 0
    }
  }
  for (const c of list) {
    const partner = c.partner || {}
    const pid = String(c.partnerId || partner.id || c.id || '')
    if (!pid) continue
    const prev = byPartner.get(pid)
    if (!prev) {
      byPartner.set(pid, c)
      continue
    }
    const tNew = new Date(c.createdAt || c.updatedAt || 0).getTime()
    const tOld = new Date(prev.createdAt || prev.updatedAt || 0).getTime()
    const rNew = rank(c.status)
    const rOld = rank(prev.status)
    if (rNew > rOld || (rNew === rOld && tNew >= tOld)) {
      byPartner.set(pid, c)
    }
  }
  return Array.from(byPartner.values()).sort((a, b) => {
    const ta = new Date(a.createdAt || 0).getTime()
    const tb = new Date(b.createdAt || 0).getTime()
    return tb - ta
  })
}

function fmt(dt, lang) {
  if (!dt) return '—'
  try {
    return new Date(dt).toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN')
  } catch {
    return String(dt)
  }
}

// ─── Stage stepper ───────────────────────────────────────────────────────────

function StageStepper({ status, lang }) {
  const steps =
    lang === 'en'
      ? ['Review', 'Round 1', 'Round 2', 'Connected']
      : ['Kiểm duyệt', 'Vòng 1', 'Vòng 2', 'Kết nối']
  const idx = (() => {
    switch (status) {
      case 'pending':
        return 0
      case 'round1':
        return 1
      case 'round2':
      case 'round2_submitted':
        return 2
      case 'accepted':
        return 3
      default:
        return -1
    }
  })()
  if (idx < 0) return null
  return (
    <div className="flex items-center">
      {steps.map((label, i) => {
        const done = i < idx || status === 'accepted'
        const active = i === idx && status !== 'accepted'
        return (
          <React.Fragment key={label}>
            {i > 0 && (
              <div
                className={`h-px w-5 sm:w-9 ${i <= idx ? 'bg-primary' : 'bg-border'}`}
              />
            )}
            <div className="flex items-center gap-1.5 px-0.5">
              <span
                className={`flex size-5.5 items-center justify-center rounded-full text-[10px] font-bold ${
                  done
                    ? 'bg-primary text-primary-foreground'
                    : active
                      ? 'bg-primary/15 text-primary ring-1 ring-primary'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {done ? '✓' : i + 1}
              </span>
              <span
                className={`hidden text-xs font-medium sm:inline ${
                  done || active ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                {label}
              </span>
            </div>
          </React.Fragment>
        )
      })}
    </div>
  )
}

// ─── Video answer recorder (MediaRecorder) ───────────────────────────────────

function VideoRecorder({ onRecorded, disabled, lang }) {
  const videoRef = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const [state, setState] = useState('idle') // idle | recording | recorded
  const [previewUrl, setPreviewUrl] = useState(null)

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  useEffect(() => {
    return () => {
      stopStream()
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const start = async () => {
    const {
      requestCameraMic,
      mediaErrorToast,
      pickRecorderMime,
    } = await import('../lib/mediaPermissions')
    const result = await requestCameraMic(lang === 'en' ? 'en' : 'vi')
    if (!result.ok) {
      toast.error(mediaErrorToast(result, lang), { duration: 8000 })
      return
    }
    try {
      const stream = result.stream
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.muted = true
        await videoRef.current.play().catch(() => {})
      }
      const mime = pickRecorderMime()
      let rec
      try {
        rec = new MediaRecorder(stream, { mimeType: mime })
      } catch {
        rec = new MediaRecorder(stream)
      }
      chunksRef.current = []
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data)
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' })
        const url = URL.createObjectURL(blob)
        setPreviewUrl(url)
        if (videoRef.current) {
          videoRef.current.srcObject = null
          videoRef.current.src = url
          videoRef.current.muted = false
        }
        stopStream()
        setState('recorded')
        onRecorded(blob)
      }
      recorderRef.current = rec
      rec.start()
      setState('recording')
    } catch (e) {
      console.error(e)
      const name = e?.name || ''
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        toast.error(
          lang === 'en'
            ? 'Camera/mic permission denied. Click the camera icon in the address bar and choose Allow, then try again.'
            : 'Quyền camera/micro bị từ chối. Bấm biểu tượng camera trên thanh địa chỉ trình duyệt → Cho phép, rồi thử lại.',
        )
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        toast.error(
          lang === 'en'
            ? 'No camera/microphone found on this device.'
            : 'Không tìm thấy camera/micro trên thiết bị này.',
        )
      } else if (name === 'NotReadableError') {
        toast.error(
          lang === 'en'
            ? 'Camera is in use by another app. Close it and retry.'
            : 'Camera đang được ứng dụng khác sử dụng. Đóng ứng dụng đó rồi thử lại.',
        )
      } else {
        toast.error(
          lang === 'en'
            ? 'Could not access camera/microphone. Check browser permissions.'
            : 'Không truy cập được camera/micro. Kiểm tra quyền trình duyệt.',
        )
      }
    }
  }

  const stop = () =>
    recorderRef.current?.state !== 'inactive' && recorderRef.current?.stop()

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setState('idle')
    onRecorded(null)
    if (videoRef.current) videoRef.current.src = ''
  }

  // Keep <video> mounted so ref exists before getUserMedia attaches the stream
  useEffect(() => {
    if (state === 'recording' && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.muted = true
      void videoRef.current.play().catch(() => {})
    }
  }, [state])

  return (
    <div className="space-y-2">
      <video
        ref={videoRef}
        playsInline
        controls={state === 'recorded'}
        autoPlay={state === 'recording'}
        className={`max-h-56 w-full rounded-xl border border-border bg-black ${
          state === 'idle' ? 'hidden' : ''
        }`}
      />
      <div className="flex flex-wrap gap-2">
        {state === 'idle' && (
          <SoftButton size="sm" variant="outline" disabled={disabled} onClick={start}>
            <Circle className="size-3.5 text-rose-500" fill="currentColor" />
            {lang === 'en' ? 'Record video answer' : 'Quay video trả lời'}
          </SoftButton>
        )}
        {state === 'recording' && (
          <SoftButton
            size="sm"
            className="bg-rose-600 text-white hover:bg-rose-700"
            onClick={stop}
          >
            <StopCircle className="size-3.5" />
            {lang === 'en' ? 'Stop & save' : 'Dừng & lưu'}
          </SoftButton>
        )}
        {state === 'recorded' && (
          <SoftButton size="sm" variant="outline" onClick={reset}>
            <RotateCcw className="size-3.5" />
            {lang === 'en' ? 'Retake' : 'Quay lại'}
          </SoftButton>
        )}
      </div>
    </div>
  )
}

// ─── Round 2 answering panel ─────────────────────────────────────────────────

function Round2Panel({ conn, lang, onSubmitted }) {
  const questions = conn.round2?.questions || []
  const [texts, setTexts] = useState(() => questions.map(() => ''))
  const [videos, setVideos] = useState(() => questions.map(() => null))
  const [submitting, setSubmitting] = useState(false)
  const [agreeShare, setAgreeShare] = useState(false)

  const answered = questions.every((_, i) => texts[i]?.trim() || videos[i])

  const submit = async () => {
    if (!agreeShare) {
      toast.error(
        lang === 'en'
          ? 'Please consent to sharing your answers/video with the reviewing organization.'
          : 'Cần đồng ý chia sẻ câu trả lời/video cho tổ chức thẩm định trước khi nộp.',
      )
      return
    }
    if (!answered) {
      toast.error(
        lang === 'en'
          ? 'Answer every question with text or a video.'
          : 'Mỗi câu hỏi cần câu trả lời văn bản hoặc video.',
      )
      return
    }
    setSubmitting(true)
    try {
      const videoIds = []
      for (let i = 0; i < questions.length; i++) {
        const blob = videos[i]
        if (!blob) {
          videoIds.push(null)
          continue
        }
        const fd = new FormData()
        fd.append('video', blob, `answer-${i + 1}.webm`)
        const res = await api.post(
          `/startup/connections/${conn.id}/round2/video`,
          fd,
          { headers: { 'Content-Type': 'multipart/form-data' } },
        )
        videoIds.push(res.data?.data?.fileId || null)
      }
      const answers = questions.map((q, i) => ({
        text: texts[i]?.trim() || '',
        videoFileId: videoIds[i],
      }))
      const res = await api.post(`/startup/connections/${conn.id}/round2/submit`, {
        answers,
      })
      if (res.data?.success) {
        toast.success(
          lang === 'en'
            ? 'Round 2 submitted — awaiting review.'
            : 'Đã nộp Vòng 2 — chờ tổ chức kiểm duyệt.',
        )
        onSubmitted()
      }
    } catch (e) {
      console.error(e)
      toast.error(
        e?.response?.data?.message ||
          (lang === 'en' ? 'Submit failed' : 'Nộp bài thất bại'),
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-5 mb-4 space-y-4 rounded-xl border border-primary/25 bg-primary/5 p-4">
      <div className="flex items-center gap-2">
        <ClipboardList className="size-4 text-primary" />
        <h4 className="text-sm font-semibold">
          {lang === 'en'
            ? `Round 2 — answer ${questions.length} questions`
            : `Vòng 2 — Trả lời ${questions.length} câu hỏi từ tổ chức`}
        </h4>
      </div>
      {questions.map((q, i) => (
        <div
          key={i}
          className="space-y-3 rounded-xl border border-border/70 bg-background p-4"
        >
          <p className="text-sm font-semibold">
            {lang === 'en' ? 'Q' : 'Câu'} {i + 1}. {q}
          </p>
          <textarea
            rows={3}
            value={texts[i]}
            onChange={(e) =>
              setTexts((arr) => arr.map((t, j) => (j === i ? e.target.value : t)))
            }
            placeholder={
              lang === 'en'
                ? 'Answer in text (or record a video below)…'
                : 'Trả lời bằng văn bản (hoặc quay video bên dưới)…'
            }
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/40"
          />
          <VideoRecorder
            lang={lang}
            disabled={submitting}
            onRecorded={(blob) =>
              setVideos((arr) => arr.map((v, j) => (j === i ? blob : v)))
            }
          />
        </div>
      ))}
      <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-primary/25 bg-background px-3 py-3 text-xs">
        <input
          type="checkbox"
          className="accent-primary mt-0.5 size-4"
          checked={agreeShare}
          onChange={(e) => setAgreeShare(e.target.checked)}
        />
        <span>
          <strong>
            {lang === 'en'
              ? 'I consent to sharing my answers and recorded videos *'
              : 'Tôi đồng ý chia sẻ câu trả lời và video đã quay *'}
          </strong>
          <span className="mt-0.5 block text-muted-foreground">
            {lang === 'en' ? (
              <>
                Answers and videos are shared only with this reviewing organization for
                evaluation purposes, per the{' '}
                <a href="/privacy" target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
                  Privacy Policy
                </a>
                .
              </>
            ) : (
              <>
                Câu trả lời và video chỉ được chia sẻ cho tổ chức đang thẩm định kết nối này,
                theo{' '}
                <a href="/privacy" target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
                  Chính sách bảo mật
                </a>
                .
              </>
            )}
          </span>
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <SoftButton size="sm" disabled={submitting || !answered || !agreeShare} onClick={submit}>
          <Send className="size-3.5" />
          {submitting
            ? lang === 'en'
              ? 'Submitting…'
              : 'Đang nộp…'
            : lang === 'en'
              ? 'Submit Round 2'
              : 'Nộp bài Vòng 2'}
        </SoftButton>
        {!answered && (
          <p className="text-xs text-muted-foreground">
            {lang === 'en'
              ? 'Every question needs a text or video answer before submitting.'
              : 'Cần trả lời đủ mọi câu hỏi (văn bản hoặc video) trước khi nộp.'}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Connections() {
  const navigate = useNavigate()
  const { t, lang } = usePortalI18n()
  const [connections, setConnections] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)

  const fetchConnections = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await api.get('/startup/connections')
      if (res.data?.success) {
        const raw = res.data.data
        const list = Array.isArray(raw) ? raw : raw?.items || []
        setConnections(dedupeConnections(list))
      }
    } catch (e) {
      console.error(e)
      if (!silent) {
        toast.error(
          lang === 'en'
            ? 'Could not load connections'
            : 'Không tải được danh sách kết nối',
        )
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchConnections()
    const timer = setInterval(() => fetchConnections(true), 25000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCancelConnection = async (id) => {
    if (!id || busyId) return
    setBusyId(id)
    try {
      const res = await api.delete(`/startup/connections/${id}`)
      if (res.data?.success) {
        toast.success(t.connections.withdraw)
        setConnections((prev) => prev.filter((c) => c.id !== id))
        fetchConnections(true)
      }
    } catch (e) {
      console.error(e)
      toast.error(
        e?.response?.data?.message ||
          (lang === 'en' ? 'Could not withdraw' : 'Không rút được lời mời'),
      )
    } finally {
      setBusyId(null)
    }
  }

  const statusBadge = (status) => {
    const s = norm(status)
    if (s === 'accepted')
      return (
        <Badge className="gap-1 border-primary/30 bg-primary/12 text-primary">
          <CheckCircle className="size-3" />
          {t.connections.accepted}
        </Badge>
      )
    if (s === 'rejected')
      return (
        <Badge
          variant="outline"
          className="gap-1 border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-400"
        >
          <XCircle className="size-3" />
          {t.connections.rejected}
        </Badge>
      )
    if (s === 'round1')
      return (
        <Badge
          variant="outline"
          className="gap-1 border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-400"
        >
          <Video className="size-3" />
          {lang === 'en' ? 'Round 1 · Interview' : 'Vòng 1 · Phỏng vấn'}
        </Badge>
      )
    if (s === 'round2')
      return (
        <Badge
          variant="outline"
          className="gap-1 border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-400"
        >
          <ClipboardList className="size-3" />
          {lang === 'en' ? 'Round 2 · Your turn' : 'Vòng 2 · Trả lời câu hỏi'}
        </Badge>
      )
    if (s === 'round2_submitted')
      return (
        <Badge
          variant="outline"
          className="gap-1 border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-400"
        >
          <Clock className="size-3" />
          {lang === 'en' ? 'Round 2 · Under review' : 'Vòng 2 · Chờ kiểm duyệt'}
        </Badge>
      )
    return (
      <Badge
        variant="outline"
        className="gap-1 border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
      >
        <Clock className="size-3" />
        {t.connections.pending}
      </Badge>
    )
  }

  const uniqueCount = useMemo(() => connections.length, [connections])

  return (
    <div className="space-y-5">
      <PortalHero
        eyebrow={
          <>
            <Link2 className="size-3" />
            {t.connections.title}
          </>
        }
        title={t.connections.title}
        description={
          lang === 'en'
            ? 'Track each review round: approval → Round-1 video interview → Round-2 questions → official connection.'
            : 'Theo dõi các vòng: duyệt hồ sơ → Vòng 1 phỏng vấn video → Vòng 2 câu hỏi → kết nối chính thức.'
        }
        actions={
          <SoftButton size="sm" variant="outline" onClick={() => fetchConnections()}>
            <RefreshCw className="size-3.5" />
            {t.connections.reload}
          </SoftButton>
        }
      />

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : connections.length > 0 ? (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {uniqueCount}{' '}
            {lang === 'en' ? 'partners (duplicates hidden)' : 'đối tác (đã gộp trùng)'}
          </p>
          {connections.map((c) => {
            const status = norm(c.status)
            const partner = c.partner || {}
            const name =
              c.partnerName || partner.organizationName || partner.name || '—'
            const isDemo = c.isDemo || c.is_demo || partner.isDemo

            return (
              <article
                key={c.id || `${c.partnerId}-${c.createdAt}`}
                className="portal-card overflow-hidden"
              >
                <div className="flex flex-col gap-3 border-b border-border/70 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h3 className="font-heading text-base font-semibold">{name}</h3>
                      {isDemo ? <DemoBadge label={t.demo} /> : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {fmt(c.createdAt, lang)}
                    </p>
                    <StageStepper status={status} lang={lang} />
                  </div>
                  {statusBadge(c.status)}
                </div>

                <div className="px-5 py-4">
                  <p className="rounded-xl border border-border/70 bg-muted/25 px-3.5 py-3 text-sm leading-relaxed whitespace-pre-wrap">
                    “{c.message || '—'}”
                  </p>
                </div>

                {/* Round 1 — interview info */}
                {status === 'round1' && c.round1 ? (
                  <div className="mx-5 mb-4 space-y-3 rounded-xl border border-sky-500/30 bg-sky-500/5 p-4">
                    <div className="flex items-center gap-2">
                      <Video className="size-4 text-sky-600" />
                      <h4 className="text-sm font-semibold">
                        {c.round1.mode === 'video_call'
                          ? lang === 'en'
                            ? 'Round 1 — 1-1 video interview'
                            : 'Vòng 1 — Phỏng vấn video call 1-1'
                          : lang === 'en'
                            ? 'Round 1 — Organization request'
                            : 'Vòng 1 — Yêu cầu từ tổ chức'}
                      </h4>
                    </div>
                    {c.round1.scheduledAt ? (
                      <p className="flex items-center gap-1.5 text-sm">
                        <CalendarClock className="size-4 text-sky-600" />
                        {lang === 'en' ? 'Time:' : 'Thời gian:'}{' '}
                        <b>{fmt(c.round1.scheduledAt, lang)}</b>
                      </p>
                    ) : null}
                    {c.round1.note ? (
                      <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                        {c.round1.note}
                      </p>
                    ) : null}
                    {c.round1.mode === 'video_call' && c.round1.meetingLink ? (
                      <SoftButton
                        size="sm"
                        className="bg-sky-600 text-white hover:bg-sky-700"
                        onClick={() =>
                          window.open(c.round1.meetingLink, '_blank', 'noreferrer')
                        }
                      >
                        <ExternalLink className="size-3.5" />
                        {lang === 'en' ? 'Join interview room' : 'Vào phòng phỏng vấn'}
                      </SoftButton>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      {lang === 'en'
                        ? 'After the interview, the organization reviews and opens Round 2.'
                        : 'Sau buổi phỏng vấn / hoàn thành yêu cầu, tổ chức sẽ xét duyệt để mở Vòng 2.'}
                    </p>
                  </div>
                ) : null}

                {/* Round 2 — answer & submit */}
                {status === 'round2' && c.round2 ? (
                  <Round2Panel
                    conn={c}
                    lang={lang}
                    onSubmitted={() => fetchConnections()}
                  />
                ) : null}

                {/* Round 2 — submitted recap */}
                {status === 'round2_submitted' && c.round2 ? (
                  <div className="mx-5 mb-4 space-y-3 rounded-xl border border-orange-500/30 bg-orange-500/5 p-4">
                    <h4 className="text-sm font-semibold">
                      {lang === 'en'
                        ? `Round 2 submitted ${fmt(c.round2.submittedAt, lang)} — under review`
                        : `Đã nộp Vòng 2 lúc ${fmt(c.round2.submittedAt, lang)} — chờ tổ chức kiểm duyệt`}
                    </h4>
                    {(c.round2.answers || []).map((a, i) => (
                      <div
                        key={i}
                        className="rounded-xl border border-border/70 bg-background p-3"
                      >
                        <p className="text-xs font-semibold">
                          {lang === 'en' ? 'Q' : 'Câu'} {i + 1}.{' '}
                          {a.question || c.round2.questions?.[i] || ''}
                        </p>
                        {a.text ? (
                          <p className="mt-1 text-xs whitespace-pre-wrap text-muted-foreground">
                            {a.text}
                          </p>
                        ) : null}
                        {a.videoFileId ? (
                          <video
                            controls
                            preload="metadata"
                            className="mt-2 max-h-48 w-full rounded-lg bg-black"
                            src={fileUrl(a.videoFileId)}
                          />
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}

                {/* Rejection feedback */}
                {status === 'rejected' && c.decisionNote ? (
                  <div className="mx-5 mb-4 rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm">
                    <b>{lang === 'en' ? 'Feedback:' : 'Phản hồi từ tổ chức:'}</b>{' '}
                    {c.decisionNote}
                  </div>
                ) : null}

                {/* Direct contact — accepted only */}
                {status === 'accepted' && partner ? (
                  <div className="mx-5 mb-4 rounded-xl border border-primary/25 bg-primary/8 p-4">
                    <p className="mb-3 text-xs font-semibold text-primary">
                      {t.connections.contact}
                    </p>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="flex items-center gap-2 text-xs">
                        <User className="size-4 text-primary" />
                        <span>{partner.contactPerson || '—'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <Mail className="size-4 text-primary" />
                        <span className="truncate">{partner.contactEmail || '—'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <Phone className="size-4 text-primary" />
                        <span>{partner.phoneNumber || '—'}</span>
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Timeline */}
                {Array.isArray(c.timeline) && c.timeline.length > 0 ? (
                  <details className="mx-5 mb-4 text-xs text-muted-foreground">
                    <summary className="cursor-pointer font-semibold select-none">
                      {lang === 'en' ? 'Progress log' : 'Nhật ký tiến trình'} (
                      {c.timeline.length})
                    </summary>
                    <ul className="mt-2 space-y-1 border-l-2 border-border pl-3">
                      {c.timeline.map((ev, i) => (
                        <li key={i}>
                          <span className="tabular-nums opacity-70">
                            {fmt(ev.at, lang)}
                          </span>{' '}
                          — {ev.note || ev.type}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}

                <div className="flex justify-end gap-2 border-t border-border/70 px-5 py-3">
                  {status === 'pending' ? (
                    <SoftButton
                      size="sm"
                      variant="outline"
                      className="rounded-full text-muted-foreground hover:border-rose-300 hover:text-rose-600"
                      disabled={busyId === c.id}
                      onClick={() => handleCancelConnection(c.id)}
                    >
                      <Trash2 className="size-3.5" />
                      {t.connections.withdraw}
                    </SoftButton>
                  ) : null}
                  {status === 'accepted' ? (
                    <SoftButton
                      size="sm"
                      className="rounded-full"
                      onClick={() => {
                        const pid = c.partnerId || partner.id
                        if (!pid) {
                          navigate('/sandbox')
                          return
                        }
                        api
                          .post('/startup/sandbox/create', { partnerId: pid })
                          .then((res) => {
                            if (res.data?.success) {
                              toast.success(t.connections.openSandbox)
                            }
                            navigate('/sandbox')
                          })
                          .catch((e) => {
                            toast.error(
                              e?.response?.data?.message ||
                                (lang === 'en'
                                  ? 'Could not open sandbox'
                                  : 'Không mở được phòng giả lập'),
                            )
                            navigate('/sandbox')
                          })
                      }}
                    >
                      <Gamepad2 className="size-3.5" />
                      {t.connections.openSandbox}
                    </SoftButton>
                  ) : null}
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <PortalEmpty
          icon={<Link2 className="size-5" />}
          title={t.connections.empty}
          description={t.matches.emptyDesc}
          action={
            <SoftButton size="sm" onClick={() => navigate('/matches')}>
              {t.sandbox.find}
            </SoftButton>
          }
        />
      )}
    </div>
  )
}
