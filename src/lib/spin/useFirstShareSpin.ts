'use client'

/**
 * Shared "share + first-share spin" hook.
 *
 * Used by every social-share surface OUTSIDE the SpinModal (the X /
 * LinkedIn buttons in MySquadDrawer, the desktop ShareModal, and the
 * mobile share sheet) so they all funnel through the same dwell +
 * /api/spin/task claim. The user's very first share — wherever they
 * click it from — pays out the matching spin task; every later click
 * still opens the share window for them but the server's
 * TaskCompletion unique constraint quietly turns the claim into a
 * no-op (409).
 *
 * The SpinModal keeps its own dwell/claim flow because its UI also
 * needs to update its in-modal "task completed" badge — but it uses
 * the SAME task keys (`share_linkedin` / `share_x`) so claims from
 * either surface affect the same TaskCompletion rows.
 */

import { useCallback, useState } from 'react'
import { SHARE_DWELL_SECONDS, taskKeyForPlatform, type SharePlatform } from './constants'

export type { SharePlatform } from './constants'

interface Options {
  /** Personal invite URL. When null, the hook's `share()` is a no-op. */
  inviteUrl: string | null
  /** Marketing copy used in the X tweet. LinkedIn pulls its preview
   *  from the page's OG tags, so this text is X-only. */
  xText: string
  /** Fires once the dwell completes and the task claim returns.
   *
   *   granted=true  → the server accepted the claim → +1 spin earned.
   *   granted=false → the claim was rejected (already done, or
   *                   network error) → no token change.
   *
   *  `tokens` is the user's new banked token count when the server
   *  reports one; left undefined on rejection or network failures.
   *  Parents typically use this to bubble the new balance into the
   *  Header pill / spin badge without an extra GET. */
  onClaim?: (platform: SharePlatform, granted: boolean, tokens?: number) => void
}

interface Result {
  /** Open the platform's share window AND start the dwell→claim
   *  flow. Safe to call multiple times in a row: only the first
   *  click for a given platform sticks (subsequent claims hit
   *  409). */
  share: (platform: SharePlatform) => void
  /** The platform whose share is currently in the 3 s dwell window.
   *  Components can use this to show "Waiting…" or disable the
   *  button so the user doesn't double-fire. `null` when idle. */
  pending: SharePlatform | null
}

/**
 * Canonical share-intent URL builder — exported so EVERY share
 * surface in the app (MySquadDrawer, ShareModal, MobileShareSheet,
 * SpinModal) funnels through the same domain + parameter shape.
 *
 * Why this matters for X: `twitter.com/intent/tweet` still resolves
 * but Twitter / X redirects it via `x.com/i/flow/login?...` which
 * sometimes opens a login wall instead of the compose screen in
 * popups. `x.com/intent/tweet` skips the redirect and lands the
 * compose dialog directly — same outcome on every browser.
 *
 * LinkedIn's share-offsite intent only takes `url`; title +
 * description come from the page's OG tags.
 *
 * Matches the marketing copy spec in `requirements/share-btn.md`.
 */
export function buildShareUrl(
  platform: SharePlatform,
  inviteUrl: string,
  xText: string,
): string {
  if (platform === 'x') {
    return `https://x.com/intent/tweet?text=${encodeURIComponent(xText)}&url=${encodeURIComponent(inviteUrl)}&hashtags=DiaflowTower`
  }
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(inviteUrl)}`
}

/**
 * Tell the server a share action happened so it can credit a SHARE-gated
 * floor (e.g. F2). Fire-and-forget from any Copy button — the server
 * no-ops unless the next floor actually requires a share, so it's safe to
 * call unconditionally. Returns true when the floor was credited.
 *
 * Copy routes here (not through /api/spin/task) because copying counts
 * for floor unlock but does NOT pay a spin token.
 */
export async function creditShareUnlock(source: 'x' | 'linkedin' | 'copy'): Promise<boolean> {
  try {
    const r = await fetch('/api/floor/share-unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source }),
    })
    if (!r.ok) return false
    const j = (await r.json().catch(() => ({}))) as { credited?: boolean }
    return j.credited === true
  } catch {
    return false
  }
}

export function useFirstShareSpin({ inviteUrl, xText, onClaim }: Options): Result {
  const [pending, setPending] = useState<SharePlatform | null>(null)

  const share = useCallback(
    (platform: SharePlatform) => {
      if (!inviteUrl || pending) return
      window.open(
        buildShareUrl(platform, inviteUrl, xText),
        '_blank',
        'noopener,noreferrer,width=620,height=620',
      )
      setPending(platform)

      // Honor-system dwell — matches SpinModal's behaviour so the
      // claim path is identical regardless of where the share was
      // initiated. The server still has the final say via the
      // (userId, taskKey) unique constraint on TaskCompletion.
      setTimeout(async () => {
        try {
          const r = await fetch('/api/spin/task', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskKey: taskKeyForPlatform(platform) }),
          })
          const j = (await r.json().catch(() => ({}))) as { tokens?: number }
          onClaim?.(platform, r.ok, typeof j.tokens === 'number' ? j.tokens : undefined)
        } catch {
          // Treat network errors as "not granted" — the user can try
          // again; the server is the ledger of truth.
          onClaim?.(platform, false)
        } finally {
          setPending(null)
        }
      }, SHARE_DWELL_SECONDS * 1000)
    },
    [inviteUrl, xText, pending, onClaim],
  )

  return { share, pending }
}
