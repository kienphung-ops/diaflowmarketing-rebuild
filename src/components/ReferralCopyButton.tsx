'use client'

import { useState } from 'react'
import { useFloor } from '@/lib/floorsConfigClient'
import { buildShareCopyText } from '@/lib/shareCopy'
import { creditShareUnlock } from '@/lib/spin/useFirstShareSpin'

interface Props {
  code: string
  /** Used to compute how many invites the user still needs to climb
   *  to the next floor — the same enriched string MySquad,
   *  IrisHireModal and HowItWorksModal paste. */
  currentFloor: number
  totalInvites: number
}

export function ReferralCopyButton({ code, currentFloor, totalInvites }: Props) {
  const [copied, setCopied] = useState(false)
  // Next-floor invite math — `useFloor` falls back to the static
  // config until /api/floors hydrates, so this renders synchronously
  // on first paint without needing a loading state. `nextFloor` is
  // null when the user has reached the penthouse (max floor).
  const nextFloor = useFloor(currentFloor + 1)
  const invitesToNext = nextFloor
    ? Math.max(0, nextFloor.invitesRequired - totalInvites)
    : 0

  const handleCopy = async () => {
    const url = `${window.location.origin}/floor/${code}`
    // Route through buildShareCopyText so the header Copy button
    // pastes the same marketing-formatted string as the MySquad +
    // HowItWorks + Iris drawers ("built my AI office, N invites
    // from the next floor—<url>"). Previously this button copied
    // the bare URL, which broke parity with the other three.
    const payload = buildShareCopyText(url, invitesToNext, !!nextFloor)
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
