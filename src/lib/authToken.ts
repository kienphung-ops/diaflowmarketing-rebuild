/**
 * AuthToken.type — canonical value set.
 *
 * The DB column is plain TEXT (no Postgres enum) — same convention as
 * SpinGrant.source / SpinResult.wedge. The TS enum below is the single
 * source of truth for the legal string values; the column accepts any
 * string but the backend only ever writes these four.
 *
 * String-valued enum so each member's runtime value IS the string we
 * persist (`TOKEN_TYPES.OTP === 'OTP'`), and equality checks against
 * the column value (which Prisma types as `string`) just work.
 *
 * Used by:
 *   - lib/authVerify.ts (consumeAuthToken)
 *   - app/api/auth/request          → writes MAGIC_LINK + OTP rows
 *   - app/api/auth/verify           → consumes MAGIC_LINK
 *   - app/api/auth/verify-otp       → consumes OTP
 *   - app/api/auth/verify-email     → consumes EMAIL_VERIFY
 *   - app/api/auth/send-verification → writes EMAIL_VERIFY
 *   - app/api/auth/password-reset/* → writes / consumes PASSWORD_RESET
 */

export enum TOKEN_TYPES {
  MAGIC_LINK = 'MAGIC_LINK',
  OTP = 'OTP',
  EMAIL_VERIFY = 'EMAIL_VERIFY',
  PASSWORD_RESET = 'PASSWORD_RESET',
}

/** Runtime guard used at the trust boundary (route handlers) when a
 *  caller might supply an arbitrary string. */
export function isTokenType(v: string): v is TOKEN_TYPES {
  return Object.values(TOKEN_TYPES).includes(v as TOKEN_TYPES)
}
