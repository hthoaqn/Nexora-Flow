'use client'

/**
 * Full A–Z Match Coach chatbot:
 * new chat, history, stream, stop, copy, regenerate, clear, suggestions,
 * model status, keyboard shortcuts, markdown-ish rendering, context chips.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CHAT_SUGGESTIONS_EN,
  CHAT_SUGGESTIONS_VI,
  analyzeMatch,
  buildMatchChatContext,
} from '@/lib/match-analysis'
import { coachFetch, coachHealth } from '@/lib/ai/coach-client'
import { useTx } from '@/lib/tx'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  BotIcon,
  CircleStopIcon,
  ClipboardCopyIcon,
  Loader2Icon,
  PlusIcon,
  RefreshCwIcon,
  SendIcon,
  Trash2Icon,
  UserIcon,
  WifiIcon,
  WifiOffIcon,
  SparklesIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export type UiMessage = {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: number
  error?: boolean
}

type Conversation = {
  id: string
  title: string
  messages: UiMessage[]
  updatedAt: number
}

type Props = {
  match: any
  startupProfile?: any
  className?: string
}

const STORAGE_PREFIX = 'nf.match.chat.v1'

function uid() {
  return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function storageKey(matchId: string) {
  return `${STORAGE_PREFIX}:${matchId || 'global'}`
}

function loadConvos(matchId: string): Conversation[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(storageKey(matchId))
    if (!raw) return []
    const list = JSON.parse(raw) as Conversation[]
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function saveConvos(matchId: string, list: Conversation[]) {
  try {
    localStorage.setItem(storageKey(matchId), JSON.stringify(list.slice(0, 20)))
  } catch {
    /* */
  }
}

/** Minimal markdown: **bold**, `code`, newlines, - lists */
function SimpleMarkdown({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1.5" />
        const isBullet = /^\s*[-*•]\s+/.test(line)
        const content = isBullet ? line.replace(/^\s*[-*•]\s+/, '') : line
        const parts = content.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
        const nodes = parts.map((p, j) => {
          if (p.startsWith('**') && p.endsWith('**')) {
            return (
              <strong key={j} className="font-semibold text-foreground">
                {p.slice(2, -2)}
              </strong>
            )
          }
          if (p.startsWith('`') && p.endsWith('`')) {
            return (
              <code
                key={j}
                className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]"
              >
                {p.slice(1, -1)}
              </code>
            )
          }
          return <span key={j}>{p}</span>
        })
        return isBullet ? (
          <div key={i} className="flex gap-2">
            <span className="text-primary">•</span>
            <span>{nodes}</span>
          </div>
        ) : (
          <p key={i}>{nodes}</p>
        )
      })}
    </div>
  )
}

export function MatchChatbot({ match, startupProfile, className }: Props) {
  const { tx, lang } = useTx()
  const L = lang === 'en'
  const matchId = String(match?.id || match?.partnerId || 'unknown')

  const [online, setOnline] = useState<boolean | null>(null)
  const [model, setModel] = useState<string>('')
  const [convos, setConvos] = useState<Conversation[]>(() => loadConvos(matchId))
  const [activeId, setActiveId] = useState<string>(() => {
    const list = loadConvos(matchId)
    return list[0]?.id || ''
  })
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const insight = analyzeMatch({
    totalScore: match?.totalScore,
    scoreBreakdown: match?.scoreBreakdown || match?.breakdown,
    matchedReasons: match?.matchedReasons,
    risks: match?.risks,
    missingRequirements: match?.missingRequirements,
    recommendation: match?.recommendation,
    startupName: startupProfile?.startupName,
    partnerName: match?.partner?.organizationName,
  })

  const context = buildMatchChatContext({
    lang: L ? 'en' : 'vi',
    insight,
    startup: startupProfile,
    partner: match?.partner,
    reasons: match?.matchedReasons,
    risks: match?.risks,
    recommendation: match?.recommendation,
  })

  const active =
    convos.find((c) => c.id === activeId) ||
    ({
      id: '',
      title: L ? 'New chat' : 'Chat mới',
      messages: [],
      updatedAt: Date.now(),
    } as Conversation)

  useEffect(() => {
    const list = loadConvos(matchId)
    setConvos(list)
    setActiveId(list[0]?.id || '')
  }, [matchId])

  useEffect(() => {
    saveConvos(matchId, convos)
  }, [convos, matchId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [active.messages, streaming])

  useEffect(() => {
    void (async () => {
      try {
        // GET /api/ai/health on api.nexora-flow.cloud (via /intake-api)
        const h = await coachHealth()
        setOnline(!!h.online)
        setModel(h.model || 'deepseek-r1')
      } catch {
        setOnline(false)
      }
    })()
  }, [])

  const ensureConvo = useCallback((): string => {
    if (activeId && convos.some((c) => c.id === activeId)) return activeId
    const id = uid()
    const c: Conversation = {
      id,
      title: L ? 'New chat' : 'Chat mới',
      messages: [],
      updatedAt: Date.now(),
    }
    setConvos((prev) => [c, ...prev])
    setActiveId(id)
    return id
  }, [activeId, convos, L])

  const newChat = () => {
    const id = uid()
    setConvos((prev) => [
      {
        id,
        title: L ? 'New chat' : 'Chat mới',
        messages: [],
        updatedAt: Date.now(),
      },
      ...prev,
    ])
    setActiveId(id)
    setInput('')
  }

  const clearChat = () => {
    if (!activeId) return
    setConvos((prev) =>
      prev.map((c) =>
        c.id === activeId
          ? { ...c, messages: [], updatedAt: Date.now() }
          : c,
      ),
    )
  }

  const deleteConvo = (id: string) => {
    setConvos((prev) => prev.filter((c) => c.id !== id))
    if (activeId === id) setActiveId('')
  }

  const stop = () => {
    abortRef.current?.abort()
    abortRef.current = null
    setStreaming(false)
  }

  const copyMsg = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(tx('Đã copy', 'Copied'))
    } catch {
      toast.error('Copy failed')
    }
  }

  const send = async (text?: string, opts?: { regenerate?: boolean }) => {
    const content = (text ?? input).trim()
    if (!content && !opts?.regenerate) return
    if (streaming) return

    const cid = ensureConvo()
    let history = convos.find((c) => c.id === cid)?.messages || []

    if (opts?.regenerate) {
      // drop last assistant
      const lastA = [...history].reverse().findIndex((m) => m.role === 'assistant')
      if (lastA >= 0) {
        const idx = history.length - 1 - lastA
        history = history.slice(0, idx)
      }
      const lastU = [...history].reverse().find((m) => m.role === 'user')
      if (!lastU) return
    } else {
      const userMsg: UiMessage = {
        id: uid(),
        role: 'user',
        content,
        createdAt: Date.now(),
      }
      history = [...history, userMsg]
      setInput('')
    }

    const assistantId = uid()
    const placeholder: UiMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
    }
    history = [...history, placeholder]

    setConvos((prev) => {
      const exists = prev.some((c) => c.id === cid)
      if (!exists) {
        return [
          {
            id: cid,
            title: content.slice(0, 40) || (L ? 'New chat' : 'Chat mới'),
            messages: history,
            updatedAt: Date.now(),
          },
          ...prev,
        ]
      }
      return prev.map((c) =>
        c.id === cid
          ? {
              ...c,
              title:
                c.messages.length === 0
                  ? content.slice(0, 40) || c.title
                  : c.title,
              messages: history,
              updatedAt: Date.now(),
            }
          : c,
      )
    })

    setStreaming(true)
    const ac = new AbortController()
    abortRef.current = ac

    const apiMessages = history
      .filter((m) => m.role !== 'system' && m.id !== assistantId)
      .filter((m) => m.content)
      .map((m) => ({ role: m.role, content: m.content }))

    try {
      // Align with OpenAPI ChatRequest @ api.nexora-flow.cloud/docs (ai-coach)
      const payload = {
        messages: apiMessages,
        context,
        match,
        startupProfile,
        lang: L ? 'en' : 'vi',
        temperature: 0.4,
      }

      const res = await coachFetch(
        '/chat/stream',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
        { signal: ac.signal },
      )

      if (!res.ok || !res.body) {
        // fallback non-stream (same production contract)
        const r2 = await coachFetch('/chat', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        const body = await r2.json()
        const data = body?.data ?? body
        const reply =
          data?.message?.content ||
          body?.message ||
          (L ? 'No response' : 'Không có phản hồi')
        setConvos((prev) =>
          prev.map((c) =>
            c.id === cid
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: reply, error: !r2.ok }
                      : m,
                  ),
                  updatedAt: Date.now(),
                }
              : c,
          ),
        )
        if (data?.offline === false) setOnline(true)
        if (data?.offline === true) setOnline(false)
        if (data?.model) setModel(data.model)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      let acc = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const parts = buf.split('\n')
        buf = parts.pop() || ''
        for (const line of parts) {
          if (!line.startsWith('data:')) continue
          const raw = line.slice(5).trim()
          if (!raw) continue
          try {
            const ev = JSON.parse(raw)
            if (ev.type === 'delta' && ev.text) {
              acc += ev.text
              const show = acc
              setConvos((prev) =>
                prev.map((c) =>
                  c.id === cid
                    ? {
                        ...c,
                        messages: c.messages.map((m) =>
                          m.id === assistantId
                            ? { ...m, content: show }
                            : m,
                        ),
                      }
                    : c,
                ),
              )
            }
            if (ev.type === 'done') {
              const final = ev.content || acc
              setConvos((prev) =>
                prev.map((c) =>
                  c.id === cid
                    ? {
                        ...c,
                        messages: c.messages.map((m) =>
                          m.id === assistantId
                            ? { ...m, content: final }
                            : m,
                        ),
                        updatedAt: Date.now(),
                      }
                    : c,
                ),
              )
              if (ev.offline === false) setOnline(true)
              if (ev.offline === true) setOnline(false)
              if (ev.model) setModel(ev.model)
            }
            if (ev.type === 'error') {
              setConvos((prev) =>
                prev.map((c) =>
                  c.id === cid
                    ? {
                        ...c,
                        messages: c.messages.map((m) =>
                          m.id === assistantId
                            ? {
                                ...m,
                                content: ev.message || 'Error',
                                error: true,
                              }
                            : m,
                        ),
                      }
                    : c,
                ),
              )
            }
          } catch {
            /* */
          }
        }
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        setConvos((prev) =>
          prev.map((c) =>
            c.id === cid
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === assistantId
                      ? {
                          ...m,
                          content:
                            m.content ||
                            (L ? '_(stopped)_' : '_(đã dừng)_'),
                        }
                      : m,
                  ),
                }
              : c,
          ),
        )
      } else {
        toast.error(e instanceof Error ? e.message : 'Chat failed')
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  const suggestions = L ? CHAT_SUGGESTIONS_EN : CHAT_SUGGESTIONS_VI
  const partnerName =
    match?.partner?.organizationName || match?.partnerName || 'Partner'

  return (
    <div
      className={cn(
        'flex h-[min(70vh,640px)] flex-col overflow-hidden rounded-xl border border-border bg-card',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border/70 px-3 py-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <BotIcon className="size-4 text-primary" />
            Match Coach
          </p>
          <p className="truncate text-[10px] text-muted-foreground">
            {partnerName} · score {insight.totalScore}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Badge
            variant="outline"
            className={cn(
              'h-6 gap-1 text-[10px]',
              online === false && 'border-amber-500/40 text-amber-700',
            )}
          >
            {online === false ? (
              <WifiOffIcon className="size-3" />
            ) : (
              <WifiIcon className="size-3" />
            )}
            {online === null
              ? '…'
              : online
                ? model || 'deepseek-r1:8b'
                : 'heuristic'}
          </Badge>
          <Button
            size="icon-sm"
            variant="ghost"
            title={L ? 'New chat' : 'Chat mới'}
            onClick={newChat}
          >
            <PlusIcon className="size-3.5" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            title={L ? 'Clear' : 'Xóa hội thoại'}
            onClick={clearChat}
          >
            <Trash2Icon className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Sidebar history */}
        <aside className="hidden w-36 shrink-0 flex-col border-r border-border/60 sm:flex">
          <p className="px-2 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground">
            {L ? 'History' : 'Lịch sử'}
          </p>
          <ScrollArea className="flex-1 px-1">
            <div className="flex flex-col gap-0.5 pb-2">
              {convos.length === 0 ? (
                <p className="px-2 py-2 text-[10px] text-muted-foreground">
                  {L ? 'No chats yet' : 'Chưa có chat'}
                </p>
              ) : (
                convos.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setActiveId(c.id)}
                    className={cn(
                      'group flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left text-[11px]',
                      c.id === activeId
                        ? 'bg-primary/15 text-primary'
                        : 'hover:bg-muted',
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{c.title}</span>
                    <span
                      role="button"
                      className="hidden shrink-0 opacity-0 group-hover:inline-flex"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteConvo(c.id)
                      }}
                    >
                      <Trash2Icon className="size-3" />
                    </span>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </aside>

        {/* Messages */}
        <div className="flex min-w-0 flex-1 flex-col">
          <ScrollArea className="flex-1 px-3 py-3">
            <div className="mx-auto flex max-w-2xl flex-col gap-3">
              {active.messages.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <SparklesIcon className="size-8 text-primary/60" />
                  <div>
                    <p className="text-sm font-medium">
                      {tx(
                        'Hỏi vì sao điểm thấp / cách cải thiện',
                        'Ask why the score is low / how to improve',
                      )}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {tx(
                        'Context match + hồ sơ đã gắn sẵn. Enter gửi · Shift+Enter xuống dòng.',
                        'Match + profile context attached. Enter to send · Shift+Enter newline.',
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        disabled={streaming}
                        onClick={() => void send(s)}
                        className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] hover:border-primary/40 hover:bg-primary/5"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                active.messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      'flex gap-2',
                      m.role === 'user' ? 'justify-end' : 'justify-start',
                    )}
                  >
                    {m.role === 'assistant' ? (
                      <div className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                        <BotIcon className="size-3.5" />
                      </div>
                    ) : null}
                    <div
                      className={cn(
                        'max-w-[85%] rounded-2xl px-3 py-2',
                        m.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : m.error
                            ? 'border border-destructive/40 bg-destructive/10'
                            : 'border border-border bg-muted/40',
                      )}
                    >
                      {m.role === 'assistant' ? (
                        m.content ? (
                          <SimpleMarkdown text={m.content} />
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Loader2Icon className="size-3 animate-spin" />
                            {L ? 'Thinking…' : 'Đang nghĩ…'}
                          </span>
                        )
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                      )}
                      {m.role === 'assistant' && m.content ? (
                        <div className="mt-1.5 flex gap-1 border-t border-border/40 pt-1.5">
                          <Button
                            size="xs"
                            variant="ghost"
                            className="h-6 px-1.5 text-[10px]"
                            onClick={() => void copyMsg(m.content)}
                          >
                            <ClipboardCopyIcon className="size-3" />
                            Copy
                          </Button>
                          <Button
                            size="xs"
                            variant="ghost"
                            className="h-6 px-1.5 text-[10px]"
                            disabled={streaming}
                            onClick={() => void send(undefined, { regenerate: true })}
                          >
                            <RefreshCwIcon className="size-3" />
                            {L ? 'Regenerate' : 'Tạo lại'}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                    {m.role === 'user' ? (
                      <div className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
                        <UserIcon className="size-3.5" />
                      </div>
                    ) : null}
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          {/* Composer */}
          <div className="border-t border-border/70 p-2 sm:p-3">
            <div className="flex flex-wrap gap-1 pb-2">
              <Badge variant="secondary" className="text-[10px]">
                score {insight.totalScore}
              </Badge>
              {insight.weaknesses.slice(0, 2).map((w) => (
                <Badge key={w.key} variant="outline" className="text-[10px]">
                  {L ? w.labelEn : w.labelVi}: {w.score}
                </Badge>
              ))}
            </div>
            <div className="flex items-end gap-2">
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  L
                    ? 'Ask about this match…'
                    : 'Hỏi về kết quả so khớp này…'
                }
                rows={2}
                className="min-h-[44px] flex-1 resize-none text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void send()
                  }
                }}
                disabled={streaming}
              />
              {streaming ? (
                <Button
                  size="icon"
                  variant="destructive"
                  className="shrink-0 rounded-full"
                  onClick={stop}
                >
                  <CircleStopIcon className="size-4" />
                </Button>
              ) : (
                <Button
                  size="icon"
                  className="shrink-0 rounded-full"
                  disabled={!input.trim()}
                  onClick={() => void send()}
                >
                  <SendIcon className="size-4" />
                </Button>
              )}
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Enter {L ? 'send' : 'gửi'} · Shift+Enter {L ? 'newline' : 'xuống dòng'} ·
              api.nexora-flow.cloud · {model || 'deepseek-r1:8b'}
              {online === false
                ? L
                  ? ' (offline heuristic)'
                  : ' (heuristic offline)'
                : ''}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
