import { NextRequest } from 'next/server';
import logger from './logger';

/**
 * Simple in-memory rate limiter
 * 
 * For production, consider using Redis or a rate limiting service
 * This implementation uses Map for simplicity but will reset on server restart
 */

interface RateLimitConfig {
  maxRequests: number;  // Max requests allowed
  windowMs: number;     // Time window in milliseconds
  skipFailedRequests?: boolean;  // Don't count failed requests
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store (consider Redis for production multi-instance setups)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Rate limiting middleware
 * 
 * @param request - NextRequest object
 * @param config - Rate limit configuration
 * @returns Object with allowed status and retry information
 */
export async function rateLimit(
  request: NextRequest,
  config: RateLimitConfig
): Promise<{
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}> {
  const { maxRequests, windowMs } = config;
  
  // Get identifier (user ID from auth or IP address)
  const identifier = await getRateLimitIdentifier(request);
  
  const now = Date.now();
  const resetTime = now + windowMs;
  
  // Get or create rate limit entry
  let entry = rateLimitStore.get(identifier);
  
  if (!entry || entry.resetTime < now) {
    // Create new entry or reset expired entry
    entry = {
      count: 1,
      resetTime
    };
    rateLimitStore.set(identifier, entry);
    
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetTime
    };
  }
  
  // Increment request count
  entry.count++;
  
  if (entry.count > maxRequests) {
    // Rate limit exceeded
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000); // seconds
    
    logger.warn('🚫 Rate limit exceeded', {
      identifier,
      count: entry.count,
      maxRequests,
      retryAfter
    });
    
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
      retryAfter
    };
  }
  
  // Request allowed
  return {
    allowed: true,
    remaining: maxRequests - entry.count,
    resetTime: entry.resetTime
  };
}

/**
 * Get rate limit identifier from request
 * Tries to use authenticated user ID, falls back to IP address
 */
async function getRateLimitIdentifier(request: NextRequest): Promise<string> {
  // Try to get user from auth header
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      // Use token hash as identifier (don't store full token)
      return `user:${hashString(token.substring(0, 20))}`;
    }
  } catch (error) {
    // Fall through to IP-based limiting
  }
  
  // Fall back to IP address
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0] || 
             request.headers.get('x-real-ip') || 
             'unknown';
  
  return `ip:${ip}`;
}

/**
 * Simple string hash function
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}

/**
 * Rate limit configurations for different endpoint types
 */
export const rateLimitConfigs = {
  // Strict limits for monitoring endpoints
  monitoring: {
    maxRequests: 60,
    windowMs: 60 * 1000  // 60 requests per minute
  },
  
  // More lenient for health checks
  health: {
    maxRequests: 120,
    windowMs: 60 * 1000  // 120 requests per minute
  },
  
  // Standard API limits
  api: {
    maxRequests: 100,
    windowMs: 60 * 1000  // 100 requests per minute
  },
  
  // Strict limits for data operations
  dataOperations: {
    maxRequests: 30,
    windowMs: 60 * 1000  // 30 requests per minute
  },
  
  // Very strict for expensive operations
  expensive: {
    maxRequests: 10,
    windowMs: 60 * 1000  // 10 requests per minute
  }
};

/**
 * Helper to create rate limit response headers
 */
export function createRateLimitHeaders(rateLimitResult: {
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
    'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString(),
  };
  
  if (rateLimitResult.retryAfter !== undefined) {
    headers['Retry-After'] = rateLimitResult.retryAfter.toString();
  }
  
  return headers;
}

/**
 * Reset rate limit for a specific identifier (admin use)
 */
export function resetRateLimit(identifier: string): void {
  rateLimitStore.delete(identifier);
  logger.info('🔄 Rate limit reset', { identifier });
}

/**
 * Get current rate limit statistics
 */
export function getRateLimitStats(): {
  totalIdentifiers: number;
  identifiers: Array<{ id: string; count: number; resetTime: number }>;
} {
  const identifiers = Array.from(rateLimitStore.entries()).map(([id, entry]) => ({
    id,
    count: entry.count,
    resetTime: entry.resetTime
  }));
  
  return {
    totalIdentifiers: rateLimitStore.size,
    identifiers
  };
}



