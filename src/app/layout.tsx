import type { Metadata } from 'next'
import './globals.css'
import { GoogleAnalytics } from '@/components/GoogleAnalytics'
import { GoogleTagManager, GoogleTagManagerNoScript } from '@/components/GoogleTagManager'

export const metadata: Metadata = {
  title: 'Diaflow Tower',
  description: 'Build your AI office. Invite friends to climb the tower.',
  icons: {
    icon: [
      { url: '/diaflow-logo.jpg', type: 'image/jpeg' },
    ],
    shortcut: '/diaflow-logo.jpg',
    apple: '/diaflow-logo.jpg',
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
