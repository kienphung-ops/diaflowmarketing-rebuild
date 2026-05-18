import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Diaflow Tower',
  description: 'Build your AI office. Invite friends to climb the tower.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  )
}
