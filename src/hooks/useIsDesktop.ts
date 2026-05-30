'use client'

import { useEffect, useState } from 'react'

/**
 * `true` when the viewport matches Tailwind's `md` breakpoint
 * (≥ 768px). Used by character-anchored pop-ups (TeammateBubble,
 * TeammateEditModal, MiaInfoCard, IrisHireModal) to decide whether
 * to bind the live-position anchor ref or render as a bottom sheet.
 *
 * Starts with `false` so SSR + the first mobile render don't try to
 * apply the desktop transform on a phone. After mount the value
 * settles to the real viewport state via matchMedia, and subscribes
 * to changes so a tablet rotation or browser-window resize across
 * the threshold swaps the mode live.
 */
export function useIsDesktop(): boolean {
  // SSR-safe default — assume mobile until the client tells us
  // otherwise. The first effect run reconciles to the actual width.
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(min-width: 768px)')
    setIsDesktop(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    // `addEventListener('change')` works in modern Safari + Chrome;
    // older Safari only has `addListener` (deprecated). We attempt the
    // new API and fall back so this hook stays correct on iOS 13.
    if (mq.addEventListener) {
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    }
    // Safari < 14 fallback (addListener / removeListener). The
    // current MediaQueryList types in lib.dom.d.ts include both APIs
    // as Function aliases — no ts-ignore needed, but we keep the
    // call-site narrow so the deprecated path is obvious in review.
    const legacy = mq as unknown as {
      addListener: (cb: (e: MediaQueryListEvent) => void) => void
      removeListener: (cb: (e: MediaQueryListEvent) => void) => void
    }
    legacy.addListener(onChange)
    return () => legacy.removeListener(onChange)
  }, [])

  return isDesktop
}
