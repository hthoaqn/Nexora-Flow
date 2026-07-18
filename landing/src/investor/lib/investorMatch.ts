import type { StartupProfileDTO, PartnerProfileDTO } from '@/deal-flow/types'
import { MatchingService } from '@/deal-flow/backend/matchingService'
import type { InvestorProfile, InvestorMatch } from '../types'
import { DEMO_INVESTORS } from '../seed/demo-investors'

/** Map investor thesis → PartnerProfileDTO so we reuse MatchingService (concac §VII). */
export function investorToPartner(inv: InvestorProfile): PartnerProfileDTO {
  return {
    id: inv.id,
    ownerId: inv.userId || null,
    organizationName: inv.name,
    organizationType: 'investor',
    logoUrl: inv.logoUrl || null,
    website: inv.website || null,
    description: `${inv.description}\n\nThesis: ${inv.investmentThesis}`,
    interestedIndustries: inv.priorityIndustries,
    interestedTechnologies: inv.techRequirement
      ? inv.techRequirement.split(/[,;]/).map((s) => s.trim()).filter(Boolean)
      : [],
    preferredStages: inv.preferredStages,
    preferredMarkets: inv.investmentRegions,
    partnershipTypes: inv.investmentStyles,
    investmentRange: {
      min: inv.ticketMin,
      max: inv.ticketMax,
      currency: inv.currency,
    },
    requiredCapabilities: inv.teamRequirement
      ? [inv.teamRequirement]
      : [],
    requiredConditions: [
      inv.revenueRequirement,
      inv.marketRequirement,
      inv.scalabilityRequirement,
    ].filter(Boolean) as string[],
    excludedConditions: inv.exclusionCriteria,
    challengeDescription: inv.investmentThesis,
    contactEmail: '',
    isActive: inv.status === 'active',
    isDemo: inv.is_demo,
  } as PartnerProfileDTO
}

export function scoreStartupAgainstInvestors(
  startup: StartupProfileDTO,
  startupId: string,
  investors: InvestorProfile[] = DEMO_INVESTORS,
): InvestorMatch[] {
  const now = new Date().toISOString()
  const results: InvestorMatch[] = []

  for (const inv of investors) {
    if (inv.status !== 'active') continue
    const partner = investorToPartner(inv)
    const match = MatchingService.calculateMatch(startup, partner, 1)
    if (!match) continue

    const breakdown = (match.scoreBreakdown || {}) as Record<string, number>
    results.push({
      id: `im-${startupId}-${inv.id}`,
      startupId,
      investorId: inv.id,
      totalScore: Number(match.totalScore) || 0,
      scoreBreakdown: breakdown,
      matchedReasons: match.matchedReasons || [],
      missingCriteria: match.missingRequirements || [],
      status: 'suggested',
      is_demo: true,
      matchingVersion: 'investor-adapter-1.0',
      createdAt: now,
      updatedAt: now,
      investor: inv,
    })
  }

  return results.sort((a, b) => b.totalScore - a.totalScore)
}
