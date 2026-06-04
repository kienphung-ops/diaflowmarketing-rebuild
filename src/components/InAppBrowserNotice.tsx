'use client'

import { useState } from 'react'

/**
 * Shown in place of the "Continue with Google" button when the page is
 * open inside a social-media in-app browser (Facebook/Messenger/etc.),
 * where Google blocks OAuth ("disallowed_useragent"). Tells the user to
 * reopen the page in a real browser, with a Copy-link button so they can
 * paste it there. Email/password sign-in still works in-app, so that
 * form stays visible below.
 */
export function InAppBrowserNotice() {
  const [copied, setCopied] = useState(false)

  async function copyLink() {
    if (typeof window === 'undefined') return
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked — user can long-press the URL bar instead */
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-[13px] leading-relaxed">
      <p className="font-semibold text-amber-200 mb-1">
        ⚠️ Google sign-in isn’t available here
      </p>
      <p className="text-amber-100/85">
        You’re viewing this inside an app (e.g. Facebook or Messenger).
        Tap the <strong>•••</strong> menu and choose{' '}
        <strong>“Open in Safari / Chrome”</strong>, then continue with
        Google. You can also sign in with email below.
      </p>

      <button
        type="button"
        onClick={copyLink}
        className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 border border-white/15 text-tower-cream font-semibold text-[12.5px] hover:bg-white/15 transition"
      >
        {copied ? '✓ Link copied' : 'Copy link'}
      </button>
    </div>
  )
}
