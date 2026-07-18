/**
 * Build contextual next-step lists for Intake & Startup dashboards.
 */

import type { ApplicationStatus, ProgramSummary } from '@/lib/api/types'
import type { NextStepItem } from '@/components/dashboard/NextStepsGuide'

function count(
  counts: Partial<Record<ApplicationStatus, number>> | undefined,
  key: ApplicationStatus,
) {
  return Number(counts?.[key] ?? 0) || 0
}

/** Intake home (/programs) */
export function buildIntakeHomeSteps(input: {
  programCount: number
  firstProgramId?: string | null
}): NextStepItem[] {
  const steps: NextStepItem[] = []
  const hasPrograms = input.programCount > 0
  const pid = input.firstProgramId

  steps.push({
    id: 'org',
    done: false,
    primary: !hasPrograms,
    titleVi: 'Kiểm tra tổ chức',
    titleEn: 'Check organization',
    bodyVi:
      'Đặt tên không gian làm việc và duyệt hồ sơ cần kiểm tra tại Cài đặt, mục Tổ chức.',
    bodyEn:
      'Set the workspace name and review applications that need review under Settings, Organization.',
    ctaVi: 'Mở Tổ chức',
    ctaEn: 'Open Organization',
    href: '/settings/organization',
  })

  steps.push({
    id: 'program',
    done: hasPrograms,
    primary: !hasPrograms,
    titleVi: hasPrograms ? 'Chương trình đã có' : 'Tạo chương trình',
    titleEn: hasPrograms ? 'Program exists' : 'Create a program',
    bodyVi: hasPrograms
      ? 'Mở tổng quan chương trình để chia sẻ liên kết nộp hồ sơ và theo dõi quy trình.'
      : 'Tạo chương trình (ngành, giai đoạn, bảng chấm điểm) trước khi nhận hồ sơ.',
    bodyEn: hasPrograms
      ? 'Open program overview to share the apply link and track the process.'
      : 'Create a program (sectors, stages, scoring rubric) before receiving applications.',
    ctaVi: hasPrograms && pid ? 'Mở chương trình' : 'Tạo mới',
    ctaEn: hasPrograms && pid ? 'Open program' : 'Create new',
    href:
      hasPrograms && pid ? `/programs/${pid}/overview` : '/programs/new',
  })

  if (hasPrograms && pid) {
    steps.push({
      id: 'pipeline',
      primary: true,
      titleVi: 'Tiếp tục luồng giao dịch',
      titleEn: 'Continue deal flow',
      bodyVi:
        'Hồ sơ, rồi xếp hạng, rồi so khớp, rồi báo cáo. Làm tuần tự, đừng nhảy bước.',
      bodyEn:
        'Applications, then ranking, then matching, then report. Follow the order, do not skip.',
      ctaVi: 'Vào tổng quan',
      ctaEn: 'Go to overview',
      href: `/programs/${pid}/overview`,
    })
  }

  steps.push({
    id: 'matching',
    titleVi: 'So khớp giao thoa',
    titleEn: 'Cross matching',
    bodyVi:
      'So khớp định hướng chương trình với hồ sơ khởi nghiệp (chiều không gian tiếp nhận).',
    bodyEn:
      'Match program focus against startup profiles (intake side).',
    ctaVi: 'Mở so khớp',
    ctaEn: 'Open matching',
    href: '/matching',
  })

  return steps
}

/** Program overview — driven by statusCounts */
export function buildProgramOverviewSteps(input: {
  programId: string
  summary: ProgramSummary | null
  hasSubmissionToken: boolean
}): NextStepItem[] {
  const c = input.summary?.statusCounts
  const needsReview = count(c, 'NEEDS_REVIEW')
  const eligible = count(c, 'ELIGIBLE')
  const scored = count(c, 'SCORED')
  const shortlisted = count(c, 'SHORTLISTED')
  const total = input.summary?.totalApplications ?? 0
  const results = input.summary?.totalResults ?? 0
  const pid = input.programId

  const steps: NextStepItem[] = []

  steps.push({
    id: 'link',
    done: input.hasSubmissionToken,
    primary: !input.hasSubmissionToken,
    titleVi: 'Chia sẻ liên kết nộp hồ sơ',
    titleEn: 'Share application link',
    bodyVi: 'Sao chép liên kết công khai để khởi nghiệp tự nộp tài liệu.',
    bodyEn: 'Copy the public link so startups can submit documents.',
    ctaVi: 'Xem liên kết',
    ctaEn: 'View link',
    href: `/programs/${pid}/overview`,
  })

  steps.push({
    id: 'review',
    done: needsReview === 0 && total > 0,
    primary: needsReview > 0,
    titleVi:
      needsReview > 0
        ? `Duyệt ${needsReview} hồ sơ cần kiểm tra`
        : 'Xác nhận hồ sơ',
    titleEn:
      needsReview > 0
        ? `Review ${needsReview} applications that need review`
        : 'Confirm applications',
    bodyVi:
      needsReview > 0
        ? 'Xác nhận hồ sơ trích xuất trước khi chấm. Có thể duyệt hàng loạt tại Tổ chức.'
        : 'Hồ sơ mới cần xác nhận trước khi vào xếp hạng.',
    bodyEn:
      needsReview > 0
        ? 'Confirm extracted profiles before scoring. Bulk-approve at Organization.'
        : 'New applications need confirmation before ranking.',
    ctaVi: needsReview > 0 ? 'Mở hồ sơ' : 'Danh sách hồ sơ',
    ctaEn: needsReview > 0 ? 'Open applications' : 'Application list',
    href: `/programs/${pid}/applications`,
  })

  if (needsReview > 0) {
    steps.push({
      id: 'org-mod',
      primary: false,
      titleVi: 'Duyệt nhanh tại Tổ chức',
      titleEn: 'Quick moderate at Organization',
      bodyVi:
        'Danh sách hồ sơ cần kiểm tra mọi chương trình — duyệt hoặc từ chối từng thẻ.',
      bodyEn:
        'All-program list of applications that need review — approve or reject as cards.',
      ctaVi: 'Tổ chức',
      ctaEn: 'Organization',
      href: '/settings/organization',
    })
  }

  const readyToScore = eligible + scored
  steps.push({
    id: 'rank',
    done: results > 0 && eligible === 0,
    primary: readyToScore > 0 && results === 0,
    titleVi: 'Chấm xếp hạng',
    titleEn: 'Run ranking',
    bodyVi:
      readyToScore > 0
        ? `${readyToScore} hồ sơ sẵn sàng chấm. Sau chấm mới được đưa vào danh sách rút gọn — không rút gọn khi còn trạng thái sẵn sàng chấm.`
        : 'Cần hồ sơ đã xác nhận (sẵn sàng chấm) trước khi chạy xếp hạng.',
    bodyEn:
      readyToScore > 0
        ? `${readyToScore} apps ready to score. Only shortlist after scoring — never shortlist while still eligible only.`
        : 'Need confirmed (eligible) applications before ranking.',
    ctaVi: 'Mở xếp hạng',
    ctaEn: 'Open ranking',
    href: `/programs/${pid}/ranking`,
  })

  steps.push({
    id: 'decide',
    done: shortlisted > 0,
    primary: scored > 0 || results > 0,
    titleVi: 'Ghi quyết định (rút gọn hoặc chấp nhận)',
    titleEn: 'Record decision (shortlist or accept)',
    bodyVi:
      'Chỉ sau khi đã chấm. Mở hồ sơ, tab Quyết định, chọn danh sách rút gọn hoặc được chọn.',
    bodyEn:
      'Only after scored. Open an application, Decision tab, choose shortlisted or accepted.',
    ctaVi: 'Danh sách hồ sơ',
    ctaEn: 'Applications',
    href: `/programs/${pid}/applications`,
  })

  steps.push({
    id: 'match',
    titleVi: 'So khớp giao thoa',
    titleEn: 'Cross matching',
    bodyVi: 'Ghép khởi nghiệp với định hướng chương trình hoặc đối tác.',
    bodyEn: 'Match startups to program focus or partners.',
    ctaVi: 'So khớp',
    ctaEn: 'Matching',
    href: '/matching',
  })

  steps.push({
    id: 'report',
    primary: shortlisted > 0 || scored > 0,
    titleVi: 'Báo cáo nhân sự (tệp Word và thư)',
    titleEn: 'Staff report (Word file and email)',
    bodyVi: 'Gợi ý danh sách rút gọn, tải Word, gửi mentor.',
    bodyEn: 'Suggested shortlist, download Word, send to mentors.',
    ctaVi: 'Mở báo cáo',
    ctaEn: 'Open report',
    href: `/programs/${pid}/report`,
  })

  // Ensure only one primary: first incomplete primary wins
  let seenPrimary = false
  return steps.map((s) => {
    if (s.done) return { ...s, primary: false }
    if (s.primary && !seenPrimary) {
      seenPrimary = true
      return s
    }
    return { ...s, primary: false }
  })
}

/** Startup portal dashboard */
export function buildStartupNextSteps(input: {
  hasConfirmedProfile: boolean
  profileCompletion: number
  matchCount: number
  pendingConnections: number
  acceptedConnections: number
  sandboxCompleted?: boolean
  investorEnabled?: boolean
}): NextStepItem[] {
  const {
    hasConfirmedProfile,
    profileCompletion,
    matchCount,
    pendingConnections,
    acceptedConnections,
    sandboxCompleted = false,
    investorEnabled,
  } = input

  const steps: NextStepItem[] = []

  steps.push({
    id: 'setup',
    done: hasConfirmedProfile && profileCompletion >= 70,
    primary: !hasConfirmedProfile || profileCompletion < 50,
    titleVi: hasConfirmedProfile
      ? 'Bổ sung hồ sơ'
      : 'Thiết lập & xác nhận hồ sơ',
    titleEn: hasConfirmedProfile
      ? 'Improve profile'
      : 'Set up & confirm profile',
    bodyVi: hasConfirmedProfile
      ? `Hoàn thiện ~${profileCompletion}%. Lưu hồ sơ chính thức để so khớp chính xác.`
      : 'Điền form hoặc tải deck → xác nhận hồ sơ trước khi so khớp.',
    bodyEn: hasConfirmedProfile
      ? `About ${profileCompletion}% complete. Save the official profile for accurate matching.`
      : 'Fill the form or upload a deck → confirm profile before matching.',
    ctaVi: 'Mở Hồ sơ',
    ctaEn: 'Open Profile',
    href: '/setup',
  })

  steps.push({
    id: 'matches',
    done: matchCount > 0,
    primary: hasConfirmedProfile && matchCount === 0,
    titleVi: 'Chạy so khớp đối tác',
    titleEn: 'Run partner matching',
    bodyVi: 'Xếp hạng corporate / quỹ / lab theo điểm phù hợp, gửi lời giới thiệu.',
    bodyEn: 'Rank corporates / funds / labs by fit score, send intros.',
    ctaVi: 'So khớp',
    ctaEn: 'Matches',
    href: '/matches',
  })

  steps.push({
    id: 'connections',
    done: acceptedConnections > 0,
    primary: matchCount > 0 && acceptedConnections === 0,
    titleVi:
      pendingConnections > 0
        ? `Theo dõi ${pendingConnections} kết nối đang chờ`
        : 'Theo dõi kết nối',
    titleEn:
      pendingConnections > 0
        ? `Track ${pendingConnections} pending connections`
        : 'Track connections',
    bodyVi: 'Xem intro đã gửi, trạng thái chấp nhận, mở phòng giả lập khi được nhận.',
    bodyEn: 'See sent intros, accept status, open sandbox when accepted.',
    ctaVi: 'Kết nối',
    ctaEn: 'Connections',
    href: '/connections',
  })

  steps.push({
    id: 'sandbox',
    done: sandboxCompleted,
    primary: !sandboxCompleted && (acceptedConnections > 0 || matchCount > 0),
    titleVi: sandboxCompleted
      ? 'Đã hoàn thành phòng giả lập'
      : 'Phòng giả lập',
    titleEn: sandboxCompleted
      ? 'Sandbox completed'
      : 'Sandbox simulation',
    bodyVi: sandboxCompleted
      ? 'Bạn đã chạy xong thử thách. Có thể chơi lại hoặc sang so khớp nhà đầu tư.'
      : 'Chứng minh năng lực founder với đối tác đã chấp nhận (hoặc chơi demo).',
    bodyEn: sandboxCompleted
      ? 'Challenge finished. Replay anytime or move to investor matching.'
      : 'Prove founder judgment with an accepted partner (or play demo).',
    ctaVi: sandboxCompleted ? 'Xem / chơi lại' : 'Mở giả lập',
    ctaEn: sandboxCompleted ? 'View / replay' : 'Open sandbox',
    href: '/sandbox',
  })

  if (investorEnabled) {
    steps.push({
      id: 'investor',
      primary: sandboxCompleted || (hasConfirmedProfile && matchCount > 0),
      done: false,
      titleVi: 'So khớp nhà đầu tư & kiểm chứng',
      titleEn: 'Investor match & validation',
      bodyVi: 'Match NĐT demo → mutual → phòng thuyết trình (pipeline kiểm chứng).',
      bodyEn: 'Demo investor match → mutual → pitch room (validation pipeline).',
      ctaVi: 'Match nhà đầu tư',
      ctaEn: 'Investor match',
      href: '/investor-matches',
    })
  }

  let seenPrimary = false
  return steps.map((s) => {
    if (s.done) return { ...s, primary: false }
    if (s.primary && !seenPrimary) {
      seenPrimary = true
      return s
    }
    if (!seenPrimary && !s.done) {
      seenPrimary = true
      return { ...s, primary: true }
    }
    return { ...s, primary: false }
  })
}

export function startupJourneyStages(input: {
  hasConfirmedProfile: boolean
  matchCount: number
  acceptedConnections: number
  sandboxCompleted?: boolean
}) {
  const sandboxDone = !!input.sandboxCompleted
  return [
    {
      id: 'setup',
      labelVi: 'Hồ sơ',
      labelEn: 'Profile',
      href: '/setup',
      done: input.hasConfirmedProfile,
      active: !input.hasConfirmedProfile,
    },
    {
      id: 'matches',
      labelVi: 'So khớp',
      labelEn: 'Matches',
      href: '/matches',
      done: input.matchCount > 0,
      active: input.hasConfirmedProfile && input.matchCount === 0,
    },
    {
      id: 'connections',
      labelVi: 'Kết nối',
      labelEn: 'Connections',
      href: '/connections',
      done: input.acceptedConnections > 0,
      active: input.matchCount > 0 && input.acceptedConnections === 0,
    },
    {
      id: 'sandbox',
      labelVi: 'Giả lập',
      labelEn: 'Sandbox',
      href: '/sandbox',
      done: sandboxDone,
      active:
        !sandboxDone &&
        (input.acceptedConnections > 0 || input.matchCount > 0),
    },
  ]
}

export function programJourneyStages(programId: string, summary: ProgramSummary | null) {
  const c = summary?.statusCounts
  const needsReview = count(c, 'NEEDS_REVIEW')
  const eligible = count(c, 'ELIGIBLE')
  const scored = count(c, 'SCORED')
  const shortlisted = count(c, 'SHORTLISTED')
  const results = summary?.totalResults ?? 0
  const total = summary?.totalApplications ?? 0

  return [
    {
      id: 'apps',
      labelVi: 'Hồ sơ',
      labelEn: 'Apps',
      href: `/programs/${programId}/applications`,
      done: total > 0 && needsReview === 0,
      active: needsReview > 0 || total === 0,
    },
    {
      id: 'rank',
      labelVi: 'Xếp hạng',
      labelEn: 'Ranking',
      href: `/programs/${programId}/ranking`,
      done: results > 0,
      active: (eligible > 0 || scored > 0) && results === 0,
    },
    {
      id: 'decide',
      labelVi: 'Quyết định',
      labelEn: 'Decide',
      href: `/programs/${programId}/applications`,
      done: shortlisted > 0,
      active: results > 0 && shortlisted === 0,
    },
    {
      id: 'match',
      labelVi: 'So khớp',
      labelEn: 'Matching',
      href: '/matching',
      done: false,
      active: shortlisted > 0,
    },
    {
      id: 'report',
      labelVi: 'Báo cáo',
      labelEn: 'Report',
      href: `/programs/${programId}/report`,
      done: false,
      active: shortlisted > 0 || results > 0,
    },
  ]
}
