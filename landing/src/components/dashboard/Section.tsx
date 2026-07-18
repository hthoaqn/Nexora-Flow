import type { ReactNode } from 'react'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'

/** Vertical page rhythm — tighter than gap-5 desert spacing */
export function PageShell({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-4', className)}>{children}</div>
  )
}

/** Dense filter / action strip */
export function Toolbar({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'dash-card flex flex-col gap-2.5 !p-3 sm:flex-row sm:flex-wrap sm:items-center',
        className,
      )}
    >
      {children}
    </div>
  )
}

/** Section card with header — fills visual mass */
export function Section({
  title,
  description,
  action,
  children,
  footer,
  className,
  contentClassName,
  size = 'default',
}: {
  title?: string
  description?: string
  action?: ReactNode
  children: ReactNode
  footer?: ReactNode
  className?: string
  contentClassName?: string
  size?: 'default' | 'sm'
}) {
  return (
    <Card size={size} className={cn('dash-card', className)}>
      {title || description || action ? (
        <CardHeader className="border-b [.border-b]:pb-3">
          {title ? <CardTitle className="font-heading">{title}</CardTitle> : null}
          {description ? <CardDescription>{description}</CardDescription> : null}
          {action ? <CardAction>{action}</CardAction> : null}
        </CardHeader>
      ) : null}
      <CardContent className={cn(!title && !description && !action && 'pt-0', contentClassName)}>
        {children}
      </CardContent>
      {footer ? <CardFooter>{footer}</CardFooter> : null}
    </Card>
  )
}

/** Table / list surface without double padding */
export function DataPanel({
  children,
  className,
  footer,
}: {
  children: ReactNode
  className?: string
  footer?: ReactNode
}) {
  return (
    <div
      className={cn(
        'dash-card overflow-hidden !p-0',
        className,
      )}
    >
      {children}
      {footer ? (
        <div className="flex items-center justify-between gap-2 border-t bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          {footer}
        </div>
      ) : null}
    </div>
  )
}

/** 2-col form/settings grid */
export function SplitGrid({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('grid gap-4 lg:grid-cols-2', className)}>{children}</div>
  )
}

/** Meta chip row for tags */
export function MetaRow({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}
