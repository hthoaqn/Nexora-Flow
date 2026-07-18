/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import {
  StartupProfileDTO,
  PartnerProfileDTO,
  ProfileVersionDTO,
  MatchResultDTO,
  ConnectionRequestDTO,
  SandboxSimulation,
} from '../types';

// Seed committed in repo; on Vercel use /tmp so writes succeed in serverless
const SEED_FILE = path.join(process.cwd(), 'data_store.json');
const STORE_FILE = process.env.VERCEL
  ? path.join('/tmp', 'nexora-deal-flow-store.json')
  : SEED_FILE;

// Interface for database structure
export interface DBStore {
  users: Array<{
    id: string;
    email: string;
    passwordHash: string; // Plaintext or simple hash for demo/preview purposes
    fullName: string;
    role: 'startup';
    createdAt: string;
  }>;
  profiles: Array<{
    id: string; // Matches user_id
    fullName: string;
    email: string;
    role: 'startup';
    createdAt: string;
    updatedAt: string;
  }>;
  startupProfiles: Record<string, StartupProfileDTO>; // user_id -> profile
  startupProfileVersions: Record<string, ProfileVersionDTO[]>; // user_id -> versions
  startupDocuments: Array<{
    id: string;
    startupId: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    storagePath: string;
    extractionResult: any;
    createdAt: string;
  }>;
  partnerProfiles: PartnerProfileDTO[];
  matchResults: Record<string, MatchResultDTO[]>; // user_id -> matches
  connectionRequests: ConnectionRequestDTO[];
  sandboxSimulations: SandboxSimulation[];
}

export const DEFAULT_PARTNERS: PartnerProfileDTO[] = [
  {
    id: 'p-1',
    ownerId: null,
    organizationName: 'Aurora Seed Ventures',
    organizationType: 'investment_fund',
    logoUrl: null,
    website: 'https://aurora-ventures.demo.example',
    description: 'Quỹ đầu tư mô phỏng tập trung vào startup công nghệ giai đoạn sớm.',
    interestedIndustries: ['Artificial Intelligence', 'Agritech', 'SaaS'],
    interestedTechnologies: ['Machine Learning', 'Computer Vision', 'Cloud Computing'],
    preferredStages: ['mvp', 'pre-seed', 'seed'],
    preferredMarkets: ['Vietnam', 'Southeast Asia'],
    partnershipTypes: ['investment', 'mentoring'],
    investmentRange: { min: 100000, max: 500000, currency: 'USD' },
    requiredCapabilities: ['MVP', 'Technical Team'],
    requiredConditions: ['Có sản phẩm thử nghiệm'],
    excludedConditions: ['idea_only'],
    challengeDescription: 'Tìm startup AI có MVP và khả năng mở rộng tại Đông Nam Á.',
    contactEmail: 'aurora@demo.example',
    isActive: true,
    isDemo: true,
  },
  {
    id: 'p-2',
    ownerId: null,
    organizationName: 'Nova Retail Innovation',
    organizationType: 'corporation',
    logoUrl: null,
    website: 'https://nova-retail.demo.example',
    description: 'Tập đoàn bán lẻ hàng đầu tìm kiếm giải pháp tối ưu trải nghiệm khách hàng và quản lý kho thông minh.',
    interestedIndustries: ['RetailTech', 'Logistics', 'Artificial Intelligence'],
    interestedTechnologies: ['IoT', 'Computer Vision', 'Predictive Analytics'],
    preferredStages: ['mvp', 'seed', 'growth'],
    preferredMarkets: ['Vietnam'],
    partnershipTypes: ['pilot', 'technology_partnership'],
    investmentRange: { min: null, max: null, currency: 'USD' },
    requiredCapabilities: ['API Integration', 'Scalable Architecture'],
    requiredConditions: ['Sẵn sàng triển khai thử nghiệm'],
    excludedConditions: [],
    challengeDescription: 'Tối ưu hóa quy trình thanh toán tự động và kiểm kho thời gian thực.',
    contactEmail: 'nova-retail@demo.example',
    isActive: true,
    isDemo: true,
  },
  {
    id: 'p-3',
    ownerId: null,
    organizationName: 'Green Horizon Capital',
    organizationType: 'investment_fund',
    logoUrl: null,
    website: 'https://green-horizon.demo.example',
    description: 'Quỹ đầu tư mạo hiểm chuyên về các giải pháp công nghệ xanh và giảm thiểu biến đổi khí hậu.',
    interestedIndustries: ['GreenTech', 'CleanTech', 'Energy'],
    interestedTechnologies: ['Solar Tech', 'Battery Tech', 'Carbon Capture'],
    preferredStages: ['seed', 'growth'],
    preferredMarkets: ['Vietnam', 'Southeast Asia', 'Global'],
    partnershipTypes: ['investment', 'research'],
    investmentRange: { min: 200000, max: 1200000, currency: 'USD' },
    requiredCapabilities: ['Carbon quantification metrics', 'ESG reporting framework'],
    requiredConditions: ['Rõ ràng về đóng góp giảm phát thải'],
    excludedConditions: ['coal_or_fossil_fuel'],
    challengeDescription: 'Hỗ trợ các startup năng lượng tái tạo và xử lý rác thải thông minh.',
    contactEmail: 'green-horizon@demo.example',
    isActive: true,
    isDemo: true,
  },
  {
    id: 'p-4',
    ownerId: null,
    organizationName: 'MediCore Health Network',
    organizationType: 'corporation',
    logoUrl: null,
    website: 'https://medicore.demo.example',
    description: 'Hệ thống y tế tư nhân mong muốn hợp tác thử nghiệm lâm sàng và ứng dụng công nghệ số trong khám chữa bệnh.',
    interestedIndustries: ['HealthTech', 'Biotechnology'],
    interestedTechnologies: ['Telehealth', 'Medical Image Processing', 'AI Diagnostics'],
    preferredStages: ['mvp', 'seed', 'growth'],
    preferredMarkets: ['Vietnam'],
    partnershipTypes: ['pilot', 'research'],
    investmentRange: { min: null, max: null, currency: 'USD' },
    requiredCapabilities: ['Data Privacy compliance', 'Medical Standard security'],
    requiredConditions: ['Tuân thủ quy định y tế địa phương'],
    excludedConditions: [],
    challengeDescription: 'Ứng dụng AI chẩn đoán hình ảnh từ xa nâng cao năng lực bác sĩ tuyến cơ sở.',
    contactEmail: 'medicore@demo.example',
    isActive: true,
    isDemo: true,
  },
  {
    id: 'p-5',
    ownerId: null,
    organizationName: 'Atlas Logistics Group',
    organizationType: 'corporation',
    logoUrl: null,
    website: 'https://atlas-logistics.demo.example',
    description: 'Công ty vận tải logistics đa quốc gia tìm kiếm giải pháp tối ưu chặng cuối và kho bãi thông minh.',
    interestedIndustries: ['Logistics', 'IoT'],
    interestedTechnologies: ['Route Optimization', 'Warehouse Automation', 'RFID'],
    preferredStages: ['mvp', 'seed'],
    preferredMarkets: ['Vietnam', 'Southeast Asia'],
    partnershipTypes: ['pilot', 'distribution'],
    investmentRange: { min: null, max: null, currency: 'USD' },
    requiredCapabilities: ['Realtime Tracking APIs', 'ERP integration support'],
    requiredConditions: ['Khả năng tích hợp hệ thống phần mềm sẵn có'],
    excludedConditions: [],
    challengeDescription: 'Giải quyết ùn tắc điều phối đơn hàng trong mùa cao điểm.',
    contactEmail: 'atlas-logistics@demo.example',
    isActive: true,
    isDemo: true,
  },
  {
    id: 'p-6',
    ownerId: null,
    organizationName: 'Future Learning Corporation',
    organizationType: 'corporation',
    logoUrl: null,
    website: 'https://future-learning.demo.example',
    description: 'Tập đoàn giáo dục cung cấp các giải pháp đào tạo trực tuyến và trường học thông minh.',
    interestedIndustries: ['EdTech', 'Artificial Intelligence', 'SaaS'],
    interestedTechnologies: ['AI Tutoring', 'Gamification', 'AR/VR'],
    preferredStages: ['prototype', 'mvp', 'seed'],
    preferredMarkets: ['Vietnam'],
    partnershipTypes: ['pilot', 'customer_acquisition'],
    investmentRange: { min: null, max: null, currency: 'USD' },
    requiredCapabilities: ['Interactive UI', 'Curriculum standard compliance'],
    requiredConditions: ['Sản phẩm thân thiện với trẻ em'],
    excludedConditions: [],
    challengeDescription: 'Số hóa giáo trình STEM và tăng tính tương tác thông qua game hóa.',
    contactEmail: 'future-learning@demo.example',
    isActive: true,
    isDemo: true,
  },
  {
    id: 'p-7',
    ownerId: null,
    organizationName: 'Quantum Industry Labs',
    organizationType: 'corporation',
    logoUrl: null,
    website: 'https://quantum-labs.demo.example',
    description: 'Nhà máy sản xuất linh kiện điện tử tìm kiếm công nghệ tự động hóa và bảo trì dự báo.',
    interestedIndustries: ['Manufacturing', 'Robotics', 'Industrial IoT'],
    interestedTechnologies: ['Predictive Maintenance AI', 'Computer Vision', 'Robotic Arms'],
    preferredStages: ['mvp', 'seed', 'growth'],
    preferredMarkets: ['Vietnam', 'Japan', 'Global'],
    partnershipTypes: ['pilot', 'technology_partnership'],
    investmentRange: { min: null, max: null, currency: 'USD' },
    requiredCapabilities: ['Modbus/OPC-UA protocol support', 'Industrial-grade hardware'],
    requiredConditions: ['Phải chạy tốt trong môi trường nhiệt độ cao'],
    excludedConditions: [],
    challengeDescription: 'Phát hiện lỗi bề mặt sản phẩm bằng camera tốc độ cao.',
    contactEmail: 'quantum-labs@demo.example',
    isActive: true,
    isDemo: true,
  },
  {
    id: 'p-8',
    ownerId: null,
    organizationName: 'Pioneer Fintech Fund',
    organizationType: 'investment_fund',
    logoUrl: null,
    website: 'https://pioneer-fintech.demo.example',
    description: 'Quỹ đầu tư chuyên biệt cho các giải pháp tài chính số đột phá và an ninh bảo mật.',
    interestedIndustries: ['FinTech', 'SaaS', 'Cybersecurity'],
    interestedTechnologies: ['Blockchain', 'Smart Contracts', 'Credit Scoring Models'],
    preferredStages: ['pre-seed', 'seed', 'growth'],
    preferredMarkets: ['Vietnam', 'Southeast Asia'],
    partnershipTypes: ['investment', 'mentoring'],
    investmentRange: { min: 250000, max: 2000000, currency: 'USD' },
    requiredCapabilities: ['PCI-DSS compliance roadmap', 'Advanced Encryption standards'],
    requiredConditions: ['Tuân thủ luật phòng chống rửa tiền AML'],
    excludedConditions: ['gambling_or_unregulated'],
    challengeDescription: 'Đầu tư thúc đẩy chấm điểm tín dụng thay thế cho người dùng chưa có tài khoản ngân hàng.',
    contactEmail: 'pioneer-fintech@demo.example',
    isActive: true,
    isDemo: true,
  },
  {
    id: 'p-9',
    ownerId: null,
    organizationName: 'Vertex Research Institute',
    organizationType: 'research_institution',
    logoUrl: null,
    website: 'https://vertex-institute.demo.example',
    description: 'Viện nghiên cứu ứng dụng chuyển giao công nghệ sinh học và trí tuệ nhân tạo.',
    interestedIndustries: ['Artificial Intelligence', 'Biotechnology', 'Robotics'],
    interestedTechnologies: ['Bio-informatics', 'Deep Learning', 'Advanced Robotics'],
    preferredStages: ['idea', 'prototype', 'mvp'],
    preferredMarkets: ['Vietnam'],
    partnershipTypes: ['research', 'technology_partnership'],
    investmentRange: { min: null, max: null, currency: 'USD' },
    requiredCapabilities: ['PhD level core members', 'Academic research background'],
    requiredConditions: ['Đồng ý công bố nghiên cứu chung'],
    excludedConditions: [],
    challengeDescription: 'Nghiên cứu mô hình ngôn ngữ lớn chuyên sâu cho lĩnh vực nông nghiệp.',
    contactEmail: 'vertex-institute@demo.example',
    isActive: true,
    isDemo: true,
  },
  {
    id: 'p-10',
    ownerId: null,
    organizationName: 'Orbit Digital Ventures',
    organizationType: 'investment_fund',
    logoUrl: null,
    website: 'https://orbit.demo.example',
    description: 'Quỹ mạo hiểm tập trung vào các giải pháp phần mềm doanh nghiệp B2B và dịch vụ đám mây.',
    interestedIndustries: ['SaaS', 'Enterprise Software', 'Artificial Intelligence'],
    interestedTechnologies: ['Generative AI', 'Workflow Automation', 'Cloud native'],
    preferredStages: ['mvp', 'pre-seed', 'seed'],
    preferredMarkets: ['Global', 'Southeast Asia'],
    partnershipTypes: ['investment', 'mentoring'],
    investmentRange: { min: 150000, max: 800000, currency: 'USD' },
    requiredCapabilities: ['ARR > 20k USD', 'Multi-tenant cloud architecture'],
    requiredConditions: ['Mô hình kinh doanh dạng đăng ký thuê bao subscription'],
    excludedConditions: ['hardware_heavy'],
    challengeDescription: 'Thúc đẩy số hóa quy trình quản trị nhân sự và khách hàng doanh nghiệp vừa và nhỏ.',
    contactEmail: 'orbit@demo.example',
    isActive: true,
    isDemo: true,
  },
  {
    id: 'p-11',
    ownerId: null,
    organizationName: 'Horizon Travel Labs',
    organizationType: 'corporation',
    logoUrl: null,
    website: 'https://horizon-travel.demo.example',
    description: 'Tập đoàn du lịch tìm kiếm các công cụ lên kế hoạch thông minh và đặt phòng tự động.',
    interestedIndustries: ['Tourism', 'Artificial Intelligence', 'SaaS'],
    interestedTechnologies: ['Recommender Systems', 'Conversational AI', 'Dynamic Pricing'],
    preferredStages: ['prototype', 'mvp', 'seed'],
    preferredMarkets: ['Vietnam', 'Southeast Asia'],
    partnershipTypes: ['pilot', 'distribution'],
    investmentRange: { min: null, max: null, currency: 'USD' },
    requiredCapabilities: ['GDS API integration', 'Localization in local languages'],
    requiredConditions: ['Có thể tích hợp với các đại lý du lịch OTA lớn'],
    excludedConditions: [],
    challengeDescription: 'Tự động hóa xây dựng hành trình trải nghiệm cá nhân hóa dựa trên thời tiết và mật độ khách du lịch.',
    contactEmail: 'horizon-travel@demo.example',
    isActive: true,
    isDemo: true,
  },
  {
    id: 'p-12',
    ownerId: null,
    organizationName: 'Apex Commerce Network',
    organizationType: 'corporation',
    logoUrl: null,
    website: 'https://apex-commerce.demo.example',
    description: 'Chuỗi siêu thị và trung tâm thương mại lớn mong muốn tối ưu hóa chuỗi cung ứng và bán hàng đa kênh.',
    interestedIndustries: ['E-commerce', 'RetailTech', 'Logistics'],
    interestedTechnologies: ['Omnichannel systems', 'Automatic translation', 'Image generation'],
    preferredStages: ['mvp', 'seed', 'growth'],
    preferredMarkets: ['Vietnam'],
    partnershipTypes: ['pilot', 'customer_acquisition'],
    investmentRange: { min: null, max: null, currency: 'USD' },
    requiredCapabilities: ['User-friendly interface', 'Product catalogue API'],
    requiredConditions: ['Sản phẩm đã có khách hàng sử dụng thực tế'],
    excludedConditions: [],
    challengeDescription: 'Hỗ trợ tiểu thương tạo mô tả sản phẩm tự động và tối ưu hóa quảng cáo đa sàn.',
    contactEmail: 'apex-commerce@demo.example',
    isActive: true,
    isDemo: true,
  },
  {
    id: 'p-13',
    ownerId: null,
    organizationName: 'Shield Cyber Ventures',
    organizationType: 'investment_fund',
    logoUrl: null,
    website: 'https://shield-cyber.demo.example',
    description: 'Quỹ đầu tư chuyên biệt cho các dự án an ninh mạng, chống gian lận và bảo mật dữ liệu.',
    interestedIndustries: ['Cybersecurity', 'FinTech', 'SaaS'],
    interestedTechnologies: ['Zero Trust', 'Encrypted database', 'AI anomaly detection'],
    preferredStages: ['seed', 'growth'],
    preferredMarkets: ['Global', 'Vietnam'],
    partnershipTypes: ['investment'],
    investmentRange: { min: 300000, max: 1500000, currency: 'USD' },
    requiredCapabilities: ['Ethical hacking validation', 'Strong penetration test records'],
    requiredConditions: ['Tuân thủ nghiêm ngặt chuẩn ISO 27001'],
    excludedConditions: [],
    challengeDescription: 'Đầu tư vào các hệ thống phát hiện hành vi xâm nhập trái phép dựa trên phân tích hành vi AI.',
    contactEmail: 'shield-cyber@demo.example',
    isActive: true,
    isDemo: true,
  },
  {
    id: 'p-14',
    ownerId: null,
    organizationName: 'BioNova Research Center',
    organizationType: 'research_institution',
    logoUrl: null,
    website: 'https://bionova.demo.example',
    description: 'Trung tâm nghiên cứu công nghệ sinh học hỗ trợ ươm tạo và thương mại hóa nghiên cứu nông, lâm, y nghiệp.',
    interestedIndustries: ['Biotechnology', 'HealthTech', 'Artificial Intelligence'],
    interestedTechnologies: ['Gene sequencing', 'Molecular modeling AI', 'Biomass tech'],
    preferredStages: ['idea', 'prototype', 'mvp'],
    preferredMarkets: ['Vietnam'],
    partnershipTypes: ['research', 'technology_partnership'],
    investmentRange: { min: null, max: null, currency: 'USD' },
    requiredCapabilities: ['Wet lab access', 'Safety compliance licenses'],
    requiredConditions: ['Sở hữu trí tuệ rõ ràng'],
    excludedConditions: [],
    challengeDescription: 'Thương mại hóa chế phẩm sinh học bảo quan nông sản sau thu hoạch thân thiện môi trường.',
    contactEmail: 'bionova@demo.example',
    isActive: true,
    isDemo: true,
  },
  {
    id: 'p-15',
    ownerId: null,
    organizationName: 'Mekong Innovation Hub',
    organizationType: 'innovation_organization',
    logoUrl: null,
    website: 'https://mekong-hub.demo.example',
    description: 'Tổ chức ươm tạo và thúc đẩy đổi mới sáng tạo khu vực đồng bằng sông Cửu Long, tập trung phát triển bền vững.',
    interestedIndustries: ['Agritech', 'GreenTech', 'Logistics'],
    interestedTechnologies: ['Drones', 'IoT salinity sensors', 'Water treatment'],
    preferredStages: ['idea', 'prototype', 'mvp', 'pre-seed'],
    preferredMarkets: ['Vietnam'],
    partnershipTypes: ['mentoring', 'research', 'pilot'],
    investmentRange: { min: null, max: null, currency: 'USD' },
    requiredCapabilities: ['Local community reach', 'Vietnamese training materials'],
    requiredConditions: ['Tập trung giải quyết vấn đề hạn mặn hoặc nông nghiệp bền vững'],
    excludedConditions: [],
    challengeDescription: 'Kết nối startup với mạng lưới hợp tác xã nông nghiệp chăn nuôi trồng trọt.',
    contactEmail: 'mekong-hub@demo.example',
    isActive: true,
    isDemo: true,
  },
];

export function mapPartnerRowToDTO(row: any): PartnerProfileDTO {
  return {
    id: String(row.id || ''),
    ownerId: row.ownerId !== undefined ? row.ownerId : null,
    organizationName: String(row.organizationName || row.organization_name || ''),
    organizationType: row.organizationType || row.organization_type || 'corporation',
    logoUrl: row.logoUrl || row.logo_url || null,
    website: row.website || null,
    description: row.description || '',
    interestedIndustries: Array.isArray(row.interestedIndustries) ? row.interestedIndustries : (Array.isArray(row.interested_industries) ? row.interested_industries : []),
    interestedTechnologies: Array.isArray(row.interestedTechnologies) ? row.interestedTechnologies : (Array.isArray(row.interested_technologies) ? row.interested_technologies : []),
    preferredStages: Array.isArray(row.preferredStages) ? row.preferredStages : (Array.isArray(row.preferred_stages) ? row.preferred_stages : []),
    preferredMarkets: Array.isArray(row.preferredMarkets) ? row.preferredMarkets : (Array.isArray(row.preferred_markets) ? row.preferred_markets : []),
    partnershipTypes: Array.isArray(row.partnershipTypes) ? row.partnershipTypes : (Array.isArray(row.partnership_types) ? row.partnership_types : []),
    investmentRange: {
      min: row.investmentRange?.min !== undefined ? row.investmentRange.min : (row.investment_min !== undefined ? row.investment_min : null),
      max: row.investmentRange?.max !== undefined ? row.investmentRange.max : (row.investment_max !== undefined ? row.investment_max : null),
      currency: row.investmentRange?.currency || row.currency || 'USD'
    },
    requiredCapabilities: Array.isArray(row.requiredCapabilities) ? row.requiredCapabilities : (Array.isArray(row.required_capabilities) ? row.required_capabilities : []),
    requiredConditions: Array.isArray(row.requiredConditions) ? row.requiredConditions : (Array.isArray(row.required_conditions) ? row.required_conditions : []),
    excludedConditions: Array.isArray(row.excludedConditions) ? row.excludedConditions : (Array.isArray(row.excluded_conditions) ? row.excluded_conditions : []),
    challengeDescription: row.challengeDescription || row.challenge_description || null,
    contactEmail: row.contactEmail || row.contact_email || null,
    isActive: row.isActive !== undefined ? Boolean(row.isActive) : (row.is_active !== undefined ? Boolean(row.is_active) : true),
    isDemo: row.isDemo !== undefined ? Boolean(row.isDemo) : (row.is_demo !== undefined ? Boolean(row.is_demo) : false)
  };
}

class DatabaseEngine {
  private store: DBStore;

  constructor() {
    this.store = this.loadStore();
  }

  private loadStore(): DBStore {
    try {
      // Prefer live store; on cold Vercel instance seed from committed data_store.json
      const readPath = fs.existsSync(STORE_FILE)
        ? STORE_FILE
        : fs.existsSync(SEED_FILE)
          ? SEED_FILE
          : null
      if (readPath) {
        const fileContent = fs.readFileSync(readPath, 'utf8');
        const parsed = JSON.parse(fileContent);

        // Idempotently merge DEFAULT_PARTNERS with loaded partner profiles (equivalent to ON CONFLICT DO UPDATE)
        const parsedPartners: PartnerProfileDTO[] = (parsed.partnerProfiles || []).map(mapPartnerRowToDTO);
        const partnerMap = new Map<string, PartnerProfileDTO>();
        parsedPartners.forEach((p) => {
          if (p.organizationName) {
            partnerMap.set(p.organizationName, p);
          }
        });

        DEFAULT_PARTNERS.forEach((dp) => {
          const existing = partnerMap.get(dp.organizationName);
          if (existing) {
            partnerMap.set(dp.organizationName, {
              ...existing,
              ...dp,
              id: existing.id, // preserve ID
              ownerId: existing.ownerId !== undefined ? existing.ownerId : (dp.ownerId || null),
            });
          } else {
            partnerMap.set(dp.organizationName, dp);
          }
        });

        const mergedPartners = Array.from(partnerMap.values());

        // Fill in missing default tables if structure has changed
        return {
          users: parsed.users || [],
          profiles: parsed.profiles || [],
          startupProfiles: parsed.startupProfiles || {},
          startupProfileVersions: parsed.startupProfileVersions || {},
          startupDocuments: parsed.startupDocuments || [],
          partnerProfiles: mergedPartners,
          matchResults: parsed.matchResults || {},
          connectionRequests: parsed.connectionRequests || [],
          sandboxSimulations: parsed.sandboxSimulations || [],
        };
      }
    } catch (e) {
      console.error('Failed to parse database store file, falling back to clean store', e);
    }

    const initialStore: DBStore = {
      users: [],
      profiles: [],
      startupProfiles: {},
      startupProfileVersions: {},
      startupDocuments: [],
      partnerProfiles: DEFAULT_PARTNERS,
      matchResults: {},
      connectionRequests: [],
      sandboxSimulations: [],
    };
    this.saveStore(initialStore);
    return initialStore;
  }

  public saveStore(customStore?: DBStore) {
    try {
      const dataToSave = customStore || this.store;
      fs.writeFileSync(STORE_FILE, JSON.stringify(dataToSave, null, 2), 'utf8');
    } catch (e) {
      console.error('Failed to persist database state', e);
    }
  }

  // Auth Operations
  public findUserByEmail(email: string) {
    return this.store.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  }

  public findUserById(id: string) {
    return this.store.users.find((u) => u.id === id);
  }

  public createUser(email: string, passwordHash: string, fullName: string) {
    const id = `u-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const user = {
      id,
      email,
      passwordHash,
      fullName,
      role: 'startup' as const,
      createdAt: new Date().toISOString(),
    };
    const profile = {
      id,
      fullName,
      email,
      role: 'startup' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.store.users.push(user);
    this.store.profiles.push(profile);
    this.saveStore();

    return { user, profile };
  }

  public getProfile(userId: string) {
    return this.store.profiles.find((p) => p.id === userId);
  }

  // Startup Profile Operations
  public getStartupProfile(userId: string): StartupProfileDTO | null {
    return this.store.startupProfiles[userId] || null;
  }

  public createStartupProfile(userId: string, profileData: Partial<StartupProfileDTO>): StartupProfileDTO {
    const id = `sp-${Date.now()}`;
    const newProfile: StartupProfileDTO = {
      ...(profileData as StartupProfileDTO),
      id,
      status: 'completed',
      confirmedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.store.startupProfiles[userId] = newProfile;

    // Create first history version
    this.createProfileVersion(userId, newProfile, {
      changedFields: Object.keys(profileData),
      description: 'Initial startup profile creation confirmed by user',
    });

    this.saveStore();
    return newProfile;
  }

  public updateStartupProfile(userId: string, profileData: Partial<StartupProfileDTO>): StartupProfileDTO {
    const current = this.getStartupProfile(userId);
    if (!current) {
      return this.createStartupProfile(userId, profileData);
    }

    // Save previous version to history list
    const versionNumber = (this.store.startupProfileVersions[userId]?.length || 0) + 1;
    this.createProfileVersion(userId, current, {
      changedFields: Object.keys(profileData),
      description: `Update profile fields (Version ${versionNumber})`,
    });

    const updatedProfile: StartupProfileDTO = {
      ...current,
      ...profileData,
      status: 'completed',
      confirmedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.store.startupProfiles[userId] = updatedProfile;
    this.saveStore();
    return updatedProfile;
  }

  private createProfileVersion(userId: string, profile: StartupProfileDTO, summary: { changedFields: string[]; description: string }) {
    if (!this.store.startupProfileVersions[userId]) {
      this.store.startupProfileVersions[userId] = [];
    }

    const versionNum = this.store.startupProfileVersions[userId].length + 1;
    const version: ProfileVersionDTO = {
      id: `v-${userId}-${versionNum}-${Date.now()}`,
      startupId: profile.id || 'unknown',
      versionNumber: versionNum,
      profileData: JSON.parse(JSON.stringify(profile)),
      changeSummary: summary,
      confirmedBy: profile.contactEmail || 'user',
      createdAt: new Date().toISOString(),
    };

    this.store.startupProfileVersions[userId].push(version);
  }

  public getProfileVersions(userId: string): ProfileVersionDTO[] {
    return this.store.startupProfileVersions[userId] || [];
  }

  public getProfileVersionById(userId: string, versionId: string): ProfileVersionDTO | null {
    const list = this.getProfileVersions(userId);
    return list.find((v) => v.id === versionId) || null;
  }

  // Document management
  public addStartupDocument(userId: string, doc: { fileName: string; fileType: string; fileSize: number; storagePath: string; extractionResult: any }) {
    const startup = this.getStartupProfile(userId);
    const docRecord = {
      id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      startupId: startup?.id || `sp-temp-${userId}`,
      ...doc,
      createdAt: new Date().toISOString(),
    };
    this.store.startupDocuments.push(docRecord);
    this.saveStore();
    return docRecord;
  }

  public getStartupDocuments(userId: string) {
    const startup = this.getStartupProfile(userId);
    if (!startup) return [];
    return this.store.startupDocuments.filter((d) => d.startupId === startup.id);
  }

  // Partner Profiles
  public getPartnerProfiles(activeOnly = true): PartnerProfileDTO[] {
    if (activeOnly) {
      return this.store.partnerProfiles.filter((p) => p.isActive);
    }
    return this.store.partnerProfiles;
  }

  public getPartnerById(partnerId: string): PartnerProfileDTO | null {
    return this.store.partnerProfiles.find((p) => p.id === partnerId) || null;
  }

  // Match Operations
  public getMatchResults(userId: string): MatchResultDTO[] {
    return this.store.matchResults[userId] || [];
  }

  public getMatchById(userId: string, matchId: string): MatchResultDTO | null {
    const list = this.getMatchResults(userId);
    return list.find((m) => m.id === matchId) || null;
  }

  public saveMatchResults(userId: string, results: MatchResultDTO[]) {
    this.store.matchResults[userId] = results;
    this.saveStore();
  }

  public clearMatchResults(userId: string) {
    this.store.matchResults[userId] = [];
    this.saveStore();
  }

  // Connection Requests
  public getConnectionRequests(userId: string): ConnectionRequestDTO[] {
    const startup = this.getStartupProfile(userId);
    if (!startup) return [];
    return this.store.connectionRequests.filter((cr) => cr.startupId === startup.id);
  }

  public createConnectionRequest(
    userId: string,
    req: { partnerId: string; matchId: string; matchScore: number; message: string }
  ): ConnectionRequestDTO {
    const startup = this.getStartupProfile(userId);
    if (!startup) {
      throw new Error('STARTUP_PROFILE_NOT_FOUND');
    }

    // Check duplicate
    const exists = this.store.connectionRequests.some(
      (cr) => cr.startupId === startup.id && cr.partnerId === req.partnerId
    );
    if (exists) {
      throw new Error('CONNECTION_ALREADY_EXISTS');
    }

    const crRecord: ConnectionRequestDTO = {
      id: `cr-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      startupId: startup.id!,
      partnerId: req.partnerId,
      matchId: req.matchId,
      matchScore: req.matchScore,
      message: req.message,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.store.connectionRequests.push(crRecord);
    this.saveStore();
    return crRecord;
  }

  public updateConnectionMessage(connectionId: string, message: string): ConnectionRequestDTO {
    const record = this.store.connectionRequests.find((cr) => cr.id === connectionId);
    if (!record) {
      throw new Error('CONNECTION_NOT_FOUND');
    }
    if (record.status !== 'pending') {
      throw new Error('CONNECTION_NOT_PENDING');
    }
    record.message = message;
    record.updatedAt = new Date().toISOString();
    this.saveStore();
    return record;
  }

  public cancelConnectionRequest(connectionId: string) {
    const index = this.store.connectionRequests.findIndex((cr) => cr.id === connectionId);
    if (index === -1) {
      throw new Error('CONNECTION_NOT_FOUND');
    }
    const record = this.store.connectionRequests[index];
    if (record.status !== 'pending') {
      throw new Error('CONNECTION_NOT_PENDING');
    }
    this.store.connectionRequests.splice(index, 1);
    this.saveStore();
  }

  // Sandbox Simulations
  public getSandboxSimulation(userId: string, partnerId: string): SandboxSimulation | null {
    return this.store.sandboxSimulations.find(s => s.userId === userId && s.partnerId === partnerId) || null;
  }

  public getActiveSandbox(userId: string): SandboxSimulation | null {
    return this.store.sandboxSimulations.find(s => s.userId === userId && s.status === 'active') || null;
  }

  public saveSandboxSimulation(sim: SandboxSimulation): SandboxSimulation {
    const idx = this.store.sandboxSimulations.findIndex(s => s.id === sim.id);
    if (idx === -1) {
      this.store.sandboxSimulations.push(sim);
    } else {
      this.store.sandboxSimulations[idx] = sim;
    }
    this.saveStore();
    return sim;
  }

  public listSandboxSimulations(userId: string): SandboxSimulation[] {
    return this.store.sandboxSimulations.filter(s => s.userId === userId);
  }
}

export const db = new DatabaseEngine();
