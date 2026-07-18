/**
 * Strip FE draft fields that api.nexora-flow.cloud (Pydantic extra=forbid) rejects.
 * Allowed confirm-create keys from OpenAPI ConfirmCreateProfileRequest.
 */

const PROFILE_KEYS = [
  'startupName',
  'website',
  'contactEmail',
  'phoneNumber',
  'foundingYear',
  'address',
  'country',
  'stage',
  'businessModel',
  'description',
  'problemStatement',
  'solutionDescription',
  'productDescription',
  'fundingNeed',
  'currency',
  'industries',
  'technologies',
  'markets',
  'targetCustomers',
  'partnershipNeeds',
  'teamCapabilities',
  'teamMembers',
  'useOfFunds',
  'traction',
  'customFields',
] as const

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v
    .map((item) => {
      if (typeof item === 'string') return item
      if (item && typeof item === 'object') {
        const o = item as Record<string, unknown>
        // useOfFunds objects → short string
        if ('category' in o) {
          const pct = o.percentage != null ? `${o.percentage}%` : ''
          const desc = o.description ? String(o.description) : ''
          return [o.category, pct, desc].filter(Boolean).join(' — ')
        }
        return JSON.stringify(item)
      }
      return String(item ?? '')
    })
    .filter((s) => s.trim().length > 0)
}

function sanitizeTeamMembers(v: unknown) {
  if (!Array.isArray(v)) return []
  return v.map((m) => {
    const o = (m && typeof m === 'object' ? m : {}) as Record<string, unknown>
    return {
      fullName: String(o.fullName ?? ''),
      position: String(o.position ?? ''),
      experience: String(o.experience ?? ''),
    }
  })
}

function sanitizeTraction(v: unknown) {
  if (!v || typeof v !== 'object') return {}
  const t = v as Record<string, unknown>
  return {
    customerCount: t.customerCount ?? null,
    userCount: t.userCount ?? null,
    monthlyRevenue: t.monthlyRevenue ?? null,
    annualRevenue: t.annualRevenue ?? null,
    growthRate: t.growthRate ?? null,
    achievements: Array.isArray(t.achievements) ? t.achievements.map(String) : [],
  }
}

function sanitizeCustomFields(v: unknown) {
  if (!Array.isArray(v)) return []
  return v.map((cf) => {
    if (!cf || typeof cf !== 'object') return {}
    // Keep object but drop undefined; API allows additionalProperties on items
    const o = { ...(cf as Record<string, unknown>) }
    delete o.requiresConfirmation
    return o
  })
}

/** Body for POST /api/startup/profile/confirm-create */
export function toConfirmCreateBody(draft: Record<string, unknown> | null | undefined) {
  const src = draft || {}
  const out: Record<string, unknown> = {}

  for (const key of PROFILE_KEYS) {
    const val = src[key]
    if (key === 'teamMembers') {
      out[key] = sanitizeTeamMembers(val)
      continue
    }
    if (key === 'useOfFunds') {
      // API: string[]; FE often sends {category, percentage, description}[]
      out[key] = asStringArray(val)
      continue
    }
    if (key === 'traction') {
      out[key] = sanitizeTraction(val)
      continue
    }
    if (key === 'customFields') {
      out[key] = sanitizeCustomFields(val)
      continue
    }
    if (
      key === 'industries' ||
      key === 'technologies' ||
      key === 'markets' ||
      key === 'targetCustomers' ||
      key === 'partnershipNeeds' ||
      key === 'teamCapabilities'
    ) {
      out[key] = asStringArray(val)
      continue
    }
    if (key === 'website' || key === 'contactEmail' || key === 'phoneNumber') {
      out[key] = val == null ? '' : String(val)
      continue
    }
    if (key === 'fundingNeed' || key === 'foundingYear') {
      if (val === '' || val === undefined) {
        out[key] = null
      } else {
        out[key] = val
      }
      continue
    }
    if (val === undefined || val === null) {
      out[key] = typeof val === 'string' || key.endsWith('Name') ? '' : val === null ? null : ''
      // strings default ''
      if (
        [
          'startupName',
          'address',
          'country',
          'stage',
          'businessModel',
          'description',
          'problemStatement',
          'solutionDescription',
          'productDescription',
          'currency',
        ].includes(key)
      ) {
        out[key] = val == null ? (key === 'currency' ? 'USD' : '') : String(val)
      }
      continue
    }
    out[key] = val
  }

  // Ensure required-ish defaults
  if (!out.currency) out.currency = 'USD'
  if (!out.startupName || String(out.startupName).trim() === '') {
    out.startupName = 'Startup'
  }
  if (!Array.isArray(out.industries)) out.industries = []
  if (!Array.isArray(out.technologies)) out.technologies = []
  if (!Array.isArray(out.markets)) out.markets = []
  if (!Array.isArray(out.targetCustomers)) out.targetCustomers = []
  if (!Array.isArray(out.partnershipNeeds)) out.partnershipNeeds = []
  if (!Array.isArray(out.teamCapabilities)) out.teamCapabilities = []
  if (!Array.isArray(out.teamMembers)) out.teamMembers = []
  if (!Array.isArray(out.useOfFunds)) out.useOfFunds = []
  if (!out.traction || typeof out.traction !== 'object') out.traction = {}
  if (!Array.isArray(out.customFields)) out.customFields = []

  return out
}

/** Body for PATCH /api/startup/profile/confirm-update */
export function toConfirmUpdateBody(
  draft: Record<string, unknown> | null | undefined,
  fieldsToApply?: string[] | null,
) {
  return {
    localDraft: toConfirmCreateBody(draft),
    fieldsToApply: fieldsToApply?.length ? fieldsToApply : null,
  }
}
