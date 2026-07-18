'use client'

/**
 * First-run product tour for Intake / Startup / Admin.
 * Stored per-audience in localStorage so it only auto-opens once.
 * Fully responsive: mobile full-width, safe-area, sticky footer, pure VI/EN.
 */

import { useEffect, useState, type ComponentType } from 'react'
import {
  ArrowRightIcon,
  BookOpenIcon,
  CheckCircle2Icon,
  RocketIcon,
  Building2Icon,
  SparklesIcon,
  FileTextIcon,
  BriefcaseIcon,
  Link2Icon,
  ShieldCheckIcon,
  HandshakeIcon,
} from 'lucide-react'
import { useTx } from '@/lib/tx'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

export type TutorialAudience = 'startup' | 'intake' | 'admin'

type Step = {
  titleVi: string
  titleEn: string
  bodyVi: string
  bodyEn: string
  icon: ComponentType<{ className?: string }>
}

const STEPS: Record<TutorialAudience, Step[]> = {
  startup: [
    {
      titleVi: 'Chào người sáng lập — Cổng khởi nghiệp',
      titleEn: 'Welcome founder — Startup portal',
      bodyVi:
        'Nexora Flow giúp bạn chuẩn hóa hồ sơ, so khớp đối tác (quỹ · doanh nghiệp · phòng thí nghiệm) có điểm số và lý do, gửi lời giới thiệu và chạy phòng giả lập. Trí tuệ nhân tạo gợi ý — bạn duyệt.',
      bodyEn:
        'Nexora Flow standardizes your profile, matches partners (funds · corporates · labs) with scores and reasons, sends intros, and runs the sandbox. AI suggests — you approve.',
      icon: RocketIcon,
    },
    {
      titleVi: '1. Thiết lập hồ sơ',
      titleEn: '1. Set up your profile',
      bodyVi:
        'Vào mục Hồ sơ: điền thông tin hoặc tải PDF/PPTX — hệ thống trích xuất trường. Xác nhận hồ sơ chính thức trước khi so khớp. Thành tựu: mỗi dòng một gạch đầu dòng.',
      bodyEn:
        'Open Profile: fill the form or upload PDF/PPTX — fields are extracted for you. Confirm the official profile before matching. Achievements: one bullet per line.',
      icon: FileTextIcon,
    },
    {
      titleVi: '2. So khớp và kết nối',
      titleEn: '2. Matches and connections',
      bodyVi:
        'So khớp: chạy với danh bạ đối tác. Chọn đối tác → soạn lời giới thiệu → Kết nối để theo dõi trạng thái (chờ / đã chấp nhận).',
      bodyEn:
        'Matches: run against the partners directory. Pick a partner → draft an intro → track status on Connections (pending / accepted).',
      icon: SparklesIcon,
    },
    {
      titleVi: '3. Nhà đầu tư và phòng giả lập',
      titleEn: '3. Investors and sandbox',
      bodyVi:
        'So khớp nhà đầu tư (mô phỏng) mở quy trình kiểm chứng và phòng thuyết trình. Tài khoản mới có thể chờ admin duyệt. Có kết nối đã chấp nhận thì mở Phòng giả lập.',
      bodyEn:
        'Investor matching (demo) unlocks the validation flow and pitch room. New accounts may await admin approval. With an accepted connection, open Sandbox.',
      icon: HandshakeIcon,
    },
  ],
  intake: [
    {
      titleVi: 'Chào nhân sự NIC — Không gian Intake',
      titleEn: 'Welcome NIC staff — Intake workspace',
      bodyVi:
        'Bạn là bộ lọc deal-flow: nhận tài liệu, lọc hồ sơ, xếp hạng, so khớp giao thoa, shortlist, rồi gửi báo cáo Word/email cho mentor — trí tuệ nhân tạo hỗ trợ, người chốt.',
      bodyEn:
        'You are deal-flow HR: receive decks, filter applications, rank, cross-match, shortlist, then send Word/email reports to mentors — AI assists, humans decide.',
      icon: Building2Icon,
    },
    {
      titleVi: '1. Chương trình và tải lên',
      titleEn: '1. Programs and upload',
      bodyVi:
        'Tạo chương trình (ngành, giai đoạn, rubric = 100). Tải PDF/DOCX/PPT/XLS… tại Hồ sơ. Liên kết công khai trên Tổng quan để startup tự nộp.',
      bodyEn:
        'Create a program (sectors, stages, rubric = 100). Upload PDF/DOCX/PPT/XLS… under Applications. Share the public link from Overview for self-submit.',
      icon: FileTextIcon,
    },
    {
      titleVi: '2. Duyệt · Xếp hạng · So khớp',
      titleEn: '2. Review · Ranking · Matching',
      bodyVi:
        'Tổ chức: duyệt hồ sơ cần kiểm tra (xác nhận profile). Xếp hạng: chấm bằng trí tuệ nhân tạo. So khớp: giao thoa luận điểm chương trình × startup. Không spam bộ lọc — Enter để áp dụng.',
      bodyEn:
        'Organization: approve needs-review apps (confirm profile). Ranking: AI score. Matching: program thesis × startup intersection. Do not spam filters — press Enter to apply.',
      icon: SparklesIcon,
    },
    {
      titleVi: '3. Báo cáo nhân sự (Word + email)',
      titleEn: '3. HR report (Word + email)',
      bodyVi:
        'Chương trình → Báo cáo: shortlist gợi ý → Tải báo cáo Word → Mở email → đính kèm gửi mentor. Đúng brief: lọc xong gửi báo cáo về.',
      bodyEn:
        'Program → Report: suggested shortlist → download Word report → open mail client → attach for mentors. Matches the mentor brief: filter, then report back.',
      icon: BriefcaseIcon,
    },
  ],
  admin: [
    {
      titleVi: 'Quản trị nền tảng NIC',
      titleEn: 'NIC platform admin',
      bodyVi:
        'Duyệt tài khoản Khởi nghiệp và Intake (chờ → hoạt động). Thanh bên: Tổng quan, Tài khoản, Hoạt động + lối tắt So khớp / Chương trình / Tổ chức.',
      bodyEn:
        'Approve Startup and Intake accounts (pending → active). Sidebar: Overview, Accounts, Activity + shortcuts to Matching / Programs / Org.',
      icon: ShieldCheckIcon,
    },
    {
      titleVi: 'Duyệt hàng loạt / từ chối',
      titleEn: 'Bulk approve / reject',
      bodyVi:
        'Chọn nhiều người dùng → duyệt hoặc từ chối (bắt buộc lý do). Không để trang tự tải lặp — bấm Làm mới khi cần.',
      bodyEn:
        'Multi-select users → approve or reject (reason required). No auto-spam polling — click Refresh when needed.',
      icon: CheckCircle2Icon,
    },
  ],
}

const storageKey = (audience: TutorialAudience) => `nf.tutorial.v1.${audience}`

export function useTutorial(audience: TutorialAudience) {
  const [open, setOpen] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      const seen = localStorage.getItem(storageKey(audience))
      if (!seen) setOpen(true)
    } catch {
      /* ignore */
    }
    setReady(true)
  }, [audience])

  const dismiss = (permanent = true) => {
    setOpen(false)
    if (permanent) {
      try {
        localStorage.setItem(storageKey(audience), '1')
      } catch {
        /* ignore */
      }
    }
  }

  const reopen = () => setOpen(true)

  return { open, setOpen, dismiss, reopen, ready }
}

export function ProductTutorial({
  audience,
  open,
  onOpenChange,
  onDone,
}: {
  audience: TutorialAudience
  open: boolean
  onOpenChange: (v: boolean) => void
  onDone?: () => void
}) {
  const { tx, lang } = useTx()
  const steps = STEPS[audience]
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (open) setStep(0)
  }, [open, audience])

  const current = steps[step]
  const Icon = current.icon
  const pct = Math.round(((step + 1) / steps.length) * 100)
  const title = lang === 'vi' ? current.titleVi : current.titleEn
  const body = lang === 'vi' ? current.bodyVi : current.bodyEn

  const audienceLabel =
    audience === 'startup'
      ? tx('Khởi nghiệp', 'Startup')
      : audience === 'intake'
        ? tx('Intake · NIC', 'Intake · NIC')
        : tx('Quản trị', 'Admin')

  const finish = () => {
    onOpenChange(false)
    onDone?.()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v)
        if (!v) onDone?.()
      }}
    >
      <DialogContent
        showCloseButton
        className={cn(
          // Override default dialog: flex column, no default gap/padding
          '!flex !max-h-[min(90dvh,36rem)] w-[min(100%-1rem,28rem)] !max-w-[28rem] !translate-x-[-50%] flex-col !gap-0 overflow-hidden !p-0',
          // Mobile: near top with safe area; desktop: vertically centered
          'top-[max(0.5rem,env(safe-area-inset-top,0.5rem))] !-translate-y-0',
          'sm:top-1/2 sm:!-translate-y-1/2',
          'rounded-2xl shadow-xl',
        )}
      >
        {/* Header */}
        <div className="shrink-0 border-b bg-primary/8 px-4 pb-3 pt-3.5 sm:px-5 sm:pb-3.5 sm:pt-4">
          <DialogHeader className="!gap-2 text-left">
            <div className="flex flex-wrap items-center gap-1.5 pr-9">
              <Badge
                variant="secondary"
                className="gap-1 text-[10px] sm:text-xs"
              >
                <BookOpenIcon className="size-3" />
                {tx('Hướng dẫn', 'Tutorial')}
              </Badge>
              <Badge variant="outline" className="text-[10px] sm:text-xs">
                {audienceLabel}
              </Badge>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {step + 1}/{steps.length}
              </span>
            </div>
            <DialogTitle className="flex items-start gap-2.5 !text-sm !leading-snug font-semibold sm:!text-lg">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary sm:size-9">
                <Icon className="size-3.5 sm:size-4" />
              </span>
              <span className="min-w-0 flex-1 break-words text-balance">
                {title}
              </span>
            </DialogTitle>
            <DialogDescription className="!text-[11px] leading-relaxed sm:!text-xs">
              {tx(
                'Mở lại bất kỳ lúc nào từ nút Hướng dẫn trên thanh trên.',
                'Reopen anytime from Tutorial in the header.',
              )}
            </DialogDescription>
          </DialogHeader>
          <Progress value={pct} className="mt-3 h-1.5" />
        </div>

        {/* Scrollable body */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 sm:py-5">
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
            {body}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {steps.map((s, i) => (
              <button
                key={s.titleEn}
                type="button"
                onClick={() => setStep(i)}
                className={cn(
                  'h-2.5 rounded-full transition-all',
                  i === step
                    ? 'w-7 bg-primary'
                    : 'w-2.5 bg-muted-foreground/30 hover:bg-muted-foreground/50',
                )}
                aria-label={tx(`Bước ${i + 1}`, `Step ${i + 1}`)}
                aria-current={i === step ? 'step' : undefined}
              />
            ))}
          </div>
        </div>

        {/* Footer — always one row: Skip | Back + Next (no DialogFooter defaults) */}
        <div
          className={cn(
            'flex shrink-0 items-center justify-between gap-2 border-t bg-background/95 px-3 py-3 sm:px-5',
            'pb-[max(0.75rem,env(safe-area-inset-bottom))]',
          )}
        >
          <Button
            variant="ghost"
            size="sm"
            className="h-10 shrink-0 rounded-full px-3 sm:h-9"
            onClick={finish}
          >
            {tx('Bỏ qua', 'Skip')}
          </Button>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
            {step > 0 ? (
              <Button
                variant="outline"
                size="sm"
                className="h-10 min-w-0 rounded-full px-3 sm:h-9"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
              >
                {tx('Trước', 'Back')}
              </Button>
            ) : null}
            {step < steps.length - 1 ? (
              <Button
                size="sm"
                className="h-10 min-w-[5.5rem] rounded-full px-4 sm:h-9"
                onClick={() =>
                  setStep((s) => Math.min(steps.length - 1, s + 1))
                }
              >
                {tx('Tiếp', 'Next')}
                <ArrowRightIcon data-icon="inline-end" className="size-3.5" />
              </Button>
            ) : (
              <Button
                size="sm"
                className="h-10 min-w-0 rounded-full px-3 sm:h-9"
                onClick={finish}
              >
                <CheckCircle2Icon data-icon="inline-start" className="size-3.5" />
                {tx('Bắt đầu', 'Get started')}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Compact trigger — always visible (including mobile header). */
export function TutorialTrigger({
  onClick,
  className,
}: {
  onClick: () => void
  className?: string
}) {
  const { tx } = useTx()
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className={cn(
        'h-8 shrink-0 gap-1 rounded-full px-2.5 text-xs sm:px-3',
        className,
      )}
      onClick={onClick}
      aria-label={tx('Mở hướng dẫn', 'Open tutorial')}
    >
      <BookOpenIcon className="size-3.5" data-icon="inline-start" />
      <span className="hidden xs:inline sm:inline">
        {tx('Hướng dẫn', 'Tutorial')}
      </span>
    </Button>
  )
}
