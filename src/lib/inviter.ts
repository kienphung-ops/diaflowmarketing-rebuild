/**
 * Inviter — the user who invited the currently-signed-in user.
 *
 * Sourced from the User.referredBy self-relation; sealed once at signup,
 * never overwritten (see User.referredByCode + User.referredAt in
 * schema.prisma).
 *
 * `emailMasked` is `k***@diaflow.io`-style so the recipient gets a hint
 * of who invited them (especially the domain, which is the strongest
 * trust signal) without leaking the inviter's full address.
 */
export interface InviterInfo {
  referralCode: string
  teamName: string | null
  country: string | null
  emailMasked: string
  invitedAt: string | null // ISO datetime
}

/** "kien.phung@diaflow.io" → "k***@diaflow.io" — preserves domain for trust. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return email
  const visible = local.slice(0, 1)
  return `${visible}${'*'.repeat(Math.max(2, local.length - 1))}@${domain}`
}
