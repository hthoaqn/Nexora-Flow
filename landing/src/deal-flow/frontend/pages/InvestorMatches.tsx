// @ts-nocheck
'use client'

/**
 * Startup ↔ Investor matching — feature-flagged.
 * Reuses MatchingService via investor→partner adapter; does not alter partner matches.
 */

import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Sparkles,
  RefreshCw,
  Handshake,
  Building2,
  ArrowRight,
} from 'lucide-react'
import { useAuthStore } from '../store/useAuthStore'
import { useStartupStore } from '../store/useStartupStore'
import { usePortalI18n } from '../i18n'
import { isInvestorPipelineEnabled } from '@/investor/flags'
import {
  runInvestorMatching,
  listInvestorMatches,
  startupExpressInterest,
} from '@/investor/lib/evaluationStore'
import { DemoDataBadge } from '@/investor/components/DemoDataBadge'
import type { InvestorMatch } from '@/investor/types'
import {
  PortalHero,
  PortalSection,
  PortalEmpty,
  SoftButton,
} from '../components/PortalUI'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { cn } from '@/lib/utils'

function fill(template: string, vars: Record<string, string | number>) {
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v)),
    template,
  )
}

export default function InvestorMatches() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { confirmedProfile, setConfirmedProfile } = useStartupStore()
  const { t } = usePortalI18n()
  const inv = t.inv
  const enabled = isInvestorPipelineEnabled()

  const [matches, setMatches] = useState<InvestorMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)

  const startupId = user?.id || 'anon'

  const loadProfileIfNeeded = async () => {
    if (confirmedProfile) return confirmedProfile
    try {
      const { api } = await import('../api')
      const res = await api.get('/startup/profile')
      if (res.data?.success && res.data.data) {
        setConfirmedProfile(res.data.data)
        return res.data.data
      }
    } catch {
      /* ignore */
    }
    return null
  }

  const refresh = () => {
    setMatches(listInvestorMatches(startupId))
    setLoading(false)
  }

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }
    refresh()
  }, [enabled, startupId])

  const onRun = async () => {
    const profile = await loadProfileIfNeeded()
    if (!profile) {
      toast.error(inv.needProfile)
      navigate('/setup')
      return
    }
    setRunning(true)
    try {
      const next = runInvestorMatching(startupId, profile)
      setMatches(next)
      toast.success(fill(inv.scoredOk, { n: next.length }))
    } finally {
      setRunning(false)
    }
  }

  const onInterest = (m: InvestorMatch) => {
    const updated = startupExpressInterest(m.id, startupId)
    if (!updated) return
    refresh()
    if (updated.status === 'mutual_match') {
      toast.success(inv.mutualOk)
    } else {
      toast.success(inv.interestOk)
    }
  }

  const statusLabel = (status: string) =>
    inv.matchStatus[status] || status.replace(/_/g, ' ')

  if (!enabled) {
    return (
      <PortalEmpty
        icon={<Sparkles className="size-5" />}
        title={inv.disabledTitle}
        description={inv.disabledDesc}
      />
    )
  }

  return (
    <div className="space-y-5">
      <PortalHero
        eyebrow={
          <>
            <Handshake className="size-3" />
            {inv.eyebrow}
          </>
        }
        title={inv.matchesTitle}
        description={inv.matchesLead}
        actions={
          <>
            <SoftButton
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={() => navigate('/evaluations')}
            >
              {inv.myCases}
              <ArrowRight className="size-3.5" />
            </SoftButton>
            <SoftButton
              size="sm"
              className="rounded-full"
              disabled={running}
              onClick={() => void onRun()}
            >
              <RefreshCw className={cn('size-3.5', running && 'animate-spin')} />
              {running ? inv.scoring : inv.runMatch}
            </SoftButton>
          </>
        }
      />

      <Alert className="border-primary/25 bg-primary/5">
        <Building2 className="size-4 text-primary" />
        <AlertTitle>{inv.noReplaceTitle}</AlertTitle>
        <AlertDescription className="text-xs">{inv.noReplaceBody}</AlertDescription>
      </Alert>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t.loading}</p>
      ) : matches.length === 0 ? (
        <PortalEmpty
          icon={<Handshake className="size-5" />}
          title={inv.emptyTitle}
          description={inv.emptyDesc}
          action={
            <SoftButton size="sm" onClick={() => void onRun()}>
              {inv.runCta}
            </SoftButton>
          }
        />
      ) : (
        <PortalSection
          title={inv.rankedTitle}
          description={fill(inv.rankedMeta, { n: matches.length })}
        >
          <div className="flex flex-col gap-3">
            {matches.map((m) => (
              <div
                key={m.id}
                className="flex flex-col gap-3 rounded-xl border bg-card/60 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">
                      {m.investor?.name || m.investorId}
                    </p>
                    {m.is_demo || m.investor?.is_demo ? <DemoDataBadge /> : null}
                    <Badge variant="outline" className="text-[10px]">
                      {statusLabel(m.status)}
                    </Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {m.investor?.investmentThesis}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(m.investor?.priorityIndustries || []).slice(0, 4).map((i) => (
                      <Badge key={i} variant="secondary" className="text-[10px]">
                        {i}
                      </Badge>
                    ))}
                    <Badge variant="outline" className="text-[10px]">
                      ${m.investor?.ticketMin?.toLocaleString()}–
                      {m.investor?.ticketMax?.toLocaleString()}
                    </Badge>
                  </div>
                  {m.matchedReasons[0] ? (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {m.matchedReasons[0]}
                    </p>
                  ) : null}
                  <div className="mt-2 flex items-center gap-2">
                    <Progress value={m.totalScore} className="h-1.5 max-w-[140px]" />
                    <span className="text-sm font-bold tabular-nums text-primary">
                      {m.totalScore}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {m.status === 'suggested' || m.status === 'investor_interested' ? (
                    <Button
                      size="sm"
                      className="rounded-full"
                      onClick={() => onInterest(m)}
                    >
                      {inv.imInterested}
                    </Button>
                  ) : null}
                  {m.status === 'mutual_match' || m.status === 'evaluation_started' ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="rounded-full"
                      onClick={() => navigate('/evaluations')}
                    >
                      {inv.openCase}
                      <ArrowRight className="size-3.5" />
                    </Button>
                  ) : null}
                  {m.status === 'startup_interested' ? (
                    <Badge variant="secondary">{inv.waitingInv}</Badge>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </PortalSection>
      )}
    </div>
  )
}
