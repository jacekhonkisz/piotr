import { NextRequest, NextResponse } from 'next/server';

/**
 * Edge middleware.
 *
 * Primary job: lock down developer/diagnostic API routes so they are NOT
 * reachable in production. These endpoints exist purely for local debugging
 * and one-off maintenance (RLS policy tweaks, cache inspection, migration
 * verification, synthetic writes). Leaving them exposed in production is a
 * security risk because several of them mutate the database without auth.
 *
 * In production these paths return 404 (indistinguishable from "not found")
 * unless the caller presents `Authorization: Bearer <CRON_SECRET>`, which
 * lets an operator still hit them intentionally.
 */

// Exact pathnames that must be blocked in production. Kept as an explicit
// allowlist (not a prefix match) so legitimate endpoints such as
// `/api/test-meta-validation`, `/api/admin/test-email`, and `/api/ping`
// remain fully accessible.
const BLOCKED_DEV_PATHS = new Set<string>([
  '/api/debug',
  '/api/debug-calendar-data',
  '/api/debug-yoy-vs-reports',
  '/api/debug-cache-tables',
  '/api/debug-auth-context',
  '/api/debug-campaign-names',
  '/api/test',
  '/api/test/check-week-params',
  '/api/test/collect-belmonte-only',
  '/api/test-rls-disabled',
  '/api/test-rls-fix',
  '/api/test-cache-update',
  '/api/test-cache-storage',
  '/api/test-cache-direct',
  '/api/test-campaign-data',
  '/api/create-rls-policies',
  '/api/fix-cache-policies',
  '/api/disable-cache-rls',
  '/api/check-rls-policies',
  '/api/final-cache-test',
  '/api/verify-migration',
  '/api/simple',
]);

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

export function middleware(request: NextRequest): NextResponse {
  const pathname = normalizePath(request.nextUrl.pathname);

  if (!BLOCKED_DEV_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  // Only enforce in production. Local/preview development keeps these tools.
  if (process.env.NODE_ENV !== 'production') {
    return NextResponse.next();
  }

  // Escape hatch: an operator with the cron secret can still reach them.
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return NextResponse.next();
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export const config = {
  matcher: [
    '/api/debug',
    '/api/debug-calendar-data',
    '/api/debug-yoy-vs-reports',
    '/api/debug-cache-tables',
    '/api/debug-auth-context',
    '/api/debug-campaign-names',
    '/api/test',
    '/api/test/:path*',
    '/api/test-rls-disabled',
    '/api/test-rls-fix',
    '/api/test-cache-update',
    '/api/test-cache-storage',
    '/api/test-cache-direct',
    '/api/test-campaign-data',
    '/api/create-rls-policies',
    '/api/fix-cache-policies',
    '/api/disable-cache-rls',
    '/api/check-rls-policies',
    '/api/final-cache-test',
    '/api/verify-migration',
    '/api/simple',
  ],
};
