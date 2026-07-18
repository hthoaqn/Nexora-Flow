// @ts-nocheck
'use client'

/**
 * Round 1 pitch room MVP — MediaRecorder practice/official.
 * Does NOT store video as base64 in DB — only metadata events (phase 1).
 */

import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Video, Square, Circle, ArrowLeft } from 'lucide-react'
import { useAuthStore } from '../store/useAuthStore'
import { usePortalI18n } from '../i18n'
import {
  getEvaluationCase,
  savePitchMeta,
  appendEvent,
  runPitchAiAnalysis,
  saveQaTextAnswer,
} from '@/investor/lib/evaluationStore'
import { DemoDataBadge } from '@/investor/components/DemoDataBadge'
import { Textarea } from '@/components/ui/textarea'
import type { EvaluationCase } from '@/investor/types'
import {
  PortalHero,
  PortalSection,
  SoftButton,
} from '../components/PortalUI'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  requestCameraMic,
  mediaErrorToast,
  pickRecorderMime,
} from '../lib/mediaPermissions'

function fill(template: string, vars: Record<string, string | number>) {
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v)),
    template,
  )
}

export default function PitchRoom() {
  const { caseId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { t, lang } = usePortalI18n()
  const inv = t.inv

  const [item, setItem] = useState<EvaluationCase | null>(null)
  const [consent, setConsent] = useState(false)
  const [practice, setPractice] = useState(true)
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [camReady, setCamReady] = useState(false)
  const [camHint, setCamHint] = useState(null)

  const videoRef = useRef(null)
  const mediaRef = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const secondsRef = useRef(0)

  const pitchLimit = item?.config?.pitchMinutes
    ? item.config.pitchMinutes * 60
    : 300

  useEffect(() => {
    if (!caseId || !user?.id) return
    setItem(getEvaluationCase(caseId, user.id))
    return () => stopAll()
  }, [caseId, user?.id])

  useEffect(() => {
    if (!recording) return
    timerRef.current = setInterval(() => {
      setSeconds((s) => {
        const next = s + 1
        secondsRef.current = next
        if (next === Math.floor(pitchLimit * (2 / 3))) {
          toast.message(inv.thirdWarn)
        }
        if (next >= pitchLimit) {
          void stopRecording()
        }
        return next
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [recording, pitchLimit, inv.thirdWarn])

  const stopAll = () => {
    clearInterval(timerRef.current)
    try {
      recorderRef.current?.stop()
    } catch {
      /* */
    }
    mediaRef.current?.getTracks?.().forEach((t) => t.stop())
  }

  const startPreview = async () => {
    setCamHint(null)
    // Must run from click — browsers only show the permission prompt on user gesture
    const result = await requestCameraMic(lang === 'en' ? 'en' : 'vi')
    if (!result.ok) {
      setCamReady(false)
      setCamHint(mediaErrorToast(result, lang))
      toast.error(mediaErrorToast(result, lang), { duration: 8000 })
      return false
    }
    // Stop previous tracks
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
      try {
        await videoRef.current.play()
      } catch {
        /* autoplay with muted should work */
      }
    }
    setCamReady(true)
    toast.success(inv.camReady)
    return true
  }

  const startRecording = async () => {
    if (!consent) {
      toast.error(inv.needConsent)
      return
    }
    if (!mediaRef.current) {
      const ok = await startPreview()
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
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(URL.createObjectURL(blob))
      const meta = {
        practice,
        durationSec: secondsRef.current,
        recordedAt: new Date().toISOString(),
        sizeBytes: blob.size,
        mimeType: blob.type,
      }
      if (caseId && user?.id) {
        const next = savePitchMeta(caseId, user.id, meta)
        if (next) setItem(next)
      }
      toast.success(practice ? inv.practiceSaved : inv.officialSaved)
    }
    secondsRef.current = 0
    setSeconds(0)
    setRecording(true)
    rec.start(1000)
    if (caseId && user?.id && item) {
      appendEvent(caseId, {
        matchingId: item.matchingId,
        actorType: 'startup',
        actorId: user.id,
        eventType: practice ? 'pitch_practice_started' : 'pitch_started',
        payload: { pitchLimit },
        dataVersion: 1,
        visibility: 'shared',
      })
    }
  }

  const stopRecording = () => {
    setRecording(false)
    clearInterval(timerRef.current)
    try {
      recorderRef.current?.stop()
    } catch {
      /* */
    }
  }

  const pct = Math.min(100, Math.round((seconds / pitchLimit) * 100))
  const [qaDraft, setQaDraft] = useState({})

  const submitOfficialAi = () => {
    if (!caseId || !user?.id) return
    if (!item?.pitchMeta || item.pitchMeta.practice) {
      toast.error(
        lang === 'en'
          ? 'Record an official (non-practice) pitch first'
          : 'Hãy ghi pitch chính thức (không phải luyện) trước',
      )
      return
    }
    const next = runPitchAiAnalysis(caseId, user.id)
    if (next) {
      setItem(next)
      toast.success(
        next.pitchAiJob?.is_demo
          ? 'AI demo · Q&A ready'
          : 'AI analysis complete',
      )
    }
  }

  if (!item) {
    return <p className="text-sm text-muted-foreground">{t.loading}</p>
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <PortalHero
        eyebrow={
          <>
            <Video className="size-3" />
            {inv.pitchEyebrow}
          </>
        }
        title={item.investor?.name || inv.pitchTitleFallback}
        description={inv.pitchLead}
        actions={
          <>
            {item.pitchAiJob?.is_demo ? <DemoDataBadge /> : null}
            <SoftButton
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={() => navigate(`/evaluations/${caseId}`)}
            >
              <ArrowLeft className="size-3.5" />
              {inv.backToCase}
            </SoftButton>
          </>
        }
      />

      <Alert>
        <AlertTitle>{inv.checklist}</AlertTitle>
        <AlertDescription className="text-xs">
          {fill(inv.checklistBody, { n: item.config.pitchMinutes })}
        </AlertDescription>
      </Alert>

      <PortalSection title={inv.studio}>
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="overflow-hidden rounded-xl border bg-black">
            <video
              ref={videoRef}
              className="aspect-video w-full object-cover"
              muted
              playsInline
            />
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={recording ? 'default' : 'outline'}>
                {recording ? inv.recording : inv.idle}
              </Badge>
              <Badge variant="secondary">
                {Math.floor(seconds / 60)}
                :{String(seconds % 60).padStart(2, '0')} /{' '}
                {item.config.pitchMinutes}:00
              </Badge>
            </div>
            <Progress value={pct} className="h-2" />

            <div className="flex items-center gap-2">
              <Checkbox
                id="consent"
                checked={consent}
                onCheckedChange={(v) => setConsent(v === true)}
              />
              <Label htmlFor="consent" className="text-xs leading-snug">
                {inv.consent}
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="practice"
                checked={practice}
                onCheckedChange={(v) => setPractice(v === true)}
                disabled={recording}
              />
              <Label htmlFor="practice" className="text-xs">
                {inv.practice}
              </Label>
            </div>

            {camReady ? (
              <Badge className="w-fit" variant="secondary">
                {lang === 'en' ? 'Camera live' : 'Camera đang bật'}
              </Badge>
            ) : null}
            {camHint ? (
              <Alert className="border-amber-500/40 bg-amber-500/10">
                <AlertTitle className="text-xs">
                  {lang === 'en' ? 'Camera help' : 'Hướng dẫn camera'}
                </AlertTitle>
                <AlertDescription className="text-[11px] leading-relaxed">
                  {camHint}
                </AlertDescription>
              </Alert>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                {lang === 'en'
                  ? 'Click “Test camera” — the browser will ask for permission. If it never asks, camera is already blocked in site settings.'
                  : 'Bấm «Thử camera» — trình duyệt sẽ hỏi quyền. Nếu không hỏi, camera đã bị chặn trong cài đặt trang web.'}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                onClick={() => void startPreview()}
                disabled={recording}
              >
                {inv.testCam}
              </Button>
              {!recording ? (
                <Button
                  size="sm"
                  className="rounded-full"
                  onClick={() => void startRecording()}
                >
                  <Circle className="size-3.5 fill-current" />
                  {inv.record}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="destructive"
                  className="rounded-full"
                  onClick={stopRecording}
                >
                  <Square className="size-3.5" />
                  {inv.stop}
                </Button>
              )}
            </div>

            {previewUrl ? (
              <div className="mt-2">
                <p className="mb-1 text-xs text-muted-foreground">
                  {inv.localPreview}
                </p>
                <video
                  src={previewUrl}
                  controls
                  className="aspect-video w-full rounded-lg border"
                />
              </div>
            ) : null}

            {item.pitchMeta && !item.pitchMeta.practice ? (
              <Button
                size="sm"
                className="rounded-full"
                onClick={submitOfficialAi}
              >
                {lang === 'en'
                  ? 'Submit pitch · run AI Q&A'
                  : 'Nộp pitch · chạy AI Q&A'}
              </Button>
            ) : null}
          </div>
        </div>
      </PortalSection>

      {item.pitchAiJob?.status === 'completed' && item.pitchAiJob.qa ? (
        <PortalSection
          title={
            lang === 'en' ? 'AI Q&A (3 questions)' : 'AI Q&A (3 câu hỏi)'
          }
          description={
            lang === 'en'
              ? `Pitch AI score: ${item.pitchAiJob.score} · demo analysis`
              : `Điểm pitch AI: ${item.pitchAiJob.score} · phân tích demo`
          }
        >
          <ul className="space-y-3">
            {item.pitchAiJob.qa.map((q) => (
              <li key={q.id} className="rounded-xl border p-3">
                <p className="text-sm font-medium">{q.question}</p>
                <Textarea
                  className="mt-2"
                  rows={2}
                  value={qaDraft[q.id] ?? q.textAnswer ?? ''}
                  onChange={(e) =>
                    setQaDraft((d) => ({ ...d, [q.id]: e.target.value }))
                  }
                  placeholder={
                    lang === 'en' ? 'Your answer…' : 'Câu trả lời…'
                  }
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 rounded-full"
                  onClick={() => {
                    const text = (qaDraft[q.id] ?? '').trim()
                    if (!text || !user?.id) return
                    const next = saveQaTextAnswer(
                      caseId,
                      user.id,
                      q.id,
                      text,
                    )
                    if (next) setItem(next)
                    toast.success(lang === 'en' ? 'Saved' : 'Đã lưu')
                  }}
                >
                  {lang === 'en' ? 'Save answer' : 'Lưu trả lời'}
                </Button>
              </li>
            ))}
          </ul>
          <Button
            size="sm"
            className="mt-3 rounded-full"
            onClick={() => navigate(`/evaluations/${caseId}/simulation`)}
          >
            {lang === 'en' ? 'Continue to simulation' : 'Tiếp tục mô phỏng'}
          </Button>
        </PortalSection>
      ) : null}
    </div>
  )
}
