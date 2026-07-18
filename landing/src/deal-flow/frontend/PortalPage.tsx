'use client'

import dynamic from 'next/dynamic'

const PortalApp = dynamic(() => import('./PortalApp'), {
  ssr: false,
  loading: () => (
    <div className="flex h-svh w-full flex-col items-center justify-center gap-3 bg-background">
      <div className="size-9 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <p className="text-sm text-muted-foreground">Đang tải…</p>
    </div>
  ),
})

export default function PortalPage() {
  return <PortalApp />
}
