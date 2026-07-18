/**
 * NIC staff as HR: filter pipeline → ranking summary → Word report → email draft.
 */

import type {
  Application,
  ApplicationStatus,
  Program,
  ScreeningResult,
  AuthSession,
} from '@/lib/api/types'
import { displayName } from '@/lib/api/client'
import { APP_STATUS_LABEL } from '@/lib/status'
import {
  matchApplicationsToProgram,
  profileFromApplication,
  type CrossMatchResult,
} from '@/lib/cross-match'

export type HrRecommendation =
  | 'SHORTLIST'
  | 'INTERVIEW'
  | 'HOLD'
  | 'REJECT'
  | 'REVIEW'

export type HrCandidateRow = {
  applicationId: string
  name: string
  status: ApplicationStatus | string
  screeningScore: number | null
  fitScore: number | null
  eligible: boolean | null
  matchingOptIn: boolean
  industries: string
  stage: string
  recommendation: HrRecommendation
  reasons: string[]
  risks: string[]
  fileName?: string
}

export type NicHrReport = {
  generatedAt: string
  generatedBy: {
    email: string
    name?: string
    role?: string
    organizationId?: string
  }
  program: {
    id: string
    name: string
    objective: string
    status: string
    priorityIndustries: string[]
    acceptedStages: string[]
    locations: string[]
    expectedSelections?: number
  }
  funnel: {
    total: number
    needsReview: number
    eligible: number
    scored: number
    shortlisted: number
    interview: number
    accepted: number
    rejected: number
    matchingOptIn: number
  }
  candidates: HrCandidateRow[]
  shortlist: HrCandidateRow[]
  interview: HrCandidateRow[]
  hold: HrCandidateRow[]
  rejectPool: HrCandidateRow[]
  executiveSummaryVi: string
  executiveSummaryEn: string
  emailSubjectVi: string
  emailSubjectEn: string
  emailBodyVi: string
  emailBodyEn: string
}

function industriesOf(app: Application): string {
  const p = profileFromApplication(app)
  const v = p.industries ?? p.industry
  if (Array.isArray(v)) return v.map(String).join(', ')
  if (typeof v === 'string') return v
  return '—'
}

function stageOf(app: Application): string {
  const p = profileFromApplication(app)
  return typeof p.stage === 'string' && p.stage ? p.stage : '—'
}

function decide(
  row: Omit<HrCandidateRow, 'recommendation' | 'reasons' | 'risks'> & {
    screening?: ScreeningResult | null
    fit?: CrossMatchResult | null
  },
): Pick<HrCandidateRow, 'recommendation' | 'reasons' | 'risks'> {
  const score = row.screeningScore ?? row.fitScore ?? 0
  const reasons: string[] = []
  const risks: string[] = []

  if (row.screening?.strengths?.length) {
    reasons.push(...row.screening.strengths.slice(0, 2).map(String))
  }
  if (row.fit?.matchedReasons?.length) {
    reasons.push(...row.fit.matchedReasons.slice(0, 2))
  }
  if (row.screening?.risks?.length) {
    risks.push(...row.screening.risks.slice(0, 2).map(String))
  }
  if (row.fit?.risks?.length) {
    risks.push(...row.fit.risks.slice(0, 2))
  }
  if (row.eligible === false) {
    risks.push('Hard filter: not eligible')
  }
  if (!row.matchingOptIn) {
    risks.push('matchingOptIn = off')
  }

  let recommendation: HrRecommendation = 'HOLD'
  if (row.status === 'REJECTED' || (row.eligible === false && score < 40)) {
    recommendation = 'REJECT'
  } else if (row.status === 'SHORTLISTED' || score >= 80) {
    recommendation = 'SHORTLIST'
  } else if (row.status === 'INTERVIEW' || (score >= 65 && score < 80)) {
    recommendation = 'INTERVIEW'
  } else if (score >= 50) {
    recommendation = 'HOLD'
  } else if (row.status === 'NEEDS_REVIEW' || row.status === 'RECEIVED') {
    recommendation = 'REVIEW'
  } else {
    recommendation = 'HOLD'
  }

  if (!reasons.length) {
    if (recommendation === 'SHORTLIST') reasons.push('High composite fit / screening score')
    if (recommendation === 'INTERVIEW') reasons.push('Promising — needs human interview')
    if (recommendation === 'HOLD') reasons.push('Moderate fit — park for later cycle')
    if (recommendation === 'REJECT') reasons.push('Low fit or failed filters')
    if (recommendation === 'REVIEW') reasons.push('Awaiting profile confirmation / data')
  }

  return { recommendation, reasons: reasons.slice(0, 4), risks: risks.slice(0, 4) }
}

export function buildNicHrReport(input: {
  program: Program
  applications: Application[]
  results: ScreeningResult[]
  session: AuthSession
  minScore?: number
  optInOnly?: boolean
}): NicHrReport {
  const { program, applications, results, session } = input
  const minScore = input.minScore ?? 0
  const optInOnly = input.optInOnly ?? false

  const resultByApp = new Map<string, ScreeningResult>()
  for (const r of results) {
    if (r.applicationId) resultByApp.set(r.applicationId, r)
  }

  const fits = matchApplicationsToProgram(applications, program, {
    requireOptIn: false,
    minScore: 0,
  })
  const fitByApp = new Map(fits.map((f) => [f.applicationId, f]))

  const funnel = {
    total: applications.length,
    needsReview: 0,
    eligible: 0,
    scored: 0,
    shortlisted: 0,
    interview: 0,
    accepted: 0,
    rejected: 0,
    matchingOptIn: 0,
  }

  const candidates: HrCandidateRow[] = []

  for (const app of applications) {
    const st = String(app.status || '')
    if (st === 'NEEDS_REVIEW') funnel.needsReview++
    if (st === 'ELIGIBLE') funnel.eligible++
    if (st === 'SCORED') funnel.scored++
    if (st === 'SHORTLISTED') funnel.shortlisted++
    if (st === 'INTERVIEW') funnel.interview++
    if (st === 'ACCEPTED') funnel.accepted++
    if (st === 'REJECTED') funnel.rejected++
    if (app.matchingOptIn) funnel.matchingOptIn++

    if (optInOnly && !app.matchingOptIn) continue

    const screening = resultByApp.get(app.id) || null
    const fit = fitByApp.get(app.id) || null
    const screeningScore =
      screening?.totalScore != null ? Number(screening.totalScore) : null
    const fitScore = fit?.totalScore != null ? Number(fit.totalScore) : null
    const composite = screeningScore ?? fitScore ?? 0
    if (composite < minScore && st !== 'SHORTLISTED' && st !== 'INTERVIEW') continue

    const base = {
      applicationId: app.id,
      name: displayName(app),
      status: app.status,
      screeningScore,
      fitScore,
      eligible: screening?.eligible ?? null,
      matchingOptIn: !!app.matchingOptIn,
      industries: industriesOf(app),
      stage: stageOf(app),
      fileName: app.fileMetadata?.fileName,
      screening,
      fit,
    }
    const decision = decide(base)
    candidates.push({
      applicationId: base.applicationId,
      name: base.name,
      status: base.status,
      screeningScore: base.screeningScore,
      fitScore: base.fitScore,
      eligible: base.eligible,
      matchingOptIn: base.matchingOptIn,
      industries: base.industries,
      stage: base.stage,
      fileName: base.fileName,
      ...decision,
    })
  }

  candidates.sort((a, b) => {
    const sa = a.screeningScore ?? a.fitScore ?? 0
    const sb = b.screeningScore ?? b.fitScore ?? 0
    return sb - sa
  })

  const shortlist = candidates.filter((c) => c.recommendation === 'SHORTLIST')
  const interview = candidates.filter((c) => c.recommendation === 'INTERVIEW')
  const hold = candidates.filter((c) => c.recommendation === 'HOLD')
  const rejectPool = candidates.filter((c) => c.recommendation === 'REJECT')

  const quota = program.expectedSelections || shortlist.length || 5
  const topNames = shortlist
    .slice(0, Math.min(5, quota))
    .map((c) => c.name)
    .join(', ')

  const generatedAt = new Date().toISOString()
  const dateLabel = new Date().toLocaleDateString('vi-VN')

  const executiveSummaryVi = [
    `Báo cáo sàng lọc NIC — chương trình "${program.name}" (${dateLabel}).`,
    `Tổng hồ sơ trong pipeline: ${funnel.total}. Chờ duyệt profile: ${funnel.needsReview}. Đã chấm: ${funnel.scored + funnel.eligible}. Shortlist gợi ý: ${shortlist.length}. Phỏng vấn: ${interview.length}.`,
    `Chỉ tiêu chọn (expected): ${program.expectedSelections ?? '—'}.`,
    shortlist.length
      ? `Top shortlist: ${topNames}.`
      : 'Chưa có shortlist đủ điều kiện — cần bổ sung hồ sơ hoặc hạ ngưỡng điểm.',
    `Ngành ưu tiên: ${(program.priorityIndustries || []).join(', ') || '—'}. Giai đoạn: ${(program.acceptedStages || []).join(', ') || '—'}.`,
    'AI hỗ trợ quyết định; nhân sự NIC (HR deal-flow) xác nhận final shortlist trước khi intro.',
  ].join(' ')

  const executiveSummaryEn = [
    `NIC screening report — program "${program.name}" (${dateLabel}).`,
    `Pipeline: ${funnel.total} apps. Needs review: ${funnel.needsReview}. Scored/eligible: ${funnel.scored + funnel.eligible}. Suggested shortlist: ${shortlist.length}. Interview: ${interview.length}.`,
    `Selection quota: ${program.expectedSelections ?? '—'}.`,
    shortlist.length
      ? `Top shortlist: ${topNames}.`
      : 'No shortlist yet — add applications or lower score floor.',
    `Priority industries: ${(program.priorityIndustries || []).join(', ') || '—'}. Stages: ${(program.acceptedStages || []).join(', ') || '—'}.`,
    'AI is decision-support only; NIC staff (deal-flow HR) confirm the final shortlist before intros.',
  ].join(' ')

  const emailSubjectVi = `[NIC] Báo cáo sàng lọc — ${program.name} — ${dateLabel}`
  const emailSubjectEn = `[NIC] Screening report — ${program.name} — ${dateLabel}`

  const listBlock = (title: string, rows: HrCandidateRow[]) =>
    rows.length === 0
      ? `${title}: (trống)\n`
      : `${title}:\n${rows
          .slice(0, 15)
          .map(
            (c, i) =>
              `  ${i + 1}. ${c.name} — score ${c.screeningScore ?? c.fitScore ?? '—'} — ${c.recommendation} — ${c.industries}`,
          )
          .join('\n')}\n`

  const emailBodyVi = [
    `Kính gửi Ban điều hành / Mentor,`,
    ``,
    `Nhóm NIC Deal-flow (vai trò HR sàng lọc) gửi báo cáo tổng kết chương trình "${program.name}".`,
    ``,
    executiveSummaryVi,
    ``,
    listBlock('SHORTLIST đề xuất', shortlist),
    listBlock('INTERVIEW', interview),
    listBlock('HOLD', hold.slice(0, 10)),
    ``,
    `File Word đính kèm (nếu gửi qua mail client): báo cáo chi tiết từng startup, lý do match, rủi ro.`,
    ``,
    `Trân trọng,`,
    `${session.displayName || session.email}`,
    `NIC Intake · ${session.organizationId}`,
    `Nexora Flow`,
  ].join('\n')

  const emailBodyEn = [
    `Dear Leadership / Mentors,`,
    ``,
    `NIC Deal-flow (HR screening role) submits the summary for program "${program.name}".`,
    ``,
    executiveSummaryEn,
    ``,
    listBlock('Proposed SHORTLIST', shortlist),
    listBlock('INTERVIEW', interview),
    listBlock('HOLD', hold.slice(0, 10)),
    ``,
    `Attached Word file (if sent via mail client): per-startup detail, fit reasons, risks.`,
    ``,
    `Best regards,`,
    `${session.displayName || session.email}`,
    `NIC Intake · ${session.organizationId}`,
    `Nexora Flow`,
  ].join('\n')

  return {
    generatedAt,
    generatedBy: {
      email: session.email,
      name: session.displayName,
      role: session.role,
      organizationId: session.organizationId,
    },
    program: {
      id: program.id,
      name: program.name,
      objective: program.objective || '',
      status: program.status,
      priorityIndustries: program.priorityIndustries || [],
      acceptedStages: program.acceptedStages || [],
      locations: program.locations || [],
      expectedSelections: program.expectedSelections,
    },
    funnel,
    candidates,
    shortlist,
    interview,
    hold,
    rejectPool,
    executiveSummaryVi,
    executiveSummaryEn,
    emailSubjectVi,
    emailSubjectEn,
    emailBodyVi,
    emailBodyEn,
  }
}

export function recommendationLabel(r: HrRecommendation, lang: 'vi' | 'en' = 'vi') {
  const map: Record<HrRecommendation, { vi: string; en: string }> = {
    SHORTLIST: { vi: 'Shortlist', en: 'Shortlist' },
    INTERVIEW: { vi: 'Phỏng vấn', en: 'Interview' },
    HOLD: { vi: 'Giữ lại', en: 'Hold' },
    REJECT: { vi: 'Loại', en: 'Reject' },
    REVIEW: { vi: 'Cần review', en: 'Needs review' },
  }
  return map[r][lang]
}

export function statusLabel(status: string) {
  return APP_STATUS_LABEL[status as ApplicationStatus] || status
}

export function buildMailto(report: NicHrReport, lang: 'vi' | 'en', to = '') {
  const subject = lang === 'vi' ? report.emailSubjectVi : report.emailSubjectEn
  const body = lang === 'vi' ? report.emailBodyVi : report.emailBodyEn
  const params = new URLSearchParams({
    subject,
    body,
  })
  return `mailto:${encodeURIComponent(to)}?${params.toString()}`
}
