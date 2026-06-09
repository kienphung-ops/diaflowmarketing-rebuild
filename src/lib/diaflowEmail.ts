/**
 * Diaflow Builder email transport.
 *
 * Uses the Diaflow Builders API (sk-* key) as our outbound mail
 * channel for transactional emails — email verification OTPs and
 * password-reset links. The legacy magic-link flow still uses Resend
 * (see lib/email.ts) for backwards compatibility.
 *
 * The endpoint accepts JSON `{ to, subject, body }` where `body` is
 * HTML. We add a Plain-shell template here so every email we send
 * shares the same look-and-feel.
 *
 * Failures are LOGGED but not thrown — calling code should treat
 * email delivery as best-effort. In dev (or when DIAFLOW_API_KEY is
 * missing) we just log the OTP / link to stdout so local testing
 * works without hitting the real API.
 */

const DIAFLOW_ENDPOINT = 'https://api.diaflow.io/api/v1/builders/2eTI6tCHgz/process'

interface SendArgs {
  to: string
  subject: string
  /** Inner HTML — wrapped in the dark Diaflow template before sending. */
  html: string
  /** Optional plaintext snippet — purely for the dev-mode console log. */
  devPreview?: string
}

function wrapTemplate(innerHtml: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:32px 16px;background:#0a0e27;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e8e8f0;">
    <div style="max-width:480px;margin:0 auto;background:#1a1a2e;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:32px;">
      ${innerHtml}
      <p style="margin-top:24px;color:rgba(255,255,255,0.4);font-size:12px;line-height:1.5;">
        — Diaflow AI Teammates
      </p>
    </div>
  </body>
</html>`
}

export async function sendDiaflowEmail({ to, subject, html, devPreview }: SendArgs): Promise<void> {
  const key = process.env.DIAFLOW_API_KEY

  // Always show a console preview in dev so a missing inbox / dead API
  // never blocks local testing.
  if (process.env.NODE_ENV !== 'production') {
    console.log('[email:diaflow:dev]')
    console.log(`  to:      ${to}`)
    console.log(`  subject: ${subject}`)
    if (devPreview) console.log(`  preview: ${devPreview}`)
  }

  if (!key) {
    console.warn('[email:diaflow] DIAFLOW_API_KEY not set — email not sent')
    return
  }

  const body = wrapTemplate(html)
  try {
    const res = await fetch(DIAFLOW_ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
      },
      body: JSON.stringify({ to, subject, body }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error('[email:diaflow]', res.status, text)
    }
  } catch (err) {
    console.error('[email:diaflow] fetch failed:', err)
  }
}

// ─── Pre-built email bodies ─────────────────────────────────────────────

export function buildVerifyEmailHtml({ otp }: { otp: string }): string {
  return `
    <h1 style="margin:0 0 12px;font-size:22px;color:#ffffff;">Verify your email</h1>
    <p style="margin:0 0 20px;color:rgba(255,255,255,0.7);font-size:14px;line-height:1.6;">
      Enter this 6-digit code on Diaflow AI Teammates to confirm your email address:
    </p>
    <div style="font-family:'SF Mono',Menlo,monospace;font-size:28px;letter-spacing:6px;font-weight:700;color:#fbbf24;">${otp}</div>
    <p style="margin-top:24px;color:rgba(255,255,255,0.4);font-size:12px;line-height:1.5;">
      This code expires in 15 minutes. If you didn't request it, you can safely ignore this email.
    </p>
  `
}

export function buildPasswordResetHtml({ resetUrl }: { resetUrl: string }): string {
  return `
    <h1 style="margin:0 0 12px;font-size:22px;color:#ffffff;">Reset your password</h1>
    <p style="margin:0 0 20px;color:rgba(255,255,255,0.7);font-size:14px;line-height:1.6;">
      Click the button below to set a new Diaflow AI Teammates password.
      The link is good for the next 30 minutes.
    </p>
    <a href="${resetUrl}"
       style="display:inline-block;background:#fbbf24;color:#0a0e27;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:700;font-size:14px;">
      Reset password
    </a>
    <p style="margin:24px 0 0;color:rgba(255,255,255,0.55);font-size:12px;line-height:1.5;">
      Or paste this URL into your browser:<br/>
      <span style="word-break:break-all;color:rgba(255,255,255,0.4);">${resetUrl}</span>
    </p>
    <p style="margin-top:24px;color:rgba(255,255,255,0.4);font-size:12px;line-height:1.5;">
      If you didn't ask to reset your password, no action is needed.
    </p>
  `
}
