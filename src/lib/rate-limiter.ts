import rateLimit from 'express-rate-limit'
import logger from './logger'

export const createRateLimiter = (options: {
  windowMs?: number
  max?: number
  message?: string
  keyGenerator?: (req: any) => string
}) => {
  return rateLimit({
    windowMs: options.windowMs || 15 * 60 * 1000, // 15 minutes
    max: options.max || 100, // limit each IP to 100 requests per windowMs
    message: options.message || 'Too many requests from this IP',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: options.keyGenerator || ((req) => req.ip),
    handler: (req, res) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        endpoint: req.path,
        userAgent: req.get('User-Agent')
      })
      res.status(429).json({
        error: options.message || 'Too many requests from this IP, please try again later.'
      })
    }
  })
}

export const apiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many API requests from this IP, please try again later.'
})

export const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many authentication attempts, please try again later.'
})

export const reportGenerationLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each IP to 10 report generations per hour
  message: 'Too many report generation requests, please try again later.'
}) 

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  retryAfterMs: number;
}

interface RateLimitState {
  requests: number[];
  lastReset: number;
}

export class RateLimiter {
  private static instances = new Map<string, RateLimiter>();
  private state: RateLimitState;
  private config: RateLimitConfig;

  constructor(name: string, config: RateLimitConfig) {
    this.config = config;
    this.state = {
      requests: [],
      lastReset: Date.now()
    };
  }

  static getInstance(name: string, config: RateLimitConfig): RateLimiter {
    if (!RateLimiter.instances.has(name)) {
      RateLimiter.instances.set(name, new RateLimiter(name, config));
    }
    return RateLimiter.instances.get(name)!;
  }

  async checkLimit(): Promise<{ allowed: boolean; waitMs: number }> {
    const now = Date.now();
    
    // Clean up old requests outside the window
    this.state.requests = this.state.requests.filter(
      timestamp => now - timestamp < this.config.windowMs
    );

    // Check if we're within limits
    if (this.state.requests.length < this.config.maxRequests) {
      this.state.requests.push(now);
      return { allowed: true, waitMs: 0 };
    }

    // Calculate wait time
    const oldestRequest = Math.min(...this.state.requests);
    const waitMs = this.config.windowMs - (now - oldestRequest);

    return { allowed: false, waitMs: Math.max(waitMs, this.config.retryAfterMs) };
  }

  async waitForSlot(): Promise<void> {
    while (true) {
      const { allowed, waitMs } = await this.checkLimit();
      if (allowed) break;
      
      console.log(`⏳ Rate limit reached, waiting ${waitMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }
  }

  getStatus(): { current: number; limit: number; resetInMs: number } {
    const now = Date.now();
    const oldestRequest = this.state.requests.length > 0 ? Math.min(...this.state.requests) : now;
    const resetInMs = this.config.windowMs - (now - oldestRequest);

    return {
      current: this.state.requests.length,
      limit: this.config.maxRequests,
      resetInMs: Math.max(0, resetInMs)
    };
  }
}

// Pre-configured rate limiters for different services
export const metaAPIRateLimiter = RateLimiter.getInstance('meta_api', {
  maxRequests: 200,      // 200 requests per hour (Meta's limit is ~200/hour)
  windowMs: 60 * 60 * 1000, // 1 hour
  retryAfterMs: 5000     // Wait 5 seconds between retries
});

export const databaseRateLimiter = RateLimiter.getInstance('database', {
  maxRequests: 1000,     // 1000 requests per minute
  windowMs: 60 * 1000,   // 1 minute
  retryAfterMs: 1000     // Wait 1 second between retries
});

export const cacheRefreshRateLimiter = RateLimiter.getInstance('cache_refresh', {
  maxRequests: 10,       // 10 cache refreshes per minute
  windowMs: 60 * 1000,   // 1 minute
  retryAfterMs: 2000     // Wait 2 seconds between retries
}); 