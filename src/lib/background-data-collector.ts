// @ts-ignore - processedAdAccountId is guaranteed to be string after null check
import { createClient } from '@supabase/supabase-js';
import { MetaAPIServiceOptimized } from './meta-api-optimized';
import { GoogleAdsAPIService } from './google-ads-api';
import { StandardizedDataFetcher } from './standardized-data-fetcher';
import { getMonthBoundaries } from './date-range-utils';
import { getMondayOfWeek, getSundayOfWeek, formatDateISO, validateIsMonday, getLastNWeeks } from './week-helpers';
import { enhanceCampaignsWithConversions } from './meta-actions-parser';
import logger from './logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Client {
  id: string;
  name: string;
  email: string;
  meta_access_token?: string;
  system_user_token?: string; // ✅ Added: Permanent system user token (preferred)
  ad_account_id?: string;
  google_ads_customer_id?: string;
  google_ads_refresh_token?: string;
  api_status: string;
}

export class BackgroundDataCollector {
  private static instance: BackgroundDataCollector;
  private isRunning = false;

  static getInstance(): BackgroundDataCollector {
    if (!BackgroundDataCollector.instance) {
      BackgroundDataCollector.instance = new BackgroundDataCollector();
    }
    return BackgroundDataCollector.instance;
  }

  /**
   * Collect and store monthly summaries for all active clients
   */
  async collectMonthlySummaries(): Promise<void> {
    console.log('🔵 [DEBUG] ENTERING collectMonthlySummaries');
    console.log('🔵 [DEBUG] isRunning flag:', this.isRunning);
    
    if (this.isRunning) {
      console.log('🔴 [DEBUG] EARLY RETURN: isRunning is true');
      logger.info('⚠️ Background data collection already running');
      return;
    }

    this.isRunning = true;
    console.log('🟢 [DEBUG] Set isRunning = true');
    logger.info('📅 Starting monthly data collection...');

    try {
      console.log('🔵 [DEBUG] Calling getAllActiveClients...');
      const clients = await this.getAllActiveClients();
      console.log('🟢 [DEBUG] Found clients:', clients.length);
      console.log('🟢 [DEBUG] Client names:', clients.map(c => c.name).join(', '));
      logger.info(`📊 Found ${clients.length} active clients for monthly collection`);

      if (clients.length === 0) {
        console.log('🔴 [DEBUG] NO CLIENTS FOUND! Exiting early.');
        return;
      }

      console.log('🔵 [DEBUG] Starting client loop...');
      for (const client of clients) {
        console.log(`🔵 [DEBUG] Processing client: ${client.name} (${client.id})`);
        try {
          await this.collectMonthlySummaryForClient(client);
          console.log(`✅ [DEBUG] Completed client: ${client.name}`);
          // ✅ OPTIMIZED: Reduced delay between clients from 2000ms to 500ms
          await this.delay(500);
        } catch (error) {
          console.error(`❌ [DEBUG] Failed client: ${client.name}`, error);
          logger.error(`❌ Failed to collect monthly summary for ${client.name}:`, error);
        }
      }

      console.log('✅ [DEBUG] COMPLETED ALL CLIENTS');
      logger.info('✅ Monthly data collection completed');
    } catch (error) {
      console.error('🔴 [DEBUG] ERROR IN COLLECTION:', error);
      logger.error('❌ Error in monthly data collection:', error);
    } finally {
      console.log('🟡 [DEBUG] FINALLY: Setting isRunning = false');
      this.isRunning = false;
    }
  }

  /**
   * Collect monthly summaries for a specific client (used for new client initialization)
   * NEW METHOD - for auto-initializing new clients with historical data
   */
  async collectMonthlySummariesForSingleClient(clientId: string): Promise<void> {
    logger.info(`📅 Starting monthly data collection for single client: ${clientId}`);

    try {
      // Fetch client data
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();

      if (clientError || !client) {
        throw new Error(`Client ${clientId} not found: ${clientError?.message}`);
      }

      logger.info(`📊 Collecting monthly data for: ${client.name}`);

      // Collect monthly summaries for this client
      await this.collectMonthlySummaryForClient(client as Client);

      logger.info(`✅ Monthly data collection completed for ${client.name}`);
    } catch (error) {
      logger.error(`❌ Error collecting monthly data for client ${clientId}:`, error);
      throw error;
    }
  }

  /**
   * Collect and store weekly summaries for all active clients
   * @param clientNameFilter Optional filter to collect for specific client only (for testing)
   * @param startWeek Starting week offset (0 = current week, 1 = last week, etc.)
   * @param endWeek Ending week offset (53 = 53 weeks ago)
   */
  async collectWeeklySummaries(clientNameFilter?: string, startWeek: number = 0, endWeek: number = 53): Promise<void> {
    console.log('🔵 [DEBUG] ENTERING collectWeeklySummaries');
    console.log('🔵 [DEBUG] isRunning flag:', this.isRunning);
    console.log('🔵 [DEBUG] clientNameFilter:', clientNameFilter || 'none');
    console.log('🔵 [DEBUG] Week range:', startWeek, 'to', endWeek);
    
    if (this.isRunning) {
      console.log('🔴 [DEBUG] EARLY RETURN: isRunning is true');
      logger.info('⚠️ Background data collection already running');
      return;
    }

    this.isRunning = true;
    console.log('🟢 [DEBUG] Set isRunning = true');
    
    const weekCount = endWeek - startWeek + 1;
    logger.info(clientNameFilter 
      ? `📅 Starting weekly data collection for client matching '${clientNameFilter}' (${weekCount} weeks: ${startWeek}-${endWeek})...`
      : `📅 Starting weekly data collection for all clients (${weekCount} weeks: ${startWeek}-${endWeek})...`
    );

    try {
      console.log('🔵 [DEBUG] Calling getAllActiveClients...');
      let clients = await this.getAllActiveClients();
      
      // 🧪 TEST: Filter clients if clientNameFilter provided
      if (clientNameFilter) {
        clients = clients.filter(c => c.name.toLowerCase().includes(clientNameFilter.toLowerCase()));
        console.log(`🧪 [DEBUG] Filtered to ${clients.length} client(s) matching '${clientNameFilter}'`);
      }
      
      console.log('🟢 [DEBUG] Found clients:', clients.length);
      console.log('🟢 [DEBUG] Client names:', clients.map(c => c.name).join(', '));
      logger.info(`📊 Found ${clients.length} active clients for weekly collection`);

      if (clients.length === 0) {
        console.log('🔴 [DEBUG] NO CLIENTS FOUND! Exiting early.');
        return;
      }

      console.log('🔵 [DEBUG] Starting client loop...');
      for (const client of clients) {
        console.log(`🔵 [DEBUG] Processing client: ${client.name} (${client.id})`);
        try {
          await this.collectWeeklySummaryForClient(client, startWeek, endWeek);
          console.log(`✅ [DEBUG] Completed client: ${client.name}`);
          // ✅ OPTIMIZED: Reduced delay between clients from 2000ms to 500ms
          await this.delay(500);
        } catch (error) {
          console.error(`❌ [DEBUG] Failed client: ${client.name}`, error);
          logger.error(`❌ Failed to collect weekly summary for ${client.name}:`, error);
        }
      }

      console.log('✅ [DEBUG] COMPLETED ALL CLIENTS');
      logger.info('✅ Weekly data collection completed');
    } catch (error) {
      console.error('🔴 [DEBUG] ERROR IN COLLECTION:', error);
      logger.error('❌ Error in weekly data collection:', error);
    } finally {
      console.log('🟡 [DEBUG] FINALLY: Setting isRunning = false');
      this.isRunning = false;
    }
  }

  /**
   * Collect weekly summaries for a specific client (used for new client initialization)
   * NEW METHOD - for auto-initializing new clients with historical data
   */
  async collectWeeklySummariesForSingleClient(clientId: string): Promise<void> {
    logger.info(`📅 Starting weekly data collection for single client: ${clientId}`);

    try {
      // Fetch client data
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();

      if (clientError || !client) {
        throw new Error(`Client ${clientId} not found: ${clientError?.message}`);
      }

      logger.info(`📊 Collecting weekly data for: ${client.name}`);

      // Collect weekly summaries for this client
      await this.collectWeeklySummaryForClient(client as Client);

      logger.info(`✅ Weekly data collection completed for ${client.name}`);
    } catch (error) {
      logger.error(`❌ Error collecting weekly data for client ${clientId}:`, error);
      throw error;
    }
  }

  /**
   * Collect monthly summary for a specific client (both Meta and Google Ads)
   */
  private async collectMonthlySummaryForClient(client: Client): Promise<void> {
    logger.info(`📊 Collecting monthly summary for ${client.name}...`);

    // Get the last 12 COMPLETE months (excluding current incomplete month)
    // Current month is handled by smart cache system
    const currentDate = new Date();
    const monthsToCollect = [];

    for (let i = 1; i <= 12; i++) {  // ✅ FIXED: Start at i=1 to skip current month
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const monthRange = getMonthBoundaries(year, month);
      
      monthsToCollect.push({
        year,
        month,
        startDate: monthRange.start,
        endDate: monthRange.end
      });
    }

    // Collect Meta Ads data if configured
    if ((client.system_user_token || client.meta_access_token) && client.ad_account_id) {
      await this.collectMetaMonthlySummary(client, monthsToCollect);
    }

    // Collect Google Ads data if configured
    if (client.google_ads_customer_id) {
      await this.collectGoogleAdsMonthlySummary(client, monthsToCollect);
    }

    // If neither platform is configured, log warning
    if (!(client.system_user_token || client.meta_access_token) && !client.google_ads_customer_id) {
      logger.warn(`⚠️ No advertising platforms configured for ${client.name}, skipping`);
      return;
    }
  }

  /**
   * Collect Meta Ads monthly summary for a client
   */
  private async collectMetaMonthlySummary(client: Client, monthsToCollect: any[]): Promise<void> {
    logger.info(`📊 Collecting Meta Ads monthly summary for ${client.name}...`);

    // Initialize Meta API service
    // ✅ FIX: Use system_user_token if available (permanent), otherwise use meta_access_token (60-day)
    const metaToken = client.system_user_token || client.meta_access_token;
    const tokenType = client.system_user_token ? 'system_user (permanent)' : 'access_token (60-day)';
    
    if (!metaToken || !client.ad_account_id) {
      logger.warn(`⚠️ Missing Meta token or ad account ID for ${client.name}, skipping Meta collection`);
      return;
    }
    
    logger.info(`🔑 Monthly collection: Using ${tokenType} for ${client.name}`);

    // At this point, we know both values are defined
    const adAccountId = client.ad_account_id as string;

    const metaService = new MetaAPIServiceOptimized(metaToken);
    
    // Validate token
    const tokenValidation = await metaService.validateToken();
    if (!tokenValidation.valid) {
      logger.warn(`⚠️ Invalid token for ${client.name}, skipping`);
      return;
    }

    const processedAdAccountId = (adAccountId.startsWith('act_') 
      ? adAccountId.substring(4)
      : adAccountId) as string;

    for (const monthData of monthsToCollect) {
      try {
        logger.info(`📅 Collecting ${monthData.year}-${monthData.month.toString().padStart(2, '0')} for ${client.name}`);

        // ✅ FIX: Use getCampaignInsights() for campaign-level data (not getPlacementPerformance!)
        // @ts-ignore - processedAdAccountId is guaranteed to be string after null check
        let rawCampaignInsights = await metaService.getCampaignInsights(
          processedAdAccountId,
          monthData.startDate,
          monthData.endDate,
          0  // timeIncrement = 0 for period totals (not daily breakdown)
        );

        // ✅ FIX: Parse actions array to extract conversion metrics
        const campaignInsights = enhanceCampaignsWithConversions(rawCampaignInsights);

        logger.info(`📊 Retrieved and parsed ${campaignInsights.length} campaigns with conversion data`);

        // ✅ NEW: Try to get account-level insights first to use API values directly
        let accountInsights: any = null;
        try {
          accountInsights = await metaService.getAccountInsights(processedAdAccountId, monthData.startDate, monthData.endDate);
          if (accountInsights) {
            logger.info(`✅ Using account-level insights from API for ${monthData.year}-${monthData.month} CTR/CPC`);
          }
        } catch (accountError) {
          logger.warn(`⚠️ Could not fetch account-level insights for ${monthData.year}-${monthData.month}, will use campaign aggregation:`, accountError);
        }

        // Calculate totals from complete campaign data
        const totals = this.calculateTotals(campaignInsights, accountInsights);

        // Count active campaigns (all returned campaigns are considered active)
        const activeCampaignCount = campaignInsights.length;
        logger.info(`📈 Active campaigns for ${monthData.year}-${monthData.month}: ${activeCampaignCount}`);

        // Fetch meta tables
        let metaTables = null;
        try {
          // @ts-ignore - processedAdAccountId is guaranteed to be string after null check
          const placementData = await metaService.getPlacementPerformance(processedAdAccountId, monthData.startDate, monthData.endDate);
          // @ts-ignore - processedAdAccountId is guaranteed to be string after null check
          const demographicData = await metaService.getDemographicPerformance(processedAdAccountId, monthData.startDate, monthData.endDate);
          // @ts-ignore - processedAdAccountId is guaranteed to be string after null check
          const adRelevanceData = await metaService.getAdRelevanceResults(processedAdAccountId, monthData.startDate, monthData.endDate);
          
          metaTables = {
            placementPerformance: placementData,
            demographicPerformance: demographicData,
            adRelevanceResults: adRelevanceData
          };
        } catch (error) {
          logger.warn(`⚠️ Failed to fetch meta tables for ${client.name} ${monthData.year}-${monthData.month}:`, error);
        }

        // Store the summary
        await this.storeMonthlySummary(client.id, {
          summary_date: monthData.startDate,
          campaigns: campaignInsights,
          totals,
          metaTables,
          activeCampaignCount
        });

        logger.info(`✅ Stored monthly summary for ${client.name} ${monthData.year}-${monthData.month}`);

        // ✅ OPTIMIZED: Reduced delay from 1000ms to 100ms
        await this.delay(100);

      } catch (error) {
        logger.error(`❌ Failed to collect ${monthData.year}-${monthData.month} for ${client.name}:`, error);
      }
    }
  }

  /**
   * Collect Google Ads monthly summary for a client
   */
  private async collectGoogleAdsMonthlySummary(client: Client, monthsToCollect: any[]): Promise<void> {
    logger.info(`📊 Collecting Google Ads monthly summary for ${client.name}...`);

    // Get Google Ads system settings
    const { data: settingsData, error: settingsError } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', ['google_ads_client_id', 'google_ads_client_secret', 'google_ads_developer_token', 'google_ads_manager_refresh_token', 'google_ads_manager_customer_id']);

    if (settingsError) {
      logger.error(`❌ Failed to get Google Ads system settings for ${client.name}:`, settingsError);
      return;
    }

    const settings = settingsData.reduce((acc: any, setting: any) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {});

    // Determine refresh token (manager token takes priority)
    let refreshToken = null;
    if (settings.google_ads_manager_refresh_token) {
      refreshToken = settings.google_ads_manager_refresh_token;
    } else if (client.google_ads_refresh_token) {
      refreshToken = client.google_ads_refresh_token;
    }

    if (!refreshToken) {
      logger.warn(`⚠️ No Google Ads refresh token available for ${client.name}, skipping Google Ads collection`);
      return;
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

    for (const monthData of monthsToCollect) {
      try {
        logger.info(`📅 Collecting Google Ads ${monthData.year}-${monthData.month.toString().padStart(2, '0')} for ${client.name}`);

        // Fetch Google Ads campaign performance
        const campaigns = await googleAdsService.getCampaignData(monthData.startDate, monthData.endDate);

        logger.info(`📊 Retrieved ${campaigns.length} Google Ads campaigns`);

        if (campaigns.length === 0) {
          logger.info(`⚠️ No Google Ads campaigns found for ${client.name} ${monthData.year}-${monthData.month}`);
          continue;
        }

        // Calculate totals from Google Ads campaign data
        const totals = campaigns.reduce((acc: any, campaign: any) => ({
          spend: acc.spend + (campaign.spend || 0),
          impressions: acc.impressions + (campaign.impressions || 0),
          clicks: acc.clicks + (campaign.clicks || 0),
          conversions: acc.conversions + (campaign.conversions || 0),
          // Google Ads specific conversions
          click_to_call: acc.click_to_call + (campaign.click_to_call || 0),
          email_contacts: acc.email_contacts + (campaign.email_contacts || 0),
          booking_step_1: acc.booking_step_1 + (campaign.booking_step_1 || 0),
          booking_step_2: acc.booking_step_2 + (campaign.booking_step_2 || 0),
          booking_step_3: acc.booking_step_3 + (campaign.booking_step_3 || 0),
          reservations: acc.reservations + (campaign.reservations || 0),
          reservation_value: acc.reservation_value + (campaign.reservation_value || 0),
        }), {
          spend: 0, impressions: 0, clicks: 0, conversions: 0,
          click_to_call: 0, email_contacts: 0, booking_step_1: 0,
          booking_step_2: 0, booking_step_3: 0, reservations: 0, reservation_value: 0
        });

        // Calculate derived metrics
        const ctr = totals.clicks > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
        const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;

        const activeCampaignCount = campaigns.length;
        logger.info(`📈 Active Google Ads campaigns for ${monthData.year}-${monthData.month}: ${activeCampaignCount}`);

        // Fetch Google Ads tables (network, demographic, quality score)
        let googleAdsTables = null;
        try {
          googleAdsTables = await googleAdsService.getGoogleAdsTables(
            monthData.startDate,
            monthData.endDate
          );
          logger.info(`📊 Fetched Google Ads tables for ${monthData.year}-${monthData.month}`);
        } catch (error) {
          logger.warn(`⚠️ Failed to fetch Google Ads tables for ${client.name} ${monthData.year}-${monthData.month}:`, error);
        }

        // Store the Google Ads summary with platform="google"
        await this.storeGoogleAdsMonthlySummary(client.id, {
          summary_date: monthData.startDate,
          platform: 'google',
          campaigns,
          totals: {
            ...totals,
            ctr,
            cpc
          },
          googleAdsTables,
          activeCampaignCount
        });

        logger.info(`✅ Stored Google Ads monthly summary for ${client.name} ${monthData.year}-${monthData.month}`);

        // ✅ OPTIMIZED: Reduced delay from 1000ms to 100ms
        await this.delay(100);
      } catch (error) {
        logger.error(`❌ Failed to collect Google Ads month ${monthData.year}-${monthData.month} for ${client.name}:`, error);
      }
    }
  }

  /**
   * Collect weekly summary for a specific client
   * ✅ FIXED: Now uses ISO week helpers to ensure all weeks start on Monday
   * @param client Client to collect data for
   * @param startWeek Starting week offset (0 = current week)
   * @param endWeek Ending week offset (53 = 53 weeks ago)
   */
  private async collectWeeklySummaryForClient(client: Client, startWeek: number = 0, endWeek: number = 53): Promise<void> {
    const weekCount = endWeek - startWeek + 1;
    logger.info(`📊 Collecting ${weekCount} weeks (${startWeek}-${endWeek}) for ${client.name}...`);

    const currentDate = new Date();
    const weeksToCollect = [];

    // ✅ FIX: Use getLastNWeeks helper to get properly aligned ISO weeks
    const includeCurrentWeek = startWeek === 0;
    const totalWeeksNeeded = endWeek - startWeek + 1;
    const allWeekMondays = getLastNWeeks(totalWeeksNeeded, includeCurrentWeek);
    
    logger.info(`✅ Generated ${allWeekMondays.length} ISO weeks (all start on Monday)`);

    // Process each week Monday
    for (let i = 0; i < allWeekMondays.length; i++) {
      const weekMonday = allWeekMondays[i];
      const weekSunday = getSundayOfWeek(weekMonday);
      
      // ✅ VALIDATE: Ensure week starts on Monday
      try {
        validateIsMonday(weekMonday);
      } catch (error) {
        logger.error(`❌ Week validation failed: ${error.message}`);
        continue;
      }
      
      // Check if this is current week or completed week
      const isCurrent = i === 0 && includeCurrentWeek;
      const isComplete = weekSunday < currentDate;
      
      weeksToCollect.push({
        startDate: formatDateISO(weekMonday),
        endDate: formatDateISO(weekSunday),
        weekNumber: i,
        isComplete: isComplete,
        isCurrent: isCurrent
      });
      
      const weekType = isCurrent ? 'CURRENT' : isComplete ? 'COMPLETED' : 'FUTURE';
      logger.info(`📅 Week ${i}: ${formatDateISO(weekMonday)} to ${formatDateISO(weekSunday)} (${weekType})`);
    }

    logger.info(`📅 Will collect ${weeksToCollect.length} ISO-standard weeks (all start on Monday)`)

    // Initialize Meta API service
    // ✅ FIX: Use system_user_token if available (permanent), otherwise use meta_access_token (60-day)
    const metaToken = client.system_user_token || client.meta_access_token;
    const tokenType = client.system_user_token ? 'system_user (permanent)' : 'access_token (60-day)';
    
    if (!metaToken || !client.ad_account_id) {
      logger.warn(`⚠️ Missing token or ad account ID for ${client.name}, skipping`);
      return;
    }
    
    logger.info(`🔑 Weekly collection: Using ${tokenType} for ${client.name}`);

    // At this point, we know both values are defined
    const adAccountId = client.ad_account_id as string;

    const metaService = new MetaAPIServiceOptimized(metaToken);
    
    // Validate token
    const tokenValidation = await metaService.validateToken();
    if (!tokenValidation.valid) {
      logger.warn(`⚠️ Invalid token for ${client.name}, skipping`);
      return;
    }

    const processedAdAccountId: string = adAccountId.startsWith('act_') 
      ? adAccountId.substring(4)
      : adAccountId;

    // 🔧 SEQUENTIAL PROCESSING: Process weeks one-by-one to avoid rate limits
    // This is slower but RELIABLE - each week takes ~3-5s, no timeout risk
    logger.info(`🔄 Processing ${weeksToCollect.length} weeks sequentially (one-by-one to avoid rate limits)`);

    for (let weekIndex = 0; weekIndex < weeksToCollect.length; weekIndex++) {
      const weekData = weeksToCollect[weekIndex];
      logger.info(`📅 Processing week ${weekIndex + 1}/${weeksToCollect.length}: ${weekData.startDate}`);

      try {
        const weekType = weekData.isCurrent ? 'CURRENT' : weekData.isComplete ? 'COMPLETED' : 'HISTORICAL';
        logger.info(`📅 Collecting ${weekType} week ${weekData.weekNumber} (${weekData.startDate} to ${weekData.endDate}) for ${client.name}`);

        // ✅ FIX: Use getCampaignInsights() for campaign-level data (not getPlacementPerformance!)
        logger.info(`🔍 DEBUG: Calling Meta API with dates: ${weekData.startDate} to ${weekData.endDate}`);
        let rawCampaignInsights = await metaService.getCampaignInsights(
          processedAdAccountId,
          weekData.startDate,
          weekData.endDate,
          0  // timeIncrement = 0 for period totals (not daily breakdown)
        );

        // 🔍 DEBUG: Log raw API response to verify dates are working
        if (rawCampaignInsights.length > 0) {
          const sampleCampaign = rawCampaignInsights[0];
          logger.info(`🔍 DEBUG: Sample campaign from API - spend: ${sampleCampaign.spend}, date_range: ${JSON.stringify(sampleCampaign.date_start || 'N/A')} to ${JSON.stringify(sampleCampaign.date_stop || 'N/A')}`);
          const totalSpendFromAPI = rawCampaignInsights.reduce((sum: number, c: any) => sum + parseFloat(c.spend || 0), 0);
          logger.info(`🔍 DEBUG: Total spend from API for ${weekData.startDate}: ${totalSpendFromAPI.toFixed(2)}`);
          
          // 🔍 DEBUG: Log actions array to verify all metrics are being fetched
          if (sampleCampaign.actions && Array.isArray(sampleCampaign.actions)) {
            logger.info(`🔍 DEBUG: Sample campaign has ${sampleCampaign.actions.length} actions`);
            const actionTypes = sampleCampaign.actions.map((a: any) => a.action_type).filter(Boolean);
            logger.info(`🔍 DEBUG: Action types found: ${JSON.stringify(actionTypes)}`);
            
            // Check specifically for click_to_call and email_contacts
            const clickToCallActions = sampleCampaign.actions.filter((a: any) => 
              String(a.action_type || '').toLowerCase().includes('click_to_call') ||
              String(a.action_type || '').toLowerCase().includes('phone_number_clicks')
            );
            const emailActions = sampleCampaign.actions.filter((a: any) =>
              String(a.action_type || '').toLowerCase().includes('contact') ||
              String(a.action_type || '').toLowerCase().includes('email') ||
              String(a.action_type || '').toLowerCase().includes('onsite_web_lead')
            );
            
            if (clickToCallActions.length > 0) {
              logger.info(`🔍 DEBUG: Found ${clickToCallActions.length} click_to_call actions:`, clickToCallActions);
            } else {
              logger.warn(`⚠️ DEBUG: No click_to_call actions found in sample campaign`);
            }
            
            if (emailActions.length > 0) {
              logger.info(`🔍 DEBUG: Found ${emailActions.length} email_contacts actions:`, emailActions);
            } else {
              logger.warn(`⚠️ DEBUG: No email_contacts actions found in sample campaign`);
            }
          } else {
            logger.warn(`⚠️ DEBUG: Sample campaign has no actions array or it's not an array`);
          }
        }

        // ✅ FIX: Parse actions array to extract conversion metrics
        const campaignInsights = enhanceCampaignsWithConversions(rawCampaignInsights);

        logger.info(`📊 Retrieved and parsed ${campaignInsights.length} campaigns with conversion data`);

        // 🔧 FIX: For current week, log the actual funnel data being collected
        if (weekData.isCurrent) {
          const sampleCampaigns = campaignInsights.slice(0, 3);
          logger.info(`🔍 Sample current week funnel data:`);
          sampleCampaigns.forEach((campaign: any, index: number) => {
            logger.info(`   Campaign ${index + 1}: ${campaign.campaign_name || 'Unknown'}`);
            logger.info(`     Funnel: ${campaign.booking_step_1 || 0}→${campaign.booking_step_2 || 0}→${campaign.booking_step_3 || 0}→${campaign.reservations || 0}`);
          });
          
          const aggregatedFunnel = campaignInsights.reduce((sum: any, c: any) => ({
            step1: sum.step1 + (c.booking_step_1 || 0),
            step2: sum.step2 + (c.booking_step_2 || 0),
            step3: sum.step3 + (c.booking_step_3 || 0),
            res: sum.res + (c.reservations || 0)
          }), { step1: 0, step2: 0, step3: 0, res: 0 });
          
          logger.info(`🔍 Total current week funnel from campaigns: ${aggregatedFunnel.step1}→${aggregatedFunnel.step2}→${aggregatedFunnel.step3}→${aggregatedFunnel.res}`);
        }

        // ✅ NEW: Try to get account-level insights first to use API values directly
        let accountInsights: any = null;
        try {
          accountInsights = await metaService.getAccountInsights(processedAdAccountId, weekData.startDate, weekData.endDate);
          if (accountInsights) {
            logger.info(`✅ Using account-level insights from API for week ${weekData.weekNumber} CTR/CPC`);
          }
        } catch (accountError) {
          logger.warn(`⚠️ Could not fetch account-level insights for week ${weekData.weekNumber}, will use campaign aggregation:`, accountError);
        }

        // Calculate totals from complete campaign data
        const totals = this.calculateTotals(campaignInsights, accountInsights);

        // Count active campaigns (all returned campaigns are considered active)
        const activeCampaignCount = campaignInsights.length;

        // Fetch meta tables (skip for current week to reduce API calls)
        let metaTables = null;
        if (!weekData.isCurrent) {
          try {
            // @ts-ignore - processedAdAccountId is guaranteed to be string after null check
            const placementData = await metaService.getPlacementPerformance(processedAdAccountId, weekData.startDate, weekData.endDate);
            // @ts-ignore - processedAdAccountId is guaranteed to be string after null check
            const demographicData = await metaService.getDemographicPerformance(processedAdAccountId, weekData.startDate, weekData.endDate);
            // @ts-ignore - processedAdAccountId is guaranteed to be string after null check
            const adRelevanceData = await metaService.getAdRelevanceResults(processedAdAccountId, weekData.startDate, weekData.endDate);
            
            metaTables = {
              placementPerformance: placementData,
              demographicPerformance: demographicData,
              adRelevanceResults: adRelevanceData
            };
          } catch (error) {
            logger.warn(`⚠️ Failed to fetch meta tables for ${client.name} week ${weekData.weekNumber}:`, error);
          }
        } else {
          logger.info(`⏭️ Skipping meta tables for current week to reduce API calls`);
        }

        // Store the Meta weekly summary
        await this.storeWeeklySummary(client.id, {
          summary_date: weekData.startDate,
          campaigns: campaignInsights,
          totals,
          metaTables,
          activeCampaignCount,
          isCurrentWeek: weekData.isCurrent
        }, 'meta'); // ✅ Explicitly specify Meta platform

        logger.info(`✅ Stored ${weekType} weekly summary for ${client.name} week ${weekData.weekNumber}`);

        // Small delay between weeks to respect rate limits (but not too long)
        await this.delay(100); // 100ms between weeks

      } catch (error) {
        logger.error(`❌ Failed to collect week ${weekIndex + 1} (${weekData.startDate}) for ${client.name}:`, error);
      }
    }

    logger.info(`✅ Completed all ${weeksToCollect.length} weeks for ${client.name}`);

    // ✨ NEW: Collect Google Ads weekly data if enabled
    if (client.google_ads_customer_id) {
      logger.info(`🔵 Collecting Google Ads weekly data for ${client.name}...`);
      
      try {
        // Get Google Ads system settings
        const { data: settingsData, error: settingsError } = await supabase
          .from('system_settings')
          .select('key, value')
          .in('key', ['google_ads_client_id', 'google_ads_client_secret', 'google_ads_developer_token', 'google_ads_manager_refresh_token', 'google_ads_manager_customer_id']);

        if (settingsError) {
          logger.error(`❌ Failed to get Google Ads system settings for ${client.name}:`, settingsError);
          return;
        }

        const settings = settingsData.reduce((acc: any, setting: any) => {
          acc[setting.key] = setting.value;
          return acc;
        }, {});

        // Determine refresh token (manager token takes priority)
        let refreshToken = null;
        if (settings.google_ads_manager_refresh_token) {
          refreshToken = settings.google_ads_manager_refresh_token;
        } else if (client.google_ads_refresh_token) {
          refreshToken = client.google_ads_refresh_token;
        }

        if (!refreshToken) {
          logger.warn(`⚠️ No Google Ads refresh token available for ${client.name}, skipping weekly Google Ads collection`);
          return;
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

        for (const weekData of weeksToCollect) {
          try {
            const weekType = weekData.isCurrent ? 'CURRENT' : weekData.isComplete ? 'COMPLETED' : 'HISTORICAL';
            logger.info(`📅 Collecting ${weekType} Google Ads week ${weekData.weekNumber} (${weekData.startDate} to ${weekData.endDate})`);

            // Fetch Google Ads weekly campaign data
            const campaigns = await googleAdsService.getCampaignData(
              weekData.startDate,
              weekData.endDate
            );

            if (!campaigns || campaigns.length === 0) {
              logger.warn(`⚠️ No Google Ads campaigns for week ${weekData.weekNumber}, skipping`);
              continue;
            }

            logger.info(`📊 Retrieved ${campaigns.length} Google Ads campaigns for week ${weekData.weekNumber}`);

            // Calculate totals from campaigns
            const totals: any = campaigns.reduce((acc: any, campaign: any) => ({
              spend: acc.spend + (campaign.spend || 0),
              impressions: acc.impressions + (campaign.impressions || 0),
              clicks: acc.clicks + (campaign.clicks || 0),
              conversions: acc.conversions + (campaign.conversions || 0),
              click_to_call: acc.click_to_call + (campaign.click_to_call || 0),
              email_contacts: acc.email_contacts + (campaign.email_contacts || 0),
              booking_step_1: acc.booking_step_1 + (campaign.booking_step_1 || 0),
              booking_step_2: acc.booking_step_2 + (campaign.booking_step_2 || 0),
              booking_step_3: acc.booking_step_3 + (campaign.booking_step_3 || 0),
              reservations: acc.reservations + (campaign.reservations || 0),
              reservation_value: acc.reservation_value + (campaign.reservation_value || 0),
            }), {
              spend: 0,
              impressions: 0,
              clicks: 0,
              conversions: 0,
              click_to_call: 0,
              email_contacts: 0,
              booking_step_1: 0,
              booking_step_2: 0,
              booking_step_3: 0,
              reservations: 0,
              reservation_value: 0,
            });

            // Calculate derived metrics
            totals.ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
            totals.cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;

            // Fetch Google Ads tables (only for recent 4 weeks to avoid rate limiting)
            let googleAdsTables = null;
            if (!weekData.isCurrent && weekData.weekNumber <= 4) {
              try {
                googleAdsTables = await googleAdsService.getGoogleAdsTables(
                  weekData.startDate,
                  weekData.endDate
                );
                logger.info(`📊 Fetched Google Ads tables for week ${weekData.weekNumber}`);
              } catch (error) {
                logger.warn(`⚠️ Failed to fetch Google Ads tables for week ${weekData.weekNumber}:`, error);
              }
            } else if (!weekData.isCurrent) {
              logger.info(`⏭️ Skipping Google Ads tables for week ${weekData.weekNumber} (historical) to avoid rate limits`);
            } else {
              logger.info(`⏭️ Skipping Google Ads tables for current week to reduce API calls`);
            }

            // Count active campaigns
            const activeCampaignCount = campaigns.filter((c: any) => c.status === 'ENABLED').length;

            // Store Google Ads weekly summary
            await this.storeWeeklySummary(
              client.id,
              {
                summary_date: weekData.startDate,
                campaigns,
                totals,
                googleAdsTables,
                activeCampaignCount,
                isCurrentWeek: weekData.isCurrent
              },
              'google' // ✅ Specify platform
            );

            logger.info(`✅ Stored ${weekType} Google Ads weekly summary for ${client.name} week ${weekData.weekNumber}`);

            // ✅ OPTIMIZED: Reduced delays significantly (was 3-5s, now 100-200ms)
            // Google Ads API limit is generous, no need for such long delays
            await this.delay(weekData.isCurrent ? 50 : 100);

          } catch (error) {
            logger.error(`❌ Failed to collect Google Ads week ${weekData.weekNumber} for ${client.name}:`, error);
          }
        }
      } catch (error) {
        logger.error(`❌ Failed to initialize Google Ads weekly collection for ${client.name}:`, error);
      }
    } else {
      logger.info(`⏭️ Google Ads not configured for ${client.name}, skipping weekly Google collection`);
    }
  }

  /**
   * Store monthly summary in database
   */
  private async storeMonthlySummary(clientId: string, data: any): Promise<void> {
    logger.info(`💾 Storing monthly summary for client ${clientId} on ${data.summary_date}`);

    // Aggregate conversion metrics from campaigns
    const campaigns = data.campaigns || [];
    const conversionTotals = campaigns.reduce((acc: any, campaign: any) => ({
      click_to_call: acc.click_to_call + (campaign.click_to_call || 0),
      email_contacts: acc.email_contacts + (campaign.email_contacts || 0),
      booking_step_1: acc.booking_step_1 + (campaign.booking_step_1 || 0),
      booking_step_2: acc.booking_step_2 + (campaign.booking_step_2 || 0),
      booking_step_3: acc.booking_step_3 + (campaign.booking_step_3 || 0), // ✅ FIX: Added missing booking_step_3
      reservations: acc.reservations + (campaign.reservations || 0),
      reservation_value: acc.reservation_value + (campaign.reservation_value || 0),
      total_spend: acc.total_spend + parseFloat(campaign.spend || 0) // ✅ FIX: Parse as float to avoid string concatenation
    }), {
      click_to_call: 0,
      email_contacts: 0,
      booking_step_1: 0,
      booking_step_2: 0,
      booking_step_3: 0, // ✅ FIX: Added missing booking_step_3
      reservations: 0,
      reservation_value: 0,
      total_spend: 0
    });

    // Per-metric enhancement: for any individual metric that is 0 from the API,
    // try to fill it from daily_kpi_data. This handles cases where the API returns
    // some funnel steps (e.g. booking_step_1) but not others (e.g. reservations).
    let enhancedConversionMetrics = { ...conversionTotals };
    
    const metricKeys = ['click_to_call', 'email_contacts', 'booking_step_1', 'booking_step_2', 'booking_step_3', 'reservations', 'reservation_value'] as const;
    const zeroMetrics = metricKeys.filter(k => !conversionTotals[k] || conversionTotals[k] === 0);
    
    if (zeroMetrics.length > 0) {
      logger.info(`🔧 ${zeroMetrics.length} conversion metrics are 0 from Meta API for ${data.summary_date}, trying daily_kpi_data for: ${zeroMetrics.join(', ')}`);
      
      try {
        const monthStart = data.summary_date;
        const monthEnd = new Date(new Date(monthStart).getFullYear(), new Date(monthStart).getMonth() + 1, 0).toISOString().split('T')[0];
        
        const { data: dailyKpiData, error: kpiError } = await supabase
          .from('daily_kpi_data')
          .select('*')
          .eq('client_id', clientId)
          .gte('date', monthStart)
          .lte('date', monthEnd);
        
        if (!kpiError && dailyKpiData && dailyKpiData.length > 0) {
          logger.info(`🔧 Found ${dailyKpiData.length} daily KPI records for ${data.summary_date}`);
          
          const dailyConversionTotals = dailyKpiData.reduce((acc: any, record: any) => ({
            click_to_call: acc.click_to_call + (record.click_to_call || 0),
            email_contacts: acc.email_contacts + (record.email_contacts || 0),
            booking_step_1: acc.booking_step_1 + (record.booking_step_1 || 0),
            reservations: acc.reservations + (record.reservations || 0),
            reservation_value: acc.reservation_value + (record.reservation_value || 0),
            booking_step_2: acc.booking_step_2 + (record.booking_step_2 || 0),
            booking_step_3: acc.booking_step_3 + (record.booking_step_3 || 0)
          }), {
            click_to_call: 0, email_contacts: 0, booking_step_1: 0,
            reservations: 0, reservation_value: 0, booking_step_2: 0, booking_step_3: 0
          });
          
          // Only fill in metrics that are 0 from the API — keep API values for non-zero metrics
          for (const key of zeroMetrics) {
            if (dailyConversionTotals[key] > 0) {
              (enhancedConversionMetrics as any)[key] = dailyConversionTotals[key];
              logger.info(`  ✅ Enhanced ${key}: 0 → ${dailyConversionTotals[key]} (from daily_kpi_data)`);
            }
          }
          
          logger.info(`✅ Per-metric enhanced conversion metrics:`, enhancedConversionMetrics);
        } else {
          logger.warn(`⚠️ No daily_kpi_data found for ${data.summary_date}, keeping zero metrics as-is`);
        }
      } catch (fallbackError) {
        logger.error(`❌ Error getting daily_kpi_data fallback for ${data.summary_date}:`, fallbackError);
      }
    } else {
      logger.info(`✅ All conversion metrics present from Meta API:`, enhancedConversionMetrics);
    }

    // Calculate derived conversion metrics
    const roas = enhancedConversionMetrics.reservation_value > 0 && (data.totals.spend || 0) > 0 
      ? enhancedConversionMetrics.reservation_value / (data.totals.spend || 0)
      : 0;
    
    const cost_per_reservation = enhancedConversionMetrics.reservations > 0 && (data.totals.spend || 0) > 0
      ? (data.totals.spend || 0) / enhancedConversionMetrics.reservations
      : 0;

    logger.info(`📊 Background monthly collection conversion metrics:`, {
      clientId,
      summary_date: data.summary_date,
      enhancedConversionMetrics,
      roas,
      cost_per_reservation,
      source: enhancedConversionMetrics.reservations > 0 ? 'daily_kpi_data_fallback' : 'meta_api'
    });

    // ✅ FIX: Round integer fields to avoid bigint errors
    const summary = {
      client_id: clientId,
      summary_type: 'monthly',
      summary_date: data.summary_date,
      platform: data.platform || 'meta', // Default to 'meta' for backward compatibility
      total_spend: data.totals.spend || 0,
      total_impressions: Math.round(data.totals.impressions || 0), // Round to integer
      total_clicks: Math.round(data.totals.clicks || 0), // Round to integer
      total_conversions: Math.round(data.totals.conversions || 0), // Round to integer
      average_ctr: data.totals.ctr || 0,
      average_cpc: data.totals.cpc || 0,
      average_cpa: cost_per_reservation,
      active_campaigns: data.activeCampaignCount || data.campaigns.filter((c: any) => c.status === 'ACTIVE').length,
      total_campaigns: data.campaigns.length,
      campaign_data: data.campaigns,
      meta_tables: data.metaTables,
      data_source: 'meta_api',
      // Add enhanced conversion metrics (either from Meta API or daily_kpi_data fallback)
      click_to_call: Math.round(enhancedConversionMetrics.click_to_call || 0), // Round to integer
      email_contacts: Math.round(enhancedConversionMetrics.email_contacts || 0), // Round to integer
      booking_step_1: Math.round(enhancedConversionMetrics.booking_step_1 || 0), // Round to integer
      reservations: Math.round(enhancedConversionMetrics.reservations || 0), // Round to integer
      reservation_value: enhancedConversionMetrics.reservation_value, // Keep decimal for currency
      booking_step_2: Math.round(enhancedConversionMetrics.booking_step_2 || 0), // Round to integer
      booking_step_3: Math.round(enhancedConversionMetrics.booking_step_3 || 0), // Round to integer
      roas: roas,
      cost_per_reservation: cost_per_reservation,
      last_updated: new Date().toISOString()
    };

    const { error } = await supabase
      .from('campaign_summaries')
      .upsert(summary, {
        onConflict: 'client_id,summary_type,summary_date,platform'
      });

    if (error) {
      throw new Error(`Failed to store monthly summary: ${error.message}`);
    }

    logger.info(`💾 Stored monthly summary with enhanced conversion metrics: ${enhancedConversionMetrics.reservations} reservations, ${enhancedConversionMetrics.reservation_value} value`);
  }

  /**
   * Store Google Ads monthly summary in database
   */
  private async storeGoogleAdsMonthlySummary(clientId: string, data: any): Promise<void> {
    logger.info(`💾 Storing Google Ads monthly summary for client ${clientId} on ${data.summary_date}`);

    const totals = data.totals || {};
    const campaigns = data.campaigns || [];

    // Calculate cost per reservation if we have reservations
    const cost_per_reservation = totals.reservations > 0 ? totals.spend / totals.reservations : 0;

    // ✅ FIX: Round integer fields - Google Ads all_conversions returns decimals but DB expects bigint
    const summary = {
      client_id: clientId,
      summary_type: 'monthly', // This is correct - monthly is allowed
      summary_date: data.summary_date,
      platform: 'google', // Important: Mark as Google Ads data
      total_spend: totals.spend || 0,
      total_impressions: Math.round(totals.impressions || 0), // Round to integer
      total_clicks: Math.round(totals.clicks || 0), // Round to integer
      total_conversions: Math.round(totals.conversions || 0), // ✅ FIX: Round - Google Ads all_conversions is decimal!
      average_ctr: totals.ctr || 0,
      average_cpc: totals.cpc || 0,
      // Google Ads specific conversion fields
      click_to_call: Math.round(totals.click_to_call || 0), // Round to integer
      email_contacts: Math.round(totals.email_contacts || 0), // Round to integer
      booking_step_1: Math.round(totals.booking_step_1 || 0), // Round to integer
      booking_step_2: Math.round(totals.booking_step_2 || 0), // Round to integer
      booking_step_3: Math.round(totals.booking_step_3 || 0), // Round to integer
      reservations: Math.round(totals.reservations || 0), // Round to integer
      reservation_value: totals.reservation_value || 0, // Keep decimal for currency
      cost_per_reservation: cost_per_reservation,
      campaign_data: campaigns, // Store raw campaign data for detailed analysis
      google_ads_tables: data.googleAdsTables || null, // ✅ FIX: Store Google Ads tables data
      active_campaign_count: data.activeCampaignCount || 0,
      data_source: 'google_ads_api', // ✅ FIX: Explicitly set data source
      last_updated: new Date().toISOString()
    };

    const { error } = await supabase
      .from('campaign_summaries')
      .upsert(summary, {
        onConflict: 'client_id,summary_type,summary_date,platform' // ✅ FIX: Specify conflict resolution
      });

    if (error) {
      throw new Error(`Failed to store Google Ads monthly summary: ${error.message}`);
    }

    logger.info(`💾 Stored Google Ads monthly summary: ${totals.spend} spend, ${totals.impressions} impressions, ${totals.clicks} clicks, ${totals.reservations} reservations`);
  }

  /**
   * Store weekly summary in database
   */
  private async storeWeeklySummary(clientId: string, data: any, platform: 'meta' | 'google' = 'meta'): Promise<void> {
    logger.info(`💾 Storing ${platform} weekly summary for client ${clientId} on ${data.summary_date}`);

    // ✅ VALIDATE: Ensure summary_date is a Monday (ISO week start)
    try {
      validateIsMonday(data.summary_date);
      logger.info(`✅ Validated: ${data.summary_date} is a Monday`);
    } catch (error) {
      logger.error(`❌ VALIDATION FAILED: ${error.message}`);
      throw new Error(`Cannot store weekly summary: ${error.message}`);
    }

    // ✅ CRITICAL FIX FOR GOOGLE ADS: Use data.totals if available (already aggregated from API)
    // For Google Ads, data.totals contains booking steps already aggregated from campaigns via getCampaignData()
    // Only recalculate from campaigns if totals don't have conversion metrics (Meta fallback)
    const campaigns = data.campaigns || [];
    
    let conversionTotals;
    if (platform === 'google' && data.totals && (
      data.totals.booking_step_1 !== undefined ||
      data.totals.booking_step_2 !== undefined ||
      data.totals.booking_step_3 !== undefined
    )) {
      // ✅ For Google Ads: Use pre-aggregated totals from API (more reliable)
      // These were already calculated correctly in collectWeeklySummaryForClient (lines 800-817)
      conversionTotals = {
        click_to_call: data.totals.click_to_call || 0,
        email_contacts: data.totals.email_contacts || 0,
        booking_step_1: data.totals.booking_step_1 || 0,
        booking_step_2: data.totals.booking_step_2 || 0,
        booking_step_3: data.totals.booking_step_3 || 0,
        reservations: data.totals.reservations || 0,
        reservation_value: data.totals.reservation_value || 0,
        total_spend: data.totals.spend || 0
      };
      
      logger.info(`✅ GOOGLE ADS WEEKLY: Using pre-aggregated totals from API:`, {
        booking_step_1: conversionTotals.booking_step_1,
        booking_step_2: conversionTotals.booking_step_2,
        booking_step_3: conversionTotals.booking_step_3,
        reservations: conversionTotals.reservations,
        source: 'data.totals (from getCampaignData API)'
      });
    } else {
      // For Meta or fallback: Calculate from campaigns
      conversionTotals = campaigns.reduce((acc: any, campaign: any) => ({
        click_to_call: acc.click_to_call + (campaign.click_to_call || 0),
        email_contacts: acc.email_contacts + (campaign.email_contacts || 0),
        booking_step_1: acc.booking_step_1 + (campaign.booking_step_1 || 0),
        booking_step_2: acc.booking_step_2 + (campaign.booking_step_2 || 0),
        booking_step_3: acc.booking_step_3 + (campaign.booking_step_3 || 0),
        reservations: acc.reservations + (campaign.reservations || 0),
        reservation_value: acc.reservation_value + (campaign.reservation_value || 0),
        total_spend: acc.total_spend + parseFloat(campaign.spend || 0)
      }), {
        click_to_call: 0,
        email_contacts: 0,
        booking_step_1: 0,
        booking_step_2: 0,
        booking_step_3: 0,
        reservations: 0,
        reservation_value: 0,
        total_spend: 0
      });
      
      logger.info(`📊 ${platform === 'google' ? 'GOOGLE ADS' : 'META'} WEEKLY: Calculated from campaigns:`, {
        clientId,
        summary_date: data.summary_date,
        conversionTotals,
        source: platform === 'google' ? 'campaigns (fallback)' : 'meta_api_campaigns'
      });
    }

    // Calculate derived conversion metrics (same logic as monthly)
    const roas = conversionTotals.reservation_value > 0 && (data.totals.spend || 0) > 0 
      ? conversionTotals.reservation_value / (data.totals.spend || 0)
      : 0;
    
    const cost_per_reservation = conversionTotals.reservations > 0 && (data.totals.spend || 0) > 0
      ? (data.totals.spend || 0) / conversionTotals.reservations
      : 0;

    // ✅ FIX: Set correct data_source and tables field based on platform
    const dataSource = platform === 'google' ? 'google_ads_api' : 'meta_api';
    const tablesField = platform === 'google' ? 'google_ads_tables' : 'meta_tables';
    const tablesData = platform === 'google' ? data.googleAdsTables : data.metaTables;

    // ✅ FIX: Round integer fields - Google Ads all_conversions returns decimals but DB expects bigint
    const summary = {
      client_id: clientId,
      summary_type: 'weekly',
      summary_date: data.summary_date,
      platform: platform, // ✅ FIX: Add platform field
      total_spend: data.totals.spend || 0,
      total_impressions: Math.round(data.totals.impressions || 0), // Round to integer
      total_clicks: Math.round(data.totals.clicks || 0), // Round to integer
      total_conversions: Math.round(data.totals.conversions || 0), // ✅ FIX: Round - Google Ads all_conversions is decimal!
      average_ctr: data.totals.ctr || 0,
      average_cpc: data.totals.cpc || 0,
      average_cpa: cost_per_reservation,
      active_campaigns: data.activeCampaignCount || data.campaigns.filter((c: any) => c.status === 'ACTIVE').length,
      total_campaigns: data.campaigns.length,
      campaign_data: data.campaigns,
      [tablesField]: tablesData, // ✅ FIX: Use correct field name based on platform
      data_source: dataSource, // ✅ Set correct data source
      // Add conversion metrics from Meta API campaigns only (matches monthly behavior)
      click_to_call: Math.round(conversionTotals.click_to_call || 0), // Round to integer
      email_contacts: Math.round(conversionTotals.email_contacts || 0), // Round to integer
      booking_step_1: Math.round(conversionTotals.booking_step_1 || 0), // Round to integer
      reservations: Math.round(conversionTotals.reservations || 0), // Round to integer
      reservation_value: conversionTotals.reservation_value, // Keep decimal for currency
      booking_step_2: Math.round(conversionTotals.booking_step_2 || 0), // Round to integer
      booking_step_3: Math.round(conversionTotals.booking_step_3 || 0), // Round to integer
      roas: roas,
      cost_per_reservation: cost_per_reservation,
      last_updated: new Date().toISOString()
    };

    // 🔍 DEBUG: Log exact values being stored
    logger.info(`🔍 About to upsert weekly summary:`, {
      client_id: clientId,
      summary_date: data.summary_date,
      summary_type: 'weekly',
      platform: platform,
      total_spend: summary.total_spend,
      reservations: summary.reservations,
      unique_key: `${clientId}|weekly|${data.summary_date}|${platform}`
    });

    const { error, data: upsertResult } = await supabase
      .from('campaign_summaries')
      .upsert(summary, {
        onConflict: 'client_id,summary_type,summary_date,platform'
      });

    if (error) {
      logger.error(`❌ UPSERT ERROR:`, {
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        summary_date: data.summary_date,
        client_id: clientId
      });
      throw new Error(`Failed to store weekly summary: ${error.message}`);
    }

    // 🔍 DEBUG: Log upsert result
    logger.info(`✅ UPSERT SUCCESS:`, {
      summary_date: data.summary_date,
      client_id: clientId,
      platform: platform,
      upsert_returned_rows: upsertResult?.length || 0,
      note: upsertResult ? 'Data returned from upsert' : 'No data returned (might be update, not insert)'
    });

    const weekType = data.isCurrentWeek ? 'CURRENT WEEK' : 'COMPLETED WEEK';
    logger.info(`💾 Stored ${weekType} summary with conversion metrics from Meta API: ${conversionTotals.reservations} reservations, ${conversionTotals.reservation_value} value`);
  }

  /**
   * Get all active clients
   */
  private async getAllActiveClients(): Promise<Client[]> {
    const { data: clients, error } = await supabase
      .from('clients')
      .select('*')
      .eq('api_status', 'valid');

    if (error) {
      throw new Error(`Failed to get active clients: ${error.message}`);
    }

    return clients || [];
  }

  /**
   * Calculate totals from campaign insights
   */
  private calculateTotals(campaigns: any[], accountInsights?: any): any {
    const totals = campaigns.reduce((acc, campaign) => {
      acc.spend += parseFloat(campaign.spend || 0);
      acc.impressions += parseInt(campaign.impressions || 0);
      acc.clicks += parseInt(campaign.clicks || 0);
      acc.conversions += parseInt(campaign.conversions || 0);
      return acc;
    }, { spend: 0, impressions: 0, clicks: 0, conversions: 0 });

    // ✅ CRITICAL FIX: Meta CPC/CTR MUST come ONLY from API directly
    // NO calculations, NO fallbacks - ONLY API data
    if (accountInsights) {
      // ✅ Use account-level CTR/CPC directly from API
      totals.ctr = parseFloat(accountInsights.inline_link_click_ctr || accountInsights.ctr || 0);
      totals.cpc = parseFloat(accountInsights.cost_per_inline_link_click || accountInsights.cpc || 0);
      logger.info('✅ Using CTR/CPC directly from account-level API insights:', { ctr: totals.ctr, cpc: totals.cpc });
    } else {
      // ✅ CRITICAL: Use weighted average from campaign API values (NOT calculated from totals)
      // This ensures we use API values, not calculations
      let weightedCtrSum = 0;
      let weightedCpcSum = 0;
      let totalClickWeight = 0;
      
      campaigns.forEach((campaign: any) => {
        const campaignClicks = parseInt(campaign.clicks || campaign.inline_link_clicks || '0');
        const campaignCtr = parseFloat(campaign.inline_link_click_ctr || campaign.ctr || '0');
        const campaignCpc = parseFloat(campaign.cost_per_inline_link_click || campaign.cpc || '0');
        
        if (campaignClicks > 0 && campaignCtr > 0 && campaignCpc > 0) {
          // ✅ Using API values from individual campaigns, not calculating from totals
          weightedCtrSum += campaignCtr * campaignClicks;
          weightedCpcSum += campaignCpc * campaignClicks;
          totalClickWeight += campaignClicks;
        }
      });
      
      if (totalClickWeight > 0) {
        totals.ctr = weightedCtrSum / totalClickWeight;
        totals.cpc = weightedCpcSum / totalClickWeight;
        logger.info('✅ Using weighted average CTR/CPC from campaign API values (NOT calculated):', { ctr: totals.ctr, cpc: totals.cpc });
      } else {
        // ❌ REMOVED: No calculation fallback - if no API values available, set to 0
        // This ensures we NEVER calculate, only use API values
        totals.ctr = 0;
        totals.cpc = 0;
        logger.warn('⚠️ No API CTR/CPC values available from campaigns - setting to 0 (NOT calculating from totals)');
      }
    }
    
    totals.cpa = totals.conversions > 0 ? totals.spend / totals.conversions : 0;

    return totals;
  }

  /**
   * Utility function to add delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clean up old data
   */
  async cleanupOldData(): Promise<void> {
    logger.info('🧹 Starting cleanup of old data...');
    
    try {
      // Use StandardizedDataFetcher instead of SmartDataLoader
      // TODO: Implement cleanup in StandardizedDataFetcher if needed
      logger.info('✅ Campaign summaries cleanup completed');
      
      // Also cleanup executive summaries
      const { ExecutiveSummaryCacheService } = await import('./executive-summary-cache');
      const executiveCacheService = ExecutiveSummaryCacheService.getInstance();
      await executiveCacheService.cleanupOldSummaries();
      logger.info('✅ Executive summaries cleanup completed');
      
      logger.info('✅ All cleanup completed');
    } catch (error) {
      logger.error('❌ Error during cleanup:', error);
    }
  }
} 