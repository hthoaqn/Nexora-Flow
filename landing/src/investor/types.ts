/** Investor validation pipeline — Modules 5–9 (walkthrough_module_5_to_9.md) */

export type InvestorType =
  | 'pre_seed_tech_fund'
  | 'saas_b2b'
  | 'ecommerce'
  | 'education'
  | 'services'
  | 'impact'

export type InvestorMatchStatus =
  | 'suggested'
  | 'startup_interested'
  | 'investor_interested'
  | 'mutual_match'
  | 'evaluation_started'
  | 'rejected'
  | 'closed'

/** Case-level status (Module 5 + 9 terminal states) */
export type EvaluationCaseStatus =
  | 'draft'
  | 'waiting_for_investor_setup'
  | 'waiting_for_startup_acceptance'
  | 'active'
  | 'round_1_ready'
  | 'round_1_in_progress'
  | 'round_1_submitted'
  | 'waiting_for_investor_review'
  | 'round_2_ready'
  | 'round_2_in_progress'
  | 'round_2_submitted'
  | 'round_3_ready'
  | 'round_3_in_progress'
  | 'round_3_submitted'
  | 'ready_for_final_review'
  | 'rejected'
  | 'withdrawn'
  | 'cancelled'
  | 'completed'

export type RoundKey = 'round_1_pitch' | 'round_2_simulation' | 'round_3_proof'

export type RoundStatus =
  | 'locked'
  | 'not_started'
  | 'in_progress'
  | 'submitted'
  | 'under_review'
  | 'changes_requested'
  | 'passed'
  | 'failed'

export type LeanCanvasWeights = {
  problem: number
  customerSegments: number
  uniqueValueProposition: number
  solution: number
  channels: number
  revenueStreams: number
  costStructure: number
  keyMetrics: number
  unfairAdvantage: number
}

export type InvestorProfile = {
  id: string
  userId?: string | null
  name: string
  logoUrl?: string | null
  description: string
  website?: string
  investorType: InvestorType
  priorityIndustries: string[]
  preferredStages: string[]
  investmentRegions: string[]
  ticketMin: number
  ticketMax: number
  currency: 'USD' | 'VND'
  investmentStyles: string[]
  riskAppetite: 'low' | 'medium' | 'high'
  revenueRequirement?: string
  teamRequirement?: string
  marketRequirement?: string
  techRequirement?: string
  scalabilityRequirement?: string
  investmentThesis: string
  exclusionCriteria: string[]
  evaluationWeights: LeanCanvasWeights
  evaluationMode: 'lite' | 'full'
  status: 'draft' | 'active'
  is_demo: true
  createdAt: string
}

export type InvestorMatch = {
  id: string
  startupId: string
  investorId: string
  totalScore: number
  scoreBreakdown: Record<string, number>
  matchedReasons: string[]
  missingCriteria: string[]
  status: InvestorMatchStatus
  is_demo: boolean
  matchingVersion: string
  inputSnapshot?: Record<string, unknown>
  createdAt: string
  updatedAt: string
  investor?: InvestorProfile
}

export type EvaluationEvent = {
  id: string
  evaluationCaseId: string
  matchingId: string
  actorType: 'startup' | 'investor' | 'admin' | 'system' | 'ai'
  actorId: string
  eventType: string
  payload: Record<string, unknown>
  dataVersion: number
  createdAt: string
  visibility: 'shared' | 'investor_only' | 'startup_only' | 'admin'
  /** SHA-256 hex of canonical event body (Module 5 hash chain) */
  eventHash?: string
  prevEventHash?: string | null
}

export type PitchQaItem = {
  id: string
  question: string
  answerVideoMeta?: {
    durationSec: number
    recordedAt: string
    sizeBytes: number
    mimeType: string
  } | null
  textAnswer?: string | null
}

export type SimulationChoice = {
  id: string
  label: string
  tradeOffs: string[]
  /** Hidden from startup until submit */
  effects?: Record<string, number>
}

export type SimulationStep = {
  step: 1 | 2 | 3
  title: string
  context: string
  challenge: string
  kind: 'choice' | 'open_text'
  choices?: SimulationChoice[]
  selectedChoiceId?: string | null
  openText?: string | null
  submittedAt?: string | null
}

export type SimulationRun = {
  runId: string
  version: number
  seed: string
  businessType: string
  steps: SimulationStep[]
  status: 'active' | 'completed' | 'superseded'
  score?: number | null
  scoreBreakdown?: Record<string, number>
  supersedesRunId?: string | null
}

export type ProofChallenge = {
  template: string
  title: string
  instructions: string
  evidenceRequirements: string[]
  checklist: { id: string; label: string; weight: number }[]
  version: number
  generatedAt: string
  is_demo: boolean
}

export type ProofSubmission = {
  id: string
  version: number
  isLatest: boolean
  supersedesSubmissionId?: string | null
  meta: {
    durationSec: number
    recordedAt: string
    sizeBytes: number
    mimeType: string
  }
  analysis?: {
    scores: Record<string, number>
    evidence: { startSeconds: number; endSeconds: number; note: string }[]
    transcript: string
    limitations: string[]
    is_demo: boolean
  } | null
  submittedAt: string
}

export type InfoRequest = {
  id: string
  status: 'open' | 'answered' | 'closed' | 'cancelled'
  question: string
  answer?: string | null
  createdAt: string
  answeredAt?: string | null
}

export type FinalReview = {
  /** System / AI composite — never overwritten by investor */
  systemScore: number
  /** Investor-adjusted score — separate from AI */
  investorScore?: number | null
  adjustedScore?: number | null
  adjustmentReason?: string | null
  confidence: number
  missingEvidence: string[]
  strengths: string[]
  concerns: string[]
  contradictions: string[]
  limitations: string[]
  decision?:
    | 'proceed_to_due_diligence'
    | 'open_investment_discussion'
    | 'not_proceeding'
    | 'evaluation_completed'
    | null
  draft: boolean
  caseVersion: number
  locked?: boolean
  /** Startup-visible only */
  publicComment?: string | null
  /** Investor-only — never serialize to startup UI */
  privateNote?: string | null
}

/** §7.4 Startup consent — never auto-accept from matching alone */
export type StartupConsent = {
  id: string
  evaluationCaseId: string
  startupId: string
  decision: 'accepted' | 'rejected' | 'change_requested'
  policyVersion: string
  recordingAccepted: boolean
  dataSharingAccepted: boolean
  note?: string | null
  createdAt: string
}

/** Snapshot only — never mutates Matching source (§4.2) */
export type SourceMatchingSnapshot = {
  matchingId: string
  totalScore: number
  matchedReasons: string[]
  missingCriteria: string[]
  matchedAt: string
  startupId: string
  investorId: string
  matchingVersion: string
}

export type AppNotification = {
  id: string
  userId: string
  title: string
  titleEn: string
  body: string
  bodyEn: string
  href?: string
  read: boolean
  createdAt: string
  kind: 'evaluation' | 'info_request' | 'system'
}

export type EvaluationCase = {
  id: string
  matchingId: string
  startupId: string
  investorId: string
  /** short | standard | deep | custom */
  workflowType: 'short' | 'standard' | 'deep' | 'custom'
  featureVersion: string
  status: EvaluationCaseStatus
  currentRound: 0 | 1 | 2 | 3
  caseVersion: number
  startedAt: string
  completedAt?: string | null
  lockedAt?: string | null
  deadlineAt?: string | null
  /** Matching snapshot — additive only, never writes back */
  sourceMatchingSnapshot?: SourceMatchingSnapshot | null
  config: {
    pitchMinutes: number
    allowPractice: boolean
    evaluationMode: 'lite' | 'full'
    requireCamera?: boolean
    requireMic?: boolean
  }
  criteria: string[]
  /** Public criteria only for startup */
  publicCriteria?: string[]
  sharePermissions: {
    shareTranscriptWithInvestor: boolean
    shareVideoWithInvestor: boolean
    shareAiScoreWithStartup: boolean
  }
  rounds: Record<RoundKey, RoundStatus>
  /** AI preliminary — never overwritten by investor */
  aiScore?: number | null
  /** Investor reviewed — separate column */
  investorScore?: number | null
  finalResult?: string | null
  updatedAt: string
  is_demo: boolean
  investor?: InvestorProfile
  match?: InvestorMatch
  events?: EvaluationEvent[]
  consent?: StartupConsent | null
  pitchMeta?: {
    practice: boolean
    durationSec: number
    recordedAt: string
    sizeBytes: number
    mimeType: string
    locked?: boolean
  } | null
  pitchAiJob?: {
    status: 'processing' | 'completed' | 'failed'
    score?: number
    /** Public feedback for startup */
    publicFeedback?: {
      strengths: string[]
      unclear: string[]
      needsMore: string[]
    }
    qa?: PitchQaItem[]
    is_demo: boolean
  } | null
  simulation?: SimulationRun | null
  proofChallenge?: ProofChallenge | null
  proofSubmissions?: ProofSubmission[]
  infoRequests?: InfoRequest[]
  finalReview?: FinalReview | null
  /** Never expose to startup UI serializers */
  investorPrivateNotes?: string | null
}
