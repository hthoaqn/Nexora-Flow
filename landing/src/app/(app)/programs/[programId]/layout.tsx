'use client'

/**
 * Program layout — navigation lives only in the sidebar (no top tab strip).
 */
export default function ProgramLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-w-0">{children}</div>
}
