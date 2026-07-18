'use client'

import { Badge } from '@/components/ui/badge'
import { useTx } from '@/lib/tx'
import { cn } from '@/lib/utils'

/** Required label for all simulated data (concac.txt §II.6) */
export function DemoDataBadge({ className }: { className?: string }) {
  const { tx } = useTx()
  return (
    <Badge
      variant="outline"
      className={cn(
        'border-amber-500/40 bg-amber-500/10 text-[10px] font-medium text-amber-700 dark:text-amber-400',
        className,
      )}
    >
      {tx('Dữ liệu mô phỏng', 'Simulated data')}
    </Badge>
  )
}
