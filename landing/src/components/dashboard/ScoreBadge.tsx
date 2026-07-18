import { Badge } from '@/components/ui/badge'
import { confidenceLabel } from '@/lib/status'
import { cn } from '@/lib/utils'

function scoreTone(score: number): { arc: string; text: string; glow: string } {
  if (score >= 80)
    return {
      arc: 'oklch(0.7 0.17 160)',
      text: 'text-emerald-600 dark:text-emerald-400',
      glow: 'shadow-emerald-500/25',
    }
  if (score >= 60)
    return {
      arc: 'var(--primary)',
      text: 'text-primary',
      glow: 'shadow-primary/25',
    }
  if (score >= 40)
    return {
      arc: 'oklch(0.78 0.16 70)',
      text: 'text-amber-600 dark:text-amber-400',
      glow: 'shadow-amber-500/20',
    }
  return {
    arc: 'oklch(0.64 0.22 20)',
    text: 'text-rose-600 dark:text-rose-400',
    glow: 'shadow-rose-500/20',
  }
}

export function ScoreBadge({
  score,
  size = 'md',
}: {
  score?: number | null
  size?: 'sm' | 'md' | 'lg'
}) {
  if (score == null || Number.isNaN(score)) {
    return <span className="text-sm text-muted-foreground">—</span>
  }
  const n = Math.round(score)
  const tone = scoreTone(n)
  const dims =
    size === 'lg'
      ? 'size-14 text-lg'
      : size === 'sm'
        ? 'size-8 text-xs'
        : 'size-10 text-sm'

  return (
    <span
      className={cn(
        'relative inline-flex items-center justify-center rounded-full font-heading font-bold tabular-nums shadow-lg',
        dims,
        tone.text,
        tone.glow,
      )}
      style={{
        background: `conic-gradient(from -90deg, ${tone.arc} ${n * 3.6}deg, color-mix(in oklch, var(--muted) 80%, transparent) 0)`,
      }}
      title={`Điểm: ${n}`}
    >
      <span className="absolute inset-[3px] flex items-center justify-center rounded-full bg-card">
        {n}
      </span>
    </span>
  )
}

export function ConfidenceIndicator({ confidence }: { confidence?: number | null }) {
  if (confidence == null) {
    return <span className="text-xs text-muted-foreground">—</span>
  }
  const { label, badge } = confidenceLabel(confidence)
  return (
    <Badge
      variant={badge}
      className="rounded-full text-[10px]"
      title="Độ chắc chắn của dữ liệu/bằng chứng — không phải chất lượng startup"
    >
      {label} · {Math.round(confidence * 100)}%
    </Badge>
  )
}
