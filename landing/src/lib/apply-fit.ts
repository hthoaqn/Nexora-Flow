/**
 * Match applicant self-classification + AI profile against public program criteria.
 */

import type { PublicProgram } from '@/lib/api/types'

export type ApplyForm = {
  startupName: string
  contactEmail: string
  contactName: string
  website: string
  industry: string
  stage: string
  location: string
  problem: string
  solution: string
  team: string
  product: string
  description: string
}

export type FitDimension = {
  key: string
  labelVi: string
  labelEn: string
  score: number // 0–100
  detailVi: string
  detailEn: string
  ok: boolean
}

export type FitReport = {
  total: number
  dimensions: FitDimension[]
  missing: string[]
  hardFail: boolean
}

function norm(s: string) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function softMatch(hay: string, needles: string[]): boolean {
  const h = norm(hay)
  if (!h) return false
  return needles.some((n) => {
    const x = norm(n)
    return x && (h.includes(x) || x.includes(h))
  })
}

export function emptyApplyForm(): ApplyForm {
  return {
    startupName: '',
    contactEmail: '',
    contactName: '',
    website: '',
    industry: '',
    stage: '',
    location: '',
    problem: '',
    solution: '',
    team: '',
    product: '',
    description: '',
  }
}

export function mergeProfileIntoForm(
  form: ApplyForm,
  profile: Record<string, unknown>,
  onlyEmpty = true,
): ApplyForm {
  const next = { ...form }
  const keys = Object.keys(next) as (keyof ApplyForm)[]
  for (const k of keys) {
    if (onlyEmpty && String(next[k] || '').trim()) continue
    const v = profile[k]
    if (v == null || v === '') continue
    next[k] = Array.isArray(v) ? v.join(', ') : String(v)
  }
  // map industry from industries array string
  if ((!onlyEmpty || !next.industry) && profile.industries) {
    const ind = profile.industries
    next.industry = Array.isArray(ind) ? ind.join(', ') : String(ind)
  }
  return next
}

export function scoreFitAgainstProgram(
  form: ApplyForm,
  program: PublicProgram | null,
): FitReport {
  const industries = program?.priorityIndustries || []
  const stages = program?.acceptedStages || []
  const locations = program?.locations || []
  const hard = program?.hardFilters

  const dims: FitDimension[] = []

  // Industry
  if (industries.length) {
    const ok = softMatch(form.industry, industries)
    dims.push({
      key: 'industry',
      labelVi: 'Ngành',
      labelEn: 'Sector',
      score: ok ? 100 : form.industry.trim() ? 35 : 0,
      detailVi: ok
        ? `Khớp: ${form.industry}`
        : form.industry
          ? `「${form.industry}」 chưa trong ưu tiên (${industries.slice(0, 3).join(', ')})`
          : 'Chưa chọn ngành',
      detailEn: ok
        ? `Match: ${form.industry}`
        : form.industry
          ? `「${form.industry}」 not in priority (${industries.slice(0, 3).join(', ')})`
          : 'Sector not set',
      ok,
    })
  } else {
    dims.push({
      key: 'industry',
      labelVi: 'Ngành',
      labelEn: 'Sector',
      score: form.industry.trim() ? 80 : 20,
      detailVi: form.industry || 'Chưa điền',
      detailEn: form.industry || 'Empty',
      ok: !!form.industry.trim(),
    })
  }

  // Stage
  if (stages.length) {
    const ok = softMatch(form.stage, stages)
    dims.push({
      key: 'stage',
      labelVi: 'Giai đoạn',
      labelEn: 'Stage',
      score: ok ? 100 : form.stage.trim() ? 40 : 0,
      detailVi: ok
        ? `Khớp: ${form.stage}`
        : form.stage
          ? `「${form.stage}」 ngoài danh sách nhận`
          : 'Chưa chọn giai đoạn',
      detailEn: ok
        ? `Match: ${form.stage}`
        : form.stage
          ? `「${form.stage}」 not accepted`
          : 'Stage not set',
      ok,
    })
  } else {
    dims.push({
      key: 'stage',
      labelVi: 'Giai đoạn',
      labelEn: 'Stage',
      score: form.stage.trim() ? 80 : 20,
      detailVi: form.stage || 'Chưa điền',
      detailEn: form.stage || 'Empty',
      ok: !!form.stage.trim(),
    })
  }

  // Location
  if (locations.length) {
    const ok = softMatch(form.location, locations)
    dims.push({
      key: 'location',
      labelVi: 'Địa bàn',
      labelEn: 'Location',
      score: ok ? 100 : form.location.trim() ? 50 : 20,
      detailVi: ok ? form.location : form.location || 'Chưa điền',
      detailEn: ok ? form.location : form.location || 'Empty',
      ok: ok || !locations.length,
    })
  }

  // Completeness of narrative
  const narrative =
    [form.problem, form.solution, form.team, form.product].filter((x) =>
      String(x).trim(),
    ).length
  dims.push({
    key: 'narrative',
    labelVi: 'Nội dung cốt lõi',
    labelEn: 'Core narrative',
    score: Math.round((narrative / 4) * 100),
    detailVi: `${narrative}/4 trường (vấn đề · giải pháp · đội · sản phẩm)`,
    detailEn: `${narrative}/4 fields (problem · solution · team · product)`,
    ok: narrative >= 2,
  })

  // Contact
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail.trim())
  dims.push({
    key: 'contact',
    labelVi: 'Liên hệ',
    labelEn: 'Contact',
    score: emailOk && form.startupName.trim() ? 100 : emailOk ? 60 : 0,
    detailVi: emailOk
      ? form.startupName || form.contactEmail
      : 'Cần tên startup + email hợp lệ',
    detailEn: emailOk
      ? form.startupName || form.contactEmail
      : 'Need startup name + valid email',
    ok: emailOk && !!form.startupName.trim(),
  })

  const total = Math.round(
    dims.reduce((s, d) => s + d.score, 0) / Math.max(1, dims.length),
  )

  const missing: string[] = []
  if (!form.startupName.trim()) missing.push('startupName')
  if (!emailOk) missing.push('contactEmail')
  if (!form.industry.trim()) missing.push('industry')
  if (!form.stage.trim()) missing.push('stage')

  let hardFail = false
  if (hard?.allowedIndustries?.length && form.industry) {
    if (!softMatch(form.industry, hard.allowedIndustries)) hardFail = true
  }
  if (hard?.allowedStages?.length && form.stage) {
    if (!softMatch(form.stage, hard.allowedStages)) hardFail = true
  }

  return { total, dimensions: dims, missing, hardFail }
}

/** Common pick lists for classification UI */
export const INDUSTRY_OPTIONS = [
  'Agritech',
  'FinTech',
  'HealthTech',
  'EdTech',
  'Climate',
  'CleanTech',
  'SaaS',
  'AI/Deeptech',
  'Logistics',
  'E-commerce',
  'Biotech',
  'Other',
]

export const STAGE_OPTIONS = [
  'idea',
  'prototype',
  'mvp',
  'pre-seed',
  'seed',
  'growth',
  'expansion',
]
