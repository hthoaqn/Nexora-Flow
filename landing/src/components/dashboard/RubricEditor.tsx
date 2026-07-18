'use client'

import { useMemo } from 'react'
import { PlusIcon, Trash2Icon } from 'lucide-react'
import type { RubricCriterion } from '@/lib/api/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useTx } from '@/lib/tx'

function slugify(name: string, used: Set<string>): string {
  let base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40)
  if (!base) base = 'criterion'
  let key = base
  let i = 2
  while (used.has(key)) {
    key = `${base}_${i}`
    i++
  }
  return key
}

export function RubricEditor({
  criteria,
  onChange,
}: {
  criteria: Record<string, RubricCriterion>
  onChange: (next: Record<string, RubricCriterion>) => void
}) {
  const { tx } = useTx()
  const weightTotal = useMemo(
    () => Object.values(criteria).reduce((s, c) => s + (Number(c.weight) || 0), 0),
    [criteria],
  )

  const entries = Object.entries(criteria)

  const addCriterion = () => {
    const used = new Set(Object.keys(criteria))
    const name = tx('Chỉ tiêu mới', 'New criterion')
    const key = slugify(name, used)
    const remaining = Math.max(0, 100 - weightTotal)
    onChange({
      ...criteria,
      [key]: { name, weight: remaining || 5 },
    })
  }

  const removeCriterion = (key: string) => {
    const next = { ...criteria }
    delete next[key]
    onChange(next)
  }

  const update = (key: string, patch: Partial<RubricCriterion>) => {
    onChange({
      ...criteria,
      [key]: { ...criteria[key], ...patch },
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {tx(
            'Thêm / sửa / xoá chỉ tiêu. Tổng trọng số phải = 100.',
            'Add / edit / remove criteria. Weights must total 100.',
          )}
        </p>
        <Badge variant={Math.round(weightTotal) === 100 ? 'default' : 'destructive'}>
          {weightTotal}/100
        </Badge>
      </div>

      <div className="flex flex-col gap-2">
        {entries.map(([key, c]) => (
          <div
            key={key}
            className="grid grid-cols-[1fr_5rem_auto] items-center gap-2 rounded-lg border bg-muted/20 p-2"
          >
            <Input
              className="h-8"
              value={c.name}
              onChange={(e) => update(key, { name: e.target.value })}
              placeholder={tx('Tên chỉ tiêu', 'Criterion name')}
            />
            <Input
              className="h-8"
              type="number"
              min={0}
              max={100}
              value={c.weight}
              onChange={(e) => update(key, { weight: Number(e.target.value) || 0 })}
              aria-label={tx('Trọng số', 'Weight')}
            />
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => removeCriterion(key)}
              disabled={entries.length <= 1}
              aria-label={tx('Xoá chỉ tiêu', 'Remove criterion')}
            >
              <Trash2Icon />
            </Button>
          </div>
        ))}

        {!entries.length ? (
          <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
            {tx('Chưa có chỉ tiêu. Bấm thêm bên dưới.', 'No criteria yet. Add one below.')}
          </p>
        ) : null}
      </div>

      <Button type="button" variant="outline" size="sm" className="w-fit rounded-full" onClick={addCriterion}>
        <PlusIcon data-icon="inline-start" />
        {tx('Thêm chỉ tiêu', 'Add criterion')}
      </Button>
    </div>
  )
}
