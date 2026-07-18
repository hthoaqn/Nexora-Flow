import type { ReactNode } from 'react'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { cn } from '@/lib/utils'

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string
  description?: string
  action?: ReactNode
  icon?: ReactNode
  className?: string
}) {
  return (
    <Empty
      className={cn(
        'relative min-h-48 overflow-hidden rounded-xl border border-dashed border-primary/25 bg-primary/[0.03] py-12',
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 left-1/2 size-48 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
      />
      <EmptyHeader>
        {icon ? (
          <EmptyMedia variant="icon" className="stat-icon size-11 rounded-xl">
            {icon}
          </EmptyMedia>
        ) : null}
        <EmptyTitle className="font-heading text-base font-semibold">{title}</EmptyTitle>
        {description ? (
          <EmptyDescription className="max-w-sm text-sm">{description}</EmptyDescription>
        ) : null}
      </EmptyHeader>
      {action ? <EmptyContent className="mt-2">{action}</EmptyContent> : null}
    </Empty>
  )
}
