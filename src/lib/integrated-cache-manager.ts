import { createClient } from '@supabase/supabase-js';
import { getCurrentProfileOptimized } from './auth-optimized';
import { getSmartCacheData, getCurrentMonthInfo } from './smart-cache-helper';
import logger from './logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Integrated cache for user session + data combination
interface IntegratedCacheEntry {
  profileData: any;
  reportData: any;
  timestamp: number;
  source: 'cache' | 'database' | 'live-api';
  cacheAge: number;
}

class IntegratedCacheManager {
  private static instance: IntegratedCacheManager;
  private cache = new Map<string, IntegratedCacheEntry>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes for integrated cache

  static getInstance(): IntegratedCacheManager {
    if (!IntegratedCacheManager.instance) {
      IntegratedCacheManager.instance = new IntegratedCacheManager();
    }
    return IntegratedCacheManager.instance;
  }

  /**
   * Get cache key for user + client + period combination
   */
  private getCacheKey(userId: string, clientId: string, periodId: string): string {
    return `integrated_${userId}_${clientId}_${periodId}`;
  }

  /**
   * Smart data loading that combines profile + report data caching
   */
  async getIntegratedData(clientId: string, dateRange: { start: string; end: string }) {
    const startTime = performance.now();
    
    try {
      logger.info('🔄 IntegratedCacheManager: Starting smart data fetch...');
      
      // Step 1: Get profile (with optimized caching)
      const profile = await getCurrentProfileOptimized();
      if (!profile) {
        throw new Error('User not authenticated');
      }
      
      // Step 2: Determine period type and cache key
      const currentMonth = getCurrentMonthInfo();
      const isCurrentMonth = dateRange.start.startsWith(currentMonth.periodId);
      const periodId = isCurrentMonth ? currentMonth.periodId : dateRange.start.substring(0, 7);
      const cacheKey = this.getCacheKey(profile.id, clientId, periodId);
      
      logger.info(`📊 IntegratedCacheManager: Period analysis:`, {
        periodId,
        isCurrentMonth,
        cacheKey
      });

      // Step 3: Check integrated cache first
      const cachedEntry = this.cache.get(cacheKey);
      const now = Date.now();
      
      if (cachedEntry && (now - cachedEntry.timestamp) < this.CACHE_DURATION) {
        const responseTime = performance.now() - startTime;
        logger.info(`✅ IntegratedCacheManager: Returning cached data (${responseTime.toFixed(2)}ms)`);
        
        return {
          success: true,
          data: {
            ...cachedEntry.reportData,
            profile: cachedEntry.profileData,
            fromIntegratedCache: true,
            cacheAge: now - cachedEntry.timestamp,
            responseTime
          },
          source: cachedEntry.source,
          responseTime
        };
      }

      logger.info('🔍 IntegratedCacheManager: Cache miss, fetching fresh data...');

      // Step 4: Smart data routing based on period
      let reportData;
      let dataSource: 'cache' | 'database' | 'live-api';

      if (isCurrentMonth) {
        // Current month: Use smart cache system
        logger.info('📅 IntegratedCacheManager: Current month - using smart cache');
        const smartCacheResult = await getSmartCacheData(clientId, false);
        
        if (smartCacheResult.success && smartCacheResult.data.campaigns?.length > 0) {
          reportData = smartCacheResult.data;
          dataSource = smartCacheResult.source as any;
          logger.info(`✅ Smart cache hit: ${smartCacheResult.data.campaigns.length} campaigns`);
        } else {
          // Fallback to live API
          logger.info('⚠️ Smart cache miss, calling live API...');
          const liveResult = await this.fetchLiveData(clientId, dateRange);
          reportData = liveResult.data;
          dataSource = 'live-api';
        }
      } else {
        // Previous month: Check database storage first
        logger.info('📚 IntegratedCacheManager: Previous month - checking database storage');
        const databaseResult = await this.loadFromDatabase(clientId, dateRange);
        
        if (databaseResult) {
          reportData = databaseResult.data;
          dataSource = 'database';
          logger.info(`✅ Database hit: ${databaseResult.data.campaigns?.length || 0} campaigns`);
        } else {
          // Fallback to live API for historical data
          logger.info('⚠️ Database miss, calling live API for historical data...');
          const liveResult = await this.fetchLiveData(clientId, dateRange);
          reportData = liveResult.data;
          dataSource = 'live-api';
        }
      }

      // Step 5: Cache the integrated result
      const integratedEntry: IntegratedCacheEntry = {
        profileData: profile,
        reportData,
        timestamp: now,
        source: dataSource,
        cacheAge: 0
      };
      
      this.cache.set(cacheKey, integratedEntry);
      
      const responseTime = performance.now() - startTime;
      logger.info(`✅ IntegratedCacheManager: Data fetched and cached (${responseTime.toFixed(2)}ms)`);

      return {
        success: true,
        data: {
          ...reportData,
          profile,
          fromIntegratedCache: false,
          cacheAge: 0,
          responseTime
        },
        source: dataSource,
        responseTime
      };

    } catch (error) {
      const responseTime = performance.now() - startTime;
      logger.error('❌ IntegratedCacheManager error:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime
      };
    }
  }

  /**
   * Load data from database storage (campaign_summaries)
   */
  private async loadFromDatabase(clientId: string, dateRange: { start: string; end: string }) {
    try {
      logger.info('📊 Loading from database storage...');
      
      const { data: storedSummary, error } = await supabase
        .from('campaign_summaries')
        .select('*')
        .eq('client_id', clientId)
        .eq('summary_type', 'monthly')
        .eq('summary_date', dateRange.start)
        .single();

      if (error || !storedSummary) {
        logger.info('📊 No stored summary found in database');
        return null;
      }

      // Transform stored summary to expected format
      const transformedData = {
        client: {
          id: clientId,
          currency: 'PLN'
        },
        campaigns: storedSummary.campaign_data || [],
        stats: {
          totalSpend: storedSummary.total_spend || 0,
          totalImpressions: storedSummary.total_impressions || 0,
          totalClicks: storedSummary.total_clicks || 0,
          totalConversions: storedSummary.total_conversions || 0,
          averageCtr: storedSummary.average_ctr || 0,
          averageCpc: storedSummary.average_cpc || 0
        },
        metaTables: storedSummary.meta_tables,
        dateRange,
        lastUpdated: storedSummary.last_updated,
        fromDatabase: true
      };

      logger.info(`✅ Database data loaded: ${transformedData.campaigns.length} campaigns`);
      return { data: transformedData };

    } catch (error) {
      logger.error('❌ Database loading error:', error);
      return null;
    }
  }

  /**
   * Fetch live data from Meta API
   */
  private async fetchLiveData(clientId: string, dateRange: { start: string; end: string }) {
    try {
      logger.info('🌐 Fetching live data from Meta API...');
      
      // Get session token for API call
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No access token available');
      }

      const response = await fetch('/api/fetch-live-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          clientId,
          dateRange,
          forceFresh: false // Allow API-level caching
        })
      });

      if (!response.ok) {
        throw new Error(`API call failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'API call returned error');
      }

      logger.info(`✅ Live data fetched: ${result.data.campaigns?.length || 0} campaigns`);
      return { data: result.data };

    } catch (error) {
      logger.error('❌ Live data fetch error:', error);
      throw error;
    }
  }

  /**
   * Clear cache for specific user/client combination
   */
  clearCache(userId?: string, clientId?: string) {
    if (userId && clientId) {
      // Clear specific user+client combination
      const keysToDelete = Array.from(this.cache.keys()).filter(key => 
        key.includes(`_${userId}_${clientId}_`)
      );
      keysToDelete.forEach(key => this.cache.delete(key));
      logger.info(`🗑️ Cleared ${keysToDelete.length} cache entries for user ${userId}, client ${clientId}`);
    } else if (userId) {
      // Clear all cache for user
      const keysToDelete = Array.from(this.cache.keys()).filter(key => 
        key.includes(`_${userId}_`)
      );
      keysToDelete.forEach(key => this.cache.delete(key));
      logger.info(`🗑️ Cleared ${keysToDelete.length} cache entries for user ${userId}`);
    } else {
      // Clear all cache
      this.cache.clear();
      logger.info('🗑️ Cleared all integrated cache entries');
    }
  }

  /**
   * Force refresh data for current month
   */
  async forceRefreshCurrentMonth(clientId: string) {
    try {
      logger.info('🔄 Force refreshing current month data...');
      
      const profile = await getCurrentProfileOptimized();
      if (!profile) {
        throw new Error('User not authenticated');
      }

      const currentMonth = getCurrentMonthInfo();
      const cacheKey = this.getCacheKey(profile.id, clientId, currentMonth.periodId);
      
      // Clear integrated cache
      this.cache.delete(cacheKey);
      
      // Clear smart cache
      const smartCacheResult = await getSmartCacheData(clientId, true); // Force refresh
      
      logger.info('✅ Force refresh completed');
      return smartCacheResult;

    } catch (error) {
      logger.error('❌ Force refresh error:', error);
      throw error;
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const now = Date.now();
    const entries = Array.from(this.cache.values());
    
    return {
      totalEntries: entries.length,
      validEntries: entries.filter(entry => 
        (now - entry.timestamp) < this.CACHE_DURATION
      ).length,
      averageAge: entries.length > 0 
        ? entries.reduce((sum, entry) => sum + (now - entry.timestamp), 0) / entries.length 
        : 0,
      sourceBreakdown: {
        cache: entries.filter(e => e.source === 'cache').length,
        database: entries.filter(e => e.source === 'database').length,
        liveApi: entries.filter(e => e.source === 'live-api').length
      }
    };
  }
}

// Export singleton instance
export const integratedCacheManager = IntegratedCacheManager.getInstance();

// Export convenience functions
export async function getIntegratedReportData(clientId: string, dateRange: { start: string; end: string }) {
  return integratedCacheManager.getIntegratedData(clientId, dateRange);
}

export function clearIntegratedCache(userId?: string, clientId?: string) {
  integratedCacheManager.clearCache(userId, clientId);
}

export async function forceRefreshCurrentMonth(clientId: string) {
  return integratedCacheManager.forceRefreshCurrentMonth(clientId);
} 