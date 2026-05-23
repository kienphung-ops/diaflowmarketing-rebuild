'use client'

import { useEffect, useState } from 'react'

/**
 * Loading state for the 3D scene chunk + textures. Shown by
 * `dynamic(SceneCanvas, { loading: () => <SceneSkeleton /> })` in
 * TowerLanding / FloorVisitor / TowerFloorView while the JS chunk is
 * still being parsed and the first textures are streaming in.
 *
 * Why "fake" progress instead of `useProgress` from drei: that hook
 * has to be called INSIDE a Canvas, but this skeleton renders BEFORE
 * the Canvas exists (the chunk hasn't loaded yet). We can't reach
 * the texture loader's real progress from here. We compensate by:
 *
 *   - Running a deterministic curve that approaches 90% by ~2s and
 *     parks there — typical cold-cache time for the chunk + first
 *     window image. The bar visually "completes" when the Canvas
 *     mounts and the skeleton unmounts (real signal, no fakery).
 *   - Showing the three teammate placeholders so the user knows
 *     what's loading.
 *
 * This is far better than the previous static skeleton — users now
 * see motion instead of suspecting a hang.
 */
export function SceneSkeleton() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    // Smooth approach to ~92% over 2.5s, slowing as it gets closer.
    // The exponential decay means each tick adds less, mimicking a
    // real download that's mostly tail latency. When the scene mounts
    // the skeleton unmounts and the user effectively sees "100%".
    const start = performance.now()
    let raf = 0
    function tick() {
      const elapsed = performance.now() - start
      // 1 - e^(-elapsed/1200) → 0..~0.99 over a few seconds
      const target = (1 - Math.exp(-elapsed / 1200)) * 92
      setProgress(target)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="w-screen h-screen bg-[#1a1a2e] flex flex-col items-center justify-center gap-8">
      <div className="text-center">
        <p className="text-white/40 text-xs tracking-[0.3em] uppercase mb-3">Loading</p>
        <p className="text-white/70 text-2xl font-light tracking-widest animate-pulse">
          Meet your AI teammates
        </p>
      </div>

      {/* Three placeholder figures matching the trio the user is
          about to see (Iris / Mia / Leo) — pulsing so the eye knows
          something is happening even when the progress bar is
          briefly idle. */}
      <div className="flex gap-10 mt-4">
        {['mia', 'iris', 'leo'].map((name) => (
          <div key={name} className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded bg-white/10 animate-pulse" />
            <div className="w-4 h-6 rounded bg-white/10 animate-pulse" />
            <div className="w-4 h-8 rounded bg-white/10 animate-pulse" />
            <div className="w-20 h-2.5 rounded bg-white/10 animate-pulse" />
            <div className="w-14 h-2 rounded bg-white/8 animate-pulse" />
          </div>
        ))}
      </div>

      {/* Progress bar — see comment above for why this is time-based
          rather than tied to a real loader. The bar plus the percent
          gives users a "things are happening" signal that the old
          static skeleton lacked. */}
      <div className="w-64 mt-6">
        <div className="h-1 rounded-full bg-white/8 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-400 to-pink-400 rounded-full transition-[width] duration-150 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-center text-white/30 text-[10px] mt-2 tabular-nums tracking-wider">
          {Math.round(progress)}%
        </p>
      </div>
    </div>
  )
}
