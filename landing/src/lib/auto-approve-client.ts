/**
 * Browser helper — call Next /api/admin/auto-approve then optionally re-login.
 */

export async function autoApproveUser(userId: string): Promise<{
  ok: boolean
  status?: string
  error?: string
}> {
  if (!userId) return { ok: false, error: 'no userId' }
  try {
    const res = await fetch('/api/admin/auto-approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok || body?.success === false) {
      return {
        ok: false,
        error: body?.message || `HTTP ${res.status}`,
      }
    }
    return {
      ok: true,
      status: body?.data?.status || 'active',
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'failed' }
  }
}

export async function autoApproveAllPending(): Promise<{
  ok: boolean
  approvedCount?: number
  error?: string
}> {
  try {
    const res = await fetch('/api/admin/auto-approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allPending: true }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok || body?.success === false) {
      return { ok: false, error: body?.message || `HTTP ${res.status}` }
    }
    return {
      ok: true,
      approvedCount: body?.data?.approvedCount ?? 0,
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'failed' }
  }
}

/**
 * If user is pending → auto-approve, return active-shaped user for local session.
 * Tokens may still carry status=pending until re-login; most APIs use userId only.
 */
export async function ensureAccountActive<T extends { id?: string; status?: string }>(
  user: T,
): Promise<T> {
  const st = String(user?.status || 'active').toLowerCase()
  if (st !== 'pending' || !user?.id) return user
  const r = await autoApproveUser(String(user.id))
  if (r.ok) {
    return { ...user, status: 'active' }
  }
  return user
}
