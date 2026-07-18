import { Badge } from '@/components/ui/badge'
import {
  APP_STATUS_LABEL,
  PROGRAM_STATUS_LABEL,
  statusBadgeVariant,
} from '@/lib/status'

export function StatusBadge({
  status,
  kind = 'application',
}: {
  status: string
  kind?: 'application' | 'program' | 'run'
}) {
  const label =
    kind === 'program'
      ? PROGRAM_STATUS_LABEL[status as keyof typeof PROGRAM_STATUS_LABEL] || status
      : APP_STATUS_LABEL[status as keyof typeof APP_STATUS_LABEL] || status

  return <Badge variant={statusBadgeVariant(status)}>{label}</Badge>
}
