/**
 * Daily Metrics Smart Cache
 * 
 * Smart caching system specifically for day-by-day metrics used in carousel charts.
 * Uses the same caching strategy as reports but optimized for daily data.
 * 
 * Priority order:
 * 1. Fresh cache (3-hour TTL)
 * 2. daily_kpi_data table (database-first)
 * 3. Unified data fetcher (same as reports)
 * 4. Extract daily metrics from campaign data
 */

import { supabase } from './supabase';
import { StandardizedDataFetcher } from './standardized-data-fetcher';

export interface DailyMetrics {
  date: string;
  total_clicks: number;
  total_spend: number;
  total_impressions: number;
  total_conversions: number;
  average_ctr: number;
  average_cpc: number;
  data_source: string;
  // Conversion metrics for daily tracking
  click_to_call?: number;
  email_contacts?: number;
  booking_step_1?: number;
  booking_step_2?: number;
  reservations?: number;
  reservation_value?: number;
}

export interface DailyMetricsResult {
  success: boolean;
  data: DailyMetrics[];
  source: string;
  fromCache: boolean;
  completeness?: number; // % of expected days with data
  cacheAge?: number; // milliseconds
}

interface CachedDailyMetrics {
  data: DailyMetrics[];
  timestamp: number;
  source: string;
  completeness: number;
}

export class DailyMetricsCache {
  private static CACHE_DURATION = 3 * 60 * 60 * 1000; // 3 hours (same as reports)
  private static cache = new Map<string, CachedDailyMetrics>();
  
  /**
   * Get daily metrics with smart caching
   * Uses same caching strategy as reports but for daily data
   */
  static async getDailyMetrics(
    clientId: string, 
    dateRange: { start: string; end: string },
    platform: 'meta' | 'google' = 'meta'
  ): Promise<DailyMetricsResult> {
    
    const cacheKey = `daily_metrics_${clientId}_${dateRange.start}_${dateRange.end}_${platform}`;
    
    console.log('📊 Daily Metrics Cache: Request for', {
      clientId, dateRange, platform, cacheKey
    });
    
    try {
      // 1. Check memory cache first (same pattern as reports)
      const cached = this.cache.get(cacheKey);
      if (cached && this.isCacheFresh(cached.timestamp)) {
        console.log('✅ Daily Metrics: Using fresh memory cache');
        return {
          success: true,
          data: cached.data,
          source: 'daily-cache-fresh',
          fromCache: true,
          completeness: cached.completeness,
          cacheAge: Date.now() - cached.timestamp
        };
      }
      
      // 2. Check daily_kpi_data table (database first - same as reports)
      console.log('📊 Daily Metrics: Checking daily_kpi_data table...');
      const dbData = await this.getDailyKpiData(clientId, dateRange, platform);
      
      if (dbData && dbData.length > 0) {
        const completeness = this.calculateCompleteness(dbData, dateRange);
        console.log(`✅ Daily Metrics: Found ${dbData.length} records in daily_kpi_data (${Math.round(completeness * 100)}% complete)`);
        
        // Cache the database result
        this.cacheDailyMetrics(cacheKey, dbData, 'daily-database', completeness);
        
        return {
          success: true,
          data: dbData,
          source: 'daily-database',
          fromCache: false,
          completeness: completeness
        };
      }
      
      // 3. Fallback to unified data fetcher (same as reports)
      console.log('⚠️ Daily Metrics: daily_kpi_data incomplete, using unified fetcher fallback');
      const unifiedResult = await this.fetchFromUnifiedAPI(clientId, dateRange, platform);
      
      if (unifiedResult.success && 'data' in unifiedResult && unifiedResult.data) {
        // Extract daily metrics from campaigns
        const dailyMetrics = this.extractDailyMetrics(unifiedResult.data, dateRange);
        const completeness = this.calculateCompleteness(dailyMetrics, dateRange);
        
        console.log(`✅ Daily Metrics: Extracted ${dailyMetrics.length} daily records from unified API`);
        
        // Cache the result
        this.cacheDailyMetrics(cacheKey, dailyMetrics, 'daily-unified-fallback', completeness);
        
        return {
          success: true,
          data: dailyMetrics,
          source: 'daily-unified-fallback',
          fromCache: false,
          completeness: completeness
        };
      }
      
      throw new Error('Failed to get daily metrics from all sources');
      
    } catch (error) {
      console.error('❌ Daily Metrics Cache error:', error);
      
      // Return empty data instead of throwing (same as reports error handling)
      return {
        success: false,
        data: [],
        source: 'daily-error',
        fromCache: false,
        completeness: 0
      };
    }
  }
  
  /**
   * Get data from daily_kpi_data table
   */
  private static async getDailyKpiData(
    clientId: string, 
    dateRange: { start: string; end: string },
    platform: string
  ): Promise<DailyMetrics[] | null> {
    try {
      // For Google Ads, we might need to check a different table or source
      const tableName = platform === 'google' ? 'daily_kpi_data' : 'daily_kpi_data';
      
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('client_id', clientId)
        .gte('date', dateRange.start)
        .lte('date', dateRange.end)
        .order('date', { ascending: true });
        
      if (error) {
        console.error('❌ Error fetching daily_kpi_data:', error);
        return null;
      }
      
      if (!data || data.length === 0) {
        console.log('⚠️ No daily_kpi_data found for date range');
        return null;
      }
      
      // Transform database records to DailyMetrics format
      return data.map(record => ({
        date: record.date,
        total_clicks: record.total_clicks || 0,
        total_spend: record.total_spend || 0,
        total_impressions: record.total_impressions || 0,
        total_conversions: record.total_conversions || 0,
        average_ctr: record.average_ctr || 0,
        average_cpc: record.average_cpc || 0,
        data_source: record.data_source || 'database',
        // Include conversion metrics if available
        click_to_call: record.click_to_call || 0,
        email_contacts: record.email_contacts || 0,
        booking_step_1: record.booking_step_1 || 0,
        booking_step_2: record.booking_step_2 || 0,
        reservations: record.reservations || 0,
        reservation_value: record.reservation_value || 0
      }));
      
    } catch (error) {
      console.error('❌ Exception fetching daily_kpi_data:', error);
      return null;
    }
  }
  
  /**
   * Fetch from unified API (same as reports)
   */
  private static async fetchFromUnifiedAPI(
    clientId: string,
    dateRange: { start: string; end: string },
    platform: string
  ) {
    try {
      // Get session for API call (same as reports)
      const { data: { session } } = await supabase.auth.getSession();
      
      // Use same unified fetcher as reports
      const result = await StandardizedDataFetcher.fetchData({
        dateRange,
        clientId,
        platform: platform as 'meta' | 'google',
        reason: 'daily-metrics-fallback'
      });
      
      return result;
      
    } catch (error) {
      console.error('❌ Unified API fetch failed for daily metrics:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
  
  /**
   * Extract daily metrics from campaign data (same logic as components)
   */
  private static extractDailyMetrics(campaignData: any, dateRange: { start: string; end: string }): DailyMetrics[] {
    const campaigns = campaignData.campaigns || [];
    
    if (!campaigns.length) {
      console.log('⚠️ No campaigns data to extract daily metrics from');
      return [];
    }
    
    // Group campaigns by date and aggregate
    const dailyMap = new Map<string, DailyMetrics>();
    
    campaigns.forEach((campaign: any) => {
      // Try different date fields that might be present
      const date = campaign.date_start || campaign.date || campaign.day;
      if (!date) {
        console.warn('⚠️ Campaign missing date field:', campaign);
        return;
      }
      
      // Ensure date is in YYYY-MM-DD format
      const normalizedDate = date.split('T')[0];
      
      if (!dailyMap.has(normalizedDate)) {
        dailyMap.set(normalizedDate, {
          date: normalizedDate,
          total_clicks: 0,
          total_spend: 0,
          total_impressions: 0,
          total_conversions: 0,
          average_ctr: 0,
          average_cpc: 0,
          data_source: 'calculated',
          // Initialize conversion metrics
          click_to_call: 0,
          email_contacts: 0,
          booking_step_1: 0,
          booking_step_2: 0,
          reservations: 0,
          reservation_value: 0
        });
      }
      
      const daily = dailyMap.get(normalizedDate)!;
      
      // Aggregate basic metrics
      daily.total_clicks += parseInt(campaign.clicks) || 0;
      daily.total_spend += parseFloat(campaign.spend) || 0;
      daily.total_impressions += parseInt(campaign.impressions) || 0;
      daily.total_conversions += parseInt(campaign.conversions) || 0;
      
      // Aggregate conversion metrics if available
      daily.click_to_call! += parseInt(campaign.click_to_call) || 0;
      daily.email_contacts! += parseInt(campaign.email_contacts) || 0;
      daily.booking_step_1! += parseInt(campaign.booking_step_1) || 0;
      daily.booking_step_2! += parseInt(campaign.booking_step_2) || 0;
      daily.reservations! += parseInt(campaign.reservations) || 0;
      daily.reservation_value! += parseFloat(campaign.reservation_value) || 0;
    });
    
    // Calculate derived metrics for each day
    dailyMap.forEach((daily) => {
      daily.average_ctr = daily.total_impressions > 0 
        ? (daily.total_clicks / daily.total_impressions) * 100 
        : 0;
      daily.average_cpc = daily.total_clicks > 0 
        ? daily.total_spend / daily.total_clicks 
        : 0;
    });
    
    // Convert to array and sort by date
    const dailyMetrics = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    
    const firstMetric = dailyMetrics[0];
    const lastMetric = dailyMetrics[dailyMetrics.length - 1];
    
    console.log(`📊 Extracted daily metrics:`, {
      totalDays: dailyMetrics.length,
      dateRange: firstMetric && lastMetric ? {
        start: firstMetric.date,
        end: lastMetric.date
      } : null,
      sampleDay: firstMetric || null
    });
    
    return dailyMetrics;
  }
  
  /**
   * Calculate data completeness (% of expected days with data)
   */
  private static calculateCompleteness(data: DailyMetrics[], dateRange: { start: string; end: string }): number {
    const expectedDates = this.generateDateRange(dateRange.start, dateRange.end);
    const actualDates = new Set(data.map(d => d.date));
    
    const completeness = actualDates.size / expectedDates.length;
    
    console.log(`📊 Data completeness: ${actualDates.size}/${expectedDates.length} = ${Math.round(completeness * 100)}%`);
    
    return completeness;
  }
  
  /**
   * Generate array of dates between start and end (inclusive)
   */
  private static generateDateRange(startDate: string, endDate: string): string[] {
    const dates: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const dateStr = date.toISOString().split('T')[0];
      if (dateStr) {
        dates.push(dateStr);
      }
    }
    
    return dates;
  }
  
  /**
   * Check if cached data is still fresh (same TTL as reports)
   */
  private static isCacheFresh(timestamp: number): boolean {
    const age = Date.now() - timestamp;
    const isFresh = age < this.CACHE_DURATION;
    
    console.log(`🕐 Cache age check: ${Math.round(age / 1000 / 60)} minutes old, fresh: ${isFresh}`);
    
    return isFresh;
  }
  
  /**
   * Cache daily metrics data
   */
  private static cacheDailyMetrics(
    cacheKey: string, 
    data: DailyMetrics[], 
    source: string, 
    completeness: number
  ): void {
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      source,
      completeness
    });
    
    console.log(`💾 Cached daily metrics: ${data.length} records, source: ${source}, completeness: ${Math.round(completeness * 100)}%`);
  }
  
  /**
   * Clear cache for specific client (useful for testing)
   */
  static clearCache(clientId?: string): void {
    if (clientId) {
      // Clear cache entries for specific client
      const keysToDelete = Array.from(this.cache.keys()).filter(key => key.includes(clientId));
      keysToDelete.forEach(key => this.cache.delete(key));
      console.log(`🗑️ Cleared daily metrics cache for client: ${clientId}`);
    } else {
      // Clear all cache
      this.cache.clear();
      console.log('🗑️ Cleared all daily metrics cache');
    }
  }
  
  /**
   * Get cache statistics (for debugging)
   */
  static getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}
