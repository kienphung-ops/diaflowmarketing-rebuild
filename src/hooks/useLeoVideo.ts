'use client'

/**
 * Resolves Leo's intro video from the app_config-backed YouTube ID
 * (via /api/config/leo-video) — replaces the old build-time
 * NEXT_PUBLIC_YOUTUBE_ID env var so the video can be swapped live.
 *
 * Returns a `LeoVideo` (youtube | local). While the ID is loading — and
 * whenever it's unset / the fetch fails — it resolves to the bundled
 * /leo_video.mp4 fallback, so the Leo surfaces always have something to
 * play. The fetched ID is memoised at module scope so later mounts
 * (LeoBubble → LeoEmailDrawer in the same session) resolve instantly
 * without a flash or a second request.
 */

import { useEffect, useState } from 'react'
import { resolveLeoVideo, type LeoVideo } from '@/lib/youtubeUrl'

// `undefined` = not fetched yet; `string` = id; `null` = explicitly unset.
let cachedId: string | null | undefined

export function useLeoVideo(): LeoVideo {
  const [id, setId] = useState<string | null>(cachedId ?? null)

  useEffect(() => {
    if (cachedId !== undefined) {
      setId(cachedId)
      return
    }
    let mounted = true
    fetch('/api/config/leo-video', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then((d: { youtubeId?: string | null } | null) => {
        cachedId = d?.youtubeId ?? null
        if (mounted) setId(cachedId)
      })
      .catch(() => {
        // Network/parse error → stick with the local fallback.
        cachedId = null
      })
    return () => {
      mounted = false
    }
  }, [])

  return resolveLeoVideo(id ?? undefined)
}
