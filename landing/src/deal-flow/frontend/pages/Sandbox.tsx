// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { SandboxSimulation, ConnectionRequestDTO } from '../../types';
import { toast } from 'sonner';
import {
  Gamepad2,
  TrendingUp,
  DollarSign,
  Users,
  Award,
  Calendar,
  AlertTriangle,
  ChevronRight,
  Sparkles,
  HelpCircle,
  Briefcase,
  PlayCircle,
  Clock,
  Compass,
  Cpu,
  Shield,
  ExternalLink,
  Target,
  Link2,
  Layers,
  BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { usePortalI18n } from '../i18n';
import { PortalHero, SoftButton } from '../components/PortalUI';

/** Map API 1.3 sandbox DTO → shape UI expects */
function normalizeSim(raw: any): any | null {
  if (!raw || typeof raw !== 'object') return null
  const partner = raw.partner || {}
  // Game has 4 scripted turns — default must match or the finish screen never shows
  const maxSteps = Number(raw.maxSteps ?? raw.maxTurns ?? 4) || 4
  const currentTurn = Number(raw.currentTurn ?? raw.currentStep ?? 1) || 1
  const m = raw.metrics || {}
  const num = (v: any, fallback = 0) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : fallback
  }
  return {
    ...raw,
    partnerId: raw.partnerId || partner.id || '',
    partnerName:
      raw.partnerName || partner.organizationName || partner.name || 'Đối tác',
    currentTurn,
    maxSteps,
    metrics: {
      cash: num(m.cash),
      runway: num(m.runway),
      revenue: num(m.revenue),
      growthRate: num(m.growthRate ?? m.growth),
      growth: num(m.growth ?? m.growthRate),
      productQuality: num(m.productQuality),
      customerSat: num(m.customerSat),
      teamHealth: num(m.teamHealth),
      brandRep: num(m.brandRep),
      equity: num(m.equity),
    },
    status: raw.status || 'active',
  }
}

function normalizeConnection(c: any) {
  if (!c) return null
  const partner = c.partner || {}
  return {
    ...c,
    partnerId: c.partnerId || partner.id || '',
    partnerName:
      c.partnerName || partner.organizationName || partner.name || 'Đối tác',
    partnerType:
      c.partnerType || partner.organizationType || partner.type || '',
    status: String(c.status || '').toLowerCase(),
  }
}

function turnFromApiPrompt(sim: any) {
  const prompt = sim?.currentPrompt
  if (!prompt) return null
  const choicesObj = prompt.choices || {}
  const choices = ['A', 'B', 'C'].map((id) => {
    const c = choicesObj[id] || {}
    const deltas = c.deltas || {}
    const impact =
      Object.keys(deltas).length > 0
        ? Object.entries(deltas)
            .map(([k, v]) => `${k} ${Number(v) >= 0 ? '+' : ''}${v}`)
            .join(', ')
        : c.impact || c.effect || '—'
    return {
      id,
      text: c.label || c.text || c.title || `Phương án ${id}`,
      impact,
    }
  })
  return {
    title: prompt.title || `Bước ${sim.currentTurn}`,
    description: prompt.prompt || prompt.description || prompt.text || '',
    choices,
  }
}

export default function Sandbox() {
  const { t, lang } = usePortalI18n();
  const tx = (vi: string, en: string) => (lang === 'vi' ? vi : en);
  const [activeSim, setActiveSim] = useState<SandboxSimulation | null>(null);
  const [loading, setLoading] = useState(true);
  const [connections, setConnections] = useState<ConnectionRequestDTO[]>([]);
  const [demoPartners, setDemoPartners] = useState<any[]>([]);
  const [startingPartnerId, setStartingPartnerId] = useState('');
  const [quickStarting, setQuickStarting] = useState(false);
  
  // Turn selection state
  const [selectedChoice, setSelectedChoice] = useState<'A' | 'B' | 'C' | null>(null);
  const [customReasoning, setCustomReasoning] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [completing, setCompleting] = useState(false);

  // Investor actions state
  const [investingAction, setInvestingAction] = useState<'shortlist' | 'another_challenge' | 'scheduled_meeting'>('shortlist');
  const [meetingTime, setMeetingTime] = useState('');
  const [meetingLink, setMeetingLink] = useState('https://meet.google.com/abc-defg-hij');
  const [meetingNotes, setMeetingNotes] = useState('Thảo luận kế hoạch chi tiết tích hợp dịch vụ sản phẩm.');
  const [savingInvestorAction, setSavingInvestorAction] = useState(false);

  const fetchActiveSim = async () => {
    try {
      const res = await api.get('/startup/sandbox/active');
      if (res.data && res.data.success) {
        const sim = normalizeSim(res.data.data);
        setActiveSim(sim);
        // Sync journey if API already has a completed sim
        const st = String(sim?.status || '').toLowerCase();
        if (st === 'completed' || sim?.report) {
          try {
            const { markSandboxCompleted } = await import('../lib/sandboxProgress');
            const { useAuthStore } = await import('../store/useAuthStore');
            const uid = useAuthStore.getState().user?.id;
            if (uid) markSandboxCompleted(uid, { simId: sim?.id });
          } catch {
            /* ignore */
          }
        }
      }
    } catch (e) {
      console.error('Không thể lấy thông tin sandbox đang hoạt động', e);
    }
  };

  const fetchConnections = async () => {
    try {
      const res = await api.get('/startup/connections');
      if (res.data && res.data.success) {
        const raw = res.data.data
        const list = Array.isArray(raw) ? raw : raw?.items || []
        const accepted = list
          .map(normalizeConnection)
          .filter((c: any) => c && c.status === 'accepted' && c.partnerId)
        setConnections(accepted);
        if (accepted.length > 0) {
          setStartingPartnerId(accepted[0].partnerId);
        }
      }
    } catch (e) {
      console.error('Không thể tải danh sách kết nối', e);
    }
  };

  const fetchDemoPartners = async () => {
    try {
      const res = await api.get('/partners', { params: { page: 1, limit: 20 } })
      if (res.data?.success) {
        const items = res.data.data?.items || res.data.data || []
        const list = Array.isArray(items) ? items : []
        const demos = list.filter((p: any) => p.isDemo || p.is_demo) || list
        setDemoPartners(demos.length ? demos : list)
        if (!startingPartnerId && demos[0]?.id) {
          // only seed default if no accepted connection yet
        }
      }
    } catch (e) {
      console.error('Không tải được partners demo', e)
    }
  }

  const loadData = async () => {
    setLoading(true);
    await Promise.all([fetchActiveSim(), fetchConnections(), fetchDemoPartners()]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateSimulation = async (pId: string) => {
    if (!pId) {
      toast.error(tx('Vui lòng chọn đối tác kết nối để khởi tạo.', 'Please pick a connected partner first.'));
      return;
    }
    const toastId = toast.loading(tx('Đang khởi tạo môi trường giả lập Sandbox...', 'Spinning up the sandbox environment…'));
    try {
      const res = await api.post('/startup/sandbox/create', { partnerId: pId });
      if (res.data && res.data.success) {
        toast.success(tx('Môi trường giả lập Sandbox đã được khởi tạo thành công!', 'Sandbox environment is ready!'), { id: toastId });
        setActiveSim(normalizeSim(res.data.data));
        setSelectedChoice(null);
        setCustomReasoning('');
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || tx('Không thể khởi tạo giả lập Sandbox.', 'Could not start the sandbox.'), { id: toastId });
    }
  };

  /** Demo partners auto-accept connection — ensure link then start sim */
  const handleQuickStartDemo = async (partnerId?: string) => {
    const pid =
      partnerId ||
      startingPartnerId ||
      demoPartners[0]?.id ||
      connections[0]?.partnerId
    if (!pid) {
      toast.error(tx('Chưa có partner demo. Mở Partners hoặc Matches trước.', 'No demo partner yet. Open Partners or Matches first.'))
      return
    }
    setQuickStarting(true)
    const toastId = toast.loading(tx('Đang kết nối demo & mở Sandbox…', 'Linking demo partner & opening sandbox…'))
    try {
      // Any existing link (pending/accepted) — do not create duplicates
      const alreadyLinked = connections.some(
        (c: any) => String(c.partnerId) === String(pid),
      )
      if (!alreadyLinked) {
        try {
          await api.post('/startup/connections', {
            partnerId: pid,
            message: tx(
              'Yêu cầu kết nối demo để chạy phòng giả lập trên Nexora Flow.',
              'Demo connection request to run the sandbox on Nexora Flow.',
            ),
          })
        } catch (connErr: any) {
          const code = connErr?.response?.data?.error?.code || ''
          // Duplicate is fine — continue to sandbox
          if (code !== 'DUPLICATE_CONNECTION') {
            /* still try sandbox */
          }
        }
        await fetchConnections()
      }
      const res = await api.post('/startup/sandbox/create', { partnerId: pid })
      if (res.data?.success) {
        toast.success(tx('Sandbox đã sẵn sàng!', 'Sandbox is ready!'), { id: toastId })
        setActiveSim(normalizeSim(res.data.data))
        setSelectedChoice(null)
        setCustomReasoning('')
      }
    } catch (e: any) {
      toast.error(
        e.response?.data?.message || tx('Không khởi chạy được Sandbox demo.', 'Could not launch the demo sandbox.'),
        { id: toastId },
      )
    } finally {
      setQuickStarting(false)
    }
  }

  const handleStepSimulation = async () => {
    if (!selectedChoice) {
      toast.error(tx('Vui lòng chọn một phương án xử lý.', 'Please choose an option first.'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post('/startup/sandbox/step', {
        choiceId: selectedChoice,
        customReasoning
      });
      if (res.data && res.data.success) {
        toast.success(tx(`Đã nộp quyết định lượt chơi ${activeSim?.currentTurn} thành công!`, `Turn ${activeSim?.currentTurn} decision submitted!`));
        setActiveSim(normalizeSim(res.data.data));
        setSelectedChoice(null);
        setCustomReasoning('');
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || tx('Có lỗi xảy ra khi nộp quyết định.', 'Something went wrong submitting your decision.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteSimulation = async () => {
    setCompleting(true);
    try {
      const res = await api.post('/startup/sandbox/complete');
      if (res.data && res.data.success) {
        toast.success(tx('Thử thách giả lập kết thúc! Báo cáo năng lực founder đã được tạo.', 'Challenge finished! Your founder capability report is ready.'));
        const sim = normalizeSim(res.data.data);
        setActiveSim(sim);
        // Update dashboard journey strip / next-steps
        try {
          const { markSandboxCompleted } = await import('../lib/sandboxProgress');
          const { useAuthStore } = await import('../store/useAuthStore');
          const uid = useAuthStore.getState().user?.id;
          if (uid) markSandboxCompleted(uid, { simId: sim?.id });
        } catch {
          /* ignore */
        }
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || tx('Không thể kết thúc thử thách giả lập.', 'Could not finish the simulation.'));
    } finally {
      setCompleting(false);
    }
  };

  const handleInvestorAction = async () => {
    if (!activeSim) return;
    setSavingInvestorAction(true);
    try {
      const res = await api.post('/startup/sandbox/investor-action', {
        simId: activeSim.id,
        action: investingAction,
        meetingDetails: investingAction === 'scheduled_meeting' ? {
          time: meetingTime,
          platform: 'google_meet',
          link: meetingLink,
          notes: meetingNotes
        } : null
      });
      if (res.data && res.data.success) {
        toast.success(tx('Quyết định thẩm định của nhà đầu tư đã được cập nhật thành công!', 'Investor decision saved!'));
        setActiveSim(normalizeSim(res.data.data));
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || tx('Không thể lưu hành động của nhà đầu tư.', 'Could not save the investor action.'));
    } finally {
      setSavingInvestorAction(false);
    }
  };

  // Prefer live prompt from API; fallback to local scripted turns
  const getTurnDetails = () => {
    if (!activeSim) return null;
    const fromApi = turnFromApiPrompt(activeSim)
    if (fromApi) return fromApi

    const partnerLabel = String(activeSim.partnerName || activeSim.partner?.organizationName || '');
    const isVC = /ventures|capital|fund/i.test(partnerLabel);
    
    if (activeSim.currentTurn === 1) {
      return {
        title: tx('Lượt 1: Phân bổ Ngân sách & Thiết lập Đội ngũ', 'Turn 1: Budget Allocation & Team Setup'),
        description: isVC
          ? tx(
              'Nhà đầu tư đã quyết định giải ngân gói hạt giống trị giá $100,000 vốn mồi. Bạn cần lập kế hoạch phân bổ nguồn lực thông minh để chuẩn bị phát triển và ra mắt sản phẩm đầu tiên.',
              'The investor has disbursed a $100,000 seed package. Plan your resource allocation wisely to build and launch your first product.',
            )
          : tx(
              'Đại diện tập đoàn đối tác đồng ý rót khoản tài trợ thử nghiệm $100,000 để chạy chương trình pilot liên kết hệ thống. Họ yêu cầu bạn thiết lập đội ngũ tích hợp kỹ thuật ngay lập tức.',
              "The corporate partner approved a $100,000 pilot grant for a system-integration program. They want your technical integration team set up immediately.",
            ),
        choices: [
          {
            id: 'A',
            text: isVC
              ? tx('Đầu tư mạnh R&D (60% kỹ thuật, 20% marketing, 20% dự phòng)', 'Invest heavily in R&D (60% engineering, 20% marketing, 20% reserve)')
              : tx('Tuyển 2 kỹ sư phần mềm cao cấp chuyên biệt về tích hợp hệ thống API', 'Hire 2 senior engineers specialized in API system integration'),
            impact: isVC
              ? tx('Tiền mặt -20k, Burn Rate +8k, Đội ngũ +25, Sản phẩm +20', 'Cash -20k, Burn +8k, Team +25, Product +20')
              : tx('Tiền mặt -25k, Burn Rate +10k, Sản phẩm +20, Đội ngũ +20', 'Cash -25k, Burn +10k, Product +20, Team +20'),
          },
          {
            id: 'B',
            text: isVC
              ? tx('Đẩy mạnh Marketing (60% ads thu hút tệp chờ, 20% sản phẩm, 20% dự phòng)', 'Push marketing hard (60% ads for the waitlist, 20% product, 20% reserve)')
              : tx('Founder tự kiêm kỹ thuật, sử dụng các API thương mại sẵn có để tích hợp', 'Founder covers engineering using off-the-shelf commercial APIs'),
            impact: isVC
              ? tx('Tiền mặt -35k, Burn Rate +11k, Tăng trưởng +30%, Sản phẩm -10, Doanh thu +$1500', 'Cash -35k, Burn +11k, Growth +30%, Product -10, Revenue +$1500')
              : tx('Tiền mặt -15k, Burn Rate +5k, Sản phẩm +10, Đội ngũ -15', 'Cash -15k, Burn +5k, Product +10, Team -15'),
          },
          {
            id: 'C',
            text: isVC
              ? tx('Tối giản chi phí (Thuê outsource làm MVP giá rẻ, giữ lại 80% vốn mặt)', 'Cut costs (outsource a cheap MVP, keep 80% of cash)')
              : tx('Thuê một agency tích hợp phần mềm bên ngoài thực hiện trọn gói giá rẻ', 'Hire an external agency for a cheap turnkey integration'),
            impact: isVC
              ? tx('Tiền mặt -10k, Burn Rate +3k, Sản phẩm -25, Danh tiếng -10', 'Cash -10k, Burn +3k, Product -25, Reputation -10')
              : tx('Tiền mặt -10k, Burn Rate +3k, Sản phẩm -20, Danh tiếng -10', 'Cash -10k, Burn +3k, Product -20, Reputation -10'),
          },
        ],
      };
    } else if (activeSim.currentTurn === 2) {
      return {
        title: tx('Lượt 2: Trải nghiệm khách hàng & Phản hồi thực tế', 'Turn 2: Customer Experience & Real Feedback'),
        description: isVC
          ? tx(
              'Khách hàng đầu tiên phản hồi rằng sản phẩm của bạn tuy nhiều tính năng nhưng giao diện quá phức tạp và hay gặp lỗi gián đoạn hệ thống. Tỷ lệ khách hàng rời bỏ có dấu hiệu gia tăng.',
              'Early customers say the product is feature-rich but the UI is too complex and outages keep happening. Churn is starting to climb.',
            )
          : tx(
              'Trong quá trình chạy thử nghiệm, đội ngũ IT của tập đoàn đối tác phàn nàn rằng tài liệu API của startup bạn viết quá sơ sài, hệ thống phản hồi chậm chạp làm tắc nghẽn giao dịch.',
              "During the pilot, the partner's IT team complains your API docs are thin and slow responses are blocking transactions.",
            ),
        choices: [
          {
            id: 'A',
            text: isVC
              ? tx('Tập trung tối ưu R&D: Tạm dừng marketing, dồn lực kỹ sư tối ưu UI/UX', 'Focus on R&D: pause marketing, put engineers on UI/UX fixes')
              : tx('Cử Tech Lead sang làm việc trực tiếp tại văn phòng đối tác tối ưu hệ thống', "Send your Tech Lead onsite to the partner's office to optimize the system"),
            impact: isVC
              ? tx('Tiền mặt -12k, Hài lòng +20, Sản phẩm +15, Tăng trưởng -5%', 'Cash -12k, Satisfaction +20, Product +15, Growth -5%')
              : tx('Tiền mặt -15k, Hài lòng +25, Sản phẩm +20, Đội ngũ -10', 'Cash -15k, Satisfaction +25, Product +20, Team -10'),
          },
          {
            id: 'B',
            text: isVC
              ? tx('Tiếp tục thu hút: Tập trung marketing lấy người dùng mới, lỗi vá sau', 'Keep acquiring: push marketing for new users, patch bugs later')
              : tx('Giải thích do môi trường đối tác chưa tối ưu, khuyên đối tác tự kiểm tra lại', "Blame the partner's environment and ask them to re-check their infra"),
            impact: isVC
              ? tx('Tiền mặt -25k, Doanh thu +$2000, Hài lòng -25, Sản phẩm -15', 'Cash -25k, Revenue +$2000, Satisfaction -25, Product -15')
              : tx('Hài lòng -20, Danh tiếng -15', 'Satisfaction -20, Reputation -15'),
          },
          {
            id: 'C',
            text: isVC
              ? tx('Ưu đãi khách hàng: Tặng mã giảm giá 50% cho bất kỳ khách hàng phản hồi không tốt', 'Appease customers: 50% discount codes for any unhappy customer')
              : tx('Đầu tư nâng cấp Cloud cấu hình cực mạnh để tăng tốc phản hồi máy chủ tức thời', 'Upgrade to high-end cloud infrastructure for instant server response'),
            impact: isVC
              ? tx('Tiền mặt -15k, Hài lòng +15, Doanh thu -$1000', 'Cash -15k, Satisfaction +15, Revenue -$1000')
              : tx('Tiền mặt -20k, Burn Rate +4k, Sản phẩm +10', 'Cash -20k, Burn +4k, Product +10'),
          },
        ],
      };
    } else if (activeSim.currentTurn === 3) {
      return {
        title: tx('Lượt 3: Đối thủ Cạnh tranh & Định vị thương hiệu', 'Turn 3: Competition & Brand Positioning'),
        description: tx(
          'Một đối thủ cạnh tranh lớn trên thị trường vừa công bố giải pháp tương tự sản phẩm của bạn với giá rẻ hơn 30% nhằm tranh giành thị phần.',
          'A major competitor just announced a similar solution priced 30% lower to grab market share.',
        ),
        choices: [
          {
            id: 'A',
            text: tx('Đột phá tính năng độc quyền: Nghiên cứu phát triển một module AI độc bản giải quyết nỗi đau tốt hơn', 'Build an exclusive edge: develop a unique AI module that solves the pain better'),
            impact: tx('Tiền mặt -20k, Sản phẩm +20, Danh tiếng +15', 'Cash -20k, Product +20, Reputation +15'),
          },
          {
            id: 'B',
            text: tx('Khơi mào cuộc chiến giá: Hạ giá bán dịch vụ xuống 40% để cạnh tranh trực tiếp, tăng ads đối đầu', 'Start a price war: cut prices 40% and run head-to-head ads'),
            impact: tx('Tiền mặt -25k, Burn Rate +5k, Doanh thu -$2000, Tăng trưởng +15%', 'Cash -25k, Burn +5k, Revenue -$2000, Growth +15%'),
          },
          {
            id: 'C',
            text: tx('Định vị phân khúc cao cấp: Giữ nguyên giá trị sản phẩm, tập trung truyền thông chất lượng vượt trội', 'Go premium: hold pricing and market superior quality'),
            impact: tx('Danh tiếng +15, Độ hài lòng +15, Tăng trưởng -5%', 'Reputation +15, Satisfaction +15, Growth -5%'),
          },
        ],
      };
    } else if (activeSim.currentTurn === 4) {
      return {
        title: tx('Lượt 4: Quản trị Khủng hoảng tài chính & Dòng tiền', 'Turn 4: Financial Crisis & Cash-flow Management'),
        description: tx(
          'Thị trường tài chính toàn cầu thắt chặt. Chi phí vận hành gia tăng đột biến 20% và nhà đầu tư tiếp theo đang tạm dừng giải ngân vòng gọi vốn mới.',
          'Global markets tighten. Operating costs spike 20% and your next investor pauses the new round.',
        ),
        choices: [
          {
            id: 'A',
            text: tx('Cắt giảm nhân sự để sống sót: Sa thải 30% nhân viên không cốt lõi, chuyển văn phòng nhỏ hơn', 'Cut to survive: lay off 30% non-core staff, move to a smaller office'),
            impact: tx('Tiền mặt +20k, Burn Rate -4k, Sức khỏe đội ngũ -20, Sản phẩm -10, Runway +4 tháng', 'Cash +20k, Burn -4k, Team -20, Product -10, Runway +4 months'),
          },
          {
            id: 'B',
            text: tx('Định giá giảm (Down-round): Chấp nhận đàm phán một vòng gọi vốn bridge khẩn cấp mất 15% cổ phần sáng lập', 'Down-round: take an emergency bridge round costing 15% founder equity'),
            impact: tx('Tiền mặt +50k, Cổ phần founder -15%, Runway +6 tháng', 'Cash +50k, Founder equity -15%, Runway +6 months'),
          },
          {
            id: 'C',
            text: tx('Chơi tất tay: Giữ nguyên chi phí cũ để duy trì động lực phát triển, mong thị trường phục hồi nhanh', 'All-in: keep spending to keep momentum, hope the market recovers fast'),
            impact: tx('Tiền mặt -30k, Runway -2 tháng, Sức khỏe đội ngũ +10', 'Cash -30k, Runway -2 months, Team +10'),
          },
        ],
      };
    }
    return null;
  };

  const turn = getTurnDetails();

  if (loading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3">
        <Spinner className="size-6" />
        <p className="text-sm text-muted-foreground">{tx('Đang tải AI Startup Sandbox…', 'Loading AI Startup Sandbox…')}</p>
      </div>
    );
  }

  const howSteps = [
    { icon: Link2, title: t.sandbox.how1t, desc: t.sandbox.how1d },
    { icon: Layers, title: t.sandbox.how2t, desc: t.sandbox.how2d },
    { icon: BarChart3, title: t.sandbox.how3t, desc: t.sandbox.how3d },
  ];

  return (
    <div className="space-y-5">
      <PortalHero
        eyebrow={
          <>
            <Gamepad2 className="size-3" />
            {t.sandbox.sim}
          </>
        }
        title={t.sandbox.title}
        description={t.sandbox.lead}
        actions={
          activeSim ? (
            <SoftButton
              variant="outline"
              size="sm"
              onClick={() => handleCreateSimulation(activeSim.partnerId)}
            >
              {t.sandbox.restart}
            </SoftButton>
          ) : null
        }
      />

      {!activeSim ? (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: t.sandbox.capital, value: '$100,000', icon: DollarSign },
              { label: t.sandbox.turns, value: '3–4', icon: Target },
              { label: t.sandbox.readyConn, value: String(connections.length), icon: Users },
            ].map((s) => (
              <Card key={s.label} size="sm" className="shadow-none">
                <CardContent className="flex items-center gap-3 pt-4">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <s.icon className="size-4" />
                  </span>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {s.label}
                    </p>
                    <p className="font-heading text-lg font-semibold tabular-nums">{s.value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-3 shadow-none">
              <CardHeader className="border-b pb-4!">
                <CardTitle className="flex items-center gap-2">
                  <PlayCircle className="size-4 text-primary" />
                  {t.sandbox.startTitle}
                </CardTitle>
                <CardDescription>{t.sandbox.startDesc}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                {connections.length > 0 ? (
                  <>
                    <div className="grid gap-2">
                      <Label htmlFor="sandbox-partner">{t.sandbox.partner}</Label>
                      <select
                        id="sandbox-partner"
                        value={startingPartnerId}
                        onChange={(e) => setStartingPartnerId(e.target.value)}
                        className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                      >
                        {connections.map((c: any) => (
                          <option key={c.partnerId} value={c.partnerId}>
                            {c.partnerName || c.partnerId}
                            {c.partnerType ? ` · ${String(c.partnerType).replace(/_/g, ' ')}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Alert>
                      <Sparkles className="size-4" />
                      <AlertTitle>{t.sandbox.demoSafe}</AlertTitle>
                      <AlertDescription>{t.sandbox.demoSafeBody}</AlertDescription>
                    </Alert>
                  </>
                ) : demoPartners.length > 0 ? (
                  <>
                    <div className="grid gap-2">
                      <Label htmlFor="sandbox-demo-partner">{t.sandbox.partner}</Label>
                      <select
                        id="sandbox-demo-partner"
                        value={startingPartnerId || demoPartners[0]?.id || ''}
                        onChange={(e) => setStartingPartnerId(e.target.value)}
                        className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                      >
                        {demoPartners.map((p: any) => (
                          <option key={p.id} value={p.id}>
                            {p.organizationName || p.id}
                            {p.isDemo ? ' (demo)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Alert className="border-primary/20 bg-primary/5">
                      <PlayCircle className="size-4 text-primary" />
                      <AlertTitle>{t.sandbox.noConn}</AlertTitle>
                      <AlertDescription>{t.sandbox.noConnBody}</AlertDescription>
                    </Alert>
                  </>
                ) : (
                  <Alert className="border-amber-500/30 bg-amber-500/10">
                    <AlertTriangle className="size-4 text-amber-600" />
                    <AlertTitle>{t.sandbox.noPartner}</AlertTitle>
                    <AlertDescription>{t.sandbox.noPartnerBody}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
              <CardFooter className="justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  render={<a href="/matches" />}
                  nativeButton={false}
                >
                  {t.sandbox.find}
                </Button>
                {connections.length > 0 ? (
                  <Button
                    size="sm"
                    className="rounded-full"
                    disabled={!startingPartnerId || quickStarting}
                    onClick={() => handleCreateSimulation(startingPartnerId)}
                  >
                    <PlayCircle className="size-3.5" />
                    {t.sandbox.launch}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="rounded-full"
                    disabled={quickStarting || (!demoPartners.length && !startingPartnerId)}
                    onClick={() =>
                      handleQuickStartDemo(startingPartnerId || demoPartners[0]?.id)
                    }
                  >
                    <PlayCircle className="size-3.5" />
                    {quickStarting ? t.sandbox.opening : t.sandbox.playDemo}
                  </Button>
                )}
              </CardFooter>
            </Card>

            <div className="flex flex-col gap-3 lg:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t.sandbox.how}
              </p>
              {howSteps.map((step, i) => (
                <Card key={step.title} size="sm" className="shadow-none">
                  <CardContent className="flex gap-3 pt-4">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted font-heading text-xs font-semibold tabular-nums">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-sm font-medium">
                        <step.icon className="size-3.5 text-primary" />
                        {step.title}
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        {step.desc}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <Card size="sm" className="border-dashed shadow-none">
            <CardContent className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Compass className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-medium">{t.sandbox.path}</p>
                  <p className="text-xs text-muted-foreground">{t.sandbox.pathBody}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="rounded-full" render={<a href="/setup" />} nativeButton={false}>
                  {tx('Hồ sơ', 'Profile')}
                </Button>
                <Button size="sm" variant="outline" className="rounded-full" render={<a href="/connections" />} nativeButton={false}>
                  {tx('Kết nối', 'Connections')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Console & Forms (Left 2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* ACTIVE SIMULATION PLAY AREA */}
            {String(activeSim.status).toLowerCase() === 'active' && turn && (
              <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                <div className="bg-muted/40 px-6 py-4 flex items-center justify-between border-b border-border">
                  <div className="flex items-center space-x-2 text-foreground">
                    <Clock className="h-4.5 w-4.5 text-primary" />
                    <span className="font-semibold text-sm">
                      {tx('Thử thách từ:', 'Challenge from:')}{' '}
                      {activeSim.partnerName ||
                        activeSim.partner?.organizationName ||
                        tx('Đối tác', 'Partner')}
                    </span>
                  </div>
                  <span className="bg-primary text-primary-foreground font-bold text-xs px-2.5 py-1 rounded-full">
                    {tx('Lượt', 'Turn')} {activeSim.currentTurn} / {activeSim.maxSteps || 4}
                  </span>
                </div>

                <div className="p-6 space-y-6">
                  {/* Scenario Body */}
                  <div className="space-y-2.5">
                    <h3 className="text-lg font-bold text-foreground font-heading flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-amber-500 animate-pulse" />
                      <span>{turn.title}</span>
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed bg-background border border-border rounded-xl p-4 font-sans">
                      {turn.description}
                    </p>
                  </div>

                  {/* Choice Selection Option Cards */}
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">{tx('Chọn phương án xử lý của bạn', 'Choose your course of action')}</label>
                    <div className="grid grid-cols-1 gap-3">
                      {turn.choices.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => setSelectedChoice(c.id as any)}
                          className={`w-full text-left p-4 rounded-xl border transition-all duration-300 cursor-pointer flex items-start space-x-3.5 shadow-sm hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99] ${
                            selectedChoice === c.id
                              ? 'border-primary bg-primary/10 ring-1 ring-primary'
                              : 'border-border bg-card hover:bg-background hover:border-border'
                          }`}
                        >
                          <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 border ${
                            selectedChoice === c.id
                              ? 'bg-primary border-primary text-primary-foreground'
                              : 'bg-muted border-border text-muted-foreground'
                          }`}>
                            {c.id}
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-foreground leading-snug">{c.text}</p>
                            <p className="text-[10px] font-bold text-muted-foreground mt-1.5 uppercase tracking-wide">
                              {tx('Tác động dự kiến:', 'Expected impact:')} <span className="text-primary">{c.impact}</span>
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Reasoning Textarea */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">{tx('Lập luận quyết định & Kế hoạch dự phòng', 'Decision reasoning & contingency plan')}</label>
                      <span className="text-[10px] text-muted-foreground">{tx('Không bắt buộc', 'Optional')}</span>
                    </div>
                    <textarea
                      rows={4}
                      value={customReasoning}
                      onChange={(e) => setCustomReasoning(e.target.value)}
                      placeholder={tx('Giải thích lý do lựa chọn phương án này, dữ liệu sử dụng, rủi ro dự kiến và các biện pháp giảm thiểu thiệt hại nếu kế hoạch thất bại...', 'Explain why you chose this option, the data behind it, expected risks, and how you would mitigate them if the plan fails…')}
                      className="w-full bg-card border border-border rounded-lg p-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground shadow-sm"
                    />
                  </div>

                  {/* Action button */}
                  <div className="border-t border-border pt-4 flex justify-end">
                    <button
                      onClick={handleStepSimulation}
                      disabled={!selectedChoice || submitting}
                      className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-lg cursor-pointer disabled:bg-muted disabled:text-muted-foreground transition-colors shadow-sm text-sm"
                    >
                      {submitting ? tx('Đang gửi quyết định...', 'Submitting decision…') : tx('Xác nhận nộp Quyết định', 'Submit decision')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Finished steps (or any state without a playable turn) — generate report */}
            {String(activeSim.status).toLowerCase() === 'active' && !turn && (
              <div className="bg-card border border-border rounded-2xl shadow-sm p-8 text-center space-y-6">
                <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary animate-bounce">
                  <Award className="h-8 w-8" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-foreground font-heading">{tx('Giả lập Vận hành Hoàn tất!', 'Simulation complete!')}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {tx('Bạn đã hoàn thành các lượt thử thách với', 'You have finished every challenge turn with')}{' '}
                    <strong>
                      {activeSim.partnerName ||
                        activeSim.partner?.organizationName ||
                        tx('đối tác', 'the partner')}
                    </strong>
                    {tx('. Tạo báo cáo năng lực founder.', '. Generate the founder capability report.')}
                  </p>
                </div>
                <button
                  onClick={handleCompleteSimulation}
                  disabled={completing}
                  className="px-8 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-lg shadow-md cursor-pointer disabled:bg-muted transition-colors text-sm"
                >
                  {completing ? tx('Đang tạo báo cáo năng lực...', 'Generating report…') : tx('Tạo Simulation Report', 'Create Simulation Report')}
                </button>
              </div>
            )}

            {/* COMPLETED WITHOUT REPORT — offer restart so the page is never blank */}
            {String(activeSim.status).toLowerCase() !== 'active' && !activeSim.report && (
              <div className="bg-card border border-border rounded-2xl shadow-sm p-8 text-center space-y-6">
                <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary">
                  <Gamepad2 className="h-8 w-8" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-foreground font-heading">{tx('Phiên giả lập trước đã kết thúc', 'Previous simulation ended')}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {tx('Phiên chơi với', 'The session with')}{' '}
                    <strong>
                      {activeSim.partnerName ||
                        activeSim.partner?.organizationName ||
                        tx('đối tác', 'the partner')}
                    </strong>{' '}
                    {tx('đã đóng và chưa có báo cáo. Khởi tạo lại để chơi thử thách mới.', 'was closed without a report. Restart to play a new challenge.')}
                  </p>
                </div>
                <button
                  onClick={() => handleCreateSimulation(activeSim.partnerId)}
                  className="px-8 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-lg shadow-md cursor-pointer transition-colors text-sm"
                >
                  {tx('Chơi lại từ đầu', 'Restart from scratch')}
                </button>
              </div>
            )}

            {/* COMPLETED REPORT SCREEN */}
            {String(activeSim.status).toLowerCase() === 'completed' && activeSim.report && (
              <div className="space-y-6 animate-fade-in">
                
                {/* Simulated Meeting Calendar Invitation Card */}
                {activeSim.meetingDetails && (
                  <div className="bg-gradient-to-r from-primary to-primary/80 border border-primary/40 rounded-2xl p-6 text-primary-foreground shadow-md space-y-4">
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-6 w-6 text-primary-foreground/90" />
                      <h4 className="font-bold text-lg font-heading">{tx('Lịch họp trực tiếp đã được chốt với đối tác!', 'A live meeting is locked in with the partner!')}</h4>
                    </div>
                    
                    <div className="bg-card/10 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm font-sans">
                      <div>
                        <p className="text-primary-foreground/90 font-semibold text-xs uppercase tracking-wide">{tx('Thời gian họp', 'Meeting time')}</p>
                        <p className="font-bold text-base mt-0.5">{new Date(activeSim.meetingDetails.time).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US')}</p>
                      </div>
                      <div>
                        <p className="text-primary-foreground/90 font-semibold text-xs uppercase tracking-wide">{tx('Nền tảng cuộc họp', 'Meeting platform')}</p>
                        <p className="font-bold text-base mt-0.5 uppercase flex items-center gap-1.5">
                          <span>{activeSim.meetingDetails.platform.replace('_', ' ')}</span>
                          <a
                            href={activeSim.meetingDetails.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-primary-foreground/80 hover:text-primary-foreground"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </p>
                      </div>
                    </div>
                    {activeSim.meetingDetails.notes && (
                      <p className="text-xs text-primary-foreground/80 leading-relaxed font-sans italic">
                        * {tx('Lời nhắn từ đối tác:', 'Note from the partner:')} &ldquo;{activeSim.meetingDetails.notes}&rdquo;
                      </p>
                    )}
                  </div>
                )}

                {/* Founder Competency Dashboard Report */}
                <div className="bg-card border border-border rounded-2xl shadow-sm p-6 space-y-6">
                  <div className="border-b border-border pb-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-foreground font-heading">{tx('Báo cáo Đánh giá Năng lực Founder', 'Founder Capability Report')}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{tx('Phân tích thẩm định tự động từ Deal-Flow Sandbox', 'Automated due-diligence analysis from the Deal-Flow Sandbox')}</p>
                    </div>
                    
                    <div className="text-right shrink-0">
                      <div className="inline-flex items-center space-x-1 px-4.5 py-2 bg-primary/10 border border-primary/30 text-primary font-bold rounded-xl text-xl font-heading shadow-sm">
                        <span>{activeSim.report.performanceScore} / 100</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wide font-bold">{tx('Điểm tổng kết', 'Overall score')}</p>
                    </div>
                  </div>

                  {/* Competency score bars */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{tx('Phân tích chi tiết 7 nhóm năng lực', 'Breakdown of 7 competency areas')}</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-xs font-sans">
                      {[
                        { label: tx('Quản trị Dòng tiền', 'Cash Management'), value: activeSim.report.competencies?.cashManagement },
                        { label: tx('Phân bổ Nguồn lực', 'Resource Allocation'), value: activeSim.report.competencies?.resourceAllocation },
                        { label: tx('Thấu hiểu Khách hàng', 'Customer Understanding'), value: activeSim.report.competencies?.customerUnderstanding },
                        { label: tx('Phát triển Sản phẩm', 'Product Development'), value: activeSim.report.competencies?.productDevelopment },
                        { label: tx('Quản trị Nhân sự', 'Team Management'), value: activeSim.report.competencies?.teamManagement },
                        { label: tx('Ứng biến Khủng hoảng', 'Crisis Handling'), value: activeSim.report.competencies?.crisisHandling },
                        { label: tx('Khả năng Thích ứng', 'Adaptability'), value: activeSim.report.competencies?.adaptability }
                      ].map((comp, idx) => (
                        <div key={idx} className="space-y-1.5">
                          <div className="flex items-center justify-between text-foreground font-medium">
                            <span>{comp.label}</span>
                            <span className="font-bold text-foreground">{comp.value}%</span>
                          </div>
                          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-[width] duration-700 ease-out"
                              style={{ width: `${comp.value ?? 0}%` }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Core assessment & key decisions */}
                  <div className="bg-background border border-border rounded-xl p-5 space-y-3 text-sm">
                    <h4 className="font-bold text-foreground flex items-center gap-1.5">
                      <Target className="h-4.5 w-4.5 text-primary" />
                      <span>{tx('Đánh giá Tổng quan của Nhà đầu tư', 'Investor Overall Assessment')}</span>
                    </h4>
                    <p className="text-muted-foreground leading-relaxed font-sans font-medium">
                      &ldquo;{activeSim.report.overallAssessment}&rdquo;
                    </p>
                  </div>

                  {/* Audit questions for investor meeting */}
                  <div className="bg-amber-50/20 border border-amber-100 rounded-xl p-5 space-y-3 text-sm">
                    <h4 className="font-bold text-amber-800 flex items-center gap-1.5">
                      <AlertTriangle className="h-4.5 w-4.5 text-amber-600" />
                      <span>{tx('Câu hỏi gợi ý thẩm định sâu trong cuộc gặp', 'Suggested deep-dive questions for the meeting')}</span>
                    </h4>
                    <ul className="list-disc pl-5 space-y-2 text-muted-foreground font-sans text-xs">
                      {(activeSim.report.investorAuditQuestions || []).map((q, idx) => (
                        <li key={idx} className="leading-relaxed">
                          <strong>{q}</strong>
                        </li>
                      ))}
                    </ul>
                  </div>

                </div>

                {/* History of decisions table */}
                <div className="bg-card border border-border rounded-2xl shadow-sm p-6 space-y-4">
                  <h3 className="text-base font-bold text-foreground font-heading">{tx('Lịch sử Quyết định & Lập luận của Founder', 'Decision History & Founder Reasoning')}</h3>
                  
                  <div className="space-y-4">
                    {(activeSim.decisions || []).map((dec) => (
                      <div key={dec.turn} className="border-b border-border pb-4 last:border-0 last:pb-0 text-xs font-sans space-y-1.5">
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span className="font-bold uppercase tracking-wider text-[10px]">{tx('Lượt chơi', 'Turn')} {dec.turn}: {dec.scenarioTitle}</span>
                        </div>
                        <p className="font-bold text-foreground text-sm">{dec.choiceSelected}</p>
                        {dec.customReasoning ? (
                          <div className="bg-background border border-border rounded-lg p-2.5 text-muted-foreground leading-relaxed whitespace-pre-wrap italic">
                            &ldquo;{dec.customReasoning}&rdquo;
                          </div>
                        ) : (
                          <p className="text-muted-foreground italic">{tx('Không cung cấp lời giải trình thêm.', 'No additional reasoning provided.')}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Metrics & Sidebar Controls (Right 1 col) */}
          <div className="space-y-6">
            
            {/* STATUS & METRICS WIDGET */}
            <div className="bg-card text-foreground rounded-2xl p-6 shadow-sm border border-border space-y-6">
              <div>
                <h3 className="text-base font-bold font-heading">{tx('Chỉ số Startup ảo', 'Virtual Startup Metrics')}</h3>
                <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">{tx('Môi trường giả lập tích hợp', 'Integrated simulation environment')}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs font-sans">
                {/* Cash */}
                <div className="bg-muted/50 rounded-xl p-3 border border-border space-y-1">
                  <span className="text-muted-foreground font-medium block">{tx('Vốn tiền mặt', 'Cash on hand')}</span>
                  <div className="flex items-center text-base font-bold text-primary font-heading">
                    <DollarSign className="h-4.5 w-4.5 shrink-0" />
                    <span>{activeSim.metrics.cash.toLocaleString()}</span>
                  </div>
                </div>

                {/* Runway */}
                <div className={`rounded-xl p-3 border space-y-1 ${
                  activeSim.metrics.runway <= 3 
                    ? 'bg-rose-950/20 border-rose-900 text-rose-300' 
                    : 'bg-muted/50 border-border text-foreground'
                }`}>
                  <span className="text-muted-foreground font-medium block">{tx('Dự phòng sống (Runway)', 'Runway')}</span>
                  <div className="flex items-center text-base font-bold font-heading">
                    <span>{activeSim.metrics.runway} {tx('tháng', 'months')}</span>
                  </div>
                </div>

                {/* Revenue */}
                <div className="bg-muted/50 rounded-xl p-3 border border-border space-y-1">
                  <span className="text-muted-foreground font-medium block">{tx('Doanh thu / tháng', 'Revenue / month')}</span>
                  <div className="flex items-center text-base font-bold text-primary font-heading">
                    <DollarSign className="h-4.5 w-4.5 shrink-0" />
                    <span>{activeSim.metrics.revenue.toLocaleString()}</span>
                  </div>
                </div>

                {/* Growth Rate */}
                <div className="bg-muted/50 rounded-xl p-3 border border-border space-y-1">
                  <span className="text-muted-foreground font-medium block">{tx('Tốc độ tăng trưởng', 'Growth rate')}</span>
                  <div className="flex items-center text-base font-bold text-foreground font-heading">
                    <TrendingUp className="h-4.5 w-4.5 shrink-0 text-primary mr-1" />
                    <span>{activeSim.metrics.growthRate ?? activeSim.metrics.growth ?? 0}%</span>
                  </div>
                </div>
              </div>

              {/* Slider gauges for non-financial metrics */}
              <div className="space-y-3.5 pt-2 text-xs font-sans">
                {/* Product Quality */}
                <div className="space-y-1">
                  <div className="flex justify-between text-muted-foreground">
                    <span className="flex items-center gap-1"><Cpu className="h-3.5 w-3.5 text-primary" /> {tx('Chất lượng sản phẩm', 'Product quality')}</span>
                    <span className="font-bold text-foreground">{activeSim.metrics.productQuality}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-[width] duration-700 ease-out" style={{ width: `${activeSim.metrics.productQuality}%` }}></div>
                  </div>
                </div>

                {/* Customer Satisfaction */}
                <div className="space-y-1">
                  <div className="flex justify-between text-muted-foreground">
                    <span className="flex items-center gap-1"><Target className="h-3.5 w-3.5 text-primary" /> {tx('Hài lòng khách hàng', 'Customer satisfaction')}</span>
                    <span className="font-bold text-foreground">{activeSim.metrics.customerSat}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-[width] duration-700 ease-out" style={{ width: `${activeSim.metrics.customerSat}%` }}></div>
                  </div>
                </div>

                {/* Team Health */}
                <div className="space-y-1">
                  <div className="flex justify-between text-muted-foreground">
                    <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5 text-primary" /> {tx('Đội ngũ nhân sự', 'Team health')}</span>
                    <span className="font-bold text-foreground">{activeSim.metrics.teamHealth}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-[width] duration-700 ease-out" style={{ width: `${activeSim.metrics.teamHealth}%` }}></div>
                  </div>
                </div>

                {/* Brand Reputation */}
                <div className="space-y-1">
                  <div className="flex justify-between text-muted-foreground">
                    <span className="flex items-center gap-1"><Shield className="h-3.5 w-3.5 text-primary" /> {tx('Danh tiếng thương hiệu', 'Brand reputation')}</span>
                    <span className="font-bold text-foreground">{activeSim.metrics.brandRep}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-[width] duration-700 ease-out" style={{ width: `${activeSim.metrics.brandRep}%` }}></div>
                  </div>
                </div>

                {/* Equity */}
                <div className="space-y-1">
                  <div className="flex justify-between text-muted-foreground">
                    <span className="flex items-center gap-1"><Briefcase className="h-3.5 w-3.5 text-primary" /> {tx('Cổ phần của Founder', 'Founder equity')}</span>
                    <span className="font-bold text-foreground">{activeSim.metrics.equity}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-[width] duration-700 ease-out" style={{ width: `${activeSim.metrics.equity}%` }}></div>
                  </div>
                </div>
              </div>

              {String(activeSim.status).toLowerCase() === 'active' &&
                Number(activeSim.metrics?.runway || 0) <= 3 && (
                <div className="bg-rose-950/30 border border-rose-900 rounded-xl p-3 flex items-start space-x-2 text-rose-300 text-[11px] font-sans">
                  <AlertTriangle className="h-4.5 w-4.5 text-rose-500 shrink-0 mt-0.5" />
                  <p className="leading-normal">
                    <strong>{tx('Cảnh báo Dòng tiền:', 'Cash-flow warning:')}</strong> {tx('Thời gian sống của startup dưới 3 tháng! Hãy nhanh chóng hoàn thành lượt chơi hoặc gọi thêm vốn để tránh phá sản.', 'Runway is under 3 months! Finish the turn or raise capital fast to avoid going under.')}
                  </p>
                </div>
              )}
            </div>

            {/* MOCK INVESTOR DECISION CONTROL WIDGET (ONLY ON COMPLETED REPORT) */}
            {String(activeSim.status).toLowerCase() === 'completed' && activeSim.report && (
              <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6">
                <div>
                  <h3 className="text-base font-bold text-foreground font-heading">{tx('Bảng Thẩm định Nhà đầu tư', 'Investor Review Panel')}</h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">{tx('Giả lập đổi vai phản hồi từ nhà đầu tư', 'Role-play the investor response')}</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-muted-foreground">{tx('Quyết định của Nhà đầu tư', 'Investor decision')}</label>
                    <select
                      value={investingAction}
                      onChange={(e) => setInvestingAction(e.target.value as any)}
                      className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-foreground font-medium shadow-sm"
                    >
                      <option value="shortlist">{tx('Đánh dấu là hồ sơ tiềm năng (Shortlist)', 'Shortlist as a promising profile')}</option>
                      <option value="another_challenge">{tx('Yêu cầu thực hiện thêm thử thách', 'Request another challenge')}</option>
                      <option value="scheduled_meeting">{tx('Đặt lịch họp trực tiếp (Zoom/Meet)', 'Schedule a live meeting (Zoom/Meet)')}</option>
                    </select>
                  </div>

                  {investingAction === 'scheduled_meeting' && (
                    <div className="space-y-3 animate-fade-in text-xs font-sans">
                      <div className="space-y-1">
                        <label className="block text-muted-foreground font-semibold">{tx('Thời gian cuộc họp *', 'Meeting time *')}</label>
                        <input
                          type="datetime-local"
                          value={meetingTime}
                          onChange={(e) => setMeetingTime(e.target.value)}
                          className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-muted-foreground font-semibold">{tx('Đường dẫn cuộc họp (Zoom/Google Meet) *', 'Meeting link (Zoom/Google Meet) *')}</label>
                        <input
                          type="url"
                          value={meetingLink}
                          onChange={(e) => setMeetingLink(e.target.value)}
                          className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                          placeholder="https://meet.google.com/..."
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-muted-foreground font-semibold">{tx('Lời nhắn ghi chú cuộc họp', 'Meeting notes')}</label>
                        <textarea
                          rows={3}
                          value={meetingNotes}
                          onChange={(e) => setMeetingNotes(e.target.value)}
                          className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                          placeholder={tx('Ghi chú lịch hẹn gửi tới founder...', 'Notes sent to the founder…')}
                        />
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleInvestorAction}
                    disabled={savingInvestorAction}
                    className="w-full py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-lg cursor-pointer transition-colors shadow-sm text-xs"
                  >
                    {savingInvestorAction ? tx('Đang lưu quyết định...', 'Saving decision…') : tx('Gửi Quyết định & Thông báo', 'Send decision & notify')}
                  </button>
                </div>
              </div>
            )}
          </div>
          
        </div>
      )}
    </div>
  );
}
