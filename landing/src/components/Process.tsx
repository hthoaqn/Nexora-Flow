'use client'

import { useEffect, useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  FileTextIcon,
  MailIcon,
  CalendarIcon,
  TargetIcon,
  SparklesIcon,
  CheckIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const stepIcons = [FileTextIcon, TargetIcon, SparklesIcon, MailIcon, CalendarIcon]

function Visual({ index, scoreLabel }: { index: number; scoreLabel: string }) {
  if (index === 0) {
    return (
      <Card className="surface-elevated gap-0 overflow-hidden border-border/50 py-0">
        <div className="flex items-center gap-2 border-b border-border/50 bg-muted/40 px-4 py-2.5">
          <span className="size-2 rounded-full bg-red-400/80" />
          <span className="size-2 rounded-full bg-amber-400/80" />
          <span className="size-2 rounded-full bg-emerald-400/80" />
          <Badge variant="secondary" className="ml-2 rounded-md text-[10px]">
            pitch-deck.pdf
          </Badge>
        </div>
        <CardContent className="space-y-3 py-5">
          {[80, 55, 90, 40, 70, 62].map((w, i) => (
            <div
              key={i}
              className="h-2.5 rounded-full bg-gradient-to-r from-muted to-muted/60"
              style={{ width: `${w}%` }}
            />
          ))}
          <div className="flex flex-wrap gap-1.5 pt-2">
            <Badge className="rounded-full">Product</Badge>
            <Badge className="rounded-full">Market</Badge>
            <Badge
              variant="outline"
              className="rounded-full border-amber-500/40 text-amber-600 dark:text-amber-400"
            >
              Traction?
            </Badge>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (index === 1) {
    const ranks = [
      { name: 'Mekong Ventures', meta: 'Fund · Climate', score: 92, rank: 1 },
      { name: 'Delta Corp R&D', meta: 'Corporate · Agri', score: 87, rank: 2 },
      { name: 'SEA Seed Lab', meta: 'University · Water', score: 81, rank: 3 },
    ]
    return (
      <Card className="surface-elevated gap-0 overflow-hidden border-border/50 py-0">
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 border-b border-border/50 bg-gradient-to-br from-primary/12 via-card to-card px-5 py-4">
          <div>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Network ranking
            </CardTitle>
            <p className="mt-0.5 font-heading text-base font-semibold">
              48 partners scored
            </p>
          </div>
          <div className="score-ring-lg !size-[4.25rem] shrink-0 text-center">
            <div>
              <div className="font-heading text-xl font-bold text-primary">92</div>
              <div className="text-[7px] font-semibold uppercase tracking-wider text-muted-foreground">
                {scoreLabel}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 px-4 py-4">
          {ranks.map((r) => (
            <div
              key={r.name}
              className={cn(
                'flex items-center gap-3 rounded-xl border px-3 py-2.5',
                r.rank === 1
                  ? 'border-primary/30 bg-primary/8 shadow-sm'
                  : 'border-border/50 bg-muted/20',
              )}
            >
              <span
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold tabular-nums',
                  r.rank === 1
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {r.rank}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{r.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">{r.meta}</p>
              </div>
              <div className="text-right">
                <p className="font-heading text-sm font-bold tabular-nums text-primary">
                  {r.score}
                </p>
                <div className="mt-1 h-1 w-12 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${r.score}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Badge variant="secondary" className="rounded-full text-[10px]">
              #1 of 48
            </Badge>
            <Badge variant="outline" className="rounded-full text-[10px]">
              Top tier
            </Badge>
            <Badge
              variant="outline"
              className="rounded-full border-primary/30 text-[10px] text-primary"
            >
              Evidence ready
            </Badge>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (index === 2) {
    const rows = [
      ['Sector', 96],
      ['Stage', 91],
      ['Resources', 88],
      ['Region', 93],
    ] as const
    return (
      <Card className="surface-elevated gap-0 border-border/50 py-0">
        <CardHeader className="pb-2 pt-5">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Evidence breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pb-6">
          {rows.map(([label, val]) => (
            <div key={label} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-heading font-semibold tabular-nums text-primary">
                  {val}
                </span>
              </div>
              <Progress value={val} className="h-2 w-full" />
            </div>
          ))}
          <Badge variant="outline" className="mt-1 rounded-full border-primary/30">
            Verify: pilot revenue
          </Badge>
        </CardContent>
      </Card>
    )
  }

  if (index === 3) {
    return (
      <Card className="surface-elevated gap-0 border-border/50 py-0">
        <CardHeader className="pb-2 pt-5">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="font-heading text-base">Intro email</CardTitle>
            <Badge variant="secondary" className="rounded-full gap-1">
              <span className="live-dot !size-1.5" />
              Draft
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pb-6 text-sm">
          <p className="text-muted-foreground">
            To: <span className="font-medium text-foreground">partners@mekong.vc</span>
          </p>
          <Separator />
          <p className="text-muted-foreground">
            Subject:{' '}
            <span className="font-medium text-foreground">AquaSense × Mekong — 92% fit</span>
          </p>
          <div className="rounded-xl border border-border/60 bg-muted/30 p-3 leading-relaxed text-muted-foreground">
            AquaSense khớp 92% mandate: seed-stage, AgriTech, pilot tại ĐBSCL…
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" className="rounded-full btn-glow">
              <CheckIcon className="size-3.5" />
              Approve
            </Button>
            <Button size="sm" variant="outline" className="rounded-full">
              Edit
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="surface-elevated gap-0 border-border/50 py-0">
      <CardHeader className="pb-2 pt-5">
        <CardTitle className="font-heading text-base">Shared availability</CardTitle>
        <CardDescription>This week</CardDescription>
      </CardHeader>
      <CardContent className="pb-6">
        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-9 rounded-lg border transition-colors',
                i === 7
                  ? 'border-primary bg-primary/25 shadow-[0_0_16px_-4px] shadow-primary/50'
                  : [2, 5, 11, 13, 16].includes(i)
                    ? 'border-border/40 bg-muted/80'
                    : 'border-border/50 bg-background',
              )}
            />
          ))}
        </div>
        <Badge className="mt-4 rounded-full" variant="secondary">
          Slot found · Thu 10:30
        </Badge>
      </CardContent>
    </Card>
  )
}

export function Process() {
  const { t, lang } = useI18n()
  const [active, setActive] = useState(0)
  const [manual, setManual] = useState(false)
  const trackRef = useRef<HTMLDivElement>(null)
  const manualUntil = useRef(0)
  const stepCount = t.steps.length

  // Scroll through tall track → advance steps (desktop theater)
  useEffect(() => {
    const track = trackRef.current
    if (!track) return

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return

    // Only drive scroll on large screens; mobile uses stacked cards
    const mql = window.matchMedia('(min-width: 1024px)')
    if (!mql.matches) return

    const update = () => {
      if (Date.now() < manualUntil.current) return
      const rect = track.getBoundingClientRect()
      const viewH = window.innerHeight
      const trackH = Math.max(1, track.offsetHeight)
      const scrollable = Math.max(1, trackH - viewH)
      const stickyTop = 88
      const traveled = stickyTop - rect.top
      let p = traveled / scrollable
      if (p < 0) p = 0
      if (p > 1) p = 1
      // Split runway into N equal step zones
      const idx = Math.min(stepCount - 1, Math.floor(p * stepCount + 0.001))
      setActive((prev) => (prev === idx ? prev : idx))
      setManual(false)
    }

    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update, { passive: true })
    // Lenis may not fire native scroll consistently — poll lightly while section in view
    const id = window.setInterval(() => {
      const r = track.getBoundingClientRect()
      if (r.bottom > 0 && r.top < window.innerHeight) update()
    }, 80)

    const onMql = () => {
      /* if resized below lg, no-op — mobile stack doesn't need this */
    }
    mql.addEventListener?.('change', onMql)

    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      window.clearInterval(id)
      mql.removeEventListener?.('change', onMql)
    }
  }, [stepCount])

  const pickStep = (i: number) => {
    setActive(i)
    setManual(true)
    // Hold manual selection briefly so scroll doesn't fight the click
    manualUntil.current = Date.now() + 1400
  }

  const StepIcon = stepIcons[active] ?? FileTextIcon
  const step = t.steps[active] ?? t.steps[0]

  return (
    <section
      className="relative overflow-visible border-y border-border/40 bg-muted/25 py-16 sm:py-24"
      id="process"
    >
      <div className="glow-orb glow-orb-a opacity-20" />
      <div className="relative mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="mb-10 max-w-2xl" data-rise>
          <div className="section-kicker mb-4">
            <Badge
              variant="secondary"
              className="rounded-full border border-primary/15 bg-primary/10 text-primary"
            >
              {t.processEyebrow}
            </Badge>
          </div>
          <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            {t.processTitle}
          </h2>
          <p className="mt-3 text-muted-foreground sm:text-lg">{t.processHint}</p>
        </div>

        {/* Desktop: scroll theater — sticky stage, steps advance with scroll */}
        <div
          ref={trackRef}
          className="process-track relative hidden lg:block"
          data-process-track
        >
          <div className="process-sticky">
            <div className="process-rail mb-4" aria-hidden>
              {t.steps.map((_, i) => (
                <span key={i} data-active={i <= active ? 'true' : 'false'} />
              ))}
            </div>

            <div
              className="mb-5 grid grid-cols-5 gap-1.5 rounded-2xl border border-border/50 bg-background/50 p-1.5 shadow-sm backdrop-blur-xl"
              role="tablist"
              aria-label={t.processTitle}
            >
              {t.steps.map((s, i) => {
                const Icon = stepIcons[i] ?? FileTextIcon
                const isOn = i === active
                return (
                  <button
                    key={s.n}
                    type="button"
                    role="tab"
                    aria-selected={isOn}
                    onClick={() => pickStep(i)}
                    className={cn(
                      'flex h-auto flex-col items-start gap-2 rounded-xl px-3 py-3.5 text-left transition-all',
                      isOn
                        ? 'bg-primary/12 text-foreground shadow-sm ring-1 ring-primary/25'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                    )}
                  >
                    <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      <Icon className="size-3.5 text-primary" />
                      {s.n}
                    </span>
                    <span className="line-clamp-2 text-xs font-semibold leading-snug text-foreground sm:text-sm">
                      {s.t}
                    </span>
                  </button>
                )
              })}
            </div>

            <div
              key={active}
              className="process-panel grid items-stretch gap-5 lg:grid-cols-2"
              role="tabpanel"
            >
              <Card className="glass-panel gap-0 border-0 py-0">
                <CardHeader className="gap-4 px-6 py-8">
                  <div className="flex items-center gap-3">
                    <span className="icon-tile size-12">
                      <StepIcon className="size-5" />
                    </span>
                    <Badge variant="outline" className="rounded-full">
                      {step.n} / {String(stepCount).padStart(2, '0')}
                    </Badge>
                  </div>
                  <CardTitle className="font-heading text-2xl sm:text-3xl">
                    {step.t}
                  </CardTitle>
                  <CardDescription className="text-base leading-relaxed sm:text-[1.05rem]">
                    {step.d}
                  </CardDescription>
                </CardHeader>
              </Card>
              <div className="card-glow rounded-xl">
                <Visual index={active} scoreLabel={t.matchScore} />
              </div>
            </div>

            <p className="mt-4 text-center text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              {manual
                ? lang === 'vi'
                  ? 'Đã chọn tay · cuộn tiếp để theo scroll'
                  : 'Manual pick · scroll to resume'
                : lang === 'vi'
                  ? `Bước ${active + 1}/${stepCount} · cuộn để chuyển`
                  : `Step ${active + 1}/${stepCount} · scroll to advance`}
            </p>
          </div>
        </div>

        {/* Mobile: stacked cards */}
        <div className="relative flex flex-col gap-4 lg:hidden">
          <div className="absolute bottom-4 left-[1.35rem] top-4 w-px bg-gradient-to-b from-primary via-primary/40 to-transparent" />
          {t.steps.map((s, i) => {
            const Icon = stepIcons[i] ?? FileTextIcon
            return (
              <Card
                key={s.n}
                data-rise
                className="card-glow relative ml-0 overflow-hidden border-border/60 bg-card/90"
              >
                <CardHeader className="gap-3">
                  <div className="flex items-center gap-3">
                    <span className="icon-tile z-10 size-11 shrink-0">
                      <Icon className="size-4" />
                    </span>
                    <Badge variant="secondary" className="rounded-full">
                      {s.n}
                    </Badge>
                  </div>
                  <CardTitle className="font-heading text-xl">{s.t}</CardTitle>
                  <CardDescription className="text-sm leading-relaxed">
                    {s.d}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Visual index={i} scoreLabel={t.matchScore} />
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default Process
