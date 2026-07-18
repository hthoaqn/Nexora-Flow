'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { Spinner } from '@/components/ui/spinner'

/**
 * Legacy intake login URL — redirect to unified /login?tab=workspace
 */
function RedirectInner() {
  const router = useRouter()
  const search = useSearchParams()

  useEffect(() => {
    const q = new URLSearchParams()
    q.set('tab', 'workspace')
    const err = search?.get('error')
    const sw = search?.get('switch')
    if (err) q.set('error', err)
    if (sw) q.set('switch', sw)
    router.replace(`/login?${q.toString()}`)
  }, [router, search])

  return (
    <div className="flex min-h-svh items-center justify-center bg-background">
      <Spinner className="size-6" />
    </div>
  )
}

export default function WorkspaceLoginRedirect() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh items-center justify-center">
          <Spinner className="size-6" />
        </div>
      }
    >
      <RedirectInner />
    </Suspense>
  )
}
