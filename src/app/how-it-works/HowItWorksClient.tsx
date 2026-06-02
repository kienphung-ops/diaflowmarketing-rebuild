'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useState } from 'react'
import { SceneSkeleton } from '@/components/fallback/SceneSkeleton'
import { DISCORD_URL } from '@/lib/links'
import { trackEvent } from '@/lib/tracking'

const SceneCanvas = dynamic(
  () => import('@/components/scene/SceneCanvas').then(m => ({ default: m.SceneCanvas })),
  { ssr: false, loading: () => <SceneSkeleton /> }
)

// Hardcoded demo state — shows what a shared invite link looks like to a
// visitor. Mirrors the source cũ /HowShareLookLike demo, adapted to the
// rebuilt scene signature.
const DEMO_SQUAD_NAME = 'Phantom Eagle'
const DEMO_COMPANY = 'Acme Co.'
const DEMO_CURRENT_FLOOR = 3
const DEMO_RECRUITED = [
  { name: 'Alex', role: 'Executive Operations Assistant' },
  { name: 'Sam', role: 'Customer Success Lead' },
]
const DEMO_UNLOCKED = [
  'company_picture_frame',
  'floor_lamp',
  'basic_chair_desk',
]

export default function HowItWorksClient() {
  const [showTower, setShowTower] = useState(false)

  return (
    <main className="fixed inset-0 overflow-hidden font-sans">
      <SceneCanvas
        onboardingStep="done"
        companyName={DEMO_COMPANY}
        recruitedCharacters={DEMO_RECRUITED}
        showTower={showTower}
        currentFloor={DEMO_CURRENT_FLOOR}
        unlockedItemKeys={DEMO_UNLOCKED}
        onFloorClick={n => {
          if (n === DEMO_CURRENT_FLOOR) setShowTower(false)
        }}
      />

      {/* Top-left "you're visiting" card */}
      <div className="fixed top-4 left-4 z-20 max-w-xs bg-night-deep/85 border border-white/10 rounded-2xl p-4 backdrop-blur-md text-tower-cream pointer-events-none">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-[10px] uppercase tracking-widest text-tower-cream/40 font-semibold">
            You&apos;re visiting
          </span>
        </div>
        <div className="text-lg font-extrabold leading-tight">{DEMO_SQUAD_NAME}</div>
        <div className="text-xs text-tower-cream/50 mb-2">🏢 {DEMO_COMPANY}</div>
        <div className="inline-flex items-center gap-1 bg-purple-500/15 border border-purple-500/30 text-purple-300 px-3 py-1 rounded-full text-[11px] font-bold">
          ▲ Floor {DEMO_CURRENT_FLOOR} · Diaflow Tower
        </div>
      </div>

      {/* Steps explainer — top-right */}
      <div className="fixed top-4 right-4 z-20 max-w-sm bg-night-deep/85 border border-white/10 rounded-2xl p-5 backdrop-blur-md text-tower-cream">
        <div className="text-[10px] uppercase tracking-widest text-tower-gold/80 font-semibold mb-1">
          How it works
        </div>
        <h2 className="text-xl font-bold mb-3">Build your AI office</h2>
        <ol className="space-y-2 text-sm text-tower-cream/85">
          <li className="flex gap-2">
            <span className="text-tower-gold font-bold">1.</span>
            <span>Name your team and recruit your first AI teammate.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-tower-gold font-bold">2.</span>
            <span>Share your invite link — each friend who joins unlocks a new floor + decor.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-tower-gold font-bold">3.</span>
            <span>Reach Level 20 to earn free beta access + featured launch spot.</span>
          </li>
        </ol>
        <div className="mt-4 flex gap-2">
          <Link
            href="/"
            className="flex-1 text-center px-3 py-2 rounded-md bg-tower-gold text-night-deep font-semibold text-sm hover:bg-tower-gold/90"
          >
            Build your own →
          </Link>
          <a
            href={DISCORD_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackEvent('discord_click', { source: 'how_it_works' })}
            className="px-3 py-2 rounded-md bg-night-mid border border-white/10 text-tower-cream text-sm hover:border-purple-400/40"
          >
            Discord
          </a>
        </div>
      </div>

      {/* Bottom-right view tower toggle */}
      <button
        onClick={() => setShowTower(s => !s)}
        className="fixed bottom-6 right-6 z-20 flex items-center gap-2 bg-night-deep/90 border border-white/15 rounded-xl px-4 py-2.5 text-sm font-bold text-tower-cream shadow-lg hover:scale-[1.03] transition"
      >
        <span>🏢</span>
        {showTower ? 'Back to room' : 'View Tower'}
        {!showTower && (
          <span className="ml-1 bg-purple-500 text-white rounded-md px-2 py-0.5 text-[10px] font-extrabold">
            Floor {DEMO_CURRENT_FLOOR}
          </span>
        )}
      </button>

      {/* Bottom-center CTA */}
      {!showTower && (
        <Link
          href="/"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20 bg-night-deep/85 border border-white/12 rounded-full px-6 py-2.5 text-sm text-tower-cream/80 hover:text-tower-cream hover:border-white/25 backdrop-blur-sm"
        >
          Like what you see? <strong className="text-tower-cream">Build your own office in 30 seconds</strong> →
        </Link>
      )}
    </main>
  )
}
