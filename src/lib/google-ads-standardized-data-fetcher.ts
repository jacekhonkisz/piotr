/**
 * GOOGLE ADS STANDARDIZED DATA FETCHER
 * 
 * ✅ FIXED: Now matches Meta system architecture
 * Separate system for Google Ads data fetching that mirrors the Meta system
 * but is completely independent. Uses the same smart caching and historical
 * data approach as Meta but with Google Ads specific infrastructure.
 * 
 * PRIORITY ORDER (MATCHES META):
 * 
 * FOR CURRENT PERIOD:
 * 1. Google Ads smart cache (3-hour refresh, instant < 500ms)
 * 2. Live Google Ads API call (fallback)
 * 
 * FOR HISTORICAL PERIOD:
 * 1. campaign_summaries (platform='google', instant < 50ms)
 * 2. Live Google Ads API call (fallback, can fetch historical)
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
      conversion_value: number;
      total_conversion_value: number;
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
    forceRefresh?: boolean; // ✅ NEW: Allow bypassing cache
  }): Promise<GoogleAdsStandardizedDataResult> {
    
    const { clientId, dateRange, reason = 'google-ads-standardized-fetch', sessionToken, forceRefresh = false } = params;
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
    
    // ✅ CRITICAL FIX: Match Meta logic - only current period uses cache
    // Removed isRecentPeriod check to prevent using stale cache for past months
    const needsLiveData = isCurrentPeriod;
    
    console.log('🎯 GOOGLE ADS PERIOD CLASSIFICATION:', {
      isCurrentPeriod,
      needsLiveData,
      dateRange,
      reason,
      note: 'Now matches Meta logic - only current period uses cache'
    });

    const dataSources: string[] = [];

    try {
      // ✅ FIXED Priority 1: Smart cache for CURRENT periods (matches Meta system)
      // ✅ NEW: Skip cache if forceRefresh is true
      if (needsLiveData && !forceRefresh) {
        console.log('1️⃣ CURRENT PERIOD: Checking Google Ads smart cache...');
        dataSources.push('google_ads_smart_cache');
        
        const cacheResult = await this.fetchFromGoogleAdsSmartCache(clientId);
        if (cacheResult.success) {
          const responseTime = Date.now() - startTime;
          
          console.log(`✅ SUCCESS: Google Ads smart cache returned data in ${responseTime}ms`);
          console.log('📊 Smart cache data:', {
            totalSpend: cacheResult.data?.stats?.totalSpend,
            campaigns: cacheResult.data?.campaigns?.length || 0
          });
          
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
              expectedSource: 'google_ads_smart_cache',
              isConsistent: true
            }
          };
        } else {
          console.log('⚠️ Smart cache failed for current period, falling back to live API...');
        }
      }

      // ✅ FIXED Priority 2: Database summaries for HISTORICAL periods (matches Meta system)
      if (!needsLiveData) {
        console.log('2️⃣ HISTORICAL PERIOD: Checking campaign_summaries (platform=google)...');
        dataSources.push('campaign_summaries_google');
        
        const dbResult = await this.fetchFromDatabaseSummaries(clientId, dateRange);
        if (dbResult.success) {
          // ✅ Check if we have any meaningful data
          const hasAnyData = dbResult.data!.stats && 
            (dbResult.data!.stats.totalSpend > 0 || 
             dbResult.data!.stats.totalImpressions > 0 ||
             dbResult.data!.stats.totalClicks > 0 ||
             (dbResult.data!.campaigns && dbResult.data!.campaigns.length > 0));
          
          if (hasAnyData) {
            const responseTime = Date.now() - startTime;
            
            console.log(`✅ SUCCESS: campaign_summaries returned Google Ads data in ${responseTime}ms`);
            console.log('📊 Historical data:', {
              totalSpend: dbResult.data!.stats.totalSpend,
              campaigns: dbResult.data!.campaigns?.length || 0
            });
            
            return {
              success: true,
              data: dbResult.data!,
              debug: {
                source: 'campaign-summaries-database',
                cachePolicy: 'database-first-historical',
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
            console.log('⚠️ campaign_summaries has no data, trying live API...');
          }
        } else {
          console.log('⚠️ No database summaries found for historical period, trying live API...');
        }
      }

      // ✅ Priority 3: Live Google Ads API call (fallback for both current and historical)
      console.log('3️⃣ Trying live Google Ads API as fallback...');
      dataSources.push('google_ads_live_api');
      
      const liveResult = await this.fetchFromLiveGoogleAdsAPI(clientId, dateRange, sessionToken);
      if (liveResult.success) {
        const responseTime = Date.now() - startTime;
        
        console.log(`✅ SUCCESS: Live Google Ads API returned data in ${responseTime}ms`);
        console.log('📊 Live API data:', {
          totalSpend: liveResult.data?.stats?.totalSpend,
          campaigns: liveResult.data?.campaigns?.length || 0
        });
        
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
            expectedSource: needsLiveData ? 'google_ads_smart_cache' : 'campaign_summaries',
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
          dataSourcePriority: dataSources,
          periodType: isCurrentPeriod ? 'current' : 'historical'
        },
        validation: {
          actualSource: 'error',
          expectedSource: needsLiveData ? 'google_ads_smart_cache' : 'campaign_summaries',
          isConsistent: false
        }
      };
    }
  }
  
  // ✅ REMOVED: daily_kpi_data is NOT used for Google Ads
  // Google Ads uses smart cache (current) or campaign_summaries (historical)

  /**
   * Fetch from Google Ads smart cache (current periods)
   */
  private static async fetchFromGoogleAdsSmartCache(
    clientId: string
  ): Promise<Partial<GoogleAdsStandardizedDataResult>> {
    
    try {
      console.log('🚀 Using Google Ads smart cache API (3-hour refresh)...');
      
      // Use relative URL for same-origin requests
      const fullUrl = '/api/google-ads-smart-cache';
      
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
              conversion_value: 0,
              total_conversion_value: 0,
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
   * Fetch from campaign_summaries (historical periods, platform='google')
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
    
    // Extract campaigns from campaign_data JSONB field
    const allCampaigns: any[] = [];
    summaries.forEach(summary => {
      if (summary.campaign_data && Array.isArray(summary.campaign_data)) {
        console.log(`📊 Extracting ${summary.campaign_data.length} campaigns from summary ${summary.summary_date}`);
        // Log first campaign to debug
        if (summary.campaign_data.length > 0) {
          const firstCampaign = summary.campaign_data[0];
          console.log(`   First campaign keys: ${Object.keys(firstCampaign).join(', ')}`);
          console.log(`   Campaign name fields: campaignName="${firstCampaign.campaignName}", campaign_name="${firstCampaign.campaign_name}", name="${firstCampaign.name}"`);
        }
        allCampaigns.push(...summary.campaign_data);
      }
    });
    
    console.log(`📊 Total extracted ${allCampaigns.length} campaigns from campaign_data JSONB`);
    if (allCampaigns.length > 0) {
      console.log(`📊 Sample campaign from extracted data:`, {
        campaignName: allCampaigns[0].campaignName,
        campaign_name: allCampaigns[0].campaign_name,
        name: allCampaigns[0].name,
        allKeys: Object.keys(allCampaigns[0])
      });
    }
    
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
          // ✅ FIX: Add conversion_value and total_conversion_value (both = reservation_value for Google Ads)
          // reservation_value contains "Wartość konwersji" which includes all conversion values
          conversion_value: aggregated.reservation_value,
          total_conversion_value: aggregated.reservation_value, // This is what UI displays as "łączna wartość rezerwacji"
          roas,
          cost_per_reservation,
          reach: 0 // Database summaries don't track reach
        },
        campaigns: allCampaigns // ✅ FIXED: Extract campaigns from campaign_data JSONB
      }
    };
  }

  /**
   * Fetch from live Google Ads API (fallback for both current and historical)
   */
  private static async fetchFromLiveGoogleAdsAPI(
    clientId: string,
    dateRange: { start: string; end: string },
    sessionToken?: string
  ): Promise<Partial<GoogleAdsStandardizedDataResult>> {
    
    try {
      console.log('🚀 Using live Google Ads API as fallback...');
      
      // Use relative URL for same-origin requests
      const fullUrl = '/api/fetch-google-ads-live-data';
      
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
              conversion_value: 0,
              total_conversion_value: 0,
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
        conversion_value: 0,
        total_conversion_value: 0,
        roas: 0,
        cost_per_reservation: 0,
        reach: 0
      },
      campaigns: []
    };
  }
}
