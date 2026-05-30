'use client'

import { useEffect, useMemo, useState } from 'react'

interface DraftRow {
  name: string
  role: string
}

interface Props {
  open: boolean
  /** Number of slots available on the current floor (1+ to render). */
  slotsAvailable: number
  /** Current floor — shown in the heading. */
  currentFloor: number
  onClose: () => void
  /** Receives the array of new teammates to add (filtered out empty rows). */
  onAdd: (rows: DraftRow[]) => void
}

const DEFAULT_ROLE_SUGGESTIONS = [
  'Operations Assistant',
  'AI Bio Writer',
  'Voice Specialist',
  'Demo Specialist',
  'Customer Success Lead',
  'Content Producer',
  'Growth Hacker',
  'Product Designer',
  'Engineering Buddy',
  'Researcher',
  'Marketing Strategist',
]

export function BulkAddTeammatesModal({ open, slotsAvailable, currentFloor, onClose, onAdd }: Props) {
  const initialRows = useMemo<DraftRow[]>(
    () =>
      Array.from({ length: Math.max(1, slotsAvailable) }, (_, i) => ({
        name: '',
        role: DEFAULT_ROLE_SUGGESTIONS[i % DEFAULT_ROLE_SUGGESTIONS.length],
      })),
    [slotsAvailable]
  )
  const [rows, setRows] = useState<DraftRow[]>(initialRows)

  useEffect(() => {
    setRows(initialRows)
  }, [initialRows])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!open || slotsAvailable <= 0) return null

  function updateRow(idx: number, patch: Partial<DraftRow>) {
    setRows(prev => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const cleaned = rows
      .map(r => ({ name: r.name.trim(), role: r.role.trim() }))
      .filter(r => r.name.length > 0)
    if (cleaned.length === 0) return
    onAdd(cleaned)
    onClose()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      // Bottom sheet on mobile, centered modal on desktop. Same
      // pattern used by SignupModal + HowItWorksModal so all three
      // present consistent geometry at every breakpoint.
      className="fixed inset-0 z-30 flex items-end md:items-center justify-center bg-black/65 backdrop-blur-sm md:px-4"
      onClick={onClose}
    >
      <form
        onClick={e => e.stopPropagation()}
        onSubmit={handleSubmit}
        className={
          'w-full bg-night-mid text-tower-cream shadow-2xl ' +
          // Card shape — flat top on mobile (sheet anchored to the
          // bottom edge), rounded card on desktop.
          'rounded-t-3xl md:rounded-2xl md:max-w-lg ' +
          'border-t md:border md:border-tower-gold/40 border-tower-gold/40 ' +
          // Padding — eat the iOS home-indicator inset on mobile.
          'pt-5 px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:p-6'
        }
      >
        {/* Mobile sheet grip */}
        <div className="md:hidden flex justify-center -mt-2.5 mb-3" aria-hidden>
          <div className="w-9 h-1 rounded-full bg-white/20" />
        </div>
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-tower-gold/80">Floor {currentFloor}</div>
            <h2 className="text-2xl font-bold mt-1">
              You unlocked {slotsAvailable} new teammate {slotsAvailable === 1 ? 'slot' : 'slots'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-tower-cream/50 hover:text-tower-cream text-xl"
          >
            ×
          </button>
        </div>

        <p className="text-sm text-tower-cream/70 mb-4">
          Name your new teammates and pick a role. You can leave rows blank — only filled ones
          will be added.
        </p>

        <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
          {rows.map((row, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <div className="shrink-0 w-7 h-7 rounded-full bg-night-deep border border-white/10 flex items-center justify-center text-xs text-tower-cream/60">
                {idx + 1}
              </div>
              <input
                value={row.name}
                onChange={e => updateRow(idx, { name: e.target.value.slice(0, 40) })}
                placeholder="Name (e.g. Alex)"
                className="flex-1 min-w-0 px-3 py-2 rounded-md bg-night-deep border border-white/10 focus:border-tower-gold focus:outline-none text-sm"
              />
              <input
                value={row.role}
                onChange={e => updateRow(idx, { role: e.target.value.slice(0, 60) })}
                placeholder="Role"
                list="role-suggestions"
                className="flex-1 min-w-0 px-3 py-2 rounded-md bg-night-deep border border-white/10 focus:border-tower-gold focus:outline-none text-sm"
              />
            </div>
          ))}
        </div>

        <datalist id="role-suggestions">
          {DEFAULT_ROLE_SUGGESTIONS.map(r => (
            <option key={r} value={r} />
          ))}
        </datalist>

        <div className="flex items-center gap-2 mt-5">
          <button
            type="submit"
            className="flex-1 px-4 py-2.5 rounded-md bg-tower-gold text-night-deep font-semibold text-sm hover:bg-tower-gold/90"
          >
            Add teammates
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-md text-xs text-tower-cream/60 hover:text-tower-cream"
          >
            Skip for now
          </button>
        </div>
      </form>
    </div>
  )
}
