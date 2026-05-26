'use client'

import { useCallback, useEffect, useRef } from 'react'

/**
 * Returns a set of handlers for a modal backdrop that fires `onClose`
 * ONLY when the user actually presses + releases on the backdrop
 * itself — not when the OS dispatches a stray synthetic click after
 * tapping something else (like the character that opened the modal).
 *
 * Root-cause writeup — the character-modal flash-and-close bug:
 *
 *   1. User taps a minifigure character in the office scene.
 *   2. React handles the pointerup → opens the modal.
 *   3. ~50ms later the OS dispatches a synthetic CLICK at the same
 *      screen coordinates (touch devices always do this after a tap).
 *   4. The modal is already mounted by step 3 → its backdrop
 *      (fixed inset-0, z-40) is now the topmost element at the tap
 *      coords → the synthetic click hits the backdrop's onClose.
 *   5. Modal closes the same frame it appeared in.
 *
 * Two layers of defence here:
 *
 *   (a) **press-origin tracking** — onPointerDown records whether the
 *       press LANDED on the backdrop itself. onClick then only calls
 *       onClose if that flag is set. The synthetic click after a tap
 *       on a character button never produces a corresponding
 *       pointerdown on the backdrop (the backdrop didn't exist when
 *       the original press happened), so the flag stays false and
 *       onClose doesn't fire. This is the primary defence.
 *
 *   (b) **time gate** — we also refuse onClose for the first
 *       `delayMs` after `open` flips on. Belt-and-braces for edge
 *       cases where (a) is bypassed (e.g. a browser that synthesises
 *       a full pointerdown→pointerup→click sequence after the tap).
 *
 * ESC + × button should call `onClose` directly (not through these
 * handlers) so keyboard / explicit-button dismissal stays instant.
 */
export function useBackdropDismissGuard(
  open: boolean,
  onClose: () => void,
  delayMs = 250,
): {
  onPointerDown: (e: React.PointerEvent) => void
  onClick: (e: React.MouseEvent) => void
} {
  const readyAtRef = useRef<number>(0)
  // Was the most-recent pointerdown received by the backdrop itself
  // (and not by some child)? Defaults to false on every gesture so a
  // synthetic click that never had a real pointerdown can't fire close.
  const pressOnBackdropRef = useRef<boolean>(false)

  useEffect(() => {
    if (!open) {
      readyAtRef.current = 0
      pressOnBackdropRef.current = false
      return
    }
    readyAtRef.current = Date.now() + delayMs
  }, [open, delayMs])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    // Only count presses that land DIRECTLY on the backdrop element
    // — not on a child like the modal card. currentTarget is the
    // element the listener is attached to; target is the actual hit.
    pressOnBackdropRef.current = e.target === e.currentTarget
  }, [])

  const onClick = useCallback(
    (e: React.MouseEvent) => {
      // Only the actual backdrop element can dismiss — not bubbled
      // clicks from a child node (which would mean the modal card
      // was clicked).
      if (e.target !== e.currentTarget) return
      // Belt: refuse during the just-opened window.
      if (Date.now() < readyAtRef.current) return
      // Braces: require a matching pointerdown that started here.
      if (!pressOnBackdropRef.current) return
      pressOnBackdropRef.current = false
      onClose()
    },
    [onClose],
  )

  return { onPointerDown, onClick }
}
