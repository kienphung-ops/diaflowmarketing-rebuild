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
  /** When true, paints a pulsing ring + glow around the desktop
   *  "Tower view" button and floats a bouncing "Click here" arrow
   *  beneath it. Desktop mirror of MobileBottomNav's `attentionTower`
   *  pulse — fires right after onboarding so the user's next move is
   *  "go see the tower you're climbing." Cleared when the button is
   *  clicked (parent flips it back to false in onToggleTower). */
  attentionTower?: boolean
  /** Desktop-only — fires when the signed-in user clicks the header's
   *  "Share to climb" button. Wired by the parent to open the centered
   *  ShareModal (same surface the floor-preview "Share to climb" CTA
   *  opens). When omitted, the button falls back to copy-to-clipboard
   *  via ReferralCopyButton. */
  onShareClimb?: () => void
  /** Spin-wheel token count — mirrored into the desktop stats pill so
   *  the user can see how many spins they have from any floor. Omit (or
   *  pass undefined) to hide the spin segment entirely. */
  spinTokens?: number
  /** Desktop-only — opens the leaderboard / rank modal. When omitted,
   *  the Rank button isn't rendered (e.g. /tower already surfaces a
   *  standalone "Top 50" edge pill, so it doesn't pass this). */
  onOpenRank?: () => void
  /** Current leaderboard rank, shown in the Rank button label ("#7").
   *  null/undefined → the button just reads "Rank". */
  rank?: number | null
}

export function Header({
  signedIn,
  currentFloor,
  totalInvites,
  referralCode,
  teammateCount,
  maxTeammates,
  showTower,
  onOpenSignup,
  onToggleTower,
  onMobileInvite,
  hideAuthCta,
  attentionTower,
  onShareClimb,
  spinTokens,
  onOpenRank,
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
        {/* Brand text — "Diaflow" on mobile (where the right slot is
            now empty so the brand has room to breathe), full
            "Diaflow Tower" wordmark on sm+ where the right slot
            carries the stats pill + CTAs. */}
        <span className="text-tower-cream font-bold tracking-wide sm:hidden">
          Diaflow
        </span>
        <span className="hidden sm:block text-tower-cream font-bold tracking-wide">
          Diaflow Tower
        </span>
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
          Level <span className="text-tower-gold font-semibold">{currentFloor}</span>
          <span className="mx-1.5 md:mx-2 opacity-40">·</span>
          <span className="text-tower-gold font-semibold">{totalInvites}</span>{' '}
          {totalInvites === 1 ? 'invite' : 'invites'}
          <span className="mx-1.5 md:mx-2 opacity-40">·</span>
          <span className="text-tower-gold font-semibold">{teammateCount}/{maxTeammates}</span>{' '}
          teammates
          {typeof spinTokens === 'number' && spinTokens > 0 && (
            <>
              <span className="mx-1.5 md:mx-2 opacity-40">·</span>
              <span className="text-tower-gold font-semibold">🎰 {spinTokens}</span>{' '}
              {spinTokens === 1 ? 'spin' : 'spins'}
            </>
          )}
        </div>

        {/* Rank — desktop only. Opens the leaderboard modal. Sits next to
            the stats pill so the user's standing is one click away without
            hunting for the logo or a hidden affordance. Shows the live
            rank ("#7") when known. Mobile reaches this via the bottom
            nav's Rank slot, so this is md+ only. */}
        {onOpenRank && (
          <button
            onClick={onOpenRank}
            aria-label="Open leaderboard"
            className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-night-mid/80 border border-tower-gold/40 text-tower-gold font-semibold text-xs tracking-wide hover:bg-night-mid transition whitespace-nowrap"
          >
            <span aria-hidden>🏆</span>
            Rank
          </button>
        )}

        {/* Tower toggle — desktop only. The header right slot on mobile
            is too narrow to fit Tower view alongside the stats pill +
            Claim/Copy CTA without everything shrinking to an unreadable
            10px. Mobile users reach the tower view via the bottom bar
            (and on /tower itself there's a back-arrow). */}
        {false && onToggleTower && ( //tạm ẩn button tower
          <div className="relative hidden md:inline-flex">
            <button
              onClick={onToggleTower}
              className={
                'relative inline-flex px-3 py-1.5 rounded-md font-semibold text-xs tracking-wide transition whitespace-nowrap ' +
                (attentionTower
                  ? 'bg-tower-gold/15 border border-tower-gold/70 text-tower-gold animate-nav-pulse'
                  : 'bg-night-mid/80 border border-tower-gold/40 text-tower-gold hover:bg-night-mid')
              }
            >
              {/* Expanding ring overlay — decoration, only while the
                  post-onboarding attention pulse is active. */}
              {attentionTower && (
                <span
                  aria-hidden
                  className="absolute inset-0 rounded-md border-2 border-tower-gold/70 animate-nav-pulse-ring pointer-events-none"
                />
              )}
              {showTower ? 'Go to your office' : 'Go to tower'}
            </button>

            {/* Bouncing "Click here" arrow beneath the button, pointing
                up at it — desktop mirror of MobileBottomNav's attention
                arrow (which points down at the bottom-bar Tower slot). */}
            {attentionTower && (
              <div
                aria-hidden
                className="absolute top-[calc(100%+4px)] left-1/2 -translate-x-1/2 flex flex-col items-center text-tower-gold animate-nav-arrow-bounce pointer-events-none"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="12" y1="19" x2="12" y2="5" />
                  <polyline points="5 12 12 5 19 12" />
                </svg>
                <span className="mt-1 px-2 py-0.5 rounded-full bg-tower-gold text-night-deep text-[10px] font-bold tracking-wide shadow-[0_4px_12px_rgba(168,117,255,0.55)] whitespace-nowrap">
                  Click here
                </span>
              </div>
            )}
          </div>
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
                // Mobile header right slot is now empty per the new
                // brand-only design — the same "Invite to climb"
                // action is reachable from MobileBottomNav's hero CTA,
                // so this header pill became redundant. Hidden on all
                // sizes (`hidden`) to drop it cleanly.
                className="hidden items-center gap-1 px-2.5 py-1 rounded-md bg-tower-gold/90 text-night-deep font-semibold text-[10px] tracking-wide hover:bg-tower-gold transition whitespace-nowrap"
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
              {onShareClimb ? (
                // Opens the centered ShareModal ("Share to reach Floor N")
                // — same surface the floor-preview "Share to climb" CTA
                // uses. Falls back to copy-in-place when no handler.
                <button
                  onClick={onShareClimb}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tower-gold/90 text-night-deep font-semibold text-xs tracking-wide hover:bg-tower-gold transition whitespace-nowrap"
                >
                  <span aria-hidden>📣</span> Share to climb
                </button>
              ) : (
                <ReferralCopyButton
                  code={referralCode}
                  currentFloor={currentFloor}
                  totalInvites={totalInvites}
                />
              )}
            </span>
          </>
        ) : hideAuthCta ? null : onOpenSignup ? (
          // Desktop only — mobile reaches the same signup flow via
          // MobileBottomNav's "Save my team" hero CTA, so the header
          // pill was a redundant duplicate eating the limited row.
          <button
            onClick={onOpenSignup}
            className="hidden md:inline-flex px-3 py-1.5 rounded-md bg-tower-gold/90 text-night-deep font-semibold text-xs tracking-wide hover:bg-tower-gold transition whitespace-nowrap"
          >
            🔒 Save Your Team
          </button>
        ) : (
          <Link
            href="/login"
            className="hidden md:inline-flex px-3 py-1.5 rounded-md bg-tower-gold/90 text-night-deep font-semibold text-xs tracking-wide hover:bg-tower-gold transition whitespace-nowrap"
          >
            🔒 Save Your Team
          </Link>
        )}
      </div>
    </header>
  )
}
