'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { LangToggle, ThemeToggle } from './Controls'

export function SiteHeader() {
  const { t } = useI18n()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  const links = [
    { href: '#process', label: t.navProcess },
    { href: '#audience', label: t.navAudience },
    { href: '#product', label: t.navProduct },
  ]

  return (
    <header className={`site-header ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="wrap site-header__inner">
        <a href="#top" className="brand" aria-label="Nexora Flow">
          <span className="brand-mark" aria-hidden>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </span>
          <span>Nexora Flow</span>
        </a>

        <nav className="site-nav" aria-label="Primary">
          {links.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
        </nav>

        <div className="site-actions">
          <LangToggle />
          <ThemeToggle />
          <a href="#cta" className="btn btn-primary btn-sm hide-sm">
            {t.navCta}
          </a>
          <button
            type="button"
            className="burger show-sm"
            aria-label={open ? 'Close' : 'Menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? (
              // Close X Icon
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              // Burger spans
              <>
                <span />
                <span />
              </>
            )}
          </button>
        </div>
      </div>

      {open && (
        <div className="mobile-sheet">
          {links.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)}>
              {l.label}
            </a>
          ))}
          <a href="#cta" className="btn btn-primary" onClick={() => setOpen(false)}>
            {t.navCta}
          </a>
        </div>
      )}
    </header>
  )
}
export default SiteHeader
