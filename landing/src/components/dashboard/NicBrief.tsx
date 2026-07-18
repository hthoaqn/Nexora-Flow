'use client'

import { Building2Icon, MailIcon, SparklesIcon } from 'lucide-react'
import { useTx } from '@/lib/tx'
import { cn } from '@/lib/utils'

/**
 * Compact NIC deal-flow brief — intake workspace only.
 */
export function NicBrief({ className }: { className?: string }) {
  const { tx } = useTx()

  const pillars = [
    {
      icon: SparklesIcon,
      t: tx('Phân tích hồ sơ', 'Analyze profiles'),
      d: tx(
        'Đọc tài liệu và hồ sơ: năng lực, nhu cầu, khoảng trống — trí tuệ nhân tạo trích xuất, người xác nhận.',
        'Read decks and profiles: capabilities, needs, gaps — AI extracts, humans confirm.',
      ),
    },
    {
      icon: Building2Icon,
      t: tx('Ghép đối tác phù hợp', 'Match partners'),
      d: tx(
        'Doanh nghiệp, trường đại học, phòng thí nghiệm, quỹ — điểm phù hợp có bằng chứng, xếp hạng có điều kiện.',
        'Corporates, universities, labs, funds — evidence-bound fit scores, ranking with eligibility.',
      ),
    },
    {
      icon: MailIcon,
      t: tx('Giới thiệu và lịch họp', 'Introductions and meetings'),
      d: tx(
        'Soạn lời giới thiệu cá nhân hóa, gợi ý lịch — nhân sự NIC duyệt, không tự gửi.',
        'Personalized intros and meeting suggestions — NIC staff approve, never auto-send.',
      ),
    },
  ]

  return (
    <div
      className={cn(
        'portal-card grid gap-3 p-4 sm:grid-cols-3 sm:gap-4 sm:p-5',
        className,
      )}
    >
      <div className="sm:col-span-3">
        <p className="portal-chip w-fit">
          {tx(
            'Trung tâm Đổi mới sáng tạo Quốc gia',
            'National Innovation Center',
          )}
        </p>
        <h3 className="mt-2 font-heading text-sm font-semibold tracking-tight sm:text-base">
          {tx(
            'Nền tảng ghép deal-flow — đề bài NIC',
            'Deal-flow matchmaker — NIC brief',
          )}
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {tx(
            'Kết nối khởi nghiệp với doanh nghiệp, trường đại học, viện nghiên cứu và quỹ — trí tuệ nhân tạo gợi ý, con người quyết định.',
            'Connect startups with companies, universities, research institutes, and funds — AI suggests, humans decide.',
          )}
        </p>
      </div>
      {pillars.map((p) => (
        <div
          key={p.t}
          className="rounded-xl border border-border/70 bg-background/50 p-3.5 transition-colors hover:border-primary/30"
        >
          <span className="mb-2 flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <p.icon className="size-4" />
          </span>
          <p className="text-xs font-semibold">{p.t}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            {p.d}
          </p>
        </div>
      ))}
    </div>
  )
}
