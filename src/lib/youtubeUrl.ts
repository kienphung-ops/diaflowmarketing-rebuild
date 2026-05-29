/**
 * Shared YouTube embed helper — used by both `OnboardingBubble.LeoBubble`
 * (Leo step inside trial onboarding) and `LeoEmailDrawer` (the drawer
 * that opens when the user clicks Leo in the office scene).
 *
 * Both pull the video ID from `NEXT_PUBLIC_YOUTUBE_ID` (just the bare
 * 11-char identifier, e.g. `y1wjmtFJRuk` — NOT a full URL) and fall
 * back to `FALLBACK_ID` when the env var is missing or blank.
 *
 * Embed URL follows `requirements/youtube_frame_rule.md` exactly:
 *   https://www.youtube.com/embed/<ID>?controls=0&rel=0&iv_load_policy=3&modestbranding=1&disablekb=1
 *
 * Parameter rationale (per the rule file):
 *   controls=0         — hide the entire control bar (play / scrub / volume / settings)
 *   rel=0              — restrict "related" suggestions to videos from the same channel
 *   iv_load_policy=3   — suppress in-video annotations and channel popups
 *   modestbranding=1   — minimise the YouTube logo on the toolbar
 *   disablekb=1        — block keyboard shortcuts so the embed can't steal focus
 *
 * NOTE on Vercel: `NEXT_PUBLIC_*` vars are baked in at BUILD time, not
 * read at runtime — changing the env in the Vercel dashboard requires
 * a redeploy (and ideally "Redeploy without cache") before the new
 * video ships. If you updated the env and the old video still shows,
 * that's the cause 99% of the time.
 */

/** Diaflow intro video — used when the env var isn't set so dev /
 *  preview builds still render a playable iframe. */
const FALLBACK_ID = 'y1wjmtFJRuk'

export interface YoutubeUrls {
  /** `youtube.com/embed/<id>?…` form for iframe `src`. Carries the
   *  clean-embed parameter set documented in
   *  `requirements/youtube_frame_rule.md`. */
  embed: string
  /** Canonical `youtube.com/watch?v=<id>` form for any "Watch on
   *  YouTube" external links. Kept for completeness even though the
   *  current Leo surfaces have removed the external link button. */
  watch: string
}

/**
 * Build the embed + watch URLs from a bare YouTube video ID.
 *
 * Pass `process.env.NEXT_PUBLIC_YOUTUBE_ID` directly — the env value
 * is the 11-char ID (e.g. `dQw4w9WgXcQ`), NOT a full URL. Anything
 * blank / undefined falls back to the canonical Diaflow intro ID.
 */
export function youtubeEmbedUrl(id: string | undefined): YoutubeUrls {
  const trimmed = id?.trim()
  const finalId = trimmed && trimmed.length > 0 ? trimmed : FALLBACK_ID
  // Parameter order mirrors the rule-file template to keep the
  // generated URL trivially diff-able against the spec.
  const params = 'controls=0&rel=0&iv_load_policy=3&modestbranding=1&disablekb=1'
  return {
    embed: `https://www.youtube.com/embed/${finalId}?${params}`,
    watch: `https://www.youtube.com/watch?v=${finalId}`,
  }
}
