'use client'

import { useState } from 'react'
import { buildShareCopyText } from '@/lib/shareCopy'
import { creditShareUnlock } from '@/lib/spin/useFirstShareSpin'

interface Props {
  code: string
  /** Kept for caller compatibility — no longer used now that the copy
   *  payload is a single fixed string (see buildShareCopyText). */
  currentFloor?: number
  totalInvites?: number
}

export function ReferralCopyButton({ code }: Props) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    const url = `${window.location.origin}/floor/${code}`
    // Route through buildShareCopyText so the header Copy button
    // pastes the same marketing string as every other Copy button.
    const payload = buildShareCopyText(url)
    try {
      await navigator.clipboard.writeText(payload)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
      // Copy counts as a share toward a share-gated next floor (server
      // no-ops when it isn't share-gated).
      void creditShareUnlock('copy')
    } catch {
      // fall through silently
    }
  }

  return (
    <button
      onClick={handleCopy}
      aria-label={copied ? 'Copied' : 'Share to level up'}
      className="px-2.5 md:px-3 py-1 md:py-1.5 rounded-md bg-tower-gold/90 text-night-deep font-semibold text-[10px] md:text-xs tracking-wide hover:bg-tower-gold transition whitespace-nowrap"
    >
      {copied ? (
        'Copied!'
      ) : (
        <>
          {/* Per the mobile spec: signed-in users see a compact
              "Invite" pill (the bottom nav's hero share button is
              the primary share affordance now, so the header button
              only needs to advertise the option). Desktop shows the
              "Share to climb" label — the header is the only share
              entry point there. (Clicking still copies the link.) */}
          <span className="md:hidden">Invite</span>
          <span className="hidden md:inline">Share to level up</span>
        </>
      )}
    </button>
  )
}
