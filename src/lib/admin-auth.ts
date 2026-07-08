/**
 * Admin Route Guard
 *
 * Centralized authorization for /api/admin/* endpoints. Accepts either:
 * - A Supabase JWT belonging to a user with the `admin` role, or
 * - The CRON_SECRET bearer token (operator / internal server-to-server calls).
 *
 * Usage:
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   const guard = await requireAdminAuth(request);
 *   if (!guard.authorized) return guard.response;
 *   // ... handler logic
 * }
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, requireAdmin } from './auth-middleware';
import logger from './logger';

export type AdminGuardResult =
  | { authorized: true; userId: string | null }
  | { authorized: false; response: NextResponse };

export async function requireAdminAuth(request: NextRequest): Promise<AdminGuardResult> {
  const authHeader = request.headers.get('authorization');

  // Operator / internal calls with the cron secret are allowed.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return { authorized: true, userId: null };
  }

  const authResult = await authenticateRequest(request);
  if (!authResult.success || !authResult.user) {
    logger.warn('Blocked unauthenticated admin API request', {
      path: request.nextUrl.pathname,
      ip: request.headers.get('x-forwarded-for') || 'unknown',
    });
    return {
      authorized: false,
      response: NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: authResult.statusCode || 401 }
      ),
    };
  }

  if (!requireAdmin(authResult.user)) {
    logger.warn('Blocked non-admin user from admin API', {
      path: request.nextUrl.pathname,
      userId: authResult.user.id,
    });
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Admin access required' }, { status: 403 }),
    };
  }

  return { authorized: true, userId: authResult.user.id };
}
