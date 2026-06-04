'use client'

import { useEffect, useState } from 'react'
import { detectInAppBrowser } from '@/lib/inAppBrowser'

/**
 * True when the page is running inside a social-media in-app browser
 * (Facebook, Messenger, Instagram, TikTok, …) where Google OAuth is
 * blocked. Returns `false` during SSR / first paint, then resolves on
 * mount once `navigator.userAgent` is available.
 */
export function useIsInAppBrowser(): boolean {
  const [inApp, setInApp] = useState(false)
  useEffect(() => {
    const ua =
      navigator.userAgent ||
      navigator.vendor ||
      // @ts-expect-error legacy IE/Opera global, kept for completeness
      (typeof window !== 'undefined' ? window.opera : '') ||
      ''
    setInApp(detectInAppBrowser(ua))
  }, [])
  return inApp
}
