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

import { useEffect, useRef } from 'react'
import { useLeoVideo } from '@/hooks/useLeoVideo'
import { trackEvent } from '@/lib/tracking'
import { useAnchorPosition } from '@/lib/anchorPositions'
import { useIsDesktop } from '@/hooks/useIsDesktop'
import { useBackdropDismissGuard } from '@/hooks/useBackdropDismissGuard'
import { TeammatePortrait } from './TeammatePortrait'

interface Props {
  open: boolean
  onClose: () => void
  /** When set, the card floats next to this character in the 3D
   *  scene. Null/undefined falls back to the legacy centered modal. */
  anchorSlug?: string | null
}

export function LeoEmailDrawer({ open, onClose, anchorSlug }: Props) {
  // Anchor follows the character ONLY on desktop. On mobile we
  // render as a bottom sheet — the per-frame transform loop would
  // just fight the sheet's bottom-edge position.
  // Edge-aware mode (`flipEdge`): when the character is near the
  // right viewport edge (Leo in particular spawns at the right side
  // of the room), the hook flips the card to the LEFT of the
  // character so it never clips off-screen. `vCenter` aligns the
  // card vertically on the character's head. With these on, the
  // hook OWNS the placement — the inner card must NOT add its own
  // static `translate(...)` offset (otherwise the two transforms
  // stack and the card drifts off the character).
  const isDesktop = useIsDesktop()
  // freeze: snapshot Leo's position when the drawer opens and keep it
  // static. Leo keeps wandering / bobbing in the scene, but the video
  // card no longer jitters along with him — otherwise the moving anchor
  // made the embedded video hard to watch.
  const anchorRef = useAnchorPosition(
    open && isDesktop ? anchorSlug ?? null : null,
    { flipEdge: true, vCenter: true, gap: 28, freeze: true },
  )
  const anchored = !!anchorSlug && isDesktop
  // Same resolver LeoBubble uses — keeps the two Leo modals in sync.
  // The YouTube ID now comes from the app_config table (key
  // `leo_youtube_id`) via /api/config/leo-video, not an env var, so it
  // can be swapped live. Blank/unset → bundled MP4 fallback in /public.
  const video = useLeoVideo()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const hasTrackedVideo = useRef(false)

  // Poll YouTube iframe for playback progress via postMessage API.
  // Fires leo_video_complete once the user passes ~80% of the video.
  useEffect(() => {
    if (!open || video.kind !== 'youtube' || hasTrackedVideo.current) return

    let intervalId: ReturnType<typeof setInterval> | null = null

    function onMessage(e: MessageEvent) {
      if (typeof e.data !== 'string') return
      try {
        const msg = JSON.parse(e.data)
        if (msg.event === 'infoDelivery' && msg.info) {
          const { currentTime, duration } = msg.info
          if (
            typeof currentTime === 'number' &&
            typeof duration === 'number' &&
            duration > 0 &&
            currentTime / duration >= 0.8 &&
            !hasTrackedVideo.current
          ) {
            hasTrackedVideo.current = true
            trackEvent('leo_video_complete', { percent: Math.round((currentTime / duration) * 100) })
            if (intervalId) clearInterval(intervalId)
          }
        }
      } catch {
        // ignore non-JSON messages
      }
    }

    window.addEventListener('message', onMessage)

    intervalId = setInterval(() => {
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'listening' }),
          'https://www.youtube.com'
        )
      }
    }, 1000)

    return () => {
      window.removeEventListener('message', onMessage)
      if (intervalId) clearInterval(intervalId)
    }
  }, [open, video.kind])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Press-origin + time-gated backdrop dismiss. The synthetic click
  // that follows the opening tap never produces a matching
  // pointerdown on the backdrop, so it harmlessly no-ops here. ESC +
  // the × button call `onClose` directly so explicit dismissal stays
  // instant. See useBackdropDismissGuard for the full root-cause writeup.
  const backdropDismissHandlers = useBackdropDismissGuard(open, onClose)

  if (!open) return null
  return (
    <div
      role="dialog"
      aria-modal="true"
      // Mobile: bottom-sheet flex container with backdrop. Desktop:
      // either character-anchored (transparent overlay) or centered
      // modal (legacy fallback). Same pattern as the other Teammate-
      // related pop-ups so the suite presents consistently.
      className={
        // The sheet's z-40 already paints over the z-30 bottom nav
        // while open, so we no longer lift it ~72px above the
        // viewport edge — that lift was producing a dead band of
        // backdrop between the sheet's last line and the nav. Now
        // the sheet sits flush with the viewport bottom (its own
        // env(safe-area-inset-bottom) padding handles the iOS home
        // indicator).
        'fixed inset-0 z-40 flex items-end md:items-center justify-center backdrop-blur-sm bg-black/60 ' +
        (anchored ? 'md:bg-transparent md:backdrop-blur-0' : '')
      }
      {...backdropDismissHandlers}
    >
      <div
        ref={anchored ? anchorRef : undefined}
        onClick={e => e.stopPropagation()}
        className={
          'w-full md:w-auto ' +
          (anchored ? 'md:absolute md:top-0 md:left-0 md:pointer-events-none' : '')
        }
        style={anchored ? { willChange: 'transform' } : undefined}
      >
        <div
          className={
            // `relative` so the absolute × close button anchors to the
            // card's top-right rather than escaping to the fixed
            // backdrop (which put it up in the office area).
            'relative bg-night-mid border-t border-tower-gold/30 text-tower-cream shadow-2xl ' +
            'rounded-t-3xl md:rounded-2xl md:border md:border-tower-gold/30 ' +
            'pt-3 px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:p-6 ' +
            // Sized generously on desktop so the embedded YouTube
            // iframe (16:9) reads as a real watch-this affordance
            // rather than a postage-stamp preview. ~720 px anchored
            // beside Leo, max-w-3xl when fallback-centered.
            (anchored
              ? 'md:pointer-events-auto md:w-[min(720px,calc(100vw-32px))] md:max-w-3xl'
              : 'md:max-w-3xl md:mx-auto')
          }
        >
        {/* `flipEdge` mode on the anchor hook owns the full
            placement (gap + vertical centre + edge flip); the inner
            card MUST NOT add its own offset transform here.
            Mobile sheet grip — hidden on desktop. */}
        <div className="md:hidden flex justify-center -mt-1 mb-3" aria-hidden>
          <div className="w-9 h-1 rounded-full bg-white/20" />
        </div>

        {/* Close × — absolute top-right so the portrait below can sit
            centered in the full width. */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 text-tower-cream/50 hover:text-tower-cream text-xl leading-none px-2 py-1"
        >
          ×
        </button>

        {/* Leo pixel portrait — MOBILE ONLY. On desktop the card floats
            right beside Leo's live minifigure, so repeating the portrait
            inside is redundant; drop it there. */}
        <div className="md:hidden flex justify-center mb-3">
          <TeammatePortrait slug="leo" />
        </div>

        <div className="mb-4 text-center">
          <div className="text-[10px] uppercase tracking-widest text-tower-gold/80">
            Demo Specialist
          </div>
          <h2 className="text-2xl font-bold mt-1">Hi, I&apos;m Leo 👋</h2>
        </div>

        {/* Bleed past the card's px-6 side padding on mobile so the
            video fills the bottom-sheet width. Desktop keeps the
            inset — the modal is already wide enough that the video
            reads as large without bleeding. */}
        <div className="-mx-6 md:mx-0 mb-4 rounded-none md:rounded-md overflow-hidden border border-white/10 aspect-video bg-black">
          {video.kind === 'youtube' ? (
            // iframe attributes mirror `requirements/youtube_frame_rule.md`
            // — `autoplay` in `allow`, `referrerPolicy` to match
            // YouTube's canonical embed code. The clean-embed query
            // params (controls / rel / iv_load_policy / modestbranding /
            // disablekb) live on `video.embed` from lib/youtubeUrl.
            <iframe
              ref={iframeRef}
              src={`${video.embed}&enablejsapi=1`}
              title="YouTube video player"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
              className="w-full h-full"
            />
          ) : (
            // Local MP4 fallback. `playsInline` keeps playback inline
            // on iOS instead of forcing fullscreen; `preload="metadata"`
            // pulls just the header bytes so the full ~80 MB doesn't
            // download until the user actually hits play.
            <video
              src={video.src}
              title="Diaflow AI Teammates intro"
              controls
              playsInline
              preload="metadata"
              className="w-full h-full"
            />
          )}
        </div>

        <div className="flex items-center justify-between gap-3 mb-4">
          <p className="text-sm text-tower-cream/80">
            When we launch, your AI teammates will handle the work. This is what that looks like.
          </p>
          {/* <a
            href={video.watch}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-night-deep/80 border border-white/10 text-xs text-tower-cream/80 hover:bg-night-deep hover:text-tower-cream transition whitespace-nowrap"
          >
            ▶ Watch on YouTube
          </a> */}
        </div>
        </div>
      </div>
    </div>
  )
}
