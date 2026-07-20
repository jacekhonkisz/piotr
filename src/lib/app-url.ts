/**
 * Canonical app URL for auth redirects (password reset, email confirm, etc.).
 * Prefer NEXT_PUBLIC_APP_URL so production emails always point at the deployed domain,
 * even when the reset request is triggered from a preview or alternate host.
 */
export function getAppUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  if (configured) {
    return configured;
  }

  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  return 'http://localhost:3000';
}

export function getPasswordResetUrl(): string {
  return `${getAppUrl()}/auth/reset-password`;
}
