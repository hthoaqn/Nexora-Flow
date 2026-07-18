'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth/session'
import { useAuthStore } from '@/deal-flow/frontend/store/useAuthStore'
import { Spinner } from '@/components/ui/spinner'
import type { UserRole } from '@/lib/api/types'
import { Button } from '@/components/ui/button'

type SsoPayload = {
  intent?: 'startup' | 'workspace'
  // workspace
  userId?: string
  email?: string
  displayName?: string
  organizationId?: string
  role?: UserRole
  picture?: string
  provider?: string
  // startup tokens
  user?: {
    id: string
    email: string
    fullName?: string
    role?: string
    status?: string
  }
  accessToken?: string
  refreshToken?: string
}

function decodeBase64UrlJson(raw: string): SsoPayload | null {
  try {
    const pad = raw + '='.repeat((4 - (raw.length % 4)) % 4)
    const b64 = pad.replace(/-/g, '+').replace(/_/g, '/')
    const binary = atob(b64)
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
    const json = new TextDecoder().decode(bytes)
    return JSON.parse(json) as SsoPayload
  } catch {
    return null
  }
}

function readSsoCookie(): SsoPayload | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith('nexora.sso='))
  if (!match) return null
  const value = match.slice('nexora.sso='.length)
  if (!value) return null
  return decodeBase64UrlJson(decodeURIComponent(value))
}

function clearSsoCookie() {
  const expire = 'Thu, 01 Jan 1970 00:00:00 GMT'
  document.cookie = `nexora.sso=; path=/; expires=${expire}; SameSite=Lax`
  document.cookie = `nexora.sso=; path=/; expires=${expire}; SameSite=Lax; Secure`
  document.cookie = `nexora.sso=; path=/; max-age=0; SameSite=Lax`
  document.cookie = `nexora.sso=; path=/; max-age=0; SameSite=Lax; Secure`
}

function AuthCallbackInner() {
  const { signIn, ready } = useAuth()
  const setStartupAuth = useAuthStore((s) => s.setAuth)
  const search = useSearchParams()
  const en =
    typeof window !== 'undefined' && window.localStorage.getItem('nf-lang') === 'en'
  const [message, setMessage] = useState(
    en ? 'Finishing sign-in…' : 'Đang hoàn tất đăng nhập…',
  )
  const [failed, setFailed] = useState(false)
  const ran = useRef(false)

  useEffect(() => {
    if (!ready || ran.current) return
    ran.current = true

    const intentParam = search?.get('intent')
    const payload = readSsoCookie()
    const intent =
      intentParam === 'startup' || payload?.intent === 'startup'
        ? 'startup'
        : 'workspace'

    if (!payload) {
      setFailed(true)
      setMessage(
        en
          ? 'No Google session received. SSO cookie missing or expired.'
          : 'Không nhận được phiên Google. Cookie SSO thiếu hoặc hết hạn.',
      )
      clearSsoCookie()
      window.setTimeout(() => {
        window.location.replace(
          `/login?tab=${intent === 'startup' ? 'startup' : 'workspace'}&error=sso_session&switch=1`,
        )
      }, 1400)
      return
    }

    // ── Startup Google SSO ──────────────────────────────────
    if (intent === 'startup' && payload.user) {
      const st = String(payload.user.status || 'pending').toLowerCase()
      const name = payload.user.fullName || payload.user.email

      // Tokens optional when API returns ACCOUNT_PENDING without JWT
      if (payload.accessToken) {
        try {
          setStartupAuth(
            payload.user as any,
            payload.accessToken,
            payload.refreshToken || '',
          )
        } catch {
          setFailed(true)
          setMessage(en ? 'Could not save startup session.' : 'Không ghi được phiên startup.')
          window.setTimeout(() => {
            window.location.replace('/login?tab=startup&error=sso_session')
          }, 1200)
          return
        }
      } else if (typeof window !== 'undefined') {
        // Persist minimal pending marker so /pending can show email
        try {
          window.sessionStorage.setItem(
            'nf.sso.pending',
            JSON.stringify({
              email: payload.user.email,
              fullName: payload.user.fullName,
              status: st || 'pending',
            }),
          )
        } catch {
          /* ignore */
        }
      }

      clearSsoCookie()
      setMessage(en ? `Welcome ${name}…` : `Xin chào ${name}…`)
      window.setTimeout(() => {
        if (st === 'pending' || st === 'rejected' || !payload.accessToken) {
          window.location.replace('/pending')
        } else {
          window.location.replace('/dashboard')
        }
      }, 250)
      return
    }

    // ── Intake / workspace ──────────────────────────────────
    if (!payload.email || !payload.userId || !payload.organizationId) {
      setFailed(true)
      setMessage(
        en
          ? 'No Google session received. SSO cookie missing or expired.'
          : 'Không nhận được phiên Google. Cookie SSO thiếu hoặc hết hạn.',
      )
      clearSsoCookie()
      window.setTimeout(() => {
        window.location.replace('/login?tab=workspace&error=sso_session&switch=1')
      }, 1400)
      return
    }

    try {
      signIn({
        email: payload.email,
        organizationId: payload.organizationId,
        displayName: payload.displayName,
        userId: payload.userId,
        role: payload.role || 'owner',
      })
    } catch {
      setFailed(true)
      setMessage(en ? 'Could not save the session.' : 'Không ghi được phiên đăng nhập.')
      window.setTimeout(() => {
        window.location.replace('/login?tab=workspace&error=sso_session&switch=1')
      }, 1200)
      return
    }

    clearSsoCookie()
    const name = payload.displayName || payload.email
    setMessage(
      search?.get('provider') === 'google'
        ? en
          ? `Welcome ${name}…`
          : `Xin chào ${name}…`
        : en
          ? 'Signed in…'
          : 'Đăng nhập thành công…',
    )

    window.setTimeout(() => {
      window.location.replace('/programs')
    }, 250)
  }, [ready, signIn, setStartupAuth, search, en])

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background px-4">
      {!failed && <Spinner className="size-6" />}
      <p className="max-w-sm text-center text-sm text-muted-foreground">{message}</p>
      {failed && (
        <Button
          className="rounded-full"
          render={<a href="/login?switch=1" />}
          nativeButton={false}
        >
          {en ? 'Back to sign-in' : 'Về trang đăng nhập'}
        </Button>
      )}
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh items-center justify-center">
          <Spinner className="size-6" />
        </div>
      }
    >
      <AuthCallbackInner />
    </Suspense>
  )
}
