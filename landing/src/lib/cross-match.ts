/**
 * Cross-match engine: Intake program thesis ↔ Startup profile.
 * Same weights as startup→partner matching (deal-flow MatchingService).
 * Runs client-side when backend has no /api/intake/matches yet.
 */

import type { Application, Program, ProfileValues } from '@/lib/api/types'
import { displayName } from '@/lib/api/client'

export const CROSS_MATCH_WEIGHTS = {
  industry: 0.25,
  technology: 0.15,
  stage: 0.15,
  partnership: 0.15,
  funding: 0.1,
  market: 0.1,
  capability: 0.1,
} as const

export type CrossScoreBreakdown = {
  industry: number
  technology: number
  stage: number
  partnership: number
  funding: number
  market: number
  capability: number
}

export type CrossMatchResult = {
  applicationId: string
  application: Application
  startupName: string
  totalScore: number
  scoreBreakdown: CrossScoreBreakdown
  matchedReasons: string[]
  risks: string[]
  missingRequirements: string[]
  recommendation: string
  matchingOptIn: boolean
  status: string
  source: 'application'
}

const STAGE_ORDER = [
  'idea',
  'prototype',
  'mvp',
  'pre-seed',
  'seed',
  'growth',
  'expansion',
  'series-a',
  'series a',
]

const SYNONYM: Record<string, string> = {
  ai: 'artificial intelligence',
  'artificial intelligence': 'ai',
  healthcare: 'healthtech',
  healthtech: 'healthcare',
  edtech: 'education',
  education: 'edtech',
  agritech: 'agriculture',
  agriculture: 'agritech',
  fintech: 'finance',
  finance: 'fintech',
  greentech: 'cleantech',
  cleantech: 'greentech',
  climate: 'cleantech',
}

function norm(s: string) {
  return String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[\s_-]+/g, ' ')
}

function normArr(arr: unknown): string[] {
  if (!Array.isArray(arr)) {
    if (typeof arr === 'string' && arr.trim()) {
      return arr.split(/[,;|/]/).map(norm).filter(Boolean)
    }
    return []
  }
  return arr.map((x) => norm(String(x))).filter(Boolean)
}

function tagHit(source: string, targets: string[]) {
  const s = norm(source)
  if (!s) return false
  if (targets.includes(s)) return true
  const syn = SYNONYM[s]
  if (syn && targets.includes(norm(syn))) return true
  // substring soft match
  return targets.some((t) => t.includes(s) || s.includes(t))
}

function overlap(sources: string[], targets: string[]) {
  return sources.filter((s) => tagHit(s, targets))
}

function clamp(n: number) {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}

/** Flatten application profiles into a startup-like shape */
export function profileFromApplication(app: Application): ProfileValues {
  const base = {
    ...(app.submittedProfile || {}),
    ...(app.confirmedProfile || {}),
  } as ProfileValues

  // Lift AI values if confirmed empty
  const ai = app.aiProfile || {}
  for (const [k, v] of Object.entries(ai)) {
    if (k === 'missingFields') continue
    if (base[k] != null && base[k] !== '') continue
    if (v && typeof v === 'object' && !Array.isArray(v) && 'value' in (v as object)) {
      base[k] = (v as { value?: unknown }).value as never
    }
  }

  if (!base.startupName && app.startupName) base.startupName = app.startupName
  if (!base.startupName) base.startupName = displayName(app)

  // Normalize industry ↔ industries
  if (!base.industries && base.industry) {
    base.industries = Array.isArray(base.industry)
      ? base.industry
      : [String(base.industry)]
  }
  return base
}

/**
 * Score one startup profile against an Intake program mandate.
 * Program acts as the "partner thesis".
 */
export function scoreStartupVsProgram(
  profile: ProfileValues,
  program: Program,
): Omit<CrossMatchResult, 'applicationId' | 'application' | 'startupName' | 'matchingOptIn' | 'status' | 'source'> {
  const reasons: string[] = []
  const risks: string[] = []
  const missing: string[] = []

  const startupIndustries = normArr(profile.industries ?? profile.industry)
  const startupTechs = normArr(profile.technologies ?? profile.technology)
  const startupStage = norm(String(profile.stage || ''))
  const startupMarkets = normArr(profile.markets ?? profile.locations ?? profile.market)
  const startupNeeds = normArr(profile.partnershipNeeds ?? profile.partnership)
  const startupCaps = normArr(profile.teamCapabilities ?? profile.capabilities ?? profile.team)

  const programIndustries = normArr(
    program.priorityIndustries?.length
      ? program.priorityIndustries
      : program.hardFilters?.allowedIndustries,
  )
  const programStages = normArr(
    program.acceptedStages?.length
      ? program.acceptedStages
      : program.hardFilters?.allowedStages,
  )
  const programLocations = normArr(
    program.locations?.length
      ? program.locations
      : program.hardFilters?.allowedLocations,
  )
  const requiredFields = program.requiredFields || []

  const bd: CrossScoreBreakdown = {
    industry: 0,
    technology: 0,
    stage: 0,
    partnership: 0,
    funding: 0,
    market: 0,
    capability: 0,
  }

  // Industry
  if (!programIndustries.length) {
    bd.industry = 70
    reasons.push('Program has no industry filter — neutral industry score.')
  } else {
    const hit = overlap(startupIndustries, programIndustries)
    if (hit.length) {
      bd.industry = clamp((hit.length / Math.min(programIndustries.length, 3)) * 100)
      reasons.push(`Industry fit: ${hit.slice(0, 3).join(', ')}`)
    } else if (!startupIndustries.length) {
      bd.industry = 25
      missing.push('industries')
      risks.push('Startup has no industry tags for comparison.')
    } else {
      bd.industry = 10
      risks.push(
        `Industry gap: startup [${startupIndustries.slice(0, 3).join(', ')}] vs program [${programIndustries.slice(0, 3).join(', ')}]`,
      )
    }
  }

  // Technology (soft — program rarely has tech list; use objective text)
  const objectiveTags = norm(
    `${program.objective || ''} ${program.description || ''}`,
  )
  if (!startupTechs.length) {
    bd.technology = 40
  } else {
    const inObjective = startupTechs.filter((t) => objectiveTags.includes(t))
    if (inObjective.length) {
      bd.technology = clamp(50 + inObjective.length * 20)
      reasons.push(`Tech mentioned in program brief: ${inObjective.slice(0, 2).join(', ')}`)
    } else {
      bd.technology = 45
    }
  }

  // Stage
  if (!programStages.length) {
    bd.stage = 70
  } else if (!startupStage) {
    bd.stage = 30
    missing.push('stage')
  } else if (programStages.some((ps) => tagHit(startupStage, [ps]) || tagHit(ps, [startupStage]))) {
    bd.stage = 100
    reasons.push(`Stage "${profile.stage}" accepted by program.`)
  } else {
    const si = STAGE_ORDER.indexOf(startupStage)
    let minDiff = 99
    for (const ps of programStages) {
      const pi = STAGE_ORDER.indexOf(ps)
      if (si >= 0 && pi >= 0) minDiff = Math.min(minDiff, Math.abs(si - pi))
    }
    if (minDiff <= 1) {
      bd.stage = 70
      reasons.push('Stage is adjacent to program preference.')
    } else if (minDiff <= 2) {
      bd.stage = 40
      risks.push(`Stage mismatch: ${profile.stage} vs ${program.acceptedStages?.join('/')}`)
    } else {
      bd.stage = 15
      risks.push(`Significant stage gap vs program.`)
    }
  }

  // Partnership — intake programs typically want invest/pilot/research
  const defaultProgramPartnerships = ['investment', 'pilot', 'partnership', 'acceleration', 'grant']
  const needsHit = overlap(startupNeeds, defaultProgramPartnerships)
  if (!startupNeeds.length) {
    bd.partnership = 50
  } else if (needsHit.length) {
    bd.partnership = 100
    reasons.push(`Partnership needs align: ${needsHit.slice(0, 2).join(', ')}`)
  } else {
    bd.partnership = 40
  }

  // Funding — soft neutral for non-fund programs
  const fundingNeed = Number(profile.fundingNeed ?? profile.funding ?? 0)
  if (!fundingNeed) {
    bd.funding = 60
  } else {
    bd.funding = 75
    reasons.push('Startup has a stated funding need — capital dialogue possible.')
  }

  // Market / geography
  if (!programLocations.length) {
    bd.market = 70
  } else {
    const hit = overlap(startupMarkets, programLocations)
    if (hit.length) {
      bd.market = 100
      reasons.push(`Market/region fit: ${hit.slice(0, 2).join(', ')}`)
    } else if (!startupMarkets.length) {
      bd.market = 35
      missing.push('markets')
    } else {
      bd.market = 30
      risks.push('Geography may not overlap program locations.')
    }
  }

  // Capability / required fields completeness
  let fieldHits = 0
  for (const f of requiredFields) {
    const v = profile[f]
    if (v != null && v !== '' && !(Array.isArray(v) && !v.length)) fieldHits++
    else missing.push(f)
  }
  if (!requiredFields.length) {
    bd.capability = 65
  } else {
    bd.capability = clamp((fieldHits / requiredFields.length) * 100)
    if (fieldHits === requiredFields.length) {
      reasons.push('All program required fields present on profile.')
    } else {
      risks.push(`Missing required fields: ${missing.filter((m) => requiredFields.includes(m)).join(', ')}`)
    }
  }

  ;(Object.keys(bd) as (keyof CrossScoreBreakdown)[]).forEach((k) => {
    bd[k] = clamp(bd[k])
  })

  const totalScore = clamp(
    bd.industry * CROSS_MATCH_WEIGHTS.industry +
      bd.technology * CROSS_MATCH_WEIGHTS.technology +
      bd.stage * CROSS_MATCH_WEIGHTS.stage +
      bd.partnership * CROSS_MATCH_WEIGHTS.partnership +
      bd.funding * CROSS_MATCH_WEIGHTS.funding +
      bd.market * CROSS_MATCH_WEIGHTS.market +
      bd.capability * CROSS_MATCH_WEIGHTS.capability,
  )

  let recommendation = ''
  if (totalScore >= 80)
    recommendation =
      'High intersection — prioritize intro / shortlist. Strong thesis fit.'
  else if (totalScore >= 65)
    recommendation = 'Strong fit — review profile then request connection.'
  else if (totalScore >= 50)
    recommendation = 'Moderate fit — dig into gaps before committing bandwidth.'
  else recommendation = 'Low intersection — only pursue if strategic exception.'

  return {
    totalScore,
    scoreBreakdown: bd,
    matchedReasons: reasons,
    risks,
    missingRequirements: [...new Set(missing)],
    recommendation,
  }
}

export function matchApplicationsToProgram(
  applications: Application[],
  program: Program,
  opts?: { requireOptIn?: boolean; minScore?: number },
): CrossMatchResult[] {
  const requireOptIn = opts?.requireOptIn ?? false
  const minScore = opts?.minScore ?? 0

  const rows: CrossMatchResult[] = []
  for (const app of applications) {
    if (requireOptIn && !app.matchingOptIn) continue
    // Skip pure junk statuses if any
    if (app.status === 'ARCHIVED' || app.status === 'REJECTED') continue

    const profile = profileFromApplication(app)
    const scored = scoreStartupVsProgram(profile, program)
    if (scored.totalScore < minScore) continue

    rows.push({
      applicationId: app.id,
      application: app,
      startupName: String(profile.startupName || displayName(app)),
      matchingOptIn: !!app.matchingOptIn,
      status: app.status,
      source: 'application',
      ...scored,
    })
  }

  return rows.sort((a, b) => b.totalScore - a.totalScore)
}

export function scoreTone(score: number): 'high' | 'mid' | 'low' {
  if (score >= 80) return 'high'
  if (score >= 60) return 'mid'
  return 'low'
}
