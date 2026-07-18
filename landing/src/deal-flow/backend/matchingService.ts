/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { StartupProfileDTO, PartnerProfileDTO, MatchResultDTO } from '../types';

export function clampScore(value: any): number {
  try {
    const num = parseFloat(value);
    if (isNaN(num) || !isFinite(num)) {
      return 0.0;
    }
    return Math.max(0.0, Math.min(100.0, num));
  } catch {
    return 0.0;
  }
}

export function toJsonSafe(value: any): any {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'number') {
    if (isNaN(value) || !isFinite(value)) {
      return 0;
    }
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(toJsonSafe);
  }
  if (typeof value === 'object') {
    if (typeof value.toJSON === 'function') {
      return toJsonSafe(value.toJSON());
    }
    const result: Record<string, any> = {};
    for (const key of Object.keys(value)) {
      result[key] = toJsonSafe(value[key]);
    }
    return result;
  }
  return value;
}

const DEFAULT_WEIGHTS = {
  industry: 0.25,
  technology: 0.15,
  stage: 0.15,
  partnership: 0.15,
  funding: 0.10,
  market: 0.10,
  capability: 0.10,
};

const STAGE_ORDER = ['idea', 'prototype', 'mvp', 'pre-seed', 'seed', 'growth', 'expansion'];

const SYNONYM_MAP: Record<string, string> = {
  'ai': 'artificial intelligence',
  'artificial intelligence': 'ai',
  'healthcare': 'healthtech',
  'healthtech': 'healthcare',
  'education technology': 'edtech',
  'edtech': 'education technology',
  'logisticstech': 'logistics',
  'logistics': 'logisticstech',
  'green tech': 'greentech',
  'greentech': 'green tech',
  'clean energy': 'greentech',
  'fintech': 'finance',
  'finance': 'fintech',
  'agriculture': 'agritech',
  'agritech': 'agriculture',
};

// Standardizes a string for robust matching
function normalizeString(val: string): string {
  if (!val) return '';
  return val
    .toLowerCase()
    .trim()
    .replace(/[\s-_]+/g, ' '); // normalize spaces, hyphens and underscores
}

function normalizeArray(arr: string[]): string[] {
  if (!arr) return [];
  return arr.map(normalizeString).filter(Boolean);
}

// Checks if tag or its synonyms match target tags
function tagMatches(sourceTag: string, targetTags: string[]): boolean {
  const normSource = normalizeString(sourceTag);
  if (targetTags.includes(normSource)) return true;

  // Check synonym
  const synonym = SYNONYM_MAP[normSource];
  if (synonym && targetTags.includes(normalizeString(synonym))) {
    return true;
  }
  return false;
}

export class MatchingService {
  public static calculateMatch(
    startup: StartupProfileDTO,
    partner: PartnerProfileDTO,
    profileVersion: number
  ): MatchResultDTO | null {
    // 1. Excluded conditions check safely
    const partnerExcluded = normalizeArray(partner.excludedConditions);
    const startupDescription = normalizeString(
      `${startup.description || ''} ${startup.startupName || ''} ${startup.businessModel || ''} ${startup.problemStatement || ''}`
    );
    const startupIndustries = normalizeArray(startup.industries);
    const startupTechnologies = normalizeArray(startup.technologies);

    let isExcluded = false;
    const violationReason: string[] = [];

    partnerExcluded.forEach((condition) => {
      // Direct substring match on profile text, or keyword check
      if (startupDescription.includes(condition) ||
          startupIndustries.includes(condition) ||
          startupTechnologies.includes(condition)) {
        isExcluded = true;
        violationReason.push(`Violates partner exclusion criteria: "${condition}"`);
      }
    });

    if (isExcluded) {
      return null;
    }

    // Initialize lists for explanation
    const matchedReasons: string[] = [];
    const missingRequirements: string[] = [];
    const risks: string[] = [];
    const scoreBreakdown = {
      industry: 0,
      technology: 0,
      stage: 0,
      partnership: 0,
      funding: 0,
      market: 0,
      capability: 0,
    };

    // 2. Industry matching
    const partnerIndustries = normalizeArray(partner.interestedIndustries);
    const industryOverlap = startupIndustries.filter((ind) => tagMatches(ind, partnerIndustries));
    if (partnerIndustries.length === 0) {
      scoreBreakdown.industry = 100;
    } else if (industryOverlap.length > 0) {
      const ratio = industryOverlap.length / Math.min(startupIndustries.length, 3);
      scoreBreakdown.industry = Math.min(100, Math.round(ratio * 100));
      matchedReasons.push(`Strong overlap in target industries: ${industryOverlap.slice(0, 3).join(', ')}.`);
    } else {
      scoreBreakdown.industry = 0;
    }

    // 3. Technology matching
    const partnerTechs = normalizeArray(partner.interestedTechnologies);
    const techOverlap = startupTechnologies.filter((tech) => tagMatches(tech, partnerTechs));
    if (partnerTechs.length === 0) {
      scoreBreakdown.technology = 100;
    } else if (techOverlap.length > 0) {
      const ratio = techOverlap.length / Math.min(startupTechnologies.length, 3);
      scoreBreakdown.technology = Math.min(100, Math.round(ratio * 100));
      matchedReasons.push(`Core technologies match partner focus: ${techOverlap.slice(0, 3).join(', ')}.`);
    } else {
      scoreBreakdown.technology = 0;
    }

    // 4. Stage matching
    const partnerStages = normalizeArray(partner.preferredStages);
    const startupStage = normalizeString(startup.stage);

    if (partnerStages.length === 0) {
      scoreBreakdown.stage = 100;
    } else if (partnerStages.includes(startupStage)) {
      scoreBreakdown.stage = 100;
      matchedReasons.push(`Your development stage "${startup.stage}" is highly preferred by this partner.`);
    } else {
      const startupIdx = STAGE_ORDER.indexOf(startupStage);
      const firstPreferredIdx = partnerStages.length > 0 ? STAGE_ORDER.indexOf(partnerStages[0]) : -1;

      if (startupIdx === -1 || firstPreferredIdx === -1) {
        scoreBreakdown.stage = 40; // Default mismatch
      } else {
        // Calculate closest stage distance
        let minDiff = 100;
        partnerStages.forEach((ps) => {
          const psIdx = STAGE_ORDER.indexOf(ps);
          if (psIdx !== -1) {
            const diff = Math.abs(startupIdx - psIdx);
            if (diff < minDiff) minDiff = diff;
          }
        });

        if (minDiff === 1) {
          scoreBreakdown.stage = 70;
          matchedReasons.push(`Your stage "${startup.stage}" is closely adjacent to partner expectations.`);
        } else if (minDiff === 2) {
          scoreBreakdown.stage = 40;
          risks.push(`Slight stage mismatch: Partner prefers ${partner.preferredStages.join('/')} but you are in "${startup.stage}".`);
        } else {
          scoreBreakdown.stage = 0;
          risks.push(`Significant stage gap: Partner prefers ${partner.preferredStages.join('/')} and you are in "${startup.stage}".`);
        }
      }
    }

    // 5. Partnership type matching
    const partnerTypes = normalizeArray(partner.partnershipTypes);
    const startupNeeds = normalizeArray(startup.partnershipNeeds);
    const partnershipOverlap = startupNeeds.filter((need) => tagMatches(need, partnerTypes));

    if (partnerTypes.length === 0) {
      scoreBreakdown.partnership = 100;
    } else if (partnershipOverlap.length > 0) {
      scoreBreakdown.partnership = 100;
      matchedReasons.push(`Aligned cooperation formats: ${partnershipOverlap.slice(0, 2).join(', ')}.`);
    } else {
      scoreBreakdown.partnership = 20;
      risks.push(`Cooperation models might not align with current requirements.`);
    }

    // 6. Funding matching safely
    const startupFunding = startup.fundingNeed;
    const investmentRange = partner.investmentRange || { min: null, max: null, currency: 'USD' };
    const partnerMin = investmentRange.min;
    const partnerMax = investmentRange.max;

    if (partner.organizationType !== 'investment_fund' && partner.organizationType !== 'investor') {
      scoreBreakdown.funding = 100;
    } else if (!startupFunding || startupFunding === 0) {
      scoreBreakdown.funding = 30;
      risks.push('Partner is primarily an investor, but your profile indicates no capital requirement.');
    } else {
      if (startup.currency !== investmentRange.currency) {
        scoreBreakdown.funding = 50;
        risks.push(`Currency mismatch (${startup.currency} vs ${investmentRange.currency}). Analysis converted to default confidence.`);
      } else {
        const minVal = partnerMin || 0;
        const maxVal = partnerMax || Infinity;

        if (startupFunding >= minVal && startupFunding <= maxVal) {
          scoreBreakdown.funding = 100;
          matchedReasons.push(`Your funding requirement is perfectly within their typical ticket size (${investmentRange.min?.toLocaleString() || '0'} - ${investmentRange.max?.toLocaleString() || '∞'} ${investmentRange.currency || 'USD'}).`);
        } else if (startupFunding < minVal) {
          scoreBreakdown.funding = 70;
          risks.push('Your requested capital is lower than the typical ticket size of this fund.');
        } else {
          scoreBreakdown.funding = 40;
          risks.push('Your requested capital exceeds the maximum typical ticket size of this fund.');
        }
      }
    }

    // 7. Market matching
    const partnerMarkets = normalizeArray(partner.preferredMarkets);
    const startupMarkets = normalizeArray(startup.markets);
    const marketOverlap = startupMarkets.filter((mkt) => tagMatches(mkt, partnerMarkets));

    if (partnerMarkets.length === 0 || partnerMarkets.includes('global')) {
      scoreBreakdown.market = 100;
    } else if (marketOverlap.length > 0) {
      scoreBreakdown.market = 100;
      matchedReasons.push(`Geographical market fit: active in ${marketOverlap.slice(0, 2).join(', ')}.`);
    } else {
      scoreBreakdown.market = 30;
      risks.push(`Market focus difference: You target ${startup.markets.join('/')} while partner focuses on ${partner.preferredMarkets.join('/')}.`);
    }

    // 8. Capability matching
    const partnerRequiredCap = normalizeArray(partner.requiredCapabilities);
    const startupCapabilities = normalizeArray(startup.teamCapabilities);
    const capOverlap = startupCapabilities.filter((cap) => tagMatches(cap, partnerRequiredCap));

    if (partnerRequiredCap.length === 0) {
      scoreBreakdown.capability = 100;
    } else if (capOverlap.length > 0) {
      const ratio = capOverlap.length / partnerRequiredCap.length;
      scoreBreakdown.capability = Math.round(ratio * 100);
      matchedReasons.push(`Your team matches critical partner capability requirements: ${capOverlap.join(', ')}.`);
    } else {
      scoreBreakdown.capability = 20;
    }

    // Check required conditions (missing requirements) safely
    const partnerRequiredCond = Array.isArray(partner.requiredConditions) ? partner.requiredConditions : [];
    partnerRequiredCond.forEach((cond) => {
      const normCond = normalizeString(cond);
      if (!startupDescription.includes(normCond) &&
          !startupCapabilities.some((c) => c.includes(normCond)) &&
          !startupTechnologies.some((t) => t.includes(normCond))) {
        missingRequirements.push(cond);
      }
    });

    if (missingRequirements.length > 0) {
      scoreBreakdown.capability = Math.max(0, scoreBreakdown.capability - missingRequirements.length * 15);
    }

    // 9. Weighted total calculation with strict clamping
    scoreBreakdown.industry = clampScore(scoreBreakdown.industry);
    scoreBreakdown.technology = clampScore(scoreBreakdown.technology);
    scoreBreakdown.stage = clampScore(scoreBreakdown.stage);
    scoreBreakdown.partnership = clampScore(scoreBreakdown.partnership);
    scoreBreakdown.funding = clampScore(scoreBreakdown.funding);
    scoreBreakdown.market = clampScore(scoreBreakdown.market);
    scoreBreakdown.capability = clampScore(scoreBreakdown.capability);

    const totalScore = clampScore(
      Math.round(
        scoreBreakdown.industry * DEFAULT_WEIGHTS.industry +
          scoreBreakdown.technology * DEFAULT_WEIGHTS.technology +
          scoreBreakdown.stage * DEFAULT_WEIGHTS.stage +
          scoreBreakdown.partnership * DEFAULT_WEIGHTS.partnership +
          scoreBreakdown.funding * DEFAULT_WEIGHTS.funding +
          scoreBreakdown.market * DEFAULT_WEIGHTS.market +
          scoreBreakdown.capability * DEFAULT_WEIGHTS.capability
      )
    );

    // Dynamic recommendations
    let recommendation = '';
    if (totalScore >= 80) {
      recommendation = 'Highly Recommended. Schedule an introduction immediately. Strong synergies across business objectives, technologies, and target market.';
    } else if (totalScore >= 65) {
      recommendation = 'Strong Fit. Proceed with inquiry. Moderate synergy, some gaps in team capabilities or stages that can be resolved via dialogue.';
    } else if (totalScore >= 50) {
      recommendation = 'Considerable Match. Review requirements. Requires alignment on capital or specific operational conditions before committing.';
    } else {
      recommendation = 'Low Compatibility. Only recommended if business strategy changes or a very specific pilot cooperation is desired.';
    }

    const result: MatchResultDTO = {
      id: `match-${partner.id}-${Date.now()}`,
      startupId: startup.id || '',
      partnerId: partner.id,
      totalScore,
      scoreBreakdown,
      matchedReasons,
      missingRequirements,
      risks,
      recommendation,
      matchingVersion: 'v1.0-TS-Core',
      startupProfileVersion: profileVersion,
      partnerIsDemo: partner.isDemo,
      partner_is_demo: partner.isDemo,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return toJsonSafe(result);
  }

  // Runs match for single startup against all active partners
  public static runBatchMatch(startup: StartupProfileDTO, partners: PartnerProfileDTO[], versionNum: number): MatchResultDTO[] {
    const results: MatchResultDTO[] = [];
    partners.forEach((partner) => {
      const res = this.calculateMatch(startup, partner, versionNum);
      if (res) {
        results.push(res);
      }
    });

    // Sort descending by score
    return results.sort((a, b) => b.totalScore - a.totalScore);
  }
}
