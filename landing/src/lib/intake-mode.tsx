'use client'

/**
 * Intake workspace operating mode.
 * - search  → discover / find applications that fit a program thesis
 * - select  → shortlist / filter the best projects inside a program
 * Flows must feel different; mode is persisted in localStorage.
 */

import * as React from 'react'

export type IntakeMode = 'search' | 'select'

const STORAGE_KEY = 'nf.intake.mode.v1'

function readMode(): IntakeMode {
  if (typeof window === 'undefined') return 'select'
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'search' || v === 'select') return v
  } catch {
    /* ignore */
  }
  return 'select'
}

type Ctx = {
  mode: IntakeMode
  setMode: (m: IntakeMode) => void
  ready: boolean
}

const IntakeModeContext = React.createContext<Ctx>({
  mode: 'select',
  setMode: () => {},
  ready: false,
})

export function IntakeModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = React.useState<IntakeMode>('select')
  const [ready, setReady] = React.useState(false)

  React.useEffect(() => {
    setModeState(readMode())
    setReady(true)
  }, [])

  const setMode = React.useCallback((m: IntakeMode) => {
    setModeState(m)
    try {
      localStorage.setItem(STORAGE_KEY, m)
    } catch {
      /* ignore */
    }
  }, [])

  const value = React.useMemo(
    () => ({ mode, setMode, ready }),
    [mode, setMode, ready],
  )

  return (
    <IntakeModeContext.Provider value={value}>
      {children}
    </IntakeModeContext.Provider>
  )
}

export function useIntakeMode() {
  return React.useContext(IntakeModeContext)
}
