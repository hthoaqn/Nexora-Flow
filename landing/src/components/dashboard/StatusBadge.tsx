'use client'
import { useTx } from '@/lib/tx'
import { Badge } from '@/components/ui/badge'
import {
  APP_STATUS_LABEL,
  PROGRAM_STATUS_LABEL,
  statusBadgeVariant,
} from '@/lib/status'

const RUN_STATUS_LABEL: Record<string, { vi: string; en: string }> = {
  PROCESSING: { vi: 'Đang chấm', en: 'Processing' },
  COMPLETED: { vi: 'Hoàn tất', en: 'Completed' },
  FAILED: { vi: 'Thất bại', en: 'Failed' },
}

export function StatusBadge({
  status,
  kind = 'application',
}: {
  status: string
  kind?: 'application' | 'program' | 'run'
}) {
  const { tx, lang } = useTx()
  const key = String(status ?? '')
  let raw: string
  if (kind === 'run') {
    const run = RUN_STATUS_LABEL[key.toUpperCase()]
    raw = run ? (lang === 'en' ? run.en : run.vi) : key
  } else if (kind === 'program') {
    raw =
      PROGRAM_STATUS_LABEL[key as keyof typeof PROGRAM_STATUS_LABEL] || key
  } else {
    raw = APP_STATUS_LABEL[key as keyof typeof APP_STATUS_LABEL] || key
  }
  // Never render non-string (React #310 / invalid child if API sends object status)
  const label = typeof raw === 'string' ? raw : String(raw ?? status ?? '—')

  return (
    <Badge variant={statusBadgeVariant(String(status ?? ''))}>
      {kind === 'run' ? label : tx(label)}
    </Badge>
  )
}
