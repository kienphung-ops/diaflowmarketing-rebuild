/**
 * Centralized analytics helper — pushes events to GTM's dataLayer
 * AND tags the current Microsoft Clarity session so recordings can
 * be filtered by event name in the Clarity dashboard.
 *
 * Every event is typed so callers can't mistype an event name or
 * forget a required parameter.
 */

/* ── Event catalogue ────────────────────────────────────────────── */

interface TrackingEvents {
  iris_interaction: { action: 'open_modal' | 'add_teammate' | 'save_team' }
  mia_interaction: { action: 'open_modal' }
  leo_video_complete: { percent: number }
  signup_click: { source: 'header' | 'iris' | 'mobile_share' | 'onboarding' | 'mobile_nav' }
  signup_complete: { method: 'email' | 'google' }
  discord_click: { source: 'squad_drawer' | 'how_it_works' }
  share_click: { platform: 'twitter' | 'linkedin' | 'copy'; source: 'share_modal' | 'mobile_share' | 'iris_modal' | 'squad_drawer' | 'save_success' | 'how_it_works' }
  nav_click_tower_view: Record<string, never>
  nav_click_how_it_works: Record<string, never>
}

/** Allowed `source` labels for the `share_click` event — exported so
 *  shared surfaces (useShareActions) can constrain their `source` prop
 *  to exactly what the analytics catalogue accepts. */
export type ShareClickSource = TrackingEvents['share_click']['source']

/* ── Global type augmentation ───────────────────────────────────── */

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[]
    clarity?: (...args: unknown[]) => void
  }
}

/* ── Public API ─────────────────────────────────────────────────── */

export function trackEvent<K extends keyof TrackingEvents>(
  name: K,
  ...args: TrackingEvents[K] extends Record<string, never>
    ? []
    : [params: TrackingEvents[K]]
): void {
  if (typeof window === 'undefined') return
  const params = args[0] ?? {}

  // GTM dataLayer
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push({ event: name, ...params })

  // Microsoft Clarity session tag
  if (typeof window.clarity === 'function') {
    window.clarity('event', name)
  }
}
