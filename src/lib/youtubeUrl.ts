/**
 * Leo intro video resolver — used by both `OnboardingBubble.LeoBubble`
 * (Leo step inside trial onboarding) and `LeoEmailDrawer` (the drawer
 * that opens when the user clicks Leo in the office scene).
 *
 * Behaviour:
 *
 *   - `NEXT_PUBLIC_YOUTUBE_ID` set → return a YouTube embed using the
 *     clean-embed parameter set from `requirements/youtube_frame_rule.md`.
 *
 *   - `NEXT_PUBLIC_YOUTUBE_ID` blank / missing → return the bundled
 *     fallback MP4 at `/leo_video.mp4` (lives in `public/`). The Leo
 *     surfaces render an HTML5 `<video>` element in this case, so the
 *     intro still plays without any env config at all (useful for
 *     local dev + preview environments where the YouTube ID isn't
 *     plumbed through Vercel env vars yet).
 *
 * Discriminate on `kind` in callers — TypeScript narrows the rest of
 * the shape automatically.
 *
 * Embed-URL parameters (when kind === 'youtube'):
 *   controls=0         — hide the entire control bar
 *   rel=0              — restrict "related" suggestions to same channel
 *   iv_load_policy=3   — suppress in-video annotations + channel popups
 *   modestbranding=1   — minimise the YouTube logo on the toolbar
 *   disablekb=1        — block keyboard shortcuts so the embed can't steal focus
 *
 * NOTE on Vercel: `NEXT_PUBLIC_*` vars are baked in at BUILD time, not
 * read at runtime — changing the env in the Vercel dashboard requires
 * a redeploy (and ideally "Redeploy without cache") before the new
 * video ships.
 */

/** Local MP4 fallback — lives in `public/leo_video.mp4`. Served as a
 *  static asset; the Leo `<video>` element references it directly. */
const LOCAL_FALLBACK_SRC = '/leo_video.mp4'

/** Discriminated result of `resolveLeoVideo`. Callers switch on
 *  `kind` to decide whether to render an iframe or a `<video>`. */
export type LeoVideo =
  | {
      kind: 'youtube'
      /** `youtube.com/embed/<id>?…` form for iframe `src`. Carries
       *  the clean-embed parameter set documented in
       *  `requirements/youtube_frame_rule.md`. */
      embed: string
      /** Canonical `youtube.com/watch?v=<id>` form for any
       *  "Watch on YouTube" external links. */
      watch: string
    }
  | {
      kind: 'local'
      /** Public-path MP4 src for an HTML5 `<video>` element. */
      src: string
    }

/**
 * Decide which Leo video to render based on the env-supplied YouTube
 * ID. Pass `process.env.NEXT_PUBLIC_YOUTUBE_ID` directly — the env
 * value is the bare 11-char ID (e.g. `dQw4w9WgXcQ`), NOT a full URL.
 * Anything blank / undefined returns the local MP4 fallback.
 */
export function resolveLeoVideo(id: string | undefined): LeoVideo {
  const trimmed = id?.trim()
  if (trimmed && trimmed.length > 0) {
    const params =
      'controls=0&rel=0&iv_load_policy=3&modestbranding=1&disablekb=1'
    return {
      kind: 'youtube',
      embed: `https://www.youtube.com/embed/${trimmed}?${params}`,
      watch: `https://www.youtube.com/watch?v=${trimmed}`,
    }
  }
  return { kind: 'local', src: LOCAL_FALLBACK_SRC }
}

/**
 * Legacy export — kept for any caller still importing the old name.
 * Internally just forwards to `resolveLeoVideo`. Returns the same
 * discriminated union. New code should use `resolveLeoVideo` directly.
 */
export const youtubeEmbedUrl = resolveLeoVideo
