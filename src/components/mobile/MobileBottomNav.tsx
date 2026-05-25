'use client'

/**
 * Three-slot sticky bottom navigation for mobile.
 *
 *   [ 🏠 Office ]  [ 📋 My Squad ]  [ 🏆 Tower ]
 *
 * All three slots share the same flat icon-over-label shape. Only the
 * tab matching the current route ("office" or "tower") is rendered
 * with the purple highlight pill behind it — non-active tabs (and
 * the My Squad action, which isn't a route) stay flat with a faint
 * cream label so the active state is obvious at a glance.
 *
 * Why this differs from the earlier mockup-style "lifted purple
 * hero": when the hero CTA was always purple, the active route's
 * cue was easy to miss — three near-identical pills with one
 * permanently highlighted made it ambiguous which one represented
 * "where you are". Reserving the purple pill for the active route
 * makes that signal unambiguous.
 *
 * Hidden on md+ where the desktop header carries these actions.
 * Safe-area-aware so the bar floats above the iOS home indicator.
 */

interface Props {
  /** Which route the user is currently on so the matching tab can
   *  highlight. The My Squad slot never "matches" — it's an action,
   *  not a route — so it never wears the active pill. */
  active: 'office' | 'tower'
  onGoOffice: () => void
  onGoTower: () => void
  /** Opens the MySquadDrawer bottom sheet. */
  onOpenSquad: () => void
}

export function MobileBottomNav({ active, onGoOffice, onGoTower, onOpenSquad }: Props) {
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-30 pointer-events-none"
      aria-label="Primary"
    >
      <div
        className="pointer-events-auto bg-night-deep/90 border-t border-white/10 backdrop-blur-md px-3 pt-2 pb-[max(0.65rem,env(safe-area-inset-bottom))] flex items-stretch gap-1.5"
      >
        <NavTab
          icon="🏠"
          label="Office"
          active={active === 'office'}
          onClick={onGoOffice}
        />
        <NavTab
          icon="📋"
          label="My Squad"
          /* My Squad is an action, not a route, so it never reads as
             "active". Keeping it flat means the active tint always
             unambiguously points at the user's current route. */
          active={false}
          onClick={onOpenSquad}
        />
        <NavTab
          icon="🏆"
          label="Tower"
          active={active === 'tower'}
          onClick={onGoTower}
        />
      </div>
    </nav>
  )
}

function NavTab({
  icon,
  label,
  active,
  onClick,
}: {
  icon: string
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      // Active tab wears the purple highlight pill — same palette as
      // the rest of the mobile chrome (purple-500 tint matches the
      // MobileShareSheet + MobileLeaderboard accent). Non-active
      // tabs are flat: faint cream icon + label, lifting to full
      // brightness on hover for affordance.
      className={
        'flex-1 flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 rounded-xl text-[10px] font-semibold tracking-wide transition ' +
        (active
          ? 'bg-purple-500/20 border border-purple-400/40 text-purple-100 shadow-[0_4px_14px_rgba(168,117,255,0.35)]'
          : 'text-tower-cream/60 hover:text-tower-cream')
      }
    >
      <span className="text-lg leading-none" aria-hidden>
        {icon}
      </span>
      <span className="leading-none">{label}</span>
    </button>
  )
}
