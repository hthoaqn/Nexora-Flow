/**
 * Ollama client helpers — DeepSeek R1 offline (or any chat model).
 * Backend can replace these with a shared service later.
 */

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

const DEFAULT_BASE =
  process.env.OLLAMA_BASE_URL ||
  process.env.NEXT_PUBLIC_OLLAMA_BASE_URL ||
  'http://127.0.0.1:11434'

const DEFAULT_MODEL =
  process.env.OLLAMA_MODEL ||
  process.env.NEXT_PUBLIC_OLLAMA_MODEL ||
  'deepseek-r1'

export function ollamaConfig() {
  return {
    baseUrl: DEFAULT_BASE.replace(/\/$/, ''),
    model: DEFAULT_MODEL,
  }
}

export async function ollamaHealth(): Promise<{
  ok: boolean
  models: string[]
  error?: string
}> {
  const { baseUrl } = ollamaConfig()
  try {
    const res = await fetch(`${baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) {
      return { ok: false, models: [], error: `HTTP ${res.status}` }
    }
    const body = (await res.json()) as {
      models?: { name?: string }[]
    }
    const models = (body.models || []).map((m) => String(m.name || '')).filter(Boolean)
    return { ok: true, models }
  } catch (e) {
    return {
      ok: false,
      models: [],
      error: e instanceof Error ? e.message : 'unreachable',
    }
  }
}

/** Non-streaming chat (Ollama /api/chat) */
export async function ollamaChat(input: {
  messages: ChatMessage[]
  model?: string
  temperature?: number
}): Promise<{ content: string; raw?: unknown; model: string }> {
  const { baseUrl, model: defaultModel } = ollamaConfig()
  const model = input.model || defaultModel
  const res = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: input.messages,
      stream: false,
      options: {
        temperature: input.temperature ?? 0.4,
      },
    }),
    signal: AbortSignal.timeout(120_000),
  })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(`Ollama chat failed: ${res.status} ${t.slice(0, 200)}`)
  }
  const body = await res.json()
  const content =
    body?.message?.content ||
    body?.response ||
    body?.choices?.[0]?.message?.content ||
    ''
  return { content: String(content), raw: body, model }
}

/**
 * Streaming chat — yields text chunks.
 * Ollama stream: NDJSON lines with message.content deltas.
 */
export async function* ollamaChatStream(input: {
  messages: ChatMessage[]
  model?: string
  temperature?: number
  signal?: AbortSignal
}): AsyncGenerator<string, void, unknown> {
  const { baseUrl, model: defaultModel } = ollamaConfig()
  const model = input.model || defaultModel
  const res = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: input.messages,
      stream: true,
      options: {
        temperature: input.temperature ?? 0.4,
      },
    }),
    signal: input.signal,
  })
  if (!res.ok || !res.body) {
    const t = await res.text().catch(() => '')
    throw new Error(`Ollama stream failed: ${res.status} ${t.slice(0, 200)}`)
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() || ''
    for (const line of lines) {
      const s = line.trim()
      if (!s) continue
      try {
        const j = JSON.parse(s)
        const piece = j?.message?.content || j?.response || ''
        if (piece) yield String(piece)
      } catch {
        /* skip */
      }
    }
  }
}

/** Strip DeepSeek R1 thinking tags for cleaner UI */
export function stripThinkTags(text: string): string {
  return String(text || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*$/gi, '')
    .trim()
}
