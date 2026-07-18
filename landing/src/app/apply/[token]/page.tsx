'use client'

/**
 * Public apply flow:
 * Upload deck → AI analyze → auto-fill form → user re-check & submit
 */

import { useTx } from '@/lib/tx'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  CheckCircle2Icon,
  CloudUploadIcon,
  FileTextIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UploadIcon,
  XIcon,
  AlertTriangleIcon,
  ArrowRightIcon,
  RefreshCwIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  getPublicProgram,
  uploadPublicApplications,
  asApplicationList,
  publicConfirmApplication,
} from '@/lib/api/client'
import type { PublicProgram, Application } from '@/lib/api/types'
import {
  emptyApplyForm,
  mergeProfileIntoForm,
  scoreFitAgainstProgram,
  INDUSTRY_OPTIONS,
  STAGE_OPTIONS,
  type ApplyForm,
} from '@/lib/apply-fit'
import {
  UPLOAD_ACCEPT,
  UPLOAD_ACCEPT_LABEL_VI,
  UPLOAD_ACCEPT_LABEL_EN,
  filterAllowedFiles,
  formatFileSize,
} from '@/lib/upload-types'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { ErrorAlert } from '@/components/dashboard/ErrorAlert'
import { LoadingBlock } from '@/components/dashboard/LoadingBlock'
import { ThemeToggle, LangToggle } from '@/components/Controls'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

const accessKey = (id: string) => `nexora.access.${id}`

/** upload | analyzing | review | done */
type Phase = 'upload' | 'analyzing' | 'review' | 'done'

export default function PublicApplyPage() {
  const { tx, lang } = useTx()
  const params = useParams()
  const token = String(params?.token ?? '')
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [program, setProgram] = useState<PublicProgram | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('upload')

  const [form, setForm] = useState<ApplyForm>(emptyApplyForm)
  const [matchingOptIn, setMatchingOptIn] = useState(true)
  const [agreeTerms, setAgreeTerms] = useState(false)

  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const [aiDemo, setAiDemo] = useState(false)
  const [aiWarnings, setAiWarnings] = useState<string[]>([])
  const [aiFilledKeys, setAiFilledKeys] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [created, setCreated] = useState<Application[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const p = await getPublicProgram(token)
      setProgram(p)
    } catch {
      setError(
        tx(
          'Không tìm thấy chương trình hoặc link đã hết hạn.',
          'Program not found or the link has expired.',
        ),
      )
    } finally {
      setLoading(false)
    }
  }, [token, tx])

  useEffect(() => {
    void load()
  }, [load])

  const fit = useMemo(
    () => scoreFitAgainstProgram(form, program),
    [form, program],
  )

  const setField = <K extends keyof ApplyForm>(k: K, v: ApplyForm[K]) => {
    setForm((f) => ({ ...f, [k]: v }))
  }

  const industriesForPick = useMemo(() => {
    const fromProg = program?.priorityIndustries || []
    return Array.from(new Set([...fromProg, ...INDUSTRY_OPTIONS]))
  }, [program])

  const stagesForPick = useMemo(() => {
    const fromProg = program?.acceptedStages || []
    return Array.from(new Set([...fromProg, ...STAGE_OPTIONS]))
  }, [program])

  const pickFile = (list: FileList | File[] | null) => {
    if (!list?.length) return
    const { accepted, rejected } = filterAllowedFiles(list)
    if (rejected.length) {
      toast.error(
        tx(
          `${rejected.length} file không hỗ trợ`,
          `${rejected.length} unsupported file(s)`,
        ),
      )
    }
    if (accepted[0]) setFile(accepted[0])
  }

  /** Upload → AI → auto-fill → review */
  const analyzeWithAi = async (f?: File | null) => {
    const target = f ?? file
    if (!target) {
      toast.error(tx('Chọn file trước', 'Pick a file first'))
      return
    }
    setFile(target)
    setPhase('analyzing')
    setError(null)
    setAiFilledKeys([])
    setAiWarnings([])

    try {
      const fd = new FormData()
      fd.append('file', target)
      const res = await fetch('/api/public/extract', {
        method: 'POST',
        body: fd,
      })
      const body = await res.json()
      if (!res.ok || !body?.success) {
        throw new Error(body?.message || 'Extract failed')
      }

      const profile = (body.data?.profile || {}) as Record<string, unknown>
      const before = emptyApplyForm()
      const merged = mergeProfileIntoForm(before, profile, false)
      setForm(merged)

      const filled = (Object.keys(merged) as (keyof ApplyForm)[]).filter(
        (k) => String(merged[k] || '').trim().length > 0,
      )
      setAiFilledKeys(filled)
      setAiDemo(!!body.data?.is_demo)
      setAiWarnings(
        Array.isArray(body.data?.warnings) ? body.data.warnings : [],
      )
      setPhase('review')
      if (filled.length === 0) {
        toast.message(
          tx(
            'Chưa trích được field từ file (PDF scan / thiếu text). Điền form bên dưới — vẫn nộp được.',
            'No fields extracted (scanned PDF / no text). Fill the form below — you can still submit.',
          ),
        )
      } else if (body.data?.is_demo) {
        toast.success(
          tx(
            `Đã gợi ý ${filled.length} trường (demo) — kiểm tra rồi nộp`,
            `Suggested ${filled.length} fields (demo) — re-check then submit`,
          ),
        )
      } else {
        toast.success(
          tx(
            `AI đã điền ${filled.length} trường — kiểm tra rồi nộp`,
            `AI filled ${filled.length} fields — re-check then submit`,
          ),
        )
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'AI error'
      // Soft error — still open form
      setForm(emptyApplyForm())
      setPhase('review')
      toast.message(
        tx(
          `Không phân tích được file (${msg.slice(0, 80)}). Điền form thủ công — vẫn nộp bình thường.`,
          `Could not analyze file (${msg.slice(0, 80)}). Fill the form manually — submit still works.`,
        ),
      )
    }
  }

  const validateForm = () => {
    if (!agreeTerms) {
      toast.error(
        tx(
          'Cần đồng ý Điều khoản & Chính sách bảo mật trước khi nộp',
          'You must agree to the Terms & Privacy Policy before submitting',
        ),
      )
      return false
    }
    if (!form.startupName.trim()) {
      toast.error(tx('Thiếu tên startup', 'Startup name required'))
      return false
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail.trim())) {
      toast.error(tx('Email không hợp lệ', 'Invalid email'))
      return false
    }
    return true
  }

  const submitAll = async () => {
    if (!file) {
      toast.error(tx('Thiếu file', 'File missing'))
      setPhase('upload')
      return
    }
    if (!validateForm()) return
    if (fit.hardFail) {
      toast.error(
        tx(
          'Không qua hard filter chương trình — chỉnh ngành/giai đoạn.',
          'Fails program hard filters — fix sector/stage.',
        ),
      )
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const res = await uploadPublicApplications(token, [file], matchingOptIn)
      const list = asApplicationList(res)
      if (!list.length) throw new Error('No application returned')

      for (const app of list) {
        const id = app.id || (app as { applicationId?: string }).applicationId
        const at =
          app.applicantToken ||
          (app as { applicantToken?: string }).applicantToken
        if (id && at) {
          try {
            sessionStorage.setItem(accessKey(id), at)
          } catch {
            /* */
          }
          try {
            await publicConfirmApplication(id, at, {
              confirmedProfile: {
                startupName: form.startupName,
                contactEmail: form.contactEmail,
                contactName: form.contactName,
                website: form.website,
                industry: form.industry,
                stage: form.stage,
                location: form.location,
                problem: form.problem,
                solution: form.solution,
                team: form.team,
                product: form.product,
                description: form.description,
              },
              matchingOptIn,
              consentPolicyVersion: 'public-apply-v3',
            })
          } catch {
            /* confirm may fail while EXTRACTING */
          }
        }
      }
      setCreated(list)
      setPhase('done')
      toast.success(tx('Đã nộp hồ sơ', 'Application submitted'))
    } catch {
      setError(
        tx(
          'Nộp thất bại. Thử lại.',
          'Submit failed. Try again.',
        ),
      )
      toast.error(tx('Nộp thất bại', 'Submit failed'))
    } finally {
      setSubmitting(false)
    }
  }

  const resetFlow = () => {
    setFile(null)
    setForm(emptyApplyForm())
    setCreated([])
    setAiFilledKeys([])
    setAiWarnings([])
    setAiDemo(false)
    setError(null)
    setPhase('upload')
  }

  return (
    <div className="relative flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-2 px-4 sm:px-6">
          <Link href="/" className="inline-flex items-center gap-2">
            <Logo size={28} />
          </Link>
          <div className="flex items-center gap-1.5">
            <LangToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8">
        {loading ? (
          <LoadingBlock
            label={tx('Đang tải chương trình…', 'Loading program…')}
          />
        ) : error && !program ? (
          <div className="w-full">
            <ErrorAlert message={error} onRetry={load} />
            <div className="mt-4 text-center">
              <Button
                variant="outline"
                size="sm"
                render={<Link href="/" />}
                nativeButton={false}
              >
                {tx('Về trang chủ', 'Home')}
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Compact program strip */}
            <div className="rounded-2xl border bg-card p-4 sm:p-5">
              <Badge className="mb-2 rounded-full">
                {tx('Nộp hồ sơ', 'Apply')}
              </Badge>
              <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
                {program?.name}
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {program?.objective ||
                  tx(
                    'Tải deck → AI điền form → bạn kiểm tra → nộp.',
                    'Upload deck → AI fills form → you re-check → submit.',
                  )}
              </p>
              {(program?.priorityIndustries?.length ||
                program?.acceptedStages?.length) ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(program?.priorityIndustries || []).slice(0, 6).map((i) => (
                    <Badge key={i} variant="secondary" className="text-[10px]">
                      {i}
                    </Badge>
                  ))}
                  {(program?.acceptedStages || []).slice(0, 4).map((s) => (
                    <Badge key={s} variant="outline" className="text-[10px]">
                      {s}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>

            {/* Flow steps indicator */}
            <ol className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-muted-foreground">
              {[
                { id: 'upload', vi: '1. Tải file', en: '1. Upload' },
                { id: 'analyzing', vi: '2. AI phân tích', en: '2. AI analysis' },
                { id: 'review', vi: '3. Kiểm tra', en: '3. Re-check' },
                { id: 'done', vi: '4. Nộp', en: '4. Done' },
              ].map((s, i) => {
                const order = ['upload', 'analyzing', 'review', 'done']
                const activeIdx = order.indexOf(phase)
                const thisIdx = order.indexOf(s.id)
                const on = thisIdx <= activeIdx
                return (
                  <li key={s.id} className="inline-flex items-center gap-2">
                    {i > 0 ? (
                      <ArrowRightIcon className="size-3 opacity-40" />
                    ) : null}
                    <span
                      className={cn(
                        'rounded-full border px-2.5 py-1',
                        on
                          ? 'border-primary/40 bg-primary/10 text-primary'
                          : 'border-border',
                        phase === s.id &&
                          'border-primary bg-primary text-primary-foreground',
                      )}
                    >
                      {lang === 'en' ? s.en : s.vi}
                    </span>
                  </li>
                )
              })}
            </ol>

            {error && phase !== 'upload' ? (
              <ErrorAlert message={error} />
            ) : null}

            {/* ── UPLOAD ── */}
            {(phase === 'upload' || phase === 'analyzing') && (
              <section className="rounded-2xl border bg-card p-4 sm:p-6">
                <h2 className="font-heading text-lg font-semibold">
                  {tx('Tải pitch deck / báo cáo', 'Upload pitch deck / report')}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {lang === 'en'
                    ? UPLOAD_ACCEPT_LABEL_EN
                    : UPLOAD_ACCEPT_LABEL_VI}
                  {' · '}
                  {tx('Tối đa 25MB', 'Max 25MB')}
                </p>

                <div
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    phase !== 'analyzing' && fileInputRef.current?.click()
                  }
                  onKeyDown={(e) => {
                    if (
                      phase !== 'analyzing' &&
                      (e.key === 'Enter' || e.key === ' ')
                    )
                      fileInputRef.current?.click()
                  }}
                  onDragOver={(e) => {
                    e.preventDefault()
                    if (phase !== 'analyzing') setDragOver(true)
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragOver(false)
                    if (phase === 'analyzing') return
                    pickFile(e.dataTransfer.files)
                  }}
                  className={cn(
                    'mt-5 flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-4 py-12 text-center transition-all sm:min-h-[280px]',
                    phase === 'analyzing'
                      ? 'pointer-events-none border-primary/40 bg-primary/5'
                      : dragOver
                        ? 'cursor-pointer border-primary bg-primary/10'
                        : 'cursor-pointer border-primary/35 bg-primary/5 hover:border-primary/55',
                  )}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="sr-only"
                    accept={UPLOAD_ACCEPT}
                    disabled={phase === 'analyzing'}
                    onChange={(e) => pickFile(e.target.files)}
                  />
                  {phase === 'analyzing' ? (
                    <>
                      <Spinner className="size-10 text-primary" />
                      <p className="text-sm font-semibold sm:text-base">
                        {tx(
                          'AI đang phân tích file…',
                          'AI is analyzing your file…',
                        )}
                      </p>
                      <p className="max-w-sm text-xs text-muted-foreground">
                        {tx(
                          'Trích xuất tên, ngành, giai đoạn, vấn đề, giải pháp…',
                          'Extracting name, sector, stage, problem, solution…',
                        )}
                      </p>
                    </>
                  ) : (
                    <>
                      <span className="flex size-16 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                        <CloudUploadIcon className="size-8" />
                      </span>
                      <p className="text-sm font-semibold sm:text-base">
                        {tx(
                          'Kéo thả file vào đây — hoặc bấm chọn',
                          'Drop file here — or click to browse',
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {tx(
                          'Sau khi chọn, bấm nút phân tích bên dưới',
                          'After picking, tap Analyze below',
                        )}
                      </p>
                    </>
                  )}
                </div>

                {file && phase === 'upload' ? (
                  <div className="mt-4 flex items-center gap-3 rounded-xl border px-3 py-2.5">
                    <FileTextIcon className="size-5 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{file.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => setFile(null)}
                    >
                      <XIcon className="size-4" />
                    </Button>
                  </div>
                ) : null}

                {phase === 'upload' ? (
                  <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <Button
                      className="h-11 rounded-full"
                      disabled={!file}
                      onClick={() => void analyzeWithAi()}
                    >
                      <SparklesIcon data-icon="inline-start" />
                      {tx(
                        'Phân tích AI & điền form',
                        'Analyze with AI & fill form',
                      )}
                      <ArrowRightIcon data-icon="inline-end" />
                    </Button>
                  </div>
                ) : null}
              </section>
            )}

            {/* ── REVIEW (auto-filled) ── */}
            {phase === 'review' ? (
              <section className="rounded-2xl border bg-card p-4 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="font-heading text-lg font-semibold">
                      {tx(
                        'Kiểm tra form (đã auto-điền)',
                        'Re-check form (auto-filled)',
                      )}
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {tx(
                        'Sửa chỗ sai rồi bấm Nộp. File deck đã gắn kèm.',
                        'Fix anything wrong, then Submit. Deck file stays attached.',
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {aiDemo ? (
                      <Badge variant="outline" className="gap-1">
                        <AlertTriangleIcon className="size-3" />
                        {tx('AI demo', 'AI demo')}
                      </Badge>
                    ) : (
                      <Badge className="gap-1">
                        <SparklesIcon className="size-3" />
                        AI
                      </Badge>
                    )}
                    {file ? (
                      <Badge variant="secondary" className="max-w-[10rem] truncate">
                        {file.name}
                      </Badge>
                    ) : null}
                  </div>
                </div>

                {aiFilledKeys.length > 0 ? (
                  <p className="mt-3 text-[11px] text-muted-foreground">
                    {tx(
                      `AI điền ${aiFilledKeys.length} trường — ô có highlight.`,
                      `AI filled ${aiFilledKeys.length} fields — highlighted.`,
                    )}
                  </p>
                ) : null}

                {aiWarnings.length > 0 ? (
                  <ul className="mt-2 list-inside list-disc text-[11px] text-amber-700 dark:text-amber-400">
                    {aiWarnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                ) : null}

                {/* Fit vs program */}
                <div className="mt-4 rounded-xl border bg-muted/25 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold">
                      {tx('Khớp tiêu chí chương trình', 'Program fit')}
                    </p>
                    <span className="tabular-nums text-sm font-bold">
                      {fit.total}/100
                    </span>
                  </div>
                  <Progress value={fit.total} className="h-1.5" />
                  <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                    {fit.dimensions.map((d) => (
                      <li key={d.key} className="text-[11px] text-muted-foreground">
                        <span
                          className={cn(
                            'mr-1 inline-block size-1.5 rounded-full',
                            d.ok ? 'bg-primary' : 'bg-muted-foreground/40',
                          )}
                        />
                        <strong className="text-foreground">
                          {lang === 'en' ? d.labelEn : d.labelVi}
                        </strong>
                        : {lang === 'en' ? d.detailEn : d.detailVi}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <Field
                    label={tx('Tên startup *', 'Startup name *')}
                    value={form.startupName}
                    onChange={(v) => setField('startupName', v)}
                    ai={aiFilledKeys.includes('startupName')}
                  />
                  <Field
                    label={tx('Email *', 'Email *')}
                    value={form.contactEmail}
                    onChange={(v) => setField('contactEmail', v)}
                    type="email"
                    ai={aiFilledKeys.includes('contactEmail')}
                  />
                  <Field
                    label={tx('Người liên hệ', 'Contact person')}
                    value={form.contactName}
                    onChange={(v) => setField('contactName', v)}
                    ai={aiFilledKeys.includes('contactName')}
                  />
                  <Field
                    label="Website"
                    value={form.website}
                    onChange={(v) => setField('website', v)}
                    ai={aiFilledKeys.includes('website')}
                  />
                </div>

                <div className="mt-4 space-y-2">
                  <Label className="text-xs">
                    {tx('Ngành', 'Sector')}
                    {aiFilledKeys.includes('industry') ? (
                      <AiHint />
                    ) : null}
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {industriesForPick.map((i) => {
                      const active = form.industry
                        .toLowerCase()
                        .includes(i.toLowerCase())
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() =>
                            setField(
                              'industry',
                              active && form.industry === i ? '' : i,
                            )
                          }
                          className={cn(
                            'rounded-full border px-2.5 py-1 text-[11px] font-medium',
                            active
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border hover:border-primary/40',
                          )}
                        >
                          {i}
                        </button>
                      )
                    })}
                  </div>
                  <Input
                    className={cn(
                      'h-9',
                      aiFilledKeys.includes('industry') &&
                        'border-primary/40 bg-primary/5',
                    )}
                    value={form.industry}
                    onChange={(e) => setField('industry', e.target.value)}
                  />
                </div>

                <div className="mt-4 space-y-2">
                  <Label className="text-xs">
                    {tx('Giai đoạn', 'Stage')}
                    {aiFilledKeys.includes('stage') ? <AiHint /> : null}
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {stagesForPick.map((s) => {
                      const active =
                        form.stage.toLowerCase() === s.toLowerCase()
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setField('stage', active ? '' : s)}
                          className={cn(
                            'rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize',
                            active
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border hover:border-primary/40',
                          )}
                        >
                          {s}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field
                    label={tx('Địa bàn', 'Location')}
                    value={form.location}
                    onChange={(v) => setField('location', v)}
                    ai={aiFilledKeys.includes('location')}
                  />
                </div>

                <div className="mt-4 grid gap-4">
                  <Area
                    label={tx('Vấn đề', 'Problem')}
                    value={form.problem}
                    onChange={(v) => setField('problem', v)}
                    ai={aiFilledKeys.includes('problem')}
                  />
                  <Area
                    label={tx('Giải pháp', 'Solution')}
                    value={form.solution}
                    onChange={(v) => setField('solution', v)}
                    ai={aiFilledKeys.includes('solution')}
                  />
                  <Area
                    label={tx('Đội ngũ', 'Team')}
                    value={form.team}
                    onChange={(v) => setField('team', v)}
                    ai={aiFilledKeys.includes('team')}
                  />
                  <Area
                    label={tx('Sản phẩm', 'Product')}
                    value={form.product}
                    onChange={(v) => setField('product', v)}
                    ai={aiFilledKeys.includes('product')}
                  />
                </div>

                <label className="mt-5 flex items-start gap-2.5 rounded-xl border border-primary/30 bg-primary/5 px-3 py-3 text-xs">
                  <Checkbox
                    checked={agreeTerms}
                    onCheckedChange={(v) => setAgreeTerms(v === true)}
                  />
                  <span>
                    <strong>
                      {tx(
                        'Tôi đồng ý Điều khoản & Chính sách bảo mật *',
                        'I agree to the Terms & Privacy Policy *',
                      )}
                    </strong>
                    <span className="mt-0.5 block text-muted-foreground">
                      {tx(
                        'Cho phép hệ thống lưu trữ, phân tích hồ sơ và file đính kèm để phục vụ sàng lọc, chấm điểm và kết nối. Xem ',
                        'Allow the platform to store and analyze your application and attached file for screening, scoring and matching. See ',
                      )}
                      <Link href="/terms" target="_blank" className="text-primary underline underline-offset-2">
                        {tx('Điều khoản', 'Terms')}
                      </Link>
                      {' · '}
                      <Link href="/privacy" target="_blank" className="text-primary underline underline-offset-2">
                        {tx('Chính sách bảo mật', 'Privacy Policy')}
                      </Link>
                      .
                    </span>
                  </span>
                </label>

                <label className="mt-3 flex items-start gap-2.5 rounded-xl border px-3 py-3 text-xs">
                  <Checkbox
                    checked={matchingOptIn}
                    onCheckedChange={(v) => setMatchingOptIn(v === true)}
                  />
                  <span>
                    <strong>
                      {tx(
                        'Đồng ý matching trong hệ sinh thái Nexora',
                        'Opt in to Nexora matching',
                      )}
                    </strong>
                    <span className="mt-0.5 block text-muted-foreground">
                      {tx(
                        'Có thể rút lại sau trên trang hồ sơ của bạn.',
                        'You can revoke later on your application page.',
                      )}
                    </span>
                  </span>
                </label>

                {fit.hardFail ? (
                  <div className="mt-3 flex gap-2 rounded-xl border border-rose-500/30 bg-rose-500/5 px-3 py-2.5 text-xs text-rose-700 dark:text-rose-300">
                    <AlertTriangleIcon className="size-4 shrink-0" />
                    {tx(
                      'Hard filter: ngành/giai đoạn ngoài danh sách chương trình.',
                      'Hard filter: sector/stage not allowed by this program.',
                    )}
                  </div>
                ) : null}

                <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      variant="outline"
                      className="h-10 rounded-full"
                      onClick={resetFlow}
                    >
                      {tx('Đổi file', 'Change file')}
                    </Button>
                    <Button
                      variant="ghost"
                      className="h-10 rounded-full"
                      disabled={!file}
                      onClick={() => void analyzeWithAi()}
                    >
                      <RefreshCwIcon data-icon="inline-start" />
                      {tx('Phân tích lại', 'Re-run AI')}
                    </Button>
                  </div>
                  <Button
                    className="h-11 rounded-full px-6"
                    disabled={submitting || fit.hardFail || !agreeTerms}
                    onClick={() => void submitAll()}
                  >
                    {submitting ? (
                      <Spinner data-icon="inline-start" />
                    ) : (
                      <UploadIcon data-icon="inline-start" />
                    )}
                    {submitting
                      ? tx('Đang nộp…', 'Submitting…')
                      : tx('Xác nhận & nộp', 'Confirm & submit')}
                  </Button>
                </div>
              </section>
            ) : null}

            {/* ── DONE ── */}
            {phase === 'done' && created.length > 0 ? (
              <section className="rounded-2xl border border-primary/25 bg-card p-4 sm:p-6">
                <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                  <CheckCircle2Icon className="size-6" />
                </div>
                <h2 className="font-heading text-xl font-semibold">
                  {tx('Đã nộp hồ sơ', 'Application submitted')}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {tx(
                    'Chờ admin duyệt. Mở trang xác nhận để chỉnh thêm trên thiết bị này.',
                    'Awaiting admin review. Open confirm page to refine on this device.',
                  )}
                </p>
                <ul className="mt-4 space-y-2">
                  {created.map((app) => {
                    const id =
                      app.id ||
                      (app as { applicationId?: string }).applicationId ||
                      ''
                    const fileName =
                      app.fileMetadata?.fileName ||
                      (app as { fileName?: string }).fileName ||
                      file?.name ||
                      '—'
                    return (
                      <li
                        key={id || fileName}
                        className="flex flex-col gap-2 rounded-xl border px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {form.startupName || fileName}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {fileName}
                          </p>
                        </div>
                        {id ? (
                          <Button
                            size="sm"
                            className="rounded-full"
                            onClick={() =>
                              router.push(`/my-application/${id}`)
                            }
                          >
                            {tx('Xem / xác nhận', 'View / confirm')}
                          </Button>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={resetFlow}
                  >
                    {tx('Nộp hồ sơ khác', 'Submit another')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-full"
                    render={<Link href="/" />}
                    nativeButton={false}
                  >
                    {tx('Trang chủ', 'Home')}
                  </Button>
                </div>
              </section>
            ) : null}

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {[
                {
                  icon: UploadIcon,
                  t: tx('Tải deck', 'Upload'),
                  d: 'PDF · PPTX · DOCX',
                },
                {
                  icon: SparklesIcon,
                  t: tx('AI phân tích', 'AI analysis'),
                  d: tx('Auto-điền form', 'Auto-fill form'),
                },
                {
                  icon: ShieldCheckIcon,
                  t: tx('Bạn nộp', 'You submit'),
                  d: tx('Re-check trước', 'Re-check first'),
                },
              ].map((x) => (
                <div
                  key={x.t}
                  className="flex items-center gap-2.5 rounded-xl border px-3 py-2.5"
                >
                  <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <x.icon className="size-3.5" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold">{x.t}</p>
                    <p className="text-[11px] text-muted-foreground">{x.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  )
}

function AiHint() {
  return (
    <span className="ml-1.5 inline-flex items-center gap-0.5 rounded bg-primary/10 px-1 py-0.5 text-[9px] font-semibold text-primary">
      <SparklesIcon className="size-2.5" />
      AI
    </span>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  ai,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  ai?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">
        {label}
        {ai ? <AiHint /> : null}
      </Label>
      <Input
        type={type}
        className={cn('h-9', ai && 'border-primary/40 bg-primary/5')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

function Area({
  label,
  value,
  onChange,
  ai,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  ai?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">
        {label}
        {ai ? <AiHint /> : null}
      </Label>
      <Textarea
        className={cn('min-h-20 resize-y', ai && 'border-primary/40 bg-primary/5')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
