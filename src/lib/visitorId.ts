/**
 * Per-browser visitor identifier — stable across tabs and reloads,
 * different per browser/device. Used by the floor-presence endpoint
 * to deduplicate visitors so the "👁 N viewing" badge counts unique
 * people, not open tabs.
 *
 * Lives in localStorage so closing/reopening a tab keeps the same id.
 * Falls back to an empty string on the server (no window) — callers
 * should skip the heartbeat ping in that case.
 */

const STORAGE_KEY = 'diaflow_visitor_id'

export function getVisitorId(): string {
  if (typeof window === 'undefined') return ''
  try {
    let id = window.localStorage.getItem(STORAGE_KEY)
    if (!id) {
      id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2) + Date.now().toString(36)
      window.localStorage.setItem(STORAGE_KEY, id)
    }
    return id
  } catch {
    return ''
  }
}
