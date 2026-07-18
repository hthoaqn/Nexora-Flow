'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth/session'
import { createProgram } from '@/lib/api/client'
import type { ProgramStatus, RubricCriterion } from '@/lib/api/types'
import { DEFAULT_REQUIRED_FIELDS, DEFAULT_RUBRIC_CRITERIA } from '@/lib/status'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { ErrorAlert } from '@/components/dashboard/ErrorAlert'
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

export default function NewProgramPage() {
  const { session } = useAuth()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [objective, setObjective] = useState('')
  const [description, setDescription] = useState('')
  const [industries, setIndustries] = useState('AgriTech, Climate, CleanTech')
  const [stages, setStages] = useState('Idea, MVP, Seed')
  const [locations, setLocations] = useState('Vietnam, Southeast Asia')
  const [expected, setExpected] = useState(10)
  const [status, setStatus] = useState<ProgramStatus>('OPEN')
  const [requiredFields, setRequiredFields] = useState(DEFAULT_REQUIRED_FIELDS.join(', '))
  const [criteria, setCriteria] = useState<Record<string, RubricCriterion>>(
    () => structuredClone(DEFAULT_RUBRIC_CRITERIA),
  )

  const weightTotal = useMemo(
    () => Object.values(criteria).reduce((s, c) => s + (Number(c.weight) || 0), 0),
    [criteria],
  )

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session) return
    if (Math.round(weightTotal) !== 100) {
      setError(`Rubric phải = 100 (hiện ${weightTotal})`)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const industryList = parseList(industries)
      const stageList = parseList(stages)
      const locationList = parseList(locations)
      const program = await createProgram(session, {
        name: name.trim(),
        objective: objective.trim(),
        description: description.trim(),
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
        rubric: { version: 'startup-screening-v1', criteria },
      })
      toast.success('Đã tạo chương trình')
      router.push(`/programs/${program.id}/overview`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi')
    } finally {
      setSaving(false)
    }
  }

  if (session?.role === 'reviewer') {
    return <ErrorAlert title="Không có quyền" message="Reviewer không tạo được chương trình." />
  }

  return (
    <PageShell>
      <PageHeader
        title="Tạo chương trình"
        description="Định nghĩa pipeline intake: mục tiêu, filter cứng, rubric chấm điểm."
        breadcrumb={
          <Link href="/programs" className="hover:text-foreground">
            ← Danh sách chương trình
          </Link>
        }
        meta={
          <Badge variant={Math.round(weightTotal) === 100 ? 'default' : 'destructive'}>
            Rubric {weightTotal}/100
          </Badge>
        }
        actions={
          <Button size="sm" type="submit" form="new-prog" disabled={saving}>
            {saving ? <Spinner data-icon="inline-start" /> : null}
            Tạo chương trình
          </Button>
        }
      />
      {error ? <ErrorAlert message={error} /> : null}

      <form id="new-prog" onSubmit={onSubmit}>
        <SplitGrid>
          <Section title="Thông tin cơ bản" description="Tên, mục tiêu, trạng thái">
            <FieldGroup className="gap-3">
              <Field>
                <FieldLabel>Tên chương trình *</FieldLabel>
                <Input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} placeholder="AgriTech Seed 2026" />
              </Field>
              <Field>
                <FieldLabel>Mục tiêu *</FieldLabel>
                <Textarea
                  className="min-h-20"
                  required
                  minLength={2}
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  placeholder="Tìm 10 startup climate/agri giai A cho cohort…"
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
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>Chỉ tiêu chọn</FieldLabel>
                  <Input
                    type="number"
                    min={1}
                    value={expected}
                    onChange={(e) => setExpected(Number(e.target.value) || 1)}
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel>Ngành ưu tiên</FieldLabel>
                <Input value={industries} onChange={(e) => setIndustries(e.target.value)} />
                <FieldDescription>Phân tách bằng dấu phẩy</FieldDescription>
              </Field>
              <Field>
                <FieldLabel>Giai đoạn nhận</FieldLabel>
                <Input value={stages} onChange={(e) => setStages(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel>Địa bàn</FieldLabel>
                <Input value={locations} onChange={(e) => setLocations(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel>Required fields</FieldLabel>
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
            title="Rubric chấm điểm"
            description="Tổng trọng số phải = 100"
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
            </div>
          </Section>
        </SplitGrid>
      </form>
    </PageShell>
  )
}
