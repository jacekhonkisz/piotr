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

import { supabase } from './supabase';
import logger from './logger';

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
    
    const { clientId, dateRange, platform = 'meta', reason = 'standardized-fetch', sessionToken } = params;
    const startTime = Date.now();
    
    logger.info('🎯 STANDARDIZED FETCH:', {
      clientId,
      dateRange,
      platform,
      reason,
      timestamp: new Date().toISOString()
    });
    
    // 🎯 PRODUCTION FIX: FORCE LIVE API FOR RECENT PERIODS
    const now = new Date();
    const today: string = now.toISOString().split('T')[0]!;
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);
    const startYear = startDate.getFullYear();
    const startMonth = startDate.getMonth() + 1;
    
    const isCurrentPeriod = startYear === currentYear && startMonth === currentMonth;
    const includesCurrentDay = dateRange.end >= today;
    
    // 🚨 PRODUCTION FIX: Force live API for any period less than 30 days old
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    const isRecentPeriod = startDate >= thirtyDaysAgo;
    
    // Force live data for current period OR recent periods (bypass broken cache)
    const needsLiveData = isCurrentPeriod || isRecentPeriod;
    
    console.log('🎯 PRODUCTION PERIOD CLASSIFICATION:', {
      currentYear,
      currentMonth,
      requestYear: startYear,
      requestMonth: startMonth,
      isCurrentPeriod,
      isRecentPeriod,
      includesCurrentDay,
      needsLiveData,
      today,
      dateRangeEnd: dateRange.end,
      thirtyDaysAgo: thirtyDaysAgo.toISOString().split('T')[0],
      strategy: needsLiveData ? 'LIVE_API_FORCED (bypass broken cache)' : 'DATABASE_FIRST (historical data)'
    });
    
    const dataSources: string[] = [];
    
    try {
      // 🚨 PRODUCTION FIX: Force live API for recent periods (bypass broken cache)
      if (needsLiveData) {
        console.log(`1️⃣ PRODUCTION FIX: Forcing live API for recent period ${platform} (cache bypass)...`);
        dataSources.push('live_api_forced_production_fix');
        
        const liveResult = await this.fetchFromLiveAPI(clientId, dateRange, platform, sessionToken);
        if (liveResult.success) {
          const responseTime = Date.now() - startTime;
          
          console.log(`✅ SUCCESS: Live API returned fresh data in ${responseTime}ms (cache bypassed)`);
          
          return {
            success: true,
            data: liveResult.data!,
            debug: {
              source: 'live-api-production-fix',
              cachePolicy: 'cache-bypass-production-fix',
              responseTime,
              reason,
              dataSourcePriority: dataSources,
              periodType: 'current'
            },
            validation: {
              actualSource: 'live_api',
              expectedSource: 'live_api',
              isConsistent: true
            }
          };
        }
        
        console.log('⚠️ Live API failed for current period, falling back to daily_kpi_data...');
      }
      
      // Priority 2: Try campaign_summaries (proven working system)
      console.log(`2️⃣ STANDARDIZED: Trying campaign_summaries for ${platform}...`);
      dataSources.push('campaign_summaries_primary');
      
      const cachedResult = await this.fetchFromCachedSummaries(clientId, dateRange, platform);
      if (cachedResult.success) {
        const responseTime = Date.now() - startTime;
        
        console.log(`✅ SUCCESS: Legacy campaign_summaries returned data in ${responseTime}ms`);
        
        return {
          success: true,
          data: cachedResult.data!,
          debug: {
            source: 'campaign-summaries-primary',
            cachePolicy: needsLiveData ? 'database-fallback-current' : 'database-first-historical',
            responseTime,
            reason,
            dataSourcePriority: dataSources,
            periodType: isCurrentPeriod ? 'current' : 'historical'
          },
          validation: {
            actualSource: 'campaign_summaries',
            expectedSource: 'campaign_summaries',
            isConsistent: false
          }
        };
      }
      
      // Priority 3: Try daily_kpi_data (fallback if campaign_summaries fails)
      console.log(`3️⃣ STANDARDIZED: Trying daily_kpi_data fallback for ${platform}...`);
      dataSources.push('daily_kpi_data_fallback');
      
      const dailyResult = await this.fetchFromDailyKpiData(clientId, dateRange, platform);
      if (dailyResult.success) {
        const responseTime = Date.now() - startTime;
        
        console.log(`✅ SUCCESS: daily_kpi_data fallback returned data in ${responseTime}ms`);
        
        return {
          success: true,
          data: dailyResult.data!,
          debug: {
            source: 'daily-kpi-data-fallback',
            cachePolicy: needsLiveData ? 'database-fallback-current' : 'database-first-historical',
            responseTime,
            reason,
            dataSourcePriority: dataSources,
            periodType: isCurrentPeriod ? 'current' : 'historical'
          },
          validation: {
            actualSource: 'daily_kpi_data',
            expectedSource: 'campaign_summaries',
            isConsistent: false
          }
        };
      }
      
      // Priority 4: Live API call (if no database data and not already tried)
      if (!needsLiveData) {
        console.log('4️⃣ No database data, trying live API fallback...');
        dataSources.push('live_api_final_fallback');
        
        const liveResult = await this.fetchFromLiveAPI(clientId, dateRange, platform, sessionToken);
        if (liveResult.success) {
          const responseTime = Date.now() - startTime;
        
          console.log(`✅ SUCCESS: Live API fallback returned data in ${responseTime}ms`);
          
          return {
            success: true,
            data: liveResult.data!,
            debug: {
              source: 'live-api-final-fallback',
              cachePolicy: 'live-api-last-resort',
              responseTime,
              reason,
              dataSourcePriority: dataSources
            },
            validation: {
              actualSource: 'live_api',
              expectedSource: 'campaign_summaries',
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
    
    // Map platform to data_source field
    const dataSource = platform === 'meta' ? 'meta_api' : 'google_ads_api';
    
    const { data: dailyRecords, error } = await supabase
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
    const { data: campaignSummary } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', clientId)
      .eq('platform', platform)
      .gte('summary_date', dateRange.start)
      .lte('summary_date', dateRange.end)
      .order('created_at', { ascending: false })
      .limit(1) as { data: any[] | null; error: any };
      
    if (campaignSummary && campaignSummary.length > 0) {
      const summary = campaignSummary[0];
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
   * PRIORITY 2: Fetch from Live API (smart caching for current periods)
   */
  private static async fetchFromLiveAPI(
    clientId: string,
    dateRange: { start: string; end: string },
    platform: string,
    sessionToken?: string
  ): Promise<Partial<StandardizedDataResult>> {
    
    console.log(`🚀 Using SMART CACHE for ${platform} (3-hour refresh)...`);
    
    try {
      // Determine API endpoint based on platform
      const apiEndpoint = platform === 'meta' 
        ? '/api/fetch-live-data'
        : '/api/fetch-google-ads-live-data';
      
      // 🚨 PRODUCTION FIX: Force fresh data for recent periods
      const isRecentPeriod = new Date(dateRange.start) >= new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));
      
      const requestBody = {
        dateRange,
        clientId,
        platform,
        forceFresh: isRecentPeriod, // 🚨 FORCE FRESH for recent periods (bypass ALL caching)
        reason: isRecentPeriod ? 'production-fix-force-fresh' : 'standardized-smart-cache'
      };
      
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const fullUrl = `${baseUrl}${apiEndpoint}`;
      
      console.log(`🚀 Calling smart cache API: ${fullUrl}`);
      
      // 🔓 AUTH DISABLED: No authentication headers needed
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      console.log('🔓 Authentication disabled for live API calls');
      
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
      console.log(`📊 Smart cache API response:`, { 
        success: result.success, 
        hasData: !!result.data,
        hasStats: !!result.data?.stats,
        hasConversionMetrics: !!result.data?.conversionMetrics,
        source: result.debug?.source || 'unknown'
      });
      
      if (result.success && result.data) {
        // Transform live API response to match StandardizedDataResult format
        const transformedData = {
          stats: result.data.stats || {
            totalSpend: 0,
            totalImpressions: 0,
            totalClicks: 0,
            totalConversions: 0,
            averageCtr: 0,
            averageCpc: 0
          },
          conversionMetrics: result.data.conversionMetrics || {
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
          campaigns: result.data.campaigns || []
        };
        
        console.log(`✅ Smart cache data transformed for ${platform}:`, {
          totalSpend: transformedData.stats.totalSpend,
          booking_step_3: transformedData.conversionMetrics.booking_step_3,
          reach: transformedData.conversionMetrics.reach,
          campaignsCount: transformedData.campaigns.length,
          source: result.debug?.source || 'unknown'
        });
        
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
      
      const { data: weeklyResults, error: weeklyError } = await supabase
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
        console.log(`✅ Found weekly summary for ${dateRange.start}: ${storedSummary?.total_spend} PLN spend`);
      } else {
        error = weeklyError;
        console.log(`⚠️ No weekly summary found for ${dateRange.start}`);
      }
    } else {
      // 📅 MONTHLY DATA: Search for monthly data in campaign_summaries
      console.log(`📅 Searching for monthly data in campaign_summaries for ${dateRange.start}`);
      
      const { data: monthlyResults, error: monthlyError } = await supabase
        .from('campaign_summaries')
        .select('*')
        .eq('client_id', clientId)
        .eq('summary_type', 'monthly')
        .eq('platform', platform)
        .eq('summary_date', dateRange.start)
        .limit(1);
      
      if (monthlyResults && monthlyResults.length > 0) {
        storedSummary = monthlyResults[0];
        console.log(`✅ Found monthly summary for ${dateRange.start}: ${storedSummary?.total_spend} PLN spend`);
      } else {
        error = monthlyError;
        console.log(`⚠️ No monthly summary found for ${dateRange.start}`);
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
