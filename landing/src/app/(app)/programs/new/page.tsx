'use client'

import { useTx } from '@/lib/tx'
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
import { RubricEditor } from '@/components/dashboard/RubricEditor'

function parseList(value: string): string[] {
  return value
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export default function NewProgramPage() {
  const { tx } = useTx()
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
      setError(tx(`Rubric phải = 100 (hiện ${weightTotal})`, `Rubric weights must total 100 (currently ${weightTotal})`))
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
      toast.success(tx('Đã tạo chương trình', 'Program created'))
      router.push(`/programs/${program.id}/overview`)
    } catch (err) {
      setError(err instanceof Error ? err.message : tx('Lỗi', 'Error'))
    } finally {
      setSaving(false)
    }
  }

  if (session?.role === 'reviewer') {
    return <ErrorAlert title={tx('Không có quyền', 'No permission')} message={tx('Reviewer không tạo được chương trình.', 'Reviewers cannot create programs.')} />
  }

  return (
    <PageShell>
      <PageHeader
        title={tx('Tạo chương trình')}
        description={tx('Định nghĩa pipeline intake: mục tiêu, filter cứng, rubric chấm điểm.', 'Define the intake pipeline: objective, hard filters, scoring rubric.')}
        breadcrumb={
          <Link href="/programs" className="hover:text-foreground">
            ← {tx('Danh sách chương trình', 'All programs')}
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
            {tx('Tạo chương trình')}
          </Button>
        }
      />
      {error ? <ErrorAlert message={error} /> : null}

      <form id="new-prog" onSubmit={onSubmit}>
        <SplitGrid>
          <Section title={tx('Thông tin cơ bản', 'Basics')} description={tx('Tên, mục tiêu, trạng thái', 'Name, objective, status')}>
            <FieldGroup className="gap-3">
              <Field>
                <FieldLabel>{tx('Tên chương trình *', 'Program name *')}</FieldLabel>
                <Input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} placeholder="AgriTech Seed 2026" />
              </Field>
              <Field>
                <FieldLabel>{tx('Mục tiêu *', 'Objective *')}</FieldLabel>
                <Textarea
                  className="min-h-20"
                  required
                  minLength={2}
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  placeholder={tx('Tìm 10 startup climate/agri giai A cho cohort…', 'Find 10 climate/agri Series-A startups for the cohort…')}
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
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>{tx('Chỉ tiêu chọn', 'Selection quota')}</FieldLabel>
                  <Input
                    type="number"
                    min={1}
                    value={expected}
                    onChange={(e) => setExpected(Number(e.target.value) || 1)}
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel>{tx('Ngành ưu tiên', 'Priority sectors')}</FieldLabel>
                <Input value={industries} onChange={(e) => setIndustries(e.target.value)} />
                <FieldDescription>{tx('Phân tách bằng dấu phẩy', 'Comma-separated')}</FieldDescription>
              </Field>
              <Field>
                <FieldLabel>{tx('Giai đoạn nhận', 'Accepted stages')}</FieldLabel>
                <Input value={stages} onChange={(e) => setStages(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel>{tx('Địa bàn', 'Regions')}</FieldLabel>
                <Input value={locations} onChange={(e) => setLocations(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel>Required fields</FieldLabel>
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
            description={tx('Thêm chỉ tiêu · tổng trọng số = 100', 'Add criteria · weights total 100')}
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
