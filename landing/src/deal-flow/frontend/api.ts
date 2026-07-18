/**
 * Startup portal API client → https://api.nexora-flow.cloud
 * Browser uses same-origin rewrite /intake-api (see next.config.ts).
 *
 * Normalizes raw FastAPI DTOs into the legacy envelope the UI still expects:
 *   { success, message, data, error }
 */

import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from './store/useAuthStore'
import { useStartupStore } from './store/useStartupStore'
import { toast } from 'sonner'

const API_ORIGIN =
  typeof window === 'undefined'
    ? process.env.NEXT_PUBLIC_API_URL || 'https://api.nexora-flow.cloud'
    : '/intake-api'

/** Paths are relative to /api on the host */
export const api = axios.create({
  baseURL: `${API_ORIGIN}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
})

function isEnvelope(body: unknown): body is {
  success: boolean
  data?: unknown
  message?: string
  error?: unknown
} {
  return (
    !!body &&
    typeof body === 'object' &&
    'success' in body &&
    typeof (body as { success: unknown }).success === 'boolean'
  )
}

function parseErrorBody(body: unknown): {
  message: string
  code: string
  details: string
} {
  if (!body || typeof body !== 'object') {
    return { message: 'Request failed', code: 'UNKNOWN', details: '' }
  }
  const b = body as Record<string, unknown>

  // FastAPI: { detail: "..." } | { detail: { code, message } } | { detail: [...] }
  if (typeof b.detail === 'string') {
    return { message: b.detail, code: 'HTTP_ERROR', details: b.detail }
  }
  if (b.detail && typeof b.detail === 'object' && !Array.isArray(b.detail)) {
    const d = b.detail as Record<string, unknown>
    const message = String(d.message || d.msg || 'Request failed')
    const code = String(d.code || 'HTTP_ERROR')
    return { message, code, details: message }
  }
  if (Array.isArray(b.detail)) {
    const message = b.detail
      .map((item) => {
        if (item && typeof item === 'object' && 'msg' in item) {
          return String((item as { msg: string }).msg)
        }
        return JSON.stringify(item)
      })
      .join('; ')
    return { message, code: 'VALIDATION_ERROR', details: message }
  }

  if (typeof b.message === 'string') {
    const code =
      b.error && typeof b.error === 'object' && b.error && 'code' in b.error
        ? String((b.error as { code: string }).code)
        : 'HTTP_ERROR'
    return {
      message: b.message,
      code,
      details:
        b.error && typeof b.error === 'object' && b.error && 'details' in b.error
          ? String((b.error as { details: string }).details)
          : b.message,
    }
  }

  return { message: 'Request failed', code: 'UNKNOWN', details: '' }
}

// ── Request: Bearer + FormData content-type ─────────────────────
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    // Let browser set multipart boundary
    if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
      if (config.headers && 'Content-Type' in config.headers) {
        delete (config.headers as Record<string, unknown>)['Content-Type']
      }
    }

    /**
     * OCR / pitch-deck extraction → same-origin Next `/api/v1/...`
     * (runs AiService + GEMINI_API_KEY on the Vercel Node runtime).
     * Other startup APIs stay on /intake-api → api.nexora-flow.cloud.
     */
    const url = String(config.url || '')
    const isExtraction =
      url.includes('/startup/extractions/image') ||
      url.includes('/startup/extractions/document') ||
      (config as { useLocalOcr?: boolean }).useLocalOcr
    if (isExtraction && typeof window !== 'undefined') {
      // baseURL is `/intake-api/api` — switch fully to local Express bridge
      config.baseURL = '/api/v1'
      // url may be absolute path relative to base; keep `/startup/extractions/...`
      if (url.startsWith('http')) {
        try {
          const u = new URL(url)
          config.url = u.pathname.replace(/^\/api\/v1/, '') || u.pathname
        } catch {
          /* keep */
        }
      }
    }

    return config
  },
  (error) => Promise.reject(error),
)

// ── Response: wrap raw DTO → envelope ────────────────────────────
api.interceptors.response.use(
  (response) => {
    if (!isEnvelope(response.data)) {
      response.data = {
        success: true,
        message: 'ok',
        data: response.data,
        error: null,
      }
    }
    return response
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean
    }

    // Refresh once on 401
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true
      const refreshToken = useAuthStore.getState().refreshToken
      if (refreshToken) {
        try {
          const res = await axios.post(
            `${API_ORIGIN}/api/auth/refresh`,
            { refreshToken },
            { headers: { 'Content-Type': 'application/json' } },
          )
          const body = res.data
          const accessToken = body?.accessToken ?? body?.data?.accessToken
          const newRefresh = body?.refreshToken ?? body?.data?.refreshToken
          const user = useAuthStore.getState().user
          if (accessToken && user) {
            useAuthStore
              .getState()
              .setAuth(user, accessToken, newRefresh || refreshToken)
            originalRequest.headers.Authorization = `Bearer ${accessToken}`
            return api(originalRequest)
          }
        } catch {
          useAuthStore.getState().clearAuth()
          useStartupStore.getState().clearStartupState()
          if (typeof window !== 'undefined') {
            window.location.href = '/login?tab=startup'
          }
          return Promise.reject(error)
        }
      }
    }

    const parsed = parseErrorBody(error.response?.data)
    // Attach envelope-shaped body so callers can still read .message / .error
    if (error.response) {
      error.response.data = {
        success: false,
        message: parsed.message,
        data: null,
        error: { code: parsed.code, details: parsed.details },
      }
    }

    const url = String(originalRequest?.url || '')
    const silent =
      url.includes('/auth/me') ||
      url.includes('/auth/login') ||
      url.includes('/auth/register')

    if (!silent && typeof window !== 'undefined') {
      toast.error(`${parsed.message}${parsed.code ? ` (${parsed.code})` : ''}`)
    }

    return Promise.reject(error)
  },
)
