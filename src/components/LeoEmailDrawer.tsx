'use client'

/**
 * LeoEmailDrawer — the modal that opens when the user clicks Leo in
 * the office scene (post-onboarding).
 *
 * Used to capture a waitlist email; that flow was retired because the
 * signup route already records every signed-up email into both
 * `User` and `EmailCapture`, making Leo's manual form redundant.
 * Leo now just plays the Diaflow intro video — same content the
 * onboarding-time `LeoBubble` shows. Export name and props are kept
 * minimal so any existing callers don't break.
 */

import { useEffect } from 'react'
import { youtubeEmbedUrl } from '@/lib/youtubeUrl'

interface Props {
  open: boolean
  onClose: () => void
}

export function LeoEmailDrawer({ open, onClose }: Props) {
  // Same env-driven helper LeoBubble uses — keeps the two Leo modals
  // in sync. Falls back to the canonical Diaflow intro when
  // NEXT_PUBLIC_YOUTUBE_URL isn't set (see lib/youtubeUrl).
  const video = youtubeEmbedUrl(process.env.NEXT_PUBLIC_YOUTUBE_URL)

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
        className="w-full max-w-xl bg-night-mid border border-tower-gold/30 rounded-2xl p-6 text-tower-cream shadow-2xl"
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-tower-gold/80">
              Demo Specialist
            </div>
            <h2 className="text-2xl font-bold mt-1">Hi, I&apos;m Leo 👋</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-tower-cream/50 hover:text-tower-cream text-xl"
          >
            ×
          </button>
        </div>

        <div className="mb-4 rounded-md overflow-hidden border border-white/10 aspect-video bg-black">
          <iframe
            src={video.embed}
            title="Diaflow Tower intro"
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="w-full h-full"
          />
        </div>

        <div className="flex items-center justify-between gap-3 mb-4">
          <p className="text-sm text-tower-cream/80">
            Here&apos;s a quick tour of what we&apos;re building.
          </p>
          <a
            href={video.watch}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-night-deep/80 border border-white/10 text-xs text-tower-cream/80 hover:bg-night-deep hover:text-tower-cream transition whitespace-nowrap"
          >
            ▶ Watch on YouTube
          </a>
        </div>

        <button
          onClick={onClose}
          className="w-full px-4 py-2.5 rounded-md bg-tower-gold text-night-deep font-semibold text-sm hover:bg-tower-gold/90"
        >
          Back to the office
        </button>
      </div>
    </div>
  )
}
