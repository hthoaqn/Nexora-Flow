'use client'

/**
 * NIC staff as HR: filter pipeline → Word summary → email draft to leadership/mentors.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  BriefcaseIcon,
  DownloadIcon,
  FileTextIcon,
  MailIcon,
  RefreshCwIcon,
  SendIcon,
  CopyIcon,
  UsersIcon,
  ClipboardListIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { useTx } from '@/lib/tx'
import { useAuth } from '@/lib/auth/session'
import {
  getProgram,
  listApplications,
  listResults,
} from '@/lib/api/client'
import type { Application, Program, ScreeningResult } from '@/lib/api/types'
import {
  buildNicHrReport,
  buildMailto,
  recommendationLabel,
  type NicHrReport,
  type HrRecommendation,
} from '@/lib/nic-report'
import { downloadNicHrDocx } from '@/lib/nic-report-docx'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { LoadingBlock } from '@/components/dashboard/LoadingBlock'
import { ErrorAlert } from '@/components/dashboard/ErrorAlert'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { StatusBadge } from '@/components/dashboard/StatusBadge'
import { PageShell, Section, Toolbar } from '@/components/dashboard/Section'
import { StatCard, StatGrid } from '@/components/dashboard/StatCard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Spinner } from '@/components/ui/spinner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'

export default function NicHrReportPage() {
  const { tx, lang } = useTx()
  const loc = lang === 'en' ? 'en' : 'vi'
  const { session } = useAuth()
  const params = useParams()
  const programId = String(params?.programId ?? '')

  const [program, setProgram] = useState<Program | null>(null)
  const [apps, setApps] = useState<Application[]>([])
  const [results, setResults] = useState<ScreeningResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [minScore, setMinScore] = useState(0)
  const [optInOnly, setOptInOnly] = useState(false)
  const [mailTo, setMailTo] = useState('')
  const [busyDoc, setBusyDoc] = useState(false)

  const sessionKey = session
    ? `${session.userId}|${session.organizationId}`
    : ''
  const loadInFlight = useRef(false)

  const load = useCallback(async () => {
    if (!session || !programId) return
    if (loadInFlight.current) return
    loadInFlight.current = true
    setLoading(true)
    setError(null)
    try {
      // Single list + results — no multi-status fan-out (rate-limit safe)
      const [p, page, resPage] = await Promise.all([
        getProgram(session, programId),
        listApplications(session, programId, { limit: 100 }),
        listResults(session, programId, { limit: 100 }).catch(
          () => ({ items: [] as ScreeningResult[] }),
        ),
      ])
      setProgram(p)
      setApps(page.items || [])
      setResults(resPage.items || [])
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Could not load report data',
      )
    } finally {
      loadInFlight.current = false
      setLoading(false)
    }
  }, [session, programId])

  useEffect(() => {
    if (!sessionKey || !programId) return
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey, programId])

  const report: NicHrReport | null = useMemo(() => {
    if (!session || !program) return null
    return buildNicHrReport({
      program,
      applications: apps,
      results,
      session,
      minScore,
      optInOnly,
    })
  }, [session, program, apps, results, minScore, optInOnly])

  const onDownloadDocx = async () => {
    if (!report) return
    setBusyDoc(true)
    try {
      await downloadNicHrDocx(report, loc)
      toast.success(
        tx(
          'Đã tải Word báo cáo — đính kèm vào mail gửi mentor/lãnh đạo.',
          'Word report downloaded — attach it to the email for mentors/leadership.',
        ),
      )
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : tx('Không tạo được file Word', 'Could not build Word file'),
      )
    } finally {
      setBusyDoc(false)
    }
  }

  const onCopyEmail = async () => {
    if (!report) return
    const body = loc === 'vi' ? report.emailBodyVi : report.emailBodyEn
    const subject = loc === 'vi' ? report.emailSubjectVi : report.emailSubjectEn
    try {
      await navigator.clipboard.writeText(`${subject}\n\n${body}`)
      toast.success(tx('Đã copy nội dung mail', 'Email draft copied'))
    } catch {
      toast.error(tx('Không copy được', 'Copy failed'))
    }
  }

  const onOpenMail = () => {
    if (!report) return
    const href = buildMailto(report, loc, mailTo.trim())
    window.location.href = href
    toast.message(
      tx(
        'Đã mở mail client — nhớ đính kèm file Word vừa tải.',
        'Mail client opened — remember to attach the Word file.',
      ),
    )
  }

  const recBadge = (r: HrRecommendation) => {
    const label = recommendationLabel(r, loc)
    if (r === 'SHORTLIST')
      return <Badge className="bg-primary/15 text-primary">{label}</Badge>
    if (r === 'INTERVIEW') return <Badge variant="secondary">{label}</Badge>
    if (r === 'REJECT') return <Badge variant="destructive">{label}</Badge>
    if (r === 'REVIEW')
      return (
        <Badge
          variant="outline"
          className="border-amber-500/40 bg-amber-500/10 text-amber-700"
        >
          {label}
        </Badge>
      )
    return <Badge variant="outline">{label}</Badge>
  }

  if (loading || !session) return <LoadingBlock />
  if (!program || !report) {
    return (
      <PageShell>
        {error ? <ErrorAlert message={error} onRetry={() => void load()} /> : null}
        <EmptyState
          icon={<FileTextIcon />}
          title={tx('Không có chương trình', 'Program not found')}
        />
      </PageShell>
    )
  }

  return (
    <PageShell>
      <PageHeader
        title={tx('Báo cáo HR · Sàng lọc NIC', 'HR report · NIC screening')}
        description={tx(
          'Coi staff NIC như nhân sự: lọc pipeline → shortlist → Word tổng kết → gửi mail mentor/lãnh đạo. AI hỗ trợ, người chốt.',
          'Treat NIC staff as HR: filter pipeline → shortlist → Word summary → email mentors/leadership. AI assists, humans decide.',
        )}
        breadcrumb={
          <Link
            href={`/programs/${programId}/overview`}
            className="hover:text-foreground"
          >
            ← {program.name}
          </Link>
        }
        meta={
          <>
            <Badge variant="secondary" className="gap-1">
              <BriefcaseIcon className="size-3" />
              NIC · HR
            </Badge>
            <Badge variant="outline">
              {report.candidates.length} {tx('trong báo cáo', 'in report')}
            </Badge>
          </>
        }
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCwIcon data-icon="inline-start" />
            {tx('Làm mới', 'Refresh')}
          </Button>
        }
      />

      <Alert className="border-primary/25 bg-primary/5">
        <ClipboardListIcon className="size-4 text-primary" />
        <AlertTitle>
          {tx('Luồng mentor gợi ý', 'Mentor-aligned flow')}
        </AlertTitle>
        <AlertDescription className="text-xs leading-relaxed">
          <strong>1.</strong> {tx('Lọc hồ sơ', 'Filter applications')} →{' '}
          <strong>2.</strong> {tx('Xếp shortlist / interview / hold', 'Rank shortlist / interview / hold')} →{' '}
          <strong>3.</strong> {tx('Tải Word tổng kết', 'Download Word summary')} →{' '}
          <strong>4.</strong>{' '}
          {tx(
            'Gửi mail (mailto) + đính kèm .docx cho mentor / ban giám khảo.',
            'Send mail (mailto) + attach .docx for mentors / jury.',
          )}
        </AlertDescription>
      </Alert>

      {error ? <ErrorAlert message={error} onRetry={() => void load()} /> : null}

      <StatGrid>
        <StatCard
          label={tx('Tổng pipeline', 'Pipeline total')}
          value={report.funnel.total}
          icon={UsersIcon}
        />
        <StatCard
          label="Shortlist"
          value={report.shortlist.length}
          icon={ClipboardListIcon}
          hint={tx('Ưu tiên intro', 'Intro priority')}
        />
        <StatCard
          label={tx('Phỏng vấn', 'Interview')}
          value={report.interview.length}
          icon={BriefcaseIcon}
        />
        <StatCard
          label={tx('Chờ duyệt profile', 'Needs review')}
          value={report.funnel.needsReview}
          icon={FileTextIcon}
        />
      </StatGrid>

      <Section
        title={tx('Bộ lọc báo cáo', 'Report filters')}
        description={tx(
          'Chỉ đưa startup đạt ngưỡng vào Word / mail',
          'Only include startups above the floor in Word / mail',
        )}
        size="sm"
      >
        <Toolbar className="border-0 bg-muted/30 p-2 shadow-none">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] text-muted-foreground">
                {tx('Điểm tối thiểu', 'Min score')}
              </Label>
              <Input
                type="number"
                min={0}
                max={100}
                className="h-9 w-24"
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value) || 0)}
              />
            </div>
            <div className="flex items-center gap-2 pb-2">
              <Checkbox
                id="optin-hr"
                checked={optInOnly}
                onCheckedChange={(v) => setOptInOnly(v === true)}
              />
              <Label htmlFor="optin-hr" className="text-xs font-normal">
                {tx('Chỉ matchingOptIn', 'matchingOptIn only')}
              </Label>
            </div>
            <p className="pb-2 text-xs text-muted-foreground">
              {tx('Hiển thị', 'Showing')}{' '}
              <span className="font-medium text-foreground">
                {report.candidates.length}
              </span>{' '}
              / {apps.length}
            </p>
          </div>
        </Toolbar>
      </Section>

      <Section
        title={tx('Tóm tắt điều hành', 'Executive summary')}
        description={tx('Đoạn này vào đầu file Word + body mail', 'Goes into Word + email body')}
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
          {loc === 'vi' ? report.executiveSummaryVi : report.executiveSummaryEn}
        </p>
      </Section>

      <Section
        title={tx('Bảng shortlist & gợi ý HR', 'Shortlist & HR recommendations')}
        description={tx(
          'Gợi ý tự động từ screening + fit thesis — NIC chốt tay',
          'Auto from screening + thesis fit — NIC confirms manually',
        )}
      >
        {report.candidates.length === 0 ? (
          <EmptyState
            icon={<UsersIcon />}
            title={tx('Chưa có ứng viên trong bộ lọc', 'No candidates in filter')}
            description={tx(
              'Upload hồ sơ, chấm ranking, hoặc hạ min score.',
              'Upload applications, run ranking, or lower min score.',
            )}
            action={
              <Button
                size="sm"
                render={<Link href={`/programs/${programId}/applications`} />}
                nativeButton={false}
              >
                {tx('Mở hồ sơ', 'Open applications')}
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>#</TableHead>
                  <TableHead>Startup</TableHead>
                  <TableHead>{tx('Điểm', 'Score')}</TableHead>
                  <TableHead>{tx('Gợi ý HR', 'HR rec.')}</TableHead>
                  <TableHead className="hidden md:table-cell">
                    {tx('Pipeline', 'Pipeline')}
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">
                    {tx('Ngành / Stage', 'Industry / Stage')}
                  </TableHead>
                  <TableHead className="pr-4 text-right">
                    {tx('Chi tiết', 'Detail')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.candidates.map((c, i) => (
                  <TableRow key={c.applicationId}>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {i + 1}
                    </TableCell>
                    <TableCell className="max-w-[180px]">
                      <p className="truncate font-medium">{c.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {c.fileName || c.applicationId.slice(0, 8)}
                      </p>
                    </TableCell>
                    <TableCell className="tabular-nums font-semibold">
                      {c.screeningScore ?? c.fitScore ?? '—'}
                    </TableCell>
                    <TableCell>{recBadge(c.recommendation)}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <StatusBadge status={String(c.status)} />
                    </TableCell>
                    <TableCell className="hidden max-w-[160px] truncate text-xs text-muted-foreground lg:table-cell">
                      {c.industries} · {c.stage}
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-full"
                        render={<Link href={`/applications/${c.applicationId}`} />}
                        nativeButton={false}
                      >
                        {tx('Mở', 'Open')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section
          title={tx('1. Tải Word tổng kết', '1. Download Word summary')}
          description={tx(
            'File .docx: tóm tắt + shortlist + chi tiết từng startup',
            '.docx: summary + shortlist + per-startup detail',
          )}
        >
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              {tx(
                'Đúng yêu cầu mentor: báo cáo Word gửi theo luồng — tải về rồi đính kèm email.',
                'Matches mentor ask: Word report for the mail workflow — download then attach.',
              )}
            </p>
            <Button
              className="w-fit rounded-full"
              disabled={busyDoc || report.candidates.length === 0}
              onClick={() => void onDownloadDocx()}
            >
              {busyDoc ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <DownloadIcon data-icon="inline-start" />
              )}
              {tx('Tải NIC_Report.docx', 'Download NIC_Report.docx')}
            </Button>
          </div>
        </Section>

        <Section
          title={tx('2. Gửi mail theo luồng', '2. Email workflow')}
          description={tx(
            'Mở mail client với subject + body sẵn — đính kèm Word',
            'Open mail client with subject + body ready — attach Word',
          )}
        >
          <FieldGroup className="gap-3">
            <Field>
              <FieldLabel>
                {tx('Gửi tới (mentor / lãnh đạo)', 'To (mentor / leadership)')}
              </FieldLabel>
              <Input
                type="email"
                placeholder="mentor@nic.gov.vn"
                value={mailTo}
                onChange={(e) => setMailTo(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>{tx('Subject', 'Subject')}</FieldLabel>
              <Input
                readOnly
                value={loc === 'vi' ? report.emailSubjectVi : report.emailSubjectEn}
              />
            </Field>
            <Field>
              <FieldLabel>{tx('Nội dung mail', 'Email body')}</FieldLabel>
              <Textarea
                readOnly
                className="min-h-36 font-mono text-xs"
                value={loc === 'vi' ? report.emailBodyVi : report.emailBodyEn}
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button className="rounded-full" onClick={onOpenMail}>
                <MailIcon data-icon="inline-start" />
                {tx('Mở mail client', 'Open mail client')}
              </Button>
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => void onCopyEmail()}
              >
                <CopyIcon data-icon="inline-start" />
                {tx('Copy nội dung', 'Copy body')}
              </Button>
              <Button
                variant="secondary"
                className="rounded-full"
                disabled={busyDoc}
                onClick={() => void onDownloadDocx()}
              >
                <SendIcon data-icon="inline-start" />
                {tx('Word + Mail', 'Word + Mail')}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {tx(
                'mailto: không đính kèm file tự động (giới hạn trình duyệt). Quy trình chuẩn: Tải Word → Mở mail → đính kèm file → Gửi.',
                'mailto: cannot auto-attach files (browser limit). Standard flow: Download Word → Open mail → attach → Send.',
              )}
            </p>
          </FieldGroup>
        </Section>
      </div>

      <Section
        title={tx('Bước tiếp theo trong hệ thống', 'Next steps in-product')}
        size="sm"
      >
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            render={<Link href={`/programs/${programId}/ranking`} />}
            nativeButton={false}
          >
            {tx('Chấm ranking', 'Run ranking')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            render={<Link href="/matching" />}
            nativeButton={false}
          >
            {tx('Matching giao thoa', 'Cross matching')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            render={<Link href={`/programs/${programId}/applications`} />}
            nativeButton={false}
          >
            {tx('Danh sách hồ sơ', 'Applications')}
          </Button>
        </div>
      </Section>
    </PageShell>
  )
}
