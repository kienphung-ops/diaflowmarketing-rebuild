'use client'

/**
 * useFloorPresence — heartbeat ping + live visitor count for a given
 * floor (identified by the owner's referral code).
 *
 * Two modes:
 *   - `mode: 'visit'` — you're a viewer, send your visitorId so the
 *     server counts you among active visitors. Use on /floor/[code].
 *   - `mode: 'observe'` — you only want the count without registering
 *     (e.g. the owner watching their own floor from /). No visitorId
 *     is sent, so the owner isn't counted as a visitor of themselves.
 *
 * Polls every `intervalMs` (default 5s — comfortably inside the
 * server's 30-second active window). Pauses when the tab is hidden
 * to avoid burning requests in the background.
 */

import { useEffect, useState } from 'react'
import { getVisitorId } from '@/lib/visitorId'

interface Options {
  code: string | null
  mode?: 'visit' | 'observe'
  intervalMs?: number
}

export function useFloorPresence({ code, mode = 'visit', intervalMs = 5_000 }: Options): number {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!code) return
    // Single AbortController for the entire hook lifecycle — every
    // tick re-uses the same signal, and unmount aborts whatever's
    // still in flight. Without this, a 5-second polling component
    // can leave a pending request that resolves into setState after
    // the parent has already unmounted.
    const ac = new AbortController()

    async function tick() {
      if (ac.signal.aborted || document.hidden) return
      try {
        const url = new URL(`/api/floor/${code}/visitors`, window.location.origin)
        if (mode === 'visit') {
          const v = getVisitorId()
          if (v) url.searchParams.set('v', v)
        }
        const r = await fetch(url.toString(), { cache: 'no-store', signal: ac.signal })
        if (!r.ok) return
        const j = await r.json()
        if (ac.signal.aborted) return
        if (typeof j.count === 'number') setCount(j.count)
      } catch (err) {
        // AbortError is expected on unmount — swallow it. Network /
        // server errors also swallow because presence is best-effort.
        if ((err as Error).name !== 'AbortError') {
          /* ignore */
        }
      }
    }

    void tick()
    const interval = setInterval(tick, intervalMs)
    return () => {
      clearInterval(interval)
      ac.abort()
    }
  }, [code, mode, intervalMs])

  return count
}
