import { AlertCircleIcon } from 'lucide-react'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

export function ErrorAlert({
  message,
  onRetry,
  title = 'Không thể tải dữ liệu',
}: {
  message: string
  onRetry?: () => void
  title?: string
}) {
  return (
    <Alert variant="destructive">
      <AlertCircleIcon />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
      {onRetry ? (
        <AlertAction>
          <Button size="sm" variant="outline" onClick={onRetry}>
            Thử lại
          </Button>
        </AlertAction>
      ) : null}
    </Alert>
  )
}
