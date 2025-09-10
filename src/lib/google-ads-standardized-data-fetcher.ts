/**
 * GOOGLE ADS STANDARDIZED DATA FETCHER
 * 
 * Separate system for Google Ads data fetching that mirrors the Meta system
 * but is completely independent. Uses the same smart caching and historical
 * data approach as Meta but with Google Ads specific infrastructure.
 * 
 * PRIORITY ORDER (ALWAYS):
 * 1. daily_kpi_data (most accurate, real-time collected)
 * 2. Google Ads smart cache (3-hour refresh for current periods)
 * 3. Database summaries (historical data)
 * 4. Live Google Ads API call (fallback)
 */

import { supabase } from './supabase';
import logger from './logger';

export interface GoogleAdsStandardizedDataResult {
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

export class GoogleAdsStandardizedDataFetcher {
  
  /**
   * MAIN ENTRY POINT - Use this for ALL Google Ads data fetching
   * Completely separate from Meta system but follows same patterns
   */
  static async fetchData(params: {
    clientId: string;
    dateRange: { start: string; end: string };
    reason?: string;
    sessionToken?: string;
  }): Promise<GoogleAdsStandardizedDataResult> {
    
    const { clientId, dateRange, reason = 'google-ads-standardized-fetch', sessionToken } = params;
    const startTime = Date.now();
    
    logger.info('🎯 GOOGLE ADS STANDARDIZED FETCH:', {
      clientId,
      dateRange,
      reason,
      timestamp: new Date().toISOString()
    });
    
    // Period classification (same logic as Meta)
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
    
    // Force live data for recent periods (same as Meta)
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    const isRecentPeriod = startDate >= thirtyDaysAgo;
    const needsLiveData = isCurrentPeriod || isRecentPeriod;
    
    console.log('🎯 GOOGLE ADS PERIOD CLASSIFICATION:', {
      isCurrentPeriod,
      isRecentPeriod,
      needsLiveData,
      dateRange,
      reason
    });

    const dataSources: string[] = [];

    try {
      // Priority 1: Try daily_kpi_data first (most accurate)
      console.log('1️⃣ Checking daily_kpi_data for Google Ads...');
      dataSources.push('daily_kpi_data');
      
      const dailyResult = await this.fetchFromDailyKpiData(clientId, dateRange);
      if (dailyResult.success) {
        const responseTime = Date.now() - startTime;
        
        console.log(`✅ SUCCESS: daily_kpi_data returned Google Ads data in ${responseTime}ms`);
        console.log('🔍 GOOGLE DAILY DATA DEBUG:', {
          totalSpend: dailyResult.data?.stats?.totalSpend,
          totalReservations: dailyResult.data?.conversionMetrics?.reservations,
          totalReservationValue: dailyResult.data?.conversionMetrics?.reservation_value
        });
        
        return {
          success: true,
          data: dailyResult.data!,
          debug: {
            source: 'daily-kpi-data',
            cachePolicy: needsLiveData ? 'database-first-current' : 'database-first-historical',
            responseTime,
            reason,
            dataSourcePriority: dataSources,
            periodType: isCurrentPeriod ? 'current' : 'historical'
          },
          validation: {
            actualSource: 'daily_kpi_data',
            expectedSource: 'daily_kpi_data',
            isConsistent: true
          }
        };
      }

      // Priority 2: Try Google Ads smart cache (for current periods)
      if (needsLiveData) {
        console.log('2️⃣ Trying Google Ads smart cache for current period...');
        dataSources.push('google_ads_smart_cache');
        
        const cacheResult = await this.fetchFromGoogleAdsSmartCache(clientId);
        if (cacheResult.success) {
          const responseTime = Date.now() - startTime;
          
          console.log(`✅ SUCCESS: Google Ads smart cache returned data in ${responseTime}ms`);
          
          return {
            success: true,
            data: cacheResult.data!,
            debug: {
              source: 'google-ads-smart-cache',
              cachePolicy: 'smart-cache-3h-refresh',
              responseTime,
              reason,
              dataSourcePriority: dataSources,
              periodType: 'current'
            },
            validation: {
              actualSource: 'google_ads_smart_cache',
              expectedSource: 'daily_kpi_data',
              isConsistent: false
            }
          };
        }
      }

      // Priority 3: Try database summaries (for historical periods)
      if (!needsLiveData) {
        console.log('3️⃣ Trying Google Ads database summaries for historical period...');
        dataSources.push('google_ads_database_summaries');
        
        const dbResult = await this.fetchFromDatabaseSummaries(clientId, dateRange);
        if (dbResult.success) {
          const responseTime = Date.now() - startTime;
          
          console.log(`✅ SUCCESS: Google Ads database summaries returned data in ${responseTime}ms`);
          
          return {
            success: true,
            data: dbResult.data!,
            debug: {
              source: 'google-ads-database-summaries',
              cachePolicy: 'database-historical',
              responseTime,
              reason,
              dataSourcePriority: dataSources,
              periodType: 'historical'
            },
            validation: {
              actualSource: 'google_ads_database_summaries',
              expectedSource: 'google_ads_database_summaries',
              isConsistent: true
            }
          };
        }
      }

      // Priority 4: Live Google Ads API call (fallback)
      console.log('4️⃣ Trying live Google Ads API as final fallback...');
      dataSources.push('google_ads_live_api');
      
      const liveResult = await this.fetchFromLiveGoogleAdsAPI(clientId, dateRange, sessionToken);
      if (liveResult.success) {
        const responseTime = Date.now() - startTime;
        
        console.log(`✅ SUCCESS: Live Google Ads API returned data in ${responseTime}ms`);
        
        return {
          success: true,
          data: liveResult.data!,
          debug: {
            source: 'google-ads-live-api',
            cachePolicy: 'live-api-fallback',
            responseTime,
            reason,
            dataSourcePriority: dataSources,
            periodType: isCurrentPeriod ? 'current' : 'historical'
          },
          validation: {
            actualSource: 'google_ads_live_api',
            expectedSource: 'daily_kpi_data',
            isConsistent: false
          }
        };
      }

      // FAILURE: No data available from any source
      throw new Error('No Google Ads data available from any source');
      
    } catch (error) {
      logger.error('❌ Google Ads standardized fetch failed:', error);
      
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
   * PRIORITY 1: Fetch from daily_kpi_data (most accurate)
   */
  private static async fetchFromDailyKpiData(
    clientId: string, 
    dateRange: { start: string; end: string }
  ): Promise<Partial<GoogleAdsStandardizedDataResult>> {
    
    const { data: dailyRecords, error } = await supabase
      .from('daily_kpi_data')
      .select('*')
      .eq('client_id', clientId)
      .eq('data_source', 'google_ads_api')
      .gte('date', dateRange.start)
      .lte('date', dateRange.end)
      .order('date', { ascending: true });
      
    if (error || !dailyRecords || dailyRecords.length === 0) {
      console.log('⚠️ No daily_kpi_data available for Google Ads');
      return { success: false };
    }
    
    console.log(`✅ Found ${dailyRecords.length} Google Ads daily records, aggregating...`);
    console.log(`🔍 DEBUG: Data sources in Google records:`, dailyRecords.map(r => r.data_source));
    console.log(`🔍 DEBUG: Sample Google reservation values:`, dailyRecords.slice(0, 3).map(r => ({ date: r.date, reservation_value: r.reservation_value, data_source: r.data_source })));
    
    // Aggregate daily records
    const aggregated = dailyRecords.reduce((acc, record) => {
      acc.totalSpend += record.total_spend || 0;
      acc.totalImpressions += record.total_impressions || 0;
      acc.totalClicks += record.total_clicks || 0;
      acc.totalConversions += record.total_conversions || 0;
      acc.click_to_call += record.click_to_call || 0;
      acc.email_contacts += record.email_contacts || 0;
      acc.booking_step_1 += record.booking_step_1 || 0;
      acc.booking_step_2 += record.booking_step_2 || 0;
      acc.booking_step_3 += (record as any).booking_step_3 || 0;
      acc.reservations += (record as any).reservations || 0;
      acc.reservation_value += (record as any).reservation_value || 0;
      acc.reach += (record as any).reach || 0;
      return acc;
    }, {
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

    const averageCtr = aggregated.totalImpressions > 0 ? (aggregated.totalClicks / aggregated.totalImpressions) * 100 : 0;
    const averageCpc = aggregated.totalClicks > 0 ? aggregated.totalSpend / aggregated.totalClicks : 0;
    const roas = aggregated.totalSpend > 0 ? (aggregated.reservation_value / aggregated.totalSpend) * 100 : 0;
    const cost_per_reservation = aggregated.reservations > 0 ? aggregated.totalSpend / aggregated.reservations : 0;

    return {
      success: true,
      data: {
        stats: {
          totalSpend: aggregated.totalSpend,
          totalImpressions: aggregated.totalImpressions,
          totalClicks: aggregated.totalClicks,
          totalConversions: aggregated.totalConversions,
          averageCtr,
          averageCpc
        },
        conversionMetrics: {
          click_to_call: aggregated.click_to_call,
          email_contacts: aggregated.email_contacts,
          booking_step_1: aggregated.booking_step_1,
          booking_step_2: aggregated.booking_step_2,
          booking_step_3: aggregated.booking_step_3,
          reservations: aggregated.reservations,
          reservation_value: aggregated.reservation_value,
          roas,
          cost_per_reservation,
          reach: aggregated.reach
        },
        campaigns: [] // Daily KPI data doesn't include campaign details
      }
    };
  }

  /**
   * PRIORITY 2: Fetch from Google Ads smart cache
   */
  private static async fetchFromGoogleAdsSmartCache(
    clientId: string
  ): Promise<Partial<GoogleAdsStandardizedDataResult>> {
    
    try {
      console.log('🚀 Using Google Ads smart cache API (3-hour refresh)...');
      
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const fullUrl = `${baseUrl}/api/google-ads-smart-cache`;
      
      const requestBody = {
        clientId,
        forceRefresh: false
      };
      
      // 🔓 AUTH DISABLED: No authentication headers needed
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      const response = await fetch(fullUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        console.log(`⚠️ Google Ads smart cache API call failed: ${response.status} ${response.statusText}`);
        return { success: false };
      }
      
      const result = await response.json();
      
      if (result.success && result.data && result.data.stats) {
        console.log('✅ Google Ads smart cache API returned data');
        
        return {
          success: true,
          data: {
            stats: result.data.stats,
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
          }
        };
      }
      
      console.log('⚠️ Google Ads smart cache API returned no data');
      return { success: false };
      
    } catch (error) {
      console.log('❌ Google Ads smart cache API error:', error);
      return { success: false };
    }
  }

  /**
   * PRIORITY 3: Fetch from database summaries (historical data)
   */
  private static async fetchFromDatabaseSummaries(
    clientId: string,
    dateRange: { start: string; end: string }
  ): Promise<Partial<GoogleAdsStandardizedDataResult>> {
    
    const { data: summaries, error } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', clientId)
      .eq('platform', 'google')
      .gte('summary_date', dateRange.start)
      .lte('summary_date', dateRange.end)
      .order('summary_date', { ascending: true });
      
    if (error || !summaries || summaries.length === 0) {
      console.log('⚠️ No Google Ads database summaries available');
      return { success: false };
    }
    
    console.log(`✅ Found ${summaries.length} Google Ads database summaries, aggregating...`);
    
    // Aggregate summaries
    const aggregated = summaries.reduce((acc, summary) => {
      acc.totalSpend += summary.total_spend || 0;
      acc.totalImpressions += summary.total_impressions || 0;
      acc.totalClicks += summary.total_clicks || 0;
      acc.totalConversions += summary.total_conversions || 0;
      acc.click_to_call += (summary as any).click_to_call || 0;
      acc.email_contacts += (summary as any).email_contacts || 0;
      acc.booking_step_1 += (summary as any).booking_step_1 || 0;
      acc.booking_step_2 += (summary as any).booking_step_2 || 0;
      acc.booking_step_3 += (summary as any).booking_step_3 || 0;
      acc.reservations += (summary as any).reservations || 0;
      acc.reservation_value += (summary as any).reservation_value || 0;
      return acc;
    }, {
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
      reservation_value: 0
    });

    const averageCtr = aggregated.totalImpressions > 0 ? (aggregated.totalClicks / aggregated.totalImpressions) * 100 : 0;
    const averageCpc = aggregated.totalClicks > 0 ? aggregated.totalSpend / aggregated.totalClicks : 0;
    const roas = aggregated.totalSpend > 0 ? (aggregated.reservation_value / aggregated.totalSpend) * 100 : 0;
    const cost_per_reservation = aggregated.reservations > 0 ? aggregated.totalSpend / aggregated.reservations : 0;

    return {
      success: true,
      data: {
        stats: {
          totalSpend: aggregated.totalSpend,
          totalImpressions: aggregated.totalImpressions,
          totalClicks: aggregated.totalClicks,
          totalConversions: aggregated.totalConversions,
          averageCtr,
          averageCpc
        },
        conversionMetrics: {
          click_to_call: aggregated.click_to_call,
          email_contacts: aggregated.email_contacts,
          booking_step_1: aggregated.booking_step_1,
          booking_step_2: aggregated.booking_step_2,
          booking_step_3: aggregated.booking_step_3,
          reservations: aggregated.reservations,
          reservation_value: aggregated.reservation_value,
          roas,
          cost_per_reservation,
          reach: 0 // Database summaries don't track reach
        },
        campaigns: [] // Database summaries don't include campaign details
      }
    };
  }

  /**
   * PRIORITY 4: Fetch from live Google Ads API (fallback)
   */
  private static async fetchFromLiveGoogleAdsAPI(
    clientId: string,
    dateRange: { start: string; end: string },
    sessionToken?: string
  ): Promise<Partial<GoogleAdsStandardizedDataResult>> {
    
    try {
      console.log('🚀 Using live Google Ads API as fallback...');
      
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const fullUrl = `${baseUrl}/api/fetch-google-ads-live-data`;
      
      const requestBody = {
        dateRange,
        clientId,
        platform: 'google',
        forceFresh: true, // Always force fresh for fallback
        reason: 'google-ads-standardized-fallback'
      };
      
      // 🔓 AUTH DISABLED: No authentication headers needed
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      console.log('🔓 Authentication disabled for Google Ads live API calls');
      
      const response = await fetch(fullUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        console.log(`⚠️ Google Ads live API call failed: ${response.status} ${response.statusText}`);
        return { success: false };
      }
      
      const result = await response.json();
      
      if (result.success && result.data) {
        console.log('✅ Google Ads live API returned data');
        
        return {
          success: true,
          data: {
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
          }
        };
      }
      
      console.log('⚠️ Google Ads live API returned no data');
      return { success: false };
      
    } catch (error) {
      console.log('❌ Google Ads live API error:', error);
      return { success: false };
    }
  }

  /**
   * Return zero data structure for failed requests
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
