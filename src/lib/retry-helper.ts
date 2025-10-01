/**
 * 🔄 Production-Ready Retry Logic
 * 
 * Features:
 * - Exponential backoff with jitter
 * - Circuit breaker pattern
 * - Error type handling
 * - Detailed logging
 */

import logger from './logger';

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  enableJitter?: boolean;
  enableCircuitBreaker?: boolean;
  onRetry?: (attempt: number, error: Error, delay: number) => void;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
  totalTime: number;
}

// Circuit breaker state
interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}

const circuitBreakers = new Map<string, CircuitBreakerState>();

/**
 * Execute function with exponential backoff retry
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const {
    maxRetries = 3,
    baseDelay = 1000, // 1 second
    maxDelay = 32000, // 32 seconds
    enableJitter = true,
    enableCircuitBreaker = false,
    onRetry
  } = options;

  const startTime = Date.now();
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Check circuit breaker
      if (enableCircuitBreaker) {
        const breakerKey = fn.name || 'default';
        const breaker = circuitBreakers.get(breakerKey);
        
        if (breaker?.state === 'OPEN') {
          const timeSinceFailure = Date.now() - breaker.lastFailureTime;
          const cooldownPeriod = 5 * 60 * 1000; // 5 minutes
          
          if (timeSinceFailure < cooldownPeriod) {
            throw new Error('Circuit breaker is OPEN - cooling down');
          } else {
            breaker.state = 'HALF_OPEN';
            logger.info('🔓 Circuit breaker entering HALF_OPEN state');
          }
        }
      }

      // Execute the function
      const result = await fn();
      
      // Success! Reset circuit breaker
      if (enableCircuitBreaker) {
        const breakerKey = fn.name || 'default';
        const breaker = circuitBreakers.get(breakerKey);
        if (breaker) {
          breaker.failures = 0;
          breaker.state = 'CLOSED';
        }
      }

      logger.info(`✅ Operation succeeded on attempt ${attempt}/${maxRetries}`);
      
      return {
        success: true,
        data: result,
        attempts: attempt,
        totalTime: Date.now() - startTime
      };

    } catch (error) {
      lastError = error as Error;
      
      // Check if we should retry this error
      if (!shouldRetry(error as Error)) {
        logger.error(`❌ Non-retryable error, failing immediately`, { error });
        return {
          success: false,
          error: lastError,
          attempts: attempt,
          totalTime: Date.now() - startTime
        };
      }

      // Update circuit breaker
      if (enableCircuitBreaker) {
        const breakerKey = fn.name || 'default';
        let breaker = circuitBreakers.get(breakerKey);
        
        if (!breaker) {
          breaker = { failures: 0, lastFailureTime: 0, state: 'CLOSED' };
          circuitBreakers.set(breakerKey, breaker);
        }
        
        breaker.failures++;
        breaker.lastFailureTime = Date.now();
        
        // Open circuit after 5 consecutive failures
        if (breaker.failures >= 5) {
          breaker.state = 'OPEN';
          logger.error('🔒 Circuit breaker OPENED due to repeated failures');
        }
      }

      // Last attempt failed
      if (attempt === maxRetries) {
        logger.error(`❌ All ${maxRetries} attempts failed`, { 
          error: lastError.message,
          totalTime: Date.now() - startTime
        });
        
        return {
          success: false,
          error: lastError,
          attempts: attempt,
          totalTime: Date.now() - startTime
        };
      }

      // Calculate delay with exponential backoff
      const delay = calculateDelay(attempt, baseDelay, maxDelay, enableJitter);
      
      logger.warn(`⚠️ Attempt ${attempt}/${maxRetries} failed, retrying in ${delay}ms`, {
        error: lastError.message
      });

      // Call retry callback if provided
      if (onRetry) {
        onRetry(attempt, lastError, delay);
      }

      // Wait before next attempt
      await sleep(delay);
    }
  }

  // Should never reach here, but TypeScript needs it
  return {
    success: false,
    error: lastError,
    attempts: maxRetries,
    totalTime: Date.now() - startTime
  };
}

/**
 * Calculate delay with exponential backoff and optional jitter
 */
function calculateDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
  enableJitter: boolean
): number {
  // Exponential backoff: baseDelay * 2^(attempt-1)
  // Attempt 1: baseDelay * 1 = 1000ms
  // Attempt 2: baseDelay * 2 = 2000ms
  // Attempt 3: baseDelay * 4 = 4000ms
  const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
  
  // Cap at maxDelay
  let delay = Math.min(exponentialDelay, maxDelay);
  
  // Add jitter (±25% randomness)
  if (enableJitter) {
    const jitterRange = delay * 0.25;
    const jitter = (Math.random() * 2 - 1) * jitterRange;
    delay = Math.max(0, delay + jitter);
  }
  
  return Math.round(delay);
}

/**
 * Determine if an error should be retried
 */
function shouldRetry(error: Error): boolean {
  const message = error.message.toLowerCase();
  
  // Don't retry these errors
  const nonRetryableErrors = [
    'authentication failed',
    'invalid credentials',
    'permission denied',
    'not found',
    'bad request',
    'validation failed',
    'circuit breaker is open'
  ];
  
  for (const nonRetryable of nonRetryableErrors) {
    if (message.includes(nonRetryable)) {
      return false;
    }
  }
  
  // Retry these errors
  const retryableErrors = [
    'timeout',
    'network error',
    'connection refused',
    'econnreset',
    'rate limit',
    'too many requests',
    'service unavailable',
    'internal server error'
  ];
  
  for (const retryable of retryableErrors) {
    if (message.includes(retryable)) {
      return true;
    }
  }
  
  // Default: retry unknown errors
  return true;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Convenience wrapper with default options
 */
export async function retryWithExponentialBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  const result = await withRetry(fn, {
    maxRetries,
    baseDelay: 1000,
    enableJitter: true,
    enableCircuitBreaker: false
  });
  
  if (!result.success) {
    throw result.error || new Error('Operation failed after retries');
  }
  
  return result.data!;
}

/**
 * Get circuit breaker status
 */
export function getCircuitBreakerStatus(key: string = 'default'): CircuitBreakerState | null {
  return circuitBreakers.get(key) || null;
}

/**
 * Reset circuit breaker
 */
export function resetCircuitBreaker(key: string = 'default'): void {
  circuitBreakers.delete(key);
  logger.info(`🔄 Circuit breaker reset for: ${key}`);
}

export default withRetry;
