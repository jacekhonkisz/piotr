/**
 * OPTIMIZATION 3: REDIS CACHING LAYER
 * 
 * Add in-memory caching with Redis for ultra-fast lookups
 * 
 * Expected Impact: 95% faster cache hits (from 50-300ms to 1-5ms)
 * Implementation Time: 2-3 hours
 * Risk: Medium (requires Redis infrastructure)
 */

import Redis from 'ioredis';
import logger from './logger';

/**
 * STEP 1: Redis Client Setup
 */

// Initialize Redis connection
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  // Connection pooling
  enableReadyCheck: true,
  enableOfflineQueue: false,
  // Logging
  lazyConnect: false,
});

redis.on('connect', () => {
  logger.info('✅ Redis connected successfully');
});

redis.on('error', (err) => {
  logger.error('❌ Redis error:', err);
});

/**
 * STEP 2: Cache Key Generation
 */

export class CacheKeyGenerator {
  static smartCache(clientId: string, periodId: string, platform: string): string {
    return `smart-cache:${platform}:${clientId}:${periodId}`;
  }
  
  static campaignSummary(clientId: string, summaryType: string, platform: string, date: string): string {
    return `campaign-summary:${platform}:${clientId}:${summaryType}:${date}`;
  }
  
  static dailyKpi(clientId: string, platform: string, dateStart: string, dateEnd: string): string {
    return `daily-kpi:${platform}:${clientId}:${dateStart}:${dateEnd}`;
  }
  
  static report(clientId: string, dateStart: string, dateEnd: string): string {
    return `report:${clientId}:${dateStart}:${dateEnd}`;
  }
}

/**
 * STEP 3: Redis Cache Wrapper
 */

export class RedisCache {
  
  /**
   * Get cached value with automatic JSON parsing
   */
  static async get<T>(key: string): Promise<T | null> {
    try {
      const startTime = Date.now();
      const value = await redis.get(key);
      const elapsed = Date.now() - startTime;
      
      if (value === null) {
        logger.debug(`❌ Cache miss: ${key} (${elapsed}ms)`);
        return null;
      }
      
      logger.debug(`✅ Cache hit: ${key} (${elapsed}ms)`);
      return JSON.parse(value);
    } catch (error) {
      logger.error(`Redis GET error for key ${key}:`, error);
      return null; // Fail gracefully
    }
  }
  
  /**
   * Set cached value with automatic JSON serialization and TTL
   */
  static async set(key: string, value: any, ttlSeconds: number = 600): Promise<void> {
    try {
      const startTime = Date.now();
      const serialized = JSON.stringify(value);
      
      // Use SETEX for atomic set + expire
      await redis.setex(key, ttlSeconds, serialized);
      
      const elapsed = Date.now() - startTime;
      logger.debug(`💾 Cache set: ${key} (TTL: ${ttlSeconds}s, ${elapsed}ms)`);
    } catch (error) {
      logger.error(`Redis SET error for key ${key}:`, error);
      // Don't throw - caching should be transparent
    }
  }
  
  /**
   * Delete cached value
   */
  static async delete(key: string): Promise<void> {
    try {
      await redis.del(key);
      logger.debug(`🗑️ Cache deleted: ${key}`);
    } catch (error) {
      logger.error(`Redis DEL error for key ${key}:`, error);
    }
  }
  
  /**
   * Delete all keys matching pattern
   */
  static async deletePattern(pattern: string): Promise<number> {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length === 0) return 0;
      
      await redis.del(...keys);
      logger.info(`🗑️ Deleted ${keys.length} cache keys matching: ${pattern}`);
      return keys.length;
    } catch (error) {
      logger.error(`Redis DELETE PATTERN error for ${pattern}:`, error);
      return 0;
    }
  }
  
  /**
   * Check if key exists
   */
  static async exists(key: string): Promise<boolean> {
    try {
      const result = await redis.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Redis EXISTS error for key ${key}:`, error);
      return false;
    }
  }
  
  /**
   * Get TTL for key
   */
  static async ttl(key: string): Promise<number> {
    try {
      return await redis.ttl(key);
    } catch (error) {
      logger.error(`Redis TTL error for key ${key}:`, error);
      return -1;
    }
  }
}

/**
 * STEP 4: Smart Cache with Redis Integration
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function getSmartCacheDataWithRedis(
  clientId: string,
  periodId: string,
  platform: string,
  forceRefresh: boolean = false
) {
  const cacheKey = CacheKeyGenerator.smartCache(clientId, periodId, platform);
  
  logger.info('📊 Smart cache request:', { clientId, periodId, platform, forceRefresh });
  
  // TIER 1: Check Redis first (1-5ms)
  if (!forceRefresh) {
    const redisCached = await RedisCache.get<any>(cacheKey);
    
    if (redisCached) {
      logger.info('⚡ REDIS HIT - Instant return (1-5ms)');
      return {
        success: true,
        data: {
          ...redisCached,
          fromCache: true,
          cacheSource: 'redis',
          cacheAge: Date.now() - new Date(redisCached.fetchedAt).getTime()
        },
        source: 'redis-cache'
      };
    }
    
    logger.info('❌ Redis miss - checking database...');
  }
  
  // TIER 2: Check database (50-300ms)
  const cacheTable = platform === 'google' ? 'google_ads_current_month_cache' : 'current_month_cache';
  
  const { data: dbCached, error: cacheError } = await supabase
    .from(cacheTable)
    .select('*')
    .eq('client_id', clientId)
    .eq('period_id', periodId)
    .single();
  
  if (!cacheError && dbCached) {
    const age = Date.now() - new Date(dbCached.last_updated).getTime();
    const isFresh = age < (3 * 60 * 60 * 1000); // 3 hours
    
    if (isFresh) {
      logger.info(`✅ DATABASE HIT - Fresh data (${age}ms old)`);
      
      // Store in Redis for next time (10-minute TTL)
      await RedisCache.set(cacheKey, dbCached.cache_data, 600);
      
      return {
        success: true,
        data: {
          ...dbCached.cache_data,
          fromCache: true,
          cacheSource: 'database',
          cacheAge: age
        },
        source: 'database-cache'
      };
    } else {
      logger.info(`⚠️ DATABASE HIT - Stale data (${age}ms old), returning + refreshing`);
      
      // Return stale data immediately
      const staleResponse = {
        success: true,
        data: {
          ...dbCached.cache_data,
          fromCache: true,
          cacheSource: 'database-stale',
          cacheAge: age
        },
        source: 'stale-database-cache'
      };
      
      // Refresh in background (don't await)
      refreshCacheInBackground(clientId, periodId, platform, cacheTable).catch((err) => {
        logger.error('Background refresh failed:', err);
      });
      
      return staleResponse;
    }
  }
  
  // TIER 3: Fetch fresh data (10-20 seconds)
  logger.info('🔄 No cache - fetching fresh data...');
  
  const freshData = await fetchFreshDataFromAPI(clientId, periodId, platform);
  
  // Store in both Redis and Database
  await Promise.all([
    // Redis: 10-minute TTL (hot cache)
    RedisCache.set(cacheKey, freshData, 600),
    
    // Database: Permanent storage with last_updated
    supabase.from(cacheTable).upsert({
      client_id: clientId,
      period_id: periodId,
      cache_data: freshData,
      last_updated: new Date().toISOString()
    }, { onConflict: 'client_id,period_id' })
  ]);
  
  logger.info('💾 Fresh data cached in both Redis and Database');
  
  return {
    success: true,
    data: freshData,
    source: 'fresh-api'
  };
}

/**
 * STEP 5: Background Refresh
 */

async function refreshCacheInBackground(
  clientId: string,
  periodId: string,
  platform: string,
  cacheTable: string
) {
  logger.info('🔄 Background refresh started:', { clientId, periodId, platform });
  
  try {
    const freshData = await fetchFreshDataFromAPI(clientId, periodId, platform);
    const cacheKey = CacheKeyGenerator.smartCache(clientId, periodId, platform);
    
    // Update both caches
    await Promise.all([
      RedisCache.set(cacheKey, freshData, 600),
      supabase.from(cacheTable).upsert({
        client_id: clientId,
        period_id: periodId,
        cache_data: freshData,
        last_updated: new Date().toISOString()
      }, { onConflict: 'client_id,period_id' })
    ]);
    
    logger.info('✅ Background refresh completed');
  } catch (error) {
    logger.error('❌ Background refresh failed:', error);
  }
}

/**
 * STEP 6: Placeholder for API Fetching
 */

async function fetchFreshDataFromAPI(clientId: string, periodId: string, platform: string) {
  // Import existing fetch logic
  const { fetchFreshCurrentMonthData } = await import('./smart-cache-helper');
  
  // Get client data
  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single();
  
  if (!client) {
    throw new Error('Client not found');
  }
  
  // Fetch based on platform
  if (platform === 'google') {
    const { fetchFreshGoogleAdsCurrentMonthData } = await import('./google-ads-smart-cache-helper');
    return await fetchFreshGoogleAdsCurrentMonthData(client);
  } else {
    return await fetchFreshCurrentMonthData(client);
  }
}

/**
 * STEP 7: Cache Invalidation Helpers
 */

export class CacheInvalidation {
  
  /**
   * Invalidate all caches for a client
   */
  static async invalidateClient(clientId: string): Promise<void> {
    logger.info('🗑️ Invalidating all caches for client:', clientId);
    
    const patterns = [
      `smart-cache:*:${clientId}:*`,
      `campaign-summary:*:${clientId}:*`,
      `daily-kpi:*:${clientId}:*`,
      `report:${clientId}:*`
    ];
    
    let totalDeleted = 0;
    for (const pattern of patterns) {
      totalDeleted += await RedisCache.deletePattern(pattern);
    }
    
    logger.info(`✅ Invalidated ${totalDeleted} cache keys for client ${clientId}`);
  }
  
  /**
   * Invalidate caches for a specific period
   */
  static async invalidatePeriod(clientId: string, periodId: string): Promise<void> {
    logger.info('🗑️ Invalidating caches for period:', { clientId, periodId });
    
    await Promise.all([
      RedisCache.delete(CacheKeyGenerator.smartCache(clientId, periodId, 'meta')),
      RedisCache.delete(CacheKeyGenerator.smartCache(clientId, periodId, 'google'))
    ]);
  }
  
  /**
   * Invalidate all stale caches (older than 24 hours)
   */
  static async invalidateStale(): Promise<void> {
    logger.info('🗑️ Invalidating stale caches...');
    // This would require storing metadata in Redis - implement if needed
  }
}

/**
 * STEP 8: Performance Monitoring
 */

export class CacheMetrics {
  private static hits = 0;
  private static misses = 0;
  private static avgLatency = 0;
  
  static recordHit(latencyMs: number): void {
    this.hits++;
    this.avgLatency = (this.avgLatency + latencyMs) / 2;
  }
  
  static recordMiss(latencyMs: number): void {
    this.misses++;
    this.avgLatency = (this.avgLatency + latencyMs) / 2;
  }
  
  static getMetrics() {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? (this.hits / total * 100).toFixed(2) + '%' : '0%',
      avgLatencyMs: this.avgLatency.toFixed(2)
    };
  }
  
  static reset(): void {
    this.hits = 0;
    this.misses = 0;
    this.avgLatency = 0;
  }
}

/**
 * INSTALLATION INSTRUCTIONS:
 * 
 * 1. Install Redis:
 *    brew install redis (macOS)
 *    apt-get install redis (Ubuntu)
 *    Or use managed service: Upstash, Redis Cloud
 * 
 * 2. Install ioredis:
 *    npm install ioredis
 *    npm install @types/ioredis --save-dev
 * 
 * 3. Add to .env:
 *    REDIS_URL=redis://localhost:6379
 *    Or production: redis://:password@host:port
 * 
 * 4. Replace smart-cache-helper.ts exports:
 *    export { getSmartCacheDataWithRedis as getSmartCacheData };
 * 
 * 5. Test locally:
 *    redis-cli ping (should return PONG)
 * 
 * 6. Monitor performance:
 *    GET /api/metrics
 *    Returns: { cacheHitRate: '95%', avgLatency: '2ms' }
 */

/**
 * EXPECTED PERFORMANCE:
 * 
 * BEFORE (database only):
 * - Cache hit: 50-300ms
 * - Cache miss: 10-20 seconds
 * 
 * AFTER (Redis + database):
 * - Redis hit: 1-5ms (50-100x faster!)
 * - Database hit: 50-300ms (stores to Redis for next time)
 * - Cache miss: 10-20 seconds (stores to both Redis and database)
 * 
 * With 80% cache hit rate:
 * - 80% of requests: 1-5ms (Redis)
 * - 15% of requests: 50-300ms (database)
 * - 5% of requests: 10-20s (fresh API)
 * 
 * Average response time: ~500ms → ~50ms (10x improvement!)
 */

