import type { Metadata } from 'next'
import './globals.css'
import { GoogleAnalytics } from '@/components/GoogleAnalytics'

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
        {children}
        {gaId && <GoogleAnalytics gaId={gaId} />}
      </body>
    </html>
  )
}
