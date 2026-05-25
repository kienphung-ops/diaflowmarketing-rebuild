'use client'

import { useEffect, useState } from 'react'
import { useAnchorPosition } from '@/lib/anchorPositions'
import { useIsDesktop } from '@/hooks/useIsDesktop'

interface Teammate {
  id: string
  name: string
  role: string
}

interface Props {
  open: boolean
  teammate: Teammate | null
  onClose: () => void
  onSave: (id: string, patch: { name: string; role: string }) => void
  onDelete?: (id: string) => void
  /** Resets just this teammate back to their default position — handy
   *  when the user has dragged them off-screen / behind the back wall. */
  onResetPosition?: (id: string) => void
  /** Anchor slug — the scene character this edit modal belongs to.
   *  Typically `recruited-{index}` for user-added teammates. When set,
   *  the modal floats next to that character; otherwise it renders
   *  centered like before. */
  anchorSlug?: string | null
}

export function TeammateEditModal({ open, teammate, onClose, onSave, onDelete, onResetPosition, anchorSlug }: Props) {
  // Only bind the live-anchor ref on desktop — on mobile we render
  // as a bottom sheet anchored to the viewport, not to the
  // character, so the transform-per-frame loop would just fight the
  // sheet's position.
  const isDesktop = useIsDesktop()
  const anchorRef = useAnchorPosition(
    open && isDesktop ? anchorSlug ?? null : null,
  )
  const anchored = !!anchorSlug && isDesktop
  const [name, setName] = useState('')
  const [role, setRole] = useState('')

  useEffect(() => {
    if (teammate) {
      setName(teammate.name)
      setRole(teammate.role)
    }
  }, [teammate])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!open || !teammate) return null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!teammate) return
    onSave(teammate.id, { name: name.trim() || teammate.name, role: role.trim() || teammate.role })
    onClose()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      // Mobile: full-bleed flex container with a backdrop and the
      // form pinned to the bottom edge (sheet). Desktop behaviour
      // depends on whether we have a character anchor:
      //   anchored=true  → the form is absolutely positioned via the
      //                    anchor ref, so the flex centering is moot
      //                    and the backdrop disappears (the popover
      //                    floats next to the character).
      //   anchored=false → the form is centered in the viewport with
      //                    the same backdrop the original modal used.
      className={
        'fixed inset-0 z-30 flex items-end md:items-center justify-center backdrop-blur-sm bg-black/60 ' +
        (anchored ? 'md:bg-transparent md:backdrop-blur-0' : '')
      }
      onClick={onClose}
    >
      <div
        ref={anchored ? anchorRef : undefined}
        onClick={anchored ? e => e.stopPropagation() : undefined}
        className={
          // Wrapper takes its shape from the device:
          //   mobile  → full-width, sits at the bottom of the flex.
          //   desktop → absolute, lives at top:0/left:0 and gets a
          //             per-frame transform from the anchor ref.
          (anchored
            ? 'md:absolute md:top-0 md:left-0 md:pointer-events-none w-full md:w-auto '
            : 'w-full md:w-auto md:contents ')
        }
        style={anchored ? { willChange: 'transform' } : undefined}
      >
      <form
        onClick={e => e.stopPropagation()}
        onSubmit={handleSubmit}
        className={
          // Form shell — bottom sheet on mobile, anchored / centered
          // card on desktop. Mobile gets a sheet grip + safe-area
          // bottom inset; desktop keeps the existing 2xl rounded
          // card with 6-unit padding.
          'w-full bg-night-mid border-t border-tower-gold/40 text-tower-cream shadow-2xl ' +
          'rounded-t-3xl md:rounded-2xl md:border md:border-tower-gold/40 ' +
          'pt-3 px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:p-6 ' +
          (anchored
            ? 'md:pointer-events-auto md:w-[min(360px,calc(100vw-32px))] md:max-w-sm'
            : 'md:max-w-sm md:mx-auto')
        }
        style={anchored ? { transform: 'translate(28px, -50%)' } : undefined}
      >
        {/* Mobile sheet grip */}
        <div className="md:hidden flex justify-center -mt-1 mb-3" aria-hidden>
          <div className="w-9 h-1 rounded-full bg-white/20" />
        </div>
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-lg font-bold">Edit teammate</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-tower-cream/50 hover:text-tower-cream text-xl">
            ×
          </button>
        </div>

        <label className="block space-y-1 mb-3">
          <span className="text-xs uppercase tracking-wider text-tower-cream/50">Name</span>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value.slice(0, 40))}
            className="w-full px-3 py-2 rounded-md bg-night-deep border border-white/10 focus:border-tower-gold focus:outline-none text-sm"
          />
        </label>

        <label className="block space-y-1 mb-5">
          <span className="text-xs uppercase tracking-wider text-tower-cream/50">Role</span>
          <input
            value={role}
            onChange={e => setRole(e.target.value.slice(0, 60))}
            className="w-full px-3 py-2 rounded-md bg-night-deep border border-white/10 focus:border-tower-gold focus:outline-none text-sm"
          />
        </label>

        <div className="flex items-center gap-2">
          <button type="submit" className="flex-1 px-4 py-2 rounded-md bg-tower-gold text-night-deep font-semibold text-sm">
            Save
          </button>
          {onDelete && (
            <button
              type="button"
              onClick={() => {
                onDelete(teammate.id)
                onClose()
              }}
              className="px-3 py-2 rounded-md text-xs text-red-300/80 hover:text-red-200 hover:bg-red-500/10"
            >
              Remove
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded-md text-xs text-tower-cream/60"
          >
            Cancel
          </button>
        </div>

        {/* Reset position — secondary action, prominent enough to find but
            visually subordinate to Save/Remove. */}
        {onResetPosition && (
          <div className="mt-3 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={() => {
                onResetPosition(teammate.id)
                onClose()
              }}
              className="w-full px-3 py-2 rounded-md text-xs bg-night-deep/60 border border-white/10 text-tower-cream/80 hover:border-tower-gold/40 hover:text-tower-gold transition flex items-center justify-center gap-2"
              title="Send this teammate back to their default spot"
            >
              ↺ Reset position
            </button>
          </div>
        )}
      </form>
      </div>
    </div>
  )
}
