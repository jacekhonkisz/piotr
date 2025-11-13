import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '../../../lib/auth-middleware';
import { rateLimit, rateLimitConfigs, createRateLimitHeaders } from '../../../lib/rate-limit';

/**
 * Health Check Endpoint
 * 
 * Basic health check with authentication and rate limiting
 * Used by: Load balancers, monitoring systems
 */
export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = await rateLimit(request, rateLimitConfigs.health);
    
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          retryAfter: rateLimitResult.retryAfter
        },
        { 
          status: 429,
          headers: createRateLimitHeaders(rateLimitResult)
        }
      );
    }
    
    // Authenticate the request
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ 
        error: 'Authentication required' 
      }, { status: 401 });
    }
    
    // Only allow admin users to check system health
    if (authResult.user.role !== 'admin') {
      return NextResponse.json({ 
        error: 'Admin access required' 
      }, { status: 403 });
    }
    
    return NextResponse.json({ 
      status: 'ok',
      timestamp: new Date().toISOString(),
      node_version: process.version,
      authenticated: true,
      user: authResult.user.email
    }, {
      headers: createRateLimitHeaders(rateLimitResult)
    });
  } catch (error) {
    return NextResponse.json({ 
      error: 'Health check failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}