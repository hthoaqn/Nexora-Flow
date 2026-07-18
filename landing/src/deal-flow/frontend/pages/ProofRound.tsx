// @ts-nocheck
'use client'

/**
 * Module 8 — Proof challenge video + synthetic AI analysis + limitations.
 */

import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Target, Video, Square, AlertTriangle } from 'lucide-react'
import { useAuthStore } from '../store/useAuthStore'
import { usePortalI18n } from '../i18n'
import {
  getEvaluationCase,
  generateProofChallenge,
  submitProofVideo,
} from '@/investor/lib/evaluationStore'
import { DemoDataBadge } from '@/investor/components/DemoDataBadge'
import {
  PortalHero,
  SoftButton,
  PortalEmpty,
} from '../components/PortalUI'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import {
  requestCameraMic,
  mediaErrorToast,
  pickRecorderMime,
} from '../lib/mediaPermissions'

export default function ProofRound() {
  const { caseId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { lang } = usePortalI18n()
  const tx = (vi, en) => (lang === 'en' ? en : vi)

  const [item, setItem] = useState(null)
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [camHint, setCamHint] = useState(null)
  const videoRef = useRef(null)
  const mediaRef = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const secondsRef = useRef(0)

  const reload = () => {
    if (!caseId || !user?.id) return
    let c = getEvaluationCase(caseId, user.id)
    if (c && !c.proofChallenge) {
      c = generateProofChallenge(caseId, user.id)
    }
    setItem(c)
  }

  useEffect(() => {
    reload()
    return () => {
      clearInterval(timerRef.current)
      mediaRef.current?.getTracks?.().forEach((t) => t.stop())
    }
  }, [caseId, user?.id])

  useEffect(() => {
    if (!recording) return
    timerRef.current = setInterval(() => {
      setSeconds((s) => {
        const n = s + 1
        secondsRef.current = n
        if (n >= 300) void stopRec()
        return n
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [recording])

  if (!item) {
    return <p className="text-sm text-muted-foreground">…</p>
  }

  const ch = item.proofChallenge
  const latest = (item.proofSubmissions || []).find((s) => s.isLatest)

  const startCam = async () => {
    setCamHint(null)
    const result = await requestCameraMic(lang === 'en' ? 'en' : 'vi')
    if (!result.ok) {
      const msg = mediaErrorToast(result, lang)
      setCamHint(msg)
      toast.error(msg, { duration: 8000 })
      return false
    }
    try {
      mediaRef.current?.getTracks?.().forEach((t) => t.stop())
    } catch {
      /* */
    }
    mediaRef.current = result.stream
    if (videoRef.current) {
      videoRef.current.srcObject = result.stream
      videoRef.current.muted = true
      videoRef.current.playsInline = true
      await videoRef.current.play().catch(() => {})
    }
    toast.success(tx('Camera sẵn sàng', 'Camera ready'))
    return true
  }

  const startRec = async () => {
    if (!mediaRef.current) {
      const ok = await startCam()
      if (!ok) return
    }
    if (!mediaRef.current) return
    chunksRef.current = []
    const mime = pickRecorderMime()
    let rec
    try {
      rec = new MediaRecorder(mediaRef.current, { mimeType: mime })
    } catch {
      rec = new MediaRecorder(mediaRef.current)
    }
    recorderRef.current = rec
    rec.ondataavailable = (ev) => {
      if (ev.data?.size) chunksRef.current.push(ev.data)
    }
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, {
        type: rec.mimeType || 'video/webm',
      })
      const meta = {
        durationSec: secondsRef.current,
        recordedAt: new Date().toISOString(),
        sizeBytes: blob.size,
        mimeType: blob.type,
      }
      const next = submitProofVideo(caseId, user.id, meta)
      if (next) {
        setItem(next)
        toast.success(tx('Đã nộp video minh chứng + AI phân tích', 'Proof submitted + AI analysis'))
      }
    }
    secondsRef.current = 0
    setSeconds(0)
    setRecording(true)
    rec.start(1000)
  }

  const stopRec = () => {
    setRecording(false)
    clearInterval(timerRef.current)
    try {
      recorderRef.current?.stop()
    } catch {
      /* */
    }
  }

  if (!ch) {
    return (
      <PortalEmpty
        title={tx('Chưa có đề minh chứng', 'No proof challenge')}
        action={
          <SoftButton
            size="sm"
            onClick={() => {
              const n = generateProofChallenge(caseId, user.id)
              if (n) setItem(n)
            }}
          >
            {tx('Tạo đề', 'Generate')}
          </SoftButton>
        }
      />
    )
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <PortalHero
        eyebrow={
          <>
            <Target className="size-3" />
            {tx('Vòng 3 · Minh chứng video', 'Round 3 · Proof video')}
          </>
        }
        title={ch.title}
        description={ch.instructions}
        actions={
          <>
            {ch.is_demo ? <DemoDataBadge /> : null}
            <SoftButton
              size="sm"
              variant="outline"
              onClick={() => navigate(`/evaluations/${caseId}`)}
            >
              <ArrowLeft className="size-3.5" />
              Case
            </SoftButton>
          </>
        }
      />

      <div className="rounded-2xl border p-4">
        <p className="text-xs font-semibold">
          {tx('Yêu cầu bằng chứng', 'Evidence requirements')}
        </p>
        <ul className="mt-2 list-inside list-disc text-xs text-muted-foreground">
          {ch.evidenceRequirements.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-1">
          {ch.checklist.map((c) => (
            <Badge key={c.id} variant="outline" className="text-[10px]">
              {c.label} {c.weight}%
            </Badge>
          ))}
        </div>
      </div>

      {!latest ? (
        <div className="space-y-3 rounded-2xl border p-4">
          <video
            ref={videoRef}
            muted
            playsInline
            className="aspect-video w-full rounded-xl bg-black object-cover"
          />
          {camHint ? (
            <Alert className="border-amber-500/40 bg-amber-500/10">
              <AlertTriangle className="size-4" />
              <AlertTitle className="text-xs">
                {tx('Hướng dẫn camera', 'Camera help')}
              </AlertTitle>
              <AlertDescription className="text-[11px] leading-relaxed">
                {camHint}
              </AlertDescription>
            </Alert>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              {tx(
                'Bấm «Bật camera» — trình duyệt sẽ hỏi quyền. Nếu không hỏi: camera đã bị chặn (🔒 cạnh URL).',
                'Click Enable camera — the browser should ask. If not: camera is blocked (🔒 next to URL).',
              )}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={() => void startCam()}
            >
              <Video className="size-3.5" />
              {tx('Bật camera', 'Enable camera')}
            </Button>
            {!recording ? (
              <Button size="sm" className="rounded-full" onClick={startRec}>
                {tx('Ghi & nộp', 'Record & submit')}
              </Button>
            ) : (
              <Button size="sm" variant="destructive" className="rounded-full" onClick={stopRec}>
                <Square className="size-3.5" />
                {tx('Dừng', 'Stop')} ({seconds}s)
              </Button>
            )}
          </div>
          {recording ? <Progress value={Math.min(100, (seconds / 300) * 100)} /> : null}
        </div>
      ) : (
        <div className="space-y-3">
          <Alert>
            <AlertTitle>
              {tx('Bản nộp', 'Submission')} v{latest.version}
            </AlertTitle>
            <AlertDescription className="text-xs">
              {latest.meta.durationSec}s ·{' '}
              {Math.round(latest.meta.sizeBytes / 1024)} KB ·{' '}
              {new Date(latest.submittedAt).toLocaleString()}
            </AlertDescription>
          </Alert>
          {latest.analysis ? (
            <>
              <div className="grid gap-2 sm:grid-cols-2">
                {Object.entries(latest.analysis.scores).map(([k, v]) => (
                  <div key={k} className="rounded-xl border p-3">
                    <p className="text-[10px] text-muted-foreground">{k}</p>
                    <p className="font-heading text-xl font-semibold tabular-nums">
                      {v}
                    </p>
                  </div>
                ))}
              </div>
              <Alert className="border-amber-500/35 bg-amber-500/5">
                <AlertTriangle className="size-4" />
                <AlertTitle className="text-sm">
                  {tx('Cảnh báo ranh giới AI', 'AI boundary warnings')}
                </AlertTitle>
                <AlertDescription className="text-xs">
                  <ul className="list-inside list-disc">
                    {latest.analysis.limitations.map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
              <Button
                size="sm"
                className="rounded-full"
                onClick={() => navigate(`/evaluations/${caseId}`)}
              >
                {tx('Xem tổng hợp cuối', 'View final summary')}
              </Button>
            </>
          ) : null}
        </div>
      )}
    </div>
  )
}
