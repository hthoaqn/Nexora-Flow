import type {
  Application,
  ApplicationConfirm,
  ApplicationStatus,
  AuthSession,
  ConsentUpdate,
  CursorPage,
  DecisionUpdate,
  Organization,
  OrganizationUpdate,
  Program,
  ProgramCreate,
  ProgramSummary,
  ProgramUpdate,
  PublicProgram,
  ScreeningRequest,
  ScreeningResult,
  ScreeningRun,
  WorkspaceUpdate,
  AuditEvent,
} from './types'

/** Browser calls same-origin proxy to avoid CORS surprises. */
export const API_BASE =
  typeof window === 'undefined'
    ? process.env.NEXT_PUBLIC_API_URL || 'https://api.nexora-flow.cloud'
    : '/intake-api'

export class ApiError extends Error {
  status: number
  body: unknown

  constructor(status: number, message: string, body?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

function sessionHeaders(session?: AuthSession | null): HeadersInit {
  if (!session) return {}
  return {
    'x-user-id': session.userId,
    'x-user-email': session.email,
    'x-organization-id': session.organizationId,
    'x-user-role': session.role,
  }
}

function formatError(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback
  const b = body as Record<string, unknown>
  if (typeof b.message === 'string') return b.message
  if (typeof b.error === 'string') return b.error
  if (typeof b.detail === 'string') return b.detail
  if (Array.isArray(b.detail)) {
    return b.detail
      .map((d) => {
        if (d && typeof d === 'object' && 'msg' in d) {
          const loc = Array.isArray((d as { loc?: unknown }).loc)
            ? (d as { loc: unknown[] }).loc.join('.')
            : ''
          return `${loc ? loc + ': ' : ''}${(d as { msg: string }).msg}`
        }
        return JSON.stringify(d)
      })
      .join('; ')
  }
  return fallback
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & {
    session?: AuthSession | null
    applicationToken?: string | null
    json?: unknown
    formData?: FormData
  } = {},
): Promise<T> {
  const { session, applicationToken, json, formData, headers: extra, ...rest } = options
  const headers = new Headers(extra)
  Object.entries(sessionHeaders(session)).forEach(([k, v]) => headers.set(k, v))
  if (applicationToken) headers.set('x-application-token', applicationToken)

  let body = rest.body
  if (json !== undefined) {
    headers.set('content-type', 'application/json')
    body = JSON.stringify(json)
  } else if (formData) {
    body = formData
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers,
    body,
    cache: 'no-store',
  })

  const text = await res.text()
  let parsed: unknown = null
  if (text) {
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = text
    }
  }

  if (!res.ok) {
    throw new ApiError(
      res.status,
      formatError(parsed, res.statusText || `HTTP ${res.status}`),
      parsed,
    )
  }

  return parsed as T
}

// ─── Organization ───────────────────────────────────────────

export function getOrganizationMe(session: AuthSession) {
  return apiFetch<Organization & { userId?: string; email?: string; role?: string }>(
    '/api/organizations/me',
    { session },
  )
}

export function upsertOrganization(session: AuthSession, body: OrganizationUpdate) {
  return apiFetch<Organization>('/api/organizations/me', {
    method: 'PUT',
    session,
    json: body,
  })
}

// ─── Programs ───────────────────────────────────────────────

export function listPrograms(session: AuthSession, params?: { limit?: number; cursor?: string }) {
  const q = new URLSearchParams()
  if (params?.limit) q.set('limit', String(params.limit))
  if (params?.cursor) q.set('cursor', params.cursor)
  const qs = q.toString()
  return apiFetch<CursorPage<Program>>(`/api/programs${qs ? `?${qs}` : ''}`, { session })
}

export function createProgram(session: AuthSession, body: ProgramCreate) {
  return apiFetch<Program>('/api/programs', { method: 'POST', session, json: body })
}

export function getProgram(session: AuthSession, programId: string) {
  return apiFetch<Program>(`/api/programs/${programId}`, { session })
}

export function updateProgram(session: AuthSession, programId: string, body: ProgramUpdate) {
  return apiFetch<Program>(`/api/programs/${programId}`, {
    method: 'PATCH',
    session,
    json: body,
  })
}

export function getProgramSummary(session: AuthSession, programId: string) {
  return apiFetch<ProgramSummary>(`/api/programs/${programId}/summary`, { session })
}

export function listApplications(
  session: AuthSession,
  programId: string,
  params?: {
    status?: ApplicationStatus | ''
    industry?: string
    stage?: string
    missingData?: boolean | null
    limit?: number
    cursor?: string
  },
) {
  const q = new URLSearchParams()
  if (params?.status) q.set('status', params.status)
  if (params?.industry) q.set('industry', params.industry)
  if (params?.stage) q.set('stage', params.stage)
  if (params?.missingData != null) q.set('missingData', String(params.missingData))
  if (params?.limit) q.set('limit', String(params.limit))
  if (params?.cursor) q.set('cursor', params.cursor)
  const qs = q.toString()
  return apiFetch<CursorPage<Application>>(
    `/api/programs/${programId}/applications${qs ? `?${qs}` : ''}`,
    { session },
  )
}

export function uploadApplications(
  session: AuthSession,
  programId: string,
  files: File[],
  matchingOptIn = false,
) {
  const fd = new FormData()
  files.forEach((f) => fd.append('files', f))
  fd.append('matchingOptIn', String(matchingOptIn))
  return apiFetch<{ items?: Application[]; applications?: Application[] } | Application[]>(
    `/api/programs/${programId}/applications/upload`,
    { method: 'POST', session, formData: fd },
  )
}

export function getApplication(session: AuthSession, applicationId: string) {
  return apiFetch<Application>(`/api/applications/${applicationId}`, { session })
}

export function confirmApplication(
  session: AuthSession,
  applicationId: string,
  body: ApplicationConfirm,
) {
  return apiFetch<Application>(`/api/applications/${applicationId}/confirm`, {
    method: 'PATCH',
    session,
    json: body,
  })
}

export function updateConsent(session: AuthSession, applicationId: string, body: ConsentUpdate) {
  return apiFetch<Application>(`/api/applications/${applicationId}/consent`, {
    method: 'PATCH',
    session,
    json: body,
  })
}

export function updateWorkspace(
  session: AuthSession,
  applicationId: string,
  body: WorkspaceUpdate,
) {
  return apiFetch<Application>(`/api/applications/${applicationId}/workspace`, {
    method: 'PATCH',
    session,
    json: body,
  })
}

export function updateDecision(
  session: AuthSession,
  applicationId: string,
  body: DecisionUpdate,
) {
  return apiFetch<Application>(`/api/applications/${applicationId}/decision`, {
    method: 'PATCH',
    session,
    json: body,
  })
}

export function startScreening(
  session: AuthSession,
  programId: string,
  body: ScreeningRequest = {},
) {
  return apiFetch<ScreeningRun>(`/api/programs/${programId}/screening-runs`, {
    method: 'POST',
    session,
    json: body,
  })
}

export function getScreeningRun(session: AuthSession, runId: string) {
  return apiFetch<ScreeningRun>(`/api/screening-runs/${runId}`, { session })
}

export function retryScreeningRun(session: AuthSession, runId: string) {
  return apiFetch<ScreeningRun>(`/api/screening-runs/${runId}/retry`, {
    method: 'POST',
    session,
  })
}

export function listResults(
  session: AuthSession,
  programId: string,
  params?: {
    minScore?: number
    eligible?: boolean | null
    limit?: number
    cursor?: string
  },
) {
  const q = new URLSearchParams()
  if (params?.minScore != null) q.set('minScore', String(params.minScore))
  if (params?.eligible != null) q.set('eligible', String(params.eligible))
  if (params?.limit) q.set('limit', String(params.limit))
  if (params?.cursor) q.set('cursor', params.cursor)
  const qs = q.toString()
  return apiFetch<CursorPage<ScreeningResult>>(
    `/api/programs/${programId}/results${qs ? `?${qs}` : ''}`,
    { session },
  )
}

export function compareApplications(
  session: AuthSession,
  programId: string,
  body: ScreeningRequest,
) {
  return apiFetch<ScreeningResult[] | { items?: ScreeningResult[] }>(
    `/api/programs/${programId}/compare`,
    { method: 'POST', session, json: body },
  )
}

export function listAuditEvents(
  session: AuthSession,
  programId: string,
  params?: { limit?: number; cursor?: string },
) {
  const q = new URLSearchParams()
  if (params?.limit) q.set('limit', String(params.limit))
  if (params?.cursor) q.set('cursor', params.cursor)
  const qs = q.toString()
  return apiFetch<CursorPage<AuditEvent>>(
    `/api/programs/${programId}/audit-events${qs ? `?${qs}` : ''}`,
    { session },
  )
}

export function exportProgramResults(session: AuthSession, programId: string) {
  return apiFetch<unknown>(`/api/programs/${programId}/export`, { session })
}

// ─── Public ─────────────────────────────────────────────────

export function getPublicProgram(submissionToken: string) {
  return apiFetch<PublicProgram>(`/api/public/programs/${submissionToken}`)
}

export function uploadPublicApplications(
  submissionToken: string,
  files: File[],
  matchingOptIn = false,
) {
  const fd = new FormData()
  files.forEach((f) => fd.append('files', f))
  fd.append('matchingOptIn', String(matchingOptIn))
  return apiFetch<{ items?: Application[]; applications?: Application[] } | Application[]>(
    `/api/public/programs/${submissionToken}/applications/upload`,
    { method: 'POST', formData: fd },
  )
}

export function getPublicApplication(applicationId: string, applicationToken: string) {
  return apiFetch<Application>(`/api/public/applications/${applicationId}`, {
    applicationToken,
  })
}

export function publicConfirmApplication(
  applicationId: string,
  applicationToken: string,
  body: ApplicationConfirm,
) {
  return apiFetch<Application>(`/api/public/applications/${applicationId}/confirm`, {
    method: 'PATCH',
    applicationToken,
    json: body,
  })
}

export function publicUpdateConsent(
  applicationId: string,
  applicationToken: string,
  body: ConsentUpdate,
) {
  return apiFetch<Application>(`/api/public/applications/${applicationId}/consent`, {
    method: 'PATCH',
    applicationToken,
    json: body,
  })
}

/**
 * Normalize upload / list payloads into Application[].
 * Public upload returns items shaped as:
 * { applicationId, fileName, status, applicantToken, errors, ... }
 * while full Application uses { id, fileMetadata.fileName, ... }.
 */
export function asApplicationList(
  data:
    | {
        items?: unknown[]
        applications?: unknown[]
        accepted?: number
        failed?: number
      }
    | unknown[]
    | null
    | undefined,
): Application[] {
  if (!data) return []
  const raw = Array.isArray(data)
    ? data
    : Array.isArray(data.items)
      ? data.items
      : Array.isArray(data.applications)
        ? data.applications
        : []

  return raw.map((row) => normalizeApplication(row)).filter((a) => Boolean(a.id))
}

function normalizeApplication(row: unknown): Application {
  if (!row || typeof row !== 'object') {
    return { id: '', status: 'RECEIVED' } as Application
  }
  const r = row as Record<string, unknown>
  const id = String(r.id || r.applicationId || '')
  const fileName =
    (r.fileName as string | undefined) ||
    (r.fileMetadata as { fileName?: string } | undefined)?.fileName
  const existingMeta = (r.fileMetadata as Application['fileMetadata']) || undefined

  return {
    ...(r as unknown as Application),
    id,
    status: (r.status as Application['status']) || 'RECEIVED',
    applicantToken: (r.applicantToken as string | undefined) || undefined,
    fileMetadata: existingMeta || (fileName ? { fileName } : undefined),
    startupName: (r.startupName as string | undefined) || undefined,
  }
}

export function displayName(app: Application): string {
  const p = app.confirmedProfile || app.submittedProfile || {}
  const fromProfile =
    (p.startupName as string) ||
    (p.companyName as string) ||
    (p.name as string)
  const id = app.id || ''
  return (
    app.startupName ||
    fromProfile ||
    app.fileMetadata?.fileName ||
    (id ? id.slice(0, 8) : 'Hồ sơ')
  )
}
