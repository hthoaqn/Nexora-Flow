/**
 * Modules 5–9 evaluation pipeline — localStorage demo implementation.
 * Implements state machine, hash-chained events, sim/proof/final/info/notif.
 * Does not alter partner matching (deal-flow).
 */

import type {
  AppNotification,
  EvaluationCase,
  EvaluationCaseStatus,
  EvaluationEvent,
  FinalReview,
  InfoRequest,
  InvestorMatch,
  InvestorMatchStatus,
  PitchQaItem,
  ProofChallenge,
  ProofSubmission,
  RoundKey,
  RoundStatus,
  SimulationRun,
  SimulationStep,
} from '../types'
import { DEMO_INVESTORS } from '../seed/demo-investors'
import type { StartupProfileDTO } from '@/deal-flow/types'
import { scoreStartupAgainstInvestors } from './investorMatch'
import {
  getValidationFlags,
  isValidationEnabled,
} from '../flags'
import type { StartupConsent, SourceMatchingSnapshot } from '../types'

const KEY = 'nf.investor.pipeline.v2'
const NOTIF_KEY = 'nf.notifications.v1'
const IDEM_KEY = 'nf.idempotency.v1'

type PipelineState = {
  matches: InvestorMatch[]
  cases: EvaluationCase[]
  events: EvaluationEvent[]
}

function empty(): PipelineState {
  return { matches: [], cases: [], events: [] }
}

function read(): PipelineState {
  if (typeof window === 'undefined') return empty()
  try {
    // migrate v1 → v2 once
    const v2 = localStorage.getItem(KEY)
    if (v2) {
      const parsed = JSON.parse(v2) as PipelineState
      return {
        matches: parsed.matches || [],
        cases: (parsed.cases || []).map(normalizeCase),
        events: parsed.events || [],
      }
    }
    const v1 = localStorage.getItem('nf.investor.pipeline.v1')
    if (v1) {
      const parsed = JSON.parse(v1) as PipelineState
      const migrated = {
        matches: parsed.matches || [],
        cases: (parsed.cases || []).map(normalizeCase),
        events: parsed.events || [],
      }
      write(migrated)
      return migrated
    }
  } catch {
    /* */
  }
  return empty()
}

function write(state: PipelineState) {
  if (typeof window === 'undefined') return
  localStorage.setItem(KEY, JSON.stringify(state))
}

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function defaultRounds(): Record<RoundKey, RoundStatus> {
  return {
    round_1_pitch: 'not_started',
    round_2_simulation: 'locked',
    round_3_proof: 'locked',
  }
}

function normalizeCase(c: EvaluationCase): EvaluationCase {
  return {
    ...c,
    caseVersion: c.caseVersion ?? 1,
    workflowType: c.workflowType || 'standard',
    featureVersion: c.featureVersion || 'validation-1.0',
    rounds: c.rounds || defaultRounds(),
    infoRequests: c.infoRequests || [],
    proofSubmissions: c.proofSubmissions || [],
    publicCriteria: c.publicCriteria || c.criteria || [],
    sharePermissions: {
      shareTranscriptWithInvestor:
        c.sharePermissions?.shareTranscriptWithInvestor ?? true,
      shareVideoWithInvestor:
        c.sharePermissions?.shareVideoWithInvestor ?? true,
      shareAiScoreWithStartup:
        c.sharePermissions?.shareAiScoreWithStartup ?? true,
    },
  }
}

/** Lightweight SHA-256 (Web Crypto when available, else FNV-1a fallback hex) */
async function sha256Hex(input: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const data = new TextEncoder().encode(input)
    const buf = await crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

function checkIdempotency(key: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    const raw = localStorage.getItem(IDEM_KEY)
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {}
    if (map[key]) return true
    map[key] = new Date().toISOString()
    localStorage.setItem(IDEM_KEY, JSON.stringify(map))
    return false
  } catch {
    return false
  }
}

function hydrateMatch(m: InvestorMatch): InvestorMatch {
  return {
    ...m,
    investor: m.investor || DEMO_INVESTORS.find((i) => i.id === m.investorId),
  }
}

function hydrateCase(c: EvaluationCase, state: PipelineState): EvaluationCase {
  const match = state.matches.find((m) => m.id === c.matchingId)
  return {
    ...normalizeCase(c),
    investor: c.investor || DEMO_INVESTORS.find((i) => i.id === c.investorId),
    match: match ? hydrateMatch(match) : undefined,
    events: state.events
      .filter((e) => e.evaluationCaseId === c.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  }
}

// ── Notifications ──────────────────────────────────────────────

function readNotifs(): AppNotification[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(NOTIF_KEY) || '[]')
  } catch {
    return []
  }
}

function writeNotifs(list: AppNotification[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(NOTIF_KEY, JSON.stringify(list.slice(-100)))
}

export function pushNotification(
  n: Omit<AppNotification, 'id' | 'createdAt' | 'read'>,
) {
  const list = readNotifs()
  list.unshift({
    ...n,
    id: uid('nt'),
    createdAt: new Date().toISOString(),
    read: false,
  })
  writeNotifs(list)
}

export function listNotifications(userId: string): AppNotification[] {
  return readNotifs()
    .filter((n) => n.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function unreadNotificationCount(userId: string): number {
  return listNotifications(userId).filter((n) => !n.read).length
}

export function markNotificationRead(id: string) {
  const list = readNotifs()
  const i = list.findIndex((n) => n.id === id)
  if (i >= 0) list[i].read = true
  writeNotifs(list)
}

export function markAllNotificationsRead(userId: string) {
  writeNotifs(
    readNotifs().map((n) =>
      n.userId === userId ? { ...n, read: true } : n,
    ),
  )
}

// ── Matching ───────────────────────────────────────────────────

export function runInvestorMatching(
  startupId: string,
  profile: StartupProfileDTO,
): InvestorMatch[] {
  const scored = scoreStartupAgainstInvestors(profile, startupId)
  const state = read()
  const existing = state.matches.filter((m) => m.startupId === startupId)
  const kept = existing.filter((m) =>
    ['mutual_match', 'evaluation_started', 'startup_interested', 'investor_interested'].includes(
      m.status,
    ),
  )
  const keptIds = new Set(kept.map((k) => k.investorId))
  const merged = scored
    .filter((s) => !keptIds.has(s.investorId))
    .map((s) => {
      const prev = existing.find((e) => e.investorId === s.investorId)
      return prev
        ? { ...s, status: prev.status, id: prev.id, createdAt: prev.createdAt }
        : s
    })
  const others = state.matches.filter((m) => m.startupId !== startupId)
  state.matches = [...others, ...kept, ...merged]
  write(state)
  return [...kept, ...merged].map(hydrateMatch).sort((a, b) => b.totalScore - a.totalScore)
}

export function listInvestorMatches(startupId: string): InvestorMatch[] {
  return read()
    .matches.filter((m) => m.startupId === startupId)
    .map(hydrateMatch)
    .sort((a, b) => b.totalScore - a.totalScore)
}

export function setMatchStatus(
  matchId: string,
  status: InvestorMatchStatus,
  actorId: string,
): InvestorMatch | null {
  const state = read()
  const idx = state.matches.findIndex((m) => m.id === matchId)
  if (idx < 0) return null
  const m = state.matches[idx]
  m.status = status
  m.updatedAt = new Date().toISOString()
  state.matches[idx] = m

  // §5 Additive: only create Case on mutual when flag ON — never mutates Matching fields above
  if (status === 'mutual_match' || status === 'evaluation_started') {
    tryCreateCaseFromMatch(state, m, actorId)
  }

  write(state)
  return hydrateMatch(m)
}

/**
 * §5.1–5.4 Create Evaluation Case after mutual match.
 * - Feature flag gate
 * - UNIQUE(matchingId, startupId, investorId)
 * - Snapshot only — no Matching rollback on failure
 */
function tryCreateCaseFromMatch(
  state: PipelineState,
  m: InvestorMatch,
  actorId: string,
): EvaluationCase | null {
  const flags = getValidationFlags()
  if (!flags.startupValidationEnabled) return null

  // Anti-duplicate §5.4
  const existing = state.cases.find(
    (c) =>
      c.matchingId === m.id &&
      c.startupId === m.startupId &&
      c.investorId === m.investorId,
  )
  if (existing) return existing

  const caseId = uid('ec')
  const now = new Date().toISOString()
  const inv = DEMO_INVESTORS.find((i) => i.id === m.investorId)

  const snapshot: SourceMatchingSnapshot = {
    matchingId: m.id,
    totalScore: m.totalScore,
    matchedReasons: m.matchedReasons || [],
    missingCriteria: m.missingCriteria || [],
    matchedAt: m.updatedAt || m.createdAt || now,
    startupId: m.startupId,
    investorId: m.investorId,
    matchingVersion: m.matchingVersion || 'investor-adapter-1.0',
  }

  // Demo: investor setup auto-completes → waiting for startup consent (never auto-accept §7.4)
  const status: EvaluationCaseStatus = flags.investorSetupEnabled
    ? 'waiting_for_startup_acceptance'
    : 'waiting_for_startup_acceptance'

  const criteria = ['problem', 'solution', 'team', 'market', 'traction', 'ask']
  const ec: EvaluationCase = {
    id: caseId,
    matchingId: m.id,
    startupId: m.startupId,
    investorId: m.investorId,
    workflowType: 'standard',
    featureVersion: 'validation-1.0',
    status,
    currentRound: 0,
    caseVersion: 1,
    startedAt: now,
    completedAt: null,
    lockedAt: null,
    deadlineAt: new Date(Date.now() + 14 * 864e5).toISOString(),
    sourceMatchingSnapshot: snapshot,
    config: {
      pitchMinutes: 5,
      allowPractice: true,
      evaluationMode: inv?.evaluationMode || 'full',
      requireCamera: true,
      requireMic: true,
    },
    criteria,
    publicCriteria: criteria,
    sharePermissions: {
      shareTranscriptWithInvestor: true,
      shareVideoWithInvestor: true,
      shareAiScoreWithStartup: true,
    },
    rounds: defaultRounds(),
    aiScore: null,
    investorScore: null,
    finalResult: null,
    updatedAt: now,
    is_demo: true,
    infoRequests: [],
    proofSubmissions: [],
    consent: null,
    investorPrivateNotes: null,
  }
  state.cases.push(ec)
  pushEventSync(state, {
    evaluationCaseId: caseId,
    matchingId: m.id,
    actorType: 'system',
    actorId: 'system',
    eventType: 'case_created',
    payload: {
      from: 'matching.mutual_confirmed',
      snapshot,
      actorId,
    },
    dataVersion: 1,
    visibility: 'shared',
  })

  if (flags.validationNotificationEnabled) {
    pushNotification({
      userId: m.startupId,
      title: 'Hành trình kiểm chứng mới',
      titleEn: 'New validation journey',
      body: `${inv?.name || 'Investor'} — xem điều khoản và chấp nhận (không tự động).`,
      bodyEn: `${inv?.name || 'Investor'} — review terms and accept (never auto).`,
      href: `/evaluations/${caseId}`,
      kind: 'evaluation',
    })
  }
  return ec
}

export function startupExpressInterest(
  matchId: string,
  startupId: string,
): InvestorMatch | null {
  const state = read()
  const m = state.matches.find(
    (x) => x.id === matchId && x.startupId === startupId,
  )
  if (!m) return null
  const next: InvestorMatchStatus =
    m.status === 'investor_interested' || m.status === 'mutual_match'
      ? 'mutual_match'
      : 'startup_interested'
  const autoMutual = next === 'startup_interested' && m.totalScore >= 70
  return setMatchStatus(matchId, autoMutual ? 'mutual_match' : next, startupId)
}

// ── Events (hash chain) ────────────────────────────────────────

function pushEventSync(
  state: PipelineState,
  event: Omit<EvaluationEvent, 'id' | 'createdAt' | 'eventHash' | 'prevEventHash'>,
): EvaluationEvent {
  const prev = [...state.events]
    .filter((e) => e.evaluationCaseId === event.evaluationCaseId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .at(-1)
  const id = uid('ev')
  const createdAt = new Date().toISOString()
  const canonical = JSON.stringify({
    id,
    ...event,
    createdAt,
    prev: prev?.eventHash || null,
  })
  // sync hash (fnv) for immediate write; async sha not needed for demo integrity
  let h = 2166136261
  for (let i = 0; i < canonical.length; i++) {
    h ^= canonical.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const eventHash = (h >>> 0).toString(16).padStart(8, '0')
  const full: EvaluationEvent = {
    ...event,
    id,
    createdAt,
    eventHash,
    prevEventHash: prev?.eventHash || null,
  }
  state.events.push(full)
  return full
}

export function appendEvent(
  evaluationCaseId: string,
  event: Omit<
    EvaluationEvent,
    'id' | 'createdAt' | 'evaluationCaseId' | 'eventHash' | 'prevEventHash'
  >,
): EvaluationEvent {
  const state = read()
  const full = pushEventSync(state, { ...event, evaluationCaseId })
  const idx = state.cases.findIndex((c) => c.id === evaluationCaseId)
  if (idx >= 0) {
    state.cases[idx].updatedAt = full.createdAt
    state.cases[idx].caseVersion = (state.cases[idx].caseVersion || 1) + 1
  }
  write(state)
  return full
}

// ── Cases ──────────────────────────────────────────────────────

export function listEvaluationCases(startupId: string): EvaluationCase[] {
  const state = read()
  return state.cases
    .filter((c) => c.startupId === startupId)
    .map((c) => hydrateCase(c, state))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function getEvaluationCase(
  caseId: string,
  startupId?: string,
): EvaluationCase | null {
  const state = read()
  const c = state.cases.find(
    (x) => x.id === caseId && (!startupId || x.startupId === startupId),
  )
  return c ? hydrateCase(c, state) : null
}

export function updateCaseStatus(
  caseId: string,
  status: EvaluationCaseStatus,
  actorId: string,
  extra?: Partial<EvaluationCase>,
): EvaluationCase | null {
  const state = read()
  const idx = state.cases.findIndex((c) => c.id === caseId)
  if (idx < 0) return null
  const prev = state.cases[idx].status
  state.cases[idx] = {
    ...state.cases[idx],
    ...extra,
    status,
    caseVersion: (state.cases[idx].caseVersion || 1) + 1,
    updatedAt: new Date().toISOString(),
  }
  pushEventSync(state, {
    evaluationCaseId: caseId,
    matchingId: state.cases[idx].matchingId,
    actorType: 'startup',
    actorId,
    eventType: 'status_changed',
    payload: { from: prev, to: status },
    dataVersion: 1,
    visibility: 'shared',
  })
  write(state)
  return hydrateCase(state.cases[idx], state)
}

/**
 * §7.4 Explicit consent — recording + data sharing required.
 * Never auto-accept from matching alone.
 */
export function acceptEvaluationCase(
  caseId: string,
  startupId: string,
  opts?: {
    recordingAccepted?: boolean
    dataSharingAccepted?: boolean
    note?: string
    policyVersion?: string
  },
) {
  if (!isValidationEnabled()) return null
  const flags = getValidationFlags()
  if (!flags.pitchRoundEnabled) return null

  const recordingAccepted = opts?.recordingAccepted !== false
  const dataSharingAccepted = opts?.dataSharingAccepted !== false
  if (!recordingAccepted || !dataSharingAccepted) {
    throw new Error('CONSENT_REQUIRED')
  }

  const state = read()
  const idx = state.cases.findIndex(
    (c) => c.id === caseId && c.startupId === startupId,
  )
  if (idx < 0) return null
  if (state.cases[idx].status !== 'waiting_for_startup_acceptance') {
    return hydrateCase(state.cases[idx], state)
  }

  const consent: StartupConsent = {
    id: uid('sc'),
    evaluationCaseId: caseId,
    startupId,
    decision: 'accepted',
    policyVersion: opts?.policyVersion || 'validation-consent-v1',
    recordingAccepted: true,
    dataSharingAccepted: true,
    note: opts?.note || null,
    createdAt: new Date().toISOString(),
  }
  const rounds = {
    ...defaultRounds(),
    round_1_pitch: 'not_started' as RoundStatus,
  }
  return updateCaseStatus(caseId, 'round_1_ready', startupId, {
    currentRound: 1,
    rounds,
    consent,
    startedAt: new Date().toISOString(),
  })
}

export function rejectEvaluationCase(
  caseId: string,
  startupId: string,
  note?: string,
) {
  if (!isValidationEnabled()) return null
  const state = read()
  const idx = state.cases.findIndex(
    (c) => c.id === caseId && c.startupId === startupId,
  )
  if (idx < 0) return null
  const consent: StartupConsent = {
    id: uid('sc'),
    evaluationCaseId: caseId,
    startupId,
    decision: 'rejected',
    policyVersion: 'validation-consent-v1',
    recordingAccepted: false,
    dataSharingAccepted: false,
    note: note || null,
    createdAt: new Date().toISOString(),
  }
  return updateCaseStatus(caseId, 'withdrawn', startupId, { consent })
}

/** Filter buckets for Startup case list (§7.2) */
export type CaseListFilter =
  | 'all'
  | 'waiting'
  | 'active'
  | 'needs_info'
  | 'completed'
  | 'rejected'
  | 'withdrawn'

export function filterEvaluationCases(
  startupId: string,
  filter: CaseListFilter,
): EvaluationCase[] {
  const list = listEvaluationCases(startupId)
  if (filter === 'all') return list
  return list.filter((c) => {
    const st = c.status
    if (filter === 'waiting')
      return (
        st === 'waiting_for_startup_acceptance' ||
        st === 'waiting_for_investor_setup' ||
        st === 'waiting_for_investor_review'
      )
    if (filter === 'active')
      return (
        st.includes('round_') ||
        st === 'active' ||
        st === 'ready_for_final_review'
      )
    if (filter === 'needs_info')
      return (c.infoRequests || []).some((r) => r.status === 'open')
    if (filter === 'completed') return st === 'completed'
    if (filter === 'rejected') return st === 'rejected'
    if (filter === 'withdrawn') return st === 'withdrawn' || st === 'cancelled'
    return true
  })
}

/** Startup-safe view: strip private investor fields (§7.3) */
export function toStartupSafeCase(c: EvaluationCase): EvaluationCase {
  const fr = c.finalReview
  return {
    ...c,
    investorPrivateNotes: undefined,
    finalReview: fr
      ? {
          ...fr,
          privateNote: undefined,
          // Keep public scores only
          investorScore: fr.investorScore ?? fr.adjustedScore ?? null,
        }
      : null,
  }
}

// ── Round 1 Pitch ──────────────────────────────────────────────

export function savePitchMeta(
  caseId: string,
  startupId: string,
  pitchMeta: NonNullable<EvaluationCase['pitchMeta']>,
) {
  const state = read()
  const idx = state.cases.findIndex(
    (c) => c.id === caseId && c.startupId === startupId,
  )
  if (idx < 0) return null
  state.cases[idx].pitchMeta = pitchMeta
  if (!pitchMeta.practice) {
    state.cases[idx].status = 'round_1_in_progress'
    state.cases[idx].rounds = {
      ...state.cases[idx].rounds,
      round_1_pitch: 'in_progress',
    }
  }
  state.cases[idx].updatedAt = new Date().toISOString()
  state.cases[idx].caseVersion += 1
  pushEventSync(state, {
    evaluationCaseId: caseId,
    matchingId: state.cases[idx].matchingId,
    actorType: 'startup',
    actorId: startupId,
    eventType: pitchMeta.practice ? 'pitch_practice_recorded' : 'pitch_recorded',
    payload: { ...pitchMeta },
    dataVersion: 1,
    visibility: 'shared',
  })
  write(state)
  return hydrateCase(state.cases[idx], state)
}

/** Synthetic AI pitch analysis + 3 Q&A (ENABLE_SYNTHETIC_AI_DEMO style) */
export function runPitchAiAnalysis(
  caseId: string,
  startupId: string,
  idempotencyKey?: string,
): EvaluationCase | null {
  const key = idempotencyKey || `pitch-ai-${caseId}`
  if (checkIdempotency(key)) {
    return getEvaluationCase(caseId, startupId)
  }
  const state = read()
  const idx = state.cases.findIndex(
    (c) => c.id === caseId && c.startupId === startupId,
  )
  if (idx < 0) return null
  const inv = DEMO_INVESTORS.find((i) => i.id === state.cases[idx].investorId)
  const qa: PitchQaItem[] = [
    {
      id: 'q1',
      question: inv
        ? `How do you defend against ${inv.priorityIndustries[0] || 'market'} incumbents in the next 18 months?`
        : 'How do you acquire the first 100 paying customers?',
    },
    {
      id: 'q2',
      question:
        'What unit economics look like at scale — and what breaks first?',
    },
    {
      id: 'q3',
      question:
        'Why is now the right time for this team to raise from this thesis?',
    },
  ]
  const score = 62 + Math.floor(Math.random() * 25)
  state.cases[idx].pitchAiJob = {
    status: 'completed',
    score,
    qa,
    is_demo: true,
    publicFeedback: {
      strengths: [
        'Clear problem framing',
        'Credible team narrative',
      ],
      unclear: ['Unit economics still light'],
      needsMore: ['Traction evidence or pilot LOI'],
    },
  }
  // AI score only — investorScore stays null until investor reviews (§ score separation)
  state.cases[idx].aiScore = score
  state.cases[idx].investorScore = null
  state.cases[idx].status = 'round_1_submitted'
  state.cases[idx].rounds = {
    ...state.cases[idx].rounds,
    round_1_pitch: 'submitted',
  }
  state.cases[idx].updatedAt = new Date().toISOString()
  state.cases[idx].caseVersion += 1
  pushEventSync(state, {
    evaluationCaseId: caseId,
    matchingId: state.cases[idx].matchingId,
    actorType: 'ai',
    actorId: 'gemini-demo',
    eventType: 'pitch_ai_completed',
    payload: { score, qaCount: 3, is_demo: true },
    dataVersion: 1,
    visibility: 'shared',
  })
  write(state)
  // Demo auto-pass pitch after AI → unlock sim
  return advanceAfterPitchReview(caseId, startupId, true)
}

export function saveQaTextAnswer(
  caseId: string,
  startupId: string,
  questionId: string,
  text: string,
) {
  const state = read()
  const idx = state.cases.findIndex(
    (c) => c.id === caseId && c.startupId === startupId,
  )
  if (idx < 0 || !state.cases[idx].pitchAiJob?.qa) return null
  const qa = state.cases[idx].pitchAiJob!.qa!.map((q) =>
    q.id === questionId ? { ...q, textAnswer: text } : q,
  )
  state.cases[idx].pitchAiJob = { ...state.cases[idx].pitchAiJob!, qa }
  state.cases[idx].updatedAt = new Date().toISOString()
  write(state)
  return hydrateCase(state.cases[idx], state)
}

function advanceAfterPitchReview(
  caseId: string,
  startupId: string,
  pass: boolean,
) {
  if (!pass) {
    return updateCaseStatus(caseId, 'rejected', startupId, {
      rounds: {
        ...getEvaluationCase(caseId, startupId)!.rounds,
        round_1_pitch: 'failed',
      },
    })
  }
  return updateCaseStatus(caseId, 'round_2_ready', startupId, {
    currentRound: 2,
    rounds: {
      round_1_pitch: 'passed',
      round_2_simulation: 'not_started',
      round_3_proof: 'locked',
    },
  })
}

// ── Round 2 Simulation ─────────────────────────────────────────

function detectBusinessType(profile?: StartupProfileDTO | null): string {
  const ind = (profile?.industries || []).join(' ').toLowerCase()
  const bm = String(profile?.businessModel || '').toLowerCase()
  if (/saas|software|ai|platform|api/.test(ind + bm)) return 'software'
  if (/market|marketplace|two.?sided/.test(ind + bm)) return 'marketplace'
  if (/service|agency|consult/.test(ind + bm)) return 'service'
  if (/product|hardware|device|agri|climate/.test(ind + bm)) return 'product'
  if (/hybrid/.test(bm)) return 'hybrid'
  return 'other'
}

function buildSimulationSteps(
  businessType: string,
  seed: string,
  choice1?: string,
): SimulationStep[] {
  // deterministic-ish by seed
  const branch = choice1 || 'A'
  const step1: SimulationStep = {
    step: 1,
    title: 'Cash vs growth',
    context: `Your ${businessType} startup has 9 months runway. A strategic partner offers distribution with exclusivity.`,
    challenge: 'How do you allocate the next 90 days?',
    kind: 'choice',
    choices: [
      {
        id: 'A',
        label: 'Take the deal — lock distribution, cut burn',
        tradeOffs: ['Faster revenue', 'Less pricing power'],
        effects: { cash: 12, autonomy: -15, growth: 5 },
      },
      {
        id: 'B',
        label: 'Decline exclusivity — raise bridge instead',
        tradeOffs: ['Keep flexibility', 'Dilution / time risk'],
        effects: { cash: -8, autonomy: 10, growth: 8 },
      },
      {
        id: 'C',
        label: 'Pilot 3 months with kill criteria',
        tradeOffs: ['Data before lock-in', 'Slower scale'],
        effects: { cash: 2, autonomy: 2, growth: 3 },
      },
    ],
  }
  const step2: SimulationStep = {
    step: 2,
    title:
      branch === 'A'
        ? 'Partner demands roadmap control'
        : branch === 'B'
          ? 'Bridge round is soft-circled at 60%'
          : 'Pilot metrics are mixed',
    context:
      branch === 'A'
        ? 'The partner wants veto on product roadmap for 18 months.'
        : branch === 'B'
          ? 'Lead wants a board observer and lower valuation.'
          : 'Conversion is OK but retention lags thesis targets.',
    challenge: 'What is your next move?',
    kind: 'choice',
    choices: [
      {
        id: 'A',
        label: 'Hold the line — protect product vision',
        tradeOffs: ['Integrity', 'Deal risk'],
        effects: { brand: 10, cash: -5 },
      },
      {
        id: 'B',
        label: 'Negotiate a narrower scope / milestone',
        tradeOffs: ['Compromise', 'Keeps optionality'],
        effects: { brand: 2, cash: 4 },
      },
      {
        id: 'C',
        label: 'Walk and re-plan go-to-market',
        tradeOffs: ['Reset cost', 'Clean narrative'],
        effects: { brand: 5, cash: -12 },
      },
    ],
  }
  const step3: SimulationStep = {
    step: 3,
    title: 'Open challenge',
    context: `Seed ${seed.slice(0, 8)} · Write a 6-line plan the investor can diligence.`,
    challenge:
      'Describe your 2-quarter plan: metric, owner, risk, kill switch. (open text)',
    kind: 'open_text',
  }
  return [step1, step2, step3]
}

export function startSimulation(
  caseId: string,
  startupId: string,
  profile?: StartupProfileDTO | null,
): EvaluationCase | null {
  const state = read()
  const idx = state.cases.findIndex(
    (c) => c.id === caseId && c.startupId === startupId,
  )
  if (idx < 0) return null
  if (state.cases[idx].simulation?.status === 'active') {
    return hydrateCase(state.cases[idx], state)
  }
  const seed = `${caseId}-${state.cases[idx].caseVersion}`
  const businessType = detectBusinessType(profile)
  const run: SimulationRun = {
    runId: uid('sim'),
    version: (state.cases[idx].simulation?.version || 0) + 1,
    seed,
    businessType,
    steps: buildSimulationSteps(businessType, seed),
    status: 'active',
    supersedesRunId: state.cases[idx].simulation?.runId || null,
  }
  state.cases[idx].simulation = run
  state.cases[idx].status = 'round_2_in_progress'
  state.cases[idx].rounds = {
    ...state.cases[idx].rounds,
    round_2_simulation: 'in_progress',
  }
  state.cases[idx].currentRound = 2
  state.cases[idx].caseVersion += 1
  state.cases[idx].updatedAt = new Date().toISOString()
  pushEventSync(state, {
    evaluationCaseId: caseId,
    matchingId: state.cases[idx].matchingId,
    actorType: 'startup',
    actorId: startupId,
    eventType: 'simulation_started',
    payload: { runId: run.runId, businessType, version: run.version },
    dataVersion: 1,
    visibility: 'shared',
  })
  write(state)
  return hydrateCase(state.cases[idx], state)
}

export function submitSimulationStep(
  caseId: string,
  startupId: string,
  step: 1 | 2 | 3,
  payload: { choiceId?: string; openText?: string },
  expectedRunVersion: number,
): EvaluationCase | null {
  const state = read()
  const idx = state.cases.findIndex(
    (c) => c.id === caseId && c.startupId === startupId,
  )
  if (idx < 0 || !state.cases[idx].simulation) return null
  const sim = state.cases[idx].simulation!
  if (sim.version !== expectedRunVersion) {
    throw new Error('SIMULATION_RUN_VERSION_CONFLICT')
  }
  const steps = [...sim.steps]
  const si = steps.findIndex((s) => s.step === step)
  if (si < 0) return null
  steps[si] = {
    ...steps[si],
    selectedChoiceId: payload.choiceId ?? steps[si].selectedChoiceId,
    openText: payload.openText ?? steps[si].openText,
    submittedAt: new Date().toISOString(),
  }
  // Branch step 2 after step 1
  if (step === 1 && payload.choiceId) {
    const rebuilt = buildSimulationSteps(
      sim.businessType,
      sim.seed,
      payload.choiceId,
    )
    steps[1] = { ...rebuilt[1] }
    steps[2] = { ...rebuilt[2] }
  }
  let nextSim: SimulationRun = {
    ...sim,
    steps,
    version: sim.version + 1,
  }
  if (step === 3) {
    // complete sim with deterministic score
    const score = 55 + ((sim.seed.length * 7 + (payload.openText?.length || 0)) % 35)
    nextSim = {
      ...nextSim,
      status: 'completed',
      score,
      scoreBreakdown: {
        cash: 10,
        growth: 12,
        autonomy: 8,
        brand: 9,
        execution: 11,
        team: 10,
        market: 9,
        product: 11,
        risk: 8,
        narrative: 10,
      },
    }
    state.cases[idx].status = 'round_2_submitted'
    state.cases[idx].rounds = {
      ...state.cases[idx].rounds,
      round_2_simulation: 'passed',
      round_3_proof: 'not_started',
    }
    state.cases[idx].currentRound = 3
    // unlock proof
    state.cases[idx].status = 'round_3_ready'
  }
  state.cases[idx].simulation = nextSim
  state.cases[idx].caseVersion += 1
  state.cases[idx].updatedAt = new Date().toISOString()
  pushEventSync(state, {
    evaluationCaseId: caseId,
    matchingId: state.cases[idx].matchingId,
    actorType: 'startup',
    actorId: startupId,
    eventType: 'simulation_step_submitted',
    payload: { step, ...payload, runVersion: nextSim.version },
    dataVersion: 1,
    visibility: 'shared',
  })
  write(state)
  return hydrateCase(state.cases[idx], state)
}

// ── Round 3 Proof ──────────────────────────────────────────────

function proofTemplate(businessType: string): ProofChallenge {
  const map: Record<string, string> = {
    software: 'software',
    product: 'physical_product',
    service: 'service',
    marketplace: 'marketplace',
    hybrid: 'hybrid',
    other: 'other',
  }
  const template = map[businessType] || 'other'
  const checklist = [
    { id: 'func', label: 'Functionality', weight: 30 },
    { id: 'use', label: 'Usability', weight: 25 },
    { id: 'value', label: 'Customer value', weight: 25 },
    { id: 'risk', label: 'Risk / reliability', weight: 20 },
  ]
  return {
    template,
    title: `Proof challenge — ${template.replace(/_/g, ' ')}`,
    instructions:
      'Record a ≤5 min walkthrough of the real product/demo. Show a core user flow end-to-end. Do not expose secrets, API keys, or customer PII.',
    evidenceRequirements: [
      'Live UI or hardware demo (not slides only)',
      'Narrate the problem → action → outcome',
      'Show one failure mode / edge case if possible',
    ],
    checklist,
    version: 1,
    generatedAt: new Date().toISOString(),
    is_demo: true,
  }
}

export function generateProofChallenge(
  caseId: string,
  startupId: string,
  idempotencyKey?: string,
): EvaluationCase | null {
  const key = idempotencyKey || `proof-gen-${caseId}`
  if (checkIdempotency(key)) return getEvaluationCase(caseId, startupId)
  const state = read()
  const idx = state.cases.findIndex(
    (c) => c.id === caseId && c.startupId === startupId,
  )
  if (idx < 0) return null
  const bt = state.cases[idx].simulation?.businessType || 'other'
  state.cases[idx].proofChallenge = proofTemplate(bt)
  state.cases[idx].status = 'round_3_in_progress'
  state.cases[idx].rounds = {
    ...state.cases[idx].rounds,
    round_3_proof: 'in_progress',
  }
  state.cases[idx].caseVersion += 1
  state.cases[idx].updatedAt = new Date().toISOString()
  pushEventSync(state, {
    evaluationCaseId: caseId,
    matchingId: state.cases[idx].matchingId,
    actorType: 'system',
    actorId: 'system',
    eventType: 'proof_challenge_generated',
    payload: { template: bt, is_demo: true },
    dataVersion: 1,
    visibility: 'shared',
  })
  write(state)
  return hydrateCase(state.cases[idx], state)
}

export function submitProofVideo(
  caseId: string,
  startupId: string,
  meta: ProofSubmission['meta'],
): EvaluationCase | null {
  const state = read()
  const idx = state.cases.findIndex(
    (c) => c.id === caseId && c.startupId === startupId,
  )
  if (idx < 0) return null
  const prev = (state.cases[idx].proofSubmissions || []).map((s) => ({
    ...s,
    isLatest: false,
  }))
  const latest = prev.find((s) => s.isLatest) // none after map
  const sub: ProofSubmission = {
    id: uid('pv'),
    version: prev.length + 1,
    isLatest: true,
    supersedesSubmissionId: prev.at(-1)?.id || null,
    meta,
    analysis: null,
    submittedAt: new Date().toISOString(),
  }
  // synthetic analysis
  sub.analysis = {
    scores: {
      Functionality: 70 + (meta.durationSec % 20),
      Usability: 65 + (meta.sizeBytes % 15),
      'Customer Value': 72,
      'Risk / Reliability': 60,
    },
    evidence: [
      { startSeconds: 12, endSeconds: 28, note: 'Core flow demonstrated' },
      { startSeconds: 45, endSeconds: 60, note: 'Edge case mentioned' },
    ],
    transcript:
      '[Demo transcript] Founder walks through product flow… (synthetic)',
    limitations: [
      'AI does not guarantee clean code',
      'AI does not guarantee backend security',
      'AI does not verify live production data',
      'AI cannot fully exclude fraud',
    ],
    is_demo: true,
  }
  state.cases[idx].proofSubmissions = [...prev, sub]
  state.cases[idx].status = 'round_3_submitted'
  state.cases[idx].rounds = {
    ...state.cases[idx].rounds,
    round_3_proof: 'submitted',
  }
  state.cases[idx].caseVersion += 1
  state.cases[idx].updatedAt = new Date().toISOString()
  pushEventSync(state, {
    evaluationCaseId: caseId,
    matchingId: state.cases[idx].matchingId,
    actorType: 'startup',
    actorId: startupId,
    eventType: 'proof_video_submitted',
    payload: { submissionId: sub.id, version: sub.version, is_demo: true },
    dataVersion: 1,
    visibility: 'shared',
  })
  write(state)
  // demo auto-pass → final review
  return finalizeRound3(caseId, startupId, true)
}

function finalizeRound3(caseId: string, startupId: string, pass: boolean) {
  if (!pass) {
    return updateCaseStatus(caseId, 'rejected', startupId)
  }
  const state = read()
  const idx = state.cases.findIndex((c) => c.id === caseId)
  if (idx < 0) return null
  const c = state.cases[idx]
  const matchScore = c.match?.totalScore ?? 70
  const pitch = c.pitchAiJob?.score ?? c.aiScore ?? 70
  const sim = c.simulation?.score ?? 70
  const proofAvg = (() => {
    const a = c.proofSubmissions?.find((s) => s.isLatest)?.analysis?.scores
    if (!a) return 70
    const vals = Object.values(a)
    return vals.reduce((s, v) => s + v, 0) / vals.length
  })()
  // weights: matching 15, pitch 20, qa 15 (fold into pitch), sim 25, proof 25
  const systemScore = Math.round(
    matchScore * 0.15 + pitch * 0.35 + sim * 0.25 + proofAvg * 0.25,
  )
  const review: FinalReview = {
    systemScore,
    investorScore: null,
    adjustedScore: null,
    confidence: 0.78,
    missingEvidence: [],
    strengths: [
      'Clear problem narrative',
      'Credible go-to-market path',
      'Simulation choices show judgment',
    ],
    concerns: [
      'Traction evidence still light',
      'Concentration risk in distribution',
    ],
    contradictions: [],
    limitations: [
      'Synthetic AI demo — not a live diligence substitute',
      'AI does not certify code quality or security',
      'AI does not verify production data authenticity',
    ],
    decision: null,
    draft: true,
    caseVersion: c.caseVersion + 1,
    publicComment: null,
    privateNote: null,
  }
  return updateCaseStatus(caseId, 'ready_for_final_review', startupId, {
    rounds: {
      ...c.rounds,
      round_3_proof: 'passed',
    },
    finalReview: review,
    aiScore: systemScore,
  })
}

// ── Module 9 Final + info requests ─────────────────────────────

export function respondInfoRequest(
  caseId: string,
  startupId: string,
  requestId: string,
  answer: string,
): EvaluationCase | null {
  const state = read()
  const idx = state.cases.findIndex(
    (c) => c.id === caseId && c.startupId === startupId,
  )
  if (idx < 0) return null
  const reqs = (state.cases[idx].infoRequests || []).map((r) =>
    r.id === requestId
      ? {
          ...r,
          answer,
          status: 'answered' as const,
          answeredAt: new Date().toISOString(),
        }
      : r,
  )
  state.cases[idx].infoRequests = reqs
  state.cases[idx].caseVersion += 1
  state.cases[idx].updatedAt = new Date().toISOString()
  pushEventSync(state, {
    evaluationCaseId: caseId,
    matchingId: state.cases[idx].matchingId,
    actorType: 'startup',
    actorId: startupId,
    eventType: 'info_request_answered',
    payload: { requestId },
    dataVersion: 1,
    visibility: 'shared',
  })
  write(state)
  return hydrateCase(state.cases[idx], state)
}

/** Demo: investor seeds an info request */
export function seedDemoInfoRequest(caseId: string): EvaluationCase | null {
  const state = read()
  const idx = state.cases.findIndex((c) => c.id === caseId)
  if (idx < 0) return null
  const req: InfoRequest = {
    id: uid('ir'),
    status: 'open',
    question:
      'Please share current MRR / pilot LOIs and any regulatory constraints in VN.',
    createdAt: new Date().toISOString(),
  }
  state.cases[idx].infoRequests = [
    ...(state.cases[idx].infoRequests || []),
    req,
  ]
  pushEventSync(state, {
    evaluationCaseId: caseId,
    matchingId: state.cases[idx].matchingId,
    actorType: 'investor',
    actorId: state.cases[idx].investorId,
    eventType: 'info_request_created',
    payload: { requestId: req.id },
    dataVersion: 1,
    visibility: 'shared',
  })
  pushNotification({
    userId: state.cases[idx].startupId,
    title: 'Yêu cầu thông tin mới',
    titleEn: 'New information request',
    body: req.question,
    bodyEn: req.question,
    href: `/evaluations/${caseId}`,
    kind: 'info_request',
  })
  write(state)
  return hydrateCase(state.cases[idx], state)
}

export function applyFinalDecision(
  caseId: string,
  actorId: string,
  decision: NonNullable<FinalReview['decision']>,
  expectedCaseVersion: number,
): EvaluationCase | null {
  const state = read()
  const idx = state.cases.findIndex((c) => c.id === caseId)
  if (idx < 0) return null
  if (state.cases[idx].caseVersion !== expectedCaseVersion) {
    throw new Error('CASE_VERSION_CONFLICT')
  }
  const fr = state.cases[idx].finalReview
  if (!fr) return null
  state.cases[idx].finalReview = {
    ...fr,
    decision,
    investorScore: fr.investorScore ?? fr.systemScore,
    draft: false,
    locked: true,
  }
  state.cases[idx].investorScore =
    fr.investorScore ?? fr.adjustedScore ?? fr.systemScore
  state.cases[idx].finalResult = decision
  state.cases[idx].status = 'completed'
  state.cases[idx].completedAt = new Date().toISOString()
  state.cases[idx].lockedAt = new Date().toISOString()
  state.cases[idx].caseVersion += 1
  state.cases[idx].updatedAt = new Date().toISOString()
  // mark match closed
  const mi = state.matches.findIndex(
    (m) => m.id === state.cases[idx].matchingId,
  )
  if (mi >= 0) {
    state.matches[mi].status = 'closed'
  }
  pushEventSync(state, {
    evaluationCaseId: caseId,
    matchingId: state.cases[idx].matchingId,
    actorType: 'investor',
    actorId,
    eventType: 'final_decision',
    payload: { decision },
    dataVersion: 1,
    visibility: 'shared',
  })
  pushNotification({
    userId: state.cases[idx].startupId,
    title: 'Quyết định cuối cùng',
    titleEn: 'Final decision',
    body: `Kết quả: ${decision}`,
    bodyEn: `Result: ${decision}`,
    href: `/evaluations/${caseId}`,
    kind: 'evaluation',
  })
  write(state)
  return hydrateCase(state.cases[idx], state)
}

/** Demo helper: investor auto-decides for terminal state testing */
export function demoInvestorFinalDecision(
  caseId: string,
  decision: NonNullable<FinalReview['decision']> = 'proceed_to_due_diligence',
) {
  const c = getEvaluationCase(caseId)
  if (!c?.finalReview) return null
  return applyFinalDecision(
    caseId,
    c.investorId,
    decision,
    c.caseVersion,
  )
}

export { sha256Hex }
