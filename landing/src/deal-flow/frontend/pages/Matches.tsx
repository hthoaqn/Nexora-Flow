// @ts-nocheck
'use client'

import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useStartupStore } from '../store/useStartupStore'
import { useAuthStore } from '../store/useAuthStore'
import { usePortalI18n } from '../i18n'
import { toast } from 'sonner'
import { isInvestorPipelineEnabled } from '@/investor/flags'
import {
  isPrepDone,
  markPrepOpenedMatching,
} from '../lib/prepReadiness'
import {
  Sparkles,
  Search,
  Award,
  CheckCircle,
  MessageSquare,
  Send,
  HelpCircle,
  RefreshCw,
  GitCompareArrows,
  Handshake,
  Lightbulb,
  Bot,
  BarChart3,
} from 'lucide-react'
import { MatchInsightPanel } from '@/components/matching/MatchInsightPanel'
import { MatchChatbot } from '@/components/matching/MatchChatbot'
import { analyzeMatch } from '@/lib/match-analysis'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  PortalHero,
  PortalSection,
  PortalEmpty,
  SoftButton,
  DemoBadge,
  PortalProgress,
} from '../components/PortalUI'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const SCORE_KEYS = [
  { key: 'industry', w: '25%' },
  { key: 'technology', w: '15%' },
  { key: 'stage', w: '15%' },
  { key: 'partnership', w: '15%' },
  { key: 'funding', w: '10%' },
  { key: 'market', w: '10%' },
  { key: 'capability', w: '10%' },
]

function scorePct(m, key) {
  const b = m.scoreBreakdown || m.breakdown || {}
  let raw = Number(b[key] ?? 0)
  if (!Number.isFinite(raw)) return 0
  if (raw > 0 && raw <= 1) raw *= 100
  while (raw > 100) raw /= 100
  return Math.max(0, Math.min(100, Math.round(raw)))
}

export default function Matches() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { confirmedProfile, isDirty } = useStartupStore()
  const { t, lang } = usePortalI18n()

  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [showPrepHint, setShowPrepHint] = useState(false)
  const [search, setSearch] = useState('')
  const [orgType, setOrgType] = useState('')
  const [partnershipType, setPartnershipType] = useState('')
  const [sortBy, setSortBy] = useState('score')
  const [minScore, setMinScore] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [connectingMatch, setConnectingMatch] = useState(null)
  const [analyzingMatch, setAnalyzingMatch] = useState(null)
  const [insightTab, setInsightTab] = useState('analysis')
  const [introMessage, setIntroMessage] = useState('')
  const [sendingConnection, setSendingConnection] = useState(false)
  const [recalculating, setRecalculating] = useState(false)
  /** partnerId → connection status (prevents re-send spam) */
  const [connectedByPartner, setConnectedByPartner] = useState({})

  const str = (v) => String(v ?? '').toLowerCase()

  /** Dedupe match rows by partner id (re-run match can pile duplicates) */
  const dedupeMatches = (list) => {
    const map = new Map()
    for (const m of list || []) {
      const pid = m?.partner?.id || m?.partnerId || m?.id
      if (!pid) continue
      const prev = map.get(pid)
      if (!prev || (Number(m.totalScore) || 0) >= (Number(prev.totalScore) || 0)) {
        map.set(pid, m)
      }
    }
    return Array.from(map.values())
  }

  const fetchExistingConnections = async () => {
    try {
      const res = await api.get('/startup/connections')
      if (!res.data?.success) return
      const raw = res.data.data
      const list = Array.isArray(raw) ? raw : raw?.items || []
      const map = {}
      for (const c of list) {
        const pid = String(c.partnerId || c.partner?.id || '')
        if (!pid) continue
        // Prefer accepted over pending
        const st = String(c.status || 'pending').toLowerCase()
        if (!map[pid] || st === 'accepted') map[pid] = st
      }
      setConnectedByPartner(map)
    } catch {
      /* ignore */
    }
  }

  const fetchMatches = async () => {
    setLoading(true)
    try {
      const res = await api.get('/startup/matches')
      if (res.data?.success) {
        setMatches(dedupeMatches(Array.isArray(res.data.data) ? res.data.data : []))
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleRecalculateMatches = async () => {
    if (!confirmedProfile) {
      toast.error(t.matches.emptyDesc)
      return
    }
    if (user?.id) markPrepOpenedMatching(user.id)
    setRecalculating(true)
    const toastId = toast.loading(t.matches.running)
    try {
      const res = await api.post('/startup/matches/run', { confirmedProfile })
      if (res.data?.success) {
        toast.success(t.matches.run, { id: toastId })
        setMatches(dedupeMatches(Array.isArray(res.data.data) ? res.data.data : []))
        setShowPrepHint(false)
      }
    } catch (e) {
      const code = e?.response?.data?.error?.code || ''
      const msg =
        code === 'PROFILE_NOT_CONFIRMED'
          ? lang === 'en'
            ? 'Confirm your official profile first (Profile page).'
            : 'Hãy xác nhận hồ sơ chính thức trước (mục Hồ sơ).'
          : e?.response?.data?.message || t.matches.emptyTitle
      toast.error(msg, { id: toastId })
    } finally {
      setRecalculating(false)
    }
  }

  useEffect(() => {
    fetchMatches()
    fetchExistingConnections()
  }, [])

  useEffect(() => {
    // Soft nudge: profile exists, never ran prep, no matches yet
    if (!confirmedProfile || !user?.id) {
      setShowPrepHint(false)
      return
    }
    if (matches.length > 0 || isPrepDone(user.id)) {
      setShowPrepHint(false)
      return
    }
    setShowPrepHint(true)
  }, [confirmedProfile, user?.id, matches.length])

  const handleOpenConnect = (m) => {
    const partnerId = m.partner?.id || m.partnerId
    const existing = partnerId ? connectedByPartner[String(partnerId)] : null
    if (existing) {
      toast.message(
        lang === 'en'
          ? `Already connected (${existing}). Open Connections.`
          : `Đã kết nối rồi (${existing === 'accepted' ? 'đã chấp nhận' : 'đang chờ'}). Mở mục Kết nối.`,
      )
      navigate('/connections')
      return
    }
    setConnectingMatch(m)
    const org = m.partner?.organizationName || (lang === 'en' ? 'partner' : 'đối tác')
    const name = confirmedProfile?.startupName || (lang === 'en' ? 'a startup' : 'một startup')
    const score = m.totalScore ?? 0
    setIntroMessage(
      lang === 'en'
        ? `Hi ${org},\n\nWe are ${name} — fit score ${score}% on Nexora Flow.\n\nWe would love to explore a partnership.`
        : `Xin chào ${org},\n\nChúng tôi là ${name} — độ khớp ${score}% trên Nexora Flow.\n\nMong được trao đổi cơ hội hợp tác.`,
    )
  }

  const handleSendConnection = async () => {
    if (!connectingMatch || sendingConnection) return
    if (!introMessage.trim()) {
      toast.error(t.matches.message)
      return
    }
    const partnerId = connectingMatch.partner?.id || connectingMatch.partnerId
    if (!partnerId) return
    if (connectedByPartner[String(partnerId)]) {
      toast.message(
        lang === 'en'
          ? 'Already sent to this partner.'
          : 'Đã gửi lời giới thiệu tới đối tác này rồi.',
      )
      setConnectingMatch(null)
      navigate('/connections')
      return
    }
    setSendingConnection(true)
    try {
      const res = await api.post('/startup/connections', {
        partnerId,
        matchId: connectingMatch.id,
        matchScore: connectingMatch.totalScore,
        message: introMessage,
      })
      if (res.data?.success) {
        toast.success(t.matches.send)
        setConnectedByPartner((prev) => ({
          ...prev,
          [String(partnerId)]: 'pending',
        }))
        setConnectingMatch(null)
        fetchMatches()
        fetchExistingConnections()
      }
    } catch (e) {
      const code = e?.response?.data?.error?.code || ''
      if (code === 'DUPLICATE_CONNECTION' || /already|đã tồn tại|duplicate/i.test(String(e?.response?.data?.message || ''))) {
        toast.message(
          lang === 'en'
            ? 'Connection already exists for this partner.'
            : 'Đã có kết nối với đối tác này.',
        )
        setConnectedByPartner((prev) => ({
          ...prev,
          [String(partnerId)]: 'pending',
        }))
        setConnectingMatch(null)
        navigate('/connections')
      } else {
        toast.error(
          e?.response?.data?.message ||
            (lang === 'en' ? 'Could not send introduction' : 'Không gửi được lời giới thiệu'),
        )
      }
    } finally {
      setSendingConnection(false)
    }
  }

  const filtered = matches.filter((m) => {
    if (!m?.partner) return false
    const p = m.partner
    const q = str(search)
    const okSearch =
      !q ||
      str(p.organizationName).includes(q) ||
      str(p.description).includes(q) ||
      (p.interestedIndustries || []).some((i) => str(i).includes(q)) ||
      (p.interestedTechnologies || []).some((x) => str(x).includes(q))
    const okType = !orgType || p.organizationType === orgType
    const okPart =
      !partnershipType || (p.partnershipTypes || []).includes(partnershipType)
    return okSearch && okType && okPart && (Number(m.totalScore) || 0) >= minScore
  })

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'score') return (Number(b.totalScore) || 0) - (Number(a.totalScore) || 0)
    if (sortBy === 'name')
      return String(a.partner?.organizationName || '').localeCompare(
        String(b.partner?.organizationName || ''),
      )
    return 0
  })

  const pageSize = 6
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const page = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const scoreTone = (score) => {
    if (score >= 80) return 'border-primary/35 bg-primary/12 text-primary'
    if (score >= 60)
      return 'border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-400'
    return 'border-border bg-muted text-muted-foreground'
  }

  const dimLabel = (key) => t.matches.dims[key] || key

  return (
    <div className="space-y-5">
      {showPrepHint ? (
        <Alert className="border-primary/25 bg-primary/5">
          <Lightbulb className="size-4 text-primary" />
          <AlertTitle>
            {lang === 'en'
              ? 'Optional: AI mentor prep first'
              : 'Tùy chọn: Mentor AI chuẩn bị trước'}
          </AlertTitle>
          <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {lang === 'en'
                ? 'Not an interview — get 2–3 improvement tips before partners see your profile. You can still run matching now.'
                : 'Không phải phỏng vấn — nhận 2–3 gợi ý cải thiện trước khi đối tác thấy hồ sơ. Vẫn có thể so khớp ngay.'}
            </span>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-full"
                onClick={() => setShowPrepHint(false)}
              >
                {lang === 'en' ? 'Dismiss' : 'Để sau'}
              </Button>
              <Button
                size="sm"
                className="h-8 rounded-full"
                onClick={() => navigate('/prep')}
              >
                <Lightbulb className="size-3.5" />
                {lang === 'en' ? 'Open prep' : 'Mở chuẩn bị'}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      <PortalHero
        eyebrow={
          <>
            <Sparkles className="size-3" />
            {t.matches.title}
          </>
        }
        title={t.matches.title}
        description={t.matches.lead}
        actions={
          <>
            {isInvestorPipelineEnabled() ? (
              <SoftButton
                size="sm"
                variant="outline"
                onClick={() => navigate('/investor-matches')}
                className="rounded-full"
              >
                <Handshake className="size-3.5" />
                {t.matches.openInvestorMatch}
              </SoftButton>
            ) : null}
            <SoftButton
              size="sm"
              variant="outline"
              onClick={fetchMatches}
              className="rounded-full"
            >
              <RefreshCw className="size-3.5" />
              {t.matches.refresh}
            </SoftButton>
            <SoftButton
              size="sm"
              disabled={recalculating}
              onClick={handleRecalculateMatches}
              className="rounded-full"
            >
              <Sparkles className="size-3.5" />
              {recalculating ? t.matches.running : t.matches.run}
            </SoftButton>
          </>
        }
      />

      {isDirty ? (
        <Alert className="border-amber-500/35 bg-amber-500/10">
          <AlertTitle>{t.matches.dirtyTitle}</AlertTitle>
          <AlertDescription>{t.matches.dirtyBody}</AlertDescription>
        </Alert>
      ) : null}

      <Alert className="border-primary/25 bg-primary/5">
        <GitCompareArrows className="size-4 text-primary" />
        <AlertTitle>{t.matches.twoWayTitle}</AlertTitle>
        <AlertDescription className="text-xs leading-relaxed">
          {t.matches.twoWayBody}
        </AlertDescription>
      </Alert>

      <div className="portal-card p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setCurrentPage(1)
              }}
              className="pl-9"
              placeholder={t.matches.searchPh}
            />
          </div>
          <select
            value={orgType}
            onChange={(e) => {
              setOrgType(e.target.value)
              setCurrentPage(1)
            }}
            className="h-8 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          >
            <option value="">{t.matches.allTypes}</option>
            <option value="corporation">
              {lang === 'en' ? 'Corporate' : 'Doanh nghiệp'}
            </option>
            <option value="investment_fund">
              {lang === 'en' ? 'VC / Fund' : 'Quỹ đầu tư'}
            </option>
            <option value="incubator">
              {lang === 'en' ? 'Incubator' : 'Vườn ươm'}
            </option>
            <option value="innovation_organization">
              {lang === 'en' ? 'Innovation' : 'Tổ chức đổi mới'}
            </option>
          </select>
          <select
            value={partnershipType}
            onChange={(e) => {
              setPartnershipType(e.target.value)
              setCurrentPage(1)
            }}
            className="h-8 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          >
            <option value="">{t.matches.allPartnerships}</option>
            <option value="investment">
              {lang === 'en' ? 'Investment' : 'Đầu tư'}
            </option>
            <option value="pilot">
              {lang === 'en' ? 'Pilot' : 'Thử nghiệm'}
            </option>
            <option value="technology_partnership">
              {lang === 'en' ? 'Tech partnership' : 'Hợp tác công nghệ'}
            </option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="h-8 rounded-lg border border-input bg-transparent px-3 text-sm outline-none dark:bg-input/30"
          >
            <option value="score">{t.matches.sortScore}</option>
            <option value="name">{t.matches.sortName}</option>
          </select>
          <select
            value={minScore}
            onChange={(e) => {
              setMinScore(Number(e.target.value))
              setCurrentPage(1)
            }}
            className="h-8 rounded-lg border border-input bg-transparent px-3 text-sm outline-none dark:bg-input/30"
          >
            <option value={0}>{t.matches.minScore}</option>
            <option value={40}>≥ 40</option>
            <option value={60}>≥ 60</option>
            <option value={80}>≥ 80</option>
          </select>
          <p className="flex items-center text-xs text-muted-foreground sm:justify-end">
            <span className="font-semibold text-foreground tabular-nums">{sorted.length}</span>
            &nbsp;{t.matches.results}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-56 rounded-2xl" />
          ))}
        </div>
      ) : page.length > 0 ? (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {page.map((m) => {
              const partner = m.partner || {}
              const score = Number(m.totalScore) || 0
              const matchedTech = (partner.interestedTechnologies || []).filter(
                (x) =>
                  x != null &&
                  (confirmedProfile?.technologies || []).some((st) => {
                    if (st == null) return false
                    return str(st).includes(str(x)) || str(x).includes(str(st))
                  }),
              )
              const isDemo = partner.isDemo || m.partnerIsDemo

              return (
                <div key={partner.id || m.id} className="portal-card flex flex-col">
                  <div className="flex items-start justify-between gap-3 border-b border-border/70 px-5 py-4">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h3 className="font-heading text-base font-semibold">
                          {partner.organizationName || '—'}
                        </h3>
                        {isDemo ? <DemoBadge label={t.demo} /> : null}
                      </div>
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {partner.description || '—'}
                      </p>
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        <Badge variant="secondary" className="capitalize">
                          {String(partner.organizationType || '—').replace(/_/g, ' ')}
                        </Badge>
                        {(partner.interestedIndustries || []).slice(0, 3).map((ind) => (
                          <Badge key={String(ind)} variant="outline" className="font-normal">
                            {ind}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div
                      className={cn(
                        'inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 font-heading text-sm font-semibold tabular-nums',
                        scoreTone(score),
                      )}
                    >
                      <Award className="size-4" />
                      {score}
                    </div>
                  </div>

                  <div className="space-y-3 px-5 py-4">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
                      {SCORE_KEYS.map(({ key, w }) => {
                        const pct = scorePct(m, key)
                        return (
                          <div key={key} className="min-w-0 space-y-1">
                            <div className="flex items-center justify-between gap-1 text-[10px]">
                              <span className="truncate text-muted-foreground">
                                {dimLabel(key)}
                                <span className="ml-0.5 opacity-60">({w})</span>
                              </span>
                              <span className="tabular-nums font-medium text-foreground">
                                {pct}
                              </span>
                            </div>
                            <PortalProgress value={pct} />
                          </div>
                        )
                      })}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      <CheckCircle className="mr-1 inline size-3 text-primary" />
                      {t.matches.tech}:{' '}
                      <strong className="text-foreground">
                        {matchedTech.join(', ') || '—'}
                      </strong>
                    </p>
                    {(() => {
                      const insight = analyzeMatch({
                        totalScore: score,
                        scoreBreakdown: m.scoreBreakdown || m.breakdown,
                        matchedReasons: m.matchedReasons,
                        risks: m.risks,
                        missingRequirements: m.missingRequirements,
                        recommendation: m.recommendation,
                        startupName: confirmedProfile?.startupName,
                        partnerName: partner.organizationName,
                      })
                      const weak = insight.weaknesses.slice(0, 3)
                      if (!weak.length && score >= 70) return null
                      return (
                        <button
                          type="button"
                          onClick={() => {
                            setAnalyzingMatch(m)
                            setInsightTab('analysis')
                          }}
                          className="w-full rounded-lg border border-amber-500/25 bg-amber-500/5 px-2.5 py-2 text-left transition hover:border-primary/40 hover:bg-primary/5"
                        >
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                            {lang === 'en' ? 'Why this score?' : 'Vì sao điểm này?'}
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                            {lang === 'en' ? insight.summaryEn : insight.summaryVi}
                          </p>
                          {weak.length ? (
                            <p className="mt-1 text-[10px] text-rose-600 dark:text-rose-300">
                              {lang === 'en' ? 'Weak: ' : 'Yếu: '}
                              {weak
                                .map((d) =>
                                  `${lang === 'en' ? d.labelEn : d.labelVi} ${d.score}`,
                                )
                                .join(' · ')}
                            </p>
                          ) : null}
                        </button>
                      )
                    })()}
                  </div>

                  <div className="mt-auto flex flex-wrap items-center justify-end gap-2 border-t border-border/70 px-5 py-3">
                    <SoftButton
                      size="sm"
                      variant="outline"
                      className="rounded-full border-primary/35 bg-primary/10 font-semibold"
                      onClick={() => {
                        setAnalyzingMatch(m)
                        setInsightTab('analysis')
                      }}
                    >
                      <BarChart3 className="size-3.5" />
                      {lang === 'en' ? 'Full analysis' : 'Phân tích đầy đủ'}
                    </SoftButton>
                    <SoftButton
                      size="sm"
                      variant="outline"
                      className="rounded-full"
                      onClick={() => {
                        setAnalyzingMatch(m)
                        setInsightTab('chat')
                      }}
                    >
                      <Bot className="size-3.5" />
                      AI Coach
                    </SoftButton>
                    {(() => {
                      const pid = String(partner.id || m.partnerId || '')
                      const st = pid ? connectedByPartner[pid] : null
                      if (st) {
                        return (
                          <SoftButton
                            size="sm"
                            variant="outline"
                            className="rounded-full"
                            onClick={() => navigate('/connections')}
                          >
                            <CheckCircle className="size-3.5" />
                            {st === 'accepted'
                              ? lang === 'en'
                                ? 'Connected'
                                : 'Đã kết nối'
                              : lang === 'en'
                                ? 'Pending'
                                : 'Đang chờ'}
                          </SoftButton>
                        )
                      }
                      return (
                        <SoftButton
                          size="sm"
                          className="rounded-full"
                          onClick={() => handleOpenConnect(m)}
                        >
                          <MessageSquare className="size-3.5" />
                          {t.matches.connect}
                        </SoftButton>
                      )
                    })()}
                  </div>
                </div>
              )
            })}
          </div>

          {totalPages > 1 ? (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => p - 1)}
              >
                {t.prev}
              </Button>
              <span className="tabular-nums">
                {t.page} {currentPage}
                {t.of}
                {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                {t.next}
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <PortalEmpty
          icon={<HelpCircle className="size-5" />}
          title={t.matches.emptyTitle}
          description={t.matches.emptyDesc}
          action={
            <SoftButton size="sm" onClick={handleRecalculateMatches}>
              {t.matches.runCta}
            </SoftButton>
          }
        />
      )}

      <Dialog open={!!connectingMatch} onOpenChange={(o) => !o && setConnectingMatch(null)}>
        <DialogContent className="sm:max-w-lg" showCloseButton>
          <DialogHeader>
            <DialogTitle>
              {t.matches.connectTitle} ·{' '}
              {connectingMatch?.partner?.organizationName || '—'}
            </DialogTitle>
            <DialogDescription>{t.matches.connectDesc}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>{t.matches.recipient}</Label>
              <Input
                disabled
                value={`${connectingMatch?.partner?.contactEmail || '—'} · ${connectingMatch?.partner?.organizationName || ''}`}
              />
            </div>
            <div className="grid gap-2">
              <Label>{t.matches.message}</Label>
              <Textarea
                rows={7}
                value={introMessage}
                onChange={(e) => setIntroMessage(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">{t.matches.messageHint}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConnectingMatch(null)}>
              {t.cancel}
            </Button>
            <Button disabled={sendingConnection} onClick={handleSendConnection}>
              <Send className="size-3.5" />
              {sendingConnection ? t.matches.sending : t.matches.send}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Full analysis + AI Coach (production) */}
      <Dialog
        open={!!analyzingMatch}
        onOpenChange={(o) => {
          if (!o) {
            setAnalyzingMatch(null)
            setInsightTab('analysis')
          }
        }}
      >
        <DialogContent
          className="flex max-h-[92vh] w-[min(96vw,56rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl"
          showCloseButton
        >
          <DialogHeader className="shrink-0 border-b border-border/70 px-5 py-4 text-left">
            <DialogTitle className="flex flex-wrap items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              {lang === 'en'
                ? 'Full match analysis & AI Coach'
                : 'Phân tích so khớp đầy đủ & AI Coach'}
              <span className="font-normal text-muted-foreground">
                · {analyzingMatch?.partner?.organizationName || '—'}
              </span>
              {analyzingMatch?.totalScore != null ? (
                <Badge variant="secondary" className="tabular-nums">
                  {Number(analyzingMatch.totalScore)}/100
                </Badge>
              ) : null}
            </DialogTitle>
            <DialogDescription>
              {lang === 'en'
                ? '7-dimension diagram, why the score is low, strengths/weaknesses, DeepSeek narrative, and full chat coach.'
                : 'Sơ đồ 7 chiều, vì sao điểm thấp, điểm mạnh/yếu, narrative DeepSeek, và chatbot coach đầy đủ.'}
            </DialogDescription>
          </DialogHeader>

          {analyzingMatch ? (
            <Tabs
              value={insightTab}
              onValueChange={setInsightTab}
              className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden"
            >
              <div className="shrink-0 border-b border-border/60 px-5 py-2">
                <TabsList className="w-full max-w-md">
                  <TabsTrigger value="analysis" className="flex-1 gap-1.5">
                    <BarChart3 className="size-3.5" />
                    {lang === 'en' ? 'Diagram & analysis' : 'Sơ đồ & phân tích'}
                  </TabsTrigger>
                  <TabsTrigger value="chat" className="flex-1 gap-1.5">
                    <Bot className="size-3.5" />
                    AI Coach
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent
                value="analysis"
                className="min-h-0 flex-1 overflow-y-auto px-5 py-4 outline-none"
              >
                <MatchInsightPanel
                  match={analyzingMatch}
                  startupProfile={confirmedProfile}
                  lang={lang === 'en' ? 'en' : 'vi'}
                  autoDeepAnalysis
                  onOpenChat={() => setInsightTab('chat')}
                />
              </TabsContent>

              <TabsContent
                value="chat"
                className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 py-3 outline-none sm:px-5 data-[hidden]:hidden"
              >
                <MatchChatbot
                  match={analyzingMatch}
                  startupProfile={confirmedProfile}
                  className="min-h-0 h-[min(68vh,620px)] flex-1 border-0 shadow-none sm:border"
                />
              </TabsContent>
            </Tabs>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
