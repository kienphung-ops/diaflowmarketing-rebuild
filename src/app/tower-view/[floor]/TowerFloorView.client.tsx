'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { SceneSkeleton } from '@/components/fallback/SceneSkeleton'
import type { FloorPreview } from '@/lib/towerFloorPreview'

const SceneCanvas = dynamic(
  () => import('@/components/scene/SceneCanvas').then(m => ({ default: m.SceneCanvas })),
  { ssr: false, loading: () => <SceneSkeleton /> }
)

interface Props {
  preview: FloorPreview
}

export default function TowerFloorViewClient({ preview }: Props) {
  const prevFloor = preview.floor > 1 ? preview.floor - 1 : null
  const nextFloor = preview.floor < preview.totalFloors ? preview.floor + 1 : null

  return (
    <main className="fixed inset-0 overflow-hidden bg-[#04040d]">
      {/* Top chrome — back button + floor stats. No header buttons, no
          interactive controls; this view is purely a preview. */}
      <header className="fixed top-0 inset-x-0 z-10 flex items-center justify-between px-3 md:px-4 py-2.5 md:py-3 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2">
          <Link
            href="/tower"
            className="px-2.5 md:px-3 py-1.5 rounded-md bg-night-mid/70 border border-white/10 text-tower-cream text-xs md:text-sm hover:bg-night-mid transition flex items-center gap-1.5"
            aria-label="Back to tower"
          >
            <span aria-hidden>←</span>
            <span className="hidden sm:inline">Back to tower</span>
            <span className="sm:hidden">Back</span>
          </Link>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-md bg-night-mid/60 border border-white/5 text-xs text-tower-cream/80">
            <span className="text-tower-gold font-semibold">Floor {preview.floor}</span>
            <span className="opacity-40">/</span>
            <span>{preview.totalFloors}</span>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5">
          {prevFloor && (
            <Link
              href={`/tower-view/${prevFloor}`}
              className="px-2.5 py-1.5 rounded-md bg-night-mid/70 border border-white/10 text-tower-cream text-xs hover:bg-night-mid transition"
              aria-label={`Floor ${prevFloor}`}
            >
              ← F{prevFloor}
            </Link>
          )}
          {nextFloor && (
            <Link
              href={`/tower-view/${nextFloor}`}
              className="px-2.5 py-1.5 rounded-md bg-night-mid/70 border border-white/10 text-tower-cream text-xs hover:bg-night-mid transition"
              aria-label={`Floor ${nextFloor}`}
            >
              F{nextFloor} →
            </Link>
          )}
        </div>
      </header>

      {/* Floor info card — top-left under the header chrome */}
      <div
        className="absolute top-16 left-3 md:left-4 z-20 px-4 py-2.5 rounded-2xl bg-black/65 backdrop-blur-md border border-white/15 max-w-[92vw] md:max-w-[300px]"
        style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.5)' }}
      >
        <div className="text-[10px] text-white/55 uppercase tracking-[0.18em] mb-0.5">
          Preview
        </div>
        <div className="text-lg md:text-xl font-bold text-amber-300 leading-tight">
          {preview.floorLabel}
        </div>
        <div className="text-[11px] text-white/70 mt-0.5">
          {preview.maxTeammates} teammates · Unlock at {preview.invitesRequired} invite
          {preview.invitesRequired === 1 ? '' : 's'}
        </div>
      </div>

      {/* The actual scene — readonly, no drag, no clicks */}
      <SceneCanvas
        onboardingStep="done"
        companyName={preview.companyName}
        recruitedCharacters={preview.teammates}
        currentFloor={preview.floor}
        unlockedItemKeys={preview.unlockedItemKeys}
        onFloorClick={() => {}}
        readonly
      />
    </main>
  )
}
