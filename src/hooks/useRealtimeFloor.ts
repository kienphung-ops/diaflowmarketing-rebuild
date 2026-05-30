'use client'

import { useEffect, useRef } from 'react'

interface FloorUpEvent {
  currentFloor: number
  totalInvites: number
  /** Optional on legacy payloads — present in snapshots + floor-up +
   *  invite-accepted from the spinTokens-aware server build onward. */
  spinTokens?: number
  unlockedItemKeys: string[]
}

interface InviteAcceptedEvent {
  delta: number
  totalInvites: number
  spinTokens?: number
}

/** Standalone event for non-referral spin-token changes (daily claim
 *  in another tab, task completion, anon-spin migration etc.). Fires
 *  whenever the server-side value differs from what this stream last
 *  observed for the user — referral grants ALSO trigger this event
 *  alongside `invite-accepted`; the client just always assigns the
 *  same final `spinTokens` from whichever fires last. */
interface SpinTokensEvent {
  spinTokens: number
  delta: number
}

interface Args {
  enabled: boolean
  onFloorUp?: (data: FloorUpEvent) => void
  onInviteAccepted?: (data: InviteAcceptedEvent) => void
  onSnapshot?: (data: FloorUpEvent) => void
  onSpinTokens?: (data: SpinTokensEvent) => void
}

/**
 * Subscribes to /api/events via the browser's native EventSource, which
 * gives us auto-reconnect for free when the Vercel function window closes.
 * Server pushes `snapshot` on connect, then `floor-up` / `invite-accepted`
 * when the corresponding fields move.
 */
export function useRealtimeFloor({
  enabled,
  onFloorUp,
  onInviteAccepted,
  onSnapshot,
  onSpinTokens,
}: Args) {
  const onFloorUpRef = useRef(onFloorUp)
  const onInviteAcceptedRef = useRef(onInviteAccepted)
  const onSnapshotRef = useRef(onSnapshot)
  const onSpinTokensRef = useRef(onSpinTokens)
  useEffect(() => {
    onFloorUpRef.current = onFloorUp
  }, [onFloorUp])
  useEffect(() => {
    onInviteAcceptedRef.current = onInviteAccepted
  }, [onInviteAccepted])
  useEffect(() => {
    onSnapshotRef.current = onSnapshot
  }, [onSnapshot])
  useEffect(() => {
    onSpinTokensRef.current = onSpinTokens
  }, [onSpinTokens])

  useEffect(() => {
    if (!enabled) return
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return

    const es = new EventSource('/api/events')
    es.addEventListener('snapshot', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as FloorUpEvent
        onSnapshotRef.current?.(data)
      } catch {
        /* ignore */
      }
    })
    es.addEventListener('floor-up', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as FloorUpEvent
        onFloorUpRef.current?.(data)
      } catch {
        /* ignore */
      }
    })
    es.addEventListener('invite-accepted', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as InviteAcceptedEvent
        onInviteAcceptedRef.current?.(data)
      } catch {
        /* ignore */
      }
    })
    es.addEventListener('spin-tokens', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as SpinTokensEvent
        onSpinTokensRef.current?.(data)
      } catch {
        /* ignore */
      }
    })
    return () => {
      es.close()
    }
  }, [enabled])
}
