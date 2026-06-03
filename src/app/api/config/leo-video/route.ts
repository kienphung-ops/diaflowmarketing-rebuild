/**
 * GET /api/config/leo-video → { youtubeId: string | null }
 *
 * Leo's intro-video YouTube ID, sourced from the `app_config` table
 * (key `leo_youtube_id`) instead of an env var — so it can be changed
 * live without a redeploy. `null` → the Leo surfaces fall back to the
 * bundled /leo_video.mp4 (see lib/youtubeUrl → resolveLeoVideo).
 */
import { NextResponse } from 'next/server'
import { getAppConfig, LEO_YOUTUBE_ID_KEY } from '@/lib/appConfig'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const youtubeId = await getAppConfig<string>(LEO_YOUTUBE_ID_KEY)
    return NextResponse.json(
      { youtubeId: youtubeId ?? null },
      {
        headers: {
          // Short browser cache + CDN cache; the appConfig layer itself
          // memoises for 60s, so DB reads stay rare.
          'cache-control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400',
        },
      },
    )
  } catch (err) {
    console.error('[config/leo-video]', err)
    // Never break the Leo surfaces on a config read error — fall back to
    // the local MP4 by returning null.
    return NextResponse.json({ youtubeId: null })
  }
}
