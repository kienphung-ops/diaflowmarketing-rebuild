'use client'

/**
 * MiaInfoCard — opens when the user clicks Mia in the office scene.
 *
 * Has two render modes:
 *
 *   1. PERSONALISED — when the Diaflow `recommendedRole` + `reason` are
 *      both known (either from the live trial state or the signed-in
 *      User row). Surfaces the assistant-match copy collected during
 *      Mia onboarding so the user can re-read their role at any time.
 *
 *   2. DEFAULT — when neither is known (e.g. user skipped Mia step,
 *      backfill hasn't completed). Falls back to the generic skills
 *      list so the modal is never blank.
 *
 * Both modes share the same chrome (close button, role label, "Got it"
 * dismiss button) so the switch is purely content.
 */

import { useEffect } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  /** Diaflow-derived role title (e.g. "Executive Strategy Chief of
   *  Staff"). Pass from `trial.recommendedRole` for anonymous users or
   *  from the User-row column for signed-in users. */
  recommendedRole?: string | null
  /** Reason that pairs with `recommendedRole`. */
  reason?: string | null
}

const SKILLS = [
  { icon: '📅', label: 'Schedule meetings + send follow-ups' },
  { icon: '📨', label: 'Triage your inbox + escalate what matters' },
  { icon: '🧾', label: 'Chase invoices, vendor renewals, contracts' },
  { icon: '🗂️', label: 'Keep your team docs and folders tidy' },
  { icon: '🧭', label: 'Onboard new teammates with the right links' },
]

export function MiaInfoCard({ open, onClose, recommendedRole, reason }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!open) return null

  const personalised = !!(recommendedRole && reason)

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
            <div className="text-[10px] uppercase tracking-widest text-tower-gold/80">
              {personalised ? 'Your AI assistant match' : 'Operations Assistant'}
            </div>
            <h2 className="text-2xl font-bold mt-1">
              {personalised ? recommendedRole : 'Hi, I’m Mia 👋'}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-tower-cream/50 hover:text-tower-cream text-xl"
          >
            ×
          </button>
        </div>

        {personalised ? (
          // Show the Diaflow-derived rationale verbatim — same content
          // that powered the MiaInfoBubble during onboarding. Surfaced
          // here so the user can revisit their role match without
          // going back through the onboarding flow.
          <>
            <p className="text-sm text-tower-cream/85 leading-relaxed mb-5">
              {reason}
            </p>
            <div className="rounded-lg border border-purple-500/25 bg-purple-500/5 px-4 py-3 mb-5">
              <p className="text-[11px] uppercase tracking-widest text-purple-300/80 mb-2">
                What Mia will do for you
              </p>
              <ul className="space-y-2">
                {SKILLS.map(s => (
                  <li key={s.label} className="flex items-start gap-2 text-sm">
                    <span>{s.icon}</span>
                    <span className="text-tower-cream/85">{s.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : (
          // Default fallback — generic intro + skills list. Used when
          // the user skipped Mia onboarding OR is a legacy account
          // where the backfill hasn't populated yet.
          <>
            <p className="text-sm text-tower-cream/80 mb-4">
              I quietly remove friction from your week. Tell me what&apos;s on your plate and
              I&apos;ll handle the next step — so you stay focused on the work that only you
              can do.
            </p>

            <div className="text-[11px] uppercase tracking-widest text-tower-cream/40 mb-2">
              What I do
            </div>
            <ul className="space-y-2 mb-5">
              {SKILLS.map(s => (
                <li key={s.label} className="flex items-start gap-2 text-sm">
                  <span>{s.icon}</span>
                  <span className="text-tower-cream/85">{s.label}</span>
                </li>
              ))}
            </ul>
          </>
        )}

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
