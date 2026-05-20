-- New TokenType variants for the email-verification and password-reset
-- flows. Existing rows are unaffected; old values (MAGIC_LINK / OTP)
-- keep their current meaning.
ALTER TYPE "TokenType" ADD VALUE 'EMAIL_VERIFY';
ALTER TYPE "TokenType" ADD VALUE 'PASSWORD_RESET';
