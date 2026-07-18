'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { AuthSession, UserRole } from '@/lib/api/types'

const STORAGE_KEY = 'nexora.session.v2'
const LEGACY_KEYS = ['nexora.session.v1', 'nexora.session.v2'] as const

type AuthContextValue = {
  session: AuthSession | null
  ready: boolean
  signIn: (input: {
    email: string
    organizationId: string
    role?: UserRole
    displayName?: string
    userId?: string
  }) => void
  signOut: () => void
  /** Wipe session without navigation — used before account switch / Google OAuth */
  clearSession: () => void
  /** Only safe profile fields — never role / org / userId */
  updateProfile: (patch: { displayName?: string }) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function slugId(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
}

function sanitizeSession(raw: unknown): AuthSession | null {
  if (!raw || typeof raw !== 'object') return null
  const s = raw as Record<string, unknown>
  const email = typeof s.email === 'string' ? s.email.trim().toLowerCase() : ''
  const organizationId =
    typeof s.organizationId === 'string' ? slugId(s.organizationId) : ''
  const userId = typeof s.userId === 'string' ? s.userId.trim().slice(0, 80) : ''
  const role =
    s.role === 'owner' || s.role === 'admin' || s.role === 'reviewer' ? s.role : 'reviewer'
  if (!email || !organizationId || !userId) return null
  return {
    email,
    organizationId,
    userId,
    role,
    displayName:
      typeof s.displayName === 'string'
        ? s.displayName.trim().slice(0, 80)
        : email.split('@')[0],
  }
}

/** Clear local session storage only — does NOT touch the one-shot SSO cookie. */
export function wipeLocalSession() {
  if (typeof window === 'undefined') return
  try {
    for (const k of LEGACY_KEYS) localStorage.removeItem(k)
    Object.keys(localStorage)
      .filter((k) => k.startsWith('nexora.session') || k.startsWith('nexora.access.'))
      .forEach((k) => localStorage.removeItem(k))
  } catch {
    /* ignore */
  }
}

/** Clear every client auth artifact (session keys + SSO cookie) */
export function wipeClientAuth() {
  if (typeof window === 'undefined') return
  wipeLocalSession()
  try {
    const expire = 'Thu, 01 Jan 1970 00:00:00 GMT'
    document.cookie = `nexora.sso=; path=/; expires=${expire}; SameSite=Lax`
    document.cookie = `nexora.sso=; path=/; expires=${expire}; SameSite=Lax; Secure`
    document.cookie = 'nexora.sso=; path=/; max-age=0; SameSite=Lax'
    document.cookie = 'nexora.sso=; path=/; max-age=0; SameSite=Lax; Secure'
  } catch {
    /* ignore */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const v2 = localStorage.getItem(STORAGE_KEY)
        const v1 = localStorage.getItem('nexora.session.v1')
        const raw = v2 || v1
        if (raw) {
          const parsed = sanitizeSession(JSON.parse(raw))
          if (parsed) {
            setSession(parsed)
            localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
          } else {
            wipeClientAuth()
          }
        }
        if (v1) localStorage.removeItem('nexora.session.v1')
      } catch {
        wipeClientAuth()
      }
      setReady(true)
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  // Cross-tab: if another tab signs in/out, sync immediately
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e.key || (!LEGACY_KEYS.includes(e.key as (typeof LEGACY_KEYS)[number]) && e.key !== STORAGE_KEY)) {
        if (e.key?.startsWith('nexora.session')) {
          /* fall through */
        } else if (e.key !== STORAGE_KEY) {
          return
        }
      }
      if (e.key !== STORAGE_KEY && e.key !== 'nexora.session.v1') return
      try {
        if (!e.newValue) {
          setSession(null)
          return
        }
        const parsed = sanitizeSession(JSON.parse(e.newValue))
        setSession(parsed)
      } catch {
        setSession(null)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const clearSession = useCallback(() => {
    wipeClientAuth()
    setSession(null)
  }, [])

  const persist = useCallback((next: AuthSession | null) => {
    if (!next) {
      wipeClientAuth()
      setSession(null)
      return
    }
    // Atomic replace: wipe old keys first so stale identity never lingers
    wipeClientAuth()
    setSession(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }, [])

  const signIn = useCallback(
    (input: {
      email: string
      organizationId: string
      role?: UserRole
      displayName?: string
      userId?: string
    }) => {
      const email = input.email.trim().toLowerCase()
      const organizationId = slugId(input.organizationId) || 'workspace'
      const role: UserRole =
        input.role === 'admin' || input.role === 'owner' || input.role === 'reviewer'
          ? input.role
          : 'reviewer'
      // Always derive a fresh userId from this email unless SSO provided one for THIS email
      const providedId = input.userId?.trim().slice(0, 80)
      const userId =
        providedId && providedId.length > 0
          ? providedId
          : `user-${slugId(email.split('@')[0] || 'member') || 'anon'}-${slugId(organizationId).slice(0, 8)}`

      const next: AuthSession = {
        userId,
        email,
        organizationId,
        role,
        displayName: (input.displayName || email.split('@')[0]).slice(0, 80),
      }
      // Wipe prior local session only — never kill SSO cookie mid-hydrate
      wipeLocalSession()
      setSession(next)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    },
    [],
  )

  const signOut = useCallback(() => {
    wipeClientAuth()
    setSession(null)
  }, [])

  const updateProfile = useCallback((patch: { displayName?: string }) => {
    setSession((prev) => {
      if (!prev) return prev
      const next: AuthSession = {
        ...prev,
        displayName: patch.displayName?.trim().slice(0, 80) || prev.displayName,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const value = useMemo(
    () => ({ session, ready, signIn, signOut, clearSession, updateProfile }),
    [session, ready, signIn, signOut, clearSession, updateProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function useRequireAuth() {
  return useAuth()
}

/** Mask email for UI: j***@domain.com */
export function maskEmail(email?: string) {
  if (!email || !email.includes('@')) return '—'
  const [u, d] = email.split('@')
  if (u.length <= 1) return `*@${d}`
  return `${u[0]}***@${d}`
}

/** Friendly org label — never dump full internal id chains */
export function orgLabel(organizationId?: string) {
  if (!organizationId) return 'Workspace'
  if (organizationId.length <= 18) return organizationId
  return `${organizationId.slice(0, 14)}…`
}
