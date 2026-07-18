/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PartnerProfileDTO } from '../types';
import { db, DEFAULT_PARTNERS } from './db';

export interface PartnerFilters {
  organizationType?: string;
  industry?: string;
  stage?: string;
  partnershipType?: string;
  market?: string;
  page?: number;
  limit?: number;
}

export interface PartnerProvider {
  listActivePartners(filters?: PartnerFilters): Promise<PartnerProfileDTO[]>;
  getPartnerById(partnerId: string): Promise<PartnerProfileDTO | null>;
}

// 1. Local Provider (Demo Data)
export class LocalPartnerProvider implements PartnerProvider {
  async listActivePartners(filters?: PartnerFilters): Promise<PartnerProfileDTO[]> {
    let partners = db.getPartnerProfiles(true);

    if (filters) {
      if (filters.organizationType) {
        partners = partners.filter(
          (p) => p.organizationType.toLowerCase() === filters.organizationType?.toLowerCase()
        );
      }
      if (filters.industry) {
        const ind = filters.industry.toLowerCase();
        partners = partners.filter((p) =>
          p.interestedIndustries.some((i) => i.toLowerCase().includes(ind))
        );
      }
      if (filters.stage) {
        const stg = filters.stage.toLowerCase();
        partners = partners.filter((p) =>
          p.preferredStages.some((s) => s.toLowerCase() === stg)
        );
      }
      if (filters.partnershipType) {
        const pt = filters.partnershipType.toLowerCase();
        partners = partners.filter((p) =>
          p.partnershipTypes.some((t) => t.toLowerCase() === pt)
        );
      }
      if (filters.market) {
        const mkt = filters.market.toLowerCase();
        partners = partners.filter((p) =>
          p.preferredMarkets.some((m) => m.toLowerCase().includes(mkt))
        );
      }
    }
    return partners;
  }

  async getPartnerById(partnerId: string): Promise<PartnerProfileDTO | null> {
    return db.getPartnerById(partnerId);
  }
}

// 2. Supabase Provider (To be implemented fully later)
export class SupabasePartnerProvider implements PartnerProvider {
  async listActivePartners(filters?: PartnerFilters): Promise<PartnerProfileDTO[]> {
    // Current implementation uses file-based db.
    // In future, this will connect to real Supabase.
    let partners = db.getPartnerProfiles(true);
    
    // ... apply filters ...
    return partners;
  }

  async getPartnerById(partnerId: string): Promise<PartnerProfileDTO | null> {
    return db.getPartnerById(partnerId);
  }
}

// Factory to resolve selected provider
export function getPartnerProvider(): PartnerProvider {
  const providerType = process.env.MATCHING_DATA_PROVIDER || 'local';
  if (providerType.toLowerCase() === 'supabase') {
    return new SupabasePartnerProvider();
  }
  return new LocalPartnerProvider();
}
