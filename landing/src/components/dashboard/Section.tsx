import type { ReactNode } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'

/** Full-width page stack — fills the app content frame edge-to-edge */
export function PageShell({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'portal-stagger flex w-full min-w-0 flex-1 flex-col gap-4',
        className,
      )}
    >
      {children}
    </div>
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
        'portal-card flex flex-col gap-2.5 !p-3 sm:flex-row sm:flex-wrap sm:items-center',
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
    <Card
      size={size}
      className={cn(
        'portal-card border-0 shadow-none ring-1 ring-foreground/10',
        className,
      )}
    >
      {title || description || action ? (
        <div
          className={cn(
            'flex flex-col gap-3 border-b px-(--card-spacing) pb-(--card-spacing)',
            // Desktop: title block left, action right — never center-stack
            'sm:flex-row sm:items-start sm:justify-between sm:gap-4',
          )}
        >
          <div className="min-w-0 flex-1 text-left">
            {title ? (
              <CardTitle className="font-heading text-base sm:text-lg">
                {title}
              </CardTitle>
            ) : null}
            {description ? (
              <CardDescription className="mt-1 max-w-2xl text-xs sm:text-sm">
                {description}
              </CardDescription>
            ) : null}
          </div>
          {action ? (
            <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
              {action}
            </div>
          ) : null}
        </div>
      ) : null}
      <CardContent
        className={cn(
          !title && !description && !action && 'pt-0',
          contentClassName,
        )}
      >
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
        'portal-card overflow-hidden !p-0',
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
