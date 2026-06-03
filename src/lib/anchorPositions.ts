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
  /** When true, SNAPSHOT the character's position once (at open) and
   *  keep the card static there — it stops following the character's
   *  per-frame wander / bob. Use for modals whose content would be hard
   *  to interact with if the card jittered (e.g. Leo's video drawer).
   *  The card still re-clamps on window resize. */
  freeze?: boolean
}

export function useAnchorPosition(slug: string | null, opts?: AnchorOpts) {
  const elRef = useRef<HTMLDivElement | null>(null)
  // Keep the latest target position in a ref so the rAF loop doesn't
  // depend on React state. The loop reads this ref and writes DOM.
  const latestRef = useRef<AnchorPos | null>(slug ? getAnchorPosition(slug) : null)

  const gap = opts?.gap ?? 28
  const flipEdge = !!opts?.flipEdge
  const vCenter = !!opts?.vCenter
  const freeze = !!opts?.freeze

  useEffect(() => {
    if (!slug) return

    const MARGIN = 8 // min px gap from any viewport edge

    // Shared placement: write `pos` onto the element, honouring
    // flipEdge / vCenter / clamping. translate3d gets a compositor-only
    // path on most browsers, avoiding layout thrash even at 60fps.
    function apply(pos: AnchorPos | null) {
      const el = elRef.current
      if (!el || !pos) return
      if (flipEdge) {
        // Hook owns the full placement. Measure the rendered card so we
        // know whether it fits to the right of the character.
        const w = el.offsetWidth
        const h = el.offsetHeight
        const vw = window.innerWidth
        const vh = window.innerHeight

        let x = pos.x + gap
        if (x + w > vw - MARGIN) {
          const leftX = pos.x - gap - w
          x = leftX >= MARGIN ? leftX : Math.max(MARGIN, vw - MARGIN - w)
        }
        let y = vCenter ? pos.y - h / 2 : pos.y
        y = Math.min(Math.max(y, MARGIN), vh - MARGIN - h)
        el.style.transform = `translate3d(${x}px, ${y}px, 0)`
      } else {
        el.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`
      }
    }

    // FREEZE: snapshot the character's position once and keep the card
    // static there. The character keeps moving in the scene, but the
    // card no longer follows its wander / bob — so video / interactive
    // content stays still. Re-applies on resize so the clamp stays valid.
    if (freeze) {
      let captured = getAnchorPosition(slug)
      let rafId = 0
      let unsub: () => void = () => {}
      // rAF so the card is laid out before flipEdge measures it.
      const placeOnce = () => apply(captured)
      if (captured) {
        rafId = requestAnimationFrame(placeOnce)
      } else {
        // Position not registered yet (character still spawning) — grab
        // the first sample, place once, then stop following.
        unsub = subscribe(slug, pos => {
          if (captured) return
          captured = pos
          rafId = requestAnimationFrame(placeOnce)
          unsub()
        })
      }
      const onResize = () => placeOnce()
      window.addEventListener('resize', onResize)
      return () => {
        cancelAnimationFrame(rafId)
        unsub()
        window.removeEventListener('resize', onResize)
      }
    }

    // LIVE (default): follow the character every frame.
    latestRef.current = getAnchorPosition(slug)
    const unsubscribe = subscribe(slug, pos => {
      latestRef.current = pos
    })
    let rafId = 0
    function tick() {
      apply(latestRef.current)
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(rafId)
      unsubscribe()
    }
  }, [slug, gap, flipEdge, vCenter, freeze])

  return elRef
}
