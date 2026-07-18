// @ts-nocheck
'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export function PortalHero({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('portal-hero w-full min-w-0 p-5 sm:p-7', className)}>
      <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          {eyebrow ? <div className="portal-chip">{eyebrow}</div> : null}
          <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            {title}
          </h1>
          {description ? (
            <p className="text-sm leading-relaxed text-muted-foreground sm:text-[0.95rem]">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </div>
  )
}

export function PortalStat({
  label,
  value,
  hint,
  icon,
  footer,
  className,
}: {
  label: string
  value: React.ReactNode
  hint?: string
  icon?: React.ReactNode
  footer?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('portal-card p-5', className)}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          {label}
        </p>
        {icon ? (
          <span className="flex size-9 items-center justify-center rounded-xl border border-border/80 bg-primary/10 text-primary">
            {icon}
          </span>
        ) : null}
      </div>
      <div className="portal-stat-value text-3xl leading-none">{value}</div>
      {hint ? <p className="mt-2 text-xs text-muted-foreground">{hint}</p> : null}
      {footer ? <div className="mt-4">{footer}</div> : null}
    </div>
  )
}

export function PortalProgress({ value, className }: { value: number; className?: string }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0))
  return (
    <div className={cn('portal-progress', className)} aria-valuenow={v} role="progressbar">
      <i style={{ width: `${v}%` }} />
    </div>
  )
}

export function PortalSection({
  title,
  description,
  action,
  children,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('portal-card', className)}>
      <div className="flex items-start justify-between gap-3 border-b border-border/70 px-5 py-4">
        <div className="min-w-0">
          <h2 className="font-heading text-base font-semibold tracking-tight">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

export function PortalEmpty({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-14 text-center">
      {icon ? (
        <span className="flex size-12 items-center justify-center rounded-2xl border border-border bg-card text-primary shadow-sm">
          {icon}
        </span>
      ) : null}
      <div className="max-w-sm space-y-1">
        <p className="font-heading text-sm font-semibold">{title}</p>
        {description ? (
          <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  )
}

export function PortalSkeletonGrid({ n = 4 }: { n?: number }) {
  return (
    <div className="portal-stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: n }).map((_, i) => (
        <Skeleton key={i} className="h-28 rounded-2xl" />
      ))}
    </div>
  )
}

export function DemoBadge({ label = 'Demo' }: { label?: string }) {
  return (
    <Badge
      variant="outline"
      className="border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-700 dark:text-amber-400"
    >
      {label}
    </Badge>
  )
}

export function SoftButton(props: React.ComponentProps<typeof Button>) {
  return (
    <Button
      {...props}
      className={cn(
        'rounded-full transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98]',
        props.className,
      )}
    />
  )
}
