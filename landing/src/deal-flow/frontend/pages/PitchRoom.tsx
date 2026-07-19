// @ts-nocheck
'use client'

/**
 * Round 1 pitch room — MediaRecorder + live transcript + AI vs investor JD.
 */

import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Video,
  Square,
  Circle,
  ArrowLeft,
  Sparkles,
  Loader2,
  Mic,
  FileText,
} from 'lucide-react'
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
import {
  isSpeechRecognitionSupported,
  startSpeechTranscript,
} from '@/lib/speech-transcript'
import { MatchMarkdown } from '@/components/matching/MatchMarkdown'

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
  const L = lang === 'en'

  const [item, setItem] = useState<EvaluationCase | null>(null)
  const [consent, setConsent] = useState(false)
  const [practice, setPractice] = useState(true)
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [camReady, setCamReady] = useState(false)
  const [camHint, setCamHint] = useState(null)
  const [transcript, setTranscript] = useState('')
  const [interim, setInterim] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [speechOk] = useState(() => isSpeechRecognitionSupported())

  const videoRef = useRef(null)
  const mediaRef = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const secondsRef = useRef(0)
  const speechRef = useRef(null)
  const finalTranscriptRef = useRef('')

  const pitchLimit = item?.config?.pitchMinutes
    ? item.config.pitchMinutes * 60
    : 300

  useEffect(() => {
    if (!caseId || !user?.id) return
    const c = getEvaluationCase(caseId, user.id)
    setItem(c)
    if (c?.pitchMeta?.transcript) setTranscript(c.pitchMeta.transcript)
    if (c?.pitchAiJob?.transcript) setTranscript(c.pitchAiJob.transcript)
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
    try {
      speechRef.current?.stop?.()
    } catch {
      /* */
    }
    speechRef.current = null
    mediaRef.current?.getTracks?.().forEach((t) => t.stop())
  }

  const startPreview = async () => {
    setCamHint(null)
    const result = await requestCameraMic(lang === 'en' ? 'en' : 'vi')
    if (!result.ok) {
      setCamReady(false)
      setCamHint(mediaErrorToast(result, lang))
      toast.error(mediaErrorToast(result, lang), { duration: 8000 })
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
      try {
        await videoRef.current.play()
      } catch {
        /* */
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
    finalTranscriptRef.current = ''
    setTranscript('')
    setInterim('')

    // Live STT while recording
    speechRef.current = startSpeechTranscript({
      lang: L ? 'en' : 'vi',
      onUpdate: (partial, finalSoFar) => {
        finalTranscriptRef.current = finalSoFar
        setTranscript(finalSoFar)
        setInterim(partial)
      },
      onError: (msg) => {
        // non-blocking
        console.warn('[speech]', msg)
      },
    })
    if (!speechRef.current && !speechOk) {
      toast.message(
        L
          ? 'No live transcript in this browser — paste text after recording.'
          : 'Trình duyệt không STT live — dán transcript sau khi quay.',
      )
    }

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
      try {
        speechRef.current?.stop?.()
      } catch {
        /* */
      }
      speechRef.current = null
      setInterim('')

      const blob = new Blob(chunksRef.current, {
        type: rec.mimeType || 'video/webm',
      })
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(URL.createObjectURL(blob))

      const finalT = (
        finalTranscriptRef.current ||
        transcript ||
        ''
      ).trim()
      setTranscript(finalT)

      const meta = {
        practice,
        durationSec: secondsRef.current,
        recordedAt: new Date().toISOString(),
        sizeBytes: blob.size,
        mimeType: blob.type,
        transcript: finalT || undefined,
      }
      if (caseId && user?.id) {
        const next = savePitchMeta(caseId, user.id, meta)
        if (next) setItem(next)
      }
      toast.success(practice ? inv.practiceSaved : inv.officialSaved)
      if (finalT) {
        toast.message(
          L
            ? 'Transcript ready — edit then run AI vs investor JD'
            : 'Transcript sẵn — chỉnh sửa rồi chạy AI so JD nhà đầu tư',
        )
      }
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

  const buildJd = () => {
    const invProf = item?.investor
    return {
      name: invProf?.name,
      thesis: invProf?.investmentThesis,
      description: invProf?.description,
      industries: invProf?.priorityIndustries,
      stages: invProf?.preferredStages,
      requirements: [
        invProf?.revenueRequirement,
        invProf?.teamRequirement,
        invProf?.marketRequirement,
        invProf?.techRequirement,
        invProf?.scalabilityRequirement,
      ].filter(Boolean),
      exclusion: invProf?.exclusionCriteria,
      jdText: [
        invProf?.investmentThesis,
        invProf?.description,
        `Ticket: ${invProf?.ticketMin ?? '?'}–${invProf?.ticketMax ?? '?'} ${invProf?.currency || 'USD'}`,
      ]
        .filter(Boolean)
        .join('\n'),
    }
  }

  const runAnalysis = async () => {
    if (!caseId || !user?.id) return
    const text = transcript.trim()
    if (!text) {
      toast.error(
        L
          ? 'Need a transcript — re-record with mic permission or paste text.'
          : 'Cần transcript — quay lại (bật micro) hoặc dán nội dung nói.',
      )
      return
    }
    if (!item?.pitchMeta || item.pitchMeta.practice) {
      // Allow analysis on practice too, but official submit path prefers non-practice
      if (!item?.pitchMeta) {
        toast.error(
          L ? 'Record a pitch first' : 'Hãy quay pitch trước',
        )
        return
      }
    }

    setAnalyzing(true)
    try {
      // Persist transcript on meta
      if (item?.pitchMeta) {
        const nextMeta = savePitchMeta(caseId, user.id, {
          ...item.pitchMeta,
          transcript: text,
        })
        if (nextMeta) setItem(nextMeta)
      }

      const res = await fetch('/api/ai/pitch-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: text,
          lang: L ? 'en' : 'vi',
          durationSec: item?.pitchMeta?.durationSec ?? secondsRef.current,
          useLlm: true,
          jd: buildJd(),
        }),
      })
      const body = await res.json()
      if (!res.ok || !body?.success) {
        throw new Error(body?.message || `HTTP ${res.status}`)
      }
      const a = body.data?.analysis
      if (!a) throw new Error('No analysis')

      const next = runPitchAiAnalysis(
        caseId,
        user.id,
        `pitch-ai-${caseId}-${Date.now()}`,
        {
          score: a.score,
          qa: a.qa,
          publicFeedback: {
            strengths: a.strengths || [],
            unclear: (a.gapsVsJd || []).slice(0, 2),
            needsMore: (a.improvements || []).slice(0, 2),
          },
          gapsVsJd: a.gapsVsJd,
          improvements: a.improvements,
          talkingPoints: a.talkingPoints,
          summary: L ? a.summaryEn : a.summaryVi,
          transcript: text,
          coverage: a.coverage,
          source: a.source,
          is_demo: a.source === 'heuristic',
        },
      )
      if (next) {
        setItem(next)
        toast.success(
          L
            ? `AI pitch score ${a.score}/100 vs investor JD`
            : `Điểm pitch AI ${a.score}/100 so với JD nhà đầu tư`,
        )
      }
    } catch (e) {
      console.error(e)
      toast.error(
        e instanceof Error
          ? e.message
          : L
            ? 'Analysis failed'
            : 'Phân tích thất bại',
      )
    } finally {
      setAnalyzing(false)
    }
  }

  const pct = Math.min(100, Math.round((seconds / pitchLimit) * 100))
  const [qaDraft, setQaDraft] = useState({})

  if (!item) {
    return <p className="text-sm text-muted-foreground">{t.loading}</p>
  }

  const job = item.pitchAiJob

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
        description={
          L
            ? 'Record pitch → live transcript → AI scores against this investor’s JD/thesis and tells you what to improve.'
            : 'Quay pitch → transcript live → AI chấm theo JD/thesis nhà đầu tư và gợi ý cải thiện.'
        }
        actions={
          <>
            {job?.is_demo ? <DemoDataBadge /> : null}
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
          {' · '}
          {L
            ? 'Speak clearly — browser STT builds the transcript used for JD analysis.'
            : 'Nói rõ — STT trình duyệt tạo transcript để AI so với JD.'}
        </AlertDescription>
      </Alert>

      {/* Investor JD snapshot */}
      {item.investor ? (
        <PortalSection
          title={L ? 'Investor JD / thesis' : 'JD / thesis nhà đầu tư'}
          description={item.investor.name}
        >
          <div className="space-y-2 text-xs text-muted-foreground">
            {item.investor.investmentThesis ? (
              <p>
                <span className="font-semibold text-foreground">Thesis: </span>
                {item.investor.investmentThesis}
              </p>
            ) : null}
            <p>
              <span className="font-semibold text-foreground">
                {L ? 'Industries: ' : 'Ngành: '}
              </span>
              {(item.investor.priorityIndustries || []).join(', ') || '—'}
            </p>
            <p>
              <span className="font-semibold text-foreground">
                {L ? 'Stages: ' : 'Stage: '}
              </span>
              {(item.investor.preferredStages || []).join(', ') || '—'}
            </p>
            <ul className="list-disc space-y-0.5 pl-4">
              {[
                item.investor.revenueRequirement,
                item.investor.teamRequirement,
                item.investor.marketRequirement,
                item.investor.techRequirement,
              ]
                .filter(Boolean)
                .map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
            </ul>
          </div>
        </PortalSection>
      ) : null}

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
              {speechOk ? (
                <Badge variant="outline" className="gap-1">
                  <Mic className="size-3" />
                  STT
                </Badge>
              ) : null}
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
                {L ? 'Camera live' : 'Camera đang bật'}
              </Badge>
            ) : null}
            {camHint ? (
              <Alert className="border-amber-500/40 bg-amber-500/10">
                <AlertTitle className="text-xs">
                  {L ? 'Camera help' : 'Hướng dẫn camera'}
                </AlertTitle>
                <AlertDescription className="text-[11px] leading-relaxed">
                  {camHint}
                </AlertDescription>
              </Alert>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                {L
                  ? 'Click “Test camera” — browser will ask for permission.'
                  : 'Bấm «Thử camera» — trình duyệt sẽ hỏi quyền.'}
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
          </div>
        </div>
      </PortalSection>

      {/* Transcript */}
      <PortalSection
        title={L ? 'Transcript' : 'Transcript (nội dung nói)'}
        description={
          L
            ? 'Auto-filled from speech while recording. Edit freely before AI analysis.'
            : 'Tự điền từ giọng nói khi quay. Chỉnh sửa trước khi AI phân tích.'
        }
      >
        <div className="space-y-2">
          {recording && interim ? (
            <p className="text-[11px] italic text-muted-foreground">
              …{interim}
            </p>
          ) : null}
          <Textarea
            rows={6}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder={
              L
                ? 'Your spoken pitch will appear here…'
                : 'Nội dung pitch sẽ hiện ở đây…'
            }
            className="text-sm"
            disabled={recording}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              className="rounded-full"
              disabled={analyzing || recording || !transcript.trim()}
              onClick={() => void runAnalysis()}
            >
              {analyzing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              {analyzing
                ? L
                  ? 'Analyzing vs JD…'
                  : 'Đang phân tích theo JD…'
                : L
                  ? 'Analyze pitch vs investor JD'
                  : 'Phân tích pitch theo JD nhà đầu tư'}
            </Button>
            <Badge variant="outline" className="h-7 gap-1 text-[10px]">
              <FileText className="size-3" />
              {transcript.trim().split(/\s+/).filter(Boolean).length}{' '}
              {L ? 'words' : 'từ'}
            </Badge>
          </div>
        </div>
      </PortalSection>

      {/* AI results */}
      {job?.status === 'completed' ? (
        <PortalSection
          title={
            L
              ? `AI pitch feedback · ${job.score}/100`
              : `Phản hồi pitch AI · ${job.score}/100`
          }
          description={
            job.summary ||
            (L
              ? `Source: ${job.source || 'ai'} · compared to investor JD`
              : `Nguồn: ${job.source || 'ai'} · so với JD nhà đầu tư`)
          }
        >
          <div className="mb-3 flex flex-wrap gap-2">
            <div className="rounded-2xl border border-primary/30 bg-primary/10 px-4 py-2 text-center">
              <p className="font-heading text-3xl font-bold tabular-nums text-primary">
                {job.score}
              </p>
              <p className="text-[10px] text-muted-foreground">/ 100</p>
            </div>
            {job.is_demo ? <DemoDataBadge /> : null}
            {job.source ? (
              <Badge variant="outline" className="h-fit text-[10px]">
                {job.source}
              </Badge>
            ) : null}
          </div>

          {job.summary ? (
            <div className="mb-3 rounded-xl border bg-muted/20 p-3">
              <MatchMarkdown text={job.summary} className="text-sm" />
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3">
              <p className="mb-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                {L ? 'Strengths' : 'Điểm mạnh'}
              </p>
              <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                {(job.publicFeedback?.strengths || []).map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-rose-500/25 bg-rose-500/5 p-3">
              <p className="mb-1 text-xs font-semibold text-rose-700 dark:text-rose-300">
                {L ? 'Gaps vs investor JD' : 'Lệch so với JD nhà đầu tư'}
              </p>
              <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                {(job.gapsVsJd || job.publicFeedback?.unclear || []).map(
                  (s, i) => (
                    <li key={i}>{s}</li>
                  ),
                )}
              </ul>
            </div>
          </div>

          {(job.improvements || []).length ? (
            <div className="mt-3 rounded-xl border p-3">
              <p className="mb-1 text-xs font-semibold">
                {L ? 'How to improve' : 'Nên cải thiện'}
              </p>
              <ol className="list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
                {job.improvements.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </div>
          ) : null}

          {(job.talkingPoints || []).length ? (
            <div className="mt-3 rounded-xl border bg-primary/5 p-3">
              <p className="mb-1 text-xs font-semibold text-primary">
                {L ? 'Talking points for next take' : 'Talking points lần quay sau'}
              </p>
              <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                {job.talkingPoints.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {(job.coverage || []).length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {job.coverage.map((c) => (
                <Badge
                  key={c.label}
                  variant={c.hit ? 'secondary' : 'outline'}
                  className="text-[10px]"
                >
                  {c.hit ? '✓' : '○'} {c.label}
                </Badge>
              ))}
            </div>
          ) : null}

          {job.qa?.length ? (
            <div className="mt-4 space-y-3">
              <p className="text-sm font-semibold">
                {L ? 'Follow-up Q&A (practice answers)' : 'Q&A follow-up (luyện trả lời)'}
              </p>
              {job.qa.map((q) => (
                <div key={q.id} className="rounded-xl border p-3">
                  <p className="text-sm font-medium">{q.question}</p>
                  <Textarea
                    className="mt-2"
                    rows={2}
                    value={qaDraft[q.id] ?? q.textAnswer ?? ''}
                    onChange={(e) =>
                      setQaDraft((d) => ({ ...d, [q.id]: e.target.value }))
                    }
                    placeholder={L ? 'Your answer…' : 'Câu trả lời…'}
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
                      toast.success(L ? 'Saved' : 'Đã lưu')
                    }}
                  >
                    {L ? 'Save answer' : 'Lưu trả lời'}
                  </Button>
                </div>
              ))}
            </div>
          ) : null}

          <Button
            size="sm"
            className="mt-3 rounded-full"
            onClick={() => navigate(`/evaluations/${caseId}/simulation`)}
          >
            {L ? 'Continue to simulation' : 'Tiếp tục mô phỏng'}
          </Button>
        </PortalSection>
      ) : null}
    </div>
  )
}
