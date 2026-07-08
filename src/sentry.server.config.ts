/**
 * Sentry server-side initialization.
 *
 * Only initializes when a DSN is provided, so the app runs as a no-op when
 * Sentry is not configured (e.g. local development without a DSN).
 */
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    debug: false
  });
}
