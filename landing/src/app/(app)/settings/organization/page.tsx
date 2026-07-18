'use client'

/**
 * Legacy route — organization is now a sheet from the user menu.
 * Keep this path for bookmarks; redirect into workspace.
 */

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Spinner } from '@/components/ui/spinner'
import { useTx } from '@/lib/tx'

export default function OrganizationSettingsRedirect() {
  const router = useRouter()
  const { tx } = useTx()

  useEffect(() => {
    router.replace('/programs')
  }, [router])

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
      <Spinner className="size-5" />
      <p className="text-sm text-muted-foreground">
        {tx(
          'Tổ chức nằm trong menu tài khoản (góc sidebar). Đang chuyển…',
          'Organization is in the account menu (sidebar). Redirecting…',
        )}
      </p>
    </div>
  )
}
