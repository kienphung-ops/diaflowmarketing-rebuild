'use client'

import { useEffect } from 'react'

/**
 * Self-heals the "stale chunk 404" crash.
 *
 * Symptom: after a new deploy, a browser whose cache is cold (incognito /
 * cache cleared) loads fresh HTML but a referenced `/_next/static/chunks/
 * *.js` 404s — because the chunk hash the HTML points to no longer exists
 * on the origin (build rotated / rolling deploy / CDN). The dynamic import
 * throws a ChunkLoadError and the app crashes; the user has to reload a few
 * times manually before it clears.
 *
 * Fix: listen for chunk-load failures globally and force ONE reload. The
 * home HTML is served `no-store`, so the reload fetches a fresh document
 * that references the chunk hashes that DO exist → the page recovers
 * automatically. A short cooldown (sessionStorage) prevents a reload loop
 * if the failure somehow persists.
 */
const RELOAD_AT_KEY = 'diaflow_chunk_reload_at'
const COOLDOWN_MS = 20_000

function looksLikeChunkError(message: string): boolean {
  return /ChunkLoadError|Loading chunk \d+ failed|Loading CSS chunk|error loading dynamically imported module|Failed to fetch dynamically imported module|Importing a module script failed/i.test(
    message,
  )
}

export function ChunkErrorReload() {
  useEffect(() => {
    function recover(message: string) {
      if (!looksLikeChunkError(message)) return
      let last = 0
      try {
        last = Number(window.sessionStorage.getItem(RELOAD_AT_KEY)) || 0
      } catch {
        /* sessionStorage unavailable — fall through, reload anyway once */
      }
      if (Date.now() - last < COOLDOWN_MS) return // guard against reload loops
      try {
        window.sessionStorage.setItem(RELOAD_AT_KEY, String(Date.now()))
      } catch {
        /* ignore */
      }
      window.location.reload()
    }

    function onError(e: ErrorEvent) {
      recover(e?.message || String((e as ErrorEvent)?.error ?? ''))
    }
    function onRejection(e: PromiseRejectionEvent) {
      const r = e?.reason as { message?: string; name?: string } | string | undefined
      const msg = typeof r === 'string' ? r : r?.message || r?.name || ''
      recover(msg)
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  return null
}
