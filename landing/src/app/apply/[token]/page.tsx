'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  CheckCircle2Icon,
  FileTextIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UploadIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  getPublicProgram,
  uploadPublicApplications,
  asApplicationList,
} from '@/lib/api/client'
import type { PublicProgram, Application } from '@/lib/api/types'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ErrorAlert } from '@/components/dashboard/ErrorAlert'
import { LoadingBlock } from '@/components/dashboard/LoadingBlock'
import { ThemeToggle } from '@/components/Controls'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

const accessKey = (id: string) => `nexora.access.${id}`

export default function PublicApplyPage() {
  const params = useParams()
  const token = String(params?.token ?? "")
  const router = useRouter()

  const [program, setProgram] = useState<PublicProgram | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [matchingOptIn, setMatchingOptIn] = useState(false)
  const [created, setCreated] = useState<Application[]>([])
  const [dragOver, setDragOver] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const p = await getPublicProgram(token)
      setProgram(p)
    } catch {
      setError('Không tìm thấy chương trình hoặc link đã hết hạn.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  const onUpload = async (files: FileList | File[] | null) => {
    if (!files?.length) return
    setUploading(true)
    setError(null)
    try {
      const listFiles = Array.from(files as FileList)
      const res = await uploadPublicApplications(token, listFiles, matchingOptIn)
      const list = asApplicationList(res)
      list.forEach((app) => {
        if (app.applicantToken) {
          try {
            sessionStorage.setItem(accessKey(app.id), app.applicantToken)
          } catch {
            /* ignore */
          }
        }
      })
      setCreated(list)
      toast.success('Đã nộp hồ sơ thành công')
    } catch {
      setError('Nộp hồ sơ không thành công. Vui lòng thử lại.')
      toast.error('Nộp hồ sơ thất bại')
    } finally {
      setUploading(false)
      setDragOver(false)
    }
  }

  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden bg-background">
      {/* Ambient */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-0 size-[28rem] rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -right-20 bottom-0 size-[24rem] rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      </div>

      <header className="relative z-10 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="inline-flex items-center gap-2">
            <Logo size={28} />
          </Link>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="hidden rounded-full sm:inline-flex">
              Public intake
            </Badge>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        {loading ? (
          <LoadingBlock label="Đang tải chương trình…" />
        ) : error && !program ? (
          <div className="mx-auto w-full max-w-lg">
            <ErrorAlert message={error} onRetry={load} />
            <div className="mt-4 text-center">
              <Button variant="outline" size="sm" render={<Link href="/" />} nativeButton={false}>
                Về trang chủ
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            {/* Left — program brief */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="rounded-full">Nộp hồ sơ</Badge>
                  <Badge variant="outline" className="rounded-full font-mono text-[10px]">
                    {token.slice(0, 12)}…
                  </Badge>
                </div>
                <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                  {program?.name}
                </h1>
                <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
                  {program?.objective || 'Nộp pitch deck để tham gia screening.'}
                </p>
              </div>

              {(program?.priorityIndustries?.length || program?.acceptedStages?.length) ? (
                <Card size="sm" className="gap-3">
                  <CardHeader className="pb-0">
                    <CardTitle className="text-sm">Tiêu chí chương trình</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3 pt-0">
                    {program?.priorityIndustries?.length ? (
                      <div>
                        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Ngành ưu tiên
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {program.priorityIndustries.map((i) => (
                            <Badge key={i} variant="secondary">
                              {i}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {program?.acceptedStages?.length ? (
                      <div>
                        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Giai đoạn nhận
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {program.acceptedStages.map((s) => (
                            <Badge key={s} variant="outline">
                              {s}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ) : null}

              {program?.description ? (
                <Card size="sm">
                  <CardHeader className="pb-0">
                    <CardTitle className="text-sm">Mô tả</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                      {program.description}
                    </p>
                  </CardContent>
                </Card>
              ) : null}

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {[
                  {
                    icon: FileTextIcon,
                    t: 'PDF / PPT',
                    d: 'Pitch deck',
                  },
                  {
                    icon: SparklesIcon,
                    t: 'AI parse',
                    d: 'Trích xuất hồ sơ',
                  },
                  {
                    icon: ShieldCheckIcon,
                    t: 'Private',
                    d: 'Theo tổ chức',
                  },
                ].map((item) => (
                  <div
                    key={item.t}
                    className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-card/70 px-3 py-2.5"
                  >
                    <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <item.icon className="size-3.5" />
                    </span>
                    <div>
                      <p className="text-xs font-semibold">{item.t}</p>
                      <p className="text-[11px] text-muted-foreground">{item.d}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — upload / success */}
            <div className="flex flex-col gap-4 lg:sticky lg:top-6">
              {error ? <ErrorAlert message={error} /> : null}

              {created.length > 0 ? (
                <Card className="border-primary/25 shadow-lg shadow-primary/5">
                  <CardHeader>
                    <div className="mb-1 flex size-11 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                      <CheckCircle2Icon className="size-5" />
                    </div>
                    <CardTitle className="font-heading text-xl">Đã nhận hồ sơ</CardTitle>
                    <CardDescription>
                      Hồ sơ đang chờ admin duyệt (NEEDS_REVIEW). Bạn có thể bổ sung thông tin trên
                      thiết bị này.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2">
                    {created.map((app) => {
                      const id = app.id || ''
                      const file =
                        app.fileMetadata?.fileName ||
                        (app as { fileName?: string }).fileName ||
                        'Hồ sơ đã nộp'
                      return (
                        <div
                          key={id || file}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-muted/30 px-3 py-3"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{file}</p>
                            <p className="font-mono text-[10px] text-muted-foreground">
                              {id ? `${id.slice(0, 14)}…` : '—'}
                            </p>
                          </div>
                          {id ? (
                            <Button
                              size="sm"
                              className="rounded-full"
                              onClick={() => router.push(`/my-application/${id}`)}
                            >
                              Xem / xác nhận
                            </Button>
                          ) : null}
                        </div>
                      )
                    })}
                  </CardContent>
                  <CardFooter className="justify-between text-xs text-muted-foreground">
                    <span>{created.length} file</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCreated([])}
                    >
                      Nộp thêm
                    </Button>
                  </CardFooter>
                </Card>
              ) : (
                <Card className="shadow-lg shadow-primary/5">
                  <CardHeader>
                    <CardTitle className="font-heading text-xl">Tải pitch deck</CardTitle>
                    <CardDescription>
                      Kéo thả hoặc chọn file PDF / PowerPoint. AI sẽ trích xuất hồ sơ sau khi nhận.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <Label
                      htmlFor="public-upload"
                      onDragOver={(e) => {
                        e.preventDefault()
                        setDragOver(true)
                      }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault()
                        void onUpload(e.dataTransfer.files)
                      }}
                      className={cn(
                        'flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-14 text-center transition-colors',
                        dragOver
                          ? 'border-primary bg-primary/10'
                          : 'border-border/80 bg-muted/20 hover:border-primary/40 hover:bg-primary/5',
                        uploading && 'pointer-events-none opacity-70',
                      )}
                    >
                      <input
                        id="public-upload"
                        type="file"
                        className="sr-only"
                        multiple
                        accept=".pdf,.ppt,.pptx,application/pdf"
                        disabled={uploading}
                        onChange={(e) => void onUpload(e.target.files)}
                      />
                      {uploading ? (
                        <Spinner className="mb-3 size-8" />
                      ) : (
                        <span className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                          <UploadIcon className="size-5" />
                        </span>
                      )}
                      <span className="text-sm font-semibold">
                        {uploading ? 'Đang nộp hồ sơ…' : 'Chọn hoặc kéo thả file'}
                      </span>
                      <span className="mt-1 text-xs text-muted-foreground">
                        PDF, PPT, PPTX · có thể nhiều file
                      </span>
                    </Label>

                    <Separator />

                    <div className="flex items-start gap-2.5 rounded-xl border bg-muted/25 px-3 py-3">
                      <Checkbox
                        id="public-optin"
                        checked={matchingOptIn}
                        onCheckedChange={(v) => setMatchingOptIn(v === true)}
                        className="mt-0.5"
                      />
                      <div>
                        <Label htmlFor="public-optin" className="text-sm font-medium">
                          Cho phép matching sau này
                        </Label>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Tùy chọn. Hồ sơ có thể được gợi ý cho partner phù hợp trong mạng lưới.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="text-xs text-muted-foreground">
                    <ShieldCheckIcon className="mr-1.5 size-3.5 text-primary" />
                    Dữ liệu theo tenant · không auto-publish
                  </CardFooter>
                </Card>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="relative z-10 border-t border-border/50 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 text-xs text-muted-foreground sm:px-6">
          <span>© {new Date().getFullYear()} Nexora Flow</span>
          <Link href="/" className="hover:text-foreground">
            nexora-flow.cloud
          </Link>
        </div>
      </footer>
    </div>
  )
}
