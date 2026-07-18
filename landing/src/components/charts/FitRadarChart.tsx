'use client'

import { TrendingUp } from 'lucide-react'
import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from 'recharts'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'

export type RadarPoint = {
  dim: string
  score: number
  /** optional second series */
  baseline?: number
}

const chartConfig = {
  score: {
    label: 'Fit',
    color: 'var(--chart-1)',
  },
  baseline: {
    label: 'Baseline',
    color: 'var(--chart-2)',
  },
} satisfies ChartConfig

export function FitRadarChart({
  title,
  description,
  data,
  footer,
  showBaseline = false,
}: {
  title: string
  description?: string
  data: RadarPoint[]
  footer?: string
  showBaseline?: boolean
}) {
  const avg =
    data.length === 0
      ? 0
      : Math.round(data.reduce((s, d) => s + (d.score || 0), 0) / data.length)

  return (
    <Card className="portal-card border-0 shadow-none ring-1 ring-foreground/10">
      <CardHeader className="items-center pb-2">
        <CardTitle className="font-heading text-base">{title}</CardTitle>
        {description ? (
          <CardDescription className="text-center">{description}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="pb-0">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[260px] w-full"
        >
          <RadarChart data={data}>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="line" />}
            />
            <PolarAngleAxis dataKey="dim" tick={{ fontSize: 11 }} />
            <PolarGrid radialLines={false} />
            <Radar
              dataKey="score"
              fill="var(--color-score)"
              fillOpacity={0}
              stroke="var(--color-score)"
              strokeWidth={2}
            />
            {showBaseline ? (
              <Radar
                dataKey="baseline"
                fill="var(--color-baseline)"
                fillOpacity={0}
                stroke="var(--color-baseline)"
                strokeWidth={2}
              />
            ) : null}
          </RadarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col gap-1 pt-2 text-sm">
        <div className="flex items-center gap-2 font-medium leading-none">
          Avg fit {avg}
          <TrendingUp className="size-4 text-primary" />
        </div>
        {footer ? (
          <div className="text-xs leading-none text-muted-foreground">{footer}</div>
        ) : null}
      </CardFooter>
    </Card>
  )
}
