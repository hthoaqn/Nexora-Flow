'use client'

import { useParams } from 'next/navigation'
import { ProgramTabs } from '@/components/dashboard/AppShell'

export default function ProgramLayout({ children }: { children: React.ReactNode }) {
  const params = useParams()
  const programId = String(params?.programId || '')

  return (
    <div className="min-w-0">
      {programId ? <ProgramTabs programId={programId} /> : null}
      {children}
    </div>
  )
}
