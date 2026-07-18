'use client'

import { useEffect, useState } from 'react'
import { MenuIcon, XIcon } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { Logo } from './Logo'
import { LangToggle, ThemeToggle } from './Controls'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

export function Navbar() {
  const { t } = useI18n()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const links = [
    { href: '#process', label: t.navProcess },
    { href: '#sides', label: t.navAudience },
    { href: '#platform', label: t.navProduct },
    { href: '#faq', label: 'FAQ' },
  ]

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-4 sm:pt-4">
      <div
        className={cn(
          'mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 rounded-2xl px-3 transition-all duration-500 sm:h-16 sm:px-4',
          scrolled || open
            ? 'nav-glass scale-[1.01]'
            : 'border border-border/20 bg-background/30 backdrop-blur-md',
        )}
      >
        <a href="#top" className="shrink-0" aria-label="Nexora Flow home">
          <Logo size={30} />
        </a>

        <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Primary">
          {links.map((l) => (
            <Button
              key={l.href}
              variant="ghost"
              size="sm"
              className="rounded-full text-muted-foreground hover:bg-primary/10 hover:text-foreground"
              render={<a href={l.href} />}
              nativeButton={false}
            >
              {l.label}
            </Button>
          ))}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <LangToggle />
          <ThemeToggle />
          <Button
            size="sm"
            className="btn-glow hidden rounded-full sm:inline-flex"
            render={<a href="/login" />}
            nativeButton={false}
          >
            {t.navCta}
          </Button>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="outline"
                  size="icon-sm"
                  className="rounded-xl lg:hidden"
                  aria-label="Menu"
                />
              }
            >
              {open ? <XIcon /> : <MenuIcon />}
            </SheetTrigger>
            <SheetContent side="right" className="w-[min(100%,340px)] border-border/60">
              <SheetHeader>
                <SheetTitle>
                  <Logo size={28} />
                </SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-1 px-2 pt-2">
                {links.map((l) => (
                  <Button
                    key={l.href}
                    variant="ghost"
                    className="h-11 justify-start rounded-xl"
                    render={<a href={l.href} onClick={() => setOpen(false)} />}
                    nativeButton={false}
                  >
                    {l.label}
                  </Button>
                ))}
              </div>
              <Separator className="my-3" />
              <div className="px-4 pb-4">
                <Button
                  className="w-full rounded-full"
                  size="lg"
                  render={<a href="/login" onClick={() => setOpen(false)} />}
                  nativeButton={false}
                >
                  {t.navCta}
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}

export default Navbar
