'use client'

import { useState } from 'react'
import { useFloor } from '@/lib/floorsConfigClient'
import { buildShareCopyText } from '@/lib/shareCopy'

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
    const url = `${window.location.origin}/?ref=${code}`
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
    } catch {
      // fall through silently
    }
  }

  return (
    <button
      onClick={handleCopy}
      aria-label={copied ? 'Copied' : 'Copy your invite link'}
      className="px-2.5 md:px-3 py-1 md:py-1.5 rounded-md bg-tower-gold/90 text-night-deep font-semibold text-[10px] md:text-xs tracking-wide hover:bg-tower-gold transition whitespace-nowrap"
    >
      {copied ? (
        'Copied!'
      ) : (
        <>
          {/* Compact label on mobile, full label on desktop. */}
          <span className="md:hidden">⧉ Invite link</span>
          <span className="hidden md:inline">Copy your invite link</span>
        </>
      )}
    </button>
  )
}
