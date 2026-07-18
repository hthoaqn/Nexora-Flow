'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Columns2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth/session'
import { listApplications, compareApplications, displayName } from '@/lib/api/client'
import type { Application, ScreeningResult } from '@/lib/api/types'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { ErrorAlert } from '@/components/dashboard/ErrorAlert'
import { LoadingBlock } from '@/components/dashboard/LoadingBlock'
import { AiDisclosure } from '@/components/dashboard/AiDisclosure'
import { ScoreBadge, ConfidenceIndicator } from '@/components/dashboard/ScoreBadge'
import { PageShell, Section } from '@/components/dashboard/Section'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Spinner } from '@/components/ui/spinner'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export default function ComparePage() {
  const { session } = useAuth()
  const params = useParams()
  const programId = String(params?.programId ?? "")
  const [apps, setApps] = useState<Application[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [rows, setRows] = useState<ScreeningResult[]>([])
  const [loading, setLoading] = useState(true)
  const [comparing, setComparing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!session) return
    setLoading(true)
    try {
      const appPage = await listApplications(session, programId, { limit: 100 })
      setApps(appPage.items || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi')
    } finally {
      setLoading(false)
    }
  }, [session, programId])

  useEffect(() => {
    void load()
  }, [load])

  const toggle = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= 5) {
        toast.message('Tối đa 5 hồ sơ')
        return prev
      }
      return [...prev, id]
    })
  }

  const onCompare = async () => {
    if (!session || selected.length < 2) {
      toast.message('Chọn ≥2 hồ sơ')
      return
    }
    setComparing(true)
    setError(null)
    try {
      const data = await compareApplications(session, programId, {
        applicationIds: selected,
      })
      const list = Array.isArray(data) ? data : data.items || []
      setRows(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không so sánh được')
    } finally {
      setComparing(false)
    }
  }

  if (loading) return <LoadingBlock />

  return (
    <PageShell>
      <PageHeader
        title="So sánh"
        description="Chọn 2–5 startup đã chấm để đối chiếu điểm & breakdown side-by-side."
        meta={
          <>
            <Badge variant="secondary">{apps.length} hồ sơ</Badge>
            <Badge variant="outline">{selected.length}/5 đã chọn</Badge>
          </>
        }
        actions={
          <Button size="sm" disabled={comparing || selected.length < 2} onClick={() => void onCompare()}>
            {comparing ? <Spinner data-icon="inline-start" /> : <Columns2Icon data-icon="inline-start" />}
            So sánh
          </Button>
        }
      />

      <AiDisclosure />
      {error ? <ErrorAlert message={error} /> : null}

      {apps.length < 2 ? (
        <EmptyState
          icon={<Columns2Icon />}
          title="Cần ≥2 hồ sơ"
          description="Upload và chấm thêm startup trước khi so sánh."
        />
      ) : (
        <Section
          title="Chọn hồ sơ"
          description="Tick 2–5 startup · ưu tiên đã có screening result"
          size="sm"
        >
          <div className="flex flex-wrap gap-2">
            {apps.map((a) => (
              <label
                key={a.id}
                className={cn(
                  'inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                  selected.includes(a.id)
                    ? 'border-primary/50 bg-primary/10 text-primary'
                    : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/60',
                )}
              >
                <Checkbox
                  checked={selected.includes(a.id)}
                  onCheckedChange={() => toggle(a.id)}
                />
                <span className="max-w-[8rem] truncate">{displayName(a)}</span>
              </label>
            ))}
          </div>
        </Section>
      )}

      {rows.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => (
            <Card key={r.applicationId} size="sm" className="hover:shadow-md">
              <CardHeader className="border-b [.border-b]:pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="line-clamp-1 text-sm">
                    {r.startupName || 'Startup'}
                  </CardTitle>
                  <ScoreBadge score={r.totalScore} size="sm" />
                </div>
                <ConfidenceIndicator confidence={r.confidence} />
              </CardHeader>
              <CardContent className="flex flex-col gap-1.5 pt-0">
                {(r.breakdown || []).slice(0, 6).map((b, i) => (
                  <div key={i} className="flex justify-between gap-2 text-xs">
                    <span className="truncate text-muted-foreground">{b.name || '—'}</span>
                    <span className="font-medium tabular-nums">{b.score ?? '—'}</span>
                  </div>
                ))}
                {!(r.breakdown || []).length ? (
                  <p className="text-xs text-muted-foreground">Không có breakdown</p>
                ) : null}
              </CardContent>
              <CardFooter>
                <Badge variant="secondary" className="text-[10px]">
                  {r.recommendation === 'consider_shortlist' ? 'Shortlist?' : r.recommendation?.replace(/_/g, ' ') || 'Review'}
                </Badge>
                <Badge variant={r.eligible ? 'default' : 'outline'} className="ml-auto text-[10px]">
                  {r.eligible ? 'Eligible' : 'Not eligible'}
                </Badge>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : selected.length >= 2 ? (
        <EmptyState
          icon={<Columns2Icon />}
          title="Chưa có bảng so sánh"
          description="Bấm So sánh để tải breakdown."
          action={
            <Button size="sm" onClick={() => void onCompare()}>
              Chạy so sánh
            </Button>
          }
        />
      ) : null}
    </PageShell>
  )
}
