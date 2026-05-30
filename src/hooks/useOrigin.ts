'use client'

/**
 * useOrigin — returns the browser's `window.location.origin`, but
 * defers reading it until after hydration so server and client render
 * the same initial HTML.
 *
 * The standard mistake is:
 *   const PUBLIC_BASE = typeof window !== 'undefined'
 *     ? window.location.origin     // client
 *     : 'https://diaflow.io'       // server  → different value!
 *
 * When that gets interpolated into JSX text (e.g. an invite URL),
 * server renders `https://diaflow.io/...` and the first client paint
 * renders `http://localhost:3000/...` — React's hydration step then
 * surfaces the dreaded "Text content did not match" warning.
 *
 * This hook avoids that by starting with `''` on BOTH server and the
 * first client paint, then upgrading to the real origin in a
 * `useEffect` that only ever runs in the browser. The first
 * commit-to-DOM matches the server output, and the upgrade happens in
 * a subsequent React commit.
 */

import { useEffect, useState } from 'react'

export function useOrigin(): string {
  const [origin, setOrigin] = useState('')
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin)
    }
  }, [])
  return origin
}
