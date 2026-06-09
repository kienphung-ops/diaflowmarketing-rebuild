/**
 * Detect social-media in-app (embedded webview) browsers.
 *
 * Google blocks OAuth ("disallowed_useragent" / 403 policy) inside these
 * webviews for security, so when we detect one we hide the Google button
 * and ask the user to open the page in a real browser. Pure function —
 * pass `navigator.userAgent`. See `useIsInAppBrowser` for the React hook.
 */

// UA tokens that identify a known in-app browser. Kept conservative to
// avoid false positives (we only block Google sign-in, so a miss just
// means the user gets Google's own error; a false positive needlessly
// hides the button).
const IN_APP_TOKENS = [
  'FBAN', 'FBAV', 'FB_IAB', 'FBIOS', 'FBSS', // Facebook
  'Messenger', 'MessengerForiOS', // Messenger
  'Instagram',
  'Line/', // LINE
  'Twitter', // Twitter / X
  'LinkedInApp',
  'Snapchat',
  'Pinterest',
  'TikTok', 'musical_ly', 'BytedanceWebview', // TikTok
  'Zalo',
  'KAKAOTALK',
  'MicroMessenger', // WeChat
]

/** True when the UA looks like a social-media in-app webview. */
export function detectInAppBrowser(ua: string | null | undefined): boolean {
  if (!ua) return false
  if (IN_APP_TOKENS.some(token => ua.includes(token))) return true
  // Android System WebView marker ("; wv)" inside an Android UA) — most
  // generic in-app browsers on Android carry this.
  if (/Android/.test(ua) && /;\s*wv\)/.test(ua)) return true
  return false
}
