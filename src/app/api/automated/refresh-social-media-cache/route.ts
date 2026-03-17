import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth, createUnauthorizedResponse } from '../../../../lib/cron-auth';

/**
 * Legacy social media cache refresh endpoint.
 * All cache refresh logic is now handled by /api/automated/refresh-all-caches.
 * This route exists only to prevent cron job errors.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return createUnauthorizedResponse();
  }

  return NextResponse.json({
    success: true,
    message: 'Social media cache refresh is handled by /api/automated/refresh-all-caches',
    timestamp: new Date().toISOString()
  });
}
