'use client'

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

function parseList(value: string): string[] {
  return value
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export default function ProgramSettingsPage() {
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
      setError(e instanceof Error ? e.message : 'Lỗi')
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
      setError('Không có quyền')
      return
    }
    if (Object.keys(criteria).length && Math.round(weightTotal) !== 100) {
      setError(`Rubric phải = 100 (hiện ${weightTotal})`)
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
      toast.success('Đã lưu')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingBlock />

  return (
    <PageShell>
      <PageHeader
        title="Cài đặt chương trình"
        description="Cập nhật thông tin, hard filters và rubric."
        meta={
          <Badge variant={Math.round(weightTotal) === 100 || !Object.keys(criteria).length ? 'default' : 'destructive'}>
            Rubric {weightTotal || 0}
          </Badge>
        }
        actions={
          <Button size="sm" type="submit" form="prog-settings" disabled={saving}>
            {saving ? <Spinner data-icon="inline-start" /> : null}
            Lưu thay đổi
          </Button>
        }
      />
      {error ? <ErrorAlert message={error} /> : null}

      <form id="prog-settings" onSubmit={onSave}>
        <SplitGrid>
          <Section title="Thông tin" description="Metadata & filters">
            <FieldGroup className="gap-3">
              <Field>
                <FieldLabel>Tên</FieldLabel>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </Field>
              <Field>
                <FieldLabel>Mục tiêu</FieldLabel>
                <Textarea
                  className="min-h-20"
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  required
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel>Trạng thái</FieldLabel>
                  <Select value={status} onValueChange={(v) => v && setStatus(v as ProgramStatus)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="DRAFT">Nháp</SelectItem>
                        <SelectItem value="OPEN">Mở</SelectItem>
                        <SelectItem value="CLOSED">Đóng</SelectItem>
                        <SelectItem value="ARCHIVED">Lưu trữ</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>Chỉ tiêu</FieldLabel>
                  <Input
                    type="number"
                    value={expected}
                    onChange={(e) => setExpected(Number(e.target.value) || 1)}
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel>Ngành</FieldLabel>
                <Input value={industries} onChange={(e) => setIndustries(e.target.value)} />
                <FieldDescription>Phân tách bằng dấu phẩy</FieldDescription>
              </Field>
              <Field>
                <FieldLabel>Giai đoạn</FieldLabel>
                <Input value={stages} onChange={(e) => setStages(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel>Địa bàn</FieldLabel>
                <Input value={locations} onChange={(e) => setLocations(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel>Trường bắt buộc</FieldLabel>
                <Input value={requiredFields} onChange={(e) => setRequiredFields(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel>Mô tả</FieldLabel>
                <Textarea
                  className="min-h-16"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </Field>
            </FieldGroup>
          </Section>

          <Section
            title="Rubric"
            description="Tổng weight = 100"
            action={
              <Badge variant={Math.round(weightTotal) === 100 ? 'default' : 'destructive'}>
                {weightTotal}
              </Badge>
            }
          >
            <div className="flex flex-col gap-2">
              {Object.entries(criteria).map(([key, c]) => (
                <div
                  key={key}
                  className="grid grid-cols-[1fr_5rem] items-center gap-2 rounded-lg border bg-muted/20 p-2"
                >
                  <Input
                    className="h-8"
                    value={c.name}
                    onChange={(e) =>
                      setCriteria((prev) => ({
                        ...prev,
                        [key]: { ...prev[key], name: e.target.value },
                      }))
                    }
                  />
                  <Input
                    className="h-8"
                    type="number"
                    value={c.weight}
                    onChange={(e) =>
                      setCriteria((prev) => ({
                        ...prev,
                        [key]: { ...prev[key], weight: Number(e.target.value) },
                      }))
                    }
                  />
                </div>
              ))}
              {!Object.keys(criteria).length ? (
                <p className="text-sm text-muted-foreground">Chưa có criteria.</p>
              ) : null}
            </div>
          </Section>
        </SplitGrid>
      </form>
    </PageShell>
  )
}
