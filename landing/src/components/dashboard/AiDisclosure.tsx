import { SparklesIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Compact AI notice bar */
export function AiDisclosure({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 text-xs text-muted-foreground',
        className,
      )}
    >
      <SparklesIcon className="size-3.5 shrink-0 text-primary" />
      <span>
        <span className="font-medium text-foreground">AI hỗ trợ</span>
        {' — gợi ý có bằng chứng, quyết định cuối do con người.'}
      </span>
    </div>
  )
}
