'use client'

import { useEffect, useState } from 'react'

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
}

export function TeammateEditModal({ open, teammate, onClose, onSave, onDelete }: Props) {
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
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <form
        onClick={e => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-night-mid border border-tower-gold/40 rounded-2xl p-6 text-tower-cream shadow-2xl"
      >
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
      </form>
    </div>
  )
}
