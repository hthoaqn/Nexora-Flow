'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Animated count-up hook. Eases a number from 0 → target on mount / change.
 * Respects prefers-reduced-motion.
 */
export function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(0)
  const raf = useRef<number | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') {
      setValue(target)
      return
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce || !Number.isFinite(target)) {
      setValue(target)
      return
    }
    const start = performance.now()
    const from = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      // easeOutExpo
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
      setValue(from + (target - from) * eased)
      if (t < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current)
    }
  }, [target, duration])

  return value
}

/**
 * GlowCard — a premium surface with a gradient hairline border, soft inner
 * highlight and an optional accent glow that intensifies on hover.
 */
export function GlowCard({
  children,
  className,
  accent,
  interactive = true,
}: {
  children: ReactNode
  className?: string
  /** oklch/hex color used for the ambient glow. Defaults to primary. */
  accent?: string
  interactive?: boolean
}) {
  const glow = accent ?? 'var(--primary)'
  return (
    <div
      className={cn(
        'group/glow relative overflow-hidden rounded-2xl',
        'border border-white/10 bg-card/70 backdrop-blur-xl',
        'shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset,0_10px_30px_-12px_rgba(0,0,0,0.35)]',
        'transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]',
        interactive &&
          'hover:-translate-y-0.5 hover:shadow-[0_1px_0_0_rgba(255,255,255,0.08)_inset,0_24px_50px_-18px_rgba(0,0,0,0.5)]',
        className,
      )}
    >
      {/* gradient hairline */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-60"
        style={{
          background: `linear-gradient(135deg, color-mix(in oklch, ${glow} 22%, transparent), transparent 40%)`,
          WebkitMask:
            'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
          padding: 1,
        }}
      />
      {/* ambient glow blob */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 size-40 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover/glow:opacity-100"
        style={{ background: `color-mix(in oklch, ${glow} 45%, transparent)` }}
      />
      <div className="relative">{children}</div>
    </div>
  )
}

/**
 * Small horizontal segmented bar used for distributions.
 */
export function SegmentBar({
  segments,
  className,
}: {
  segments: { value: number; color: string; label?: string }[]
  className?: string
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1
  return (
    <div
      className={cn(
        'flex h-2.5 w-full overflow-hidden rounded-full bg-muted/60',
        className,
      )}
    >
      {segments.map((s, i) => (
        <div
          key={i}
          className="h-full transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] first:rounded-l-full last:rounded-r-full"
          style={{
            width: `${(s.value / total) * 100}%`,
            background: s.color,
          }}
          title={s.label}
        />
      ))}
    </div>
  )
}
