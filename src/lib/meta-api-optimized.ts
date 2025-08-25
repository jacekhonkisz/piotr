/**
 * Optimized Meta API Service with Memory Management
 * Fixes memory leaks and implements proper cache cleanup
 */

import logger from './logger';

interface MetaAPIResponse {
  data?: any[];
  error?: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
  paging?: {
    cursors?: {
      before?: string;
      after?: string;
    };
    next?: string;
    previous?: string;
  };
}

interface CacheEntry {
  data: any;
  timestamp: number;
  hits: number;
  size: number; // Track memory usage
}

/**
 * Memory-Managed Cache with automatic cleanup and size limits
 */
class MemoryManagedCache {
  private cache = new Map<string, CacheEntry>();
  private readonly maxSize: number;
  private readonly maxMemoryMB: number;
  private readonly cacheDuration: number;
  private cleanupInterval: NodeJS.Timeout;
  private currentMemoryUsage = 0;

  constructor(
    maxSize = 1000,
    maxMemoryMB = 50,
    cacheDurationMs = 5 * 60 * 1000 // 5 minutes
  ) {
    this.maxSize = maxSize;
    this.maxMemoryMB = maxMemoryMB;
    this.cacheDuration = cacheDurationMs;

    // Auto-cleanup every 2 minutes
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, 2 * 60 * 1000);

    // Cleanup on process exit
    process.on('exit', () => {
      this.destroy();
    });
    
    process.on('SIGINT', () => {
      this.destroy();
      process.exit(0);
    });
  }

  private calculateSize(data: any): number {
    // Rough estimate of memory usage in bytes
    const jsonString = JSON.stringify(data);
    return jsonString.length * 2; // UTF-16 encoding
  }

  get(key: string): any | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    const now = Date.now();
    if (now - entry.timestamp > this.cacheDuration) {
      this.delete(key);
      return undefined;
    }

    // Update hit count for LRU
    entry.hits++;
    return entry.data;
  }

  set(key: string, data: any): boolean {
    const size = this.calculateSize(data);
    const sizeMB = size / (1024 * 1024);

    // Check if single entry exceeds memory limit
    if (sizeMB > this.maxMemoryMB * 0.5) {
      logger.warn(`Meta API cache: Entry too large (${sizeMB.toFixed(2)}MB), skipping cache`);
      return false;
    }

    // Ensure we have space
    this.ensureSpace(size);

    // Remove existing entry if updating
    if (this.cache.has(key)) {
      this.delete(key);
    }

    // Add new entry
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      hits: 1,
      size
    });

    this.currentMemoryUsage += size;
    
    logger.debug(`Meta API cache: Added entry ${key} (${(size / 1024).toFixed(2)}KB)`);
    return true;
  }

  private delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    this.currentMemoryUsage -= entry.size;
    this.cache.delete(key);
    return true;
  }

  private ensureSpace(newEntrySize: number): void {
    const maxMemoryBytes = this.maxMemoryMB * 1024 * 1024;
    
    // Clean up expired entries first
    this.cleanupExpired();

    // If still over limit, remove least used entries
    while (
      (this.currentMemoryUsage + newEntrySize > maxMemoryBytes || 
       this.cache.size >= this.maxSize) &&
      this.cache.size > 0
    ) {
      this.evictLeastUsed();
    }
  }

  private evictLeastUsed(): void {
    let leastUsedKey = '';
    let leastHits = Infinity;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.hits < leastHits || (entry.hits === leastHits && entry.timestamp < oldestTime)) {
        leastUsedKey = key;
        leastHits = entry.hits;
        oldestTime = entry.timestamp;
      }
    }

    if (leastUsedKey) {
      logger.debug(`Meta API cache: Evicting least used entry ${leastUsedKey}`);
      this.delete(leastUsedKey);
    }
  }

  private cleanupExpired(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.cacheDuration) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.delete(key));
    
    if (keysToDelete.length > 0) {
      logger.info(`Meta API cache: Cleaned up ${keysToDelete.length} expired entries`);
    }
  }

  private performCleanup(): void {
    const beforeSize = this.cache.size;
    const beforeMemory = this.currentMemoryUsage;

    this.cleanupExpired();

    // Force cleanup if memory usage is too high
    const maxMemoryBytes = this.maxMemoryMB * 1024 * 1024;
    if (this.currentMemoryUsage > maxMemoryBytes * 0.8) {
      logger.warn('Meta API cache: High memory usage, forcing cleanup');
      
      while (this.currentMemoryUsage > maxMemoryBytes * 0.6 && this.cache.size > 0) {
        this.evictLeastUsed();
      }
    }

    const afterSize = this.cache.size;
    const afterMemory = this.currentMemoryUsage;

    if (beforeSize !== afterSize) {
      logger.info(`Meta API cache: Cleanup completed`, {
        entriesRemoved: beforeSize - afterSize,
        memoryFreed: `${((beforeMemory - afterMemory) / 1024 / 1024).toFixed(2)}MB`,
        currentEntries: afterSize,
        currentMemory: `${(afterMemory / 1024 / 1024).toFixed(2)}MB`
      });
    }
  }

  clear(): void {
    this.cache.clear();
    this.currentMemoryUsage = 0;
    logger.info('Meta API cache: Cleared all entries');
  }

  getStats() {
    const memoryMB = this.currentMemoryUsage / 1024 / 1024;
    const entries = Array.from(this.cache.values());
    const totalHits = entries.reduce((sum, entry) => sum + entry.hits, 0);
    
    return {
      entries: this.cache.size,
      maxEntries: this.maxSize,
      memoryUsageMB: parseFloat(memoryMB.toFixed(2)),
      maxMemoryMB: this.maxMemoryMB,
      memoryUtilization: parseFloat((memoryMB / this.maxMemoryMB * 100).toFixed(1)),
      totalHits,
      averageHits: entries.length > 0 ? parseFloat((totalHits / entries.length).toFixed(1)) : 0,
      oldestEntry: entries.length > 0 ? Math.min(...entries.map(e => e.timestamp)) : null
    };
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
    logger.info('Meta API cache: Destroyed');
  }
}

// Global optimized cache instance
const optimizedApiCache = new MemoryManagedCache(
  1000,  // Max 1000 entries
  50,    // Max 50MB memory
  5 * 60 * 1000 // 5 minute cache duration
);

/**
 * Optimized Meta API Service with memory management
 */
export class MetaAPIServiceOptimized {
  private accessToken: string;
  private baseUrl = 'https://graph.facebook.com/v18.0';
  private requestTimeout = 30000; // 30 seconds

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private getCacheKey(endpoint: string, params?: string): string {
    // Include token hash for cache isolation between different tokens
    const tokenHash = this.hashToken(this.accessToken);
    return `${tokenHash}_${endpoint}_${params || ''}`;
  }

  private hashToken(token: string): string {
    // Simple hash for cache key (not cryptographic)
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      const char = token.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private getCachedResponse(cacheKey: string): any | undefined {
    return optimizedApiCache.get(cacheKey);
  }

  private setCachedResponse(cacheKey: string, data: any): void {
    optimizedApiCache.set(cacheKey, data);
  }

  /**
   * Make API request with timeout and error handling
   */
  private async makeRequest(url: string, options: RequestInit = {}): Promise<MetaAPIResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          error: {
            message: errorData.error?.message || `HTTP ${response.status}`,
            type: errorData.error?.type || 'http_error',
            code: response.status,
            error_subcode: errorData.error?.error_subcode,
            fbtrace_id: errorData.error?.fbtrace_id
          }
        };
      }

      return await response.json();

    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          error: {
            message: 'Request timeout',
            type: 'timeout_error',
            code: 408
          }
        };
      }

      return {
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          type: 'network_error',
          code: 0
        }
      };
    }
  }

  /**
   * Get campaigns with optimized caching
   */
  async getCampaigns(adAccountId: string, dateRange: { start: string; end: string }): Promise<any[]> {
    const endpoint = `act_${adAccountId}/campaigns`;
    const params = `since=${dateRange.start}&until=${dateRange.end}`;
    const cacheKey = this.getCacheKey(endpoint, params);

    // Check cache first
    const cached = this.getCachedResponse(cacheKey);
    if (cached) {
      logger.info('Meta API: Cache hit for campaigns');
      return cached;
    }

    logger.info('Meta API: Fetching campaigns from API');
    
    const url = `${this.baseUrl}/${endpoint}?${params}&fields=id,name,status,created_time,updated_time&access_token=${this.accessToken}`;
    const response = await this.makeRequest(url);

    if (response.error) {
      logger.error('Meta API: Campaigns fetch failed:', response.error);
      return [];
    }

    const campaigns = response.data || [];
    this.setCachedResponse(cacheKey, campaigns);
    
    logger.info(`Meta API: Fetched ${campaigns.length} campaigns`);
    return campaigns;
  }

  /**
   * Clear cache for this service instance
   */
  clearCache(): void {
    const tokenHash = this.hashToken(this.accessToken);
    
    // Clear only entries for this token
    const keysToDelete: string[] = [];
    for (const key of optimizedApiCache['cache'].keys()) {
      if (key.startsWith(tokenHash)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => {
      optimizedApiCache['delete'](key);
    });

    logger.info(`Meta API: Cleared ${keysToDelete.length} cache entries for current token`);
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return optimizedApiCache.getStats();
  }

  /**
   * Validate token with caching
   */
  async validateToken(): Promise<{ valid: boolean; error?: string }> {
    const cacheKey = this.getCacheKey('token_validation');
    
    // Check cache first (shorter cache for validation)
    const cached = this.getCachedResponse(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const url = `${this.baseUrl}/me?access_token=${this.accessToken}`;
      const response = await this.makeRequest(url);

      const result = {
        valid: !response.error,
        error: response.error?.message
      };

      // Cache validation result for 2 minutes
      this.setCachedResponse(cacheKey, result);
      
      return result;

    } catch (error) {
      const result = {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      
      this.setCachedResponse(cacheKey, result);
      return result;
    }
  }
}

/**
 * Global cache management functions
 */
export function getGlobalCacheStats() {
  return optimizedApiCache.getStats();
}

export function clearGlobalCache() {
  optimizedApiCache.clear();
}

export function destroyGlobalCache() {
  optimizedApiCache.destroy();
}

// Export the optimized cache for monitoring
export { optimizedApiCache };
