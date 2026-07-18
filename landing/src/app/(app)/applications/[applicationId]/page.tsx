'use client'

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
  PROFILE_FIELD_LABELS,
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
      setDecisionStatus(DECISION_STATUSES.includes(data.status) ? data.status : 'SHORTLISTED')
      const base: Record<string, string> = {}
      const src = data.confirmedProfile || data.submittedProfile || {}
      for (const key of PROFILE_KEYS) {
        if (src[key] != null) base[key] = formatValue(src[key])
        else if (data.aiProfile?.[key]) base[key] = extractAiValue(data.aiProfile[key]).value
        else base[key] = ''
      }
      setConfirmed(base)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi')
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
      toast.success('Đã xác nhận')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi')
    } finally {
      setSaving(false)
    }
  }

  const runDecision = async () => {
    if (!session) return
    setSaving(true)
    try {
      setApp(
        await updateDecision(session, applicationId, {
          status: decisionStatus,
          reason: decisionReason,
          internalNotes: notes,
        }),
      )
      toast.success('Đã ghi quyết định')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi')
    } finally {
      setSaving(false)
      setConfirmOpen(false)
    }
  }

  if (loading) return <LoadingBlock />
  if (!app) return <ErrorAlert message={error || 'Không tìm thấy'} onRetry={load} />

  const aiKeys = Object.keys(app.aiProfile || {}).filter((k) => k !== 'missingFields')

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={displayName(app)}
        description="Xác nhận profile · đối chiếu AI · ghi quyết định"
        breadcrumb={
          app.programId ? (
            <Link
              href={`/programs/${app.programId}/applications`}
              className="hover:text-foreground"
            >
              ← Danh sách hồ sơ
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
            Thiếu dữ liệu ({missing.length})
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
          <TabsTrigger value="confirm">Xác nhận</TabsTrigger>
          <TabsTrigger value="layers">3 lớp dữ liệu</TabsTrigger>
          <TabsTrigger value="notes">Ghi chú</TabsTrigger>
          <TabsTrigger value="decision">Quyết định</TabsTrigger>
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
                      Cho phép matching sau này
                    </Label>
                  </div>
                </Field>
              </FieldGroup>
              <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
                <Button size="sm" disabled={saving} onClick={() => void onConfirm()}>
                  {saving ? <Spinner data-icon="inline-start" /> : null}
                  Xác nhận profile
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="layers" className="mt-3">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {[
              { title: 'Startup nộp', data: app.submittedProfile },
              { title: 'AI extract', data: null as null },
              { title: 'Đã xác nhận', data: app.confirmedProfile },
            ].map((col) => (
              <Card key={col.title} size="sm">
                <CardContent className="pt-0">
                  <p className="mb-2 font-heading text-sm font-semibold">{col.title}</p>
                  <div className="flex max-h-80 flex-col gap-2 overflow-y-auto text-xs">
                    {col.title === 'AI extract' ? (
                      aiKeys.length === 0 ? (
                        <p className="text-muted-foreground">Chưa có AI profile</p>
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
                placeholder="Ghi chú nội bộ cho reviewer…"
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
                    toast.success('Đã lưu')
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : 'Lỗi')
                  } finally {
                    setSaving(false)
                  }
                }}
              >
                Lưu ghi chú
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="decision" className="mt-3">
          <Card className="max-w-xl">
            <CardContent className="flex flex-col gap-3 pt-0">
              <FieldGroup className="gap-3">
                <Field>
                  <FieldLabel>Trạng thái quyết định</FieldLabel>
                  <Select
                    value={decisionStatus}
                    onValueChange={(v) => v && setDecisionStatus(v as ApplicationStatus)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {DECISION_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {APP_STATUS_LABEL[s]}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>Lý do</FieldLabel>
                  <Textarea
                    className="min-h-20"
                    value={decisionReason}
                    onChange={(e) => setDecisionReason(e.target.value)}
                    placeholder="Lý do shortlist / reject…"
                  />
                </Field>
              </FieldGroup>
              <div className="flex flex-wrap gap-2 border-t pt-3">
                <Button
                  size="sm"
                  disabled={saving}
                  onClick={() => {
                    if (['ACCEPTED', 'REJECTED', 'ARCHIVED'].includes(decisionStatus)) {
                      setConfirmOpen(true)
                    } else void runDecision()
                  }}
                >
                  Ghi quyết định
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
                  Bật matching
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận quyết định?</AlertDialogTitle>
            <AlertDialogDescription>
              Chuyển sang {APP_STATUS_LABEL[decisionStatus] || decisionStatus}. Hành động này được
              ghi audit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={() => void runDecision()}>Xác nhận</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
