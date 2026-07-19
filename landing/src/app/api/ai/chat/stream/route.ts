/**
 * POST /api/ai/chat/stream
 * SSE stream of assistant tokens (Ollama DeepSeek R1).
 * Event format: data: {"type":"delta","text":"..."}\n\n
 *               data: {"type":"done"}\n\n
 *               data: {"type":"error","message":"..."}\n\n
 */

import { NextRequest } from 'next/server'
import {
  ollamaChatStream,
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

const SYSTEM_VI = `Bạn là Nexora Match Coach. Giải thích matching, điểm mạnh/yếu, gợi ý cải thiện hồ sơ. Tiếng Việt, rõ ràng.`
const SYSTEM_EN = `You are Nexora Match Coach. Explain matching scores, strengths/weaknesses, profile improvements. Clear English.`

function buildOfflineMessage(body: any, messagesIn: any[], lang: 'vi' | 'en') {
  const lastUser = [...messagesIn]
    .reverse()
    .find((m: any) => m.role === 'user')
  const q = String(lastUser?.content || '')
  const ctx = typeof body?.context === 'string' ? body.context : ''
  let insight = null as ReturnType<typeof analyzeMatch> | null

  if (body?.match) {
    const match = body.match
    insight = analyzeMatch({
      totalScore: match?.totalScore,
      scoreBreakdown: match?.scoreBreakdown || match?.breakdown,
      matchedReasons: match?.matchedReasons,
      risks: match?.risks,
      missingRequirements: match?.missingRequirements,
      recommendation: match?.recommendation,
      startupName: body?.startupProfile?.startupName,
      partnerName: match?.partner?.organizationName,
    })
  } else if (ctx && /Total score:\s*\d+/i.test(ctx)) {
    const total = Number((ctx.match(/Total score:\s*(\d+)/i) || [])[1] || 0)
    const dims: Record<string, number> = {}
    for (const m of ctx.matchAll(
      /-\s*(industry|technology|stage|partnership|funding|market|capability):\s*(\d+)/gi,
    )) {
      dims[m[1].toLowerCase()] = Number(m[2])
    }
    insight = analyzeMatch({ totalScore: total, scoreBreakdown: dims as any })
  }

  if (insight) {
    const core = heuristicChatReply({
      lang,
      question: q,
      insight,
      reasons: body?.match?.matchedReasons,
      risks: body?.match?.risks,
      recommendation: body?.match?.recommendation,
    })
    return (
      core +
      (lang === 'vi'
        ? `\n\n---\n⚠️ Ollama offline — coach **heuristic**. Bật: \`ollama pull ${ollamaConfig().model} && ollama serve\``
        : `\n\n---\n⚠️ Ollama offline — **heuristic** coach. Enable: \`ollama pull ${ollamaConfig().model} && ollama serve\``)
    )
  }

  return lang === 'vi'
    ? `Ollama offline. Chạy: ollama pull ${ollamaConfig().model} && ollama serve\nMở tab **Sơ đồ & phân tích** để xem điểm mạnh/yếu.`
    : `Ollama offline. Run: ollama pull ${ollamaConfig().model} && ollama serve\nUse **Diagram & analysis** for strengths/weaknesses.`
}

export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
    })
  }

  const messagesIn = Array.isArray(body?.messages) ? body.messages : []
  if (!messagesIn.length) {
    return new Response(JSON.stringify({ error: 'messages required' }), {
      status: 400,
    })
  }

  const lang = body?.lang === 'en' ? 'en' : 'vi'
  const health = await ollamaHealth()
  const encoder = new TextEncoder()

  if (!health.ok) {
    const msg = buildOfflineMessage(body, messagesIn, lang)
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'delta', text: msg })}\n\n`,
          ),
        )
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: 'done',
              content: msg,
              offline: true,
              source: 'heuristic',
            })}\n\n`,
          ),
        )
        controller.close()
      },
    })
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    })
  }

  const ctx =
    typeof body?.context === 'string'
      ? body.context
      : body?.context
        ? JSON.stringify(body.context).slice(0, 8000)
        : ''

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        (lang === 'vi' ? SYSTEM_VI : SYSTEM_EN) +
        (ctx ? `\n\n--- MATCH CONTEXT ---\n${ctx}` : ''),
    },
    ...messagesIn
      .filter((m: any) => m?.content && m.role !== 'system')
      .map((m: any) => ({
        role: (m.role === 'assistant' ? 'assistant' : 'user') as
          | 'user'
          | 'assistant',
        content: String(m.content).slice(0, 12_000),
      }))
      .slice(-40),
  ]

  const abort = new AbortController()
  req.signal.addEventListener('abort', () => abort.abort())

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(obj)}\n\n`),
        )
      }
      try {
        let full = ''
        for await (const delta of ollamaChatStream({
          messages,
          model: body?.model,
          temperature: body?.temperature,
          signal: abort.signal,
        })) {
          full += delta
          // stream raw deltas; client may strip think tags at end
          send({ type: 'delta', text: delta })
        }
        send({
          type: 'done',
          content: stripThinkTags(full),
          model: ollamaConfig().model,
          offline: false,
        })
      } catch (e) {
        send({
          type: 'error',
          message: e instanceof Error ? e.message : 'stream failed',
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
