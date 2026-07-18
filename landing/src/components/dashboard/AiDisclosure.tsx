'use client'
import { useTx } from '@/lib/tx'
import { SparklesIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Compact notice — AI supports, humans decide */
export function AiDisclosure({ className }: { className?: string }) {
  const { tx } = useTx()
  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/8 px-3.5 py-2.5 text-xs leading-relaxed text-muted-foreground shadow-[0_0_0_1px_color-mix(in_oklch,var(--primary)_8%,transparent)]',
        className,
      )}
    >
      <SparklesIcon className="mt-0.5 size-3.5 shrink-0 text-primary" />
      <span>
        <span className="font-semibold text-foreground">
          {tx(
            'Trí tuệ nhân tạo hỗ trợ · con người quyết định',
            'AI assists · humans decide',
          )}
        </span>
        {tx(
          ' — chấm điểm và gợi ý có bằng chứng từ tài liệu hoặc hồ sơ. Không tự chấp nhận hay từ chối. Nhân sự NIC duyệt lời giới thiệu và lịch họp.',
          ' — scores and suggestions are evidence-bound from decks or profiles. No automatic accept or reject. NIC staff approve introductions and meetings.',
        )}
      </span>
    </div>
  )
}
