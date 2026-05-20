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
      aria-label={copied ? 'Copied' : 'Copy your invite link'}
      className="px-2.5 md:px-3 py-1 md:py-1.5 rounded-md bg-tower-gold/90 text-night-deep font-semibold text-[10px] md:text-xs tracking-wide hover:bg-tower-gold transition whitespace-nowrap"
    >
      {copied ? (
        'Copied!'
      ) : (
        <>
          {/* Compact label on mobile, full label on desktop. */}
          <span className="md:hidden">⧉ Invite link</span>
          <span className="hidden md:inline">Copy your invite link</span>
        </>
      )}
    </button>
  )
}
