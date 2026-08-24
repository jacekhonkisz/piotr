/**
 * Email environment helpers.
 *
 * Values stored by the hosting provider can carry stray whitespace — an env var
 * created with `echo` keeps a trailing newline. A newline inside a From address
 * breaks the SMTP header, so every address is sanitized before it reaches a
 * provider.
 */

/** Strip line breaks and surrounding whitespace from an env-provided value. */
export function sanitizeEnvValue(value: string | undefined | null): string {
  return (value ?? '').replace(/[\r\n]+/g, '').trim();
}

/**
 * Resend's shared sandbox sender domain. Messages sent from it are only ever
 * delivered to the Resend account owner, so it can never reach clients or the
 * internal review recipients.
 */
export const RESEND_SANDBOX_DOMAIN = 'resend.dev';

export function isResendSandboxSender(address: string): boolean {
  return sanitizeEnvValue(address).toLowerCase().endsWith(`@${RESEND_SANDBOX_DOMAIN}`);
}

export function getResendFromAddress(): string {
  return sanitizeEnvValue(process.env.EMAIL_FROM_ADDRESS) || `onboarding@${RESEND_SANDBOX_DOMAIN}`;
}

export function getGmailUser(): string {
  return sanitizeEnvValue(process.env.GMAIL_USER);
}

export function getCustomSmtpUser(): string {
  return sanitizeEnvValue(process.env.CUSTOM_SMTP_USER);
}

/** Human-readable hint appended to provider failures so the admin UI is actionable. */
export function describeSandboxSenderProblem(fromAddress: string): string {
  return (
    `Nadawca "${fromAddress}" należy do współdzielonej domeny testowej Resend — ` +
    'Resend dostarczy taką wiadomość wyłącznie na adres właściciela konta. ' +
    'Zweryfikuj własną domenę na resend.com/domains i ustaw EMAIL_FROM_ADDRESS na adres w tej domenie, ' +
    'albo skonfiguruj CUSTOM_SMTP_HOST / CUSTOM_SMTP_USER / CUSTOM_SMTP_PASSWORD.'
  );
}
