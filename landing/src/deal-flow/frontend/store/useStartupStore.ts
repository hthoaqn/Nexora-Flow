// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { StartupProfileDTO, ExtractionResultDTO, TeamMemberDTO, UseOfFundsDTO } from '../../types';

export const createEmptyProfile = (): StartupProfileDTO => ({
  id: null,
  startupName: '',
  logoUrl: null,
  website: null,
  foundingYear: null,
  address: null,
  country: null,
  contactEmail: null,
  phoneNumber: null,
  industries: [],
  technologies: [],
  markets: [],
  targetCustomers: [],
  stage: '',
  businessModel: '',
  description: '',
  problemStatement: '',
  solutionDescription: '',
  productDescription: '',
  fundingNeed: null,
  currency: 'USD',
  partnershipNeeds: [],
  teamCapabilities: [],
  traction: {
    customerCount: null,
    userCount: null,
    monthlyRevenue: null,
    annualRevenue: null,
    growthRate: null,
    achievements: [],
  },
  teamMembers: [],
  useOfFunds: [],
  profileCompletion: 0,
  status: 'draft',
  confirmedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

// Single unified field mapping between OCR/Doc extraction and StartupProfile
export const EXTRACTION_FIELD_MAP: Record<string, string> = {
  startup_name: "startupName",
  company_name: "startupName",
  startupName: "startupName",

  logo_url: "logoUrl",
  logoUrl: "logoUrl",

  founding_year: "foundingYear",
  foundingYear: "foundingYear",

  contact_email: "contactEmail",
  email: "contactEmail",
  contactEmail: "contactEmail",

  phone_number: "phoneNumber",
  phone: "phoneNumber",
  phoneNumber: "phoneNumber",

  business_model: "businessModel",
  businessModel: "businessModel",

  problem_statement: "problemStatement",
  problemStatement: "problemStatement",

  solution_description: "solutionDescription",
  solutionDescription: "solutionDescription",

  product_description: "productDescription",
  productDescription: "productDescription",

  funding_need: "fundingNeed",
  fundingNeed: "fundingNeed",

  target_customers: "targetCustomers",
  targetCustomers: "targetCustomers",

  partnership_needs: "partnershipNeeds",
  partnershipNeeds: "partnershipNeeds",

  team_capabilities: "teamCapabilities",
  teamCapabilities: "teamCapabilities",

  customer_count: "traction.customerCount",
  user_count: "traction.userCount",
  monthly_revenue: "traction.monthlyRevenue",
  annual_revenue: "traction.annualRevenue",
  growth_rate: "traction.growthRate",
  achievements: "traction.achievements",

  // Additional common extractions
  industries: "industries",
  industry: "industries",
  industry_focus: "industries",
  
  technologies: "technologies",
  technology: "technologies",
  core_technology: "technologies",
  
  markets: "markets",
  market: "markets",
  target_markets: "markets",
  
  stage: "stage",
  startup_stage: "stage",
  development_stage: "stage",

  website: "website",
};

interface StartupState {
  confirmedProfile: StartupProfileDTO | null;
  localDraft: StartupProfileDTO | null;
  extractionDraft: ExtractionResultDTO | null;
  selectedChanges: string[]; // List of fields user selected to apply during merge/comparison
  isDirty: boolean;
  draftSource: 'direct' | 'ocr' | 'doc' | null;
  validationErrors: Record<string, string>;
  lastLocalSavedAt: string | null;

  setConfirmedProfile: (profile: StartupProfileDTO | null) => void;
  initDraftFromConfirmed: () => void;
  initializeDraftFromConfirmedProfile: () => void; // alias
  updateDraftField: <K extends keyof StartupProfileDTO>(field: K, value: StartupProfileDTO[K]) => void;
  updateDraftTractionField: <K extends keyof StartupProfileDTO['traction']>(field: K, value: StartupProfileDTO['traction'][K]) => void;
  setDraftField: (path: string, value: any) => void; // path based setter
  updateDraftTeamMembers: (members: TeamMemberDTO[]) => void;
  updateDraftUseOfFunds: (funds: UseOfFundsDTO[]) => void;
  setExtractionDraft: (extraction: ExtractionResultDTO | null) => void;
  clearExtractionDraft: () => void; // alias
  updateExtractionFieldStatus: (fieldName: string, status: 'accepted' | 'edited' | 'rejected', editedValue?: any) => void;
  mergeAcceptedExtractionFields: () => void;
  mergeApprovedExtractionFields: (fields: Partial<StartupProfileDTO>) => void; // direct fields merge
  setSelectedChanges: (fields: string[]) => void;
  resetDraft: () => void;
  cancelDraft: () => void;
  clearStartupState: () => void;
}

export const useStartupStore = create<StartupState>()(
  persist(
    (set, get) => ({
      confirmedProfile: null,
      localDraft: null,
      extractionDraft: null,
      selectedChanges: [],
      isDirty: false,
      draftSource: null,
      validationErrors: {},
      lastLocalSavedAt: null,

      setConfirmedProfile: (profile) => {
        set({ confirmedProfile: profile });
      },

      initDraftFromConfirmed: () => {
        const { confirmedProfile, localDraft } = get();
        if (!localDraft) {
          const initial = confirmedProfile
            ? JSON.parse(JSON.stringify(confirmedProfile))
            : createEmptyProfile();
          set({ localDraft: initial, isDirty: false, draftSource: 'direct' });
        }
      },

      initializeDraftFromConfirmedProfile: () => {
        get().initDraftFromConfirmed();
      },

      updateDraftField: (field, value) => {
        const { localDraft } = get();
        const currentDraft = localDraft || createEmptyProfile();
        const updated = {
          ...currentDraft,
          [field]: value,
          updatedAt: new Date().toISOString(),
        };
        set({
          localDraft: updated,
          isDirty: true,
          draftSource: get().draftSource || 'direct',
          lastLocalSavedAt: new Date().toISOString(),
        });
      },

      updateDraftTractionField: (field, value) => {
        const { localDraft } = get();
        const currentDraft = localDraft || createEmptyProfile();
        const updatedTraction = {
          ...currentDraft.traction,
          [field]: value,
        };
        const updated = {
          ...currentDraft,
          traction: updatedTraction,
          updatedAt: new Date().toISOString(),
        };
        set({
          localDraft: updated,
          isDirty: true,
          lastLocalSavedAt: new Date().toISOString(),
        });
      },

      setDraftField: (path, value) => {
        const { localDraft } = get();
        const currentDraft = localDraft ? JSON.parse(JSON.stringify(localDraft)) : createEmptyProfile();

        if (path.startsWith('traction.')) {
          const tractionKey = path.split('.')[1] as keyof StartupProfileDTO['traction'];
          if (!currentDraft.traction) {
            currentDraft.traction = {
              customerCount: null,
              userCount: null,
              monthlyRevenue: null,
              annualRevenue: null,
              growthRate: null,
              achievements: [],
            };
          }
          
          if (tractionKey === 'achievements') {
            currentDraft.traction.achievements = Array.isArray(value)
              ? value
              : (typeof value === 'string' ? value.split(/[,;\n\r]+/).map(s => s.trim()).filter(Boolean) : (value ? [value] : []));
          } else {
            currentDraft.traction[tractionKey] = value;
          }
        } else {
          const isArrayField = ['industries', 'technologies', 'markets', 'targetCustomers', 'partnershipNeeds', 'teamCapabilities'].includes(path);
          if (isArrayField) {
            currentDraft[path as keyof StartupProfileDTO] = Array.isArray(value)
              ? value
              : (typeof value === 'string' ? value.split(/[,;\n\r]+/).map(s => s.trim()).filter(Boolean) : (value ? [value] : [])) as any;
          } else {
            currentDraft[path as keyof StartupProfileDTO] = value;
          }
        }

        set({
          localDraft: currentDraft,
          isDirty: true,
          lastLocalSavedAt: new Date().toISOString(),
        });
      },

      updateDraftTeamMembers: (members) => {
        const { localDraft } = get();
        const currentDraft = localDraft || createEmptyProfile();
        const updated = {
          ...currentDraft,
          teamMembers: members,
          updatedAt: new Date().toISOString(),
        };
        set({
          localDraft: updated,
          isDirty: true,
          lastLocalSavedAt: new Date().toISOString(),
        });
      },

      updateDraftUseOfFunds: (funds) => {
        const { localDraft } = get();
        const currentDraft = localDraft || createEmptyProfile();
        const updated = {
          ...currentDraft,
          useOfFunds: funds,
          updatedAt: new Date().toISOString(),
        };
        set({
          localDraft: updated,
          isDirty: true,
          lastLocalSavedAt: new Date().toISOString(),
        });
      },

      setExtractionDraft: (extraction) => {
        set({
          extractionDraft: extraction,
          draftSource: extraction ? (extraction.mode === 'real' ? 'ocr' : 'doc') : get().draftSource,
        });
      },

      clearExtractionDraft: () => {
        set({ extractionDraft: null });
      },

      updateExtractionFieldStatus: (fieldName, status, editedValue) => {
        const { extractionDraft } = get();
        if (!extractionDraft) return;

        const updatedFields = extractionDraft.fields.map((f) => {
          if (f.field === fieldName) {
            return {
              ...f,
              status,
              value: editedValue !== undefined ? editedValue : f.value,
            };
          }
          return f;
        });

        set({
          extractionDraft: {
            ...extractionDraft,
            fields: updatedFields,
          },
        });
      },

      mergeAcceptedExtractionFields: () => {
        const { localDraft, extractionDraft } = get();
        const currentDraft = localDraft ? JSON.parse(JSON.stringify(localDraft)) : createEmptyProfile();
        if (!extractionDraft) return;

        // Requirement: Filter by exact status 'accepted' or 'edited'
        const approvedFields = extractionDraft.fields.filter(
          (f) => f.status === 'accepted' || f.status === 'edited'
        );

        if (!currentDraft.traction) {
          currentDraft.traction = {
            customerCount: null,
            userCount: null,
            monthlyRevenue: null,
            annualRevenue: null,
            growthRate: null,
            achievements: [],
          };
        }

        approvedFields.forEach((item) => {
          const rawField = item.field;
          const mappedKey = EXTRACTION_FIELD_MAP[rawField] || item.mappedField || rawField;

          if (!mappedKey || mappedKey === 'other') return;

          let value = item.value;

          // Convert to Array fields correctly
          const isArrayField = ['industries', 'technologies', 'markets', 'targetCustomers', 'partnershipNeeds', 'teamCapabilities', 'traction.achievements'].includes(mappedKey);

          if (isArrayField) {
            if (typeof value === 'string') {
              value = value.split(/[,;\n\r]+/).map(s => s.trim()).filter(Boolean);
            } else if (!Array.isArray(value)) {
              value = value ? [value] : [];
            } else {
              value = value.map((s: any) => String(s).trim()).filter(Boolean);
            }
          }

          // Convert to number fields correctly
          if (mappedKey === 'foundingYear' || mappedKey === 'fundingNeed') {
            if (value !== null && value !== undefined && value !== '') {
              const num = Number(value);
              value = isNaN(num) ? null : num;
            } else {
              value = null;
            }
          }

          if (mappedKey.startsWith('traction.')) {
            const tractionKey = mappedKey.split('.')[1] as keyof StartupProfileDTO['traction'];
            if (tractionKey === 'customerCount' || tractionKey === 'userCount' || tractionKey === 'monthlyRevenue' || tractionKey === 'annualRevenue' || tractionKey === 'growthRate') {
              if (value !== null && value !== undefined && value !== '') {
                const num = Number(value);
                value = isNaN(num) ? null : num;
              } else {
                value = null;
              }
            }
            (currentDraft.traction as any)[tractionKey] = value;
          } else {
            (currentDraft as any)[mappedKey] = value;
          }
        });

        set({
          localDraft: currentDraft,
          isDirty: true,
          lastLocalSavedAt: new Date().toISOString(),
          extractionDraft: null, // clear after successful merge
        });
      },

      mergeApprovedExtractionFields: (fields) => {
        const { localDraft } = get();
        const currentDraft = localDraft ? JSON.parse(JSON.stringify(localDraft)) : createEmptyProfile();
        
        // Deep merge approved direct fields
        Object.keys(fields).forEach((key) => {
          const val = fields[key as keyof StartupProfileDTO];
          if (key === 'traction' && val && typeof val === 'object') {
            currentDraft.traction = {
              ...currentDraft.traction,
              ...(val as any),
            };
          } else {
            (currentDraft as any)[key] = val;
          }
        });

        set({
          localDraft: currentDraft,
          isDirty: true,
          lastLocalSavedAt: new Date().toISOString(),
        });
      },

      setSelectedChanges: (fields) => {
        set({ selectedChanges: fields });
      },

      resetDraft: () => {
        const { confirmedProfile } = get();
        if (confirmedProfile) {
          set({
            localDraft: JSON.parse(JSON.stringify(confirmedProfile)),
            isDirty: false,
            validationErrors: {},
          });
        } else {
          set({
            localDraft: createEmptyProfile(),
            isDirty: false,
            validationErrors: {},
          });
        }
      },

      cancelDraft: () => {
        set({
          localDraft: null,
          extractionDraft: null,
          selectedChanges: [],
          isDirty: false,
          draftSource: null,
          validationErrors: {},
        });
      },

      clearStartupState: () => {
        set({
          confirmedProfile: null,
          localDraft: null,
          extractionDraft: null,
          selectedChanges: [],
          isDirty: false,
          draftSource: null,
          validationErrors: {},
          lastLocalSavedAt: null,
        });
      },
    }),
    {
      name: 'dealflow-startup-storage',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
