/** Types derived from Nexora Intake API OpenAPI 1.1.0 */

export type UserRole = 'owner' | 'reviewer' | 'admin'

export type ProgramStatus = 'DRAFT' | 'OPEN' | 'CLOSED' | 'ARCHIVED'

export type ApplicationStatus =
  | 'RECEIVED'
  | 'EXTRACTING'
  | 'NEEDS_REVIEW'
  | 'ELIGIBLE'
  | 'SCORED'
  | 'SHORTLISTED'
  | 'INTERVIEW'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'ARCHIVED'

export type ScreeningRunStatus = 'PROCESSING' | 'COMPLETED' | 'FAILED'

export type AuthSession = {
  userId: string
  email: string
  organizationId: string
  role: UserRole
  displayName?: string
}

export type Organization = {
  id: string
  organizationId?: string
  name: string
  website?: string
  description?: string
  createdAt?: string
  updatedAt?: string
  createdBy?: string
}

export type HardFilters = {
  allowedIndustries?: string[]
  allowedStages?: string[]
  allowedLocations?: string[]
}

export type RubricCriterion = {
  name: string
  weight: number
}

export type ProgramRubric = {
  version?: string
  criteria: Record<string, RubricCriterion>
}

export type Program = {
  id: string
  organizationId: string
  name: string
  objective: string
  description?: string
  priorityIndustries?: string[]
  acceptedStages?: string[]
  locations?: string[]
  hardFilters?: HardFilters
  requiredFields?: string[]
  deadline?: string | null
  expectedSelections?: number
  rubric?: ProgramRubric | null
  status: ProgramStatus
  submissionToken?: string
  version?: number
  createdAt?: string
  updatedAt?: string
  createdBy?: string
}

export type ProgramCreate = {
  name: string
  objective: string
  description?: string
  priorityIndustries?: string[]
  acceptedStages?: string[]
  locations?: string[]
  hardFilters?: HardFilters
  requiredFields?: string[]
  deadline?: string | null
  expectedSelections?: number
  rubric?: ProgramRubric | null
  status?: ProgramStatus
}

export type ProgramUpdate = Partial<ProgramCreate>

export type OrganizationUpdate = {
  name: string
  website?: string
  description?: string
}

export type Evidence = {
  quote?: string
  source?: string
  page?: number | null
}

export type ExtractedField = {
  value?: unknown
  confidence?: number
  evidence?: Evidence[]
}

export type AiProfile = Record<string, ExtractedField | string[] | undefined> & {
  missingFields?: string[]
}

export type ProfileValues = Record<string, unknown>

export type FileMetadata = {
  fileName?: string
  mimeType?: string
  size?: number
  driveFileId?: string
}

export type Application = {
  id: string
  organizationId?: string
  programId?: string
  source?: string
  fileMetadata?: FileMetadata
  rawInput?: string
  submittedProfile?: ProfileValues
  aiProfile?: AiProfile
  confirmedProfile?: ProfileValues
  matchingOptIn?: boolean
  status: ApplicationStatus
  profileVersion?: number
  profileConfirmedAt?: string | null
  assignedReviewerIds?: string[]
  internalNotes?: string
  latestResultId?: string | null
  extraction?: {
    provider?: string
    model?: string
    promptVersion?: string
    error?: string
  }
  createdAt?: string
  updatedAt?: string
  applicantToken?: string
  // convenience display fields some responses may include
  startupName?: string
}

export type ApplicationConfirm = {
  confirmedProfile: ProfileValues
  matchingOptIn?: boolean
  consentPolicyVersion?: string
}

export type ConsentUpdate = {
  matchingOptIn: boolean
  policyVersion?: string
  reason?: string
}

export type WorkspaceUpdate = {
  assignedReviewerIds?: string[] | null
  internalNotes?: string | null
}

export type DecisionUpdate = {
  status: ApplicationStatus
  reason?: string
  internalNotes?: string
}

export type ScreeningRequest = {
  applicationIds?: string[]
}

export type HardFilterCheck = {
  field?: string
  passed?: boolean
  expected?: unknown
  actual?: unknown
  message?: string
}

export type ScoreBreakdownItem = {
  criterionId?: string
  name?: string
  weight?: number
  score?: number
  weightedScore?: number
  rationale?: string
  confidence?: number
  evidence?: Evidence[]
}

export type ScreeningResult = {
  id?: string
  applicationId: string
  startupName?: string
  eligible?: boolean
  hardFilterChecks?: HardFilterCheck[]
  totalScore?: number
  confidence?: number
  breakdown?: ScoreBreakdownItem[]
  strengths?: string[]
  risks?: string[]
  verificationQuestions?: string[]
  recommendation?: string
  decisionSupportOnly?: boolean
  rubricVersion?: string
  profileVersion?: number
  screeningVersion?: string
  inputHash?: string
  ai?: {
    provider?: string
    model?: string
    promptVersion?: string
    error?: string
  }
  createdAt?: string
  status?: ApplicationStatus
}

export type ScreeningRun = {
  id: string
  programId?: string
  applicationIds?: string[]
  status: ScreeningRunStatus | string
  progress?: number
  message?: string
  resultIds?: string[]
  errors?: Array<{ applicationId?: string; error?: string }>
  statusUrl?: string
  createdAt?: string
  updatedAt?: string
}

export type AuditEvent = {
  id: string
  action: string
  actorId?: string
  metadata?: Record<string, unknown>
  createdAt?: string
  programId?: string
  requestId?: string
  applicationId?: string
  organizationId?: string
}

export type ProgramSummary = {
  statusCounts?: Partial<Record<ApplicationStatus, number>>
  totalResults?: number
  totalApplications?: number
  verifiedOptInProfiles?: number
}

export type CursorPage<T> = {
  items: T[]
  nextCursor?: string | null
  hasMore?: boolean
}

export type PublicProgram = {
  name: string
  objective?: string
  description?: string
  priorityIndustries?: string[]
  acceptedStages?: string[]
  locations?: string[]
  deadline?: string | null
  status?: ProgramStatus
  requiredFields?: string[]
}

export type ApiErrorBody = {
  detail?: unknown
  message?: string
  error?: string
}
