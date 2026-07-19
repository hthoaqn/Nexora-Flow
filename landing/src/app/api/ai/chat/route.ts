/**
 * POST /api/ai/chat
 * Full chat completion (non-stream) for Match Coach chatbot.
 *
 * Body:
 * {
 *   messages: { role, content }[],
 *   context?: string | object,  // match analysis context
 *   model?: string,
 *   temperature?: number,
 *   lang?: 'vi'|'en'
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  ollamaChat,
  ollamaConfig,
  ollamaHealth,
  stripThinkTags,
  type ChatMessage,
} from '@/lib/ai/ollama'
import {
  analyzeMatch,
  heuristicChatReply,
} from '@/lib/match-analysis'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

const SYSTEM_VI = `Bạn là "Nexora Match Coach" — chatbot cố vấn so khớp deal-flow.
Nhiệm vụ: giải thích điểm số, điểm mạnh/yếu, hướng dẫn cải thiện hồ sơ startup, soạn intro.
Phong cách: rõ ràng, có cấu trúc, actionable. Không bịa số liệu ngoài context.
Nếu thiếu thông tin, hỏi lại ngắn gọn.`

const SYSTEM_EN = `You are "Nexora Match Coach" — a deal-flow matching advisor chatbot.
Explain scores, strengths/weaknesses, profile improvements, and intro drafts.
Be clear, structured, actionable. Do not invent numbers outside context.
If info is missing, ask a short clarifying question.`

function offlineCoachReply(body: any, messagesIn: any[], lang: 'vi' | 'en') {
  const lastUser = [...messagesIn]
    .reverse()
    .find((m: any) => m.role === 'user')
  const q = String(lastUser?.content || '')
  const match = body?.match || null
  const insight =
    body?.insight ||
    (match
      ? analyzeMatch({
          totalScore: match?.totalScore,
          scoreBreakdown: match?.scoreBreakdown || match?.breakdown,
          matchedReasons: match?.matchedReasons,
          risks: match?.risks,
          missingRequirements: match?.missingRequirements,
          recommendation: match?.recommendation,
          startupName: body?.startupProfile?.startupName,
          partnerName: match?.partner?.organizationName,
        })
      : null)

  // Prefer structured heuristic from context string or match object
  if (insight) {
    const core = heuristicChatReply({
      lang,
      question: q,
      insight,
      reasons: match?.matchedReasons,
      risks: match?.risks,
      recommendation: match?.recommendation,
      startupName: body?.startupProfile?.startupName,
      partnerName: match?.partner?.organizationName,
    })
    const note =
      lang === 'vi'
        ? `\n\n---\n⚠️ Ollama offline — đang dùng **coach heuristic**. Bật \`${ollamaConfig().model}\` tại \`${ollamaConfig().baseUrl}\` để chat AI sâu hơn:\n\`ollama pull deepseek-r1 && ollama serve\``
        : `\n\n---\n⚠️ Ollama offline — **heuristic coach**. Enable \`${ollamaConfig().model}\` at \`${ollamaConfig().baseUrl}\`:\n\`ollama pull deepseek-r1 && ollama serve\``
    return core + note
  }

  // Parse scores from free-text context if present
  const ctx =
    typeof body?.context === 'string' ? body.context : ''
  if (ctx && /Total score:\s*\d+/i.test(ctx)) {
    const total = Number((ctx.match(/Total score:\s*(\d+)/i) || [])[1] || 0)
    const dims: Partial<Record<string, number>> = {}
    for (const m of ctx.matchAll(
      /-\s*(industry|technology|stage|partnership|funding|market|capability):\s*(\d+)/gi,
    )) {
      dims[m[1].toLowerCase()] = Number(m[2])
    }
    const insightFromCtx = analyzeMatch({
      totalScore: total,
      scoreBreakdown: dims as any,
    })
    return (
      heuristicChatReply({
        lang,
        question: q,
        insight: insightFromCtx,
      }) +
      (lang === 'vi'
        ? `\n\n_(Offline heuristic từ MATCH CONTEXT)_`
        : `\n\n_(Offline heuristic from MATCH CONTEXT)_`)
    )
  }

  return lang === 'vi'
    ? `⚠️ Ollama offline.\n\nModel: **${ollamaConfig().model}** @ \`${ollamaConfig().baseUrl}\`\n\`\`\`\nollama pull deepseek-r1\nollama serve\n\`\`\`\n\nMở tab **Sơ đồ & phân tích** để xem điểm mạnh/yếu 7 chiều.`
    : `⚠️ Ollama offline.\n\nModel: **${ollamaConfig().model}** @ \`${ollamaConfig().baseUrl}\`\n\`\`\`\nollama pull deepseek-r1\nollama serve\n\`\`\`\n\nUse the **Diagram & analysis** tab for 7-dimension breakdown.`
}

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

  const messagesIn = Array.isArray(body?.messages) ? body.messages : []
  if (!messagesIn.length) {
    return NextResponse.json(
      { success: false, message: 'messages required' },
      { status: 400 },
    )
  }

  const lang = body?.lang === 'en' ? 'en' : 'vi'
  const health = await ollamaHealth()
  if (!health.ok) {
    const fallback = offlineCoachReply(body, messagesIn, lang)
    return NextResponse.json({
      success: true,
      data: {
        message: { role: 'assistant', content: fallback },
        model: null,
        offline: true,
        source: 'heuristic',
      },
    })
  }

  const ctx =
    typeof body?.context === 'string'
      ? body.context
      : body?.context
        ? JSON.stringify(body.context).slice(0, 8000)
        : ''

  const system: ChatMessage = {
    role: 'system',
    content:
      (lang === 'vi' ? SYSTEM_VI : SYSTEM_EN) +
      (ctx ? `\n\n--- MATCH CONTEXT ---\n${ctx}` : ''),
  }

  const messages: ChatMessage[] = [
    system,
    ...messagesIn
      .filter((m: any) => m && m.content && m.role !== 'system')
      .map((m: any) => ({
        role: (m.role === 'assistant' ? 'assistant' : 'user') as
          | 'user'
          | 'assistant',
        content: String(m.content).slice(0, 12_000),
      }))
      .slice(-40),
  ]

  try {
    const res = await ollamaChat({
      messages,
      model: body?.model,
      temperature: body?.temperature,
    })
    return NextResponse.json({
      success: true,
      data: {
        message: {
          role: 'assistant',
          content: stripThinkTags(res.content),
        },
        model: res.model,
        offline: false,
      },
    })
  } catch (e) {
    return NextResponse.json(
      {
        success: false,
        message: e instanceof Error ? e.message : 'chat failed',
        error: { code: 'OLLAMA_CHAT_FAILED' },
      },
      { status: 502 },
    )
  }
}
