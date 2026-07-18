'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { MoonIcon, SunIcon } from 'lucide-react'
import { useI18n, type Lang } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const { t } = useI18n()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const dark = mounted ? resolvedTheme === 'dark' : true

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      aria-label={dark ? t.themeLight : t.themeDark}
      onClick={() => setTheme(dark ? 'light' : 'dark')}
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </Button>
  )
}

export function LangToggle() {
  const { lang, setLang, t } = useI18n()

  const item = (code: Lang, label: string) => (
    <Button
      key={code}
      type="button"
      size="sm"
      variant={lang === code ? 'secondary' : 'ghost'}
      className={cn('h-7 min-w-8 px-2 text-xs font-bold', lang === code && 'bg-primary/15 text-primary')}
      aria-pressed={lang === code}
      aria-label={`${t.langLabel}: ${label}`}
      onClick={() => setLang(code)}
    >
      {label}
    </Button>
  )

  return (
    <div className="inline-flex items-center rounded-lg border border-border bg-background/60 p-0.5" role="group" aria-label={t.langLabel}>
      {item('vi', 'VI')}
      {item('en', 'EN')}
    </div>
  )
}
