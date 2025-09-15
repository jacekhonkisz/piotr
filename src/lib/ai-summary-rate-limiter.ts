/**
 * AI Summary Rate Limiter
 * 
 * Implements rate limiting for AI summary generation to prevent abuse and control costs
 */

import logger from './logger';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class AISummaryRateLimiter {
  private static instance: AISummaryRateLimiter;
  private limits: Map<string, RateLimitEntry> = new Map();
  
  // Rate limits (requests per time window)
  private readonly limitsConfig = {
    perMinute: 60,
    perHour: 1000,
    perDay: 10000
  };
  
  private constructor() {}
  
  static getInstance(): AISummaryRateLimiter {
    if (!AISummaryRateLimiter.instance) {
      AISummaryRateLimiter.instance = new AISummaryRateLimiter();
    }
    return AISummaryRateLimiter.instance;
  }
  
  /**
   * Check if a request is allowed based on rate limits
   * @param identifier - Unique identifier for rate limiting (e.g., client ID, IP)
   * @returns Object with allowed status and reset time
   */
  checkRateLimit(identifier: string): { allowed: boolean; resetTime?: number; reason?: string } {
    const now = Date.now();
    const minuteKey = `${identifier}:minute:${Math.floor(now / 60000)}`;
    const hourKey = `${identifier}:hour:${Math.floor(now / 3600000)}`;
    const dayKey = `${identifier}:day:${Math.floor(now / 86400000)}`;
    
    // Check minute limit
    const minuteEntry = this.limits.get(minuteKey);
    if (minuteEntry && minuteEntry.count >= this.limitsConfig.perMinute) {
      return {
        allowed: false,
        resetTime: minuteEntry.resetTime,
        reason: 'Minute rate limit exceeded'
      };
    }
    
    // Check hour limit
    const hourEntry = this.limits.get(hourKey);
    if (hourEntry && hourEntry.count >= this.limitsConfig.perHour) {
      return {
        allowed: false,
        resetTime: hourEntry.resetTime,
        reason: 'Hour rate limit exceeded'
      };
    }
    
    // Check day limit
    const dayEntry = this.limits.get(dayKey);
    if (dayEntry && dayEntry.count >= this.limitsConfig.perDay) {
      return {
        allowed: false,
        resetTime: dayEntry.resetTime,
        reason: 'Daily rate limit exceeded'
      };
    }
    
    return { allowed: true };
  }
  
  /**
   * Record a request for rate limiting
   * @param identifier - Unique identifier for rate limiting
   */
  recordRequest(identifier: string): void {
    const now = Date.now();
    const minuteKey = `${identifier}:minute:${Math.floor(now / 60000)}`;
    const hourKey = `${identifier}:hour:${Math.floor(now / 3600000)}`;
    const dayKey = `${identifier}:day:${Math.floor(now / 86400000)}`;
    
    // Increment minute counter
    const minuteEntry = this.limits.get(minuteKey);
    if (minuteEntry) {
      minuteEntry.count++;
    } else {
      this.limits.set(minuteKey, {
        count: 1,
        resetTime: now + 60000 // Reset in 1 minute
      });
    }
    
    // Increment hour counter
    const hourEntry = this.limits.get(hourKey);
    if (hourEntry) {
      hourEntry.count++;
    } else {
      this.limits.set(hourKey, {
        count: 1,
        resetTime: now + 3600000 // Reset in 1 hour
      });
    }
    
    // Increment day counter
    const dayEntry = this.limits.get(dayKey);
    if (dayEntry) {
      dayEntry.count++;
    } else {
      this.limits.set(dayKey, {
        count: 1,
        resetTime: now + 86400000 // Reset in 1 day
      });
    }
    
    // Clean up old entries
    this.cleanupOldEntries(now);
  }
  
  /**
   * Get current rate limit status for an identifier
   * @param identifier - Unique identifier for rate limiting
   * @returns Current rate limit status
   */
  getRateLimitStatus(identifier: string): {
    minute: { count: number; limit: number; resetTime: number };
    hour: { count: number; limit: number; resetTime: number };
    day: { count: number; limit: number; resetTime: number };
  } {
    const now = Date.now();
    const minuteKey = `${identifier}:minute:${Math.floor(now / 60000)}`;
    const hourKey = `${identifier}:hour:${Math.floor(now / 3600000)}`;
    const dayKey = `${identifier}:day:${Math.floor(now / 86400000)}`;
    
    const minuteEntry = this.limits.get(minuteKey);
    const hourEntry = this.limits.get(hourKey);
    const dayEntry = this.limits.get(dayKey);
    
    return {
      minute: {
        count: minuteEntry?.count || 0,
        limit: this.limitsConfig.perMinute,
        resetTime: minuteEntry?.resetTime || now + 60000
      },
      hour: {
        count: hourEntry?.count || 0,
        limit: this.limitsConfig.perHour,
        resetTime: hourEntry?.resetTime || now + 3600000
      },
      day: {
        count: dayEntry?.count || 0,
        limit: this.limitsConfig.perDay,
        resetTime: dayEntry?.resetTime || now + 86400000
      }
    };
  }
  
  /**
   * Clean up old rate limit entries to prevent memory leaks
   * @param now - Current timestamp
   */
  private cleanupOldEntries(now: number): void {
    const cutoffTime = now - 86400000; // Keep entries from last 24 hours
    
    for (const [key, entry] of this.limits.entries()) {
      if (entry.resetTime < cutoffTime) {
        this.limits.delete(key);
      }
    }
  }
  
  /**
   * Reset rate limits for a specific identifier (admin function)
   * @param identifier - Unique identifier for rate limiting
   */
  resetRateLimit(identifier: string): void {
    const now = Date.now();
    const minuteKey = `${identifier}:minute:${Math.floor(now / 60000)}`;
    const hourKey = `${identifier}:hour:${Math.floor(now / 3600000)}`;
    const dayKey = `${identifier}:day:${Math.floor(now / 86400000)}`;
    
    this.limits.delete(minuteKey);
    this.limits.delete(hourKey);
    this.limits.delete(dayKey);
    
    logger.info(`🔄 Rate limits reset for identifier: ${identifier}`);
  }
}

export default AISummaryRateLimiter;
