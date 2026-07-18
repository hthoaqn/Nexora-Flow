/**
 * Admin + account approval client → https://api.nexora-flow.cloud
 * Browser: /intake-api rewrite (same as intake/startup).
 */

import { API_BASE, ApiError } from '@/lib/api/client'

export type AccountStatus = 'pending' | 'active' | 'rejected' | 'suspended' | string
export type AccountRole =
  | 'admin'
  | 'startup'
  | 'owner'
  | 'admin_org'
  | 'reviewer'
  | string

export type AdminUser = {
  id: string
  email: string
  fullName?: string
  displayName?: string
  role: AccountRole
  status: AccountStatus
  organizationId?: string | null
  organizationName?: string | null
  expectedStartupName?: string | null
  createdAt?: string
  updatedAt?: string | null
  reviewedAt?: string | null
  reviewedBy?: string | null
  rejectReason?: string | null
  lastLoginAt?: string | null
  phone?: string | null
  note?: string | null
}

export type AdminStats = {
  pending: number
  active: number
  rejected: number
  suspended?: number
  total?: number
  startupPending?: number
  intakePending?: number
  startupActive?: number
  intakeActive?: number
  startupTotal?: number
  intakeTotal?: number
  adminTotal?: number
}

export type AuthTokens = {
  user: AdminUser & { fullName?: string; role: string }
  accessToken: string
  refreshToken?: string
  expiresIn?: number
}

function adminHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

async function adminFetch<T>(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...adminHeaders(token),
      ...(init.headers || {}),
    },
    cache: 'no-store',
  })
  const text = await res.text()
  let body: unknown = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  if (!res.ok) {
    const msg =
      body && typeof body === 'object' && body !== null
        ? String(
            (body as { detail?: { message?: string } | string; message?: string }).detail &&
              typeof (body as { detail: unknown }).detail === 'object'
              ? (body as { detail: { message?: string } }).detail?.message
              : (body as { detail?: string; message?: string }).detail ||
                  (body as { message?: string }).message ||
                  res.statusText,
          )
        : res.statusText
    throw new ApiError(res.status, msg || `HTTP ${res.status}`, body)
  }
  // Unwrap { success, data } envelope if present
  if (body && typeof body === 'object' && 'data' in (body as object) && 'success' in (body as object)) {
    return (body as { data: T }).data
  }
  return body as T
}

export function unwrapAuth(body: any): AuthTokens {
  const data = body?.data && body.success !== undefined ? body.data : body
  return {
    user: data.user,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expiresIn: data.expiresIn,
  }
}

export async function adminLogin(email: string, password: string) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    cache: 'no-store',
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const detail = body?.detail
    const code =
      typeof detail === 'object' && detail ? detail.code : body?.error?.code
    const message =
      (typeof detail === 'object' && detail?.message) ||
      (typeof detail === 'string' ? detail : null) ||
      body?.message ||
      'Login failed'
    throw new ApiError(res.status, message, { ...body, code })
  }
  return unwrapAuth(body)
}

export async function adminMe(token: string) {
  return adminFetch<AdminUser | { user: AdminUser }>('/api/auth/me', token)
}

export async function listAdminUsers(
  token: string,
  params: {
    status?: string
    role?: string
    page?: number
    limit?: number
    q?: string
  } = {},
) {
  const sp = new URLSearchParams()
  if (params.status) sp.set('status', params.status)
  if (params.role) sp.set('role', params.role)
  if (params.page) sp.set('page', String(params.page))
  if (params.limit) sp.set('limit', String(params.limit))
  if (params.q) sp.set('q', params.q)
  const qs = sp.toString()
  return adminFetch<
    { items: AdminUser[]; total: number; page?: number; limit?: number } | AdminUser[]
  >(`/api/admin/users${qs ? `?${qs}` : ''}`, token)
}

export async function getAdminStats(token: string) {
  return adminFetch<AdminStats>('/api/admin/stats', token)
}

export async function approveUser(token: string, userId: string, note?: string) {
  return adminFetch<AdminUser>(`/api/admin/users/${userId}/approve`, token, {
    method: 'POST',
    body: JSON.stringify({ note: note || '' }),
  })
}

export async function rejectUser(token: string, userId: string, reason: string) {
  return adminFetch<AdminUser>(`/api/admin/users/${userId}/reject`, token, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}

export function normalizeUser(raw: unknown): AdminUser {
  if (!raw || typeof raw !== 'object') {
    return { id: '', email: '', role: '', status: 'pending' }
  }
  const r = raw as Record<string, unknown>
  return {
    id: String(r.id || r.userId || r.user_id || ''),
    email: String(r.email || ''),
    fullName: (r.fullName || r.full_name || r.displayName || r.display_name || undefined) as
      | string
      | undefined,
    displayName: (r.displayName || r.display_name || undefined) as string | undefined,
    role: String(r.role || 'startup'),
    status: String(r.status || 'pending').toLowerCase(),
    organizationId: (r.organizationId || r.organization_id || null) as string | null,
    organizationName: (r.organizationName || r.organization_name || null) as string | null,
    expectedStartupName: (r.expectedStartupName ||
      r.expected_startup_name ||
      r.startupName ||
      null) as string | null,
    createdAt: (r.createdAt || r.created_at || undefined) as string | undefined,
    updatedAt: (r.updatedAt || r.updated_at || null) as string | null,
    reviewedAt: (r.reviewedAt || r.reviewed_at || null) as string | null,
    reviewedBy: (r.reviewedBy || r.reviewed_by || null) as string | null,
    rejectReason: (r.rejectReason || r.reject_reason || null) as string | null,
    lastLoginAt: (r.lastLoginAt || r.last_login_at || null) as string | null,
    phone: (r.phone || r.phoneNumber || null) as string | null,
    note: (r.note || r.adminNote || null) as string | null,
  }
}

export function normalizeUserList(
  data:
    | { items?: unknown[]; total?: number; page?: number; limit?: number; data?: unknown[] }
    | unknown[]
    | null
    | undefined,
): { items: AdminUser[]; total: number; page: number; limit: number } {
  if (!data) return { items: [], total: 0, page: 1, limit: 50 }
  if (Array.isArray(data)) {
    const items = data.map(normalizeUser).filter((u) => u.id)
    return { items, total: items.length, page: 1, limit: items.length || 50 }
  }
  const rawItems = data.items || data.data || []
  const items = (Array.isArray(rawItems) ? rawItems : []).map(normalizeUser).filter((u) => u.id)
  return {
    items,
    total: Number(data.total ?? items.length) || items.length,
    page: Number(data.page ?? 1) || 1,
    limit: Number(data.limit ?? 50) || 50,
  }
}

export function normalizeStats(raw: unknown): AdminStats {
  if (!raw || typeof raw !== 'object') {
    return { pending: 0, active: 0, rejected: 0 }
  }
  const r = raw as Record<string, unknown>
  const n = (k: string) => {
    const v = r[k] ?? r[k.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)]
    return typeof v === 'number' ? v : Number(v) || 0
  }
  return {
    pending: n('pending'),
    active: n('active'),
    rejected: n('rejected'),
    suspended: n('suspended') || undefined,
    total: n('total') || undefined,
    startupPending: n('startupPending') || undefined,
    intakePending: n('intakePending') || undefined,
    startupActive: n('startupActive') || undefined,
    intakeActive: n('intakeActive') || undefined,
    startupTotal: n('startupTotal') || undefined,
    intakeTotal: n('intakeTotal') || undefined,
    adminTotal: n('adminTotal') || undefined,
  }
}

/** Role bucket for NIC ops */
export function roleBucket(role?: string): 'startup' | 'intake' | 'admin' | 'other' {
  const r = String(role || '').toLowerCase()
  if (r === 'startup' || r === 'founder') return 'startup'
  if (r === 'admin' || r === 'superadmin' || r === 'nic_admin' || r === 'platform_admin')
    return 'admin'
  if (
    r === 'owner' ||
    r === 'reviewer' ||
    r === 'admin_org' ||
    r.includes('org') ||
    r.includes('intake')
  )
    return 'intake'
  return 'other'
}

export function isPendingStatus(status?: string | null) {
  return String(status || '').toLowerCase() === 'pending'
}

export function isRejectedStatus(status?: string | null) {
  return String(status || '').toLowerCase() === 'rejected'
}

export function formatWhen(iso?: string | null, locale = 'vi-VN') {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleString(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

export function relativeWhen(iso?: string | null, lang: 'vi' | 'en' = 'vi') {
  if (!iso) return '—'
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return '—'
  const diff = Date.now() - t
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return lang === 'vi' ? 'vừa xong' : 'just now'
  if (mins < 60) return lang === 'vi' ? `${mins} phút trước` : `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return lang === 'vi' ? `${hours} giờ trước` : `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return lang === 'vi' ? `${days} ngày trước` : `${days}d ago`
  return formatWhen(iso, lang === 'vi' ? 'vi-VN' : 'en-US')
}
