import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Dense product page header — portal-hero surface (Intake ↔ Startup visual parity) */
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
        'portal-hero relative flex w-full min-w-0 flex-col gap-3 overflow-hidden p-5 sm:flex-row sm:items-end sm:justify-between sm:gap-4 sm:p-6',
        className,
      )}
    >
      <div className="relative min-w-0 flex-1">
        {breadcrumb ? (
          <div className="mb-1.5 text-xs text-muted-foreground">{breadcrumb}</div>
        ) : null}
        <p className="portal-chip mb-2 w-fit">
          <span className="size-1.5 rounded-full bg-primary" />
          Nexora Flow
        </p>
        <h2 className="font-heading text-xl font-bold tracking-tight sm:text-2xl lg:text-[1.7rem]">
          {title}
        </h2>
        {description ? (
          <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted-foreground text-pretty sm:max-w-4xl">
            {description}
          </p>
        ) : null}
        {meta ? <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div> : null}
      </div>
      {actions ? (
        <div className="relative flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          {actions}
        </div>
      ) : null}
    </div>
  )
}
