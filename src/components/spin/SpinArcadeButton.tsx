'use client'

/**
 * In-room entry point for the spin wheel — a floating "arcade cabinet"
 * button. Per GRO-5 the arcade in the office IS the spin entry; there's
 * no dedicated 3D asset yet, so this stylised button stands in for it.
 *
 *   - tokens > 0 → pulses gold, floats a "N" badge above it.
 *   - tokens = 0 → dims; tooltip nudges the user to earn a spin.
 *   - anon teaser → `teaser` paints the gold "TRY YOUR FREE SPIN" badge.
 *
 * Sits bottom-left so it clears MySquadFloatingButton (right edge) and
 * the MobileBottomNav (bottom center). Lifted above the mobile nav.
 */
interface Props {
  visible: boolean
  tokens: number
  /** Anonymous pre-login teaser — shows the free-spin badge. */
  teaser?: boolean
  onClick: () => void
}

export function SpinArcadeButton({ visible, tokens, teaser, onClick }: Props) {
  if (!visible) return null
  const hasSpins = teaser || tokens > 0

  return (
    <div className="fixed left-4 bottom-24 md:bottom-6 z-20">
      <button
        type="button"
        onClick={onClick}
        aria-label={teaser ? 'Try your free spin' : `Open spin wheel (${tokens} spins)`}
        className={
          'relative group flex flex-col items-center rounded-2xl px-3 py-2.5 border backdrop-blur-md shadow-lg transition ' +
          (hasSpins
            ? 'bg-night-mid/90 border-tower-gold/60 hover:bg-night-mid animate-nav-pulse'
            : 'bg-night-mid/70 border-white/10 opacity-70 hover:opacity-100')
        }
        style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.45)' }}
      >
        <span className="text-2xl leading-none" aria-hidden>
          🎰
        </span>
        <span className="mt-1 text-[10px] font-bold tracking-wide text-tower-gold">SPIN</span>

        {/* Token badge / teaser badge */}
        {teaser ? (
          <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-0.5 rounded-full bg-tower-gold text-night-deep text-[9px] font-black tracking-wide shadow">
            FREE SPIN
          </span>
        ) : tokens > 0 ? (
          <span className="absolute -top-2 -right-2 min-w-[20px] h-5 px-1 rounded-full bg-tower-gold text-night-deep text-[11px] font-black flex items-center justify-center shadow tabular-nums">
            {tokens}
          </span>
        ) : null}

        {/* Zero-state tooltip */}
        {!hasSpins && (
          <span className="pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 whitespace-nowrap px-2 py-1 rounded-lg bg-night-deep text-tower-cream/80 text-[11px] opacity-0 group-hover:opacity-100 transition">
            Complete a task or refer a friend to earn a spin
          </span>
        )}
      </button>
    </div>
  )
}
