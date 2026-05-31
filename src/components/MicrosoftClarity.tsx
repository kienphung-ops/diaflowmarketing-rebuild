import Script from 'next/script'

/**
 * Microsoft Clarity — session recording + heatmaps.
 *
 * The base script provides click heatmaps, scroll depth maps, session
 * recordings, and rage/dead-click detection with zero custom config.
 * Custom events are fired separately via `window.clarity('event', name)`
 * in our tracking utility.
 *
 * Only renders when NEXT_PUBLIC_CLARITY_ID is set — safe to deploy
 * before the Clarity project is created.
 */
export function MicrosoftClarity() {
  const id = process.env.NEXT_PUBLIC_CLARITY_ID
  if (!id) return null

  return (
    <Script id="ms-clarity" strategy="afterInteractive">{`
      (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
      })(window,document,"clarity","script","${id}");
    `}</Script>
  )
}
