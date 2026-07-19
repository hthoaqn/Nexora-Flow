/**
 * Nexora Match Coach client → production API
 *   https://api.nexora-flow.cloud/api/ai/*
 * Browser: same-origin rewrite /intake-api (next.config.ts)
 * Auth: Bearer from auth store (required by production).
 * Fallback: local Next routes /api/ai/* if remote fails.
 */

import { useAuthStore } from '@/deal-flow/frontend/store/useAuthStore'

const REMOTE_ORIGIN =
  typeof window === 'undefined'
    ? process.env.NEXT_PUBLIC_API_URL || 'https://api.nexora-flow.cloud'
    : '/intake-api'

/** Production FastAPI prefix */
export function coachRemoteBase() {
  return `${REMOTE_ORIGIN.replace(/\/$/, '')}/api/ai`
}

/** Local Next.js routes (heuristic + optional Ollama on Vercel host) */
export function coachLocalBase() {
  return '/api/ai'
}

export function coachAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  try {
    const token = useAuthStore.getState()?.accessToken
    if (token) headers.Authorization = `Bearer ${token}`
  } catch {
    /* store may be unavailable outside client */
  }
  return headers
}

export type CoachFetchOpts = {
  /** Prefer remote production API (default true) */
  preferRemote?: boolean
  signal?: AbortSignal
}

/**
 * Fetch coach endpoint: try remote first, then local Next fallback.
 * `path` like `/health`, `/match-analysis`, `/chat`, `/chat/stream`
 */
export async function coachFetch(
  path: string,
  init: RequestInit = {},
  opts: CoachFetchOpts = {},
): Promise<Response> {
  const preferRemote = opts.preferRemote !== false
  const pathNorm = path.startsWith('/') ? path : `/${path}`
  const auth = coachAuthHeaders()
  const headers = {
    ...auth,
    ...(init.headers as Record<string, string> | undefined),
  }
  const signal = opts.signal || init.signal

  const tryOnce = async (base: string) => {
    return fetch(`${base}${pathNorm}`, {
      ...init,
      headers,
      signal,
    })
  }

  if (preferRemote) {
    try {
      const res = await tryOnce(coachRemoteBase())
      // Auth / not found → fall back to local heuristic
      if (res.status === 401 || res.status === 403 || res.status === 404) {
        const local = await tryOnce(coachLocalBase())
        if (local.ok || local.status < 500) return local
      }
      return res
    } catch {
      return tryOnce(coachLocalBase())
    }
  }

  try {
    return await tryOnce(coachLocalBase())
  } catch {
    return tryOnce(coachRemoteBase())
  }
}

export async function coachHealth() {
  const res = await coachFetch('/health', { method: 'GET' })
  const body = await res.json().catch(() => null)
  // envelope or raw
  const data = body?.data ?? body
  return {
    ok: res.ok,
    online: !!(data?.online),
    model:
      data?.configuredModel ||
      data?.models?.[0] ||
      'deepseek-r1',
    raw: body,
    source: res.url?.includes('/intake-api') ? 'remote' : 'local',
  }
}
