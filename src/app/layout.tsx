import type { Metadata } from 'next'
import { headers } from 'next/headers'
import './globals.css'
import { GoogleAnalytics } from '@/components/GoogleAnalytics'
import { GoogleTagManager, GoogleTagManagerNoScript } from '@/components/GoogleTagManager'

/**
 * Default site URL — used by Next.js's metadata API to resolve every
 * relative `og:image` / `og:url` etc. into the absolute URLs that
 * crawlers expect.
 *
 * Resolution order:
 *   1. NEXT_PUBLIC_SITE_URL — set this in production to the canonical
 *      domain (e.g. "https://diaflow.io"). Highest priority because
 *      Vercel previews otherwise leak deploy-specific subdomains into
 *      shared links.
 *   2. VERCEL_URL — auto-populated on every Vercel deploy (preview +
 *      production). Falls back here when NEXT_PUBLIC_SITE_URL is unset.
 *   3. Request host — read live from the incoming request's headers
 *      via Next's `headers()` helper. This handles local dev + any
 *      non-Vercel deployment (custom domain behind a reverse proxy,
 *      tunnels like ngrok, etc.) without requiring an env var.
 *   4. localhost — only reached if the request had no `host` header,
 *      which shouldn't happen in practice.
 */
async function resolveSiteUrl(): Promise<URL> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return new URL(process.env.NEXT_PUBLIC_SITE_URL)
  if (process.env.VERCEL_URL) return new URL(`https://${process.env.VERCEL_URL}`)
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host')
  if (host) {
    const forwardedProto = h.get('x-forwarded-proto')?.split(',')[0]?.trim()
    const isLocal = /^(localhost|127\.0\.0\.1|\[::1\]|\d+\.\d+\.\d+\.\d+)(:\d+)?$/i.test(host)
    const proto = forwardedProto || (isLocal ? 'http' : 'https')
    return new URL(`${proto}://${host}`)
  }
  return new URL('http://localhost:3000')
}

const SITE_NAME = 'Diaflow Tower'
const SITE_DESCRIPTION = 'Build your AI office. Invite friends to climb the tower.'
const OG_IMAGE = '/diaflow-logo.jpg'

// `generateMetadata` (instead of a static `metadata` export) so we
// can `await resolveSiteUrl()` — reading the incoming request's host
// header requires the async helper. Per-route pages can still override
// individual fields via their own `metadata` / `generateMetadata`
// exports without having to re-state the unchanged ones.
export async function generateMetadata(): Promise<Metadata> {
  return {
    metadataBase: await resolveSiteUrl(),
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    icons: {
      icon: [
        { url: '/diaflow-logo.jpg', type: 'image/jpeg' },
      ],
      shortcut: '/diaflow-logo.jpg',
      apple: '/diaflow-logo.jpg',
    },
    // Open Graph — Facebook / LinkedIn / Discord / iMessage etc. all
    // read these.
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      title: SITE_NAME,
      description: SITE_DESCRIPTION,
      url: '/',
      // Declared dimensions MUST match the actual file or LinkedIn /
      // Facebook reject the image silently (and then cache the "no
      // image" verdict for ~7 days). `/diaflow-logo.jpg` is a square
      // 2048×2048 bitmap. LinkedIn accepts square OG images — they
      // just render letterboxed in the landscape preview slot, which
      // is still better than no preview at all. If a proper 1200×627
      // landscape asset gets added later, swap OG_IMAGE + dimensions.
      images: [{ url: OG_IMAGE, width: 2048, height: 2048, alt: SITE_NAME }],
    },
    // Twitter / X — `summary_large_image` is the right card type for
    // a 1200×627 hero, matching the OG image dimensions.
    twitter: {
      card: 'summary_large_image',
      title: SITE_NAME,
      description: SITE_DESCRIPTION,
      images: [OG_IMAGE],
    },
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const gaId = process.env.NEXT_PUBLIC_GA_ID
  return (
    <html lang="en">
      <head>
        {/* ── Critical resource hints ─────────────────────────────────
            The 3D scene's two biggest texture loads are the floor-1
            window scenery (`/window_images/1.png`, ~815 KB) and the
            full tower image (`/tower.png`, ~923 KB). Both are loaded
            by R3F's TextureLoader downstream of React hydration —
            without these preload hints, the browser doesn't start
            fetching them until the SceneCanvas chunk has parsed,
            adding ~1-2s of dead time on a cold cache.
            `fetchpriority="high"` boosts them above other late requests.
            Browser de-dupes preload hits with R3F's later fetches, so
            no double-download. */}
        <link
          rel="preload"
          as="image"
          href="/window_images/1.png"
          fetchPriority="high"
        />
        <link
          rel="preload"
          as="image"
          href="/tower.png"
          fetchPriority="high"
        />
        {/* Logo — small but blocks the header chrome. Preload so the
            first paint has the branded mark instead of a placeholder. */}
        <link rel="preload" as="image" href="/diaflow-logo.jpg" />
      </head>
      <body className="antialiased">
        {/* GTM noscript fallback — per Google's install spec must be
            immediately inside <body>. Renders an invisible iframe that
            fires the container even when JS is disabled. */}
        <GoogleTagManagerNoScript />
        {children}
        {/* GTM head/body script — loaded after-interactive so it
            doesn't block first paint. Configured container = GTM-KDPNP5XB. */}
        <GoogleTagManager />
        {/* Direct GA4 (gtag) kept as well for the existing
            NEXT_PUBLIC_GA_ID measurement — GTM and GA4 can coexist;
            GTM lets us add more vendor tags later without code changes. */}
        {gaId && <GoogleAnalytics gaId={gaId} />}
      </body>
    </html>
  )
}
