/**
 * RATE LIMITER FOR GOOGLE ADS API
 * 
 * Implements rate limiting to prevent excessive API calls
 * and avoid token expiration issues
 */

export class RateLimiter {
  private lastCallTime: number = 0;
  private callCount: number = 0;
  private readonly minDelay: number;
  private readonly maxCallsPerMinute: number;
  private readonly backoffMultiplier: number;
  private readonly maxBackoffDelay: number;

  constructor(options: {
    minDelay?: number; // Minimum delay between calls (ms)
    maxCallsPerMinute?: number; // Maximum calls per minute
    backoffMultiplier?: number; // Exponential backoff multiplier
    maxBackoffDelay?: number; // Maximum backoff delay (ms)
  } = {}) {
    this.minDelay = options.minDelay || 500; // 500ms default - optimized for better performance
    this.maxCallsPerMinute = options.maxCallsPerMinute || 60; // 60 calls per minute (1 per second on average)
    this.backoffMultiplier = options.backoffMultiplier || 2;
    this.maxBackoffDelay = options.maxBackoffDelay || 30000; // 30 seconds max
  }

  /**
   * Wait for the appropriate delay before making an API call
   */
  async waitForNextCall(): Promise<void> {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastCallTime;
    
    // Reset call count every minute
    if (timeSinceLastCall > 60000) {
      this.callCount = 0;
    }
    
    // Check if we've exceeded the rate limit
    if (this.callCount >= this.maxCallsPerMinute) {
      const waitTime = 60000 - timeSinceLastCall;
      if (waitTime > 0) {
        console.log(`⏳ Rate limit reached, waiting ${waitTime}ms...`);
        await this.delay(waitTime);
        this.callCount = 0;
      }
    }
    
    // Ensure minimum delay between calls
    if (timeSinceLastCall < this.minDelay) {
      const waitTime = this.minDelay - timeSinceLastCall;
      console.log(`⏳ Minimum delay not met, waiting ${waitTime}ms...`);
      await this.delay(waitTime);
    }
    
    this.lastCallTime = Date.now();
    this.callCount++;
  }

  /**
   * Handle exponential backoff for failed requests
   */
  async handleBackoff(attempt: number): Promise<void> {
    if (attempt <= 1) return;
    
    const backoffDelay = Math.min(
      this.minDelay * Math.pow(this.backoffMultiplier, attempt - 1),
      this.maxBackoffDelay
    );
    
    console.log(`⏳ Exponential backoff: waiting ${backoffDelay}ms (attempt ${attempt})`);
    await this.delay(backoffDelay);
  }

  /**
   * Get current rate limit status
   */
  getStatus(): {
    callsInLastMinute: number;
    maxCallsPerMinute: number;
    timeSinceLastCall: number;
    canMakeCall: boolean;
  } {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastCallTime;
    
    return {
      callsInLastMinute: this.callCount,
      maxCallsPerMinute: this.maxCallsPerMinute,
      timeSinceLastCall,
      canMakeCall: this.callCount < this.maxCallsPerMinute
    };
  }

  /**
   * Reset the rate limiter
   */
  reset(): void {
    this.lastCallTime = 0;
    this.callCount = 0;
  }

  /**
   * Delay utility function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Request Queue for managing API calls
 */
export class RequestQueue {
  private queue: Array<() => Promise<any>> = [];
  private processing: boolean = false;
  private rateLimiter: RateLimiter;

  constructor(rateLimiter: RateLimiter) {
    this.rateLimiter = rateLimiter;
  }

  /**
   * Add a request to the queue
   */
  async add<T>(request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          await this.rateLimiter.waitForNextCall();
          const result = await request();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      this.processQueue();
    });
  }

  /**
   * Process the queue sequentially
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      const request = this.queue.shift();
      if (request) {
        try {
          await request();
        } catch (error) {
          console.error('❌ Request failed:', error);
        }
      }
    }
    
    this.processing = false;
  }

  /**
   * Get queue status
   */
  getStatus(): {
    queueLength: number;
    processing: boolean;
    rateLimitStatus: any;
  } {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      rateLimitStatus: this.rateLimiter.getStatus()
    };
  }
}

/**
 * Global rate limiter instance
 * Optimized for Google Ads API performance while staying within safe limits
 */
export const globalRateLimiter = new RateLimiter({
  minDelay: 500, // 500ms between calls - optimized for better performance
  maxCallsPerMinute: 60, // 60 calls per minute (well within Google's limits)
  backoffMultiplier: 2, // Exponential backoff
  maxBackoffDelay: 30000 // 30 seconds max backoff
});

/**
 * Global request queue instance
 */
export const globalRequestQueue = new RequestQueue(globalRateLimiter);