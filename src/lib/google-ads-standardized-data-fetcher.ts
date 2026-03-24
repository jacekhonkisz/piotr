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
    
    // ✅ FIX: Detect if this is a weekly request (7 days or less)
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const isWeeklyRequest = daysDiff <= 7;
    
    // ✅ FIX: Check if current WEEK (not just current month)
    let isCurrentPeriod = false;
    if (isWeeklyRequest) {
      // For weekly: Check if endDate >= today (includes current week)
      isCurrentPeriod = dateRange.end >= today;
    } else {
      // For monthly: Check if it's current month
      isCurrentPeriod = startYear === currentYear && startMonth === currentMonth;
    }
    
    // ✅ CRITICAL FIX: Match Meta logic - only current period uses cache
    // Removed isRecentPeriod check to prevent using stale cache for past months
    const needsLiveData = isCurrentPeriod;
    
    console.log('🎯 GOOGLE ADS PERIOD CLASSIFICATION:', {
      isWeeklyRequest,
      isCurrentPeriod,
      needsLiveData,
      daysDiff,
      dateRange,
      reason,
      note: isWeeklyRequest 
        ? 'Weekly request - will use weekly cache if current week'
        : 'Monthly request - will use monthly cache if current month'
    });

    const dataSources: string[] = [];

    try {
      // ✅ FIXED Priority 1: Smart cache for CURRENT periods (matches Meta system)
      // ✅ NEW: Skip cache if forceRefresh is true
      // ✅ FIX: Use weekly cache for weekly requests, monthly cache for monthly requests
      if (needsLiveData && !forceRefresh) {
        if (isWeeklyRequest) {
          console.log('1️⃣ CURRENT WEEK: Checking Google Ads weekly smart cache...');
          dataSources.push('google_ads_weekly_smart_cache');
          
          // Use weekly smart cache
          if (typeof window === 'undefined') {
            // Server-side: Use weekly cache directly
            const { getGoogleAdsSmartWeekCacheData } = await import('./google-ads-smart-cache-helper');
            const { getCurrentWeekInfo } = await import('./week-helpers');
            const currentWeek = getCurrentWeekInfo();
            
            const cacheResult = await getGoogleAdsSmartWeekCacheData(clientId, false, currentWeek.periodId);
            if (cacheResult.success && cacheResult.data) {
              const responseTime = Date.now() - startTime;
              
              console.log(`✅ SUCCESS: Google Ads weekly smart cache returned data in ${responseTime}ms`);
              console.log('📊 Weekly smart cache data:', {
                totalSpend: cacheResult.data?.stats?.totalSpend,
                campaigns: cacheResult.data?.campaigns?.length || 0
              });
              
              return {
                success: true,
                data: cacheResult.data,
                debug: {
                  source: 'google-ads-weekly-smart-cache',
                  cachePolicy: 'smart-cache-3h-refresh',
                  responseTime,
                  reason,
                  dataSourcePriority: dataSources,
                  periodType: 'current-week'
                },
                validation: {
                  actualSource: 'google_ads_weekly_smart_cache',
                  expectedSource: 'google_ads_weekly_smart_cache',
                  isConsistent: true
                }
              };
            } else {
              console.log('⚠️ Weekly smart cache failed for current week, falling back to live API...');
            }
          } else {
            // ✅ FIX: Client-side - Call API endpoint which handles weekly cache server-side
            // DO NOT fall through to monthly cache!
            console.log('🌐 Client-side: Redirecting weekly request to API endpoint (handles weekly cache server-side)');
            const { createClient } = await import('@supabase/supabase-js');
            const supabase = createClient(
              process.env.NEXT_PUBLIC_SUPABASE_URL!,
              process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            );
            const { data: { session: clientSession } } = await supabase.auth.getSession();
            
            const response = await fetch('/api/fetch-google-ads-live-data', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${clientSession?.access_token || ''}`
              },
              body: JSON.stringify({
                clientId,
                dateRange,
                reason: reason || 'google-ads-weekly-smart-cache-client'
              })
            });
            
            if (!response.ok) {
              throw new Error(`Google Ads API call failed: ${response.status}`);
            }
            
            const apiResult = await response.json();
            if (apiResult.success && apiResult.data) {
              const responseTime = Date.now() - startTime;
              
              console.log(`✅ SUCCESS: Google Ads weekly API returned data in ${responseTime}ms`);
              console.log('📊 Weekly API data:', {
                totalSpend: apiResult.data?.stats?.totalSpend,
                campaigns: apiResult.data?.campaigns?.length || 0,
                source: apiResult.source
              });
              
              return {
                success: true,
                data: apiResult.data,
                debug: {
                  source: apiResult.source || 'google-ads-weekly-api',
                  cachePolicy: 'smart-cache-3h-refresh',
                  responseTime,
                  reason,
                  dataSourcePriority: dataSources,
                  periodType: 'current-week'
                },
                validation: {
                  actualSource: apiResult.source || 'google_ads_weekly_api',
                  expectedSource: 'google_ads_weekly_smart_cache',
                  isConsistent: true
                }
              };
            } else {
              console.log('⚠️ Weekly API call failed, will fall through to live API...');
            }
          }
        } else {
          console.log('1️⃣ CURRENT MONTH: Checking Google Ads monthly smart cache...');
          dataSources.push('google_ads_smart_cache');
          
          const cacheResult = await this.fetchFromGoogleAdsSmartCache(clientId);
          if (cacheResult.success) {
            const responseTime = Date.now() - startTime;
            
            console.log(`✅ SUCCESS: Google Ads monthly smart cache returned data in ${responseTime}ms`);
            console.log('📊 Monthly smart cache data:', {
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
                periodType: 'current-month'
              },
              validation: {
                actualSource: 'google_ads_smart_cache',
                expectedSource: 'google_ads_smart_cache',
                isConsistent: true
              }
            };
          } else {
            console.log('⚠️ Monthly smart cache failed for current period, falling back to live API...');
          }
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
            // ✅ FIX: For historical periods, if database has no data, return error instead of calling API
            console.log('⚠️ campaign_summaries has no data for historical period');
            console.log('📚 Historical data must be collected via background collector first');
            
            return {
              success: false,
              error: `No historical data available for ${dateRange.start} to ${dateRange.end}. Please run weekly data collection first.`,
              debug: {
                source: 'campaign-summaries-database',
                cachePolicy: 'database-first-historical',
                responseTime: Date.now() - startTime,
                reason,
                dataSourcePriority: dataSources,
                periodType: 'historical',
                note: 'Historical data should be collected via background collector'
              }
            };
          }
          } else {
            // ✅ FIX: For historical periods, if database has no data, return error instead of calling API
            // Historical data should be collected via background collector, not live API
            console.log('⚠️ No database summaries found for historical period');
            console.log('📚 Historical data must be collected via background collector first');
            
            return {
              success: false,
              error: `No historical data available for ${dateRange.start} to ${dateRange.end}. Please run weekly data collection first.`,
              debug: {
                source: 'campaign-summaries-database',
                cachePolicy: 'database-first-historical',
                responseTime: Date.now() - startTime,
                reason,
                dataSourcePriority: dataSources,
                periodType: 'historical',
                note: 'Historical data should be collected via background collector'
              }
            };
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
      console.log('🚀 Using Google Ads smart cache (3-hour refresh)...');
      
      if (typeof window === 'undefined') {
        // Server-side: call the cache helper directly (no HTTP)
        const { getGoogleAdsSmartCacheData } = await import('./google-ads-smart-cache-helper');
        const cacheResult = await getGoogleAdsSmartCacheData(clientId, false);
        
        if (cacheResult.success && cacheResult.data) {
          console.log('✅ Google Ads monthly smart cache returned data (direct)');
          return {
            success: true,
            data: cacheResult.data
          };
        }
        console.log('⚠️ Google Ads monthly smart cache returned no data (direct)');
        return { success: false };
      }
      
      // Client-side: use HTTP API
      const { createClient } = await import('@supabase/supabase-js');
      const clientSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data: { session } } = await clientSupabase.auth.getSession();
      
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      
      const response = await fetch('/api/google-ads-smart-cache', {
        method: 'POST',
        headers,
        body: JSON.stringify({ clientId, forceRefresh: false })
      });
      
      if (!response.ok) {
        console.log(`⚠️ Google Ads smart cache API call failed: ${response.status}`);
        return { success: false };
      }
      
      const result = await response.json();
      
      if (result.success && result.data?.stats) {
        console.log('✅ Google Ads smart cache API returned data');
        return {
          success: true,
          data: {
            stats: result.data.stats,
            conversionMetrics: result.data.conversionMetrics || {
              click_to_call: 0, email_contacts: 0, booking_step_1: 0, booking_step_2: 0,
              booking_step_3: 0, reservations: 0, reservation_value: 0, conversion_value: 0,
              total_conversion_value: 0, roas: 0, cost_per_reservation: 0, reach: 0
            },
            campaigns: result.data.campaigns || []
          }
        };
      }
      
      console.log('⚠️ Google Ads smart cache API returned no data');
      return { success: false };
      
    } catch (error) {
      console.log('❌ Google Ads smart cache error:', error);
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
    
    // ✅ FIX: Detect if this is a weekly request (7 days or less)
    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const isWeeklyRequest = daysDiff <= 7;
    
    let summaries;
    let error;
    
    if (isWeeklyRequest) {
      // ✅ FIX: For weekly requests, use exact Monday matching (same as other fetchers)
      const { getMondayOfWeek, formatDateISO } = await import('./week-helpers');
      const weekMonday = getMondayOfWeek(startDate);
      const weekMondayStr = formatDateISO(weekMonday);
      
      console.log(`📅 Searching for weekly Google Ads data:`, {
        requestedRange: `${dateRange.start} to ${dateRange.end}`,
        calculatedMonday: weekMondayStr,
        note: 'Weekly data is stored with summary_date = Monday (ISO 8601)'
      });
      
      const { data: weeklyResults, error: weeklyError } = await supabase
        .from('campaign_summaries')
        .select('*')
        .eq('client_id', clientId)
        .eq('platform', 'google')
        .eq('summary_type', 'weekly')
        .eq('summary_date', weekMondayStr)  // ✅ EXACT MATCH on Monday
        .limit(1);
      
      summaries = weeklyResults;
      error = weeklyError;
      
      if (summaries && summaries.length > 0) {
        console.log(`✅ Found weekly Google Ads data for week starting ${weekMondayStr}`);
      } else {
        console.log(`⚠️ No weekly Google Ads data found for week starting ${weekMondayStr}`);
      }
    } else {
      // For monthly requests, use date range query
      const { data: monthlyResults, error: monthlyError } = await supabase
        .from('campaign_summaries')
        .select('*')
        .eq('client_id', clientId)
        .eq('platform', 'google')
        .eq('summary_type', 'monthly')
        .gte('summary_date', dateRange.start)
        .lte('summary_date', dateRange.end)
        .order('summary_date', { ascending: true });
      
      summaries = monthlyResults;
      error = monthlyError;
    }
      
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
      acc.total_conversion_value += (summary as any).total_conversion_value || 0;
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
      total_conversion_value: 0
    });
    
    // ✅ FIX: Also aggregate total_conversion_value from campaigns if available
    // This ensures we get "Wartość konwersji" (all_conversions_value) from Google Ads
    if (allCampaigns.length > 0) {
      const campaignsTotalConversionValue = allCampaigns.reduce((sum, campaign: any) => {
        return sum + (campaign.total_conversion_value || 0);
      }, 0);
      
      // Use campaigns' total_conversion_value if it's greater than summary value
      // (campaigns have the most accurate data from API)
      if (campaignsTotalConversionValue > aggregated.total_conversion_value) {
        aggregated.total_conversion_value = campaignsTotalConversionValue;
      }
    }

    const averageCtr = aggregated.totalImpressions > 0 ? (aggregated.totalClicks / aggregated.totalImpressions) * 100 : 0;
    const averageCpc = aggregated.totalClicks > 0 ? aggregated.totalSpend / aggregated.totalClicks : 0;
    // ✅ FIX: Use total_conversion_value (wartość konwersji) for ROAS calculation
    const totalValueForROAS = aggregated.total_conversion_value || aggregated.reservation_value;
    const roas = aggregated.totalSpend > 0 ? (totalValueForROAS / aggregated.totalSpend) : 0;
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
          // ✅ FIX: Use total_conversion_value from campaigns (all_conversions_value from Google Ads)
          // This is "Wartość konwersji" from Google Ads console - used for "łączna wartość rezerwacji"
          conversion_value: aggregated.total_conversion_value || aggregated.reservation_value,
          total_conversion_value: aggregated.total_conversion_value || aggregated.reservation_value, // This is what UI displays as "łączna wartość rezerwacji"
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
      
      const fullUrl = '/api/fetch-google-ads-live-data';
      
      const requestBody = {
        dateRange,
        clientId,
        platform: 'google',
        forceFresh: true,
        reason: 'google-ads-standardized-fallback'
      };
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      } else if (typeof window !== 'undefined') {
        const { createClient } = await import('@supabase/supabase-js');
        const clientSupabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const { data: { session } } = await clientSupabase.auth.getSession();
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }
      }
      
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
