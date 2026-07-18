'use client'

import { useTx } from '@/lib/tx'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth/session'
import { getProgram, updateProgram } from '@/lib/api/client'
import type { Program, ProgramStatus, RubricCriterion } from '@/lib/api/types'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { ErrorAlert } from '@/components/dashboard/ErrorAlert'
import { LoadingBlock } from '@/components/dashboard/LoadingBlock'
import { PageShell, Section, SplitGrid } from '@/components/dashboard/Section'
import { Button } from '@/components/ui/button'
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
import { Badge } from '@/components/ui/badge'
import { Field, FieldGroup, FieldLabel, FieldDescription } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { RubricEditor } from '@/components/dashboard/RubricEditor'

function parseList(value: string): string[] {
  return value
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export default function ProgramSettingsPage() {
  const { tx } = useTx()
  const { session } = useAuth()
  const params = useParams()
  const programId = String(params?.programId ?? "")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [objective, setObjective] = useState('')
  const [description, setDescription] = useState('')
  const [industries, setIndustries] = useState('')
  const [stages, setStages] = useState('')
  const [locations, setLocations] = useState('')
  const [requiredFields, setRequiredFields] = useState('')
  const [expected, setExpected] = useState(10)
  const [status, setStatus] = useState<ProgramStatus>('DRAFT')
  const [criteria, setCriteria] = useState<Record<string, RubricCriterion>>({})

  const weightTotal = useMemo(
    () => Object.values(criteria).reduce((s, c) => s + (Number(c.weight) || 0), 0),
    [criteria],
  )

  const load = useCallback(async () => {
    if (!session) return
    setLoading(true)
    try {
      const p: Program = await getProgram(session, programId)
      setName(p.name)
      setObjective(p.objective)
      setDescription(p.description || '')
      setIndustries((p.priorityIndustries || []).join(', '))
      setStages((p.acceptedStages || []).join(', '))
      setLocations((p.locations || []).join(', '))
      setRequiredFields((p.requiredFields || []).join(', '))
      setExpected(p.expectedSelections || 10)
      setStatus(p.status)
      setCriteria(p.rubric?.criteria || {})
    } catch (e) {
      setError(e instanceof Error ? e.message : tx('Lỗi', 'Error'))
    } finally {
      setLoading(false)
    }
  }, [session, programId])

  useEffect(() => {
    void load()
  }, [load])

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session || session.role === 'reviewer') {
      setError(tx('Không có quyền', 'No permission'))
      return
    }
    if (Object.keys(criteria).length && Math.round(weightTotal) !== 100) {
      setError(tx(`Rubric phải = 100 (hiện ${weightTotal})`, `Rubric weights must total 100 (currently ${weightTotal})`))
      return
    }
    setSaving(true)
    setError(null)
    try {
      const industryList = parseList(industries)
      const stageList = parseList(stages)
      const locationList = parseList(locations)
      await updateProgram(session, programId, {
        name,
        objective,
        description,
        priorityIndustries: industryList,
        acceptedStages: stageList,
        locations: locationList,
        hardFilters: {
          allowedIndustries: industryList,
          allowedStages: stageList,
          allowedLocations: locationList,
        },
        requiredFields: parseList(requiredFields),
        expectedSelections: expected,
        status,
        rubric: Object.keys(criteria).length
          ? { version: 'startup-screening-v1', criteria }
          : undefined,
      })
      toast.success(tx('Đã lưu', 'Saved'))
    } catch (err) {
      setError(err instanceof Error ? err.message : tx('Lỗi', 'Error'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingBlock />

  return (
    <PageShell>
      <PageHeader
        title={tx('Cài đặt chương trình', 'Program settings')}
        description={tx('Cập nhật thông tin, hard filters và rubric.', 'Update details, hard filters, and the rubric.')}
        meta={
          <Badge variant={Math.round(weightTotal) === 100 || !Object.keys(criteria).length ? 'default' : 'destructive'}>
            Rubric {weightTotal || 0}
          </Badge>
        }
        actions={
          <Button size="sm" type="submit" form="prog-settings" disabled={saving}>
            {saving ? <Spinner data-icon="inline-start" /> : null}
            {tx('Lưu thay đổi', 'Save changes')}
          </Button>
        }
      />
      {error ? <ErrorAlert message={error} /> : null}

      <form id="prog-settings" onSubmit={onSave}>
        <SplitGrid>
          <Section title={tx('Thông tin', 'Details')} description="Metadata & filters">
            <FieldGroup className="gap-3">
              <Field>
                <FieldLabel>{tx('Tên', 'Name')}</FieldLabel>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </Field>
              <Field>
                <FieldLabel>{tx('Mục tiêu', 'Objective')}</FieldLabel>
                <Textarea
                  className="min-h-20"
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  required
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel>{tx('Trạng thái', 'Status')}</FieldLabel>
                  <Select value={status} onValueChange={(v) => v && setStatus(v as ProgramStatus)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="DRAFT">{tx('Nháp', 'Draft')}</SelectItem>
                        <SelectItem value="OPEN">{tx('Mở', 'Open')}</SelectItem>
                        <SelectItem value="CLOSED">{tx('Đóng', 'Closed')}</SelectItem>
                        <SelectItem value="ARCHIVED">{tx('Lưu trữ', 'Archived')}</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>{tx('Chỉ tiêu', 'Quota')}</FieldLabel>
                  <Input
                    type="number"
                    value={expected}
                    onChange={(e) => setExpected(Number(e.target.value) || 1)}
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel>{tx('Ngành', 'Sectors')}</FieldLabel>
                <Input value={industries} onChange={(e) => setIndustries(e.target.value)} />
                <FieldDescription>{tx('Phân tách bằng dấu phẩy', 'Comma-separated')}</FieldDescription>
              </Field>
              <Field>
                <FieldLabel>{tx('Giai đoạn', 'Stages')}</FieldLabel>
                <Input value={stages} onChange={(e) => setStages(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel>{tx('Địa bàn', 'Regions')}</FieldLabel>
                <Input value={locations} onChange={(e) => setLocations(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel>{tx('Trường bắt buộc', 'Required fields')}</FieldLabel>
                <Input value={requiredFields} onChange={(e) => setRequiredFields(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel>{tx('Mô tả', 'Description')}</FieldLabel>
                <Textarea
                  className="min-h-16"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </Field>
            </FieldGroup>
          </Section>

          <Section
            title={tx('Rubric chấm điểm', 'Scoring rubric')}
            description={tx('Thêm chỉ tiêu · tổng weight = 100', 'Add criteria · weights total 100')}
            action={
              <Badge variant={Math.round(weightTotal) === 100 ? 'default' : 'destructive'}>
                {weightTotal}
              </Badge>
            }
          >
            <RubricEditor criteria={criteria} onChange={setCriteria} />
          </Section>
        </SplitGrid>
      </form>
    </PageShell>
  )
}
