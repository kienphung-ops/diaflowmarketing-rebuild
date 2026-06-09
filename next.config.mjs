/** @type {import('next').NextConfig} */
const config = {
  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei'],
  webpack: config => {
    config.externals = [...(config.externals ?? []), { canvas: 'canvas' }]
    return config
  },
  // Auth routes set the session cookie via `Set-Cookie`. A CDN (e.g.
  // CloudFront in front of the AWS prod deploy) will STRIP Set-Cookie if
  // it caches the response. Marking these responses `no-store` tells the
  // CDN not to cache them, so the cookie header survives to the browser.
  // NOTE: this only covers the "cached response" case. If the CloudFront
  // cache behavior is set to "Forward Cookies: None" (or a Cache Policy
  // without cookies), it strips Set-Cookie regardless — that must be
  // fixed in CloudFront (CachingDisabled + AllViewer origin policy for
  // /api/*).
  async headers() {
    return [
      {
        source: '/api/auth/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, max-age=0' },
        ],
      },
    ]
  },
}

export default config
