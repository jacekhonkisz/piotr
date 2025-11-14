/**
 * Global API Rate Limiting Middleware
 * 
 * Provides rate limiting for Next.js API routes to prevent abuse
 * and protect against DDoS attacks.
 */

import { NextRequest, NextResponse } from 'next/server';
import logger from './logger';

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  message?: string; // Custom error message
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
}

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

// In-memory store (consider Redis for production scaling)
const rateLimitStore: RateLimitStore = {};

// Cleanup interval to remove expired entries
const CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute

// Start cleanup interval
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    Object.keys(rateLimitStore).forEach((key) => {
      if (rateLimitStore[key].resetTime < now) {
        delete rateLimitStore[key];
      }
    });
  }, CLEANUP_INTERVAL_MS);
}

/**
 * Get client identifier for rate limiting
 */
function getClientIdentifier(request: NextRequest): string {
  // Try to get IP from various headers (for proxies/load balancers)
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0] || realIp || 'unknown';
  
  // For authenticated requests, use user ID if available
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    // Extract user ID from token (simplified - you may want to decode JWT)
    const userIdMatch = authHeader.match(/user[_-]?id[=:]([^,;\s]+)/i);
    if (userIdMatch) {
      return `user:${userIdMatch[1]}`;
    }
  }
  
  return `ip:${ip}`;
}

/**
 * Create a rate limiter function
 */
export function createRateLimiter(config: RateLimitConfig) {
  return async (request: NextRequest): Promise<NextResponse | null> => {
    const identifier = getClientIdentifier(request);
    const now = Date.now();
    const key = `${identifier}:${request.nextUrl.pathname}`;
    
    // Get or create rate limit entry
    let entry = rateLimitStore[key];
    
    if (!entry || entry.resetTime < now) {
      // Create new entry or reset expired entry
      entry = {
        count: 0,
        resetTime: now + config.windowMs,
      };
      rateLimitStore[key] = entry;
    }
    
    // Increment request count
    entry.count++;
    
    // Check if limit exceeded
    if (entry.count > config.maxRequests) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      
      logger.warn('Rate limit exceeded', {
        identifier,
        path: request.nextUrl.pathname,
        count: entry.count,
        maxRequests: config.maxRequests,
        retryAfter,
      });
      
      return NextResponse.json(
        {
          error: config.message || 'Too many requests',
          retryAfter,
          resetTime: new Date(entry.resetTime).toISOString(),
        },
        {
          status: 429,
          headers: {
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Limit': config.maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': entry.resetTime.toString(),
          },
        }
      );
    }
    
    // Request allowed - add rate limit headers
    const remaining = Math.max(0, config.maxRequests - entry.count);
    
    // Return null to indicate request should proceed
    // The calling code should check headers if needed
    return null;
  };
}

/**
 * Default rate limiter configurations
 */
export const defaultRateLimiters = {
  // Standard API rate limit (100 requests per 15 minutes)
  api: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    message: 'Too many API requests. Please try again later.',
  }),
  
  // Strict rate limit for authentication endpoints (5 requests per 15 minutes)
  auth: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    message: 'Too many authentication attempts. Please try again later.',
  }),
  
  // PDF generation rate limit (10 requests per hour)
  pdf: createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10,
    message: 'Too many PDF generation requests. Please try again later.',
  }),
  
  // Health check rate limit (60 requests per minute)
  health: createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60,
    message: 'Too many health check requests.',
  }),
};

/**
 * Apply rate limiting to an API route handler
 * 
 * Usage:
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   const rateLimitResponse = await defaultRateLimiters.api(request);
 *   if (rateLimitResponse) return rateLimitResponse;
 *   
 *   // Your handler code here
 * }
 * ```
 */
export async function applyRateLimit(
  request: NextRequest,
  limiter: (req: NextRequest) => Promise<NextResponse | null> = defaultRateLimiters.api
): Promise<NextResponse | null> {
  return await limiter(request);
}

/**
 * Get rate limit status for monitoring
 */
export function getRateLimitStatus(): {
  activeEntries: number;
  totalRequests: number;
  store: RateLimitStore;
} {
  const activeEntries = Object.keys(rateLimitStore).length;
  const totalRequests = Object.values(rateLimitStore).reduce(
    (sum, entry) => sum + entry.count,
    0
  );
  
  return {
    activeEntries,
    totalRequests,
    store: { ...rateLimitStore }, // Return copy
  };
}




