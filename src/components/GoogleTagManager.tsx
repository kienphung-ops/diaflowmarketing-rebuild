/**
 * Google Tag Manager — container `GTM-KDPNP5XB`.
 *
 * GTM is the umbrella that holds GA4, ad-pixel, and any other vendor
 * tags we want to deploy without touching code. The container is
 * configured in the GTM UI; this file only wires the loader.
 *
 * Two pieces, both required by Google's install instructions:
 *   1. `<GoogleTagManager />`         — head/body script that boots
 *      `dataLayer` and pulls down the GTM container JS. Rendered with
 *      `strategy="afterInteractive"` so it doesn't block first paint.
 *   2. `<GoogleTagManagerNoScript />` — `<noscript><iframe>` fallback
 *      that fires the container for users with JS disabled. Per
 *      Google's spec it must sit immediately inside `<body>`.
 *
 * The ID is hardcoded because GTM container IDs are public (any
 * visitor can see them in the network tab) and we don't expect to
 * swap containers per-environment. Override via `NEXT_PUBLIC_GTM_ID`
 * if a staging/dev container is ever needed.
 */

import Script from 'next/script'

const DEFAULT_GTM_ID = 'GTM-KDPNP5XB'

function getGtmId(): string {
  return process.env.NEXT_PUBLIC_GTM_ID || DEFAULT_GTM_ID
}

export function GoogleTagManager() {
  const id = getGtmId()
  return (
    <Script id="gtm-init" strategy="afterInteractive">{`
      (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
      new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
      j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
      'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
      })(window,document,'script','dataLayer','${id}');
    `}</Script>
  )
}

export function GoogleTagManagerNoScript() {
  const id = getGtmId()
  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${id}`}
        height="0"
        width="0"
        style={{ display: 'none', visibility: 'hidden' }}
      />
    </noscript>
  )
}
