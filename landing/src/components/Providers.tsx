'use client'

import type { ReactNode } from 'react'
import { ThemeProvider } from './ThemeProvider'
import { I18nProvider } from '@/lib/i18n'
import { AuthProvider } from '@/lib/auth/session'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <I18nProvider>
        <AuthProvider>
          <TooltipProvider>
            {children}
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  )
}
