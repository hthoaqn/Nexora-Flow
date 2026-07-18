import type { ApplicationStatus, ProgramStatus } from './api/types'
import type { VariantProps } from 'class-variance-authority'
import type { badgeVariants } from '@/components/ui/badge'

export const APP_STATUS_LABEL: Record<ApplicationStatus, string> = {
  RECEIVED: 'Đã nhận',
  EXTRACTING: 'Đang trích xuất',
  NEEDS_REVIEW: 'Cần kiểm tra',
  ELIGIBLE: 'Sẵn sàng chấm',
  SCORED: 'Đã chấm',
  SHORTLISTED: 'Danh sách rút gọn',
  INTERVIEW: 'Phỏng vấn',
  ACCEPTED: 'Được chọn',
  REJECTED: 'Không chọn',
  ARCHIVED: 'Lưu trữ',
}

/** English labels for status (UI should pick by locale when needed). */
export const APP_STATUS_LABEL_EN: Record<ApplicationStatus, string> = {
  RECEIVED: 'Received',
  EXTRACTING: 'Extracting',
  NEEDS_REVIEW: 'Needs review',
  ELIGIBLE: 'Eligible',
  SCORED: 'Scored',
  SHORTLISTED: 'Shortlisted',
  INTERVIEW: 'Interview',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  ARCHIVED: 'Archived',
}

export const PROGRAM_STATUS_LABEL: Record<ProgramStatus, string> = {
  DRAFT: 'Nháp',
  OPEN: 'Đang mở',
  CLOSED: 'Đã đóng',
  ARCHIVED: 'Lưu trữ',
}

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>

/** Map workflow status → Badge variant only (no raw colors). */
export function statusBadgeVariant(status: string): BadgeVariant {
  switch (status) {
    case 'OPEN':
    case 'ELIGIBLE':
    case 'SHORTLISTED':
    case 'ACCEPTED':
    case 'COMPLETED':
      return 'default'
    case 'NEEDS_REVIEW':
    case 'EXTRACTING':
    case 'PROCESSING':
    case 'SCORED':
    case 'INTERVIEW':
      return 'secondary'
    case 'REJECTED':
    case 'FAILED':
      return 'destructive'
    case 'CLOSED':
    case 'ARCHIVED':
    case 'DRAFT':
    case 'RECEIVED':
    default:
      return 'outline'
  }
}

export function confidenceLabel(c?: number | null): {
  label: string
  badge: BadgeVariant
} {
  const v = c ?? 0
  if (v >= 0.8) return { label: 'Cao', badge: 'default' }
  if (v >= 0.5) return { label: 'Trung bình', badge: 'secondary' }
  return { label: 'Thấp', badge: 'destructive' }
}

/**
 * Only these may be sent to PATCH /decision (backend: "human review state").
 * Never send NEEDS_REVIEW / ELIGIBLE / SCORED via decision API.
 */
export const HUMAN_REVIEW_STATUSES: ApplicationStatus[] = [
  'SHORTLISTED',
  'INTERVIEW',
  'ACCEPTED',
  'REJECTED',
  'ARCHIVED',
]

export const DECISION_STATUSES = HUMAN_REVIEW_STATUSES

/**
 * Backend transition edges that go through /decision (human review only).
 * ELIGIBLE → SHORTLISTED is INVALID; scoring (screening) must produce SCORED first.
 */
export const DECISION_TRANSITIONS: Partial<
  Record<ApplicationStatus, ApplicationStatus[]>
> = {
  // From pre-score states: only terminal human outcomes (if backend allows)
  ELIGIBLE: ['REJECTED', 'ARCHIVED'],
  SCORED: ['SHORTLISTED', 'INTERVIEW', 'ACCEPTED', 'REJECTED', 'ARCHIVED'],
  SHORTLISTED: ['INTERVIEW', 'ACCEPTED', 'REJECTED', 'ARCHIVED'],
  INTERVIEW: ['ACCEPTED', 'REJECTED', 'ARCHIVED', 'SHORTLISTED'],
  ACCEPTED: ['ARCHIVED', 'REJECTED'],
  REJECTED: ['ARCHIVED', 'SHORTLISTED'],
  ARCHIVED: [],
}

/** Statuses the UI offers for the decision dropdown. */
export const DECISION_TARGETS: ApplicationStatus[] = [
  ...HUMAN_REVIEW_STATUSES,
]

export function isHumanReviewStatus(s: string): boolean {
  return HUMAN_REVIEW_STATUSES.includes(
    String(s || '').toUpperCase() as ApplicationStatus,
  )
}

/** Can this application use the decision tab meaningfully? */
export function canRecordDecision(status: string): boolean {
  const u = String(status || '').toUpperCase()
  // Need SCORED (or already in human review) before shortlist/accept
  return (
    u === 'SCORED' ||
    isHumanReviewStatus(u) ||
    // reject/archive may work from eligible on some backends
    u === 'ELIGIBLE'
  )
}

/** Direct next states from `from` (empty if terminal / unknown). */
export function allowedDecisionTargets(
  from: ApplicationStatus | string,
): ApplicationStatus[] {
  const next = DECISION_TRANSITIONS[from as ApplicationStatus] || []
  return DECISION_TARGETS.filter((t) => next.includes(t) || t === from)
}

/**
 * Build a hop sequence from `from` to `to` (inclusive of `to`, exclusive of `from`).
 * BFS over DECISION_TRANSITIONS. Returns null if unreachable.
 */
export function pathToDecisionStatus(
  from: ApplicationStatus | string,
  to: ApplicationStatus | string,
): ApplicationStatus[] | null {
  if (from === to) return []
  const start = from as ApplicationStatus
  const goal = to as ApplicationStatus
  const queue: ApplicationStatus[][] = [[start]]
  const seen = new Set<string>([start])

  while (queue.length) {
    const path = queue.shift()!
    const cur = path[path.length - 1]
    const edges = DECISION_TRANSITIONS[cur] || []
    for (const n of edges) {
      if (seen.has(n)) continue
      const nextPath = [...path, n]
      if (n === goal) return nextPath.slice(1)
      seen.add(n)
      queue.push(nextPath)
    }
  }
  return null
}

/** Targets reachable in ≤4 hops (what the decision UI should offer). */
export function reachableDecisionTargets(
  from: ApplicationStatus | string,
): ApplicationStatus[] {
  const u = String(from || '').toUpperCase() as ApplicationStatus
  // Not scored yet → only allow reject/archive in UI (shortlist after ranking)
  if (u === 'ELIGIBLE' || u === 'NEEDS_REVIEW' || u === 'RECEIVED' || u === 'EXTRACTING') {
    return (['REJECTED', 'ARCHIVED'] as ApplicationStatus[]).filter((t) =>
      pathToDecisionStatus(u, t) !== null ||
      (DECISION_TRANSITIONS[u] || []).includes(t),
    )
  }
  const out = new Set<ApplicationStatus>()
  if (isHumanReviewStatus(u)) out.add(u)
  for (const t of HUMAN_REVIEW_STATUSES) {
    if (t === u) continue
    const p = pathToDecisionStatus(u, t)
    if (p && p.length > 0 && p.length <= 4) out.add(t)
    // Direct edge also counts
    if ((DECISION_TRANSITIONS[u] || []).includes(t)) out.add(t)
  }
  return HUMAN_REVIEW_STATUSES.filter((t) => out.has(t))
}

export const PROFILE_FIELD_LABELS: Record<string, string> = {
  startupName: 'Tên startup',
  companyName: 'Tên công ty',
  contactEmail: 'Email liên hệ',
  website: 'Website',
  industry: 'Ngành',
  product: 'Sản phẩm',
  technology: 'Công nghệ',
  problem: 'Vấn đề',
  solution: 'Giải pháp',
  competitiveAdvantage: 'Lợi thế cạnh tranh',
  targetMarket: 'Thị trường mục tiêu',
  businessModel: 'Mô hình kinh doanh',
  stage: 'Giai đoạn',
  location: 'Địa bàn',
  revenue: 'Doanh thu',
  userMetrics: 'Chỉ số người dùng',
  growth: 'Tăng trưởng',
  kpis: 'KPI',
  team: 'Đội ngũ',
  fundingNeed: 'Nhu cầu vốn',
  supportNeed: 'Nhu cầu hỗ trợ',
  achievements: 'Thành tựu',
  intellectualProperty: 'Sở hữu trí tuệ',
}

export const DEFAULT_REQUIRED_FIELDS = [
  'startupName',
  'industry',
  'stage',
  'problem',
  'solution',
  'team',
]

export const DEFAULT_RUBRIC_CRITERIA = {
  problem_fit: { name: 'Problem-Solution Fit', weight: 25 },
  market: { name: 'Market Opportunity', weight: 20 },
  product: { name: 'Product & Traction', weight: 20 },
  team: { name: 'Team', weight: 20 },
  impact: { name: 'Impact / Differentiation', weight: 15 },
}
