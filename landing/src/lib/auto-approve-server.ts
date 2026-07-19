/**
 * Server-side auto-approve for hackathon / judges demo.
 * Calls production POST /api/admin/users/{id}/approve with admin identity headers.
 *
 * Disable: AUTO_APPROVE_PENDING=false
 */

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || 'https://api.nexora-flow.cloud'
).replace(/\/$/, '')

/** Known platform admin id that can approve (from reviewedBy on prod). */
const DEFAULT_ADMIN_ID = 'dc8a2f381ac542d8855ff4e053c92f7d'

export function isAutoApproveEnabled() {
  const v = String(process.env.AUTO_APPROVE_PENDING ?? 'true').toLowerCase()
  return v !== '0' && v !== 'false' && v !== 'off' && v !== 'no'
}

function adminIdentityHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-User-Id':
      process.env.ADMIN_BOOTSTRAP_USER_ID ||
      process.env.ADMIN_IMPERSONATE_ID ||
      DEFAULT_ADMIN_ID,
    'X-User-Email':
      process.env.ADMIN_BOOTSTRAP_EMAIL || 'admin@nexora.local',
    'X-User-Role': process.env.ADMIN_BOOTSTRAP_ROLE || 'admin',
  }
}

export type ApproveResult = {
  ok: boolean
  userId: string
  status?: string
  email?: string
  error?: string
  raw?: unknown
}

export async function approveUserById(
  userId: string,
  note = 'Hackathon auto-approve (judges demo)',
): Promise<ApproveResult> {
  if (!userId) return { ok: false, userId: '', error: 'userId required' }
  if (!isAutoApproveEnabled()) {
    return { ok: false, userId, error: 'AUTO_APPROVE_PENDING disabled' }
  }

  try {
    const res = await fetch(`${API_URL}/api/admin/users/${userId}/approve`, {
      method: 'POST',
      headers: adminIdentityHeaders(),
      body: JSON.stringify({ note }),
      cache: 'no-store',
    })
    const text = await res.text()
    let body: any = null
    try {
      body = text ? JSON.parse(text) : null
    } catch {
      body = text
    }
    const data = body?.data && body?.success !== undefined ? body.data : body
    if (!res.ok) {
      return {
        ok: false,
        userId,
        error:
          (typeof body?.detail === 'string' && body.detail) ||
          body?.message ||
          `HTTP ${res.status}`,
        raw: body,
      }
    }
    return {
      ok: true,
      userId: String(data?.id || userId),
      status: String(data?.status || 'active'),
      email: data?.email,
      raw: data,
    }
  } catch (e) {
    return {
      ok: false,
      userId,
      error: e instanceof Error ? e.message : 'approve failed',
    }
  }
}

/** List pending users and approve each (demo sweep). */
export async function approveAllPending(limit = 100): Promise<{
  approved: ApproveResult[]
  failed: ApproveResult[]
  total: number
}> {
  if (!isAutoApproveEnabled()) {
    return { approved: [], failed: [], total: 0 }
  }

  const res = await fetch(
    `${API_URL}/api/admin/users?status=pending&limit=${limit}`,
    {
      headers: adminIdentityHeaders(),
      cache: 'no-store',
    },
  )
  const body = await res.json().catch(() => ({}))
  const items: any[] = Array.isArray(body)
    ? body
    : body?.items || body?.data?.items || body?.data || []
  const approved: ApproveResult[] = []
  const failed: ApproveResult[] = []

  for (const u of items) {
    const id = String(u?.id || '')
    if (!id) continue
    const r = await approveUserById(id)
    if (r.ok) approved.push(r)
    else failed.push(r)
  }

  return { approved, failed, total: items.length }
}
