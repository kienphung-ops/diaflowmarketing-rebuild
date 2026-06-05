import { Resend } from 'resend'

interface SendAuthEmailArgs {
  to: string
  magicLinkUrl: string
  otp: string
}

function getResendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  return new Resend(key)
}

function buildAuthEmailHtml({ magicLinkUrl, otp }: { magicLinkUrl: string; otp: string }): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:32px 16px;background:#0a0e27;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e8e8f0;">
    <div style="max-width:480px;margin:0 auto;background:#1a1a2e;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:32px;">
      <h1 style="margin:0 0 12px;font-size:22px;color:#ffffff;">Sign in to Diaflow AI Teammates</h1>
      <p style="margin:0 0 24px;color:rgba(255,255,255,0.7);font-size:14px;line-height:1.6;">
        Click the button below to sign in instantly, or enter the 6-digit code on the page.
      </p>
      <a href="${magicLinkUrl}"
         style="display:inline-block;background:#fbbf24;color:#0a0e27;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:700;font-size:14px;">
        Sign in to Diaflow
      </a>
      <p style="margin:28px 0 8px;color:rgba(255,255,255,0.55);font-size:13px;">Or enter this code:</p>
      <div style="font-family:'SF Mono',Menlo,monospace;font-size:28px;letter-spacing:6px;font-weight:700;color:#ffffff;">${otp}</div>
      <p style="margin-top:24px;color:rgba(255,255,255,0.4);font-size:12px;line-height:1.5;">
        This link and code expire in 15 minutes. If you didn't request this, you can safely ignore the email.
      </p>
    </div>
  </body>
</html>`
}

function buildAuthEmailText({ magicLinkUrl, otp }: { magicLinkUrl: string; otp: string }): string {
  return `Sign in to Diaflow AI Teammates

Click the link to sign in instantly:
${magicLinkUrl}

Or enter this 6-digit code on the page:
${otp}

The link and code expire in 15 minutes.`
}

export async function sendAuthEmail({ to, magicLinkUrl, otp }: SendAuthEmailArgs): Promise<void> {
  const client = getResendClient()
  const from = process.env.EMAIL_FROM ?? 'Diaflow <onboarding@resend.dev>'
  const subject = 'Your Diaflow sign-in link'

  // Always log in dev — useful for local testing without opening the inbox.
  if (process.env.NODE_ENV !== 'production') {
    console.log('[email:dev]')
    console.log(`  to:      ${to}`)
    console.log(`  subject: ${subject}`)
    console.log(`  link:    ${magicLinkUrl}`)
    console.log(`  otp:     ${otp}`)
  }

  if (!client) return

  try {
    const result = await client.emails.send({
      from,
      to,
      subject,
      html: buildAuthEmailHtml({ magicLinkUrl, otp }),
      text: buildAuthEmailText({ magicLinkUrl, otp }),
    })
    if (result.error) {
      console.error('[email:resend]', result.error)
    }
  } catch (err) {
    console.error('[email:resend]', err)
  }
}
