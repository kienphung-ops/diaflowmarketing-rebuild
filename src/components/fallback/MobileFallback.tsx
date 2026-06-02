'use client'

import { CHARACTERS } from '@/components/scene/characters/characters.config'

export function MobileFallback() {
  return (
    <div className="min-h-screen bg-[#1a1a2e] flex flex-col items-center justify-start p-6 pt-12 gap-6">
      <div className="text-center mb-4">
        <h1 className="text-white text-3xl font-bold tracking-tight">Diaflow teammate</h1>
        <p className="text-white/50 text-sm mt-1">AI Teammates</p>
      </div>
      <p className="text-white/40 text-xs text-center max-w-xs">
        Best on desktop. Open this page on a laptop to walk into the office.
      </p>

      <div className="flex flex-col gap-3 w-full max-w-sm mt-4">
        {CHARACTERS.map(char => (
          <div
            key={char.slug}
            className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 text-left"
          >
            <div
              className="w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center text-lg font-bold text-white"
              style={{ backgroundColor: char.clothesColor }}
            >
              {char.name[0]}
            </div>
            <div>
              <p className="text-white font-semibold">{char.name}</p>
              <p className="text-white/50 text-sm">{char.role}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
