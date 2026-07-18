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
  Target
} from 'lucide-react';

export default function Sandbox() {
  const [activeSim, setActiveSim] = useState<SandboxSimulation | null>(null);
  const [loading, setLoading] = useState(true);
  const [connections, setConnections] = useState<ConnectionRequestDTO[]>([]);
  const [startingPartnerId, setStartingPartnerId] = useState('');
  
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
        setActiveSim(res.data.data);
      }
    } catch (e) {
      console.error('Không thể lấy thông tin sandbox đang hoạt động', e);
    }
  };

  const fetchConnections = async () => {
    try {
      const res = await api.get('/startup/connections');
      if (res.data && res.data.success) {
        const accepted = res.data.data.filter((c: any) => c.status === 'ACCEPTED');
        setConnections(accepted);
        if (accepted.length > 0) {
          setStartingPartnerId(accepted[0].partnerId);
        }
      }
    } catch (e) {
      console.error('Không thể tải danh sách kết nối', e);
    }
  };

  const loadData = async () => {
    setLoading(true);
    await Promise.all([fetchActiveSim(), fetchConnections()]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateSimulation = async (pId: string) => {
    if (!pId) {
      toast.error('Vui lòng chọn đối tác kết nối để khởi tạo.');
      return;
    }
    const toastId = toast.loading('Đang khởi tạo môi trường giả lập Sandbox...');
    try {
      const res = await api.post('/startup/sandbox/create', { partnerId: pId });
      if (res.data && res.data.success) {
        toast.success('Môi trường giả lập Sandbox đã được khởi tạo thành công!', { id: toastId });
        setActiveSim(res.data.data);
        setSelectedChoice(null);
        setCustomReasoning('');
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Không thể khởi tạo giả lập Sandbox.', { id: toastId });
    }
  };

  const handleStepSimulation = async () => {
    if (!selectedChoice) {
      toast.error('Vui lòng chọn một phương án xử lý.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post('/startup/sandbox/step', {
        choiceId: selectedChoice,
        customReasoning
      });
      if (res.data && res.data.success) {
        toast.success(`Đã nộp quyết định lượt chơi ${activeSim?.currentTurn} thành công!`);
        setActiveSim(res.data.data);
        setSelectedChoice(null);
        setCustomReasoning('');
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Có lỗi xảy ra khi nộp quyết định.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteSimulation = async () => {
    setCompleting(true);
    try {
      const res = await api.post('/startup/sandbox/complete');
      if (res.data && res.data.success) {
        toast.success('Thử thách giả lập kết thúc! Báo cáo năng lực founder đã được tạo.');
        setActiveSim(res.data.data);
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Không thể kết thúc thử thách giả lập.');
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
        toast.success('Quyết định thẩm định của nhà đầu tư đã được cập nhật thành công!');
        setActiveSim(res.data.data);
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Không thể lưu hành động của nhà đầu tư.');
    } finally {
      setSavingInvestorAction(false);
    }
  };

  // Turn details matching logic
  const getTurnDetails = () => {
    if (!activeSim) return null;
    const isVC = activeSim.partnerName.toLowerCase().includes('ventures') || activeSim.partnerName.toLowerCase().includes('capital') || activeSim.partnerName.toLowerCase().includes('fund');
    
    if (activeSim.currentTurn === 1) {
      return {
        title: "Lượt 1: Phân bổ Ngân sách & Thiết lập Đội ngũ",
        description: isVC 
          ? "Nhà đầu tư đã quyết định giải ngân gói hạt giống trị giá $100,000 vốn mồi. Bạn cần lập kế hoạch phân bổ nguồn lực thông minh để chuẩn bị phát triển và ra mắt sản phẩm đầu tiên."
          : "Đại diện tập đoàn đối tác đồng ý rót khoản tài trợ thử nghiệm $100,000 để chạy chương trình pilot liên kết hệ thống. Họ yêu cầu bạn thiết lập đội ngũ tích hợp kỹ thuật ngay lập tức.",
        choices: [
          {
            id: 'A',
            text: isVC ? "Đầu tư mạnh R&D (60% kỹ thuật, 20% marketing, 20% dự phòng)" : "Tuyển 2 kỹ sư phần mềm cao cấp chuyên biệt về tích hợp hệ thống API",
            impact: isVC ? "Tiền mặt -20k, Burn Rate +8k, Đội ngũ +25, Sản phẩm +20" : "Tiền mặt -25k, Burn Rate +10k, Sản phẩm +20, Đội ngũ +20"
          },
          {
            id: 'B',
            text: isVC ? "Đẩy mạnh Marketing (60% ads thu hút tệp chờ, 20% sản phẩm, 20% dự phòng)" : "Founder tự kiêm kỹ thuật, sử dụng các API thương mại sẵn có để tích hợp",
            impact: isVC ? "Tiền mặt -35k, Burn Rate +11k, Tăng trưởng +30%, Sản phẩm -10, Doanh thu +$1500" : "Tiền mặt -15k, Burn Rate +5k, Sản phẩm +10, Đội ngũ -15"
          },
          {
            id: 'C',
            text: isVC ? "Tối giản chi phí (Thuê outsource làm MVP giá rẻ, giữ lại 80% vốn mặt)" : "Thuê một agency tích hợp phần mềm bên ngoài thực hiện trọn gói giá rẻ",
            impact: isVC ? "Tiền mặt -10k, Burn Rate +3k, Sản phẩm -25, Danh tiếng -10" : "Tiền mặt -10k, Burn Rate +3k, Sản phẩm -20, Danh tiếng -10"
          }
        ]
      };
    } else if (activeSim.currentTurn === 2) {
      return {
        title: "Lượt 2: Trải nghiệm khách hàng & Phản hồi thực tế",
        description: isVC
          ? "Khách hàng đầu tiên phản hồi rằng sản phẩm của bạn tuy nhiều tính năng nhưng giao diện quá phức tạp và hay gặp lỗi gián đoạn hệ thống. Tỷ lệ khách hàng rời bỏ có dấu hiệu gia tăng."
          : "Trong quá trình chạy thử nghiệm, đội ngũ IT của tập đoàn đối tác phàn nàn rằng tài liệu API của startup bạn viết quá sơ sài, hệ thống phản hồi chậm chạp làm tắc nghẽn giao dịch.",
        choices: [
          {
            id: 'A',
            text: isVC ? "Tập trung tối ưu R&D: Tạm dừng marketing, dồn lực kỹ sư tối ưu UI/UX" : "Cử Tech Lead sang làm việc trực tiếp tại văn phòng đối tác tối ưu hệ thống",
            impact: isVC ? "Tiền mặt -12k, Hài lòng +20, Sản phẩm +15, Tăng trưởng -5%" : "Tiền mặt -15k, Hài lòng +25, Sản phẩm +20, Đội ngũ -10"
          },
          {
            id: 'B',
            text: isVC ? "Tiếp tục thu hút: Tập trung marketing lấy người dùng mới, lỗi vá sau" : "Giải thích do môi trường đối tác chưa tối ưu, khuyên đối tác tự kiểm tra lại",
            impact: isVC ? "Tiền mặt -25k, Doanh thu +$2000, Hài lòng -25, Sản phẩm -15" : "Hài lòng -20, Danh tiếng -15"
          },
          {
            id: 'C',
            text: isVC ? "Ưu đãi khách hàng: Tặng mã giảm giá 50% cho bất kỳ khách hàng phản hồi không tốt" : "Đầu tư nâng cấp Cloud cấu hình cực mạnh để tăng tốc phản hồi máy chủ tức thời",
            impact: isVC ? "Tiền mặt -15k, Hài lòng +15, Doanh thu -$1000" : "Tiền mặt -20k, Burn Rate +4k, Sản phẩm +10"
          }
        ]
      };
    } else if (activeSim.currentTurn === 3) {
      return {
        title: "Lượt 3: Đối thủ Cạnh tranh & Định vị thương hiệu",
        description: "Một đối thủ cạnh tranh lớn trên thị trường vừa công bố giải pháp tương tự sản phẩm của bạn với giá rẻ hơn 30% nhằm tranh giành thị phần.",
        choices: [
          {
            id: 'A',
            text: "Đột phá tính năng độc quyền: Nghiên cứu phát triển một module AI độc bản giải quyết nỗi đau tốt hơn",
            impact: "Tiền mặt -20k, Sản phẩm +20, Danh tiếng +15"
          },
          {
            id: 'B',
            text: "Khơi mào cuộc chiến giá: Hạ giá bán dịch vụ xuống 40% để cạnh tranh trực tiếp, tăng ads đối đầu",
            impact: "Tiền mặt -25k, Burn Rate +5k, Doanh thu -$2000, Tăng trưởng +15%"
          },
          {
            id: 'C',
            text: "Định vị phân khúc cao cấp: Giữ nguyên giá trị sản phẩm, tập trung truyền thông chất lượng vượt trội",
            impact: "Danh tiếng +15, Độ hài lòng +15, Tăng trưởng -5%"
          }
        ]
      };
    } else if (activeSim.currentTurn === 4) {
      return {
        title: "Lượt 4: Quản trị Khủng hoảng tài chính & Dòng tiền",
        description: "Thị trường tài chính toàn cầu thắt chặt. Chi phí vận hành gia tăng đột biến 20% và nhà đầu tư tiếp theo đang tạm dừng giải ngân vòng gọi vốn mới.",
        choices: [
          {
            id: 'A',
            text: "Cắt giảm nhân sự để sống sót: Sa thải 30% nhân viên không cốt lõi, chuyển văn phòng nhỏ hơn",
            impact: "Tiền mặt +20k, Burn Rate -4k, Sức khỏe đội ngũ -20, Sản phẩm -10, Runway +4 tháng"
          },
          {
            id: 'B',
            text: "Định giá giảm (Down-round): Chấp nhận đàm phán một vòng gọi vốn bridge khẩn cấp mất 15% cổ phần sáng lập",
            impact: "Tiền mặt +50k, Cổ phần founder -15%, Runway +6 tháng"
          },
          {
            id: 'C',
            text: "Chơi tất tay: Giữ nguyên chi phí cũ để duy trì động lực phát triển, mong thị trường phục hồi nhanh",
            impact: "Tiền mặt -30k, Runway -2 tháng, Sức khỏe đội ngũ +10"
          }
        ]
      };
    }
    return null;
  };

  const turn = getTurnDetails();

  if (loading) {
    return (
      <div className="h-[70vh] flex flex-col items-center justify-center space-y-4">
        <div className="h-10 w-10 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin"></div>
        <p className="text-sm font-semibold text-slate-500 animate-pulse">Đang tải môi trường AI Startup Sandbox...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-4 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 font-display flex items-center space-x-2">
            <Gamepad2 className="h-6 w-6 text-emerald-600" />
            <span>AI Startup Sandbox</span>
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Giả lập gọi vốn và vận hành startup ảo để chứng minh năng lực quản lý của founder tới nhà đầu tư
          </p>
        </div>

        {activeSim && (
          <button
            onClick={() => handleCreateSimulation(activeSim.partnerId)}
            className="px-4 py-2 text-sm font-semibold border border-slate-200 bg-white hover:bg-slate-50 rounded-lg text-slate-700 cursor-pointer shadow-sm"
          >
            Chơi lại từ đầu
          </button>
        )}
      </div>

      {/* No Active Simulation Screen */}
      {!activeSim ? (
        <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-2xl p-8 shadow-sm text-center space-y-6 my-8">
          <div className="h-16 w-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-600">
            <PlayCircle className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-slate-900 font-display">Bắt đầu thử thách Sandbox mới</h3>
            <p className="text-sm text-slate-500 leading-relaxed">
              Vui lòng chọn một nhà đầu tư hoặc doanh nghiệp đã đồng ý kết nối để bắt đầu thử thách mô phỏng vận hành startup với số vốn ảo ban đầu là **$100,000**.
            </p>
          </div>

          {connections.length > 0 ? (
            <div className="space-y-4">
              <div className="text-left">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Đối tác thử thách</label>
                <select
                  value={startingPartnerId}
                  onChange={(e) => setStartingPartnerId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-700 font-medium shadow-sm"
                >
                  {connections.map((c) => (
                    <option key={c.partnerId} value={c.partnerId}>
                      {c.partnerName} ({c.partnerType === 'investment_fund' ? 'Quỹ Đầu tư' : 'Doanh nghiệp'})
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => handleCreateSimulation(startingPartnerId)}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-md cursor-pointer transition-colors text-sm"
              >
                Khởi chạy Giả lập vận hành
              </button>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-500">
              <AlertTriangle className="h-5 w-5 text-amber-500 mx-auto mb-2" />
              Bạn chưa có bất kỳ đối tác nào đồng ý kết nối (Status: ACCEPTED). Vui lòng gửi yêu cầu và đợi đối tác chấp nhận trước khi bắt đầu thử thách Sandbox.
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Console & Forms (Left 2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* ACTIVE SIMULATION PLAY AREA */}
            {activeSim.status === 'active' && turn && (
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="bg-slate-900 px-6 py-4 flex items-center justify-between border-b border-slate-800">
                  <div className="flex items-center space-x-2 text-white">
                    <Clock className="h-4.5 w-4.5 text-emerald-400" />
                    <span className="font-semibold text-sm">Thử thách từ: {activeSim.partnerName}</span>
                  </div>
                  <span className="bg-emerald-600 text-white font-bold text-xs px-2.5 py-1 rounded-full">
                    Lượt chơi {activeSim.currentTurn} / 4
                  </span>
                </div>

                <div className="p-6 space-y-6">
                  {/* Scenario Body */}
                  <div className="space-y-2.5">
                    <h3 className="text-lg font-bold text-slate-900 font-display flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-amber-500 animate-pulse" />
                      <span>{turn.title}</span>
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 border border-slate-100 rounded-xl p-4 font-sans">
                      {turn.description}
                    </p>
                  </div>

                  {/* Choice Selection Option Cards */}
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Chọn phương án xử lý của bạn</label>
                    <div className="grid grid-cols-1 gap-3">
                      {turn.choices.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => setSelectedChoice(c.id as any)}
                          className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer flex items-start space-x-3.5 shadow-sm ${
                            selectedChoice === c.id
                              ? 'border-emerald-500 bg-emerald-50/20 ring-1 ring-emerald-500'
                              : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300'
                          }`}
                        >
                          <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 border ${
                            selectedChoice === c.id
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'bg-slate-100 border-slate-300 text-slate-600'
                          }`}>
                            {c.id}
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-slate-900 leading-snug">{c.text}</p>
                            <p className="text-[10px] font-bold text-slate-400 mt-1.5 uppercase tracking-wide">
                              Tác động dự kiến: <span className="text-emerald-600">{c.impact}</span>
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Reasoning Textarea */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Lập luận quyết định & Kế hoạch dự phòng</label>
                      <span className="text-[10px] text-slate-400">Không bắt buộc</span>
                    </div>
                    <textarea
                      rows={4}
                      value={customReasoning}
                      onChange={(e) => setCustomReasoning(e.target.value)}
                      placeholder="Giải thích lý do lựa chọn phương án này, dữ liệu sử dụng, rủi ro dự kiến và các biện pháp giảm thiểu thiệt hại nếu kế hoạch thất bại..."
                      className="w-full bg-white border border-slate-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder-slate-400 shadow-sm"
                    />
                  </div>

                  {/* Action button */}
                  <div className="border-t border-slate-100 pt-4 flex justify-end">
                    <button
                      onClick={handleStepSimulation}
                      disabled={!selectedChoice || submitting}
                      className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg cursor-pointer disabled:bg-slate-200 disabled:text-slate-400 transition-colors shadow-sm text-sm"
                    >
                      {submitting ? 'Đang gửi quyết định...' : 'Xác nhận nộp Quyết định'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* SIMULATION FINISHED & WAITING FOR REPORT GENERATION */}
            {activeSim.status === 'active' && activeSim.currentTurn > 4 && (
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 text-center space-y-6">
                <div className="h-16 w-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-600 animate-bounce">
                  <Award className="h-8 w-8" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-slate-900 font-display">Giả lập Vận hành Hoàn tất!</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Bạn đã xuất sắc vượt qua cả 4 lượt chơi thử thách quan trọng từ nhà đầu tư **{activeSim.partnerName}**.
                    Hãy bấm nút bên dưới để phân tích chuỗi quyết định và tạo Báo cáo Năng lực Founder chính thức.
                  </p>
                </div>
                <button
                  onClick={handleCompleteSimulation}
                  disabled={completing}
                  className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-md cursor-pointer disabled:bg-slate-200 transition-colors text-sm"
                >
                  {completing ? 'Đang tạo báo cáo năng lực...' : 'Tạo Simulation Report'}
                </button>
              </div>
            )}

            {/* COMPLETED REPORT SCREEN */}
            {activeSim.status === 'completed' && activeSim.report && (
              <div className="space-y-6 animate-fade-in">
                
                {/* Simulated Meeting Calendar Invitation Card */}
                {activeSim.meetingDetails && (
                  <div className="bg-gradient-to-r from-emerald-500 to-teal-600 border border-emerald-400 rounded-2xl p-6 text-white shadow-md space-y-4">
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-6 w-6 text-emerald-100" />
                      <h4 className="font-bold text-lg font-display">Lịch họp trực tiếp đã được chốt với đối tác!</h4>
                    </div>
                    
                    <div className="bg-white/10 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm font-sans">
                      <div>
                        <p className="text-emerald-100 font-semibold text-xs uppercase tracking-wide">Thời gian họp</p>
                        <p className="font-bold text-base mt-0.5">{new Date(activeSim.meetingDetails.time).toLocaleString('vi-VN')}</p>
                      </div>
                      <div>
                        <p className="text-emerald-100 font-semibold text-xs uppercase tracking-wide">Nền tảng cuộc họp</p>
                        <p className="font-bold text-base mt-0.5 uppercase flex items-center gap-1.5">
                          <span>{activeSim.meetingDetails.platform.replace('_', ' ')}</span>
                          <a
                            href={activeSim.meetingDetails.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-emerald-200 hover:text-white"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </p>
                      </div>
                    </div>
                    {activeSim.meetingDetails.notes && (
                      <p className="text-xs text-emerald-50 leading-relaxed font-sans italic">
                        * Lời nhắn từ đối tác: &ldquo;{activeSim.meetingDetails.notes}&rdquo;
                      </p>
                    )}
                  </div>
                )}

                {/* Founder Competency Dashboard Report */}
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-6">
                  <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 font-display">Báo cáo Đánh giá Năng lực Founder</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Phân tích thẩm định tự động từ Deal-Flow Sandbox</p>
                    </div>
                    
                    <div className="text-right shrink-0">
                      <div className="inline-flex items-center space-x-1 px-4.5 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold rounded-xl text-xl font-display shadow-sm">
                        <span>{activeSim.report.performanceScore} / 100</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wide font-bold">Điểm tổng kết</p>
                    </div>
                  </div>

                  {/* Competency score bars */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Phân tích chi tiết 7 nhóm năng lực</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-xs font-sans">
                      {[
                        { label: 'Quản trị Dòng tiền (Cash Management)', value: activeSim.report.competencies.cashManagement },
                        { label: 'Phân bổ Nguồn lực (Resource Allocation)', value: activeSim.report.competencies.resourceAllocation },
                        { label: 'Thấu hiểu Khách hàng (Customer Understanding)', value: activeSim.report.competencies.customerUnderstanding },
                        { label: 'Phát triển Sản phẩm (Product Development)', value: activeSim.report.competencies.productDevelopment },
                        { label: 'Quản trị Nhân sự (Team Management)', value: activeSim.report.competencies.teamManagement },
                        { label: 'Ứng biến Khủng hoảng (Crisis Handling)', value: activeSim.report.competencies.crisisHandling },
                        { label: 'Khả năng Thích ứng (Adaptability)', value: activeSim.report.competencies.adaptability }
                      ].map((comp, idx) => (
                        <div key={idx} className="space-y-1.5">
                          <div className="flex items-center justify-between text-slate-700 font-medium">
                            <span>{comp.label}</span>
                            <span className="font-bold text-slate-900">{comp.value}%</span>
                          </div>
                          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${comp.value}%` }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Core assessment & key decisions */}
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-5 space-y-3 text-sm">
                    <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                      <Target className="h-4.5 w-4.5 text-emerald-600" />
                      <span>Đánh giá Tổng quan của Nhà đầu tư</span>
                    </h4>
                    <p className="text-slate-600 leading-relaxed font-sans font-medium">
                      &ldquo;{activeSim.report.overallAssessment}&rdquo;
                    </p>
                  </div>

                  {/* Audit questions for investor meeting */}
                  <div className="bg-amber-50/20 border border-amber-100 rounded-xl p-5 space-y-3 text-sm">
                    <h4 className="font-bold text-amber-800 flex items-center gap-1.5">
                      <AlertTriangle className="h-4.5 w-4.5 text-amber-600" />
                      <span>Câu hỏi gợi ý thẩm định sâu trong cuộc gặp</span>
                    </h4>
                    <ul className="list-disc pl-5 space-y-2 text-slate-600 font-sans text-xs">
                      {activeSim.report.investorAuditQuestions.map((q, idx) => (
                        <li key={idx} className="leading-relaxed">
                          <strong>{q}</strong>
                        </li>
                      ))}
                    </ul>
                  </div>

                </div>

                {/* History of decisions table */}
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
                  <h3 className="text-base font-bold text-slate-900 font-display">Lịch sử Quyết định & Lập luận của Founder</h3>
                  
                  <div className="space-y-4">
                    {activeSim.decisions.map((dec) => (
                      <div key={dec.turn} className="border-b border-slate-100 pb-4 last:border-0 last:pb-0 text-xs font-sans space-y-1.5">
                        <div className="flex items-center justify-between text-slate-400">
                          <span className="font-bold uppercase tracking-wider text-[10px]">Lượt chơi {dec.turn}: {dec.scenarioTitle}</span>
                        </div>
                        <p className="font-bold text-slate-800 text-sm">{dec.choiceSelected}</p>
                        {dec.customReasoning ? (
                          <div className="bg-slate-50 border border-slate-100 rounded-lg p-2.5 text-slate-600 leading-relaxed whitespace-pre-wrap italic">
                            &ldquo;{dec.customReasoning}&rdquo;
                          </div>
                        ) : (
                          <p className="text-slate-400 italic">Không cung cấp lời giải trình thêm.</p>
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
            <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-sm border border-slate-800 space-y-6">
              <div>
                <h3 className="text-base font-bold font-display">Chỉ số Startup ảo</h3>
                <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wide">Môi trường giả lập tích hợp</p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs font-sans">
                {/* Cash */}
                <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-800 space-y-1">
                  <span className="text-slate-500 font-medium block">Vốn tiền mặt</span>
                  <div className="flex items-center text-base font-bold text-emerald-400 font-display">
                    <DollarSign className="h-4.5 w-4.5 shrink-0" />
                    <span>{activeSim.metrics.cash.toLocaleString()}</span>
                  </div>
                </div>

                {/* Runway */}
                <div className={`rounded-xl p-3 border space-y-1 ${
                  activeSim.metrics.runway <= 3 
                    ? 'bg-rose-950/20 border-rose-900 text-rose-300' 
                    : 'bg-slate-800/50 border-slate-800 text-slate-200'
                }`}>
                  <span className="text-slate-500 font-medium block">Dự phòng sống (Runway)</span>
                  <div className="flex items-center text-base font-bold font-display">
                    <span>{activeSim.metrics.runway} tháng</span>
                  </div>
                </div>

                {/* Revenue */}
                <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-800 space-y-1">
                  <span className="text-slate-500 font-medium block">Doanh thu / tháng</span>
                  <div className="flex items-center text-base font-bold text-emerald-400 font-display">
                    <DollarSign className="h-4.5 w-4.5 shrink-0" />
                    <span>{activeSim.metrics.revenue.toLocaleString()}</span>
                  </div>
                </div>

                {/* Growth Rate */}
                <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-800 space-y-1">
                  <span className="text-slate-500 font-medium block">Tốc độ tăng trưởng</span>
                  <div className="flex items-center text-base font-bold text-slate-200 font-display">
                    <TrendingUp className="h-4.5 w-4.5 shrink-0 text-emerald-500 mr-1" />
                    <span>{activeSim.metrics.growthRate}%</span>
                  </div>
                </div>
              </div>

              {/* Slider gauges for non-financial metrics */}
              <div className="space-y-3.5 pt-2 text-xs font-sans">
                {/* Product Quality */}
                <div className="space-y-1">
                  <div className="flex justify-between text-slate-400">
                    <span className="flex items-center gap-1"><Cpu className="h-3.5 w-3.5 text-emerald-500" /> Chất lượng sản phẩm</span>
                    <span className="font-bold text-slate-200">{activeSim.metrics.productQuality}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${activeSim.metrics.productQuality}%` }}></div>
                  </div>
                </div>

                {/* Customer Satisfaction */}
                <div className="space-y-1">
                  <div className="flex justify-between text-slate-400">
                    <span className="flex items-center gap-1"><Target className="h-3.5 w-3.5 text-emerald-500" /> Hài lòng khách hàng</span>
                    <span className="font-bold text-slate-200">{activeSim.metrics.customerSat}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${activeSim.metrics.customerSat}%` }}></div>
                  </div>
                </div>

                {/* Team Health */}
                <div className="space-y-1">
                  <div className="flex justify-between text-slate-400">
                    <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5 text-emerald-500" /> Đội ngũ nhân sự</span>
                    <span className="font-bold text-slate-200">{activeSim.metrics.teamHealth}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${activeSim.metrics.teamHealth}%` }}></div>
                  </div>
                </div>

                {/* Brand Reputation */}
                <div className="space-y-1">
                  <div className="flex justify-between text-slate-400">
                    <span className="flex items-center gap-1"><Shield className="h-3.5 w-3.5 text-emerald-500" /> Danh tiếng thương hiệu</span>
                    <span className="font-bold text-slate-200">{activeSim.metrics.brandRep}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${activeSim.metrics.brandRep}%` }}></div>
                  </div>
                </div>

                {/* Equity */}
                <div className="space-y-1">
                  <div className="flex justify-between text-slate-400">
                    <span className="flex items-center gap-1"><Briefcase className="h-3.5 w-3.5 text-emerald-500" /> Cổ phần của Founder</span>
                    <span className="font-bold text-slate-200">{activeSim.metrics.equity}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${activeSim.metrics.equity}%` }}></div>
                  </div>
                </div>
              </div>

              {activeSim.status === 'active' && activeSim.metrics.runway <= 3 && (
                <div className="bg-rose-950/30 border border-rose-900 rounded-xl p-3 flex items-start space-x-2 text-rose-300 text-[11px] font-sans">
                  <AlertTriangle className="h-4.5 w-4.5 text-rose-500 shrink-0 mt-0.5" />
                  <p className="leading-normal">
                    <strong>Cảnh báo Dòng tiền:</strong> Thời gian sống của startup dưới 3 tháng! Hãy nhanh chóng hoàn thành lượt chơi hoặc gọi thêm vốn để tránh phá sản.
                  </p>
                </div>
              )}
            </div>

            {/* MOCK INVESTOR DECISION CONTROL WIDGET (ONLY ON COMPLETED REPORT) */}
            {activeSim.status === 'completed' && activeSim.report && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
                <div>
                  <h3 className="text-base font-bold text-slate-900 font-display">Bảng Thẩm định Nhà đầu tư</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wide">Giả lập đổi vai phản hồi từ nhà đầu tư</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-500">Quyết định của Nhà đầu tư</label>
                    <select
                      value={investingAction}
                      onChange={(e) => setInvestingAction(e.target.value as any)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-700 font-medium shadow-sm"
                    >
                      <option value="shortlist">Đánh dấu là hồ sơ tiềm năng (Shortlist)</option>
                      <option value="another_challenge">Yêu cầu thực hiện thêm thử thách</option>
                      <option value="scheduled_meeting">Đặt lịch họp trực tiếp (Zoom/Meet)</option>
                    </select>
                  </div>

                  {investingAction === 'scheduled_meeting' && (
                    <div className="space-y-3 animate-fade-in text-xs font-sans">
                      <div className="space-y-1">
                        <label className="block text-slate-500 font-semibold">Thời gian cuộc họp *</label>
                        <input
                          type="datetime-local"
                          value={meetingTime}
                          onChange={(e) => setMeetingTime(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-slate-500 font-semibold">Đường dẫn cuộc họp (Zoom/Google Meet) *</label>
                        <input
                          type="url"
                          value={meetingLink}
                          onChange={(e) => setMeetingLink(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          placeholder="https://meet.google.com/..."
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-slate-500 font-semibold">Lời nhắn ghi chú cuộc họp</label>
                        <textarea
                          rows={3}
                          value={meetingNotes}
                          onChange={(e) => setMeetingNotes(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          placeholder="Ghi chú lịch hẹn gửi tới founder..."
                        />
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleInvestorAction}
                    disabled={savingInvestorAction}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg cursor-pointer transition-colors shadow-sm text-xs"
                  >
                    {savingInvestorAction ? 'Đang lưu quyết định...' : 'Gửi Quyết định & Thông báo'}
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
