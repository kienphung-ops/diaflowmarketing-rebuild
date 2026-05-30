'use client'

interface Props {
  onClick: () => void
  visible: boolean
}

/** Floating CTA fixed to the right edge of the viewport (per reference design). */
export function MySquadFloatingButton({ onClick, visible }: Props) {
  if (!visible) return null
  return (
    <button
      onClick={onClick}
      aria-label="Open My Squad"
      className="hidden md:block fixed right-0 top-1/2 -translate-y-1/2 z-20 group"
    >
      <div className="flex flex-col items-center gap-2 px-2 py-4 rounded-l-xl bg-night-mid/90 border border-tower-gold/40 border-r-0 backdrop-blur-sm shadow-lg group-hover:bg-night-mid transition">
        {/* Vertical "My Squad" label */}
        <span
          className="text-tower-cream font-semibold text-sm tracking-wide"
          style={{
            writingMode: 'vertical-rl',
            transform: 'rotate(180deg)',
          }}
        >
          My Squad
        </span>
        <span className="text-tower-gold text-lg" aria-hidden>
          📋
        </span>
      </div>
    </button>
  )
}
