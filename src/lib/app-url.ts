/**
 * Canonical app URL for links that leave the app (report emails, auth redirects).
 * Prefer NEXT_PUBLIC_APP_URL so production links always point at the deployed
 * domain, even when the request comes from a preview or alternate host.
 */
import { sanitizeEnvValue } from './email-env';

function normalizeUrl(value: string | undefined | null): string {
  return sanitizeEnvValue(value).replace(/\/+$/, '');
}

function isLocalhost(url: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/i.test(url);
}

function deployedUrl(): string {
  const host = normalizeUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL) || normalizeUrl(process.env.VERCEL_URL);
  return host ? `https://${host.replace(/^https?:\/\//, '')}` : '';
}

export function getAppUrl(): string {
  const configured = normalizeUrl(process.env.NEXT_PUBLIC_APP_URL);

  // A localhost value left in a deployed environment would produce dead links in
  // client-facing emails, so it is only honoured when nothing better is known.
  if (configured && !isLocalhost(configured)) {
    return configured;
  }

  const deployed = deployedUrl();
  if (deployed) {
    return deployed;
  }

  if (typeof window !== 'undefined') {
    return window.location.origin.replace(/\/+$/, '');
  }

  return configured || 'http://localhost:3000';
}

export function getPasswordResetUrl(): string {
  return `${getAppUrl()}/auth/reset-password`;
}
