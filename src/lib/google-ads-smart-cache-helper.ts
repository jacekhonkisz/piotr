import { createClient } from '@supabase/supabase-js';
import { GoogleAdsAPIService } from './google-ads-api';
import logger from './logger';
import {
  googleEmailContactsFromRow,
  googlePhoneContactsFromRow,
} from './google-ads-contact-metrics';
import {
  fetchGoogleDynamicConversionRowsWithService,
  googleDynamicRowsToMetricMap,
} from './google-dynamic-conversion-fetch';

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

async function fetchDynamicMetricPayload(
  googleAdsService: GoogleAdsAPIService,
  dateStart: string,
  dateEnd: string
): Promise<{
  dynamicMetricValues: Record<string, number>;
  dynamicMetricRows: Array<{ key: string; id: string; label: string; count: number; value: number }>;
}> {
  try {
    const dyn = await fetchGoogleDynamicConversionRowsWithService(
      googleAdsService,
      dateStart,
      dateEnd,
    );
    if (!dyn.fetchOk) {
      logger.warn('⚠️ Google Ads dynamic metrics fetch skipped for cache', {
        dateStart,
        dateEnd,
        reason: dyn.skipReason,
      });
      return { dynamicMetricValues: {}, dynamicMetricRows: [] };
    }

    return {
      dynamicMetricValues: googleDynamicRowsToMetricMap(dyn.rows),
      dynamicMetricRows: dyn.rows,
    };
  } catch (error) {
    logger.warn('⚠️ Google Ads dynamic metrics fetch failed for cache:', error);
    return { dynamicMetricValues: {}, dynamicMetricRows: [] };
  }
}

async function hydrateMissingTablesFromDatabase(
  result: any,
  clientId: string,
  dateStart: string,
  dateEnd: string,
  cacheTable: 'google_ads_current_month_cache' | 'google_ads_current_week_cache',
  periodId: string,
) {
  if (!result?.success || !result.data) return result;

  const {
    hasAnyGoogleAdsTablesRows,
    loadGoogleAdsTablesFromDatabase,
  } = await import('./google-ads-tables-storage');

  if (hasAnyGoogleAdsTablesRows(result.data.googleAdsTables)) {
    return result;
  }

  let storedTables = await loadGoogleAdsTablesFromDatabase(clientId, dateStart, dateEnd);
  let foundStoredTablesRow = storedTables !== null;
  if (!hasAnyGoogleAdsTablesRows(storedTables)) {
    const { data: candidateRows } = await supabase
      .from('google_ads_tables_data')
      .select('date_range_start, date_range_end')
      .eq('client_id', clientId)
      .eq('date_range_start', dateStart)
      .order('date_range_end', { ascending: false })
      .limit(5);

    for (const candidate of candidateRows || []) {
      storedTables = await loadGoogleAdsTablesFromDatabase(
        clientId,
        (candidate as any).date_range_start,
        (candidate as any).date_range_end,
      );
      foundStoredTablesRow = foundStoredTablesRow || storedTables !== null;

      if (hasAnyGoogleAdsTablesRows(storedTables)) {
        logger.info('✅ Found latest current-period Google Ads tables row for smart cache hydration', {
          clientId,
          requestedRange: `${dateStart}→${dateEnd}`,
          storedRange: `${(candidate as any).date_range_start}→${(candidate as any).date_range_end}`,
        });
        break;
      }
    }
  }

  if (!hasAnyGoogleAdsTablesRows(storedTables) && !foundStoredTablesRow) {
    return result;
  }

  const hydratedData = {
    ...result.data,
    googleAdsTables: storedTables,
  };

  const { error } = await supabase
    .from(cacheTable)
    .update({ cache_data: hydratedData })
    .eq('client_id', clientId)
    .eq('period_id', periodId);

  if (error) {
    logger.warn('⚠️ Failed to persist hydrated Google Ads tables into smart cache', {
      clientId,
      periodId,
      cacheTable,
      error: error.message,
    });
  } else {
    logger.info('✅ Hydrated Google Ads smart cache tables from google_ads_tables_data', {
      clientId,
      periodId,
      cacheTable,
    });
  }

  return {
    ...result,
    data: hydratedData,
    source: hasAnyGoogleAdsTablesRows(storedTables)
      ? `${result.source}-hydrated-tables`
      : `${result.source}-stored-empty-tables`,
    tablesHydrationChecked: true,
  };
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

    // 🔍 DEBUG: Verify campaigns have booking steps before aggregation
    const campaignsWithSteps = campaignData.filter((c: any) => (c.booking_step_1 || 0) > 0);
    logger.info(`🔍 DEBUG: Campaigns with booking_step_1 > 0: ${campaignsWithSteps.length}`);
    
    if (campaignsWithSteps.length > 0) {
      const topCampaign = campaignsWithSteps[0];
      logger.info(`🔍 DEBUG: Top campaign in campaignData: ${topCampaign?.campaignName}, Step 1: ${topCampaign?.booking_step_1}`);
    } else {
      logger.warn(`⚠️ WARNING: No campaigns have booking_step_1 > 0! This indicates a problem.`);
    }

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
    
    // ✅ UNIFIED: E-mail / Telefon from parseGoogleAdsConversions (see google-ads-contact-metrics)
    const realConversionMetrics = campaignData.reduce((acc: any, campaign: any) => {
      const emailN = googleEmailContactsFromRow(campaign as Record<string, unknown>);
      const phoneN = googlePhoneContactsFromRow(campaign as Record<string, unknown>);
      acc.click_to_call += phoneN;
      acc.email_contacts += emailN;
      acc.phone_calls += campaign.phone_calls || 0;
      acc.email_clicks += emailN;
      acc.phone_clicks += phoneN;
      acc.booking_step_1 += campaign.booking_step_1 || 0;
      acc.booking_step_2 += campaign.booking_step_2 || 0;
      acc.booking_step_3 += campaign.booking_step_3 || 0;
      acc.reservations += campaign.reservations || 0;
      acc.reservation_value += campaign.reservation_value || 0;
      acc.conversion_value += campaign.conversion_value || 0;
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
      conversion_value: 0,
      total_conversion_value: 0
    } as any);

    realConversionMetrics.conversion_value =
      Math.round((realConversionMetrics as any).conversion_value * 100) / 100;
    realConversionMetrics.total_conversion_value =
      Math.round(realConversionMetrics.total_conversion_value * 100) / 100;
    realConversionMetrics.roas =
      totalSpend > 0 && realConversionMetrics.total_conversion_value > 0
        ? Math.round((realConversionMetrics.total_conversion_value / totalSpend) * 100) / 100
        : 0;
    realConversionMetrics.cost_per_reservation =
      realConversionMetrics.reservations > 0 && totalSpend > 0
        ? Math.round((totalSpend / realConversionMetrics.reservations) * 100) / 100
        : 0;
    
    logger.info('📊 Aggregated conversion metrics from Google Ads API:', {
      booking_step_1: realConversionMetrics.booking_step_1,
      booking_step_2: realConversionMetrics.booking_step_2,
      booking_step_3: realConversionMetrics.booking_step_3,
      reservations: realConversionMetrics.reservations,
      reservation_value: realConversionMetrics.reservation_value,
      conversion_value: realConversionMetrics.conversion_value,
      total_conversion_value: realConversionMetrics.total_conversion_value,
      roas: realConversionMetrics.roas,
      note: 'conversion_value / total_conversion_value match fetch-google-ads-live-data (Σ campaigns)'
    });

    // 🔍 DEBUG: Verify campaigns still have booking steps before cache creation
    const campaignsWithStepsAfterAgg = campaignData.filter((c: any) => (c.booking_step_1 || 0) > 0);
    logger.info(`🔍 DEBUG: Campaigns with booking_step_1 > 0 (after aggregation): ${campaignsWithStepsAfterAgg.length}`);
    
    if (campaignsWithStepsAfterAgg.length > 0) {
      const topCampaignAfter = campaignsWithStepsAfterAgg[0];
      logger.info(`🔍 DEBUG: Top campaign before cache (after aggregation): ${topCampaignAfter?.campaignName}, Step 1: ${topCampaignAfter?.booking_step_1}`);
    } else {
      logger.error(`❌ ERROR: Campaigns lost booking steps after aggregation! This is the bug.`);
    }

    // Fetch Google Ads tables data for current month cache (single call so
    // network/device/keyword/searchTerm/demographic all stay in sync) and
    // persist into google_ads_tables_data so historical reads + the
    // /api/fetch-google-ads-tables route see the same payload.
    let googleAdsTables: any = null;
    try {
      logger.info('📊 Fetching Google Ads tables data for current month cache...');

      const { fetchAndStoreGoogleAdsTables } = await import('./google-ads-tables-storage');
      googleAdsTables = await fetchAndStoreGoogleAdsTables(
        googleAdsService,
        client.id,
        currentMonth.startDate!,
        currentMonth.endDate!,
      );

      logger.info('✅ Google Ads tables data fetched for current month cache', {
        networkPerformance: googleAdsTables?.networkPerformance?.length || 0,
        devicePerformance: googleAdsTables?.devicePerformance?.length || 0,
        keywordPerformance: googleAdsTables?.keywordPerformance?.length || 0,
        searchTermPerformance: googleAdsTables?.searchTermPerformance?.length || 0,
        demographicPerformance: googleAdsTables?.demographicPerformance?.length || 0,
        geographicPerformance: googleAdsTables?.geographicPerformance?.length || 0,
      });
    } catch (tablesError) {
      logger.warn('⚠️ Failed to fetch Google Ads tables for current month cache:', tablesError);
      googleAdsTables = null; // Will fallback to live API calls
    }

    const dynamicMetricPayload = await fetchDynamicMetricPayload(
      googleAdsService,
      currentMonth.startDate!,
      currentMonth.endDate!,
    );

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
      dynamicMetricValues: dynamicMetricPayload.dynamicMetricValues,
      dynamicMetricRows: dynamicMetricPayload.dynamicMetricRows,
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
        email_clicks: googleEmailContactsFromRow(campaign as Record<string, unknown>),
        phone_clicks: googlePhoneContactsFromRow(campaign as Record<string, unknown>),
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
    
    // ✅ UNIFIED: E-mail / Telefon from parseGoogleAdsConversions (see google-ads-contact-metrics) (weekly)
    const realConversionMetrics = campaignData.reduce((acc: any, campaign: any) => {
      const emailN = googleEmailContactsFromRow(campaign as Record<string, unknown>);
      const phoneN = googlePhoneContactsFromRow(campaign as Record<string, unknown>);
      acc.click_to_call += phoneN;
      acc.email_contacts += emailN;
      acc.phone_calls += campaign.phone_calls || 0;
      acc.email_clicks += emailN;
      acc.phone_clicks += phoneN;
      acc.booking_step_1 += campaign.booking_step_1 || 0;
      acc.booking_step_2 += campaign.booking_step_2 || 0;
      acc.booking_step_3 += campaign.booking_step_3 || 0;
      acc.reservations += campaign.reservations || 0;
      acc.reservation_value += campaign.reservation_value || 0;
      acc.conversion_value += campaign.conversion_value || 0;
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
      conversion_value: 0,
      total_conversion_value: 0
    } as any);

    realConversionMetrics.conversion_value =
      Math.round((realConversionMetrics as any).conversion_value * 100) / 100;
    realConversionMetrics.total_conversion_value =
      Math.round(realConversionMetrics.total_conversion_value * 100) / 100;
    realConversionMetrics.roas =
      totalSpend > 0 && realConversionMetrics.total_conversion_value > 0
        ? Math.round((realConversionMetrics.total_conversion_value / totalSpend) * 100) / 100
        : 0;
    realConversionMetrics.cost_per_reservation =
      realConversionMetrics.reservations > 0 && totalSpend > 0
        ? Math.round((totalSpend / realConversionMetrics.reservations) * 100) / 100
        : 0;
    
    logger.info('📊 Aggregated weekly conversion metrics from Google Ads API:', {
      booking_step_1: realConversionMetrics.booking_step_1,
      booking_step_2: realConversionMetrics.booking_step_2,
      booking_step_3: realConversionMetrics.booking_step_3,
      reservations: realConversionMetrics.reservations
    });

    // Fetch breakdown tables (networks/devices/keywords/search-terms/
    // demographics/regions) so weekly reports render the same sections
    // as monthly. Persist them so /api/fetch-google-ads-tables and the
    // historical loader can reuse them without another API hit.
    let googleAdsTablesWeekly: any = null;
    try {
      const { fetchAndStoreGoogleAdsTables } = await import('./google-ads-tables-storage');
      googleAdsTablesWeekly = await fetchAndStoreGoogleAdsTables(
        googleAdsService,
        client.id,
        currentWeek.startDate!,
        currentWeek.endDate!,
      );
      logger.info('✅ Google Ads weekly breakdown tables fetched', {
        networks: googleAdsTablesWeekly?.networkPerformance?.length || 0,
        devices: googleAdsTablesWeekly?.devicePerformance?.length || 0,
        keywords: googleAdsTablesWeekly?.keywordPerformance?.length || 0,
        demographics: googleAdsTablesWeekly?.demographicPerformance?.length || 0,
        regions: googleAdsTablesWeekly?.geographicPerformance?.length || 0,
      });
    } catch (tablesError) {
      logger.warn('⚠️ Failed to fetch Google Ads weekly tables (UI will show empty):', tablesError);
    }

    const dynamicMetricPayload = await fetchDynamicMetricPayload(
      googleAdsService,
      currentWeek.startDate!,
      currentWeek.endDate!,
    );

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
      googleAdsTables: googleAdsTablesWeekly,
      dynamicMetricValues: dynamicMetricPayload.dynamicMetricValues,
      dynamicMetricRows: dynamicMetricPayload.dynamicMetricRows,
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
        email_clicks: googleEmailContactsFromRow(campaign as Record<string, unknown>),
        phone_clicks: googlePhoneContactsFromRow(campaign as Record<string, unknown>),
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
// ✅ FIX: Use the same implementation as week-helpers.ts for consistency
function parseWeekPeriodId(periodId: string) {
  try {
    // Use the standardized week-utils implementation
    const { parseWeekPeriodId: parseStandardized } = require('./week-utils');
    return parseStandardized(periodId);
  } catch (error) {
    logger.error('❌ Failed to use standardized parseWeekPeriodId, using fallback:', error);
    // Fallback implementation (should match week-utils.ts)
    const [year, weekStr] = periodId.split('-W');
    const yearNum = parseInt(year || '2024');
    const week = parseInt(weekStr || '1');
    
    if (isNaN(yearNum) || isNaN(week)) {
      throw new Error(`Invalid weekly period ID: ${periodId}`);
    }
    
    // Calculate the start date of the ISO week using CORRECTED algorithm
    const jan4 = new Date(yearNum, 0, 4);
    const jan4Day = jan4.getDay();
    const daysFromMonday = jan4Day === 0 ? 6 : jan4Day - 1; // Sunday = 6, Monday = 0
    
    // Find the Monday of week 1 (ISO week 1)
    const firstMonday = new Date(jan4);
    firstMonday.setDate(jan4.getDate() - daysFromMonday);
    
    // Calculate the Monday of the target week
    const weekStartDate = new Date(firstMonday);
    weekStartDate.setDate(firstMonday.getDate() + (week - 1) * 7);
    weekStartDate.setHours(0, 0, 0, 0);
    
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekStartDate.getDate() + 6);
    weekEndDate.setHours(23, 59, 59, 999);
    
    // Helper function for timezone-safe date formatting
    const formatDate = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };
    
    return {
      year: yearNum,
      week,
      startDate: formatDate(weekStartDate),
      endDate: formatDate(weekEndDate),
      periodId
    };
  }
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
    logger.error('❌ GOOGLE ADS MONTHLY: Client not found', { clientId });
    throw new Error('Client not found');
  }

  // 🔧 FIX: Only require google_ads_customer_id - google_ads_enabled can be implicit
  // This matches the cron job validation logic
  if (!client.google_ads_customer_id) {
    logger.error('❌ GOOGLE ADS MONTHLY: No customer_id for client', { clientId, clientName: client.name });
    throw new Error('Google Ads customer_id not configured for this client');
  }

  // 🔧 FIX: Check for manager refresh token in system settings first
  let hasRefreshToken = !!client.google_ads_refresh_token;
  
  if (!hasRefreshToken) {
    // Check for manager token in system settings
    const { data: managerTokenSetting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'google_ads_manager_refresh_token')
      .single();
    
    hasRefreshToken = !!(managerTokenSetting?.value);
    if (hasRefreshToken) {
      logger.info('📊 Using manager refresh token for Google Ads (client has no individual token)');
    }
  }

  // Try to fetch fresh data if we have ANY refresh token (client or manager)
  if (hasRefreshToken) {
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
    logger.warn('⚠️ No Google Ads refresh token available (neither client nor manager), cannot fetch fresh data');
    return {
      success: false,
      data: null,
      source: 'error'
    };
  }
}

// Extracted Google Ads smart cache logic for weekly data
async function executeGoogleAdsSmartWeeklyCacheRequest(clientId: string, targetWeek: any, forceRefresh: boolean) {
  logger.info('📊 GOOGLE ADS WEEKLY: executeGoogleAdsSmartWeeklyCacheRequest called', {
    clientId,
    targetWeek: targetWeek.periodId,
    forceRefresh
  });

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
    logger.error('❌ GOOGLE ADS WEEKLY: Client not found', { clientId });
    throw new Error('Client not found');
  }

  // 🔧 FIX: Only require google_ads_customer_id - google_ads_enabled can be implicit
  // This matches the cron job validation logic
  if (!client.google_ads_customer_id) {
    logger.error('❌ GOOGLE ADS WEEKLY: No customer_id for client', { clientId, clientName: client.name });
    throw new Error('Google Ads customer_id not configured for this client');
  }

  // 🔧 FIX: Check for manager refresh token in system settings first (same as monthly)
  let hasRefreshToken = !!client.google_ads_refresh_token;
  
  if (!hasRefreshToken) {
    // Check for manager token in system settings
    const { data: managerTokenSetting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'google_ads_manager_refresh_token')
      .single();
    
    hasRefreshToken = !!(managerTokenSetting?.value);
    if (hasRefreshToken) {
      logger.info('📊 GOOGLE ADS WEEKLY: Using manager refresh token (client has no individual token)');
    }
  }

  // Try to fetch fresh data if we have ANY refresh token (client or manager)
  if (hasRefreshToken) {
    try {
      logger.info('🔄 GOOGLE ADS WEEKLY: Fetching fresh data for', { clientName: client.name, periodId: targetWeek.periodId });
      const freshData = await fetchFreshGoogleAdsCurrentWeekData(client);
      logger.info('✅ GOOGLE ADS WEEKLY: Successfully fetched fresh data for', { clientName: client.name });
      
      return {
        success: true,
        data: freshData,
        source: 'google-ads-weekly-live-api'
      };
    } catch (error) {
      logger.error('❌ GOOGLE ADS WEEKLY: Failed to fetch fresh data', { 
        clientName: client.name, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      // 🔧 FIX: Try to return stale cache if available
      try {
        const { data: staleCachedData } = await supabase
          .from('google_ads_current_week_cache')
          .select('*')
          .eq('client_id', clientId)
          .eq('period_id', targetWeek.periodId)
          .single();
        
        if (staleCachedData?.cache_data) {
          logger.warn('⚠️ GOOGLE ADS WEEKLY: Returning stale cache after fetch failure');
          return {
            success: true,
            data: {
              ...staleCachedData.cache_data,
              fromCache: true,
              isStale: true,
              cacheAge: Date.now() - new Date(staleCachedData.last_updated).getTime()
            },
            source: 'google-ads-weekly-cache-stale'
          };
        }
      } catch {
        // No stale cache available
      }
      
      throw error; // Re-throw if no stale cache
    }
  }

  logger.error('❌ GOOGLE ADS WEEKLY: No refresh token available', { clientName: client.name });
  throw new Error('No Google Ads refresh token available (neither client nor manager)');
}

// ============================================================================
// PUBLIC FUNCTIONS FOR STANDARDIZED DATA FETCHER INTEGRATION
// ============================================================================

/**
 * Public function for StandardizedDataFetcher to get Google Ads smart cache data
 * This replaces the Meta-only smart cache calls for Google Ads platform
 */
export type GoogleAdsSmartCacheResult = {
  success: boolean;
  data: any;
  source: string;
  error?: string;
  // executeGoogleAdsSmartCacheRequest may attach internal flags; allow them.
  [key: string]: any;
};

export async function getGoogleAdsSmartCacheData(
  clientId: string,
  forceRefresh: boolean = false
): Promise<GoogleAdsSmartCacheResult> {
  logger.info('🎯 GOOGLE ADS SMART CACHE: Public function called', {
    clientId,
    forceRefresh,
    timestamp: new Date().toISOString()
  });
  
  try {
    const currentMonth = getCurrentMonthInfo();
    let result = await executeGoogleAdsSmartCacheRequest(clientId, currentMonth, forceRefresh);

    // Older current-month cache rows may contain campaign totals but no
    // breakdown tables. Serving those rows makes /reports render "Brak
    // danych" even though Google Ads has device/demographic/geographic data.
    // Prefer hydrating from persistent google_ads_tables_data; only rebuild
    // from Google Ads API if no stored breakdown row exists.
    if (result.success && result.data && !forceRefresh) {
      const { hasAnyGoogleAdsTablesRows } = await import('./google-ads-tables-storage');
      if (!hasAnyGoogleAdsTablesRows((result.data as any).googleAdsTables)) {
        result = await hydrateMissingTablesFromDatabase(
          result,
          clientId,
          currentMonth.startDate,
          currentMonth.endDate,
          'google_ads_current_month_cache',
          currentMonth.periodId,
        );

        if (!hasAnyGoogleAdsTablesRows((result.data as any)?.googleAdsTables) && !(result as any).tablesHydrationChecked) {
          logger.warn('⚠️ Google Ads monthly smart cache missing breakdown tables and no stored table row exists; force refreshing cache');
          result = await executeGoogleAdsSmartCacheRequest(clientId, currentMonth, true);
        }
      }
    }
    
    logger.info('✅ Google Ads smart cache result:', {
      success: result.success,
      source: result.source,
      hasData: !!result.data
    });
    
    return result;
  } catch (error) {
    logger.error('❌ Google Ads smart cache error:', error);
    return {
      success: false as const,
      data: null,
      source: 'error',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Public function for StandardizedDataFetcher to get Google Ads weekly smart cache data
 * This replaces the Meta-only weekly smart cache calls for Google Ads platform
 */
export async function getGoogleAdsSmartWeekCacheData(
  clientId: string,
  forceRefresh: boolean = false,
  periodId?: string
): Promise<GoogleAdsSmartCacheResult> {
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
    
    let result = await executeGoogleAdsSmartWeeklyCacheRequest(clientId, targetWeek, forceRefresh);

    if (result.success && result.data && !forceRefresh) {
      const { hasAnyGoogleAdsTablesRows } = await import('./google-ads-tables-storage');
      if (!hasAnyGoogleAdsTablesRows((result.data as any).googleAdsTables)) {
        result = await hydrateMissingTablesFromDatabase(
          result,
          clientId,
          targetWeek.startDate,
          targetWeek.endDate,
          'google_ads_current_week_cache',
          targetWeek.periodId,
        );

        if (!hasAnyGoogleAdsTablesRows((result.data as any)?.googleAdsTables) && !(result as any).tablesHydrationChecked) {
          logger.warn('⚠️ Google Ads weekly smart cache missing breakdown tables and no stored table row exists; force refreshing cache');
          result = await executeGoogleAdsSmartWeeklyCacheRequest(clientId, targetWeek, true);
        }
      }
    }
    
    logger.info('✅ Google Ads weekly smart cache result:', {
      success: result.success,
      source: result.source,
      hasData: !!result.data
    });
    
    return result;
  } catch (error) {
    logger.error('❌ Google Ads weekly smart cache error:', error);
    return {
      success: false as const,
      data: null,
      source: 'error',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
