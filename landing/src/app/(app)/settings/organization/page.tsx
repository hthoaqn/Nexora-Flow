'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { RefreshCwIcon, ShieldCheckIcon } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth, maskEmail, orgLabel } from '@/lib/auth/session'
import {
  getOrganizationMe,
  upsertOrganization,
  listPrograms,
  listApplications,
  updateDecision,
  confirmApplication,
  displayName,
} from '@/lib/api/client'
import type { Application, Program } from '@/lib/api/types'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { ErrorAlert } from '@/components/dashboard/ErrorAlert'
import { LoadingBlock } from '@/components/dashboard/LoadingBlock'
import { StatusBadge } from '@/components/dashboard/StatusBadge'
import { PageShell, Section } from '@/components/dashboard/Section'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type PendingRow = { app: Application; program: Program }

export default function OrganizationSettingsPage() {
  const { session } = useAuth()
  const [name, setName] = useState('')
  const [website, setWebsite] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingRow[]>([])
  const [pendingLoading, setPendingLoading] = useState(false)
  const [actingId, setActingId] = useState<string | null>(null)

  const canEdit = session?.role === 'owner' || session?.role === 'admin'
  const canModerate = canEdit

  const load = useCallback(async () => {
    if (!session) return
    setLoading(true)
    const fallback =
      session.organizationId === 'nexora-flow'
        ? 'Nexora Flow'
        : orgLabel(session.organizationId)
    try {
      const org = await getOrganizationMe(session)
      const raw = (org.name || '').trim()
      const looksPersonal =
        raw.split(/\s+/).length >= 2 &&
        !/flow|inc|corp|lab|fund|ventures|studio|org|team|workspace/i.test(raw)
      // Never prefill form with a polluted personal name as org title
      setName(raw && !looksPersonal ? raw : fallback)
      setWebsite(org.website || '')
      setDescription(org.description || '')
    } catch {
      setName(fallback)
    } finally {
      setLoading(false)
    }
  }, [session])

  const loadPending = useCallback(async () => {
    if (!session || !canModerate) return
    setPendingLoading(true)
    try {
      const page = await listPrograms(session, { limit: 50 })
      const programs = page.items || []
      const rows: PendingRow[] = []
      await Promise.all(
        programs.map(async (p) => {
          try {
            const apps = await listApplications(session, p.id, {
              status: 'NEEDS_REVIEW',
              limit: 50,
            })
            ;(apps.items || []).forEach((app) => rows.push({ app, program: p }))
          } catch {
            /* skip */
          }
        }),
      )
      setPending(rows)
    } catch {
      setPending([])
    } finally {
      setPendingLoading(false)
    }
  }, [session, canModerate])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void loadPending()
  }, [loadPending])

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session || !canEdit) {
      setError('Không có quyền')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await upsertOrganization(session, { name, website, description })
      toast.success('Đã lưu')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi')
    } finally {
      setSaving(false)
    }
  }

  const moderate = async (row: PendingRow, action: 'approve' | 'reject') => {
    if (!session) return
    setActingId(row.app.id)
    try {
      const label = displayName(row.app)
      const nameGuess =
        label && !label.startsWith(row.app.id.slice(0, 6))
          ? label
          : row.app.fileMetadata?.fileName?.replace(/\.pdf$/i, '') || 'Startup'
      await confirmApplication(session, row.app.id, {
        confirmedProfile: {
          startupName: nameGuess,
          industry: row.program.priorityIndustries?.[0]
            ? [row.program.priorityIndustries[0]]
            : ['General'],
          stage: row.program.acceptedStages?.[0] || 'MVP',
        },
        matchingOptIn: !!row.app.matchingOptIn,
        consentPolicyVersion: 'nexora-consent-v1',
      })
      if (action === 'reject') {
        await updateDecision(session, row.app.id, {
          status: 'REJECTED',
          reason: 'Admin từ chối',
        })
        toast.success('Đã từ chối')
      } else {
        toast.success('Đã duyệt')
      }
      setPending((prev) => prev.filter((r) => r.app.id !== row.app.id))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi')
    } finally {
      setActingId(null)
    }
  }

  if (loading || !session) return <LoadingBlock />

  return (
    <PageShell>
      <PageHeader
        title="Tổ chức"
        description="Thông tin workspace và kiểm duyệt hồ sơ mới."
        meta={
          <>
            <Badge variant="secondary">{session.role}</Badge>
            <Badge variant="outline">{orgLabel(session.organizationId)}</Badge>
          </>
        }
        actions={
          canEdit ? (
            <Button size="sm" type="submit" form="org-form" disabled={saving}>
              {saving ? <Spinner data-icon="inline-start" /> : null}
              Lưu
            </Button>
          ) : null
        }
      />

      {error ? <ErrorAlert message={error} /> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Hồ sơ" description="Tên hiển thị trong workspace">
          <form id="org-form" onSubmit={onSave}>
            <FieldGroup className="gap-3">
              <Field>
                <FieldLabel>Tên tổ chức</FieldLabel>
                <Input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!canEdit}
                />
              </Field>
              <Field>
                <FieldLabel>Website</FieldLabel>
                <Input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://"
                  disabled={!canEdit}
                />
              </Field>
              <Field>
                <FieldLabel>Mô tả</FieldLabel>
                <Textarea
                  className="min-h-20"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={!canEdit}
                />
              </Field>
            </FieldGroup>
          </form>
        </Section>

        <Section title="Phiên đăng nhập" description="Thông tin tối thiểu — không lộ ID nội bộ">
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between gap-3 rounded-lg border px-3 py-2">
              <span className="text-muted-foreground">Tên</span>
              <span className="font-medium">{session.displayName || '—'}</span>
            </div>
            <div className="flex justify-between gap-3 rounded-lg border px-3 py-2">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">{maskEmail(session.email)}</span>
            </div>
            <div className="flex justify-between gap-3 rounded-lg border px-3 py-2">
              <span className="text-muted-foreground">Vai trò</span>
              <Badge variant="outline">{session.role}</Badge>
            </div>
            <div className="flex justify-between gap-3 rounded-lg border px-3 py-2">
              <span className="text-muted-foreground">Workspace</span>
              <span className="font-medium">{orgLabel(session.organizationId)}</span>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Workspace gắn lúc đăng nhập (mã workspace / domain). Không đổi được từ trình duyệt —
            liên hệ admin nếu cần chuyển đơn vị.
          </p>
        </Section>
      </div>

      {canModerate ? (
        <Section
          title="Kiểm duyệt hồ sơ mới"
          description="Startup nộp qua link public thường ở NEEDS_REVIEW — duyệt trước khi chấm."
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => void loadPending()}
              disabled={pendingLoading}
            >
              {pendingLoading ? <Spinner data-icon="inline-start" /> : <RefreshCwIcon data-icon="inline-start" />}
              Làm mới
            </Button>
          }
        >
          <div className="mb-3">
            <Badge variant={pending.length ? 'default' : 'secondary'}>
              {pending.length} chờ duyệt
            </Badge>
          </div>
          {pendingLoading ? (
            <LoadingBlock label="Đang tải…" />
          ) : pending.length === 0 ? (
            <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              <ShieldCheckIcon className="mx-auto mb-2 size-5 text-primary" />
              Không có hồ sơ chờ duyệt.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hồ sơ</TableHead>
                    <TableHead>Chương trình</TableHead>
                    <TableHead>TT</TableHead>
                    <TableHead className="text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pending.map(({ app, program }) => (
                    <TableRow key={app.id}>
                      <TableCell className="max-w-[160px]">
                        <p className="truncate font-medium">{displayName(app)}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {app.fileMetadata?.fileName || 'Deck'}
                        </p>
                      </TableCell>
                      <TableCell className="max-w-[120px] truncate text-sm">
                        {program.name}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={app.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            disabled={actingId === app.id}
                            onClick={() => void moderate({ app, program }, 'approve')}
                          >
                            Duyệt
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={actingId === app.id}
                            onClick={() => void moderate({ app, program }, 'reject')}
                          >
                            Từ chối
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            render={<Link href={`/applications/${app.id}`} />}
                            nativeButton={false}
                          >
                            Mở
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Section>
      ) : null}
    </PageShell>
  )
}
