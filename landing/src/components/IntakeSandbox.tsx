'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SparklesIcon, XIcon, ArrowRightIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type Startup = {
  id: string
  rank: number
  name: string
  eligible: boolean
  totalScore: number
  confidence: number
  recommendation: 'consider_shortlist' | 'need_review' | 'verify_claims'
  status: 'RECEIVED' | 'EXTRACTING' | 'NEEDS_REVIEW' | 'ELIGIBLE' | 'SCORED' | 'SHORTLISTED' | 'ACCEPTED'
  sector: string
  stage: string
  targetMarket: string
  evidenceQuote: string
  verificationQuestions: string[]
  rubric: {
    sector: { score: number; weight: number; rationale: string; quote: string }
    stage: { score: number; weight: number; rationale: string; quote: string }
    resource: { score: number; weight: number; rationale: string; quote: string }
    region: { score: number; weight: number; rationale: string; quote: string }
  }
}

const STARTUPS_DATA: Startup[] = [
  {
    id: '1',
    rank: 1,
    name: 'AquaSense AI',
    eligible: true,
    totalScore: 92,
    confidence: 0.94,
    recommendation: 'consider_shortlist',
    status: 'ELIGIBLE',
    sector: 'AgriTech / Nông nghiệp công nghệ cao',
    stage: 'Seed / Đang gọi vốn vòng hạt giống',
    targetMarket: 'Đông Nam Á (SEA)',
    evidenceQuote: 'Hệ thống tự động hóa tưới tiêu thông minh tiết kiệm 30% nước (Slide 4, 7)',
    verificationQuestions: [
      'Xác minh số liệu doanh thu chạy thử (pilot revenue) tại Đồng bằng Sông Cửu Long.',
      'Kiểm tra tính pháp lý của bằng sáng chế độc quyền về cảm biến đo độ ẩm.'
    ],
    rubric: {
      sector: {
        score: 96,
        weight: 30,
        rationale: 'Rất khớp với lĩnh vực nông nghiệp tuần hoàn và ứng dụng AI.',
        quote: 'AgriTech automated irrigation platform (Slide 2)'
      },
      stage: {
        score: 90,
        weight: 20,
        rationale: 'Hồ sơ Seed, đang chạy thử nghiệm thực tế với 5 đối tác.',
        quote: 'Active pilot phase with 5 local farming co-ops (Slide 6)'
      },
      resource: {
        score: 88,
        weight: 30,
        rationale: 'Có đội ngũ R&D và nền tảng hạ tầng sẵn sàng chuyển giao.',
        quote: 'Core hardware designed in-house, custom firmware (Slide 8)'
      },
      region: {
        score: 95,
        weight: 20,
        rationale: 'Tập trung vào vùng ĐBSCL và các nước xuất khẩu lúa gạo.',
        quote: 'Targeting Vietnam, Thailand and Indonesia market (Slide 12)'
      }
    }
  },
  {
    id: '2',
    name: 'Nexora Flow Solutions',
    rank: 2,
    eligible: true,
    totalScore: 89,
    confidence: 0.88,
    recommendation: 'consider_shortlist',
    status: 'NEEDS_REVIEW',
    sector: 'SaaS / AI Workflow Automation',
    stage: 'Pre-Seed',
    targetMarket: 'Doanh nghiệp / Quỹ đầu tư toàn cầu',
    evidenceQuote: 'So khớp deal-flow tự động giữa startup và nhà đầu tư dựa trên mandate (Slide 2)',
    verificationQuestions: [
      'Xác nhận mô hình bảo mật dữ liệu khách hàng khi tải pitch deck lên.',
      'Kiểm tra roadmap tích hợp APIs với các CRM hiện hành.'
    ],
    rubric: {
      sector: {
        score: 92,
        weight: 30,
        rationale: 'Hoàn toàn khớp tiêu chí đổi mới sáng tạo số hóa quy trình.',
        quote: 'AI-powered dealmaker for startups (Slide 1)'
      },
      stage: {
        score: 82,
        weight: 20,
        rationale: 'Đang ở giai đoạn phát triển MVP, chuẩn bị gọi vốn.',
        quote: 'MVP validated with 10 beta test users (Slide 5)'
      },
      resource: {
        score: 90,
        weight: 30,
        rationale: 'Đội ngũ sáng lập có kinh nghiệm công nghệ từ Singapore.',
        quote: 'Co-founders ex-Grab Tech Lead, ex-SG Innovate (Slide 9)'
      },
      region: {
        score: 92,
        weight: 20,
        rationale: 'Giải quyết bài toán kết nối đầu tư Đông Nam Á.',
        quote: 'Connecting global VCs with SEA innovators (Slide 3)'
      }
    }
  },
  {
    id: '3',
    name: 'GreenPack Vietnam',
    rank: 3,
    eligible: true,
    totalScore: 76,
    confidence: 0.68,
    recommendation: 'need_review',
    status: 'SCORED',
    sector: 'CleanTech / Bao bì phân hủy sinh học',
    stage: 'Seed',
    targetMarket: 'Các chuỗi bán lẻ & F&B Việt Nam',
    evidenceQuote: 'Nguyên liệu từ bã mía và xơ dừa tự nhiên phân hủy trong 90 ngày (Slide 3)',
    verificationQuestions: [
      'Kiểm tra chứng nhận an toàn thực phẩm FDA của màng bọc phân hủy sinh học.',
      'Xác minh sản lượng nhà máy thử nghiệm tại Long An.'
    ],
    rubric: {
      sector: {
        score: 80,
        weight: 30,
        rationale: 'Lĩnh vực công nghệ xanh bền vững rất được khuyến khích.',
        quote: 'Biodegradable sugarcane pulp packaging (Slide 3)'
      },
      stage: {
        score: 75,
        weight: 20,
        rationale: 'Đã xây dựng xong nhà xưởng thử nghiệm công suất nhỏ.',
        quote: 'Pilot factory in Long An operational (Slide 5)'
      },
      resource: {
        score: 70,
        weight: 30,
        rationale: 'Nguồn cung nguyên liệu ổn định nhưng chưa có hợp đồng bao tiêu dài hạn.',
        quote: 'Secured raw supply from local sugar mills (Slide 7)'
      },
      region: {
        score: 82,
        weight: 20,
        rationale: 'Hoạt động nội địa tốt, tiềm năng xuất khẩu cần kiểm định.',
        quote: 'Targeting FMCG chains in Hanoi and HCMC (Slide 10)'
      }
    }
  },
  {
    id: '4',
    name: 'MedTech Hub',
    rank: 4,
    eligible: false,
    totalScore: 64,
    confidence: 0.45,
    recommendation: 'verify_claims',
    status: 'NEEDS_REVIEW',
    sector: 'HealthTech / Telemedicine',
    stage: 'Seed',
    targetMarket: 'Khám chữa bệnh từ xa cho khu vực nông thôn',
    evidenceQuote: 'Ứng dụng AI phân tích triệu chứng sơ bộ kết nối bác sĩ chuyên khoa (Slide 5)',
    verificationQuestions: [
      'Yêu cầu startup bổ sung giấy phép hoạt động khám chữa bệnh từ xa của Bộ Y tế.',
      'AI chẩn đoán lỗi tỷ lệ cao, độ tin cậy thấp, cần xác thực độ chính xác lâm sàng.'
    ],
    rubric: {
      sector: {
        score: 85,
        weight: 30,
        rationale: 'Đúng ngành y tế số nhưng các tuyên bố về chẩn đoán bằng AI còn chưa có cơ sở kiểm chứng.',
        quote: 'AI diagnosis copilot for rural areas (Slide 2)'
      },
      stage: {
        score: 60,
        weight: 20,
        rationale: 'Startup chưa bổ sung giấy tờ pháp lý kinh doanh dịch vụ y tế đặc thù.',
        quote: 'Seed stage expansion pending regulatory approvals (Slide 6)'
      },
      resource: {
        score: 55,
        weight: 30,
        rationale: 'Đội ngũ kỹ sư mỏng, chưa có cố vấn chuyên môn y khoa uy tín.',
        quote: '3 dev team, advisory board is under setup (Slide 8)'
      },
      region: {
        score: 60,
        weight: 20,
        rationale: 'Mở rộng quy mô nông thôn khó khăn về hạ tầng đường truyền.',
        quote: 'Targeting remote commune health centers (Slide 11)'
      }
    }
  }
]

export function IntakeSandbox() {
  const [startups, setStartups] = useState<Startup[]>(STARTUPS_DATA)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isScreening, setIsScreening] = useState(false)
  const [screeningProgress, setScreeningProgress] = useState(0)

  const activeStartup = startups.find((s) => s.id === selectedId)

  const runScreening = () => {
    setIsScreening(true)
    setScreeningProgress(0)
    const interval = setInterval(() => {
      setScreeningProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          setIsScreening(false)
          setStartups((prevList) =>
            prevList.map((s) =>
              s.status === 'NEEDS_REVIEW' ? { ...s, status: 'SCORED' } : s
            )
          )
          return 100
        }
        return prev + 25
      })
    }, 400)
  }

  const changeStatus = (id: string, newStatus: Startup['status']) => {
    setStartups((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: newStatus } : s))
    )
  }

  const getStatusColorClass = (status: Startup['status']) => {
    switch (status) {
      case 'RECEIVED':
        return 'bg-muted text-muted-foreground'
      case 'EXTRACTING':
        return 'bg-blue-500/10 text-blue-500 dark:text-blue-400 animate-pulse'
      case 'NEEDS_REVIEW':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
      case 'ELIGIBLE':
        return 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20'
      case 'SCORED':
        return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
      case 'SHORTLISTED':
        return 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20'
      case 'ACCEPTED':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }

  const getStatusText = (status: Startup['status']) => {
    const dict = {
      RECEIVED: 'Đã nhận',
      EXTRACTING: 'Đang trích xuất',
      NEEDS_REVIEW: 'Cần kiểm tra',
      ELIGIBLE: 'Sẵn sàng',
      SCORED: 'Đã chấm',
      SHORTLISTED: 'Shortlist',
      ACCEPTED: 'Được chọn'
    }
    return dict[status] || status
  }

  return (
    <section className="section-shell border-b border-border/40 py-16 sm:py-24" id="sandbox">
      <div className="glow-orb glow-orb-c opacity-20" />
      <div className="relative mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="mb-12 max-w-2xl" data-rise>
          <div className="section-kicker mb-4">
            <Badge variant="secondary" className="rounded-full border border-primary/15 bg-primary/10 text-primary">
              Interactive Workspace Simulator
            </Badge>
          </div>
          <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Trình mô phỏng Nexora Intake
          </h2>
          <p className="mt-3 text-muted-foreground sm:text-lg">
            Khám phá quy trình đánh giá deal-flow thực tế theo các thông số kỹ thuật chuẩn của hệ thống Intake. Nhấp chọn hồ sơ để xem chi tiết bằng chứng và chạy chấm điểm AI.
          </p>
        </div>

        {/* Workspace Layout Container */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start" data-rise>
          
          {/* Main workspace table as a Card */}
          <Card className={cn(
            "lg:col-span-12 transition-all duration-300 border-border/50 bg-card/85 backdrop-blur-md shadow-xl",
            selectedId ? "lg:col-span-7" : "lg:col-span-12"
          )}>
            <CardHeader className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-border/40 pb-5">
              <div className="flex flex-col gap-0.5">
                <CardTitle className="font-heading text-lg sm:text-xl">Không gian Chương trình: NIC 2026</CardTitle>
                <CardDescription className="text-xs">Hàng đợi hồ sơ sàng lọc</CardDescription>
              </div>
              <div className="flex shrink-0">
                <Button
                  onClick={runScreening}
                  disabled={isScreening}
                  className="btn-glow h-9 rounded-full px-4 text-xs font-semibold"
                >
                  {isScreening ? (
                    <span className="flex items-center gap-2">
                      <span className="size-3 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                      <span>Đang chấm {screeningProgress}%</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <SparklesIcon data-icon="inline-start" />
                      <span>Chạy AI Screening</span>
                    </span>
                  )}
                </Button>
              </div>
            </CardHeader>

            <CardContent className="pt-6">
              {/* Stats dashboard grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div className="p-3 border border-border/40 rounded-xl bg-muted/40">
                  <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">Hồ sơ tiếp nhận</div>
                  <div className="text-lg font-bold mt-1">142</div>
                </div>
                <div className="p-3 border border-border/40 rounded-xl bg-muted/40">
                  <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">Điểm trung bình</div>
                  <div className="text-lg font-bold mt-1">78.4</div>
                </div>
                <div className="p-3 border border-border/40 rounded-xl bg-muted/40">
                  <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">Đủ điều kiện</div>
                  <div className="text-lg font-bold mt-1 text-primary">118</div>
                </div>
                <div className="p-3 border border-border/40 rounded-xl bg-muted/40">
                  <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">Confidence thấp</div>
                  <div className="text-lg font-bold mt-1 text-amber-500">12</div>
                </div>
              </div>

              {/* Startup queue table */}
              <div className="w-full overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[580px]">
                  <thead>
                    <tr className="border-b border-border/40 text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                      <th className="py-2.5 px-2">Hạng</th>
                      <th className="py-2.5 px-2">Startup</th>
                      <th className="py-2.5 px-2">Đủ điều kiện</th>
                      <th className="py-2.5 px-2">Điểm AI</th>
                      <th className="py-2.5 px-2">Độ tin cậy</th>
                      <th className="py-2.5 px-2">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {startups.map((s) => (
                      <tr
                        key={s.id}
                        onClick={() => setSelectedId(s.id === selectedId ? null : s.id)}
                        className={cn(
                          "cursor-pointer transition-colors hover:bg-muted/40",
                          s.id === selectedId ? "bg-muted/80" : ""
                        )}
                      >
                        <td className="py-3 px-2 font-mono text-xs">#{s.rank}</td>
                        <td className="py-3 px-2 font-bold text-sm">
                          {s.name}
                          <span className="block text-[11px] font-normal text-muted-foreground">{s.sector.split('/')[0]}</span>
                        </td>
                        <td className="py-3 px-2">
                          <Badge variant={s.eligible ? "default" : "outline"} className={cn("rounded-full text-[10px]", s.eligible ? "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20" : "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20")}>
                            {s.eligible ? 'Có' : 'Không'}
                          </Badge>
                        </td>
                        <td className="py-3 px-2 font-mono font-bold text-sm text-primary">{s.totalScore}/100</td>
                        <td className="py-3 px-2">
                          <span className={cn("text-xs font-semibold", s.confidence >= 0.8 ? 'text-green-500' : s.confidence >= 0.5 ? 'text-amber-500' : 'text-red-500')}>
                            {Math.round(s.confidence * 100)}%
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          <Badge variant="outline" className={cn("rounded-full text-[10px] font-semibold border", getStatusColorClass(s.status))}>
                            {getStatusText(s.status)}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Right sidebar: AI Evidence Drawer as a Card */}
          {selectedId && activeStartup && (
            <Card className="lg:col-span-5 border-border/50 bg-card/85 backdrop-blur-md shadow-xl flex flex-col justify-between min-h-[480px]">
              
              <CardHeader className="flex flex-col gap-1 border-b border-border/40 pb-4">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-semibold tracking-wider text-primary uppercase">AI EVIDENCE DRAWER</span>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => setSelectedId(null)}
                    aria-label="Close drawer"
                    className="rounded-full"
                  >
                    <XIcon />
                  </Button>
                </div>
                <CardTitle className="font-heading text-lg mt-1">{activeStartup.name}</CardTitle>
                <CardDescription className="text-xs leading-relaxed">{activeStartup.sector}</CardDescription>
              </CardHeader>

              <CardContent className="py-5 space-y-4 overflow-y-auto max-h-[360px] flex-1">
                
                {/* AI Summary and Confidence */}
                <div className="p-3.5 rounded-xl bg-muted/40 border border-border/40 space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-muted-foreground">Giai đoạn:</span>
                    <span>{activeStartup.stage.split('/')[0]}</span>
                  </div>
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-muted-foreground">Thị trường:</span>
                    <span>{activeStartup.targetMarket}</span>
                  </div>
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-muted-foreground">Độ tin cậy AI:</span>
                    <span className={activeStartup.confidence >= 0.8 ? 'text-green-500' : 'text-amber-500'}>
                      {activeStartup.confidence >= 0.8 ? 'Cao' : 'Trung bình'} ({Math.round(activeStartup.confidence * 100)}%)
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-2 italic border-t border-border/40 pt-2">
                    &ldquo;{activeStartup.evidenceQuote}&rdquo;
                  </div>
                </div>

                {/* Rubric metrics */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Tiêu chí chấm điểm (Rubric)</h4>
                  <div className="grid gap-2">
                    {Object.entries(activeStartup.rubric).map(([key, details]) => (
                      <div key={key} className="p-2.5 border border-border/40 rounded-xl text-xs bg-muted/20 space-y-1">
                        <div className="flex justify-between font-bold">
                          <span className="capitalize">{key === 'resource' ? 'Nguồn lực' : key === 'sector' ? 'Lĩnh vực' : key === 'stage' ? 'Giai đoạn' : 'Khu vực'}</span>
                          <span className="text-primary">{details.score}/100</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground leading-normal">{details.rationale}</div>
                        <div className="text-[9px] text-muted-foreground/70 italic">&ldquo;{details.quote}&rdquo;</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Verification checklist */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Xác minh bằng chứng</h4>
                  <ul className="space-y-2 text-xs text-muted-foreground">
                    {activeStartup.verificationQuestions.map((q, idx) => (
                      <li key={idx} className="flex gap-2.5 items-start">
                        <input type="checkbox" className="mt-0.5 rounded border-border/50 bg-background/50 focus:ring-primary focus:ring-offset-background" />
                        <span className="leading-relaxed">{q}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>

              {/* Reviewer Action Decision Panel */}
              <CardFooter className="border-t border-border/40 bg-muted/20 px-6 py-4 flex items-center justify-between gap-4">
                <div className="flex flex-col">
                  <span className="text-[9px] font-semibold tracking-wider text-muted-foreground uppercase">Quyết định reviewer</span>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">Yêu cầu xác nhận</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => changeStatus(activeStartup.id, 'SHORTLISTED')}
                    className="h-8 rounded-full text-xs font-semibold px-3 border-green-500/20 text-green-600 dark:text-green-400 hover:bg-green-500/10"
                  >
                    Shortlist
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => changeStatus(activeStartup.id, 'ACCEPTED')}
                    className="h-8 rounded-full text-xs font-semibold px-3 btn-glow"
                  >
                    Duyệt
                    <ArrowRightIcon data-icon="inline-end" />
                  </Button>
                </div>
              </CardFooter>

            </Card>
          )}

        </div>
      </div>
    </section>
  )
}
export default IntakeSandbox
