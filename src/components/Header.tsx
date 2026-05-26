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
  /** Mobile-only — fires when the signed-in user taps the "Invite"
   *  pill in the header's right slot. Wired by the parent to open
   *  MobileShareSheet (the same bottom sheet the old bottom-nav
   *  "Invite to climb" CTA used to open).
   *  Desktop keeps the ReferralCopyButton's copy-to-clipboard
   *  behaviour and ignores this prop. */
  onMobileInvite?: () => void
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
  onMobileInvite,
  hideAuthCta,
}: Props) {
  return (
    <header className="fixed top-0 left-0 right-0 z-10 flex items-center justify-between gap-2 px-3 md:px-4 py-2.5 md:py-3 pointer-events-none">
      {/* Logo + brand → click sends user to the home route. Wrapped
          in a Next.js <Link> so navigation goes through the client
          router (instant, no full reload). */}
      <Link
        href="/"
        aria-label="Diaflow Tower — home"
        className="shrink-0 pointer-events-auto flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tower-gold/60"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/diaflow-logo.jpg" alt="Diaflow" width={32} height={32} className="rounded-md w-7 h-7 md:w-8 md:h-8" />
        <div className="hidden sm:block text-tower-cream font-semibold tracking-wide">Diaflow Tower</div>
      </Link>

      {/* Mobile leaves the middle of the header empty by design —
          the same stats (floor / invites / teammates / next-reward)
          render as the MobileCounterChips horizontal strip directly
          below this header. Doubling them up here would just compete
          for the limited 390px row width. */}

      <div className="pointer-events-auto flex items-center gap-2 shrink-0">
        {/* Stats pill — DESKTOP ONLY. On mobile this same data is
            rendered as the MobileCounterChips strip directly below
            the header, so showing the pill here too would duplicate
            the info AND eat the limited 390px row width. The
            "(trial)" suffix stays desktop-only since it's the bit
            that ran out of room first on small screens. */}
        <div className="hidden md:block text-xs text-tower-cream/80 bg-night-mid/60 px-3 py-1.5 rounded-md backdrop-blur-sm whitespace-nowrap">
          Floor <span className="text-tower-gold font-semibold">{currentFloor}</span>
          <span className="mx-1.5 md:mx-2 opacity-40">·</span>
          <span className="text-tower-gold font-semibold">{totalInvites}</span>{' '}
          {totalInvites === 1 ? 'invite' : 'invites'}
          <span className="mx-1.5 md:mx-2 opacity-40">·</span>
          <span className="text-tower-gold font-semibold">{teammateCount}/{maxTeammates}</span>{' '}
          teammates
          {!signedIn && <span className="ml-2 opacity-60 hidden md:inline">(trial)</span>}
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

        {/* Tower toggle — desktop only. The header right slot on mobile
            is too narrow to fit Tower view alongside the stats pill +
            Claim/Copy CTA without everything shrinking to an unreadable
            10px. Mobile users reach the tower view via the bottom bar
            (and on /tower itself there's a back-arrow). */}
        {onToggleTower && (
          <button
            onClick={onToggleTower}
            className="hidden md:inline-flex px-3 py-1.5 rounded-md bg-night-mid/80 border border-tower-gold/40 text-tower-gold font-semibold text-xs tracking-wide hover:bg-night-mid transition whitespace-nowrap"
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
          // Signed-in: the right slot carries the user's invite
          // affordance. Two flavours that swap at the md breakpoint:
          //
          //   Mobile (< md)  → plain "Invite" pill that OPENS the
          //                    MobileShareSheet (X / LinkedIn /
          //                    WhatsApp / Email / Copy). One-tap
          //                    surface for the campaign's primary
          //                    action; the bottom-nav hero is now
          //                    My Squad instead.
          //
          //   Desktop (md+)  → ReferralCopyButton — copies the
          //                    enriched share string to the
          //                    clipboard in place. Desktop doesn't
          //                    have a separate share sheet, so the
          //                    direct copy is the share action.
          <>
            {onMobileInvite && (
              <button
                onClick={onMobileInvite}
                aria-label="Open invite sheet"
                className="md:hidden flex items-center gap-1 px-2.5 py-1 rounded-md bg-tower-gold/90 text-night-deep font-semibold text-[10px] tracking-wide hover:bg-tower-gold transition whitespace-nowrap"
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  width="12" 
                  height="12" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <line x1="19" y1="8" x2="19" y2="14" />
                  <line x1="16" y1="11" x2="22" y2="11" />
                </svg>
                
                Invite
              </button>
            )}
            <span className="hidden md:inline-flex">
              <ReferralCopyButton
                code={referralCode}
                currentFloor={currentFloor}
                totalInvites={totalInvites}
              />
            </span>
          </>
        ) : hideAuthCta ? null : onOpenSignup ? (
          <button
            onClick={onOpenSignup}
            className="px-3 py-1.5 rounded-md bg-tower-gold/90 text-night-deep font-semibold text-xs tracking-wide hover:bg-tower-gold transition whitespace-nowrap"
          >
            🔒 Claim your team
          </button>
        ) : (
          <Link
            href="/login"
            className="px-3 py-1.5 rounded-md bg-tower-gold/90 text-night-deep font-semibold text-xs tracking-wide hover:bg-tower-gold transition whitespace-nowrap"
          >
            🔒 Claim your team
          </Link>
        )}
      </div>
    </header>
  )
}
