'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth/session'
import { Spinner } from '@/components/ui/spinner'
import type { UserRole } from '@/lib/api/types'
import { Button } from '@/components/ui/button'

type SsoPayload = {
  userId: string
  email: string
  displayName?: string
  organizationId: string
  role?: UserRole
  picture?: string
  provider?: string
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
  // Host-only variants
  document.cookie = `nexora.sso=; path=/; max-age=0; SameSite=Lax`
  document.cookie = `nexora.sso=; path=/; max-age=0; SameSite=Lax; Secure`
}

function AuthCallbackInner() {
  const { signIn, ready } = useAuth()
  const router = useRouter()
  const search = useSearchParams()
  const [message, setMessage] = useState('Đang hoàn tất đăng nhập…')
  const [failed, setFailed] = useState(false)
  const ran = useRef(false)

  useEffect(() => {
    if (!ready || ran.current) return
    ran.current = true

    const payload = readSsoCookie()
    if (!payload?.email || !payload.userId || !payload.organizationId) {
      setFailed(true)
      setMessage('Không nhận được phiên Google. Cookie SSO thiếu hoặc hết hạn.')
      // Do not call clearSession here — it would wipe nothing useful and confuse retries
      clearSsoCookie()
      window.setTimeout(() => {
        window.location.replace('/workspace/login?error=sso_session&switch=1')
      }, 1400)
      return
    }

    // IMPORTANT: do NOT call clearSession()/wipeClientAuth() before reading is done.
    // wipeClientAuth also deletes nexora.sso — we already have payload in memory.
    // signIn() wipes prior local session then writes the new one.
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
      setMessage('Không ghi được phiên đăng nhập.')
      window.setTimeout(() => {
        window.location.replace('/workspace/login?error=sso_session&switch=1')
      }, 1200)
      return
    }

    clearSsoCookie()

    const name = payload.displayName || payload.email
    setMessage(
      search?.get('provider') === 'google'
        ? `Xin chào ${name}…`
        : 'Đăng nhập thành công…',
    )

    // Hard navigation — avoids Next router effect races that cancelled soft replace
    window.setTimeout(() => {
      window.location.replace('/programs')
    }, 250)
  }, [ready, signIn, search])

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background px-4">
      {!failed && <Spinner className="size-6" />}
      <p className="max-w-sm text-center text-sm text-muted-foreground">{message}</p>
      {failed && (
        <Button
          className="rounded-full"
          render={<a href="/workspace/login?switch=1" />}
          nativeButton={false}
        >
          Về trang đăng nhập
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
