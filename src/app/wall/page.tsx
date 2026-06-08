import type { Metadata } from 'next'
import WallClient from './WallClient'

export const metadata: Metadata = {
  title: 'The Wall — Diaflow',
  description: 'Everyone building their AI team. Live community stats before AI Teammates launch.',
}

export default function WallPage() {
  return (
    <>
      {/* Inter — loaded via the Google Fonts stylesheet (same as the
          original mockup) rather than next/font, so a no-network Docker
          build can't fail on a font fetch. font-family lives in
          wall.module.css with a system-font fallback. */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- intentional: next/font fetches at build time, which a no-network Docker build can't do. */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
      />
      <WallClient />
    </>
  )
}
