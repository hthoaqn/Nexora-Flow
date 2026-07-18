'use client'

import {
  ArrowRightIcon,
  Building2Icon,
  CheckCircle2Icon,
  FileTextIcon,
  FolderSearchIcon,
  HandshakeIcon,
  LockIcon,
  MailIcon,
  MessageSquareIcon,
  RocketIcon,
  ShuffleIcon,
  SnowflakeIcon,
  SparklesIcon,
  TrendingUpIcon,
  UserCheckIcon,
  XCircleIcon,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { Process } from './Process'
import { DealGraph } from './DealGraph'
import { LiquidBg } from './LiquidBg'
import { Motion } from './Motion'
import { Navbar } from './Navbar'
import { Footer } from './Footer'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { cn } from '@/lib/utils'

const featureIcons = [
  SparklesIcon,
  MailIcon,
  HandshakeIcon,
  MessageSquareIcon,
  TrendingUpIcon,
  LockIcon,
]

export function HomePage() {
  const { t, lang } = useI18n()

  const marqueeList =
    lang === 'vi'
      ? ['DOANH NGHIỆP', 'VIỆN TRƯỜNG', 'PHÒNG LAB', 'QUỸ ĐẦU TƯ', 'ACCELERATOR', 'STARTUP']
      : ['CORPORATIONS', 'UNIVERSITIES', 'RESEARCH LABS', 'VENTURE FUNDS', 'ACCELERATORS', 'STARTUPS']

  const stats =
    lang === 'vi'
      ? [
          { v: '92%', l: 'Fit score TB top match', h: 'Có bằng chứng' },
          { v: '5', l: 'Bước deck → họp', h: 'Một pipeline' },
          { v: '100%', l: 'Intro do người duyệt', h: 'Không auto-send' },
          { v: '2-way', l: 'Match hai chiều', h: 'Startup × partner' },
        ]
      : [
          { v: '92%', l: 'Avg top-match fit', h: 'Evidence-bound' },
          { v: '5', l: 'Steps deck → meeting', h: 'One pipeline' },
          { v: '100%', l: 'Human-approved intros', h: 'No auto-send' },
          { v: '2-way', l: 'Bidirectional match', h: 'Startup × partner' },
        ]

  const pains =
    lang === 'vi'
      ? [
          {
            icon: SnowflakeIcon,
            title: 'Cold email & danh bạ cũ',
            body: 'Outreach mù quáng, tỷ lệ phản hồi thấp, không ai nhớ thesis của bạn.',
          },
          {
            icon: FolderSearchIcon,
            title: 'Directory không có điểm số',
            body: 'Hàng trăm profile, không ranking, không bằng chứng — bạn vẫn phải lục tay.',
          },
          {
            icon: ShuffleIcon,
            title: 'May rủi quyết định deal-flow',
            body: 'Cuộc họp phụ thuộc network cá nhân, không scale, không đo lường được.',
          },
        ]
      : [
          {
            icon: SnowflakeIcon,
            title: 'Cold email & stale lists',
            body: 'Blind outreach, low reply rates — nobody remembers your thesis.',
          },
          {
            icon: FolderSearchIcon,
            title: 'Directories without scores',
            body: 'Hundreds of profiles, no ranking, no evidence — still manual digging.',
          },
          {
            icon: ShuffleIcon,
            title: 'Luck-driven deal flow',
            body: 'Meetings depend on personal networks — not scalable, not measurable.',
          },
        ]

  const faqData =
    lang === 'vi'
      ? [
          {
            q: 'Nexora Flow là gì?',
            a: 'Nền tảng AI kết nối startup với doanh nghiệp, viện trường và quỹ — phân tích pitch deck, match có giải thích, soạn email và hỗ trợ đặt lịch.',
          },
          {
            q: 'Dữ liệu pitch deck có bảo mật không?',
            a: 'Có. Dữ liệu được tách theo tổ chức (tenant isolation). Không chia sẻ deck gốc hay ghi chú nội bộ cho bên thứ ba.',
          },
          {
            q: 'AI có tự quyết định duyệt/loại không?',
            a: 'Không. AI chỉ gợi ý điểm số và bằng chứng. Quyết định cuối cùng luôn do con người.',
          },
          {
            q: 'Hệ thống có tự gửi email không?',
            a: 'Không. Mọi email/lời mời ở trạng thái nháp. Bạn xem, sửa và gửi thủ công.',
          },
        ]
      : [
          {
            q: 'What is Nexora Flow?',
            a: 'An AI deal-flow matchmaker that connects startups with corporates, labs, and funds — from deck analysis to explained matches and intro drafts.',
          },
          {
            q: 'Is pitch deck data secure?',
            a: 'Yes. Tenant isolation applies. Raw decks and internal notes are never shared across organizations.',
          },
          {
            q: 'Does AI auto-accept or reject?',
            a: 'No. AI only suggests scores and evidence. Humans make final decisions.',
          },
          {
            q: 'Does it auto-send emails?',
            a: 'No. Intros stay as drafts until you review, edit, and send.',
          },
        ]

  /** Word + char tokens for scroll-scrub (accent only closing promise phrase). */
  const manifestoTokens = (() => {
    // Only the final promise — not every "the" / random word
    const accentWords =
      lang === 'en'
        ? new Set(['books', 'meeting', 'itself'])
        : new Set(['giới', 'thiệu', 'đến', 'cuộc', 'họp'])
    return t.problemBody
      .split(/(\s+)/)
      .filter((tok) => tok.length > 0)
      .map((token) => {
        if (/^\s+$/.test(token)) {
          return { type: 'space' as const, text: token, accent: false }
        }
        const clean = token.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()'"]/g, '')
        return {
          type: 'word' as const,
          text: token,
          accent: accentWords.has(clean),
        }
      })
  })()

  return (
    <>
      <Motion />
      <Navbar />
      <div className="scroll-progress" data-scroll-progress aria-hidden />
      <div className="pointer-events-none fixed inset-0 z-0 bg-noise" aria-hidden />

      {/* ─── Hero ─── */}
      <header className="relative min-h-[100svh] overflow-hidden pt-24" id="top">
        {/* Light needs higher opacity — graph was washed out at 50% */}
        <div className="absolute inset-0 opacity-[0.88] dark:opacity-90">
          <DealGraph />
        </div>
        <div className="pointer-events-none absolute inset-0">
          <div className="aurora-mesh opacity-60 dark:opacity-100" />
          <div className="glow-orb glow-orb-a opacity-70 dark:opacity-100" />
          <div className="glow-orb glow-orb-b opacity-50 dark:opacity-100" />
          <div className="absolute inset-0 grid-fade opacity-50 dark:opacity-100" />
          {/* Lighter wash in light mode so 3D graph stays visible */}
          <div className="absolute inset-0 bg-gradient-to-b from-background/10 via-background/25 to-background dark:from-background/20 dark:via-background/50 dark:to-background" />
        </div>

        <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 pb-24 pt-10 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:gap-16 lg:pt-16">
          <div className="max-w-xl">
            <Badge
              variant="secondary"
              className="rise d1 mb-6 rounded-full border border-primary/25 bg-primary/10 px-3.5 py-1.5 text-primary shadow-[0_0_24px_-8px] shadow-primary/40"
            >
              <span className="live-dot mr-2 inline-block" />
              {t.eyebrow}
            </Badge>

            <h1 className="font-heading text-[2.5rem] font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-[3.75rem]">
              <span className="rise d2 block text-gradient-soft">{t.heroTitle1}</span>
              <span className="rise d3 mt-1.5 block text-gradient">{t.heroTitle2}</span>
            </h1>

            <p className="rise d4 mt-7 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
              {t.heroLead}
            </p>

            <div className="rise d4 mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                size="lg"
                className="btn-glow btn-shine inline-flex h-12 items-center justify-center gap-2 rounded-full px-7 text-[0.95rem]"
                render={<a href="/login" />}
                nativeButton={false}
              >
                {lang === 'vi' ? 'Đăng nhập startup' : 'Startup sign in'}
                <ArrowRightIcon className="size-4 shrink-0" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 rounded-full border-border/80 bg-background/40 px-7 backdrop-blur-md hover:bg-background/70"
                render={<a href="/workspace/login" />}
                nativeButton={false}
              >
                {lang === 'vi' ? 'Intake workspace' : 'Intake workspace'}
              </Button>
              <Button
                size="lg"
                variant="ghost"
                className="h-12 rounded-full px-5"
                render={<a href="#process" />}
                nativeButton={false}
              >
                {t.heroSecondary}
              </Button>
            </div>

            <div className="rise d4 mt-9 flex flex-wrap gap-x-5 gap-y-2.5 text-sm text-muted-foreground">
              {(lang === 'vi'
                ? ['Pitch deck AI', 'Match có giải thích', 'Con người duyệt']
                : ['Pitch deck AI', 'Explainable match', 'Human approve']
              ).map((item) => (
                <span key={item} className="inline-flex items-center gap-1.5">
                  <CheckCircle2Icon className="size-3.5 text-primary" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          {/* Product mock — deal shortlist (no floating chips) */}
          <div className="relative w-full max-w-[26rem] shrink-0 self-center lg:self-auto">
            <div className="match-stage">
              <div
                className="hero-desk relative z-10 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-2xl shadow-black/10 dark:shadow-black/40"
                data-tilt
              >
                {/* App chrome */}
                <div className="flex items-center gap-3 border-b border-border/60 bg-muted/40 px-4 py-2.5">
                  <div className="flex items-center gap-1.5" aria-hidden>
                    <span className="size-2 rounded-full bg-red-400/90" />
                    <span className="size-2 rounded-full bg-amber-400/90" />
                    <span className="size-2 rounded-full bg-emerald-400/90" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-medium text-muted-foreground">
                      nexora-flow.cloud / shortlist
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="hidden shrink-0 rounded-md px-1.5 py-0 text-[10px] font-medium sm:inline-flex"
                  >
                    {lang === 'vi' ? 'Nội bộ' : 'Internal'}
                  </Badge>
                </div>

                {/* Case header */}
                <div className="border-b border-border/50 px-4 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant="secondary"
                          className="rounded-md px-1.5 py-0 text-[10px] font-semibold uppercase tracking-wide"
                        >
                          {lang === 'vi' ? 'Hàng đợi' : 'Queue'}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">
                          {lang === 'vi' ? 'Chờ duyệt intro' : 'Awaiting intro approval'}
                        </span>
                      </div>
                      <p className="font-heading text-base font-semibold tracking-tight">
                        AquaSense
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        AgriTech · Seed · {lang === 'vi' ? 'ĐBSCL pilot' : 'Mekong pilot'}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-background px-2 py-1 text-[10px] font-medium text-muted-foreground">
                        <FileTextIcon className="size-3" />
                        deck.pdf
                      </span>
                      <span className="text-[10px] tabular-nums text-muted-foreground">
                        48 {lang === 'vi' ? 'đối tác quét' : 'partners scored'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Ranked shortlist */}
                <div className="px-3 py-3">
                  <div className="mb-2 flex items-center justify-between px-1">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      {lang === 'vi' ? 'Top shortlist' : 'Top shortlist'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {lang === 'vi' ? 'Điểm · bằng chứng' : 'Score · evidence'}
                    </p>
                  </div>

                  <ul className="flex flex-col gap-1.5">
                    {(
                      lang === 'vi'
                        ? [
                            {
                              rank: 1,
                              name: 'Mekong Ventures',
                              meta: 'Quỹ · Climate',
                              score: 92,
                              why: 'Sector + stage + vùng pilot',
                              hot: true,
                            },
                            {
                              rank: 2,
                              name: 'Delta Corp R&D',
                              meta: 'DN · Agri',
                              score: 87,
                              why: 'Mandate R&D nước & cảm biến',
                              hot: false,
                            },
                            {
                              rank: 3,
                              name: 'SEA Seed Lab',
                              meta: 'Lab · Water',
                              score: 81,
                              why: 'Thesis seed · Đông Nam Á',
                              hot: false,
                            },
                          ]
                        : [
                            {
                              rank: 1,
                              name: 'Mekong Ventures',
                              meta: 'Fund · Climate',
                              score: 92,
                              why: 'Sector + stage + pilot region',
                              hot: true,
                            },
                            {
                              rank: 2,
                              name: 'Delta Corp R&D',
                              meta: 'Corp · Agri',
                              score: 87,
                              why: 'Water & sensor R&D mandate',
                              hot: false,
                            },
                            {
                              rank: 3,
                              name: 'SEA Seed Lab',
                              meta: 'Lab · Water',
                              score: 81,
                              why: 'Seed thesis · Southeast Asia',
                              hot: false,
                            },
                          ]
                    ).map((row) => (
                      <li
                        key={row.name}
                        className={cn(
                          'rounded-xl border px-3 py-2.5 transition-colors',
                          row.hot
                            ? 'border-border bg-muted/50 ring-1 ring-primary/15'
                            : 'border-border/50 bg-background/50',
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={cn(
                              'flex size-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold tabular-nums',
                              row.hot
                                ? 'bg-foreground text-background'
                                : 'bg-muted text-muted-foreground',
                            )}
                          >
                            {row.rank}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-sm font-semibold leading-tight">
                                {row.name}
                              </p>
                              <span className="font-heading text-sm font-bold tabular-nums text-foreground">
                                {row.score}
                              </span>
                            </div>
                            <div className="mt-0.5 flex items-center justify-between gap-2">
                              <p className="truncate text-[11px] text-muted-foreground">
                                {row.meta}
                              </p>
                              <div className="h-1 w-12 shrink-0 overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full rounded-full bg-foreground/70"
                                  style={{ width: `${row.score}%` }}
                                />
                              </div>
                            </div>
                            <p className="mt-1 truncate text-[11px] text-muted-foreground/90">
                              {row.why}
                            </p>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Human-in-the-loop footer */}
                <div className="border-t border-border/60 bg-muted/25 px-4 py-3">
                  <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <CheckCircle2Icon className="size-3 text-emerald-600 dark:text-emerald-400" />
                      {lang === 'vi' ? 'Bằng chứng gắn deck' : 'Evidence linked'}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <UserCheckIcon className="size-3 text-primary" />
                      {lang === 'vi' ? 'Người duyệt intro' : 'Human approves intro'}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MailIcon className="size-3" />
                      {lang === 'vi' ? 'Email nháp' : 'Draft only'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="h-9 flex-1 rounded-lg text-sm"
                      render={<a href="/login" />}
                      nativeButton={false}
                    >
                      {lang === 'vi' ? 'Mở shortlist' : 'Open shortlist'}
                      <ArrowRightIcon className="size-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      className="h-9 rounded-lg px-3 text-sm"
                      render={<a href="#process" />}
                      nativeButton={false}
                    >
                      {lang === 'vi' ? 'Quy trình' : 'Process'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Marquee — two identical strips for seamless -50% loop */}
      <div className="relative overflow-hidden border-y border-border/40 bg-muted/30 py-4" aria-hidden>
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-background to-transparent sm:w-24" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-background to-transparent sm:w-24" />
        <div className="marquee-track">
          {[0, 1].map((k) => (
            <div
              key={k}
              className="flex shrink-0 items-center gap-10 px-5 text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase sm:gap-12 sm:px-6"
            >
              {marqueeList.map((m) => (
                <span key={`${k}-${m}`} className="inline-flex shrink-0 items-center gap-10 sm:gap-12">
                  <span className="opacity-80">{m}</span>
                  <span className="text-primary" aria-hidden>
                    ✦
                  </span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Section 1 — lock manifesto frame (scroll lights letters), then rest fades in */}
      <section
        className="relative overflow-visible border-b border-border/40 py-16 sm:py-24"
        id="problem"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--primary)_7%,transparent),transparent_55%)]"
        />

        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          {/* Sticky lock frame: scroll → letters brighten */}
          <div className="manifesto-track" data-manifesto-track>
            <div className="manifesto-sticky">
              <div className="manifesto-pin__frame">
                <div className="section-kicker mb-4 is-on">
                  <Badge
                    variant="secondary"
                    className="rounded-full border border-primary/15 bg-primary/10 text-primary"
                  >
                    {t.problemEyebrow}
                  </Badge>
                </div>
                <h2 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl lg:text-[2.65rem] lg:leading-[1.15]">
                  {t.problemTitle}
                </h2>
                <p
                  className="manifesto-text mt-5 max-w-3xl font-heading text-xl font-semibold leading-[1.55] tracking-tight sm:text-2xl lg:text-[1.9rem]"
                  aria-label={t.problemBody}
                  data-manifesto-text
                >
                  {manifestoTokens.map((tok, i) => {
                    if (tok.type === 'space') {
                      return (
                        <span key={`s-${i}`} className="manifesto-space">
                          {tok.text}
                        </span>
                      )
                    }
                    return (
                      <span
                        key={`w-${i}-${tok.text}`}
                        className={cn(
                          'manifesto-word',
                          tok.accent && 'manifesto-word--accent',
                        )}
                      >
                        {Array.from(tok.text).map((ch, j) => (
                          <span key={j} className="manifesto-char" data-manifesto-char>
                            {ch}
                          </span>
                        ))}
                      </span>
                    )
                  })}
                </p>
                <p
                  className="manifesto-hint mt-6 text-xs font-medium tracking-wide text-muted-foreground uppercase"
                  data-manifesto-hint
                >
                  {lang === 'vi' ? 'Cuộn để đọc →' : 'Scroll to read →'}
                </p>
              </div>
            </div>
          </div>

          {/* Pain cards — wrapper data-rise so reveal never depends on Card prop forwarding */}
          <div className="mb-10 grid gap-4 sm:grid-cols-3" data-rise>
            {pains.map((pain, i) => (
              <div
                key={pain.title}
                data-rise
                style={{ transitionDelay: `${80 + i * 90}ms` }}
              >
                <Card className="spotlight-card h-full gap-0 border-border/60 bg-card/80 py-0 shadow-sm backdrop-blur-sm">
                  <CardHeader className="gap-3 px-5 pt-5 pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex size-10 items-center justify-center rounded-xl border border-destructive/20 bg-destructive/10 text-destructive">
                        <pain.icon className="size-4" />
                      </span>
                      <XCircleIcon className="size-4 text-muted-foreground/50" />
                    </div>
                    <CardTitle className="font-heading text-base leading-snug sm:text-[1.05rem]">
                      {pain.title}
                    </CardTitle>
                    <CardDescription className="text-sm leading-relaxed">
                      {pain.body}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </div>
            ))}
          </div>

          {/* Bridge */}
          <div
            data-rise
            className="mb-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
          >
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-primary/40 sm:w-20" />
            <Badge
              variant="secondary"
              className="rounded-full border border-primary/25 bg-primary/10 px-4 py-1.5 text-primary"
            >
              <SparklesIcon className="mr-1.5 size-3.5" />
              {lang === 'vi'
                ? 'Nexora Flow thay may rủi bằng điểm số có bằng chứng'
                : 'Nexora Flow replaces luck with evidence-bound scores'}
            </Badge>
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-primary/40 sm:w-20" />
          </div>

          {/* Stats */}
          <div
            data-rise
            className="grid grid-cols-2 gap-3 rounded-2xl border border-border/70 bg-card/70 p-3 shadow-sm backdrop-blur-sm sm:gap-4 sm:p-4 lg:grid-cols-4"
          >
            {stats.map((s) => (
              <div
                key={s.l}
                className="flex flex-col gap-1.5 rounded-xl border border-border/50 bg-background/60 px-4 py-4 sm:px-5 sm:py-5"
              >
                <div className="stat-value" data-count={s.v}>
                  {s.v}
                </div>
                <p className="text-xs font-medium leading-snug text-foreground sm:text-sm">
                  {s.l}
                </p>
                <p className="text-[11px] text-muted-foreground">{s.h}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3" data-rise>
            <Button
              size="lg"
              className="btn-glow rounded-full"
              render={<a href="#process" />}
              nativeButton={false}
            >
              {lang === 'vi' ? 'Xem quy trình 5 bước' : 'See the 5-step process'}
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="rounded-full"
              render={<a href="#sides" />}
              nativeButton={false}
            >
              {lang === 'vi' ? 'Hai phía match' : 'Both sides of a match'}
            </Button>
          </div>
        </div>
      </section>

      <Process />

      {/* Audience — Two sides, one score */}
      <section
        className="section-shell relative overflow-hidden border-y border-border/40 py-20 sm:py-28"
        id="sides"
      >
        <div className="glow-orb glow-orb-b opacity-20" />

        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          {/* Header */}
          <div className="mx-auto mb-8 max-w-2xl text-center" data-rise>
            <Badge
              variant="secondary"
              className="mb-4 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-primary"
            >
              {t.audienceEyebrow}
            </Badge>
            <h2 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              {t.audienceTitle}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              {t.audienceLead}
            </p>
          </div>

          {/* Shared score strip — above both cards, never overlaps */}
          <div className="mb-6 flex justify-center" data-rise>
            <div className="inline-flex items-center gap-3 rounded-full border border-primary/25 bg-card px-4 py-2 shadow-sm">
              <span className="flex size-9 items-center justify-center rounded-full bg-primary font-heading text-sm font-bold text-primary-foreground tabular-nums">
                92
              </span>
              <div className="text-left">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
                  {t.matchScore}
                </p>
                <p className="text-xs text-muted-foreground">
                  {lang === 'vi' ? 'Cùng thang đo · 2 phía' : 'Same scale · both sides'}
                </p>
              </div>
              <Separator orientation="vertical" className="mx-1 hidden h-8 data-vertical:h-8 sm:block" />
              <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:inline-flex">
                <SparklesIcon className="size-3.5 text-primary" />
                2-way evidence
              </span>
            </div>
          </div>

          {/* Two clean equal cards */}
          <div className="grid gap-5 md:grid-cols-2">
            <Card data-rise className="spotlight-card gap-0 overflow-hidden border-border/70 py-0 shadow-sm">
              <CardHeader className="gap-3 border-b border-border/50 bg-muted/20 px-6 py-5">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                    <RocketIcon className="size-4" />
                  </span>
                  <Badge variant="secondary" className="rounded-full">
                    {t.startupTag}
                  </Badge>
                </div>
                <CardTitle className="font-heading text-xl sm:text-2xl">
                  {t.startupTitle}
                </CardTitle>
                <CardDescription>
                  {lang === 'vi' ? 'Nộp deck · được tìm thấy' : 'Upload deck · get found'}
                </CardDescription>
              </CardHeader>
              <CardContent className="px-6 py-5">
                <ul className="flex flex-col gap-3">
                  {t.startupItems.map((item) => (
                    <li key={item} className="flex gap-2.5 text-sm leading-snug">
                      <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter className="border-t border-border/50 bg-muted/10 px-6 py-4">
                <Button
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full sm:w-auto"
                  variant="outline"
                  render={<a href="/login" />}
                  nativeButton={false}
                >
                  {lang === 'vi' ? 'Tôi là startup' : "I'm a startup"}
                  <ArrowRightIcon className="size-4 shrink-0" />
                </Button>
              </CardFooter>
            </Card>

            <Card data-rise className="spotlight-card gap-0 overflow-hidden border-border/70 py-0 shadow-sm">
              <CardHeader className="gap-3 border-b border-border/50 bg-muted/20 px-6 py-5">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
                    <Building2Icon className="size-4" />
                  </span>
                  <Badge variant="outline" className="rounded-full">
                    {t.partnerTag}
                  </Badge>
                </div>
                <CardTitle className="font-heading text-xl sm:text-2xl">
                  {t.partnerTitle}
                </CardTitle>
                <CardDescription>
                  {lang === 'vi' ? 'Định nghĩa thesis · nhận deal-flow' : 'Set thesis · receive deal-flow'}
                </CardDescription>
              </CardHeader>
              <CardContent className="px-6 py-5">
                <ul className="flex flex-col gap-3">
                  {t.partnerItems.map((item) => (
                    <li key={item} className="flex gap-2.5 text-sm leading-snug">
                      <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter className="border-t border-border/50 bg-muted/10 px-6 py-4">
                <Button
                  className="btn-glow inline-flex w-full items-center justify-center gap-2 rounded-full sm:w-auto"
                  render={<a href="/login" />}
                  nativeButton={false}
                >
                  {lang === 'vi' ? 'Tôi là partner' : "I'm a partner"}
                  <ArrowRightIcon className="size-4 shrink-0" />
                </Button>
              </CardFooter>
            </Card>
          </div>

          <div
            data-rise
            className="mt-8 flex flex-wrap items-center justify-center gap-2"
          >
            {(lang === 'vi'
              ? [
                  'Evidence-bound scoring',
                  'Không black-box rank',
                  'Con người duyệt intro',
                  'Tenant isolation',
                ]
              : [
                  'Evidence-bound scoring',
                  'No black-box ranks',
                  'Human-approved intros',
                  'Tenant isolation',
                ]
            ).map((chip) => (
              <span
                key={chip}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card/80 px-3 py-1.5 text-[11px] font-medium text-muted-foreground"
              >
                <CheckCircle2Icon className="size-3 text-primary" />
                {chip}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Product bento */}
      <section className="section-shell py-16 sm:py-24" id="platform">
        <div className="glow-orb glow-orb-a opacity-15" />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-12 max-w-2xl" data-rise>
            <div className="section-kicker mb-4">
              <Badge variant="secondary" className="rounded-full border border-primary/15 bg-primary/10 text-primary">
                {t.productEyebrow}
              </Badge>
            </div>
            <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
              {t.productTitle}
            </h2>
          </div>
          <div className="feature-bento">
            {t.features.map((f, i) => {
              const Icon = featureIcons[i] ?? SparklesIcon
              return (
                <Card
                  key={f.t}
                  data-rise
                  className={cn(
                    'spotlight-card hover-lift h-full border-border/60 bg-card/80 backdrop-blur-sm',
                    i === 0 &&
                      'card-glow border-0 bg-gradient-to-br from-primary/15 via-card to-card shadow-lg shadow-primary/5',
                  )}
                >
                  <CardHeader className={cn('gap-3', i === 0 && 'sm:py-8 sm:pr-10')}>
                    <div className={cn('icon-tile', i === 0 && 'size-12')}>
                      <Icon className={cn(i === 0 ? 'size-5' : 'size-4')} />
                    </div>
                    <CardTitle
                      className={cn(
                        'font-heading',
                        i === 0 ? 'text-xl sm:text-2xl' : 'text-base',
                      )}
                    >
                      {f.t}
                    </CardTitle>
                    <CardDescription
                      className={cn('leading-relaxed', i === 0 && 'text-sm sm:text-base')}
                    >
                      {f.d}
                    </CardDescription>
                  </CardHeader>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section-shell border-y border-border/40 bg-muted/20 py-16 sm:py-24" id="faq">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="mb-10 text-center" data-rise>
            <Badge
              variant="secondary"
              className="mb-4 rounded-full border border-primary/15 bg-primary/10 text-primary"
            >
              FAQ
            </Badge>
            <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
              {lang === 'vi' ? 'Câu hỏi thường gặp' : 'Frequently Asked Questions'}
            </h2>
          </div>
          <Card data-rise className="card-glow glass-panel gap-0 overflow-hidden border-0 py-0">
            <CardContent className="px-4 pt-2 sm:px-6">
              <Accordion>
                {faqData.map((item, idx) => (
                  <AccordionItem key={item.q} value={`faq-${idx}`}>
                    <AccordionTrigger className="py-4 text-left text-sm font-medium sm:text-base">
                      {item.q}
                    </AccordionTrigger>
                    <AccordionContent>
                      <p className="pb-3 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden py-20 sm:py-28" id="cta">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="cta-shell relative px-6 py-16 text-center sm:px-14 sm:py-20" data-rise>
            <LiquidBg className="absolute inset-0 h-full w-full opacity-45" />
            <div className="absolute inset-0 bg-background/45 dark:bg-background/55" />
            <div className="glow-orb glow-orb-a opacity-50" />
            <div className="glow-orb glow-orb-b opacity-30" />
            <div className="relative">
              <Badge
                variant="secondary"
                className="mb-5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-primary"
              >
                <span className="live-dot mr-1.5 inline-block" />
                {t.ctaEyebrow}
              </Badge>
              <h2 className="font-heading text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                <span className="text-gradient">{t.ctaTitle}</span>
              </h2>
              <p className="mx-auto mt-5 max-w-md text-base text-muted-foreground sm:text-lg">
                {t.ctaBody}
              </p>
              <Button
                size="lg"
                className="btn-glow btn-shine mt-10 inline-flex h-12 items-center justify-center gap-2 rounded-full px-8 text-base"
                render={<a href="/login" />}
                nativeButton={false}
              >
                {t.ctaBtn}
                <ArrowRightIcon className="size-4 shrink-0" />
              </Button>
              <p className="mt-5 text-xs text-muted-foreground">{t.footerRight}</p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  )
}

export default HomePage
