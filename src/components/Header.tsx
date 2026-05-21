'use client'

import Link from 'next/link'
import { ReferralCopyButton } from './ReferralCopyButton'

interface Props {
  signedIn: boolean
  currentFloor: number
  totalInvites: number
  referralCode: string | null
  teammateCount: number
  maxTeammates: number
  slotsAvailable: number
  showTower: boolean
  onOpenSignup?: () => void
  onToggleTower?: () => void
  onAddTeammates?: () => void
  /** When true, suppress the unlogged-user "Claim your team" CTA in
   *  the header's right slot. Used by /floor/[code] where the bottom-
   *  center "Build your own office" button already covers the
   *  signup path and a duplicate header button reads as clutter. */
  hideAuthCta?: boolean
}

export function Header({
  signedIn,
  currentFloor,
  totalInvites,
  referralCode,
  teammateCount,
  maxTeammates,
  slotsAvailable,
  showTower,
  onOpenSignup,
  onToggleTower,
  onAddTeammates,
  hideAuthCta,
}: Props) {
  return (
    <header className="fixed top-0 left-0 right-0 z-10 flex items-center justify-between px-3 md:px-4 py-2.5 md:py-3 pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/diaflow-logo.jpg" alt="Diaflow" width={32} height={32} className="rounded-md w-7 h-7 md:w-8 md:h-8" />
        <div className="hidden sm:block text-tower-cream font-semibold tracking-wide">Diaflow Tower</div>
      </div>

      <div className="pointer-events-auto flex items-center gap-2">
        {/* Compact stats on mobile, full on desktop */}
        <div className="text-[10px] md:text-xs text-tower-cream/80 bg-night-mid/60 px-2 md:px-3 py-1 md:py-1.5 rounded-md backdrop-blur-sm whitespace-nowrap">
          <span className="md:hidden">
            <span className="text-tower-gold font-semibold">F{currentFloor}</span>
            <span className="mx-1 opacity-40">·</span>
            <span className="text-tower-gold font-semibold">{totalInvites}</span>
            <span className="mx-1 opacity-40">·</span>
            <span className="text-tower-gold font-semibold">{teammateCount}/{maxTeammates}</span>
          </span>
          <span className="hidden md:inline">
            Floor <span className="text-tower-gold font-semibold">{currentFloor}</span>
            <span className="mx-2 opacity-40">·</span>
            <span className="text-tower-gold font-semibold">{totalInvites}</span>{' '}
            {totalInvites === 1 ? 'invite' : 'invites'}
            <span className="mx-2 opacity-40">·</span>
            <span className="text-tower-gold font-semibold">{teammateCount}/{maxTeammates}</span>{' '}
            teammates
            {!signedIn && <span className="ml-2 opacity-60">(trial)</span>}
          </span>
        </div>

        {/* Add-teammate pulse — only on desktop in header; mobile uses bottom bar */}
        {onAddTeammates && (
          <button
            onClick={onAddTeammates}
            className="hidden md:inline-flex px-3 py-1.5 rounded-md bg-tower-gold text-night-deep font-semibold text-xs tracking-wide hover:bg-tower-gold/90 transition animate-pulse"
          >
            + Add {slotsAvailable} {slotsAvailable === 1 ? 'teammate' : 'teammates'}
          </button>
        )}

        {/* Tower toggle — visible on both desktop and mobile (was
            previously desktop-only, but on /tower the user needs a way
            back to / and the mobile bottom bar isn't rendered there). */}
        {onToggleTower && (
          <button
            onClick={onToggleTower}
            className="inline-flex px-2 md:px-3 py-1 md:py-1.5 rounded-md bg-night-mid/80 border border-tower-gold/40 text-tower-gold font-semibold text-[10px] md:text-xs tracking-wide hover:bg-night-mid transition whitespace-nowrap"
          >
            {showTower ? 'Office view' : 'Tower view'}
          </button>
        )}

        {/* Auth CTA — always visible; primary action on mobile.
            "Claim your team" frames the upsell as locking in the
            trial progress under a real account. The same label is
            used whether the click opens the inline signup modal
            (anonymous home) or routes to /login (any other unlogged
            page) — same intent, single message. */}
        {signedIn && referralCode ? (
          // Signed-in: always show the invite-link copy button, even
          // when `hideAuthCta` is set — it's not an auth CTA, it's a
          // utility for the user's own referral link.
          <ReferralCopyButton code={referralCode} />
        ) : hideAuthCta ? null : onOpenSignup ? (
          <button
            onClick={onOpenSignup}
            className="px-2.5 md:px-3 py-1 md:py-1.5 rounded-md bg-tower-gold/90 text-night-deep font-semibold text-[11px] md:text-xs tracking-wide hover:bg-tower-gold transition whitespace-nowrap"
          >
            🔒 Claim your team
          </button>
        ) : (
          <Link
            href="/login"
            className="px-2.5 md:px-3 py-1 md:py-1.5 rounded-md bg-tower-gold/90 text-night-deep font-semibold text-[11px] md:text-xs tracking-wide hover:bg-tower-gold transition whitespace-nowrap"
          >
            🔒 Claim your team
          </Link>
        )}
      </div>
    </header>
  )
}
