import type { Application, AuthSession, Program, ProfileValues } from './types'
import { confirmApplication, updateDecision, displayName, ApiError } from './client'
import { DEFAULT_REQUIRED_FIELDS } from '@/lib/status'

const PLACEHOLDER =
  'To be completed after review (auto-filled so NIC can approve NEEDS_REVIEW).'

/** Flatten AI extracted fields + strip nested junk that often triggers 422. */
export function buildConfirmProfile(
  app: Application,
  program?: Program | null,
): ProfileValues {
  const base =
    (app.confirmedProfile as Record<string, unknown>) ||
    (app.submittedProfile as Record<string, unknown>) ||
    {}
  const fromAi: Record<string, unknown> = {}
  const ai = app.aiProfile || {}
  for (const [k, v] of Object.entries(ai)) {
    if (k === 'missingFields') continue
    if (v && typeof v === 'object' && !Array.isArray(v) && 'value' in (v as object)) {
      fromAi[k] = (v as { value?: unknown }).value
    } else if (typeof v === 'string' || typeof v === 'number' || Array.isArray(v)) {
      fromAi[k] = v
    }
  }

  const label = displayName(app)
  const nameGuess =
    (typeof base.startupName === 'string' && base.startupName) ||
    (typeof fromAi.startupName === 'string' && fromAi.startupName) ||
    (typeof app.startupName === 'string' && app.startupName) ||
    (label && !label.startsWith(app.id.slice(0, 6)) ? label : null) ||
    app.fileMetadata?.fileName?.replace(/\.(pdf|pptx?|docx?)$/i, '') ||
    'Startup'

  const industriesRaw =
    (Array.isArray(base.industries) && base.industries) ||
    (Array.isArray(base.industry) && base.industry) ||
    (Array.isArray(fromAi.industries) && fromAi.industries) ||
    (typeof base.industry === 'string' && base.industry
      ? [base.industry]
      : null) ||
    (typeof fromAi.industry === 'string' && fromAi.industry
      ? [fromAi.industry]
      : null) ||
    (program?.priorityIndustries?.length
      ? [program.priorityIndustries[0]]
      : ['General'])

  const industries = (industriesRaw as unknown[])
    .map((x) => String(x || '').trim())
    .filter(Boolean)
  if (industries.length === 0) industries.push('General')

  const stage =
    (typeof base.stage === 'string' && base.stage) ||
    (typeof fromAi.stage === 'string' && fromAi.stage) ||
    program?.acceptedStages?.[0] ||
    'mvp'

  const pickStr = (...keys: string[]) => {
    for (const k of keys) {
      const v = base[k] ?? fromAi[k]
      if (typeof v === 'string' && v.trim()) return v.trim()
    }
    return ''
  }

  const problem =
    pickStr('problem', 'problemStatement') || PLACEHOLDER
  const solution =
    pickStr('solution', 'solutionDescription') || PLACEHOLDER
  const team = pickStr('team', 'teamDescription') || PLACEHOLDER
  const description = pickStr('description', 'productDescription', 'product') || PLACEHOLDER
  const businessModel = pickStr('businessModel') || PLACEHOLDER

  const merged: Record<string, unknown> = {
    ...fromAi,
    ...base,
    startupName: String(nameGuess).slice(0, 200),
    // Send both shapes — backends vary on industry vs industries
    industries,
    industry: industries.length === 1 ? industries[0] : industries,
    stage: String(stage).slice(0, 80),
    problem: String(problem).slice(0, 5000),
    problemStatement: String(problem).slice(0, 5000),
    solution: String(solution).slice(0, 5000),
    solutionDescription: String(solution).slice(0, 5000),
    team: String(team).slice(0, 2000),
    description: String(description).slice(0, 5000),
    product: pickStr('product', 'productDescription') || String(description).slice(0, 2000),
    businessModel: String(businessModel).slice(0, 500),
  }

  // Program-specific required fields — never leave empty (causes 422 Required confirmed fields)
  const required = [
    ...DEFAULT_REQUIRED_FIELDS,
    ...(program?.requiredFields || []),
  ]
  for (const field of required) {
    const key = field === 'industry' ? 'industry' : field
    const cur = merged[key]
    const empty =
      cur == null ||
      cur === '' ||
      (Array.isArray(cur) && cur.length === 0)
    if (empty) {
      if (key === 'industry' || key === 'industries') {
        merged.industry = industries[0] || 'General'
        merged.industries = industries
      } else if (key === 'startupName') {
        merged.startupName = String(nameGuess).slice(0, 200)
      } else if (key === 'stage') {
        merged.stage = String(stage).slice(0, 80)
      } else {
        merged[key] = PLACEHOLDER
      }
    }
  }

  return sanitizeProfile(merged, required)
}

/**
 * Only primitives + string arrays.
 * Unlike before, keeps required keys even when value is a placeholder.
 */
export function sanitizeProfile(
  raw: Record<string, unknown>,
  requiredKeys: string[] = DEFAULT_REQUIRED_FIELDS,
): ProfileValues {
  const out: ProfileValues = {}
  for (const [k, v] of Object.entries(raw)) {
    if (v == null) continue
    if (typeof v === 'string') {
      // keep non-empty; placeholders OK
      if (v !== '' || requiredKeys.includes(k)) out[k] = v.slice(0, 12000)
    } else if (typeof v === 'number' || typeof v === 'boolean') {
      out[k] = v
    } else if (Array.isArray(v)) {
      const arr = v
        .map((x) => {
          if (typeof x === 'string') return x
          if (typeof x === 'number' || typeof x === 'boolean') return String(x)
          return null
        })
        .filter((x): x is string => Boolean(x && String(x).trim()))
      if (arr.length) out[k] = arr
      else if (requiredKeys.includes(k) || k === 'industries' || k === 'industry') {
        out[k] = ['General']
      }
    }
  }

  // Hard guarantees for common backend validators
  if (!out.startupName) out.startupName = 'Startup'
  if (!out.industries && !out.industry) {
    out.industries = ['General']
    out.industry = 'General'
  }
  if (!out.stage) out.stage = 'mvp'
  for (const k of ['problem', 'problemStatement', 'solution', 'solutionDescription', 'team']) {
    if (!out[k]) out[k] = PLACEHOLDER
  }
  // industry as both string + array for picky schemas
  if (Array.isArray(out.industries) && !out.industry) {
    out.industry = (out.industries as string[])[0] || 'General'
  }
  if (typeof out.industry === 'string' && !out.industries) {
    out.industries = [out.industry]
  }
  return out
}

/**
 * Approve NEEDS_REVIEW:
 * Backend requires confirm with required profile fields first.
 * Decision endpoint only accepts human-review states (SHORTLISTED/…)
 * and cannot jump NEEDS_REVIEW → SHORTLISTED without confirm.
 *
 * Flow:
 * 1) confirm rich profile (all required filled)
 * 2) confirm dual-shape industry (string-only industry)
 * 3) if confirm ok → done (server leaves NEEDS_REVIEW)
 * 4) only after confirm would we decision — not from NEEDS_REVIEW
 */
export async function approveApplication(
  session: AuthSession,
  app: Application,
  program?: Program | null,
  reason = 'Approved from organization settings',
): Promise<Application> {
  const rich = buildConfirmProfile(app, program)

  // Variant A: industry as array industries + string industry
  const profileA: ProfileValues = { ...rich }

  // Variant B: industry only as string (some validators reject array)
  const industries = Array.isArray(rich.industries)
    ? (rich.industries as string[])
    : Array.isArray(rich.industry)
      ? (rich.industry as string[])
      : [String(rich.industry || 'General')]
  const profileB: ProfileValues = {
    ...rich,
    industry: industries[0] || 'General',
    industries,
  }

  // Variant C: industry only as array under "industry" key
  const profileC: ProfileValues = {
    startupName: String(rich.startupName || 'Startup'),
    industry: industries,
    industries,
    stage: String(rich.stage || 'mvp'),
    problem: String(rich.problem || PLACEHOLDER),
    problemStatement: String(rich.problemStatement || rich.problem || PLACEHOLDER),
    solution: String(rich.solution || PLACEHOLDER),
    solutionDescription: String(rich.solutionDescription || rich.solution || PLACEHOLDER),
    team: String(rich.team || PLACEHOLDER),
    description: String(rich.description || PLACEHOLDER),
  }

  const body = (profile: ProfileValues) => ({
    confirmedProfile: profile,
    matchingOptIn: !!app.matchingOptIn,
    consentPolicyVersion: 'nexora-consent-v1' as const,
  })

  const errors: string[] = []
  let confirmed: Application | null = null

  for (const [label, profile] of [
    ['confirm/full', profileA],
    ['confirm/string-industry', profileB],
    ['confirm/core-fields', profileC],
  ] as const) {
    try {
      confirmed = await confirmApplication(session, app.id, body(profile))
      break
    } catch (e) {
      errors.push(errMsg(e, label))
    }
  }

  if (confirmed) {
    // Confirm succeeded — application should no longer be NEEDS_REVIEW.
    // Optional: if still NEEDS_REVIEW, try nothing further (decision can't fix missing confirm).
    return confirmed
  }

  // Last resort: if app already left NEEDS_REVIEW somehow, try human decision states only
  const st = String(app.status || '')
  if (st !== 'NEEDS_REVIEW' && st !== 'RECEIVED' && st !== 'EXTRACTING') {
    for (const status of ['SHORTLISTED', 'INTERVIEW'] as const) {
      try {
        return await updateDecision(session, app.id, { status, reason })
      } catch (e) {
        errors.push(errMsg(e, `decision/${status}`))
      }
    }
  }

  throw new ApiError(
    422,
    errors.join(' · ') ||
      'Approve failed: confirm profile required before decision. Open the application and fill required fields, then approve again.',
    { errors },
  )
}

export async function rejectApplication(
  session: AuthSession,
  app: Application,
  reason = 'Rejected by admin',
): Promise<Application> {
  // REJECT is a human review decision — allowed from many states
  return updateDecision(session, app.id, {
    status: 'REJECTED',
    reason: reason.slice(0, 4000),
  })
}

function errMsg(e: unknown, step: string): string {
  if (e instanceof ApiError) return `${step}: HTTP ${e.status} ${e.message}`
  if (e instanceof Error) return `${step}: ${e.message}`
  return `${step}: unknown`
}
