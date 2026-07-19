'use client'

import React from 'react'

/** Inline: **bold**, *italic*, `code` */
function InlineMd({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g)
  return (
    <>
      {parts.map((p, j) => {
        if (p.startsWith('**') && p.endsWith('**') && p.length >= 4) {
          return (
            <strong key={j} className="font-semibold text-foreground">
              {p.slice(2, -2)}
            </strong>
          )
        }
        if (
          p.startsWith('*') &&
          p.endsWith('*') &&
          p.length >= 3 &&
          !p.startsWith('**')
        ) {
          return (
            <em key={j} className="italic">
              {p.slice(1, -1)}
            </em>
          )
        }
        if (p.startsWith('`') && p.endsWith('`') && p.length >= 2) {
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
      })}
    </>
  )
}

/**
 * Markdown for coach / DeepSeek: #–######, >, ```, lists, hr, inline.
 * Avoids showing raw ### / > / ``` in the UI.
 */
export function MatchMarkdown({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n')
  const blocks: React.ReactNode[] = []
  let i = 0
  let key = 0

  while (i < lines.length) {
    const line = lines[i]

    // fenced code ```
    if (/^\s*```/.test(line)) {
      const lang = line.replace(/^\s*```/, '').trim()
      const code: string[] = []
      i += 1
      while (i < lines.length && !/^\s*```/.test(lines[i])) {
        code.push(lines[i])
        i += 1
      }
      if (i < lines.length) i += 1
      blocks.push(
        <pre
          key={key++}
          className="my-1.5 overflow-x-auto rounded-lg border border-border bg-muted/60 p-2.5 font-mono text-[11px] leading-relaxed"
        >
          {lang ? (
            <div className="mb-1 text-[10px] text-muted-foreground">{lang}</div>
          ) : null}
          <code>{code.join('\n')}</code>
        </pre>,
      )
      continue
    }

    if (!line.trim()) {
      blocks.push(<div key={key++} className="h-1.5" />)
      i += 1
      continue
    }

    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push(<hr key={key++} className="my-2 border-border/70" />)
      i += 1
      continue
    }

    const hm = line.match(/^\s*(#{1,6})\s+(.+)$/)
    if (hm) {
      const level = hm[1].length
      const cls =
        level <= 1
          ? 'mt-2 text-base font-bold tracking-tight'
          : level === 2
            ? 'mt-2 text-[15px] font-bold'
            : level === 3
              ? 'mt-1.5 text-sm font-semibold'
              : 'mt-1 text-sm font-semibold text-foreground/90'
      blocks.push(
        <p key={key++} className={cls}>
          <InlineMd text={hm[2]} />
        </p>,
      )
      i += 1
      continue
    }

    if (/^\s*>\s?/.test(line)) {
      const quote: string[] = []
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^\s*>\s?/, ''))
        i += 1
      }
      blocks.push(
        <blockquote
          key={key++}
          className="my-1.5 border-l-2 border-primary/50 pl-3 text-muted-foreground"
        >
          {quote.map((q, qi) => (
            <p key={qi} className="text-sm leading-relaxed">
              <InlineMd text={q} />
            </p>
          ))}
        </blockquote>,
      )
      continue
    }

    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+[.)]\s+/, ''))
        i += 1
      }
      blocks.push(
        <ol key={key++} className="my-1 list-decimal space-y-0.5 pl-5 text-sm">
          {items.map((it, ii) => (
            <li key={ii}>
              <InlineMd text={it} />
            </li>
          ))}
        </ol>,
      )
      continue
    }

    if (/^\s*[-*•]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*•]\s+/, ''))
        i += 1
      }
      blocks.push(
        <ul key={key++} className="my-1 list-disc space-y-0.5 pl-5 text-sm">
          {items.map((it, ii) => (
            <li key={ii}>
              <InlineMd text={it} />
            </li>
          ))}
        </ul>,
      )
      continue
    }

    blocks.push(
      <p key={key++} className="text-sm leading-relaxed">
        <InlineMd text={line} />
      </p>,
    )
    i += 1
  }

  return (
    <div className={className || 'space-y-0.5 text-sm leading-relaxed'}>
      {blocks}
    </div>
  )
}
