/**
 * STANDARDIZED DATA FETCHER
 * 
 * ONE SINGLE SOURCE OF TRUTH for all data fetching in the system.
 * This replaces all inconsistent fetching logics with a unified approach.
 * 
 * PRIORITY ORDER (ALWAYS):
 * 1. daily_kpi_data (most accurate, real-time collected)
 * 2. Live API call (if no daily data available)
 * 3. Fallback to cached summaries (last resort)
 */

import { supabase, supabaseAdmin } from './supabase';
import logger from './logger';

// ✅ GLOBAL deduplication cache for ALL data fetches (Meta & Google)
const globalDataFetchCache = new Map<string, {
  inProgress: boolean;
  timestamp: number;
  promise?: Promise<any>;
}>();

// Manual cleanup function (called inline, not with setInterval in SSR)
function cleanupOldDataEntries() {
  const now = Date.now();
  for (const [key, value] of globalDataFetchCache.entries()) {
    if (now - value.timestamp > 30000) {
      globalDataFetchCache.delete(key);
    }
  }
}

export interface StandardizedDataResult {
  success: boolean;
  data: {
    stats: {
      totalSpend: number;
      totalImpressions: number;
      totalClicks: number;
      totalConversions: number;
      averageCtr: number;
      averageCpc: number;
    };
    conversionMetrics: {
      click_to_call: number;
      email_contacts: number;
      booking_step_1: number;
      booking_step_2: number;
      booking_step_3: number;
      reservations: number;
      reservation_value: number;
      roas: number;
      cost_per_reservation: number;
      reach: number;
    };
    campaigns: any[];
  };
  debug: {
    source: string;
    cachePolicy: string;
    responseTime: number;
    reason: string;
    dataSourcePriority: string[];
    periodType?: string;
  };
  validation: {
    actualSource: string;
    expectedSource: string;
    isConsistent: boolean;
  };
}

export class StandardizedDataFetcher {
  
  /**
   * MAIN ENTRY POINT - Use this for ALL data fetching
   * Replaces: fetchUnifiedData, DailyMetricsCache, and all other fetchers
   */
  static async fetchData(params: {
    clientId: string;
    dateRange: { start: string; end: string };
    platform?: 'meta' | 'google';
    reason?: string;
    sessionToken?: string;
  }): Promise<StandardizedDataResult> {
    
    // ✅ GLOBAL DEDUPLICATION: Prevent duplicate calls across ALL contexts
    const fetchKey = `data-${params.platform || 'meta'}-${params.clientId}-${params.dateRange.start}-${params.dateRange.end}`;
    const now = Date.now();
    
    // Clean up old entries before checking
    cleanupOldDataEntries();
    
    const cached = globalDataFetchCache.get(fetchKey);
    
    if (cached && cached.inProgress) {
      console.log('🚫 StandardizedDataFetcher: GLOBAL duplicate call prevented', { 
        fetchKey, 
        timeSinceStart: now - cached.timestamp,
        platform: params.platform || 'meta'
      });
      
      // Wait for the existing promise to complete
      if (cached.promise) {
        return await cached.promise;
      }
    }
    
    // Create the fetch promise and store it in global cache
    const fetchPromise = (async () => {
      try {
        return await this._fetchDataInternal(params);
      } finally {
        // Clean up global cache after completion
        globalDataFetchCache.delete(fetchKey);
      }
    })();
    
    // Store in global cache
    globalDataFetchCache.set(fetchKey, {
      inProgress: true,
      timestamp: now,
      promise: fetchPromise
    });
    
    return await fetchPromise;
  }
  
  /**
   * Internal fetch method - not to be called directly
   */
  private static async _fetchDataInternal(params: {
    clientId: string;
    dateRange: { start: string; end: string };
    platform?: 'meta' | 'google';
    reason?: string;
    sessionToken?: string;
  }): Promise<StandardizedDataResult> {
    
    // ✅ CRITICAL FIX: ALL client-side requests MUST go through API routes
    // Smart cache requires server-side Supabase client with service role key
    if (typeof window !== 'undefined') {
      console.log('🌐 Client-side request detected, redirecting to server-side API...');
      
      // 🔧 FIX: Reuse singleton Supabase client instead of creating new one
      // This prevents "Multiple GoTrueClient instances" warnings
      const { data: { session } } = await supabase.auth.getSession();
      
      // Determine the correct API endpoint based on platform
      const apiUrl = params.platform === 'google' 
        ? '/api/fetch-google-ads-live-data'
        : '/api/fetch-live-data';
      
      console.log(`📡 Calling ${apiUrl} for ${params.platform || 'meta'} data...`);
      
      // Make API call to server-side endpoint with authentication
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`
        },
        body: JSON.stringify({
          clientId: params.clientId,
          dateRange: params.dateRange,
          platform: params.platform || 'meta',
          reason: params.reason || 'standardized-fetch'
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API call failed: ${response.status} - ${errorText}`);
      }
      
      const result = await response.json();
      console.log(`✅ API response received:`, {
        success: result.success,
        source: result.debug?.source,
        campaignsCount: result.data?.campaigns?.length || 0
      });
      return result;
    }
    
    // ✅ Server-side execution continues below
    console.log('🖥️ Server-side execution - direct access to smart cache and database');
    
    const { clientId, dateRange, platform = 'meta', reason = 'standardized-fetch', sessionToken } = params;
    const startTime = Date.now();
    
    logger.info('🎯 STANDARDIZED FETCH:', {
      clientId,
      dateRange,
      platform,
      reason,
      timestamp: new Date().toISOString()
    });
    
    // ✅ FIXED Priority 5: STRICT period detection - past months ALWAYS use database
    const now = new Date();
    const today: string = now.toISOString().split('T')[0]!;
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12
    const currentDay = now.getDate();
    
    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);
    const startYear = startDate.getFullYear();
    const startMonth = startDate.getMonth() + 1; // 1-12
    const endYear = endDate.getFullYear();
    const endMonth = endDate.getMonth() + 1;
    
    // 🔒 STRICT RULE #1: Only current month gets smart cache
    // Even if it's the 1st of the new month, previous month is HISTORICAL
    const isExactCurrentMonth = (
      startYear === currentYear && 
      startMonth === currentMonth &&
      endYear === currentYear &&
      endMonth === currentMonth
    );
    
    // 🔒 STRICT RULE #2: Month must include TODAY to be current
    const includesCurrentDay = dateRange.end >= today;
    
    // 🔒 STRICT RULE #3: Current week detection (only if includes today)
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const isCurrentWeek = (daysDiff >= 6 && daysDiff <= 7) && includesCurrentDay && startDate.getDay() === 1;
    
    // 🔒 FINAL DECISION: Only truly current periods use cache
    // Any past month (even last month) uses DATABASE
    const isCurrentMonthOnly = isExactCurrentMonth && !isCurrentWeek && includesCurrentDay;
    const isCurrentPeriod = isCurrentWeek || isCurrentMonthOnly;
    
    // 🎯 FORCE DATABASE FOR ALL PAST MONTHS
    const needsSmartCache = isCurrentPeriod;
    const needsLiveData = false;
    
    console.log('🎯 STRICT PERIOD CLASSIFICATION (DATABASE-FIRST FOR PAST):', {
      today,
      currentYear,
      currentMonth,
      currentDay,
      requestStartDate: dateRange.start,
      requestEndDate: dateRange.end,
      requestYear: startYear,
      requestMonth: startMonth,
      requestEndMonth: endMonth,
      isExactCurrentMonth,
      isCurrentWeek,
      isCurrentMonthOnly,
      includesCurrentDay,
      isCurrentPeriod,
      needsSmartCache,
      strategy: needsSmartCache ? '🔄 SMART_CACHE (current period)' : '💾 DATABASE_FIRST (past period)',
      note: isCurrentWeek ? '📅 CURRENT WEEK' : isCurrentMonthOnly ? '📅 CURRENT MONTH' : '📚 HISTORICAL PERIOD - USING DATABASE'
    });
    
    const dataSources: string[] = [];
    
    try {
      // ✅ FIXED Priority 3: For HISTORICAL periods, check database FIRST (instant return)
      if (!needsSmartCache) {
        console.log(`⚡ HISTORICAL PERIOD: Checking campaign_summaries FIRST for instant return...`);
        dataSources.push('campaign_summaries_database');
        
        const cachedResult = await this.fetchFromCachedSummaries(clientId, dateRange, platform);
        if (cachedResult.success) {
          // ✅ FIXED: Return data if we have ANY metrics (spend, impressions, clicks, or conversions)
          // Don't require conversions - some periods legitimately have 0 conversions
          const hasAnyData = cachedResult.data!.stats && 
            (cachedResult.data!.stats.totalSpend > 0 || 
             cachedResult.data!.stats.totalImpressions > 0 ||
             cachedResult.data!.stats.totalClicks > 0 ||
             cachedResult.data!.stats.totalConversions > 0 ||
             (cachedResult.data!.campaigns && cachedResult.data!.campaigns.length > 0));
          
          if (hasAnyData) {
            const responseTime = Date.now() - startTime;
            
            console.log(`✅ INSTANT RETURN: campaign_summaries returned data in ${responseTime}ms`, {
              totalSpend: cachedResult.data!.stats.totalSpend,
              campaigns: cachedResult.data!.campaigns?.length || 0,
              reservations: cachedResult.data!.conversionMetrics?.reservations || 0
            });
            
            return {
              success: true,
              data: cachedResult.data!,
              debug: {
                source: 'campaign-summaries-database',
                cachePolicy: 'database-first-historical-instant',
                responseTime,
                reason,
                dataSourcePriority: dataSources,
                periodType: 'historical'
              },
              validation: {
                actualSource: 'campaign_summaries',
                expectedSource: 'campaign_summaries',
                isConsistent: true
              }
            };
          } else {
            console.log('⚠️ campaign_summaries has no metrics data, trying next source...');
          }
        }
        
        // ✅ FIXED: Try daily_kpi_data for historical if summaries incomplete
        console.log(`📊 HISTORICAL: Trying daily_kpi_data for ${platform}...`);
        dataSources.push('daily_kpi_data');
        
        const dailyResult = await this.fetchFromDailyKpiData(clientId, dateRange, platform);
        if (dailyResult.success) {
          const responseTime = Date.now() - startTime;
          
          console.log(`✅ SUCCESS: daily_kpi_data returned data in ${responseTime}ms`);
          
          return {
            success: true,
            data: dailyResult.data!,
            debug: {
              source: 'daily-kpi-data',
              cachePolicy: 'database-first-historical',
              responseTime,
              reason,
              dataSourcePriority: dataSources,
              periodType: 'historical'
            },
            validation: {
              actualSource: 'daily_kpi_data',
              expectedSource: 'daily_kpi_data',
              isConsistent: true
            }
          };
        }
        
        // Last resort for historical: live API
        console.log('4️⃣ HISTORICAL: No database data, trying live API fallback...');
        dataSources.push('live_api_with_cache_storage');
        
        const liveResult = await this.fetchFromLiveAPIWithCaching(clientId, dateRange, platform, sessionToken);
        if (liveResult.success) {
          const responseTime = Date.now() - startTime;
        
          console.log(`✅ SUCCESS: Live API fallback returned data in ${responseTime}ms`);
          
          return {
            success: true,
            data: liveResult.data!,
            debug: {
              source: 'live-api-with-cache-storage',
              cachePolicy: 'live-api-smart-cache-update',
              responseTime,
              reason,
              dataSourcePriority: dataSources
            },
            validation: {
              actualSource: 'live_api',
              expectedSource: 'campaign_summaries',
              isConsistent: true
            }
          };
        }
      }
      
      // ✅ FIXED Priority 2: For CURRENT periods, use smart cache (direct access, no HTTP)
      if (needsSmartCache) {
        console.log(`⚡ CURRENT PERIOD: Using smart cache (DIRECT ACCESS) for ${platform}...`);
        dataSources.push('smart_cache_system');
        
        let smartCacheResult;
        
        if (isCurrentWeek) {
          // Use weekly smart cache for current week
          console.log('📅 Using WEEKLY smart cache for current week (DIRECT)...');
          smartCacheResult = await this.fetchFromWeeklySmartCache(clientId, dateRange, platform);
        } else {
          // Use monthly smart cache for current month
          console.log('📅 Using MONTHLY smart cache for current month (DIRECT)...');
          smartCacheResult = await this.fetchFromSmartCache(clientId, dateRange, platform);
        }
        
        console.log('🎯 Smart cache result:', { 
          success: smartCacheResult.success, 
          source: smartCacheResult.debug?.source,
          campaignsCount: smartCacheResult.data?.campaigns?.length || 0,
          cacheType: isCurrentWeek ? 'weekly' : 'monthly'
        });
        
        if (smartCacheResult.success) {
          const responseTime = Date.now() - startTime;
          console.log(`✅ SUCCESS: Smart cache returned data in ${responseTime}ms (DIRECT ACCESS)`);
          
          return {
            success: true,
            data: smartCacheResult.data!,
            debug: {
              source: smartCacheResult.debug?.source || 'smart-cache-system',
              cachePolicy: smartCacheResult.debug?.cachePolicy || 'smart-cache-3hour',
              responseTime,
              reason,
              dataSourcePriority: dataSources,
              periodType: 'current'
            },
            validation: {
              actualSource: 'smart_cache',
              expectedSource: 'smart_cache',
              isConsistent: true
            }
          };
        }
        
        console.log('⚠️ Smart cache failed for current period, falling back to database...');
        // Fall through to database check as fallback
      }
      
      // ⚠️ FALLBACK: For current periods, try database if smart cache fails
      // WARNING: This should rarely happen - current period data should come from smart cache!
      if (needsSmartCache) {
        console.warn(`⚠️ UNEXPECTED FALLBACK: Smart cache failed for CURRENT period! Trying campaign_summaries...`);
        console.warn(`⚠️ This suggests either: 1) Smart cache validation failed, 2) Cache is empty, or 3) Current month was manually archived`);
        dataSources.push('campaign_summaries_database');
        
        const cachedResult = await this.fetchFromCachedSummaries(clientId, dateRange, platform);
        if (cachedResult.success) {
          // ✅ FIXED: Return data if we have ANY metrics, not just conversions
          const hasAnyData = cachedResult.data!.stats && 
            (cachedResult.data!.stats.totalSpend > 0 || 
             cachedResult.data!.stats.totalImpressions > 0 ||
             cachedResult.data!.stats.totalClicks > 0 ||
             (cachedResult.data!.campaigns && cachedResult.data!.campaigns.length > 0));
          
          if (hasAnyData) {
            const responseTime = Date.now() - startTime;
            console.warn(`⚠️ USING STALE DATA: campaign_summaries returned data for CURRENT period in ${responseTime}ms`, {
              totalSpend: cachedResult.data!.stats.totalSpend,
              campaigns: cachedResult.data!.campaigns?.length || 0,
              warning: 'This data may be outdated! Smart cache should be used for current periods.'
            });
            
            return {
              success: true,
              data: cachedResult.data!,
              debug: {
                source: 'campaign-summaries-database',
                cachePolicy: 'database-fallback-current-stale',
                responseTime,
                reason,
                dataSourcePriority: dataSources,
                periodType: 'current'
              },
              validation: {
                actualSource: 'campaign_summaries',
                expectedSource: 'smart_cache',
                isConsistent: false
              }
            };
          }
        }
        
        // ✅ FALLBACK: Try daily_kpi_data for current period if smart cache and summaries failed
        console.log(`📊 CURRENT PERIOD FALLBACK: Trying daily_kpi_data for ${platform}...`);
        dataSources.push('daily_kpi_data');
        
        const dailyResult = await this.fetchFromDailyKpiData(clientId, dateRange, platform);
        if (dailyResult.success) {
          const responseTime = Date.now() - startTime;
          console.log(`✅ FALLBACK SUCCESS: daily_kpi_data returned data in ${responseTime}ms`);
          
          return {
            success: true,
            data: dailyResult.data!,
            debug: {
              source: 'daily-kpi-data',
              cachePolicy: 'database-fallback-current',
              responseTime,
              reason,
              dataSourcePriority: dataSources,
              periodType: 'current'
            },
            validation: {
              actualSource: 'daily_kpi_data',
              expectedSource: 'smart_cache',
              isConsistent: false
            }
          };
        }
        
        // ✅ LAST RESORT: Live API for current period
        console.log('🚀 CURRENT PERIOD LAST RESORT: Trying live API...');
        dataSources.push('live_api_with_cache_storage');
        
        const liveResult = await this.fetchFromLiveAPIWithCaching(clientId, dateRange, platform, sessionToken);
        if (liveResult.success) {
          const responseTime = Date.now() - startTime;
          console.log(`✅ LAST RESORT SUCCESS: Live API returned data in ${responseTime}ms`);
          
          return {
            success: true,
            data: liveResult.data!,
            debug: {
              source: 'live-api-with-cache-storage',
              cachePolicy: 'live-api-smart-cache-update',
              responseTime,
              reason,
              dataSourcePriority: dataSources
            },
            validation: {
              actualSource: 'live_api',
              expectedSource: 'smart_cache',
              isConsistent: false
            }
          };
        }
      }
      
      // FAILURE: No data available
      throw new Error('No data available from any source');
      
    } catch (error) {
      logger.error('❌ Standardized fetch failed:', error);
      
      return {
        success: false,
        data: this.getZeroData(),
        debug: {
          source: 'error-fallback',
          cachePolicy: 'none',
          responseTime: Date.now() - startTime,
          reason,
          dataSourcePriority: dataSources
        },
        validation: {
          actualSource: 'error',
          expectedSource: 'daily_kpi_data',
          isConsistent: false
        }
      };
    }
  }
  
  /**
   * PRIORITY 1: Fetch from daily_kpi_data (most accurate) + campaign_summaries for conversions
   */
  private static async fetchFromDailyKpiData(
    clientId: string, 
    dateRange: { start: string; end: string },
    platform: 'meta' | 'google' = 'meta'
  ): Promise<Partial<StandardizedDataResult>> {
    
    // ✅ CRITICAL FIX: Use admin client to bypass RLS policies
    const dbClient = (typeof window === 'undefined' && supabaseAdmin) ? supabaseAdmin : supabase;
    
    // Map platform to data_source field
    const dataSource = platform === 'meta' ? 'meta_api' : 'google_ads_api';
    
    const { data: dailyRecords, error } = await dbClient
      .from('daily_kpi_data')
      .select('*')
      .eq('client_id', clientId)
      .eq('data_source', dataSource)
      .gte('date', dateRange.start)
      .lte('date', dateRange.end)
      .order('date', { ascending: true });
      
    if (error || !dailyRecords || dailyRecords.length === 0) {
      console.log(`⚠️ No daily_kpi_data available for ${platform} (${dataSource})`);
      return { success: false };
    }
    
    console.log(`✅ Found ${dailyRecords.length} daily records for ${platform}, aggregating...`);
    console.log(`🔍 DEBUG: Data sources in records:`, dailyRecords.map(r => r.data_source));
    console.log(`🔍 DEBUG: Sample reservation values:`, dailyRecords.slice(0, 3).map(r => ({ date: r.date, reservation_value: r.reservation_value, data_source: r.data_source })));
    
    // Aggregate daily records INCLUDING reach and booking_step_3
    const totals = dailyRecords.reduce((acc, record) => ({
      totalSpend: acc.totalSpend + (record.total_spend || 0),
      totalImpressions: acc.totalImpressions + (record.total_impressions || 0),
      totalClicks: acc.totalClicks + (record.total_clicks || 0),
      totalConversions: acc.totalConversions + (record.total_conversions || 0),
      click_to_call: acc.click_to_call + (record.click_to_call || 0),
      email_contacts: acc.email_contacts + (record.email_contacts || 0),
      booking_step_1: acc.booking_step_1 + (record.booking_step_1 || 0),
      booking_step_2: acc.booking_step_2 + (record.booking_step_2 || 0),
      booking_step_3: acc.booking_step_3 + ((record as any).booking_step_3 || 0),
      reservations: acc.reservations + (record.reservations || 0),
      reservation_value: acc.reservation_value + (record.reservation_value || 0),
      reach: acc.reach + ((record as any).reach || 0)
    }), {
      totalSpend: 0,
      totalImpressions: 0,
      totalClicks: 0,
      totalConversions: 0,
      click_to_call: 0,
      email_contacts: 0,
      booking_step_1: 0,
      booking_step_2: 0,
      booking_step_3: 0,
      reservations: 0,
      reservation_value: 0,
      reach: 0
    });
    
    // Calculate derived metrics
    const averageCtr = totals.totalImpressions > 0 ? (totals.totalClicks / totals.totalImpressions) * 100 : 0;
    const averageCpc = totals.totalClicks > 0 ? totals.totalSpend / totals.totalClicks : 0;
    
    // 🔧 ENHANCED: Get conversion data from campaign_summaries (more accurate for conversions)
    console.log(`🎯 Fetching conversion data from campaign_summaries for ${platform}...`);
    
    let conversionMetrics = {
      click_to_call: totals.click_to_call,
      email_contacts: totals.email_contacts,
      booking_step_1: totals.booking_step_1,
      booking_step_2: totals.booking_step_2,
      booking_step_3: totals.booking_step_3,
      reservations: totals.reservations,
      reservation_value: totals.reservation_value,
      roas: 0,
      cost_per_reservation: 0,
      reach: totals.reach
    };
    
    // Try to get more accurate conversion data from campaign_summaries
    // @ts-ignore - Supabase type issue
    const campaignSummaryResult = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', clientId)
      .eq('platform', platform)
      .gte('summary_date', dateRange.start)
      .lte('summary_date', dateRange.end)
      .order('created_at', { ascending: false })
      .limit(1);
      
    const campaignSummary = campaignSummaryResult.data;
      
    if (campaignSummary && campaignSummary.length > 0) {
      const summary = campaignSummary[0] as any; // Type assertion for conversion data
      console.log(`✅ Found campaign summary with conversion data: ${summary?.reservations || 0} reservations, ${summary?.reservation_value || 0} PLN`);
      
      conversionMetrics = {
        click_to_call: summary.click_to_call || 0,
        email_contacts: summary.email_contacts || 0,
        booking_step_1: summary.booking_step_1 || 0,
        booking_step_2: summary.booking_step_2 || 0,
        booking_step_3: (summary as any).booking_step_3 || 0,
        reservations: summary.reservations || 0,
        reservation_value: summary.reservation_value || 0,
        roas: summary.roas || (summary.reservation_value && totals.totalSpend ? summary.reservation_value / totals.totalSpend : 0),
        cost_per_reservation: summary.cost_per_reservation || (summary.reservations && totals.totalSpend ? totals.totalSpend / summary.reservations : 0),
        reach: (summary as any).reach || 0
      } as any;
    } else {
      console.log(`⚠️ No campaign summary found for conversion data, using daily totals`);
      // Calculate conversion metrics from daily data totals
      conversionMetrics = {
        click_to_call: totals.click_to_call,
        email_contacts: totals.email_contacts,
        booking_step_1: totals.booking_step_1,
        booking_step_2: totals.booking_step_2,
        booking_step_3: totals.booking_step_3,
        reservations: totals.reservations,
        reservation_value: totals.reservation_value,
        roas: totals.reservation_value && totals.totalSpend ? totals.reservation_value / totals.totalSpend : 0,
        cost_per_reservation: totals.reservations && totals.totalSpend ? totals.totalSpend / totals.reservations : 0,
        reach: totals.reach
      };
      console.log(`✅ Calculated conversion metrics from daily data: ${conversionMetrics.reservations} reservations, ${conversionMetrics.reservation_value} PLN`);
    }
    
    const roas = conversionMetrics.roas;
    const cost_per_reservation = conversionMetrics.cost_per_reservation;
    
    // 🔧 FIX: Create synthetic campaigns from daily data for reports compatibility
    // The reports page expects campaigns array to display data properly
    const syntheticCampaigns = dailyRecords.map((record, index) => ({
      id: `daily-${record.client_id}-${record.date}-${index}`,
      campaign_id: `daily-campaign-${record.date}`,
      campaign_name: `Daily Data ${record.date}`,
      spend: record.total_spend || 0,
      impressions: record.total_impressions || 0,
      clicks: record.total_clicks || 0,
      conversions: record.total_conversions || 0,
      ctr: record.total_impressions > 0 ? ((record.total_clicks || 0) / record.total_impressions) * 100 : 0,
      cpc: record.total_clicks > 0 ? (record.total_spend || 0) / record.total_clicks : 0,
      cpa: record.total_conversions > 0 ? (record.total_spend || 0) / record.total_conversions : 0,
      date_start: record.date,
      date_stop: record.date,
      // Conversion metrics from daily data INCLUDING reach and booking_step_3
      click_to_call: record.click_to_call || 0,
      email_contacts: record.email_contacts || 0,
      booking_step_1: record.booking_step_1 || 0,
      booking_step_2: record.booking_step_2 || 0,
      booking_step_3: (record as any).booking_step_3 || 0,
      reservations: record.reservations || 0,
      reservation_value: record.reservation_value || 0,
      reach: (record as any).reach || 0
    }));
    
    console.log(`✅ Created ${syntheticCampaigns.length} synthetic campaigns from daily data`);
    
    return {
      success: true,
      data: {
        stats: {
          ...totals,
          averageCtr,
          averageCpc
        },
        conversionMetrics,
        campaigns: syntheticCampaigns // Now includes synthetic campaigns for reports compatibility
      }
    };
  }
  
  /**
   * ✅ FIXED: Fetch from Smart Cache System (DIRECT ACCESS - no HTTP overhead)
   * Priority 2 Fix: Removed HTTP layer, calls smart cache helper directly
   * ✅ FIXED: Validates requested date range matches current period before using cache
   */
  private static async fetchFromSmartCache(
    clientId: string,
    dateRange: { start: string; end: string },
    platform: string
  ): Promise<Partial<StandardizedDataResult>> {
    
    console.log(`🎯 SMART CACHE: Direct access for ${platform} (validating date range)...`);
    
    try {
      // ✅ RELAXED VALIDATION: Check if requested month/year matches current month
      const { getCurrentMonthInfo } = await import('./smart-cache-helper');
      const currentMonth = getCurrentMonthInfo();
      
      // Parse requested dates
      const requestedStart = new Date(dateRange.start);
      const requestedEnd = new Date(dateRange.end);
      
      // Check if requested month/year matches current month (relaxed validation)
      const requestedStartMonth = requestedStart.getFullYear() * 100 + requestedStart.getMonth();
      const requestedEndMonth = requestedEnd.getFullYear() * 100 + requestedEnd.getMonth();
      const currentMonthNum = new Date().getFullYear() * 100 + new Date().getMonth();
      
      const isCurrentMonth = (requestedStartMonth === currentMonthNum && requestedEndMonth === currentMonthNum);
      
      if (!isCurrentMonth) {
        console.log(`⚠️ Month mismatch: Requested ${dateRange.start} to ${dateRange.end} is not current month (${currentMonth.periodId})`);
        console.log(`⚠️ Smart cache only works for current month, falling back to database...`);
        return { success: false };
      }
      
      console.log(`✅ Month validated: Requested period is current month (${currentMonth.periodId})`);
      console.log(`📅 Exact dates: Requested ${dateRange.start} to ${dateRange.end}, Cache has ${currentMonth.startDate} to ${currentMonth.endDate}`);
      
      // ✅ PLATFORM-SPECIFIC: Call the correct smart cache helper based on platform
      let result;
      if (platform === 'google') {
        // ✅ CRITICAL: Google Ads cache is server-side only (requires Node.js fs module)
        if (typeof window === 'undefined') {
          console.log(`🔵 Using Google Ads smart cache helper (server-side)...`);
          const { getGoogleAdsSmartCacheData } = await import('./google-ads-smart-cache-helper');
          result = await getGoogleAdsSmartCacheData(clientId, false);
        } else {
          console.log(`⚠️ Google Ads cache not available on client-side, falling back...`);
          return { success: false };
        }
      } else {
        console.log(`🔵 Using Meta smart cache helper...`);
        const { getSmartCacheData } = await import('./smart-cache-helper');
        result = await getSmartCacheData(clientId, false, platform);
      }
      
      if (result.success && result.data) {
        console.log(`✅ Smart cache returned data for ${platform} (DIRECT ACCESS):`, {
          source: result.source,
          periodId: currentMonth.periodId,
          fromCache: result.data.fromCache,
          cacheAge: result.data.cacheAge,
          campaignsCount: result.data.campaigns?.length || 0,
          totalSpend: result.data.stats?.totalSpend || 0
        });
        
        // ✅ VALIDATION: Verify cache data period matches requested period
        if (result.data.periodId && result.data.periodId !== currentMonth.periodId) {
          console.warn(`⚠️ Cache period mismatch: Cache has ${result.data.periodId}, expected ${currentMonth.periodId}`);
        }
        
        return {
          success: true,
          data: {
            stats: result.data.stats || this.getZeroData().stats,
            conversionMetrics: result.data.conversionMetrics || this.getZeroData().conversionMetrics,
            campaigns: result.data.campaigns || []
          },
          debug: {
            source: result.source || 'smart-cache-direct',
            cachePolicy: result.data.fromCache ? 'smart-cache-fresh' : 'smart-cache-stale',
            responseTime: 0,
            reason: 'direct-smart-cache-access',
            dataSourcePriority: ['smart-cache-direct'],
            periodType: 'current',
            periodId: currentMonth.periodId
          }
        };
      } else {
        console.log(`⚠️ Smart cache returned no data for ${platform}`);
        return { success: false };
      }
      
    } catch (error) {
      console.error(`❌ Smart cache error for ${platform}:`, error);
      return { success: false };
    }
  }
  
  /**
   * ✅ FIXED: Fetch from Weekly Smart Cache (with date range validation)
   * Validates requested date range matches current week before using cache
   */
  private static async fetchFromWeeklySmartCache(
    clientId: string,
    dateRange: { start: string; end: string },
    platform: string
  ): Promise<Partial<StandardizedDataResult>> {
    
    console.log(`📅 WEEKLY SMART CACHE for ${platform} (validating date range)...`);
    
    try {
      // ✅ RELAXED VALIDATION: Check if requested week overlaps with current week
      const { getCurrentWeekInfo, parseWeekPeriodId } = await import('./week-utils');
      const currentWeek = getCurrentWeekInfo();
      
      // Parse dates
      const requestedStart = new Date(dateRange.start);
      const requestedEnd = new Date(dateRange.end);
      const currentWeekStart = new Date(currentWeek.startDate);
      const currentWeekEnd = new Date(currentWeek.endDate);
      
      // Check if requested week overlaps with current week
      const isOverlapping = (
        (requestedStart <= currentWeekEnd && requestedEnd >= currentWeekStart) ||
        (requestedStart.toISOString().split('T')[0] === currentWeek.startDate)
      );
      
      if (!isOverlapping) {
        console.log(`⚠️ Week mismatch: Requested ${dateRange.start} to ${dateRange.end} does not match current week (${currentWeek.periodId})`);
        console.log(`⚠️ Weekly smart cache only works for current week, falling back to database...`);
        return { success: false };
      }
      
      console.log(`✅ Week validated: Requested period matches current week (${currentWeek.periodId})`);
      console.log(`📅 Exact dates: Requested ${dateRange.start} to ${dateRange.end}, Cache has ${currentWeek.startDate} to ${currentWeek.endDate}`);
      
      if (platform === 'google') {
        // Use Google Ads weekly smart cache (server-side only)
        if (typeof window === 'undefined') {
          const { getGoogleAdsSmartWeekCacheData } = await import('./google-ads-smart-cache-helper');
          const result = await getGoogleAdsSmartWeekCacheData(clientId, false, currentWeek.periodId);
        
          if (result.success && result.data) {
            return {
              success: true,
              data: result.data,
              debug: {
                source: 'google-ads-weekly-cache',
                cachePolicy: 'smart-cache-3hour',
                responseTime: 0,
                reason: 'weekly-smart-cache',
                dataSourcePriority: ['weekly-smart-cache'],
                periodType: 'current-week',
                periodId: currentWeek.periodId
              },
              validation: {
                actualSource: 'google_ads_weekly_cache',
                expectedSource: 'google_ads_weekly_cache',
                isConsistent: true
              }
            };
          }
        } else {
          // Client-side: return error for Google Ads
          console.log('⚠️ Google Ads weekly cache not available on client-side');
          return { success: false };
        }
      } else {
        // Use Meta weekly smart cache with validated period ID
        const { getSmartWeekCacheData } = await import('./smart-cache-helper');
        const result = await getSmartWeekCacheData(clientId, false, currentWeek.periodId);
        
        if (result.success && result.data) {
          console.log(`✅ Weekly smart cache returned data for ${platform}:`, {
            source: result.source,
            periodId: currentWeek.periodId,
            fromCache: result.data.fromCache,
            campaignsCount: result.data.campaigns?.length || 0
          });
          
          return {
            success: true,
            data: result.data,
            debug: {
              source: 'meta-weekly-cache',
              cachePolicy: 'smart-cache-3hour',
              responseTime: 0,
              reason: 'weekly-smart-cache',
              dataSourcePriority: ['weekly-smart-cache'],
              periodType: 'current-week',
              periodId: currentWeek.periodId
            },
            validation: {
              actualSource: 'meta_weekly_cache',
              expectedSource: 'meta_weekly_cache',
              isConsistent: true
            }
          };
        }
      }
      
      return { success: false };
    } catch (error) {
      console.error(`❌ Weekly smart cache error for ${platform}:`, error);
      return { success: false };
    }
  }

  /**
   * NEW: Fetch from Live API with Smart Cache Storage
   */
  private static async fetchFromLiveAPIWithCaching(
    clientId: string,
    dateRange: { start: string; end: string },
    platform: string,
    sessionToken?: string
  ): Promise<Partial<StandardizedDataResult>> {
    
    console.log(`🚀 LIVE API + CACHE STORAGE for ${platform}...`);
    
    try {
      // Determine API endpoint based on platform
      const apiEndpoint = platform === 'meta' 
        ? '/api/fetch-live-data'
        : '/api/fetch-google-ads-live-data';
      
      const requestBody = {
        dateRange,
        clientId,
        platform,
        forceFresh: false, // Let smart cache system decide
        reason: 'standardized-data-fetcher-with-caching'
      };
      
      // Use relative URL for same-origin requests (works in both dev and production)
      const fullUrl = apiEndpoint;
      
      console.log(`🚀 Calling live API with caching: ${fullUrl}`);
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      const response = await fetch(fullUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        console.log(`⚠️ Live API call failed: ${response.status} ${response.statusText}`);
        return { success: false };
      }
      
      const result = await response.json();
      console.log(`📊 Live API response:`, { 
        success: result.success, 
        hasData: !!result.data,
        source: result.debug?.source || 'unknown'
      });
      
      if (result.success && result.data) {
        // Transform and return data
        const transformedData = {
          stats: result.data.stats || this.getZeroData().stats,
          conversionMetrics: result.data.conversionMetrics || this.getZeroData().conversionMetrics,
          campaigns: result.data.campaigns || []
        };
        
        console.log(`✅ Live API data transformed and cached for ${platform}`);
        
        return {
          success: true,
          data: transformedData
        };
      } else {
        console.log(`⚠️ Live API returned no data`);
        return { success: false };
      }
      
    } catch (error) {
      console.log(`⚠️ Live API error: ${error}`);
      return { success: false };
    }
  }
  
  /**
   * PRIORITY 2: Fetch from campaign_summaries (proven working system)
   * Uses same logic as the working loadFromDatabase function
   */
  private static async fetchFromCachedSummaries(
    clientId: string,
    dateRange: { start: string; end: string },
    platform: string
  ): Promise<Partial<StandardizedDataResult>> {
    
    console.log(`📊 Loading from campaign_summaries for ${clientId} (${dateRange.start} to ${dateRange.end}) - Platform: ${platform}`);
    
    // ✅ CRITICAL FIX: Use admin client to bypass RLS policies
    // Server-side queries need supabaseAdmin to access all client data
    const dbClient = (typeof window === 'undefined' && supabaseAdmin) ? supabaseAdmin : supabase;
    const usingAdmin = (typeof window === 'undefined' && supabaseAdmin) ? true : false;
    
    console.log(`🔑 Using ${usingAdmin ? 'ADMIN' : 'ANON'} client for database query (server-side: ${typeof window === 'undefined'})`);
    
    // Determine if this is a weekly or monthly request based on date range
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const summaryType = daysDiff <= 7 ? 'weekly' : 'monthly';
    
    console.log(`📊 Detected ${summaryType} request (${daysDiff} days) for ${platform} platform`);
    
    let storedSummary, error;
    
    if (summaryType === 'weekly') {
      // 📅 WEEKLY DATA: Search for weekly data in campaign_summaries
      console.log(`📅 Searching for weekly data in campaign_summaries between ${dateRange.start} and ${dateRange.end}`);
      
      const { data: weeklyResults, error: weeklyError } = await dbClient
        .from('campaign_summaries')
        .select('*')
        .eq('client_id', clientId)
        .eq('summary_type', 'weekly')
        .eq('platform', platform)
        .gte('summary_date', dateRange.start)
        .lte('summary_date', dateRange.end)
        .order('summary_date', { ascending: false })
        .limit(1);
      
      if (weeklyResults && weeklyResults.length > 0) {
        storedSummary = weeklyResults[0];
        console.log(`✅ Found weekly summary for ${dateRange.start} to ${dateRange.end}:`, {
          summaryDate: storedSummary?.summary_date,
          totalSpend: storedSummary?.total_spend,
          reservations: (storedSummary as any)?.reservations,
          periodMatch: storedSummary?.summary_date >= dateRange.start && storedSummary?.summary_date <= dateRange.end
        });
      } else {
        error = weeklyError;
        console.log(`⚠️ No weekly summary found for ${dateRange.start} to ${dateRange.end}`);
      }
    } else {
      // 📅 MONTHLY DATA: Search for monthly data in campaign_summaries
      console.log(`📅 Searching for monthly data in campaign_summaries for ${dateRange.start}`);
      
      const { data: monthlyResults, error: monthlyError } = await dbClient
        .from('campaign_summaries')
        .select('*')
        .eq('client_id', clientId)
        .eq('summary_type', 'monthly')
        .eq('platform', platform)
        .eq('summary_date', dateRange.start)
        .limit(1);
      
      if (monthlyResults && monthlyResults.length > 0) {
        storedSummary = monthlyResults[0];
        console.log(`✅ Found monthly summary for ${dateRange.start}:`, {
          summaryDate: storedSummary?.summary_date,
          totalSpend: storedSummary?.total_spend,
          totalImpressions: storedSummary?.total_impressions,
          totalClicks: storedSummary?.total_clicks,
          reservations: (storedSummary as any)?.reservations,
          campaignCount: storedSummary?.campaign_data ? (storedSummary.campaign_data as any[]).length : 0,
          periodMatch: storedSummary?.summary_date === dateRange.start,
          requestedPeriod: dateRange.start,
          actualPeriod: storedSummary?.summary_date,
          platform: storedSummary?.platform
        });
      } else {
        error = monthlyError;
        console.log(`⚠️ No monthly summary found for ${dateRange.start} (requested period)`, {
          clientId: clientId.substring(0, 8) + '...',
          platform,
          summaryType: 'monthly',
          requestedDate: dateRange.start,
          error: monthlyError?.message,
          note: 'Check if data exists in database with this exact date'
        });
      }
    }
      
    if (error || !storedSummary) {
      console.log('⚠️ No campaign_summaries data available');
      return { success: false };
    }
    
    console.log('✅ Using campaign_summaries data (proven working system)');
    
    return {
      success: true,
      data: {
        stats: {
          totalSpend: storedSummary.total_spend || 0,
          totalImpressions: storedSummary.total_impressions || 0,
          totalClicks: storedSummary.total_clicks || 0,
          totalConversions: storedSummary.total_conversions || 0,
          averageCtr: storedSummary.average_ctr || 0,
          averageCpc: storedSummary.average_cpc || 0
        },
        conversionMetrics: {
          click_to_call: (storedSummary as any).click_to_call || 0,
          email_contacts: (storedSummary as any).email_contacts || 0,
          booking_step_1: (storedSummary as any).booking_step_1 || 0,
          booking_step_2: (storedSummary as any).booking_step_2 || 0,
          booking_step_3: (storedSummary as any).booking_step_3 || 0,
          reservations: (storedSummary as any).reservations || 0,
          reservation_value: (storedSummary as any).reservation_value || 0,
          roas: (storedSummary as any).reservation_value && storedSummary.total_spend ? (storedSummary as any).reservation_value / storedSummary.total_spend : 0,
          cost_per_reservation: (storedSummary as any).reservations && storedSummary.total_spend ? storedSummary.total_spend / (storedSummary as any).reservations : 0,
          reach: (storedSummary as any).reach || 0
        },
        campaigns: (storedSummary.campaign_data as any[]) || []
      }
    };
  }
  
  /**
   * Get zero data as fallback
   */
  private static getZeroData() {
    return {
      stats: {
        totalSpend: 0,
        totalImpressions: 0,
        totalClicks: 0,
        totalConversions: 0,
        averageCtr: 0,
        averageCpc: 0
      },
      conversionMetrics: {
        click_to_call: 0,
        email_contacts: 0,
        booking_step_1: 0,
        booking_step_2: 0,
        booking_step_3: 0,
        reservations: 0,
        reservation_value: 0,
        roas: 0,
        cost_per_reservation: 0,
        reach: 0
      },
      campaigns: []
    };
  }
}
