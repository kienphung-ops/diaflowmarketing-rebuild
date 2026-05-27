'use client'

/**
 * Tiny module-scoped store mapping character slug → live screen
 * position (pixels, relative to the viewport). The 3D scene's
 * `Character` component writes into this store every frame via
 * `setAnchor()`, and modals/popovers consume it via the
 * `useAnchorPosition()` hook below.
 *
 * Why a module-scoped Map instead of React state: the writer
 * (Character `useFrame`) runs ~60 fps and the reader (modal) needs
 * the same cadence. Going through `useState` would force a React
 * re-render every tick — wasteful and would tear the modal's open/
 * close animation. Refs sidestep that entirely:
 *
 *   - Writer mutates the Map and notifies subscribers synchronously.
 *   - Subscribers store the latest value in their own ref and use a
 *     requestAnimationFrame loop to push it into the DOM via
 *     `element.style.transform`. Zero re-renders, smooth follow.
 *
 * If the consuming modal is closed, it doesn't subscribe and the
 * store is read-only inert state — no cost.
 */

import { useEffect, useRef } from 'react'

type AnchorPos = { x: number; y: number }
type Listener = (pos: AnchorPos) => void

const positions = new Map<string, AnchorPos>()
const listeners = new Map<string, Set<Listener>>()

/** Writer — called from the 3D scene per frame. */
export function setAnchorPosition(slug: string, x: number, y: number): void {
  const prev = positions.get(slug)
  if (prev && prev.x === x && prev.y === y) return
  const next = { x, y }
  positions.set(slug, next)
  const subs = listeners.get(slug)
  if (subs) subs.forEach(cb => cb(next))
}

/** Synchronous reader — useful at modal-mount time for an initial
 *  paint before the first rAF tick lands. Returns `null` if the
 *  character hasn't been registered yet (e.g. still spawning in). */
export function getAnchorPosition(slug: string): AnchorPos | null {
  return positions.get(slug) ?? null
}

function subscribe(slug: string, cb: Listener): () => void {
  let set = listeners.get(slug)
  if (!set) {
    set = new Set()
    listeners.set(slug, set)
  }
  set.add(cb)
  return () => {
    set?.delete(cb)
    if (set && set.size === 0) listeners.delete(slug)
  }
}

/**
 * Subscribe to a character's screen position and apply it to the
 * returned element ref every frame via `style.transform`.
 *
 * Usage:
 *
 *   const anchorRef = useAnchorPosition('mia')
 *   return <div ref={anchorRef} style={{ position: 'fixed', left: 0, top: 0 }}>...</div>
 *
 * The div is positioned absolutely at the viewport origin and the
 * transform places it at the character's current screen pixel. Add
 * any per-modal offset via additional CSS transforms or
 * margin/translate inside the children.
 *
 * Pass `slug = null` to opt out (e.g. modal not anchored — useful
 * for the same component to support both centered and anchored
 * modes via a single prop).
 *
 * Edge-aware mode (`opts.flipEdge`): when set, the hook owns the
 * FULL position of the card — measure its rendered box and place it
 * beside the character, flipping to the other side and clamping to
 * the viewport when there isn't room. Callers that use this must NOT
 * apply their own static offset transform (the hook overwrites it).
 * When `flipEdge` is off (default) behavior is unchanged: the element
 * is parked at the character pixel and the caller adds its own offset.
 */
interface AnchorOpts {
  /** Horizontal gap (px) between the character pixel and the card edge. */
  gap?: number
  /** When true, flip the card to the character's left if it would
   *  overflow the right viewport edge, and clamp Y to stay on-screen. */
  flipEdge?: boolean
  /** When true, vertically centre the card on the character pixel
   *  (translate up by half its height). */
  vCenter?: boolean
}

export function useAnchorPosition(slug: string | null, opts?: AnchorOpts) {
  const elRef = useRef<HTMLDivElement | null>(null)
  // Keep the latest target position in a ref so the rAF loop doesn't
  // depend on React state. The loop reads this ref and writes DOM.
  const latestRef = useRef<AnchorPos | null>(slug ? getAnchorPosition(slug) : null)

  const gap = opts?.gap ?? 28
  const flipEdge = !!opts?.flipEdge
  const vCenter = !!opts?.vCenter

  useEffect(() => {
    if (!slug) return
    latestRef.current = getAnchorPosition(slug)
    const unsubscribe = subscribe(slug, pos => {
      latestRef.current = pos
    })

    const MARGIN = 8 // min px gap from any viewport edge

    let rafId = 0
    function tick() {
      const el = elRef.current
      const pos = latestRef.current
      if (el && pos) {
        if (flipEdge) {
          // Hook owns the full placement. Measure the rendered card so
          // we know whether it fits to the right of the character.
          const w = el.offsetWidth
          const h = el.offsetHeight
          const vw = window.innerWidth
          const vh = window.innerHeight

          // Prefer the right side; flip left when it would clip.
          let x = pos.x + gap
          if (x + w > vw - MARGIN) {
            const leftX = pos.x - gap - w
            // Only flip if the left side actually has more room;
            // otherwise clamp on the right so we never push off-screen.
            x = leftX >= MARGIN ? leftX : Math.max(MARGIN, vw - MARGIN - w)
          }

          let y = vCenter ? pos.y - h / 2 : pos.y
          // Clamp vertically so the card never runs off top/bottom.
          y = Math.min(Math.max(y, MARGIN), vh - MARGIN - h)

          el.style.transform = `translate3d(${x}px, ${y}px, 0)`
        } else {
          // translate3d gets a compositor-only path on most browsers,
          // avoiding layout thrash even at 60fps.
          el.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`
        }
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(rafId)
      unsubscribe()
    }
  }, [slug, gap, flipEdge, vCenter])

  return elRef
}
