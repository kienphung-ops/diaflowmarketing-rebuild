'use client'

import { useEffect, useRef } from 'react'

interface MeResponse {
  currentFloor: number
  totalInvites: number
  unlockedItems?: { itemKey: string }[]
}

interface Args {
  enabled: boolean
  intervalMs?: number
  onFloorUp: (data: { currentFloor: number; totalInvites: number; unlockedItemKeys: string[] }) => void
  /** Fired when totalInvites increases (regardless of floor change). */
  onInviteAccepted?: (data: { delta: number; totalInvites: number }) => void
}

/**
 * Poll /api/me on an interval. When the server-reported currentFloor moves
 * above the last seen value, fire onFloorUp — that's the inviter receiving
 * credit for an invite that just verified.
 */
export function useFloorPolling({ enabled, intervalMs = 20_000, onFloorUp, onInviteAccepted }: Args) {
  const lastFloorRef = useRef<number | null>(null)
  const lastInvitesRef = useRef<number | null>(null)
  const onFloorUpRef = useRef(onFloorUp)
  const onInviteAcceptedRef = useRef(onInviteAccepted)
  useEffect(() => {
    onFloorUpRef.current = onFloorUp
  }, [onFloorUp])
  useEffect(() => {
    onInviteAcceptedRef.current = onInviteAccepted
  }, [onInviteAccepted])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    async function tick() {
      try {
        const res = await fetch('/api/me')
        if (!res.ok) return
        const data: MeResponse = await res.json()
        if (cancelled) return
        const prevFloor = lastFloorRef.current
        const prevInvites = lastInvitesRef.current
        if (prevFloor != null && data.currentFloor > prevFloor) {
          onFloorUpRef.current({
            currentFloor: data.currentFloor,
            totalInvites: data.totalInvites,
            unlockedItemKeys: data.unlockedItems?.map(i => i.itemKey) ?? [],
          })
        }
        if (prevInvites != null && data.totalInvites > prevInvites) {
          onInviteAcceptedRef.current?.({
            delta: data.totalInvites - prevInvites,
            totalInvites: data.totalInvites,
          })
        }
        lastFloorRef.current = data.currentFloor
        lastInvitesRef.current = data.totalInvites
      } catch {
        // ignore network errors
      }
    }

    void tick()
    const id = setInterval(tick, intervalMs)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [enabled, intervalMs])
}
