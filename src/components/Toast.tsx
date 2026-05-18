'use client'

import { useEffect, useState } from 'react'

export interface ToastMessage {
  id: string
  title: string
  body?: string
  tone?: 'success' | 'info' | 'warn'
  ttlMs?: number
}

interface Props {
  toasts: ToastMessage[]
  onDismiss: (id: string) => void
}

export function ToastStack({ toasts, onDismiss }: Props) {
  return (
    <div className="fixed top-16 right-4 z-40 space-y-2 pointer-events-none">
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: () => void }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const enter = requestAnimationFrame(() => setOpen(true))
    const ttl = toast.ttlMs ?? 5000
    const timer = setTimeout(onDismiss, ttl)
    return () => {
      cancelAnimationFrame(enter)
      clearTimeout(timer)
    }
  }, [toast.ttlMs, onDismiss])

  const toneClasses =
    toast.tone === 'warn'
      ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
      : toast.tone === 'info'
        ? 'border-sky-500/40 bg-sky-500/10 text-sky-200'
        : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'

  return (
    <div
      className={`pointer-events-auto w-80 rounded-lg border ${toneClasses} px-3 py-2.5 backdrop-blur-sm shadow-lg transition-transform duration-200 ${open ? 'translate-x-0 opacity-100' : 'translate-x-6 opacity-0'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold leading-tight">{toast.title}</div>
          {toast.body && <div className="mt-0.5 text-xs opacity-80">{toast.body}</div>}
        </div>
        <button onClick={onDismiss} aria-label="Dismiss" className="opacity-60 hover:opacity-100 text-sm shrink-0">
          ×
        </button>
      </div>
    </div>
  )
}
