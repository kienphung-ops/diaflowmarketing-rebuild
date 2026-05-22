import type { Metadata } from 'next'
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
 *   3. localhost — dev fallback.
 */
function resolveSiteUrl(): URL {
  if (process.env.NEXT_PUBLIC_SITE_URL) return new URL(process.env.NEXT_PUBLIC_SITE_URL)
  if (process.env.VERCEL_URL) return new URL(`https://${process.env.VERCEL_URL}`)
  return new URL('http://localhost:3000')
}

const SITE_NAME = 'Diaflow Tower'
const SITE_DESCRIPTION = 'Build your AI office. Invite friends to climb the tower.'
// Standard OG / Twitter card image. Replace `/og.png` with a real
// 1200×627 PNG dropped into `public/og.png`; until then the existing
// tower marketing image is a safe placeholder.
const OG_IMAGE = '/og.png'

export const metadata: Metadata = {
  metadataBase: resolveSiteUrl(),
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
  // read these. Per-route pages can override individual fields via
  // their own `metadata` / `generateMetadata` exports without having
  // to re-state the unchanged ones.
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: '/',
    images: [{ url: OG_IMAGE, width: 1200, height: 627, alt: SITE_NAME }],
  },
  // Twitter / X — `summary_large_image` is the right card type for a
  // 1200×627 hero, matching the OG image dimensions.
  twitter: {
    card: 'summary_large_image',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const gaId = process.env.NEXT_PUBLIC_GA_ID
  return (
    <html lang="en">
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
