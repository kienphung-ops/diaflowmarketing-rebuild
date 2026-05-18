'use client'

import { useEffect } from 'react'

interface Props {
  open: boolean
  onClose: () => void
}

const SKILLS = [
  { icon: '📅', label: 'Schedule meetings + send follow-ups' },
  { icon: '📨', label: 'Triage your inbox + escalate what matters' },
  { icon: '🧾', label: 'Chase invoices, vendor renewals, contracts' },
  { icon: '🗂️', label: 'Keep your team docs and folders tidy' },
  { icon: '🧭', label: 'Onboard new teammates with the right links' },
]

export function MiaInfoCard({ open, onClose }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!open) return null
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md bg-night-mid border border-tower-gold/30 rounded-2xl p-6 text-tower-cream shadow-2xl"
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-tower-gold/80">Operations Assistant</div>
            <h2 className="text-2xl font-bold mt-1">Hi, I&apos;m Mia 👋</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-tower-cream/50 hover:text-tower-cream text-xl">
            ×
          </button>
        </div>

        <p className="text-sm text-tower-cream/80 mb-4">
          I quietly remove friction from your week. Tell me what&apos;s on your plate and I&apos;ll
          handle the next step — so you stay focused on the work that only you can do.
        </p>

        <div className="text-[11px] uppercase tracking-widest text-tower-cream/40 mb-2">What I do</div>
        <ul className="space-y-2 mb-5">
          {SKILLS.map(s => (
            <li key={s.label} className="flex items-start gap-2 text-sm">
              <span>{s.icon}</span>
              <span className="text-tower-cream/85">{s.label}</span>
            </li>
          ))}
        </ul>

        <button
          onClick={onClose}
          className="w-full px-4 py-2.5 rounded-md bg-tower-gold text-night-deep font-semibold text-sm hover:bg-tower-gold/90"
        >
          Got it
        </button>
      </div>
    </div>
  )
}
