/**
 * POST /api/ai/match-analysis
 * Body: { match, startupProfile?, lang? }
 * Returns structured strengths/weaknesses + optional LLM narrative.
 */

import { NextRequest, NextResponse } from 'next/server'
import { analyzeMatch, buildMatchChatContext } from '@/lib/match-analysis'
import { ollamaChat, ollamaHealth, stripThinkTags } from '@/lib/ai/ollama'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { success: false, message: 'Invalid JSON' },
      { status: 400 },
    )
  }

  const match = body?.match || body
  const lang = body?.lang === 'en' ? 'en' : 'vi'
  const startup = body?.startupProfile || body?.startup || null
  const partner = match?.partner || body?.partner || null

  const insight = analyzeMatch({
    totalScore: match?.totalScore,
    scoreBreakdown: match?.scoreBreakdown || match?.breakdown,
    matchedReasons: match?.matchedReasons || match?.reasons,
    risks: match?.risks,
    missingRequirements: match?.missingRequirements,
    recommendation: match?.recommendation,
    startupName:
      startup?.startupName ||
      match?.startupName ||
      (lang === 'vi' ? 'Startup của bạn' : 'Your startup'),
    partnerName:
      partner?.organizationName ||
      partner?.name ||
      match?.partnerName ||
      'Partner',
  })

  let llmNarrative: string | null = null
  let llmModel: string | null = null
  let llmError: string | null = null

  const wantLlm = body?.useLlm !== false
  if (wantLlm) {
    const health = await ollamaHealth()
    if (health.ok) {
      try {
        const ctx = buildMatchChatContext({
          lang,
          insight,
          startup,
          partner,
          reasons: match?.matchedReasons,
          risks: match?.risks,
          recommendation: match?.recommendation,
        })
        const prompt =
          lang === 'vi'
            ? `Phân tích ngắn (tối đa 250 từ) cho founder:
1) Vì sao điểm tổng ${insight.totalScore}
2) 2–3 điểm mạnh
3) 2–3 điểm yếu + cách cải thiện hồ sơ
4) Có nên gửi intro ngay không
Dùng tiếng Việt, gạch đầu dòng rõ ràng.`
            : `Short analysis (max 250 words) for the founder:
1) Why total score is ${insight.totalScore}
2) 2–3 strengths
3) 2–3 weaknesses + how to improve profile
4) Whether to send an intro now
Bullet points, clear English.`

        const res = await ollamaChat({
          messages: [
            { role: 'system', content: ctx },
            { role: 'user', content: prompt },
          ],
          temperature: 0.35,
        })
        llmNarrative = stripThinkTags(res.content)
        llmModel = res.model
      } catch (e) {
        llmError = e instanceof Error ? e.message : 'llm failed'
      }
    } else {
      llmError = health.error || 'ollama offline'
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      insight,
      llmNarrative,
      llmModel,
      llmError,
      source: llmNarrative ? 'heuristic+ollama' : 'heuristic',
    },
  })
}
