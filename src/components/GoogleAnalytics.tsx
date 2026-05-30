import Script from 'next/script'

interface Props {
  gaId: string
}

/**
 * GA4 page-view tracking. Renders the gtag scripts only when a measurement
 * ID is configured via NEXT_PUBLIC_GA_ID. Standard `next/script` strategy
 * "afterInteractive" gets us page-view tracking without blocking first paint.
 */
export function GoogleAnalytics({ gaId }: Props) {
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">{`
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${gaId}', { send_page_view: true });
      `}</Script>
    </>
  )
}
