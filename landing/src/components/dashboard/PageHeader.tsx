import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Dense product page header — title + description + actions, no desert air */
export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
  meta,
  className,
}: {
  title: string
  description?: string
  actions?: ReactNode
  breadcrumb?: ReactNode
  meta?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'dash-card relative flex flex-col gap-3 overflow-hidden p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:p-5',
        className,
      )}
    >
      {/* Ambient corner glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-16 size-56 rounded-full bg-primary/10 blur-3xl"
      />
      <div className="relative min-w-0 flex-1">
        {breadcrumb ? (
          <div className="mb-1.5 text-xs text-muted-foreground">{breadcrumb}</div>
        ) : null}
        <h2 className="font-heading text-xl font-bold tracking-tight sm:text-2xl">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground text-pretty">
            {description}
          </p>
        ) : null}
        {meta ? <div className="mt-2.5 flex flex-wrap items-center gap-2">{meta}</div> : null}
      </div>
      {actions ? (
        <div className="relative flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          {actions}
        </div>
      ) : null}
    </div>
  )
}
