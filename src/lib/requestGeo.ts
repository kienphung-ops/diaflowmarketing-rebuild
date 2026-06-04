import type { NextRequest } from 'next/server'

/**
 * ISO 3166-1 alpha-2 country code for the request, derived from the
 * CDN/edge geo header. Single source of truth shared by every route that
 * persists `User.country` (signup / password / Google OAuth callback).
 *
 * This app runs behind AWS CloudFront, which sends
 * `CloudFront-Viewer-Country` — NOT Vercel's `x-vercel-ip-country`.
 * Reading only the Vercel header was the bug that left every user's
 * country null in production. We read CloudFront first, then fall back to
 * Vercel / Cloudflare for portability. Returns `undefined` when unknown
 * (local dev, placeholder "XX"/"T1", or CloudFront not yet forwarding the
 * header).
 *
 * INFRA NOTE (AWS): CloudFront only adds `CloudFront-Viewer-Country` when
 * the cache behavior's Origin Request Policy forwards CloudFront geo
 * headers (e.g. the managed `AllViewerAndCloudFrontHeaders-2022-06`
 * policy). Without that, the header never reaches the origin and country
 * stays null no matter what this code does.
 */
export function getCountry(req: NextRequest): string | undefined {
  const h = req.headers
  const raw =
    h.get('cloudfront-viewer-country') || // AWS CloudFront
    h.get('x-vercel-ip-country') || // Vercel
    h.get('cf-ipcountry') || // Cloudflare
    ''
  const v = raw.trim().toUpperCase()
  // "XX" (CloudFront) / "T1" (Tor, Cloudflare) are "unknown" placeholders.
  if (v && v !== 'XX' && v !== 'T1') return v

  // No usable country header → fall back to the viewer's IANA time zone
  // (e.g. "Asia/Ho_Chi_Minh"), which still narrows down the region. We
  // store it in the same `country` field. CloudFront sends this as
  // `CloudFront-Viewer-Time-Zone` via the same managed Origin Request
  // Policy that adds the country header (AllViewerAndCloudFrontHeaders).
  const tz = h.get('cloudfront-viewer-time-zone')?.trim()
  return tz || undefined
}
