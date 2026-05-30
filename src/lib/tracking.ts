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
  share_click: { platform: 'twitter' | 'linkedin' | 'copy'; source: string }
  nav_click_tower_view: Record<string, never>
  nav_click_how_it_works: Record<string, never>
}

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
  const params = args[0] ?? {}

  // GTM dataLayer
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push({ event: name, ...params })

  // Microsoft Clarity session tag
  if (typeof window.clarity === 'function') {
    window.clarity('event', name)
  }
}
