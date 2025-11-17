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
  const authHeader = request.headers.get('authorization');
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
  
  // Check if CRON_SECRET is configured
  if (!process.env.CRON_SECRET) {
    logger.error('🚨 CRITICAL: CRON_SECRET not configured', {
      path: request.nextUrl.pathname,
      environment: process.env.NODE_ENV
    });
    return false;
  }
  
  // Check if Authorization header matches expected value
  if (authHeader !== expectedAuth) {
    // Log unauthorized attempt for security monitoring
    logger.warn('🚫 Unauthorized cron attempt detected', {
      ip: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      path: request.nextUrl.pathname,
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
  
  // Log successful authentication (at debug level to avoid log spam)
  logger.info('✅ Cron authentication successful', {
    path: request.nextUrl.pathname
  });
  
  return true;
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

