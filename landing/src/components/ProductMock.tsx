'use client'

import { useEffect, useRef } from 'react'

const matches = [
  { rank: 1, name: 'Vinamilk Innovation Lab', type: 'Doanh nghiệp · Pilot', score: 94 },
  { rank: 2, name: 'NIC Corporate Connect', type: 'NIC · Go-to-market', score: 91 },
  { rank: 3, name: 'SEA Agri Fund', type: 'Quỹ đầu tư · Seed', score: 87 },
]

export function ProductMock() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = ref.current
    if (!root) return
    const bars = root.querySelectorAll<HTMLElement>('.bar > i')
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          bars.forEach((b) => b.classList.add('on'))
          io.disconnect()
        }
      },
      { threshold: 0.25 },
    )
    io.observe(root)
    return () => io.disconnect()
  }, [])

  return (
    <div ref={ref} className="relative">
      {/* Decorative rings behind mock */}
      <div
        className="pointer-events-none absolute -inset-6 rounded-[32px] opacity-60"
        style={{
          background:
            'radial-gradient(circle at 30% 20%, rgba(124,58,237,0.18), transparent 45%), radial-gradient(circle at 80% 70%, rgba(37,99,235,0.14), transparent 40%)',
        }}
        aria-hidden
      />

      <div className="mock relative">
        <div className="mock-bar">
          <span className="mock-dot bg-[#ff5f57]" />
          <span className="mock-dot bg-[#febc2e]" />
          <span className="mock-dot bg-[#28c840]" />
          <span className="ml-2 flex-1 truncate rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-1 text-center text-[11px] text-[var(--mute)]">
            app.nexora-flow.cloud
          </span>
        </div>

        <div className="grid md:grid-cols-[200px_1fr]">
          {/* Sidebar */}
          <aside className="hidden border-r border-[var(--line)] bg-[var(--bg-soft)] p-5 md:block">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--mute)]">
              Startup
            </p>
            <p className="mt-2 font-display text-sm font-semibold text-[var(--fg)]">AgriSense AI</p>
            <p className="mt-0.5 text-xs text-[var(--mute)]">AgriTech · Seed · Hà Nội</p>

            <div className="mt-5">
              <div className="mb-1.5 flex justify-between text-[11px]">
                <span className="text-[var(--mute)]">Hồ sơ</span>
                <span className="font-medium text-[var(--fg-2)]">88%</span>
              </div>
              <div className="bar">
                <i style={{ width: '88%' }} />
              </div>
            </div>

            <ul className="mt-6 space-y-2 text-xs text-[var(--mute)]">
              {['Pitch deck parsed', 'Nhu cầu: Pilot + vốn', 'Thị trường: SEA'].map((t) => (
                <li
                  key={t}
                  className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2"
                >
                  {t}
                </li>
              ))}
            </ul>
          </aside>

          {/* Main */}
          <div className="p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--mute)]">
                  Top matches
                </p>
                <p className="mt-1 font-display text-base font-semibold text-[var(--fg)]">
                  3 đối tác phù hợp nhất
                </p>
              </div>
              <div className="relative flex items-center justify-center">
                <div className="ring-score relative" style={{ ['--pct' as string]: 94 }}>
                  <span className="absolute inset-0 grid place-items-center text-[var(--fg)]">94</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {matches.map((m) => (
                <div
                  key={m.rank}
                  className={`flex items-center gap-3 rounded-2xl border px-3.5 py-3 ${
                    m.rank === 1
                      ? 'border-[var(--p-mid)]/25 bg-gradient-to-r from-[rgba(91,33,182,0.06)] to-transparent dark:from-[rgba(139,92,246,0.12)]'
                      : 'border-[var(--line)] bg-[var(--bg-soft)]'
                  }`}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--surface)] text-xs font-semibold text-[var(--p-mid)] shadow-[var(--shadow-sm)] dark:text-[var(--p)]">
                    #{m.rank}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[var(--fg)]">{m.name}</p>
                    <p className="truncate text-[11px] text-[var(--mute)]">{m.type}</p>
                  </div>
                  <span className="font-display text-lg font-semibold tabular-nums text-[var(--fg)]">
                    {m.score}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-xl border border-[var(--line)] bg-[var(--bg-soft)] px-3.5 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--p-mid)] dark:text-[var(--p)]">
                Why this match
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--fg-2)]">
                AgriTech alignment · R&D capacity · Pilot window Q3 · Check size phù hợp.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Floating chip */}
      <div className="float-badge absolute -right-2 top-16 hidden rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--fg-2)] shadow-[var(--shadow)] sm:block">
        AI explain · transparent
      </div>
    </div>
  )
}
