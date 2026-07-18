/**
 * Admin session — sessionStorage only (separate from startup zustand + intake cookie).
 */
'use client'

const KEY = 'nexora-admin-session'

export type AdminSession = {
  accessToken: string
  refreshToken?: string
  user: {
    id: string
    email: string
    fullName?: string
    role: string
    status?: string
  }
}

export function getAdminSession(): AdminSession | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    return JSON.parse(raw) as AdminSession
  } catch {
    return null
  }
}

export function setAdminSession(s: AdminSession) {
  sessionStorage.setItem(KEY, JSON.stringify(s))
}

export function clearAdminSession() {
  sessionStorage.removeItem(KEY)
}

export function isAdminRole(role?: string) {
  const r = String(role || '').toLowerCase()
  return r === 'admin' || r === 'superadmin' || r === 'nic_admin' || r === 'platform_admin'
}
