'use client'

interface Props {
  /** Number of empty teammate slots — animates the badge when > 0. */
  slotsAvailable: number
  showTower: boolean
  onOpenSquad: () => void
  onAddTeammates?: () => void
  onToggleTower?: () => void
  onSimulateInvite?: () => void
}

/**
 * Mobile-only sticky bottom bar. Carries the actions that desktop puts
 * in the header (Try inviting, Tower toggle, Add teammates) + the
 * primary "My Squad" entry. Hidden on md+ screens.
 */
export function MobileBottomBar({
  slotsAvailable,
  showTower,
  onOpenSquad,
  onAddTeammates,
  onToggleTower,
  onSimulateInvite,
}: Props) {
  return (
    <div className="md:hidden fixed bottom-0 inset-x-0 z-20 pointer-events-none">
      <div className="pointer-events-auto bg-night-mid/95 border-t border-white/10 backdrop-blur-md px-3 py-2 flex items-stretch gap-1.5 safe-bottom">
        {onSimulateInvite && (
          <BarButton onClick={onSimulateInvite} label="Invite" icon="✉️" />
        )}
        {onAddTeammates && slotsAvailable > 0 && (
          <BarButton onClick={onAddTeammates} label="Add" badge={slotsAvailable} pulse icon="＋" />
        )}
        {onToggleTower && (
          <BarButton
            onClick={onToggleTower}
            label={showTower ? 'Office' : 'Tower'}
            icon={showTower ? '🏠' : '🏢'}
          />
        )}
        <BarButton onClick={onOpenSquad} label="My Squad" icon="📋" primary />
      </div>
    </div>
  )
}

function BarButton({
  onClick,
  label,
  icon,
  badge,
  primary,
  pulse,
}: {
  onClick: () => void
  label: string
  icon: string
  badge?: number
  primary?: boolean
  pulse?: boolean
}) {
  const base = 'relative flex-1 flex flex-col items-center justify-center gap-0.5 px-1 py-1.5 rounded-lg text-[10px] font-semibold tracking-wide transition'
  const styles = primary
    ? 'bg-tower-gold text-night-deep hover:bg-tower-gold/90'
    : 'bg-night-deep/60 border border-white/10 text-tower-cream hover:border-tower-gold/40'
  return (
    <button onClick={onClick} className={`${base} ${styles} ${pulse ? 'animate-pulse' : ''}`}>
      <span className="text-base leading-none">{icon}</span>
      <span className="leading-none">{label}</span>
      {badge != null && badge > 0 && (
        <span className="absolute top-1 right-2 bg-tower-gold text-night-deep text-[9px] font-extrabold rounded-full px-1.5 py-0.5 leading-none">
          {badge}
        </span>
      )}
    </button>
  )
}
