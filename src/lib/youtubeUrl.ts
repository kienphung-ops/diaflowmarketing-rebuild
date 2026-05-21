/**
 * Shared YouTube URL helper — used by both `OnboardingBubble.LeoBubble`
 * (Leo step inside trial onboarding) and `LeoEmailDrawer` (the drawer
 * that opens when the user clicks Leo in the office scene). Both
 * pull the URL from `NEXT_PUBLIC_YOUTUBE_URL` and fall back to
 * `FALLBACK_URL` when the env var is missing or unparseable.
 *
 * NOTE on Vercel: `NEXT_PUBLIC_*` vars are baked in at BUILD time,
 * not read at runtime — changing the env in the Vercel dashboard
 * requires a redeploy (and ideally "Redeploy without cache") before
 * the new video URL ships. If you updated the env and the old video
 * still shows, that's the cause 99% of the time.
 */

const FALLBACK_URL = 'https://www.youtube.com/watch?v=y1wjmtFJRuk'

export interface YoutubeUrls {
  /** `youtube-nocookie.com/embed/<id>` form for iframe `src`. */
  embed: string
  /** Standard `youtube.com/watch?v=<id>` form for "Watch on YouTube"
   *  buttons / external links. */
  watch: string
}

/**
 * Convert any common YouTube URL form into both embed + watch URLs.
 * Accepts:
 *   - https://www.youtube.com/watch?v=ID
 *   - https://youtu.be/ID
 *   - https://www.youtube-nocookie.com/embed/ID
 *
 * Falls back to `FALLBACK_URL` when `raw` is missing / blank. If
 * neither the env nor the fallback parses (shouldn't happen — the
 * fallback is a known-good `watch?v=` URL), returns the source URL
 * verbatim as the watch link and a blank embed, so the user can at
 * least click through to YouTube.
 */
export function youtubeEmbedUrl(raw: string | undefined): YoutubeUrls {
  const source = raw && raw.trim() ? raw : FALLBACK_URL
  const m =
    source.match(/[?&]v=([^&]+)/) ??
    source.match(/youtu\.be\/([^?]+)/) ??
    source.match(/embed\/([^?]+)/)
  const id = m?.[1]
  if (!id) {
    return { embed: '', watch: source }
  }
  return {
    embed: `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`,
    watch: `https://www.youtube.com/watch?v=${id}`,
  }
}
