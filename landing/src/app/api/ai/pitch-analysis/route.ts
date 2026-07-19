/**
 * POST /api/ai/pitch-analysis
 * Analyze pitch/interview transcript against investor or partner JD.
 *
 * Body: { transcript, lang?, durationSec?, jd?, useLlm? }
 */

import { NextRequest, NextResponse } from 'next/server'
import { ollamaChat, ollamaHealth, stripThinkTags } from '@/lib/ai/ollama'
import {
  analyzePitchTranscript,
  buildPitchAnalysisPrompt,
  parsePitchLlmJson,
  type PitchJd,
} from '@/lib/pitch-analysis'

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

  const transcript = String(body?.transcript || '').trim()
  if (!transcript || transcript.length < 8) {
    return NextResponse.json(
      {
        success: false,
        message:
          body?.lang === 'en'
            ? 'Transcript is empty — record again or paste text.'
            : 'Transcript trống — quay lại hoặc dán nội dung nói.',
      },
      { status: 400 },
    )
  }

  const lang = body?.lang === 'en' ? 'en' : 'vi'
  const durationSec =
    body?.durationSec != null ? Number(body.durationSec) : undefined
  const jd = (body?.jd || body?.investor || body?.partner || null) as PitchJd | null

  const heuristic = analyzePitchTranscript({
    transcript,
    lang,
    jd,
    durationSec,
  })

  let result = heuristic
  let llmError: string | null = null
  let llmModel: string | null = null
  const wantLlm = body?.useLlm !== false

  if (wantLlm) {
    const health = await ollamaHealth()
    if (health.ok) {
      try {
        const prompt = buildPitchAnalysisPrompt({
          lang,
          transcript,
          jd,
          heuristic,
          durationSec,
        })
        const res = await ollamaChat({
          messages: [
            {
              role: 'system',
              content:
                lang === 'vi'
                  ? 'Bạn trả lời JSON hợp lệ, không bọc markdown.'
                  : 'Reply with valid JSON only, no markdown fences.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
        })
        const raw = stripThinkTags(res.content)
        result = parsePitchLlmJson(raw, heuristic, lang)
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
      analysis: result,
      transcript,
      llmModel,
      llmError,
      source: result.source,
    },
    message: 'ok',
  })
}
