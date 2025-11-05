/**
 * IN-MEMORY CACHE LAYER
 * 
 * Fast in-process caching that sits in front of database cache
 * 
 * Performance:
 * - Memory cache hit: 0-1ms (instant)
 * - Database cache hit: 10-50ms
 * - API call: 10-20 seconds
 * 
 * This gives 95%+ improvement for hot data with zero infrastructure
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  createdAt: number;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private maxSize = 100; // Prevent memory leaks
  private defaultTTL = 10 * 60 * 1000; // 10 minutes
  
  // Statistics
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    evictions: 0
  };

  /**
   * Get value from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }
    
    this.stats.hits++;
    return entry.data as T;
  }

  /**
   * Set value in cache with TTL
   */
  set<T>(key: string, data: T, ttlMs: number = this.defaultTTL): void {
    // Enforce max size (simple LRU - delete oldest)
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
        this.stats.evictions++;
      }
    }
    
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
      createdAt: Date.now()
    });
    
    this.stats.sets++;
  }

  /**
   * Delete specific key
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Delete all keys matching pattern
   */
  deletePattern(pattern: string): number {
    let deleted = 0;
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        deleted++;
      }
    }
    
    return deleted;
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100
      : 0;
    
    return {
      ...this.stats,
      hitRate: `${hitRate.toFixed(2)}%`,
      size: this.cache.size,
      maxSize: this.maxSize
    };
  }

  /**
   * Get cache size info
   */
  getSize() {
    return {
      entries: this.cache.size,
      maxEntries: this.maxSize,
      utilizationPercent: (this.cache.size / this.maxSize) * 100
    };
  }

  /**
   * Cleanup expired entries (run periodically)
   */
  cleanup(): number {
    let cleaned = 0;
    const now = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    return cleaned;
  }
}

// Singleton instance
export const memoryCache = new MemoryCache();

// Cleanup expired entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const cleaned = memoryCache.cleanup();
    if (cleaned > 0) {
      console.log(`🧹 Memory cache cleanup: removed ${cleaned} expired entries`);
    }
  }, 5 * 60 * 1000);
}

/**
 * Cache key generators for different data types
 */
export const CacheKeys = {
  smartCache: (clientId: string, periodId: string, platform: string) => 
    `smart-cache:${platform}:${clientId}:${periodId}`,
  
  campaignSummary: (clientId: string, summaryType: string, platform: string, date: string) =>
    `campaign-summary:${platform}:${clientId}:${summaryType}:${date}`,
  
  dailyKpi: (clientId: string, platform: string, dateStart: string, dateEnd: string) =>
    `daily-kpi:${platform}:${clientId}:${dateStart}:${dateEnd}`,
  
  report: (clientId: string, dateStart: string, dateEnd: string) =>
    `report:${clientId}:${dateStart}:${dateEnd}`,
};

/**
 * Helper to wrap async function with caching
 */
export async function withCache<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlMs: number = 10 * 60 * 1000
): Promise<T> {
  // Check cache first
  const cached = memoryCache.get<T>(key);
  if (cached !== null) {
    console.log(`✅ Memory cache hit: ${key}`);
    return cached;
  }
  
  // Cache miss - fetch data
  console.log(`❌ Memory cache miss: ${key}`);
  const data = await fetchFn();
  
  // Store in cache
  memoryCache.set(key, data, ttlMs);
  
  return data;
}

/**
 * Cache invalidation helpers
 */
export const CacheInvalidation = {
  /**
   * Invalidate all caches for a client
   */
  invalidateClient: (clientId: string): number => {
    let total = 0;
    total += memoryCache.deletePattern(`*:${clientId}:*`);
    total += memoryCache.deletePattern(`*:${clientId}`);
    console.log(`🗑️ Invalidated ${total} cache entries for client ${clientId}`);
    return total;
  },
  
  /**
   * Invalidate specific period
   */
  invalidatePeriod: (clientId: string, periodId: string): number => {
    let total = 0;
    total += memoryCache.deletePattern(`*:${clientId}:${periodId}`);
    console.log(`🗑️ Invalidated ${total} cache entries for period ${periodId}`);
    return total;
  },
  
  /**
   * Clear all caches
   */
  clearAll: (): void => {
    memoryCache.clear();
    console.log('🗑️ Cleared all memory cache');
  }
};

