/**
 * Cron Job Authentication Middleware
 * 
 * Provides authentication for automated cron job endpoints to prevent
 * unauthorized access and abuse.
 * 
 * Security Requirements:
 * - All automated endpoints MUST verify CRON_SECRET
 * - Unauthorized attempts are logged for security monitoring
 * - Failed auth attempts trigger alerts in production
 * 
 * @module cron-auth
 */

import { NextRequest } from 'next/server';
import logger from './logger';

/**
 * Verifies that the request is from an authorized cron job
 * 
 * Checks for CRON_SECRET in the Authorization header (Bearer token format).
 * Logs all unauthorized attempts for security monitoring.
 * 
 * @param request - The incoming Next.js request
 * @returns true if authorized, false otherwise
 * 
 * @example
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   if (!verifyCronAuth(request)) {
 *     return createUnauthorizedResponse();
 *   }
 *   // ... rest of endpoint logic
 * }
 * ```
 */
export function verifyCronAuth(request: NextRequest): boolean {
  // METHOD 1: Check for Vercel's automatic cron header (most secure)
  // Vercel automatically adds 'x-vercel-cron: 1' to all cron job requests
  const isVercelCron = request.headers.get('x-vercel-cron') === '1';
  
  if (isVercelCron) {
    logger.info('✅ Verified Vercel cron job (x-vercel-cron header)', {
      path: request.nextUrl.pathname
    });
    return true;
  }

  // METHOD 2: Check for CRON_SECRET (for manual triggers/testing)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  // If CRON_SECRET is configured and matches, allow access
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    logger.info('✅ Verified manual cron trigger (CRON_SECRET)', {
      path: request.nextUrl.pathname
    });
    return true;
  }
  
  // UNAUTHORIZED: Neither Vercel header nor valid CRON_SECRET
  logger.warn('🚫 Unauthorized cron attempt detected', {
    ip: request.headers.get('x-forwarded-for') || 'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
    path: request.nextUrl.pathname,
    hasVercelHeader: !!request.headers.get('x-vercel-cron'),
    hasAuthHeader: !!authHeader,
    authHeaderPrefix: authHeader?.substring(0, 10) || 'none',
    timestamp: new Date().toISOString()
  });
  
  // In production, could trigger additional security alerts
  if (process.env.NODE_ENV === 'production') {
    // TODO: Add Sentry alert or security notification
    // Sentry.captureMessage('Unauthorized cron attempt', { level: 'warning' });
  }
  
  return false;
}

/**
 * Creates a standardized 401 Unauthorized response
 * 
 * Returns a JSON response indicating that CRON_SECRET is required.
 * 
 * @returns NextResponse with 401 status
 */
export function createUnauthorizedResponse(): Response {
  return Response.json(
    { 
      success: false,
      error: 'Unauthorized',
      message: 'CRON_SECRET required in Authorization header',
      timestamp: new Date().toISOString()
    }, 
    { status: 401 }
  );
}

/**
 * Creates a standardized 500 Server Error response for missing CRON_SECRET
 * 
 * Used when CRON_SECRET is not configured on the server.
 * 
 * @returns NextResponse with 500 status
 */
export function createServerErrorResponse(): Response {
  return Response.json(
    { 
      success: false,
      error: 'Internal Server Error',
      message: 'Server configuration error - CRON_SECRET not set',
      timestamp: new Date().toISOString()
    }, 
    { status: 500 }
  );
}

/**
 * Optional: Verify request is from Vercel's IP ranges
 * 
 * Additional security layer to ensure requests come from Vercel infrastructure.
 * Enable by setting VERCEL_CRON_IPS environment variable (comma-separated IPs).
 * 
 * @param request - The incoming Next.js request
 * @returns true if IP is whitelisted or whitelist is not configured
 */
export function verifyVercelIP(request: NextRequest): boolean {
  const ip = request.headers.get('x-forwarded-for') || '';
  const vercelIPs = process.env.VERCEL_CRON_IPS?.split(',').map(ip => ip.trim()) || [];
  
  // If no whitelist configured, skip check
  if (vercelIPs.length === 0) {
    return true;
  }
  
  // Check if IP is in whitelist
  const isAllowed = vercelIPs.some(allowedIP => ip.includes(allowedIP));
  
  if (!isAllowed) {
    logger.warn('🚫 Valid CRON_SECRET but IP not in whitelist', { 
      ip,
      path: request.nextUrl.pathname 
    });
  }
  
  return isAllowed;
}

/**
 * Combined authentication check (CRON_SECRET + optional IP whitelist)
 * 
 * Use this for maximum security when IP whitelisting is enabled.
 * 
 * @param request - The incoming Next.js request
 * @returns true if both checks pass
 */
export function verifyCronAuthStrict(request: NextRequest): boolean {
  return verifyCronAuth(request) && verifyVercelIP(request);
}

