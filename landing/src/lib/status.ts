import type { ApplicationStatus, ProgramStatus } from './api/types'
import type { VariantProps } from 'class-variance-authority'
import type { badgeVariants } from '@/components/ui/badge'

export const APP_STATUS_LABEL: Record<ApplicationStatus, string> = {
  RECEIVED: 'Đã nhận',
  EXTRACTING: 'Đang trích xuất',
  NEEDS_REVIEW: 'Cần kiểm tra',
  ELIGIBLE: 'Sẵn sàng chấm',
  SCORED: 'Đã chấm',
  SHORTLISTED: 'Shortlist',
  INTERVIEW: 'Phỏng vấn',
  ACCEPTED: 'Được chọn',
  REJECTED: 'Không chọn',
  ARCHIVED: 'Lưu trữ',
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

export const DECISION_STATUSES: ApplicationStatus[] = [
  'SHORTLISTED',
  'INTERVIEW',
  'ACCEPTED',
  'REJECTED',
  'ARCHIVED',
  'ELIGIBLE',
  'NEEDS_REVIEW',
]

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
