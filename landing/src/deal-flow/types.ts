/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface TractionDTO {
  customerCount: number | null;
  userCount: number | null;
  monthlyRevenue: number | null;
  annualRevenue: number | null;
  growthRate: number | null; // percentage
  achievements: string[];
}

export interface TeamMemberDTO {
  id: string | null;
  fullName: string;
  position: string;
  experience: string;
  skills: string[];
}

export interface UseOfFundsDTO {
  category: string;
  percentage: number | null;
  description: string;
}

export interface StartupProfileDTO {
  id: string | null;
  startupName: string;
  logoUrl: string | null;
  website: string | null;
  foundingYear: number | null;
  address: string | null;
  country: string | null;
  contactEmail: string | null;
  phoneNumber: string | null;

  industries: string[];
  technologies: string[];
  markets: string[];
  targetCustomers: string[];

  stage: 'idea' | 'prototype' | 'mvp' | 'pre-seed' | 'seed' | 'growth' | 'expansion' | '';

  businessModel: string;
  description: string;
  problemStatement: string;
  solutionDescription: string;
  productDescription: string;

  fundingNeed: number | null;
  currency: 'USD' | 'VND';

  partnershipNeeds: string[];
  teamCapabilities: string[];

  traction: TractionDTO;
  teamMembers: TeamMemberDTO[];
  useOfFunds: UseOfFundsDTO[];

  profileCompletion: number;
  status: 'completed' | 'verified' | 'draft';
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;

  customFields?: CustomFieldDTO[];
  conflictingFields?: ConflictingField[];
}

export interface ConflictingField {
  field: string;
  currentValue: any;
  proposedValue: any;
  sourceFileId?: string | null;
  status: 'pending_review' | 'resolved';
}

export interface CustomFieldDTO {
  key: string;
  label: string;
  value: any;
  type: 'text' | 'number' | 'percentage' | 'currency' | 'date' | 'list' | 'boolean';
  category: string;
  sourceFileId: string | null;
  confidence: number;
  isAiGenerated?: boolean;
  isInferred?: boolean;
  requiresConfirmation?: boolean;
  sourceText?: string | null;
}

export interface InvestmentRangeDTO {
  min: number | null;
  max: number | null;
  currency: 'USD' | 'VND';
}

export interface PartnerProfileDTO {
  id: string;
  ownerId?: string | null;
  organizationName: string;
  organizationType:
    | 'corporation'
    | 'investment_fund'
    | 'investor'
    | 'university'
    | 'research_institution'
    | 'innovation_organization';

  logoUrl: string | null;
  website: string | null;
  description: string;

  interestedIndustries: string[];
  interestedTechnologies: string[];
  preferredStages: string[];
  preferredMarkets: string[];
  partnershipTypes: string[];

  investmentRange: InvestmentRangeDTO;

  requiredCapabilities: string[];
  requiredConditions: string[];
  excludedConditions: string[];

  challengeDescription: string | null;
  contactEmail: string | null;
  contactPerson?: string | null;
  phoneNumber?: string | null;

  /** Câu hỏi vòng 2 do intake thiết lập sẵn (startup trả lời text / video) */
  round2Questions?: string[];
  /** Ghi chú/yêu cầu mặc định cho vòng 1 (ngoài video call) */
  round1Note?: string | null;

  isActive: boolean;
  isDemo: boolean;
  isTestData?: boolean;
  employeeCount?: number;
  growthRate?: number;
  createdAt?: string;
}

export interface ExtractionField {
  field: string;
  mappedField?: string;
  label?: string;
  type?: string;
  value: any;
  confidence: number;
  sourcePage?: number | null;
  sourceText?: string | null;
  status: 'pending' | 'accepted' | 'edited' | 'rejected';
}

export interface ExtractionResultDTO {
  extractionId: string;
  mode: 'real' | 'demo';
  fields: ExtractionField[];
  rawText: string;
  warnings: string[];
  metadata?: any;
}

export interface ProfileVersionDTO {
  id: string;
  startupId: string;
  versionNumber: number;
  profileData: Partial<StartupProfileDTO>;
  changeSummary: {
    changedFields: string[];
    description: string;
  };
  confirmedBy: string;
  createdAt: string;
}

export interface MatchResultDTO {
  id: string;
  startupId: string;
  partnerId: string;
  totalScore: number;
  scoreBreakdown: {
    industry: number;
    technology: number;
    stage: number;
    partnership: number;
    funding: number;
    market: number;
    capability: number;
  };
  matchedReasons: string[];
  missingRequirements: string[];
  risks: string[];
  recommendation: string;
  matchingVersion: string;
  startupProfileVersion: number;
  partner?: PartnerProfileDTO; // Joined for UI display
  partnerIsDemo?: boolean;
  partner_is_demo?: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Multi-round pipeline:
 * pending → round1 (phỏng vấn) → round2 (câu hỏi) → round2_submitted → accepted.
 * Reject ở bất kỳ vòng nào → rejected.
 */
export type ConnectionStatus =
  | 'pending'
  | 'round1'
  | 'round2'
  | 'round2_submitted'
  | 'accepted'
  | 'rejected'
  | 'cancelled';

export interface ConnectionRound1DTO {
  mode: 'video_call' | 'custom';
  meetingLink: string | null;
  scheduledAt: string | null;
  note: string | null;
  decidedAt?: string | null;
}

export interface Round2AnswerDTO {
  question: string;
  text: string;
  videoFileId: string | null;
}

export interface ConnectionRound2DTO {
  questions: string[];
  answers: Round2AnswerDTO[];
  submittedAt: string | null;
}

export interface ConnectionEventDTO {
  at: string;
  actor: 'startup' | 'intake' | 'system';
  type: string;
  note?: string;
}

export interface ConnectionRequestDTO {
  id: string;
  startupId: string;
  partnerId: string;
  matchId: string;
  matchScore: number;
  message: string;
  status: ConnectionStatus;
  round1?: ConnectionRound1DTO | null;
  round2?: ConnectionRound2DTO | null;
  timeline?: ConnectionEventDTO[];
  decisionNote?: string | null;
  partnerName?: string; // Joined for UI
  partnerType?: string; // Joined for UI
  startupName?: string; // Joined for intake UI
  startupProfile?: Partial<StartupProfileDTO>; // Joined snapshot for intake UI
  partner?: PartnerProfileDTO; // Joined khi accepted (thông tin liên hệ)
  isDemo?: boolean;
  is_demo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StartupDashboardDTO {
  startupName: string | null;
  profileStatus: 'completed' | 'verified' | 'incomplete';
  profileCompletion: number;
  hasUnconfirmedDraft: boolean;
  totalMatches: number;
  highMatchCount: number; // score >= 80
  pendingConnections: number;
  acceptedConnections: number;
  recentMatches: MatchResultDTO[];
  recentConnections: ConnectionRequestDTO[];
  missingFields: string[];
}

export interface SimulationMetrics {
  cash: number;
  revenue: number;
  burnRate: number;
  runway: number;
  growthRate: number;
  productQuality: number;
  customerSat: number;
  teamHealth: number;
  brandRep: number;
  equity: number;
}

export interface SandboxSimulation {
  id: string;
  userId: string;
  partnerId: string;
  partnerName: string;
  status: 'active' | 'completed';
  currentTurn: number; // 1 to 4
  metrics: SimulationMetrics;
  decisions: Array<{
    turn: number;
    scenarioTitle: string;
    scenarioDescription: string;
    choiceSelected: string;
    customReasoning: string;
    metricChanges: Partial<SimulationMetrics>;
  }>;
  report?: SimulationReport;
  investorAction?: 'shortlist' | 'another_challenge' | 'scheduled_meeting' | null;
  meetingDetails?: {
    time: string;
    platform: 'zoom' | 'google_meet';
    link: string;
    notes?: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface SimulationReport {
  performanceScore: number;
  competencies: {
    cashManagement: number;
    resourceAllocation: number;
    customerUnderstanding: number;
    productDevelopment: number;
    teamManagement: number;
    crisisHandling: number;
    adaptability: number;
  };
  keyDecisionsSummary: string;
  investorAuditQuestions: string[];
  overallAssessment: string;
}
