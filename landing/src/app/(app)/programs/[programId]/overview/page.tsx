'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  CheckIcon,
  CopyIcon,
  FileTextIcon,
  LinkIcon,
  Settings2Icon,
  SparklesIcon,
  TrophyIcon,
  UploadIcon,
  UsersIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth/session'
import { getProgram, getProgramSummary } from '@/lib/api/client'
import type { Program, ProgramSummary } from '@/lib/api/types'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { ErrorAlert } from '@/components/dashboard/ErrorAlert'
import { PageSkeleton } from '@/components/dashboard/LoadingBlock'
import { StatusBadge } from '@/components/dashboard/StatusBadge'
import { AiDisclosure } from '@/components/dashboard/AiDisclosure'
import { StatCard, StatGrid } from '@/components/dashboard/StatCard'
import { MetaRow, PageShell, Section, SplitGrid } from '@/components/dashboard/Section'
import { SegmentBar } from '@/components/dashboard/Ambient'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { APP_STATUS_LABEL } from '@/lib/status'

export default function ProgramOverviewPage() {
  const { session } = useAuth()
  const params = useParams()
  const programId = String(params?.programId ?? "")
  const [program, setProgram] = useState<Program | null>(null)
  const [summary, setSummary] = useState<ProgramSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    if (!session) return
    setLoading(true)
    setError(null)
    try {
      const [p, s] = await Promise.all([
        getProgram(session, programId),
        getProgramSummary(session, programId),
      ])
      setProgram(p)
      setSummary(s)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được chương trình')
    } finally {
      setLoading(false)
    }
  }, [session, programId])

  useEffect(() => {
    void load()
  }, [load])

  const publicUrl =
    typeof window !== 'undefined' && program?.submissionToken
      ? `${window.location.origin}/apply/${program.submissionToken}`
      : ''

  const copyLink = async () => {
    if (!publicUrl) return
    await navigator.clipboard.writeText(publicUrl)
    setCopied(true)
    toast.success('Đã sao chép link')
    setTimeout(() => setCopied(false), 1200)
  }

  if (loading) return <PageSkeleton />
  if (error) return <ErrorAlert message={error} onRetry={load} />
  if (!program) return null

  const counts = summary?.statusCounts || {}
  const statusPalette: Record<string, string> = {
    NEW: 'var(--chart-2)',
    SCREENING: 'var(--chart-4)',
    SHORTLISTED: 'var(--chart-1)',
    ACCEPTED: 'oklch(0.72 0.17 150)',
    REJECTED: 'var(--destructive)',
  }
  const segments = Object.entries(counts).map(([k, v]) => ({
    value: Number(v) || 0,
    color: statusPalette[k] ?? 'var(--muted-foreground)',
    label: `${APP_STATUS_LABEL[k as keyof typeof APP_STATUS_LABEL] || k}: ${v}`,
  }))

  const rubricEntries = Object.entries(program.rubric?.criteria || {})
  const maxWeight = Math.max(1, ...rubricEntries.map(([, c]) => Number(c.weight) || 0))
  const totalApps = summary?.totalApplications ?? 0
  const totalResults = summary?.totalResults ?? 0
  const scoredPct = totalApps ? Math.round((totalResults / totalApps) * 100) : 0

  return (
    <PageShell>
      <PageHeader
        title={program.name}
        description={program.objective}
        meta={
          <>
            <StatusBadge status={program.status} kind="program" />
            <Badge variant="outline">{program.expectedSelections ?? 0} chỉ tiêu</Badge>
            <Badge variant="secondary">{totalApps} hồ sơ</Badge>
          </>
        }
        actions={
          <>
            <Button
              size="sm"
              variant="outline"
              render={<Link href={`/programs/${programId}/applications`} />}
              nativeButton={false}
            >
              <UploadIcon data-icon="inline-start" />
              Hồ sơ
            </Button>
            <Button
              size="sm"
              variant="outline"
              render={<Link href={`/programs/${programId}/settings`} />}
              nativeButton={false}
            >
              <Settings2Icon data-icon="inline-start" />
              Cài đặt
            </Button>
            <Button
              size="sm"
              render={<Link href={`/programs/${programId}/ranking`} />}
              nativeButton={false}
            >
              <TrophyIcon data-icon="inline-start" />
              Ranking
            </Button>
          </>
        }
      />

      <AiDisclosure />

      <StatGrid>
        <StatCard label="Hồ sơ" value={totalApps} icon={FileTextIcon} hint="Tổng nhận được" />
        <StatCard label="Đã chấm" value={totalResults} icon={SparklesIcon} hint={`${scoredPct}% pipeline`} />
        <StatCard
          label="Matching"
          value={summary?.verifiedOptInProfiles ?? 0}
          icon={UsersIcon}
          hint="Opt-in đã xác minh"
        />
        <StatCard
          label="Dự kiến chọn"
          value={program.expectedSelections ?? 0}
          icon={CheckIcon}
          hint="Expected selections"
        />
      </StatGrid>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Section
          className="lg:col-span-3"
          title="Link nộp hồ sơ"
          description="Chia sẻ để startup nộp deck / form công khai"
          action={
            program.submissionToken ? (
              <Button
                size="sm"
                variant="outline"
                render={<Link href={`/apply/${program.submissionToken}`} target="_blank" />}
                nativeButton={false}
              >
                <LinkIcon data-icon="inline-start" />
                Mở
              </Button>
            ) : null
          }
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1 rounded-lg border bg-muted/40 px-3 py-2.5">
              <p className="truncate text-xs text-muted-foreground">
                {publicUrl
                  ? `${typeof window !== 'undefined' ? window.location.origin : ''}/apply/••••••••`
                  : 'Chưa có link công khai'}
              </p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                Link đầy đủ chỉ hiện khi copy — tránh lộ token trên màn hình.
              </p>
            </div>
            <Button size="sm" onClick={copyLink} disabled={!publicUrl}>
              {copied ? <CheckIcon data-icon="inline-start" /> : <CopyIcon data-icon="inline-start" />}
              {copied ? 'Đã chép' : 'Copy link'}
            </Button>
          </div>
        </Section>

        <Section className="lg:col-span-2" title="Phân bố trạng thái" description="Pipeline hiện tại">
          {segments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có hồ sơ trong pipeline.</p>
          ) : (
            <div className="flex flex-col gap-3">
              <SegmentBar segments={segments} />
              <div className="grid gap-1.5">
                {Object.entries(counts).map(([k, v]) => (
                  <div
                    key={k}
                    className="flex items-center gap-2 rounded-md bg-muted/40 px-2.5 py-1.5 text-xs"
                  >
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: statusPalette[k] ?? 'var(--muted-foreground)' }}
                    />
                    <span className="flex-1 truncate text-muted-foreground">
                      {APP_STATUS_LABEL[k as keyof typeof APP_STATUS_LABEL] || k}
                    </span>
                    <span className="font-semibold tabular-nums">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>
      </div>

      <SplitGrid>
        <Section title="Bộ lọc chương trình" description="Ngành · giai đoạn · địa bàn">
          <div className="flex flex-col gap-4">
            <MetaRow label="Ngành ưu tiên">
              {(program.priorityIndustries || []).map((i) => (
                <Badge key={i} variant="secondary">
                  {i}
                </Badge>
              ))}
              {!program.priorityIndustries?.length ? (
                <span className="text-xs text-muted-foreground">—</span>
              ) : null}
            </MetaRow>
            <MetaRow label="Giai đoạn nhận">
              {(program.acceptedStages || []).map((i) => (
                <Badge key={i} variant="outline">
                  {i}
                </Badge>
              ))}
              {!program.acceptedStages?.length ? (
                <span className="text-xs text-muted-foreground">—</span>
              ) : null}
            </MetaRow>
            <MetaRow label="Địa bàn">
              {(program.locations || []).map((i) => (
                <Badge key={i} variant="outline">
                  {i}
                </Badge>
              ))}
              {!program.locations?.length ? (
                <span className="text-xs text-muted-foreground">—</span>
              ) : null}
            </MetaRow>
            <MetaRow label="Trường bắt buộc">
              {(program.requiredFields || []).map((i) => (
                <Badge key={i} variant="secondary" className="font-mono text-[10px]">
                  {i}
                </Badge>
              ))}
              {!program.requiredFields?.length ? (
                <span className="text-xs text-muted-foreground">—</span>
              ) : null}
            </MetaRow>
          </div>
        </Section>

        <Section
          title="Rubric chấm điểm"
          description={program.rubric?.version || 'startup-screening'}
          action={
            <Button
              size="sm"
              variant="ghost"
              render={<Link href={`/programs/${programId}/settings`} />}
              nativeButton={false}
            >
              Sửa
            </Button>
          }
        >
          <div className="flex flex-col gap-2.5">
            {rubricEntries.map(([k, c]) => (
              <div key={k} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate font-medium">{c.name}</span>
                  <span className="tabular-nums text-muted-foreground">{c.weight}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${((Number(c.weight) || 0) / maxWeight) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {rubricEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa cấu hình rubric.</p>
            ) : null}
          </div>
        </Section>
      </SplitGrid>

      {program.description ? (
        <Section title="Mô tả" size="sm">
          <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
            {program.description}
          </p>
        </Section>
      ) : null}

      <Section title="Lối tắt" description="Điều hướng nhanh trong program" size="sm">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { href: 'applications', label: 'Hồ sơ', icon: FileTextIcon },
            { href: 'ranking', label: 'Xếp hạng', icon: TrophyIcon },
            { href: 'compare', label: 'So sánh', icon: SparklesIcon },
            { href: 'audit', label: 'Nhật ký', icon: CheckIcon },
          ].map((item) => (
            <Button
              key={item.href}
              variant="outline"
              className="h-auto flex-col gap-1.5 py-3"
              render={<Link href={`/programs/${programId}/${item.href}`} />}
              nativeButton={false}
            >
              <item.icon className="size-4" />
              <span className="text-xs">{item.label}</span>
            </Button>
          ))}
        </div>
      </Section>
    </PageShell>
  )
}
