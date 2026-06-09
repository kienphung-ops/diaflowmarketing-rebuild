'use client'

/**
 * useShareActions — the ONE place that owns share-button *behaviour*.
 *
 * Every share surface in the app (ShareModal, MobileShareSheet,
 * MySquadDrawer, IrisHireModal, HowItWorksModal, SaveSuccessModal)
 * renders its own markup (badge vs SVG icons, row vs column, per-modal
 * colour themes) — that UI stays at each call site. But the LOGIC was
 * copy-pasted six times: the `copied` flag + 1.5 s reset, the clipboard
 * write + share-gate credit, the first-share spin claim, the
 * `trackEvent('share_click', …)` plumbing and the trial-user signup
 * nudge. This hook centralises all of it so a behaviour change (new
 * platform, different tracking, copy also pays a token, …) is a single
 * edit here instead of six.
 *
 * What's NOT here, on purpose:
 *   - The marketing copy. `xText` (the tweet body) and `copyText` (the
 *     clipboard payload) are CONTENT and differ per surface, so each
 *     caller computes them (via lib/shareCopy.ts etc.) and passes them
 *     in. The intent-URL *shape* is still shared (buildShareUrl).
 *   - The markup. Callers wire the returned handlers into their own
 *     buttons / <a> tags, so each surface keeps its exact look.
 *
 * Layering: this composes the lower-level primitives —
 * `useFirstShareSpin` (dwell + /api/spin/task claim), `buildShareUrl`
 * (intent URLs), `creditShareUnlock` (share-gated floor) and
 * `buildShareCopyText` (clipboard format helper, used by callers). Edit
 * those for the primitive; edit this for the button behaviour.
 */

import { useCallback, useEffect, useState } from 'react'
import {
  useFirstShareSpin,
  creditShareUnlock,
  buildShareUrl,
} from '@/lib/spin/useFirstShareSpin'
import type { SharePlatform } from '@/lib/spin/constants'
import { trackEvent, type ShareClickSource } from '@/lib/tracking'

export interface UseShareActionsOptions {
  /** Personal invite URL. When null, share/copy fall through to
   *  `onSignupNudge` (trial users) or no-op. */
  inviteUrl: string | null
  /** Tweet body for X. LinkedIn pulls its preview from the page's OG
   *  tags, so this is X-only. Caller-supplied because it's content. */
  xText: string | null
  /** Clipboard payload for the Copy action. Caller-supplied (usually
   *  via `buildShareCopyText`) because the wording is content. */
  copyText: string
  /** `trackEvent` source label — constrained to the analytics
   *  catalogue's `share_click` sources. */
  source: ShareClickSource
  /** Fires after the first-share dwell + spin claim returns, so the
   *  parent can refresh the header token pill. */
  onShareSpinClaimed?: (granted: boolean, tokens?: number) => void
  /** Trial users with no invite link yet — called instead of
   *  sharing/copying so the surface can route them to signup. When
   *  omitted, share/copy simply no-op while there's no inviteUrl. */
  onSignupNudge?: () => void
}

export interface UseShareActionsResult {
  /** True for ~1.5 s after a successful copy (drives "✓ Copied"). */
  copied: boolean
  /** Platform whose share is mid-dwell, or null. Callers use it to
   *  disable buttons / show "…". */
  sharePending: SharePlatform | null
  /** Click handler for an X / LinkedIn button. Tracks, then either
   *  nudges signup (no link) or opens the share window + claims the
   *  first-share spin. */
  shareTo: (platform: SharePlatform) => void
  /** Click handler for the Copy button. Tracks, copies to clipboard,
   *  credits a share-gated floor, and flips `copied`. */
  copy: () => void | Promise<void>
  /** Ready-made intent URLs for surfaces that render <a> tags instead
   *  of buttons (HowItWorksModal). `undefined` when there's no link so
   *  the anchor can disable itself. NOTE: <a>-based sharing does NOT
   *  run the spin-claim dwell — prefer `shareTo` on a <button> if you
   *  want the share to credit the first-share task. */
  xHref: string | undefined
  linkedinHref: string | undefined
}

export function useShareActions({
  inviteUrl,
  xText,
  copyText,
  source,
  onShareSpinClaimed,
  onSignupNudge,
}: UseShareActionsOptions): UseShareActionsResult {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(t)
  }, [copied])
  
  if(!xText || xText.trim().length === 0) 
    xText = "Be the first one hiring Diaflow AI Teammates: " 
  const { share: triggerShare, pending: sharePending } = useFirstShareSpin({
    inviteUrl,
    xText,
    onClaim: (_, granted, tokens) => onShareSpinClaimed?.(granted, tokens),
  })

  const shareTo = useCallback(
    (platform: SharePlatform) => {
      trackEvent('share_click', {
        platform: platform === 'x' ? 'twitter' : 'linkedin',
        source,
      })
      if (!inviteUrl) {
        onSignupNudge?.()
        return
      }
      triggerShare(platform)
    },
    [inviteUrl, source, triggerShare, onSignupNudge],
  )

  const copy = useCallback(async () => {
    trackEvent('share_click', { platform: 'copy', source })
    if (!copyText) {
      onSignupNudge?.()
      return
    }
    try {
      await navigator.clipboard.writeText(copyText)
      setCopied(true)
      // Copy counts as a share toward a share-gated next floor (server
      // no-ops when the next floor isn't share-gated).
      void creditShareUnlock('copy')
    } catch {
      /* ignore — older browsers without async clipboard */
    }
  }, [copyText, source, onSignupNudge])

  const xHref = inviteUrl ? buildShareUrl('x', inviteUrl, xText) : undefined
  const linkedinHref = inviteUrl
    ? buildShareUrl('linkedin', inviteUrl, xText)
    : undefined

  return { copied, sharePending, shareTo, copy, xHref, linkedinHref }
}
