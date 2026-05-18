'use client'

import { useState } from 'react'

export function ReferralCopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    const url = `${window.location.origin}/?ref=${code}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // fall through silently
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="px-3 py-1.5 rounded-md bg-tower-gold/90 text-night-deep font-semibold text-xs tracking-wide hover:bg-tower-gold transition"
    >
      {copied ? 'Copied!' : 'Copy your invite link'}
    </button>
  )
}
