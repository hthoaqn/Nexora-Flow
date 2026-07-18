/**
 * Track sandbox completion for journey / next-steps on Startup dashboard.
 * localStorage per user; also readable from API active sim status.
 */

const KEY = 'nf.sandbox.progress.v1'

type ProgressMap = Record<
  string,
  { completed: boolean; completedAt?: string; simId?: string }
>

function readAll(): ProgressMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    return JSON.parse(raw) as ProgressMap
  } catch {
    return {}
  }
}

function writeAll(map: ProgressMap) {
  if (typeof window === 'undefined') return
  localStorage.setItem(KEY, JSON.stringify(map))
}

export function markSandboxCompleted(
  userId: string,
  meta?: { simId?: string },
) {
  if (!userId) return
  const map = readAll()
  map[userId] = {
    completed: true,
    completedAt: new Date().toISOString(),
    simId: meta?.simId,
  }
  writeAll(map)
  // Notify same-tab listeners (storage event only fires cross-tab)
  try {
    window.dispatchEvent(
      new CustomEvent('nf:sandbox-progress', { detail: { userId } }),
    )
  } catch {
    /* ignore */
  }
}

export function isSandboxCompleted(userId?: string | null): boolean {
  if (!userId) return false
  return !!readAll()[userId]?.completed
}

export function clearSandboxProgress(userId: string) {
  if (!userId) return
  const map = readAll()
  delete map[userId]
  writeAll(map)
}
