'use client'

/**
 * Contextual "what next?" guide — Intake (Next Link) + Startup (href or onClick).
 * Keeps operators in flow without hunting the sidebar.
 */

import type { ComponentType, ReactNode } from 'react'
import Link from 'next/link'
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  CircleDotIcon,
  SparklesIcon,
} from 'lucide-react'
import { useTx } from '@/lib/tx'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type NextStepItem = {
  id: string
  /** Already finished */
  done?: boolean
  /** Emphasize as the current recommended action */
  primary?: boolean
  titleVi: string
  titleEn: string
  bodyVi: string
  bodyEn: string
  ctaVi: string
  ctaEn: string
  href?: string
  /** SPA navigation (startup portal) */
  onClick?: () => void
  icon?: ComponentType<{ className?: string }>
}

export function NextStepsGuide({
  titleVi = 'Bước tiếp theo',
  titleEn = 'Next steps',
  subtitleVi,
  subtitleEn,
  steps,
  className,
  /** When true, use <a> for same-origin SPA paths under startup portal if needed */
  linkMode = 'next',
}: {
  titleVi?: string
  titleEn?: string
  subtitleVi?: string
  subtitleEn?: string
  steps: NextStepItem[]
  className?: string
  linkMode?: 'next' | 'a'
}) {
  const { tx, lang } = useTx()
  const title = lang === 'en' ? titleEn : titleVi
  const subtitle =
    lang === 'en' ? subtitleEn || subtitleVi : subtitleVi || subtitleEn
  const visible = steps.filter(Boolean)
  if (!visible.length) return null

  const primary = visible.find((s) => s.primary && !s.done) || visible.find((s) => !s.done)

  return (
    <section
      className={cn(
        'portal-card overflow-hidden border-primary/20 bg-primary/[0.04] !p-0',
        className,
      )}
      aria-label={title}
    >
      <div className="flex flex-col gap-1 border-b border-primary/15 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <SparklesIcon className="size-4 text-primary" />
            <h3 className="font-heading text-sm font-semibold sm:text-base">
              {title}
            </h3>
            {primary ? (
              <Badge variant="default" className="text-[10px]">
                {tx('Ưu tiên', 'Priority')}
              </Badge>
            ) : null}
          </div>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
      </div>

      <ol className="divide-y divide-border/60">
        {visible.map((step, i) => {
          const StepIcon = step.icon
          const tTitle = lang === 'en' ? step.titleEn : step.titleVi
          const tBody = lang === 'en' ? step.bodyEn : step.bodyVi
          const tCta = lang === 'en' ? step.ctaEn : step.ctaVi
          const isPrimary = !!step.primary && !step.done

          const cta = (
            <Button
              size="sm"
              variant={isPrimary ? 'default' : 'outline'}
              className="h-9 w-full shrink-0 rounded-full sm:h-8 sm:w-auto"
              onClick={step.onClick}
              disabled={step.done && !step.href && !step.onClick}
            >
              {tCta}
              <ArrowRightIcon data-icon="inline-end" className="size-3.5" />
            </Button>
          )

          let action: ReactNode = null
          if (step.done) {
            action = (
              <Badge variant="secondary" className="gap-1 text-[10px]">
                <CheckCircle2Icon className="size-3" />
                {tx('Xong', 'Done')}
              </Badge>
            )
          } else if (step.href && !step.onClick) {
            action =
              linkMode === 'a' ? (
                <Button
                  size="sm"
                  variant={isPrimary ? 'default' : 'outline'}
                  className="h-9 w-full rounded-full sm:h-8 sm:w-auto"
                  render={<a href={step.href} />}
                  nativeButton={false}
                >
                  {tCta}
                  <ArrowRightIcon data-icon="inline-end" className="size-3.5" />
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant={isPrimary ? 'default' : 'outline'}
                  className="h-9 w-full rounded-full sm:h-8 sm:w-auto"
                  render={<Link href={step.href} />}
                  nativeButton={false}
                >
                  {tCta}
                  <ArrowRightIcon data-icon="inline-end" className="size-3.5" />
                </Button>
              )
          } else {
            action = cta
          }

          return (
            <li
              key={step.id}
              className={cn(
                'flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4 sm:px-5',
                isPrimary && 'bg-primary/8',
                step.done && 'opacity-70',
              )}
            >
              <div className="flex min-w-0 flex-1 gap-3">
                <span
                  className={cn(
                    'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border text-xs font-bold tabular-nums',
                    step.done
                      ? 'border-primary/30 bg-primary/15 text-primary'
                      : isPrimary
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-muted/50 text-muted-foreground',
                  )}
                >
                  {step.done ? (
                    <CheckCircle2Icon className="size-4" />
                  ) : StepIcon ? (
                    <StepIcon className="size-3.5" />
                  ) : (
                    i + 1
                  )}
                </span>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold leading-snug">
                    {isPrimary ? (
                      <CircleDotIcon className="size-3.5 text-primary" />
                    ) : null}
                    {tTitle}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {tBody}
                  </p>
                </div>
              </div>
              <div className="sm:shrink-0">{action}</div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

/** Horizontal journey strip — shows pipeline stages */
export function JourneyStrip({
  stages,
  className,
  linkMode = 'next',
}: {
  stages: {
    id: string
    labelVi: string
    labelEn: string
    href?: string
    active?: boolean
    done?: boolean
  }[]
  className?: string
  linkMode?: 'next' | 'a'
}) {
  const { lang } = useTx()
  return (
    <nav
      aria-label={lang === 'en' ? 'Workflow' : 'Quy trình'}
      className={cn(
        'flex gap-1 overflow-x-auto overscroll-x-contain pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      {stages.map((s, i) => {
        const label = lang === 'en' ? s.labelEn : s.labelVi
        const inner = (
          <span
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium whitespace-nowrap transition-colors',
              s.active &&
                'border-primary bg-primary text-primary-foreground',
              s.done &&
                !s.active &&
                'border-primary/30 bg-primary/10 text-primary',
              !s.active &&
                !s.done &&
                'border-border bg-muted/40 text-muted-foreground',
            )}
          >
            <span className="tabular-nums opacity-70">{i + 1}</span>
            {label}
          </span>
        )
        if (s.href) {
          if (linkMode === 'a') {
            return (
              <a key={s.id} href={s.href} className="shrink-0">
                {inner}
              </a>
            )
          }
          return (
            <Link key={s.id} href={s.href} className="shrink-0">
              {inner}
            </Link>
          )
        }
        return (
          <span key={s.id} className="shrink-0">
            {inner}
          </span>
        )
      })}
    </nav>
  )
}
