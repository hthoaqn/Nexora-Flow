'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/Logo'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <Logo size={36} />
      <div className="max-w-md">
        <h1 className="font-heading text-xl font-semibold">Không tải được trang</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Có lỗi khi render. Thử tải lại — nếu vừa upload, hồ sơ vẫn có thể đã được nhận trên server.
        </p>
        {error?.message ? (
          <p className="mt-2 break-all font-mono text-[11px] text-muted-foreground">
            {error.message}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={reset} className="rounded-full">
          Thử lại
        </Button>
        <Button variant="outline" className="rounded-full" render={<Link href="/" />} nativeButton={false}>
          Trang chủ
        </Button>
        <Button
          variant="outline"
          className="rounded-full"
          render={<Link href="/programs" />}
          nativeButton={false}
        >
          Dashboard
        </Button>
      </div>
    </div>
  )
}
