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
  onSimulateInvite?: () => void
  onOpenSignup?: () => void
  onToggleTower?: () => void
  onAddTeammates?: () => void
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
  onSimulateInvite,
  onOpenSignup,
  onToggleTower,
  onAddTeammates,
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

        {/* Tower toggle — desktop only; mobile uses bottom bar */}
        {onToggleTower && (
          <button
            onClick={onToggleTower}
            className="hidden md:inline-flex px-3 py-1.5 rounded-md bg-night-mid/80 border border-tower-gold/40 text-tower-gold font-semibold text-xs tracking-wide hover:bg-night-mid transition"
          >
            {showTower ? 'Office view' : 'Tower view'}
          </button>
        )}

        {/* Try inviting — desktop only; mobile uses bottom bar */}
        {onSimulateInvite && (
          <button
            onClick={onSimulateInvite}
            className="hidden md:inline-flex px-3 py-1.5 rounded-md bg-night-mid/80 border border-tower-gold/40 text-tower-gold font-semibold text-xs tracking-wide hover:bg-night-mid transition"
          >
            + Try inviting
          </button>
        )}

        {/* Auth CTA — always visible; primary action on mobile */}
        {signedIn && referralCode ? (
          <ReferralCopyButton code={referralCode} />
        ) : onOpenSignup ? (
          <button
            onClick={onOpenSignup}
            className="px-2.5 md:px-3 py-1 md:py-1.5 rounded-md bg-tower-gold/90 text-night-deep font-semibold text-[11px] md:text-xs tracking-wide hover:bg-tower-gold transition"
          >
            Sign up
          </button>
        ) : (
          <Link
            href="/login"
            className="px-2.5 md:px-3 py-1 md:py-1.5 rounded-md bg-tower-gold/90 text-night-deep font-semibold text-[11px] md:text-xs tracking-wide hover:bg-tower-gold transition"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  )
}
