'use client'

import type { ComponentType, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useCountUp } from './Ambient'

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  className,
}: {
  label: string
  value: ReactNode
  icon?: ComponentType<{ className?: string }>
  hint?: ReactNode
  accent?: string
  className?: string
}) {
  const numeric = typeof value === 'number' ? value : null
  const animated = useCountUp(numeric ?? 0)

  return (
    <div className={cn('stat-card', className)}>
      <div className="relative flex items-start gap-3">
        {Icon ? (
          <span className="stat-icon shrink-0">
            <Icon className="size-4" />
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            {label}
          </p>
          <p className="mt-1 font-heading text-2xl font-bold leading-none tracking-tight tabular-nums">
            {numeric !== null ? Math.round(animated).toLocaleString() : value}
          </p>
          {hint ? (
            <p className="mt-1.5 truncate text-[11px] text-muted-foreground">{hint}</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function StatGrid({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('grid grid-cols-2 gap-3 lg:grid-cols-4', className)}>
      {children}
    </div>
  )
}
