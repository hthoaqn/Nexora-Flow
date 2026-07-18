'use client'

import { useTx } from '@/lib/tx'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth/session'
import {
  getApplication,
  confirmApplication,
  updateWorkspace,
  updateDecision,
  updateConsent,
  displayName,
} from '@/lib/api/client'
import type { Application, ApplicationStatus, ExtractedField, ProfileValues } from '@/lib/api/types'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { ErrorAlert } from '@/components/dashboard/ErrorAlert'
import { LoadingBlock } from '@/components/dashboard/LoadingBlock'
import { StatusBadge } from '@/components/dashboard/StatusBadge'
import { AiDisclosure } from '@/components/dashboard/AiDisclosure'
import { ConfidenceIndicator } from '@/components/dashboard/ScoreBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Spinner } from '@/components/ui/spinner'
import {
  APP_STATUS_LABEL,
  DECISION_STATUSES,
  HUMAN_REVIEW_STATUSES,
  PROFILE_FIELD_LABELS,
  pathToDecisionStatus,
  reachableDecisionTargets,
  isHumanReviewStatus,
} from '@/lib/status'

function fieldLabel(key: string) {
  return PROFILE_FIELD_LABELS[key] || key
}

function formatValue(v: unknown): string {
  if (v == null) return ''
  if (Array.isArray(v)) return v.join(', ')
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

function extractAiValue(field: unknown): {
  value: string
  confidence?: number
  evidence?: unknown[]
} {
  if (field == null) return { value: '' }
  if (typeof field === 'object' && !Array.isArray(field) && 'value' in (field as object)) {
    const f = field as ExtractedField
    return {
      value: formatValue(f.value),
      confidence: f.confidence,
      evidence: f.evidence,
    }
  }
  return { value: formatValue(field) }
}

const PROFILE_KEYS = [
  'startupName',
  'companyName',
  'contactEmail',
  'website',
  'industry',
  'stage',
  'location',
  'problem',
  'solution',
  'product',
  'team',
  'fundingNeed',
]

export default function ApplicationDetailPage() {
  const { tx } = useTx()
  const { session } = useAuth()
  const params = useParams()
  const applicationId = String(params?.applicationId ?? '')

  const [app, setApp] = useState<Application | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmed, setConfirmed] = useState<Record<string, string>>({})
  const [matchingOptIn, setMatchingOptIn] = useState(false)
  const [notes, setNotes] = useState('')
  const [decisionStatus, setDecisionStatus] = useState<ApplicationStatus>('SHORTLISTED')
  const [decisionReason, setDecisionReason] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)

  const load = useCallback(async () => {
    if (!session) return
    setLoading(true)
    try {
      const data = await getApplication(session, applicationId)
      setApp(data)
      setMatchingOptIn(!!data.matchingOptIn)
      setNotes(data.internalNotes || '')
      setDecisionStatus(
        isHumanReviewStatus(data.status) ? data.status : 'SHORTLISTED',
      )
      const base: Record<string, string> = {}
      const src = data.confirmedProfile || data.submittedProfile || {}
      for (const key of PROFILE_KEYS) {
        if (src[key] != null) base[key] = formatValue(src[key])
        else if (data.aiProfile?.[key]) base[key] = extractAiValue(data.aiProfile[key]).value
        else base[key] = ''
      }
      setConfirmed(base)
    } catch (e) {
      setError(e instanceof Error ? e.message : tx('Lỗi', 'Error'))
    } finally {
      setLoading(false)
    }
  }, [session, applicationId])

  useEffect(() => {
    void load()
  }, [load])

  const missing = useMemo(
    () => (app?.aiProfile?.missingFields as string[] | undefined) || [],
    [app],
  )

  const onConfirm = async () => {
    if (!session || !app) return
    setSaving(true)
    try {
      const profile: ProfileValues = {}
      Object.entries(confirmed).forEach(([k, v]) => {
        if (!v.trim()) return
        if (k === 'industry')
          profile[k] = v
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        else profile[k] = v.trim()
      })
      setApp(
        await confirmApplication(session, applicationId, {
          confirmedProfile: profile,
          matchingOptIn,
          consentPolicyVersion: 'nexora-consent-v1',
        }),
      )
      toast.success(tx('Đã xác nhận', 'Confirmed'))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tx('Lỗi', 'Error'))
    } finally {
      setSaving(false)
    }
  }

  const runDecision = async (targetOverride?: ApplicationStatus) => {
    if (!session || !app) return
    const target = targetOverride || decisionStatus
    setSaving(true)
    try {
      // Multi-hop is handled inside updateDecision (client.ts) so every caller is safe.
      // Example: ELIGIBLE → SHORTLISTED → ACCEPTED (never PATCH ACCEPTED while still ELIGIBLE).
      const hops = pathToDecisionStatus(app.status, target)
      if (hops && hops.length > 1) {
        toast.message(
          tx(
            `Đang áp dụng: ${[app.status, ...hops].join(' → ')}…`,
            `Applying: ${[app.status, ...hops].join(' → ')}…`,
          ),
        )
      }
      const updated = await updateDecision(session, applicationId, {
        status: target,
        reason: decisionReason,
        internalNotes: notes,
      })
      setApp(updated)
      const next = String(updated.status || target).toUpperCase() as ApplicationStatus
      if (DECISION_STATUSES.includes(next)) setDecisionStatus(next)
      toast.success(
        tx(
          `Đã ghi: ${APP_STATUS_LABEL[updated.status as ApplicationStatus] || updated.status}`,
          `Recorded: ${updated.status}`,
        ),
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tx('Lỗi', 'Error'))
    } finally {
      setSaving(false)
      setConfirmOpen(false)
    }
  }

  if (loading) return <LoadingBlock />
  if (!app) return <ErrorAlert message={error || tx('Không tìm thấy', 'Not found')} onRetry={load} />

  const aiKeys = Object.keys(app.aiProfile || {}).filter((k) => k !== 'missingFields')
  const decisionOptions = reachableDecisionTargets(app.status)
  // Keep current selection valid when status changes
  const selectValue = decisionOptions.includes(decisionStatus)
    ? decisionStatus
    : decisionOptions[0] || 'SHORTLISTED'

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={displayName(app)}
        description={tx(
          'Xác nhận hồ sơ, đối chiếu trích xuất, ghi quyết định',
          'Confirm profile, review extraction, record decision',
        )}
        breadcrumb={
          app.programId ? (
            <Link
              href={`/programs/${app.programId}/applications`}
              className="hover:text-foreground"
            >
              ← {tx('Danh sách hồ sơ', 'All applications')}
            </Link>
          ) : null
        }
        meta={
          <>
            <StatusBadge status={app.status} />
            <Badge variant={app.matchingOptIn ? 'default' : 'outline'}>
              Matching {app.matchingOptIn ? 'on' : 'off'}
            </Badge>
            {app.source ? (
              <Badge variant="secondary" className="text-[10px]">
                {app.source.replace(/_/g, ' ')}
              </Badge>
            ) : null}
          </>
        }
      />
      <AiDisclosure />
      {error ? <ErrorAlert message={error} /> : null}
      {missing.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 rounded-xl border border-dashed bg-muted/20 p-3">
          <span className="w-full text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {tx('Thiếu dữ liệu', 'Missing data')} ({missing.length})
          </span>
          {missing.map((m) => (
            <Badge key={m} variant="outline" className="text-[10px]">
              {fieldLabel(m)}
            </Badge>
          ))}
        </div>
      ) : null}

      <Tabs defaultValue="confirm">
        <TabsList className="h-9 w-full justify-start overflow-x-auto">
          <TabsTrigger value="confirm">{tx('Xác nhận', 'Confirm')}</TabsTrigger>
          <TabsTrigger value="layers">{tx('3 lớp dữ liệu', '3 data layers')}</TabsTrigger>
          <TabsTrigger value="notes">{tx('Ghi chú', 'Notes')}</TabsTrigger>
          <TabsTrigger value="decision">{tx('Quyết định', 'Decision')}</TabsTrigger>
        </TabsList>

        <TabsContent value="confirm" className="mt-3">
          <Card>
            <CardContent className="pt-0">
              <FieldGroup className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {Object.keys(confirmed).map((key) => (
                  <Field key={key}>
                    <FieldLabel className="text-xs">{fieldLabel(key)}</FieldLabel>
                    <Input
                      value={confirmed[key]}
                      onChange={(e) => setConfirmed((p) => ({ ...p, [key]: e.target.value }))}
                    />
                  </Field>
                ))}
                <Field orientation="horizontal" className="sm:col-span-2">
                  <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
                    <Checkbox
                      id="optin"
                      checked={matchingOptIn}
                      onCheckedChange={(v) => setMatchingOptIn(v === true)}
                    />
                    <Label htmlFor="optin" className="text-sm font-normal">
                      {tx(
                        'Cho phép so khớp sau này',
                        'Allow future matching',
                      )}
                    </Label>
                  </div>
                </Field>
              </FieldGroup>
              <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
                <Button size="sm" disabled={saving} onClick={() => void onConfirm()}>
                  {saving ? <Spinner data-icon="inline-start" /> : null}
                  {tx('Xác nhận hồ sơ', 'Confirm profile')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="layers" className="mt-3">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {[
              { title: tx('Startup nộp', 'Submitted by startup'), data: app.submittedProfile },
              { title: 'AI extract', data: null as null },
              { title: tx('Đã xác nhận', 'Confirmed'), data: app.confirmedProfile },
            ].map((col) => (
              <Card key={col.title} size="sm">
                <CardContent className="pt-0">
                  <p className="mb-2 font-heading text-sm font-semibold">{col.title}</p>
                  <div className="flex max-h-80 flex-col gap-2 overflow-y-auto text-xs">
                    {col.title === 'AI extract' ? (
                      aiKeys.length === 0 ? (
                        <p className="text-muted-foreground">
                          {tx(
                            'Chưa có hồ sơ trích xuất',
                            'No extraction profile yet',
                          )}
                        </p>
                      ) : (
                        aiKeys.map((k) => {
                          const { value, confidence } = extractAiValue(app.aiProfile?.[k])
                          return (
                            <div
                              key={k}
                              className="rounded-lg border bg-muted/20 px-2.5 py-2"
                            >
                              <div className="mb-0.5 flex justify-between gap-1">
                                <span className="font-medium text-muted-foreground">
                                  {fieldLabel(k)}
                                </span>
                                <ConfidenceIndicator confidence={confidence} />
                              </div>
                              <p className="line-clamp-3">{value || '—'}</p>
                            </div>
                          )
                        })
                      )
                    ) : Object.entries(col.data || {}).length === 0 ? (
                      <p className="text-muted-foreground">—</p>
                    ) : (
                      Object.entries(col.data || {}).map(([k, v]) => (
                        <div key={k} className="rounded-lg border bg-muted/20 px-2.5 py-2">
                          <p className="mb-0.5 font-medium text-muted-foreground">
                            {fieldLabel(k)}
                          </p>
                          <p className="line-clamp-3 break-words">{formatValue(v) || '—'}</p>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="notes" className="mt-3">
          <Card>
            <CardContent className="flex flex-col gap-3 pt-0">
              <Textarea
                className="min-h-32"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={tx(
                  'Ghi chú nội bộ cho người duyệt…',
                  'Internal notes for reviewers…',
                )}
              />
              <Button
                size="sm"
                className="w-fit"
                disabled={saving}
                onClick={async () => {
                  if (!session) return
                  setSaving(true)
                  try {
                    setApp(
                      await updateWorkspace(session, applicationId, {
                        internalNotes: notes,
                      }),
                    )
                    toast.success(tx('Đã lưu', 'Saved'))
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : tx('Lỗi', 'Error'))
                  } finally {
                    setSaving(false)
                  }
                }}
              >
                {tx('Lưu ghi chú', 'Save notes')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="decision" className="mt-3">
          <Card className="max-w-xl">
            <CardContent className="flex flex-col gap-3 pt-0">
              {['ELIGIBLE', 'NEEDS_REVIEW', 'RECEIVED', 'EXTRACTING'].includes(
                String(app.status || '').toUpperCase(),
              ) ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-xs leading-relaxed text-amber-900 dark:text-amber-100">
                  <p className="font-semibold">
                    {tx(
                      'Chưa thể shortlist / chấp nhận từ trạng thái này',
                      'Cannot shortlist or accept from this status yet',
                    )}
                  </p>
                  <p className="mt-1">
                    {tx(
                      'Hiện tại: Sẵn sàng chấm. Hãy vào Xếp hạng của chương trình → chạy chấm (AI) đến Đã chấm, rồi quay lại đây chọn Danh sách rút gọn / Được chọn. Tạm thời chỉ có thể Từ chối hoặc Lưu trữ.',
                      'Current: Eligible. Open the program Ranking page → run scoring until Scored, then return here for Shortlist / Accepted. For now you can only Reject or Archive.',
                    )}
                  </p>
                  {app.programId ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 h-9 w-full rounded-full sm:w-auto"
                      render={
                        <Link href={`/programs/${app.programId}/ranking`} />
                      }
                      nativeButton={false}
                    >
                      {tx('Mở trang Xếp hạng', 'Open Ranking')}
                    </Button>
                  ) : null}
                </div>
              ) : null}
              <FieldGroup className="gap-3">
                <Field>
                  <FieldLabel>
                    {tx('Trạng thái quyết định', 'Decision status')}
                  </FieldLabel>
                  <Select
                    value={selectValue}
                    onValueChange={(v) =>
                      v && setDecisionStatus(v as ApplicationStatus)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue
                        placeholder={tx('Chọn trạng thái', 'Choose status')}
                      >
                        {APP_STATUS_LABEL[selectValue] || selectValue}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {(decisionOptions.length
                          ? decisionOptions
                          : HUMAN_REVIEW_STATUSES
                        ).map((s) => (
                          <SelectItem key={s} value={s}>
                            {APP_STATUS_LABEL[s] || s}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    {tx(
                      `Hiện tại: ${APP_STATUS_LABEL[app.status as ApplicationStatus] || app.status}. Chỉ gửi trạng thái thẩm định con người (shortlist, phỏng vấn, chấp nhận, từ chối, lưu trữ).`,
                      `Current: ${app.status}. Only human-review states (shortlist, interview, accept, reject, archive).`,
                    )}
                  </p>
                </Field>
                <Field>
                  <FieldLabel>{tx('Lý do', 'Reason')}</FieldLabel>
                  <Textarea
                    className="min-h-20"
                    value={decisionReason}
                    onChange={(e) => setDecisionReason(e.target.value)}
                    placeholder={tx(
                      'Lý do shortlist / từ chối…',
                      'Reason for shortlist / reject…',
                    )}
                  />
                </Field>
              </FieldGroup>
              <div className="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:flex-wrap">
                <Button
                  size="sm"
                  className="h-10 w-full rounded-full sm:h-9 sm:w-auto"
                  disabled={saving || !decisionOptions.length}
                  onClick={() => {
                    const target = selectValue
                    setDecisionStatus(target)
                    if (['ACCEPTED', 'REJECTED', 'ARCHIVED'].includes(target)) {
                      setConfirmOpen(true)
                    } else void runDecision(target)
                  }}
                >
                  {tx('Ghi quyết định', 'Record decision')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={saving || !!app.matchingOptIn}
                  onClick={async () => {
                    if (!session) return
                    setApp(
                      await updateConsent(session, applicationId, {
                        matchingOptIn: true,
                        policyVersion: 'nexora-consent-v1',
                      }),
                    )
                    setMatchingOptIn(true)
                    toast.success('Matching on')
                  }}
                >
                  {tx('Bật so khớp', 'Enable matching')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tx('Xác nhận quyết định?', 'Confirm decision?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {tx('Chuyển sang', 'Move to')}{' '}
              {APP_STATUS_LABEL[selectValue] || selectValue}.{' '}
              {tx(
                'Hành động này được ghi nhật ký. Các bước trung gian hợp lệ sẽ được áp dụng tự động.',
                'This action is audited. Valid intermediate steps are applied automatically.',
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tx('Hủy', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void runDecision(selectValue)}>
              {tx('Xác nhận', 'Confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
