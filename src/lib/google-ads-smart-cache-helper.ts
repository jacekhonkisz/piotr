import { createClient } from '@supabase/supabase-js';
import { GoogleAdsAPIService } from './google-ads-api';
import logger from './logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Cache duration: 3 hours (same as Meta)
const CACHE_DURATION_HOURS = 3;

// Helper function to get current month info (using standardized date-range-utils)
export function getCurrentMonthInfo() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  
  // Use standardized month boundaries calculation
  const { getMonthBoundaries } = require('./date-range-utils');
  const monthBoundaries = getMonthBoundaries(year, month);
  
  return {
    year,
    month,
    startDate: monthBoundaries.start,
    endDate: monthBoundaries.end,
    periodId: `${year}-${String(month).padStart(2, '0')}`
  };
}

// Helper function to get current week info (using standardized week-utils implementation)
export function getCurrentWeekInfo() {
  // Import and use the standardized week calculation from week-utils
  const { getCurrentWeekInfo: getStandardizedWeekInfo } = require('./week-utils');
  return getStandardizedWeekInfo();
}

// Check if cache is fresh (same logic as Meta)
function isCacheFresh(lastUpdated: string): boolean {
  const cacheTime = new Date(lastUpdated).getTime();
  const now = new Date().getTime();
  const ageHours = (now - cacheTime) / (1000 * 60 * 60);
  
  return ageHours < CACHE_DURATION_HOURS;
}

// Function to fetch fresh Google Ads data (equivalent to Meta's fetchFreshCurrentMonthData)
export async function fetchFreshGoogleAdsCurrentMonthData(client: any) {
  logger.info('🔄 Fetching fresh current month Google Ads data...');
  
  const currentMonth = getCurrentMonthInfo();
  
  // Get Google Ads system settings (including manager refresh token)
  const { data: settingsData, error: settingsError } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', ['google_ads_client_id', 'google_ads_client_secret', 'google_ads_developer_token', 'google_ads_manager_refresh_token', 'google_ads_manager_customer_id']);

  if (settingsError || !settingsData) {
    throw new Error('Google Ads system configuration not found');
  }

  const settings = settingsData.reduce((acc, setting) => {
    acc[setting.key] = setting.value;
    return acc;
  }, {} as Record<string, any>);

  // Use the same token priority logic as the main API route
  let refreshToken = null;
  if (settings.google_ads_manager_refresh_token) {
    refreshToken = settings.google_ads_manager_refresh_token;
  } else if (client.google_ads_refresh_token) {
    refreshToken = client.google_ads_refresh_token;
  }

  if (!refreshToken) {
    throw new Error('Google Ads refresh token not found. Please configure Google Ads authentication.');
  }

  const googleAdsCredentials = {
    refreshToken,
    clientId: settings.google_ads_client_id,
    clientSecret: settings.google_ads_client_secret,
    developmentToken: settings.google_ads_developer_token,
    customerId: client.google_ads_customer_id!,
    managerCustomerId: settings.google_ads_manager_customer_id,
  };

  // Initialize Google Ads API service
  const googleAdsService = new GoogleAdsAPIService(googleAdsCredentials);

  // Validate credentials first
  const validation = await googleAdsService.validateCredentials();
  if (!validation.valid) {
    throw new Error(`Google Ads credentials invalid: ${validation.error}`);
  }

  try {
    // Fetch campaign data
    const campaignData = await googleAdsService.getCampaignData(
      currentMonth.startDate!,
      currentMonth.endDate!
    );

    logger.info(`✅ Fetched ${campaignData.length} Google Ads campaigns for caching`);

    // Calculate stats from Google Ads API (matching Meta structure)
    const totalSpend = campaignData.reduce((sum, campaign) => sum + (campaign.spend || 0), 0);
    const totalImpressions = campaignData.reduce((sum, campaign) => sum + (campaign.impressions || 0), 0);
    const totalClicks = campaignData.reduce((sum, campaign) => sum + (campaign.clicks || 0), 0);
    const totalConversions = campaignData.reduce((sum, campaign) => sum + (campaign.conversions || 0), 0);
    const averageCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const averageCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;

    // 🔧 FIX: Aggregate conversion metrics FROM the campaign data we just fetched
    // NOT from daily_kpi_data (which is mainly for Meta data)
    // The getCampaignData() function already parses Google Ads conversion actions
    logger.info('📊 Aggregating conversion metrics from Google Ads API campaign data...');
    
    // ✅ UNIFIED: Use same field names as Meta for consistency
    const realConversionMetrics = campaignData.reduce((acc, campaign: any) => {
      acc.click_to_call += campaign.click_to_call || 0;
      acc.email_contacts += campaign.email_contacts || campaign.form_submissions || 0;
      acc.form_submissions += campaign.form_submissions || 0;
      acc.phone_calls += campaign.phone_calls || 0;
      acc.email_clicks += campaign.email_clicks || 0;
      acc.phone_clicks += campaign.phone_clicks || 0;
      acc.booking_step_1 += campaign.booking_step_1 || 0;
      acc.booking_step_2 += campaign.booking_step_2 || 0;
      acc.booking_step_3 += campaign.booking_step_3 || 0;
      acc.reservations += campaign.reservations || 0;
      acc.reservation_value += campaign.reservation_value || 0;
      acc.total_conversion_value += campaign.total_conversion_value || 0;
      return acc;
    }, {
      click_to_call: 0,
      email_contacts: 0,
      form_submissions: 0,
      phone_calls: 0,
      email_clicks: 0,
      phone_clicks: 0,
      booking_step_1: 0,
      booking_step_2: 0,
      booking_step_3: 0,
      reservations: 0,
      reservation_value: 0,
      total_conversion_value: 0
    });
    
    logger.info('📊 Aggregated conversion metrics from Google Ads API:', {
      booking_step_1: realConversionMetrics.booking_step_1,
      booking_step_2: realConversionMetrics.booking_step_2,
      booking_step_3: realConversionMetrics.booking_step_3,
      reservations: realConversionMetrics.reservations,
      reservation_value: realConversionMetrics.reservation_value,
      total_conversion_value: realConversionMetrics.total_conversion_value
    });

    // Fetch Google Ads tables data for current month cache
    let googleAdsTables = null;
    try {
      logger.info('📊 Fetching Google Ads tables data for current month cache...');
      
      const [networkData, qualityData, deviceData, keywordData] = await Promise.all([
        googleAdsService.getNetworkPerformance(currentMonth.startDate!, currentMonth.endDate!),
        googleAdsService.getQualityScoreMetrics(currentMonth.startDate!, currentMonth.endDate!),
        googleAdsService.getDevicePerformance(currentMonth.startDate!, currentMonth.endDate!),
        googleAdsService.getKeywordPerformance(currentMonth.startDate!, currentMonth.endDate!)
      ]);
      
      googleAdsTables = {
        networkPerformance: networkData,
        qualityMetrics: qualityData, // Fixed: use qualityMetrics instead of qualityScoreMetrics
        devicePerformance: deviceData,
        keywordPerformance: keywordData
      };
      
      logger.info('✅ Google Ads tables data fetched for current month cache');
    } catch (tablesError) {
      logger.warn('⚠️ Failed to fetch Google Ads tables for current month cache:', tablesError);
      googleAdsTables = null; // Will fallback to live API calls
    }

    const cacheData = {
      client: {
        id: client.id,
        name: client.name,
        customerId: client.google_ads_customer_id
      },
      campaigns: campaignData,
      stats: {
        totalSpend,
        totalImpressions,
        totalClicks,
        totalConversions,
        averageCtr,
        averageCpc
      },
      conversionMetrics: realConversionMetrics,
      googleAdsTables, // Include Google Ads tables in current month cache
      fetchedAt: new Date().toISOString(),
      fromCache: false,
      cacheAge: 0
    };

    // CRITICAL FIX: Save campaign data to google_ads_campaigns table for PDF generation
    try {
      logger.info('💾 Saving Google Ads campaigns to database for PDF generation...');
      
      // Prepare campaign data for database insertion
      // 🔧 FIX: Use each campaign's INDIVIDUAL conversion data, not aggregated totals
      const campaignsToInsert = campaignData.map((campaign: any) => ({
        client_id: client.id,
        campaign_id: campaign.campaignId,
        campaign_name: campaign.campaignName,
        status: campaign.status,
        date_range_start: currentMonth.startDate,
        date_range_end: currentMonth.endDate,
        spend: campaign.spend || 0,
        impressions: campaign.impressions || 0,
        clicks: campaign.clicks || 0,
        cpc: campaign.cpc || 0,
        ctr: campaign.ctr || 0,
        form_submissions: campaign.form_submissions || 0,
        phone_calls: campaign.phone_calls || 0,
        email_clicks: campaign.email_clicks || 0,
        phone_clicks: campaign.phone_clicks || 0,
        booking_step_1: campaign.booking_step_1 || 0,
        booking_step_2: campaign.booking_step_2 || 0,
        booking_step_3: campaign.booking_step_3 || 0,
        reservations: campaign.reservations || 0,
        reservation_value: campaign.reservation_value || 0,
        total_conversion_value: campaign.total_conversion_value || 0,
        roas: campaign.roas || 0
      }));

      // Insert/update campaigns in google_ads_campaigns table
      const { error: campaignInsertError } = await supabase
        .from('google_ads_campaigns')
        .upsert(campaignsToInsert, {
          onConflict: 'client_id,campaign_id,date_range_start,date_range_end'
        });

      if (campaignInsertError) {
        logger.error('❌ Failed to save Google Ads campaigns to database:', campaignInsertError);
      } else {
        logger.info(`✅ Saved ${campaignsToInsert.length} Google Ads campaigns to database`);
      }
    } catch (dbError) {
      logger.error('❌ Database insertion error for Google Ads campaigns:', dbError);
    }

    // Cache the data for future requests
    try {
      const { error: cacheError } = await supabase
        .from('google_ads_current_month_cache')
        .upsert({
          client_id: client.id,
          period_id: currentMonth.periodId,
          cache_data: cacheData,
          last_updated: new Date().toISOString()
        }, {
          onConflict: 'client_id,period_id'
        });

      if (cacheError) {
        logger.warn('⚠️ Failed to cache Google Ads data:', cacheError);
      } else {
        logger.info('✅ Google Ads data cached successfully');
      }
    } catch (cacheError) {
      logger.warn('⚠️ Cache storage error:', cacheError);
    }

    return cacheData;

  } catch (error) {
    logger.error('❌ Failed to fetch fresh Google Ads data:', error);
    throw error;
  }
}

// Function to fetch fresh Google Ads weekly data
export async function fetchFreshGoogleAdsCurrentWeekData(client: any) {
  logger.info('🔄 Fetching fresh current week Google Ads data...');
  
  const currentWeek = getCurrentWeekInfo();
  
  // Get Google Ads system settings (including manager refresh token)
  const { data: settingsData, error: settingsError } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', ['google_ads_client_id', 'google_ads_client_secret', 'google_ads_developer_token', 'google_ads_manager_refresh_token', 'google_ads_manager_customer_id']);

  if (settingsError || !settingsData) {
    throw new Error('Google Ads system configuration not found');
  }

  const settings = settingsData.reduce((acc, setting) => {
    acc[setting.key] = setting.value;
    return acc;
  }, {} as Record<string, any>);

  // Use the same token priority logic as the main API route
  let refreshToken = null;
  if (settings.google_ads_manager_refresh_token) {
    refreshToken = settings.google_ads_manager_refresh_token;
  } else if (client.google_ads_refresh_token) {
    refreshToken = client.google_ads_refresh_token;
  }

  if (!refreshToken) {
    throw new Error('Google Ads refresh token not found. Please configure Google Ads authentication.');
  }

  const googleAdsCredentials = {
    refreshToken,
    clientId: settings.google_ads_client_id,
    clientSecret: settings.google_ads_client_secret,
    developmentToken: settings.google_ads_developer_token,
    customerId: client.google_ads_customer_id!,
    managerCustomerId: settings.google_ads_manager_customer_id,
  };

  // Initialize Google Ads API service
  const googleAdsService = new GoogleAdsAPIService(googleAdsCredentials);

  // Validate credentials first
  const validation = await googleAdsService.validateCredentials();
  if (!validation.valid) {
    throw new Error(`Google Ads credentials invalid: ${validation.error}`);
  }

  try {
    // Fetch campaign data for current week
    const campaignData = await googleAdsService.getCampaignData(
      currentWeek.startDate!,
      currentWeek.endDate!
    );

    logger.info(`✅ Fetched ${campaignData.length} Google Ads campaigns for weekly caching`);

    // Calculate weekly stats
    const totalSpend = campaignData.reduce((sum, campaign) => sum + (campaign.spend || 0), 0);
    const totalImpressions = campaignData.reduce((sum, campaign) => sum + (campaign.impressions || 0), 0);
    const totalClicks = campaignData.reduce((sum, campaign) => sum + (campaign.clicks || 0), 0);
    const totalConversions = campaignData.reduce((sum, campaign) => sum + (campaign.conversions || 0), 0);
    const averageCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const averageCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;

    // 🔧 FIX: Aggregate conversion metrics FROM the campaign data we just fetched
    // NOT from daily_kpi_data (which is mainly for Meta data)
    logger.info('📊 Aggregating weekly conversion metrics from Google Ads API campaign data...');
    
    // ✅ UNIFIED: Use same field names as Meta for consistency (weekly)
    const realConversionMetrics = campaignData.reduce((acc, campaign: any) => {
      acc.click_to_call += campaign.click_to_call || 0;
      acc.email_contacts += campaign.email_contacts || campaign.form_submissions || 0;
      acc.form_submissions += campaign.form_submissions || 0;
      acc.phone_calls += campaign.phone_calls || 0;
      acc.email_clicks += campaign.email_clicks || 0;
      acc.phone_clicks += campaign.phone_clicks || 0;
      acc.booking_step_1 += campaign.booking_step_1 || 0;
      acc.booking_step_2 += campaign.booking_step_2 || 0;
      acc.booking_step_3 += campaign.booking_step_3 || 0;
      acc.reservations += campaign.reservations || 0;
      acc.reservation_value += campaign.reservation_value || 0;
      acc.total_conversion_value += campaign.total_conversion_value || 0;
      return acc;
    }, {
      click_to_call: 0,
      email_contacts: 0,
      form_submissions: 0,
      phone_calls: 0,
      email_clicks: 0,
      phone_clicks: 0,
      booking_step_1: 0,
      booking_step_2: 0,
      booking_step_3: 0,
      reservations: 0,
      reservation_value: 0,
      total_conversion_value: 0
    });
    
    logger.info('📊 Aggregated weekly conversion metrics from Google Ads API:', {
      booking_step_1: realConversionMetrics.booking_step_1,
      booking_step_2: realConversionMetrics.booking_step_2,
      booking_step_3: realConversionMetrics.booking_step_3,
      reservations: realConversionMetrics.reservations
    });

    const cacheData = {
      client: {
        id: client.id,
        name: client.name,
        customerId: client.google_ads_customer_id
      },
      campaigns: campaignData,
      stats: {
        totalSpend,
        totalImpressions,
        totalClicks,
        totalConversions,
        averageCtr,
        averageCpc
      },
      conversionMetrics: realConversionMetrics,
      fetchedAt: new Date().toISOString(),
      fromCache: false,
      cacheAge: 0
    };

    // CRITICAL FIX: Save weekly campaign data to google_ads_campaigns table for PDF generation
    try {
      logger.info('💾 Saving weekly Google Ads campaigns to database for PDF generation...');
      
      // Prepare campaign data for database insertion
      // 🔧 FIX: Use each campaign's INDIVIDUAL conversion data, not aggregated totals
      const campaignsToInsert = campaignData.map((campaign: any) => ({
        client_id: client.id,
        campaign_id: campaign.campaignId,
        campaign_name: campaign.campaignName,
        status: campaign.status,
        date_range_start: currentWeek.startDate,
        date_range_end: currentWeek.endDate,
        spend: campaign.spend || 0,
        impressions: campaign.impressions || 0,
        clicks: campaign.clicks || 0,
        cpc: campaign.cpc || 0,
        ctr: campaign.ctr || 0,
        form_submissions: campaign.form_submissions || 0,
        phone_calls: campaign.phone_calls || 0,
        email_clicks: campaign.email_clicks || 0,
        phone_clicks: campaign.phone_clicks || 0,
        booking_step_1: campaign.booking_step_1 || 0,
        booking_step_2: campaign.booking_step_2 || 0,
        booking_step_3: campaign.booking_step_3 || 0,
        reservations: campaign.reservations || 0,
        reservation_value: campaign.reservation_value || 0,
        total_conversion_value: campaign.total_conversion_value || 0,
        roas: campaign.roas || 0
      }));

      // Insert/update campaigns in google_ads_campaigns table
      const { error: campaignInsertError } = await supabase
        .from('google_ads_campaigns')
        .upsert(campaignsToInsert, {
          onConflict: 'client_id,campaign_id,date_range_start,date_range_end'
        });

      if (campaignInsertError) {
        logger.error('❌ Failed to save weekly Google Ads campaigns to database:', campaignInsertError);
      } else {
        logger.info(`✅ Saved ${campaignsToInsert.length} weekly Google Ads campaigns to database`);
      }
    } catch (dbError) {
      logger.error('❌ Database insertion error for weekly Google Ads campaigns:', dbError);
    }

    // Cache the weekly data
    try {
      const { error: cacheError } = await supabase
        .from('google_ads_current_week_cache')
        .upsert({
          client_id: client.id,
          period_id: currentWeek.periodId,
          cache_data: cacheData,
          last_updated: new Date().toISOString()
        }, {
          onConflict: 'client_id,period_id'
        });

      if (cacheError) {
        logger.warn('⚠️ Failed to cache Google Ads weekly data:', cacheError);
      } else {
        logger.info('✅ Google Ads weekly data cached successfully');
      }
    } catch (cacheError) {
      logger.warn('⚠️ Weekly cache storage error:', cacheError);
    }

    return cacheData;

  } catch (error) {
    logger.error('❌ Failed to fetch fresh Google Ads weekly data:', error);
    throw error;
  }
}

// These functions are now defined at the end of the file for StandardizedDataFetcher integration

// Helper function to parse week period ID
function parseWeekPeriodId(periodId: string) {
  const [year, weekStr] = periodId.split('-W');
  const week = parseInt(weekStr || '1');
  
  // Calculate dates for the requested week
  const jan4 = new Date(parseInt(year || '2024'), 0, 4);
  const startOfWeek = new Date(jan4);
  startOfWeek.setDate(jan4.getDate() + (week - 1) * 7 - (jan4.getDay() + 6) % 7);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  
  return {
    year: parseInt(year || '2024'),
    week,
    startDate: startOfWeek.toISOString().split('T')[0],
    endDate: endOfWeek.toISOString().split('T')[0],
    periodId
  };
}

// Extracted Google Ads smart cache logic for monthly data
async function executeGoogleAdsSmartCacheRequest(clientId: string, currentMonth: any, forceRefresh: boolean) {
  // Check if we have fresh cached data (unless force refresh)
  if (!forceRefresh) {
    try {
      const { data: cachedData, error: cacheError } = await supabase
        .from('google_ads_current_month_cache')
        .select('*')
        .eq('client_id', clientId)
        .eq('period_id', currentMonth.periodId)
        .single();

      if (!cacheError && cachedData && cachedData.cache_data) {
        if (isCacheFresh(cachedData.last_updated)) {
          logger.info('✅ Returning fresh Google Ads cached data');
          
          const cacheAge = Date.now() - new Date(cachedData.last_updated).getTime();
          const responseData = {
            ...cachedData.cache_data,
            fromCache: true,
            cacheAge
          };
          
          return {
            success: true,
            data: responseData,
            source: 'google-ads-cache'
          };
        } else {
          logger.info('🔄 Google Ads cache expired, but returning stale data since no refresh token available');
          
          // Return stale data if no refresh token available
          const cacheAge = Date.now() - new Date(cachedData.last_updated).getTime();
          const responseData = {
            ...cachedData.cache_data,
            fromCache: true,
            cacheAge
          };
          
          return {
            success: true,
            data: responseData,
            source: 'google-ads-cache-stale'
          };
        }
      }
    } catch (cacheError) {
      logger.warn('⚠️ Google Ads cache lookup failed:', cacheError);
    }
  }

  // Get client data
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single();

  if (clientError || !client) {
    throw new Error('Client not found');
  }

  // Check if client has Google Ads enabled
  if (!client.google_ads_enabled || !client.google_ads_customer_id) {
    throw new Error('Google Ads not enabled for this client');
  }

  // Only try to fetch fresh data if we have a refresh token
  if (client.google_ads_refresh_token) {
    try {
      const freshData = await fetchFreshGoogleAdsCurrentMonthData(client);
      
      return {
        success: true,
        data: freshData,
        source: 'google-ads-live-api'
      };
    } catch (error) {
      logger.warn('⚠️ Failed to fetch fresh Google Ads data, returning null:', error);
      return {
        success: false,
        data: null,
        source: 'error'
      };
    }
  } else {
    logger.warn('⚠️ No Google Ads refresh token available, cannot fetch fresh data');
    return {
      success: false,
      data: null,
      source: 'error'
    };
  }
}

// Extracted Google Ads smart cache logic for weekly data
async function executeGoogleAdsSmartWeeklyCacheRequest(clientId: string, targetWeek: any, forceRefresh: boolean) {
  // Check if we have fresh cached data (unless force refresh)
  if (!forceRefresh) {
    try {
      const { data: cachedData, error: cacheError } = await supabase
        .from('google_ads_current_week_cache')
        .select('*')
        .eq('client_id', clientId)
        .eq('period_id', targetWeek.periodId)
        .single();

      if (!cacheError && cachedData) {
        if (isCacheFresh(cachedData.last_updated)) {
          logger.info('✅ Returning fresh Google Ads weekly cached data');
          
          const cacheAge = Date.now() - new Date(cachedData.last_updated).getTime();
          const responseData = {
            ...cachedData.cache_data,
            fromCache: true,
            cacheAge
          };
          
          return {
            success: true,
            data: responseData,
            source: 'google-ads-weekly-cache'
          };
        } else {
          logger.info('🔄 Google Ads weekly cache expired, fetching fresh data');
        }
      }
    } catch (cacheError) {
      logger.warn('⚠️ Google Ads weekly cache lookup failed, fetching fresh data:', cacheError);
    }
  }

  // Get client data
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single();

  if (clientError || !client) {
    throw new Error('Client not found');
  }

  // Check if client has Google Ads enabled
  if (!client.google_ads_enabled || !client.google_ads_customer_id) {
    throw new Error('Google Ads not enabled for this client');
  }

  // Fetch fresh weekly data
  const freshData = await fetchFreshGoogleAdsCurrentWeekData(client);
  
  return {
    success: true,
    data: freshData,
    source: 'google-ads-weekly-live-api'
  };
}

// ============================================================================
// PUBLIC FUNCTIONS FOR STANDARDIZED DATA FETCHER INTEGRATION
// ============================================================================

/**
 * Public function for StandardizedDataFetcher to get Google Ads smart cache data
 * This replaces the Meta-only smart cache calls for Google Ads platform
 */
export async function getGoogleAdsSmartCacheData(clientId: string, forceRefresh: boolean = false) {
  logger.info('🎯 GOOGLE ADS SMART CACHE: Public function called', {
    clientId,
    forceRefresh,
    timestamp: new Date().toISOString()
  });
  
  try {
    const currentMonth = getCurrentMonthInfo();
    const result = await executeGoogleAdsSmartCacheRequest(clientId, currentMonth, forceRefresh);
    
    logger.info('✅ Google Ads smart cache result:', {
      success: result.success,
      source: result.source,
      hasData: !!result.data
    });
    
    return result;
  } catch (error) {
    logger.error('❌ Google Ads smart cache error:', error);
    return {
      success: false,
      data: null,
      source: 'error'
    };
  }
}

/**
 * Public function for StandardizedDataFetcher to get Google Ads weekly smart cache data
 * This replaces the Meta-only weekly smart cache calls for Google Ads platform
 */
export async function getGoogleAdsSmartWeekCacheData(clientId: string, forceRefresh: boolean = false, periodId?: string) {
  logger.info('🎯 GOOGLE ADS WEEKLY SMART CACHE: Public function called', {
    clientId,
    forceRefresh,
    periodId,
    timestamp: new Date().toISOString()
  });
  
  try {
    let targetWeek;
    
    if (periodId) {
      // Parse provided period ID
      targetWeek = parseWeekPeriodId(periodId);
    } else {
      // Use current week
      targetWeek = getCurrentWeekInfo();
    }
    
    const result = await executeGoogleAdsSmartWeeklyCacheRequest(clientId, targetWeek, forceRefresh);
    
    logger.info('✅ Google Ads weekly smart cache result:', {
      success: result.success,
      source: result.source,
      hasData: !!result.data
    });
    
    return result;
  } catch (error) {
    logger.error('❌ Google Ads weekly smart cache error:', error);
    return {
      success: false,
      data: null,
      source: 'error'
    };
  }
}
