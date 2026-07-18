// @ts-nocheck
'use client'

/**
 * Module 7 — Business simulation (3 steps, branching, open text).
 * Effects hidden until submit (startup view).
 */

import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Gamepad2, CheckCircle } from 'lucide-react'
import { useAuthStore } from '../store/useAuthStore'
import { useStartupStore } from '../store/useStartupStore'
import { usePortalI18n } from '../i18n'
import {
  getEvaluationCase,
  startSimulation,
  submitSimulationStep,
} from '@/investor/lib/evaluationStore'
import { DemoDataBadge } from '@/investor/components/DemoDataBadge'
import {
  PortalHero,
  SoftButton,
  PortalEmpty,
} from '../components/PortalUI'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { cn } from '@/lib/utils'

export default function SimulationRound() {
  const { caseId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { confirmedProfile } = useStartupStore()
  const { lang } = usePortalI18n()
  const tx = (vi, en) => (lang === 'en' ? en : vi)

  const [item, setItem] = useState(null)
  const [choice, setChoice] = useState(null)
  const [openText, setOpenText] = useState('')
  const [busy, setBusy] = useState(false)

  const reload = () => {
    if (!caseId || !user?.id) return
    let c = getEvaluationCase(caseId, user.id)
    if (c && !c.simulation) {
      c = startSimulation(caseId, user.id, confirmedProfile)
    }
    setItem(c)
  }

  useEffect(() => {
    reload()
  }, [caseId, user?.id])

  if (!item?.simulation) {
    return (
      <PortalEmpty
        title={tx('Chưa có lượt mô phỏng', 'No simulation run')}
        action={
          <SoftButton size="sm" onClick={() => navigate(`/evaluations/${caseId}`)}>
            {tx('Quay lại', 'Back')}
          </SoftButton>
        }
      />
    )
  }

  const sim = item.simulation
  const current =
    sim.steps.find((s) => !s.submittedAt) || sim.steps[sim.steps.length - 1]
  const done = sim.status === 'completed'

  const onSubmit = () => {
    if (!current) return
    setBusy(true)
    try {
      if (current.kind === 'choice' && !choice) {
        toast.error(tx('Chọn một phương án', 'Pick an option'))
        return
      }
      if (current.kind === 'open_text' && !openText.trim()) {
        toast.error(tx('Nhập câu trả lời', 'Enter your answer'))
        return
      }
      const next = submitSimulationStep(
        caseId,
        user.id,
        current.step,
        {
          choiceId: choice || undefined,
          openText: openText || undefined,
        },
        sim.version,
      )
      if (next) {
        setItem(next)
        setChoice(null)
        setOpenText('')
        toast.success(
          next.simulation?.status === 'completed'
            ? tx('Hoàn tất mô phỏng', 'Simulation complete')
            : tx('Đã nộp bước', 'Step submitted'),
        )
      }
    } catch (e) {
      if (String(e.message).includes('CONFLICT')) {
        toast.error(tx('Xung đột phiên bản — tải lại', 'Version conflict — reload'))
        reload()
      } else toast.error(String(e.message || e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <PortalHero
        eyebrow={
          <>
            <Gamepad2 className="size-3" />
            {tx('Vòng 2 · Mô phỏng kinh doanh', 'Round 2 · Business simulation')}
          </>
        }
        title={item.investor?.name || 'Simulation'}
        description={tx(
          `Loại hình: ${sim.businessType} · v${sim.version} · effects ẩn đến khi nộp`,
          `Type: ${sim.businessType} · v${sim.version} · effects hidden until submit`,
        )}
        actions={
          <>
            {item.is_demo ? <DemoDataBadge /> : null}
            <SoftButton
              size="sm"
              variant="outline"
              onClick={() => navigate(`/evaluations/${caseId}`)}
            >
              <ArrowLeft className="size-3.5" />
              {tx('Case', 'Case')}
            </SoftButton>
          </>
        }
      />

      <div className="flex flex-wrap gap-1.5">
        {sim.steps.map((s) => (
          <Badge
            key={s.step}
            variant={s.submittedAt ? 'default' : s.step === current?.step ? 'secondary' : 'outline'}
          >
            {tx('Bước', 'Step')} {s.step}
            {s.submittedAt ? ' ✓' : ''}
          </Badge>
        ))}
      </div>

      {done ? (
        <Alert className="border-emerald-500/30 bg-emerald-500/5">
          <CheckCircle className="size-4" />
          <AlertTitle>
            {tx('Điểm mô phỏng', 'Simulation score')}: {sim.score}
          </AlertTitle>
          <AlertDescription className="text-xs">
            {tx(
              'Breakdown 10 tiêu chí đã mở (sau khi nộp). Tiếp theo: Vòng 3 minh chứng.',
              '10-metric breakdown unlocked after submit. Next: Round 3 proof.',
            )}
            <div className="mt-2 flex flex-wrap gap-1">
              {Object.entries(sim.scoreBreakdown || {}).map(([k, v]) => (
                <Badge key={k} variant="outline" className="text-[10px]">
                  {k}: {v}
                </Badge>
              ))}
            </div>
            <Button
              size="sm"
              className="mt-3 rounded-full"
              onClick={() => navigate(`/evaluations/${caseId}/proof`)}
            >
              {tx('Sang vòng 3', 'Go to Round 3')}
            </Button>
          </AlertDescription>
        </Alert>
      ) : current ? (
        <div className="rounded-2xl border p-4 sm:p-5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">
            {tx('Bước', 'Step')} {current.step}/3
          </p>
          <h2 className="mt-1 font-heading text-lg font-semibold">
            {current.title}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{current.context}</p>
          <p className="mt-3 text-sm font-medium">{current.challenge}</p>

          {current.kind === 'choice' ? (
            <div className="mt-4 space-y-2">
              {(current.choices || []).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setChoice(c.id)}
                  className={cn(
                    'w-full rounded-xl border p-3 text-left transition-colors',
                    choice === c.id
                      ? 'border-primary bg-primary/5'
                      : 'hover:border-primary/30',
                  )}
                >
                  <p className="text-sm font-semibold">
                    {c.id}. {c.label}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {c.tradeOffs?.join(' · ')}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <Textarea
              className="mt-4 min-h-28"
              value={openText}
              onChange={(e) => setOpenText(e.target.value)}
              placeholder={tx(
                'Kế hoạch 2 quý: metric · owner · risk · kill switch…',
                '2-quarter plan: metric · owner · risk · kill switch…',
              )}
            />
          )}

          <Button
            className="mt-4 rounded-full"
            disabled={busy}
            onClick={onSubmit}
          >
            {tx('Nộp quyết định', 'Submit decision')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
