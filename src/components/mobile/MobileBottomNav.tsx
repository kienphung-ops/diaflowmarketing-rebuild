'use client'

/**
 * Three-slot sticky bottom navigation for mobile, per the mobile
 * mockup (Section 2 — Office state, screens 5/6/14):
 *
 *   [ 📋 Squad ]   [ 📣 SAVE / INVITE ]   [ 🏆 Tower ]
 *                  ^^^^^^^^^^^^^^^^^^^
 *                  HERO — purple-filled, larger, label swaps with
 *                  login state.
 *
 * Office (the home page) doesn't have its own tab — when you're on
 * the office page, the bottom bar's "Office" affordance is just
 * "you're already here." Tower navigates between routes. Squad
 * opens the MySquadDrawer. The hero opens either the Save modal
 * (trial) or the Share sheet (signed-in).
 *
 * When the user is ON the tower page, the LEFT slot swaps from
 * Squad to Office (so they can get back). The signal that tells
 * us which page we're on is `active` — same as the previous nav.
 *
 * Hidden on md+ where the desktop header carries these actions.
 * Safe-area-aware so the bar floats above the iOS home indicator.
 */

interface Props {
  /** Which route the user is currently on. On `tower` the left
   *  slot reverts to "🏠 Office" so the user has a back-affordance;
   *  on `office` the left slot is the Squad opener. */
  active: 'office' | 'tower'
  /** Tap "Office" when on the tower page — navigates back to /. */
  onGoOffice: () => void
  onGoTower: () => void
  /** Opens the MySquadDrawer bottom sheet. */
  onOpenSquad: () => void
  /** Tap the hero CTA. Parent decides what it does: signed-in users
   *  get the share sheet, trial users get the signup modal. */
  onHero: () => void
  /** Drives the hero label. `save` = trial user, `invite` = signed-in. */
  heroMode: 'save' | 'invite'
  /** Opens the leaderboard / rank modal — rendered as the right slot,
   *  to the right of the hero CTA. */
  onOpenRank: () => void
  /** Current leaderboard rank, shown in the Rank slot label (e.g. "#7").
   *  null/undefined while unknown — falls back to the "Rank" label. */
  rank?: number | null
  /** When true, paints a pulsing purple ring + glow around the Tower
   *  button to draw the user's eye there. Used right after onboarding
   *  finishes — the user has just met their team, and the next beat is
   *  "go check out the tower you're climbing." Auto-clears when the
   *  Tower button is tapped (parent flips this back to false). */
  attentionTower?: boolean
}

export function MobileBottomNav({
  active,
  onGoOffice,
  //onGoTower,
  onOpenSquad,
  onHero,
  heroMode,
  onOpenRank,
  attentionTower,
}: Props) {
  const onTowerPage = active === 'tower'
  const showAttentionArrow = !!attentionTower && !onTowerPage
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-30 pointer-events-none"
      aria-label="Primary"
    >
      {/* Bouncing arrow + label hovering above the Tower button when
          the post-onboarding attention pulse is active. Positioned
          relative to the nav's right edge so it lands directly on top
          of the Tower slot regardless of the hero CTA's width. */}
      {false && showAttentionArrow && (
        <div
          aria-hidden
          className="absolute right-3 bottom-[calc(100%-4px)] flex flex-col items-center text-purple-300 animate-nav-arrow-bounce"
          style={{
            width: 'min(64px, 18%)',
          }}
        >
          <span className="px-2 py-0.5 rounded-full bg-purple-500/95 text-white text-[10px] font-bold tracking-wide shadow-[0_4px_12px_rgba(168,117,255,0.55)] whitespace-nowrap mb-1">
            Tap here
          </span>
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
            <line x1="12" y1="5" x2="12" y2="19" />
            <polyline points="19 12 12 19 5 12" />
          </svg>
        </div>
      )}

      <div className="pointer-events-auto bg-night-deep/95 border-t border-white/10 backdrop-blur-md px-3 pt-2 pb-[max(0.65rem,env(safe-area-inset-bottom))] flex items-stretch gap-2">
        {/* Left slot — Squad opener on the office page, Office
            back-affordance on the tower page. */}
        {onTowerPage ? (
          <IconBtn icon="🏠" label="Office" onClick={onGoOffice} />
        ) : (
          <IconBtn icon="📋" label="Squad" onClick={onOpenSquad} />
        )}

        {/* Hero — purple-filled wide CTA. Label swaps with login. */}
        <HeroBtn mode={heroMode} onClick={onHero} />

        {/* Right slot — Rank opener (leaderboard modal). Shows the
            user's current rank in the label when known (e.g. "#7"). */}
        <IconBtn
          icon="🏆"
          label='Rank'
          onClick={onOpenRank}
        />
      </div>
    </nav>
  )
}

/**
 * Flat icon-over-label tab for the flanking slots. Wears a faint
 * purple background when `active` — used for the Tower slot when
 * the user is already on the tower page.
 */
function IconBtn({
  icon,
  label,
  onClick,
  active,
  pulse,
}: {
  icon: string
  label: string
  onClick: () => void
  active?: boolean
  /** Paints an attention-grabbing pulse ring + glow. Used on the
   *  Tower slot right after onboarding completes. */
  pulse?: boolean
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={
        'relative shrink-0 min-w-[64px] flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-xl text-[10.5px] font-semibold tracking-wide transition ' +
        (active
          ? 'bg-purple-500/15 border border-purple-400/35 text-purple-100'
          : pulse
          ? 'bg-purple-500/15 border border-purple-400/60 text-purple-100 animate-nav-pulse'
          : 'bg-night-mid/60 border border-white/10 text-tower-cream/75 hover:text-tower-cream')
      }
    >
      {/* Expanding ring overlay — pure decoration, only visible while
          pulse is true. The ring fades + expands beyond the button so
          the eye is drawn even on a busy bottom bar. */}
      {pulse && (
        <span
          aria-hidden
          className="absolute inset-0 rounded-xl border-2 border-purple-400/70 animate-nav-pulse-ring pointer-events-none"
        />
      )}
      <span className="text-base leading-none" aria-hidden>
        {icon}
      </span>
      <span className="leading-none">{label}</span>
    </button>
  )
}

/**
 * Hero CTA — the wide purple button between Squad and Tower. Label
 * swaps based on login state:
 *
 *   trial  → "📣 Save my team"     (opens signup modal upstream)
 *   logged → "📣 Invite to climb"  (opens share sheet upstream)
 *
 * Sized to dominate the bottom bar so the campaign's primary action
 * is the most visible element on the page at any moment.
 */
function HeroBtn({
  mode,
  onClick,
}: {
  mode: 'save' | 'invite'
  onClick: () => void
}) {
  const label = mode === 'save' ? 'Save my team' : 'Invite to climb'
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl bg-tower-gold text-night-deep font-extrabold text-[13px] tracking-wide shadow-[0_6px_18px_rgba(251,191,36,0.4)] hover:bg-tower-gold/95 active:scale-[0.98] transition px-3 py-2.5"
    >
      <span className="text-base leading-none" aria-hidden>
        📣
      </span>
      <span>{label}</span>
    </button>
  )
}
