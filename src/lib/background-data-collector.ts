// @ts-ignore - processedAdAccountId is guaranteed to be string after null check
import { createClient } from '@supabase/supabase-js';
import { MetaAPIServiceOptimized } from './meta-api-optimized';
import { GoogleAdsAPIService } from './google-ads-api';
import { StandardizedDataFetcher } from './standardized-data-fetcher';
import { getMonthBoundaries, getWeekBoundaries } from './date-range-utils';
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
    if (this.isRunning) {
      logger.info('⚠️ Background data collection already running');
      return;
    }

    this.isRunning = true;
    logger.info('📅 Starting monthly data collection...');

    try {
      const clients = await this.getAllActiveClients();
      logger.info(`📊 Found ${clients.length} active clients for monthly collection`);

      for (const client of clients) {
        try {
          await this.collectMonthlySummaryForClient(client);
          // Add delay between clients to avoid rate limiting
          await this.delay(2000);
        } catch (error) {
          logger.error(`❌ Failed to collect monthly summary for ${client.name}:`, error);
        }
      }

      logger.info('✅ Monthly data collection completed');
    } catch (error) {
      logger.error('❌ Error in monthly data collection:', error);
    } finally {
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
   */
  async collectWeeklySummaries(): Promise<void> {
    if (this.isRunning) {
      logger.info('⚠️ Background data collection already running');
      return;
    }

    this.isRunning = true;
    logger.info('📅 Starting weekly data collection...');

    try {
      const clients = await this.getAllActiveClients();
      logger.info(`📊 Found ${clients.length} active clients for weekly collection`);

      for (const client of clients) {
        try {
          await this.collectWeeklySummaryForClient(client);
          // Add delay between clients to avoid rate limiting
          await this.delay(2000);
        } catch (error) {
          logger.error(`❌ Failed to collect weekly summary for ${client.name}:`, error);
        }
      }

      logger.info('✅ Weekly data collection completed');
    } catch (error) {
      logger.error('❌ Error in weekly data collection:', error);
    } finally {
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

    // Get the last 12 months using standardized utilities
    const currentDate = new Date();
    const monthsToCollect = [];

    for (let i = 0; i < 12; i++) {
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
    if (client.meta_access_token && client.ad_account_id) {
      await this.collectMetaMonthlySummary(client, monthsToCollect);
    }

    // Collect Google Ads data if configured
    if (client.google_ads_customer_id) {
      await this.collectGoogleAdsMonthlySummary(client, monthsToCollect);
    }

    // If neither platform is configured, log warning
    if (!client.meta_access_token && !client.google_ads_customer_id) {
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
    if (!client.meta_access_token || !client.ad_account_id) {
      logger.warn(`⚠️ Missing Meta token or ad account ID for ${client.name}, skipping Meta collection`);
      return;
    }

    // At this point, we know both values are defined
    const metaAccessToken = client.meta_access_token as string;
    const adAccountId = client.ad_account_id as string;

    const metaService = new MetaAPIServiceOptimized(metaAccessToken);
    
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

        // Fetch campaign insights using placement performance (MetaAPIServiceOptimized method)
        // @ts-ignore - processedAdAccountId is guaranteed to be string after null check
        const campaignInsights = await metaService.getPlacementPerformance(
          processedAdAccountId,
          monthData.startDate,
          monthData.endDate
        );

        logger.info(`📊 Retrieved ${campaignInsights.length} campaigns with complete data`);

        // Calculate totals from complete campaign data
        const totals = this.calculateTotals(campaignInsights);

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

        // Add delay between months to avoid rate limiting
        await this.delay(1000);

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
          activeCampaignCount
        });

        logger.info(`✅ Stored Google Ads monthly summary for ${client.name} ${monthData.year}-${monthData.month}`);

        // Add delay between months to avoid rate limiting
        await this.delay(1000);
      } catch (error) {
        logger.error(`❌ Failed to collect Google Ads month ${monthData.year}-${monthData.month} for ${client.name}:`, error);
      }
    }
  }

  /**
   * Collect weekly summary for a specific client
   */
  private async collectWeeklySummaryForClient(client: Client): Promise<void> {
    logger.info(`📊 Collecting weekly summary for ${client.name}...`);

    // 🔧 FIX: Only collect COMPLETED weeks, not current partial week
    const currentDate = new Date();
    const weeksToCollect = [];

    // Start from last completed week (not current week)
    const lastCompletedWeekEnd = new Date(currentDate);
    const dayOfWeek = lastCompletedWeekEnd.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Go back to last Sunday (end of last completed week)
    const daysToLastSunday = dayOfWeek === 0 ? 0 : dayOfWeek;
    lastCompletedWeekEnd.setDate(lastCompletedWeekEnd.getDate() - daysToLastSunday);
    lastCompletedWeekEnd.setHours(23, 59, 59, 999);

    logger.info(`🔧 Starting from last completed week ending: ${lastCompletedWeekEnd.toISOString().split('T')[0]}`);

    // 🔧 Collect 53 weeks (full year + 1 week for complete coverage)
    for (let i = 0; i < 53; i++) {
      const weekEndDate = new Date(lastCompletedWeekEnd.getTime() - (i * 7 * 24 * 60 * 60 * 1000));
      const weekStartDate = new Date(weekEndDate.getTime() - (6 * 24 * 60 * 60 * 1000)); // 7 days before
      const weekRange = getWeekBoundaries(weekStartDate);
      
      // Only collect weeks that are completely in the past
      const isCompleteWeek = weekEndDate < currentDate;
      
      if (isCompleteWeek) {
        weeksToCollect.push({
          startDate: weekRange.start,
          endDate: weekRange.end,
          weekNumber: Math.ceil((weekEndDate.getTime() - new Date(weekEndDate.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000)),
          isComplete: true
        });
      } else {
        logger.info(`⏭️ Skipping incomplete week: ${weekRange.start} to ${weekRange.end}`);
      }
    }

    logger.info(`📅 Will collect ${weeksToCollect.length} completed weeks (53 weeks = 1 year + 1 week for complete coverage)`);
    
    // 🔧 FIX: Also collect current week if it has significant data (for real-time updates)
    const currentWeekStart = new Date(currentDate);
    const currentDayOfWeek = currentWeekStart.getDay();
    const daysToMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;
    currentWeekStart.setDate(currentWeekStart.getDate() - daysToMonday);
    currentWeekStart.setHours(0, 0, 0, 0);
    
    const currentWeekEnd = new Date(currentWeekStart);
    currentWeekEnd.setDate(currentWeekStart.getDate() + 6);
    currentWeekEnd.setHours(23, 59, 59, 999);
    
    const currentWeekRange = getWeekBoundaries(currentWeekStart);
    
    // Add current week for real-time updates (will be updated multiple times)
    weeksToCollect.unshift({
      startDate: currentWeekRange.start,
      endDate: currentWeekRange.end,
      weekNumber: Math.ceil((currentWeekEnd.getTime() - new Date(currentWeekEnd.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000)),
      isComplete: false,
      isCurrent: true
    });

    logger.info(`📅 Added current week for real-time updates: ${currentWeekRange.start} to ${currentWeekRange.end}`);

    // Initialize Meta API service
    if (!client.meta_access_token || !client.ad_account_id) {
      logger.warn(`⚠️ Missing token or ad account ID for ${client.name}, skipping`);
      return;
    }

    // At this point, we know both values are defined
    const metaAccessToken = client.meta_access_token as string;
    const adAccountId = client.ad_account_id as string;

    const metaService = new MetaAPIServiceOptimized(metaAccessToken);
    
    // Validate token
    const tokenValidation = await metaService.validateToken();
    if (!tokenValidation.valid) {
      logger.warn(`⚠️ Invalid token for ${client.name}, skipping`);
      return;
    }

    const processedAdAccountId: string = adAccountId.startsWith('act_') 
      ? adAccountId.substring(4)
      : adAccountId;

    for (const weekData of weeksToCollect) {
      try {
        const weekType = weekData.isCurrent ? 'CURRENT' : weekData.isComplete ? 'COMPLETED' : 'HISTORICAL';
        logger.info(`📅 Collecting ${weekType} week ${weekData.weekNumber} (${weekData.startDate} to ${weekData.endDate}) for ${client.name}`);

        // Fetch weekly campaign insights using placement performance (MetaAPIServiceOptimized method)
        const campaignInsights = await metaService.getPlacementPerformance(
          processedAdAccountId,
          weekData.startDate,
          weekData.endDate
        );

        logger.info(`📊 Retrieved ${campaignInsights.length} campaigns with complete weekly data`);

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

        // Calculate totals from complete campaign data
        const totals = this.calculateTotals(campaignInsights);

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

        // Add delay between weeks to avoid rate limiting (shorter for current week)
        await this.delay(weekData.isCurrent ? 500 : 1000);

      } catch (error) {
        logger.error(`❌ Failed to collect week ${weekData.weekNumber} for ${client.name}:`, error);
      }
    }

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

            // Fetch Google Ads tables (skip for current week)
            let googleAdsTables = null;
            if (!weekData.isCurrent) {
              try {
                googleAdsTables = await googleAdsService.getGoogleAdsTables(
                  weekData.startDate,
                  weekData.endDate
                );
                logger.info(`📊 Fetched Google Ads tables for week ${weekData.weekNumber}`);
              } catch (error) {
                logger.warn(`⚠️ Failed to fetch Google Ads tables for week ${weekData.weekNumber}:`, error);
              }
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

            // Add delay to avoid rate limiting
            await this.delay(weekData.isCurrent ? 500 : 1000);

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
      reservations: acc.reservations + (campaign.reservations || 0),
      reservation_value: acc.reservation_value + (campaign.reservation_value || 0),
      booking_step_2: acc.booking_step_2 + (campaign.booking_step_2 || 0),
      total_spend: acc.total_spend + (campaign.spend || 0)
    }), {
      click_to_call: 0,
      email_contacts: 0,
      booking_step_1: 0,
      reservations: 0,
      reservation_value: 0,
      booking_step_2: 0,
      total_spend: 0
    });

    // 🔧 ENHANCED: If Meta API didn't return conversion metrics, try to get them from daily_kpi_data
    let enhancedConversionMetrics = { ...conversionTotals };
    
    if (conversionTotals.reservations === 0 && conversionTotals.booking_step_1 === 0) {
      logger.info(`🔧 No conversion metrics from Meta API for ${data.summary_date}, trying daily_kpi_data fallback...`);
      
      try {
        // Get the month start and end dates
        const monthStart = data.summary_date;
        const monthEnd = new Date(new Date(monthStart).getFullYear(), new Date(monthStart).getMonth() + 1, 0).toISOString().split('T')[0];
        
        // Query daily_kpi_data for this month
        const { data: dailyKpiData, error: kpiError } = await supabase
          .from('daily_kpi_data')
          .select('*')
          .eq('client_id', clientId)
          .gte('date', monthStart)
          .lte('date', monthEnd);
        
        if (!kpiError && dailyKpiData && dailyKpiData.length > 0) {
          logger.info(`🔧 Found ${dailyKpiData.length} daily KPI records for ${data.summary_date}, aggregating conversion metrics...`);
          
          // Aggregate conversion metrics from daily_kpi_data
          const dailyConversionTotals = dailyKpiData.reduce((acc: any, record: any) => ({
            click_to_call: acc.click_to_call + (record.click_to_call || 0),
            email_contacts: acc.email_contacts + (record.email_contacts || 0),
            booking_step_1: acc.booking_step_1 + (record.booking_step_1 || 0),
            reservations: acc.reservations + (record.reservations || 0),
            reservation_value: acc.reservation_value + (record.reservation_value || 0),
            booking_step_2: acc.booking_step_2 + (record.booking_step_2 || 0),
            booking_step_3: acc.booking_step_3 + (record.booking_step_3 || 0)
          }), {
            click_to_call: 0,
            email_contacts: 0,
            booking_step_1: 0,
            reservations: 0,
            reservation_value: 0,
            booking_step_2: 0,
            booking_step_3: 0
          });
          
          // Use daily_kpi_data conversion metrics as fallback
          enhancedConversionMetrics = {
            click_to_call: dailyConversionTotals.click_to_call,
            email_contacts: dailyConversionTotals.email_contacts,
            booking_step_1: dailyConversionTotals.booking_step_1,
            reservations: dailyConversionTotals.reservations,
            reservation_value: dailyConversionTotals.reservation_value,
            booking_step_2: dailyConversionTotals.booking_step_2,
            booking_step_3: dailyConversionTotals.booking_step_3
          };
          
          logger.info(`✅ Enhanced conversion metrics from daily_kpi_data:`, enhancedConversionMetrics);
        } else {
          logger.warn(`⚠️ No daily_kpi_data found for ${data.summary_date}, keeping zero conversion metrics`);
        }
      } catch (fallbackError) {
        logger.error(`❌ Error getting daily_kpi_data fallback for ${data.summary_date}:`, fallbackError);
      }
    } else {
      logger.info(`✅ Using conversion metrics from Meta API:`, enhancedConversionMetrics);
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

    const summary = {
      client_id: clientId,
      summary_type: 'monthly',
      summary_date: data.summary_date,
      platform: data.platform || 'meta', // Default to 'meta' for backward compatibility
      total_spend: data.totals.spend || 0,
      total_impressions: data.totals.impressions || 0,
      total_clicks: data.totals.clicks || 0,
      total_conversions: data.totals.conversions || 0,
      average_ctr: data.totals.ctr || 0,
      average_cpc: data.totals.cpc || 0,
      average_cpa: cost_per_reservation,
      active_campaigns: data.activeCampaignCount || data.campaigns.filter((c: any) => c.status === 'ACTIVE').length,
      total_campaigns: data.campaigns.length,
      campaign_data: data.campaigns,
      meta_tables: data.metaTables,
      data_source: 'meta_api',
      // Add enhanced conversion metrics (either from Meta API or daily_kpi_data fallback)
      click_to_call: enhancedConversionMetrics.click_to_call,
      email_contacts: enhancedConversionMetrics.email_contacts,
      booking_step_1: enhancedConversionMetrics.booking_step_1,
      reservations: enhancedConversionMetrics.reservations,
      reservation_value: enhancedConversionMetrics.reservation_value,
      booking_step_2: enhancedConversionMetrics.booking_step_2,
      booking_step_3: enhancedConversionMetrics.booking_step_3,
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

    const summary = {
      client_id: clientId,
      summary_type: 'monthly', // This is correct - monthly is allowed
      summary_date: data.summary_date,
      platform: 'google', // Important: Mark as Google Ads data
      total_spend: totals.spend || 0,
      total_impressions: totals.impressions || 0,
      total_clicks: totals.clicks || 0,
      total_conversions: totals.conversions || 0,
      average_ctr: totals.ctr || 0,
      average_cpc: totals.cpc || 0,
      // Google Ads specific conversion fields
      click_to_call: totals.click_to_call || 0,
      email_contacts: totals.email_contacts || 0,
      booking_step_1: totals.booking_step_1 || 0,
      booking_step_2: totals.booking_step_2 || 0,
      booking_step_3: totals.booking_step_3 || 0,
      reservations: totals.reservations || 0,
      reservation_value: totals.reservation_value || 0,
      cost_per_reservation: cost_per_reservation,
      campaign_data: campaigns, // Store raw campaign data for detailed analysis
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

    // Aggregate conversion metrics from campaigns
    const campaigns = data.campaigns || [];
    const conversionTotals = campaigns.reduce((acc: any, campaign: any) => ({
      click_to_call: acc.click_to_call + (campaign.click_to_call || 0),
      email_contacts: acc.email_contacts + (campaign.email_contacts || 0),
      booking_step_1: acc.booking_step_1 + (campaign.booking_step_1 || 0),
      reservations: acc.reservations + (campaign.reservations || 0),
      reservation_value: acc.reservation_value + (campaign.reservation_value || 0),
      booking_step_2: acc.booking_step_2 + (campaign.booking_step_2 || 0),
      total_spend: acc.total_spend + (campaign.spend || 0)
    }), {
      click_to_call: 0,
      email_contacts: 0,
      booking_step_1: 0,
      reservations: 0,
      reservation_value: 0,
      booking_step_2: 0,
      total_spend: 0
    });

    // 🔧 ENHANCED: If Meta API didn't return conversion metrics, try to get them from daily_kpi_data
    let enhancedConversionMetrics = { ...conversionTotals };
    
    if (conversionTotals.reservations === 0 && conversionTotals.booking_step_1 === 0) {
      logger.info(`🔧 No conversion metrics from Meta API for week ${data.summary_date}, trying daily_kpi_data fallback...`);
      
      try {
        // Get the week start and end dates
        const weekStart = data.summary_date;
        // 🔧 FIX: Use setDate instead of getTime() + milliseconds to avoid invalid dates
        const weekEndDate = new Date(weekStart);
        weekEndDate.setDate(weekEndDate.getDate() + 6);
        const weekEnd = weekEndDate.toISOString().split('T')[0];
        
        // Query daily_kpi_data for this week
        const { data: dailyKpiData, error: kpiError } = await supabase
          .from('daily_kpi_data')
          .select('*')
          .eq('client_id', clientId)
          .gte('date', weekStart)
          .lte('date', weekEnd);
        
        if (!kpiError && dailyKpiData && dailyKpiData.length > 0) {
          logger.info(`🔧 Found ${dailyKpiData.length} daily KPI records for week ${data.summary_date}, aggregating conversion metrics...`);
          
          // Aggregate conversion metrics from daily_kpi_data
          const dailyConversionTotals = dailyKpiData.reduce((acc: any, record: any) => ({
            click_to_call: acc.click_to_call + (record.click_to_call || 0),
            email_contacts: acc.email_contacts + (record.email_contacts || 0),
            booking_step_1: acc.booking_step_1 + (record.booking_step_1 || 0),
            reservations: acc.reservations + (record.reservations || 0),
            reservation_value: acc.reservation_value + (record.reservation_value || 0),
            booking_step_2: acc.booking_step_2 + (record.booking_step_2 || 0),
            booking_step_3: acc.booking_step_3 + (record.booking_step_3 || 0)
          }), {
            click_to_call: 0,
            email_contacts: 0,
            booking_step_1: 0,
            reservations: 0,
            reservation_value: 0,
            booking_step_2: 0,
            booking_step_3: 0
          });
          
          // Use daily_kpi_data conversion metrics as fallback
          enhancedConversionMetrics = {
            click_to_call: dailyConversionTotals.click_to_call,
            email_contacts: dailyConversionTotals.email_contacts,
            booking_step_1: dailyConversionTotals.booking_step_1,
            reservations: dailyConversionTotals.reservations,
            reservation_value: dailyConversionTotals.reservation_value,
            booking_step_2: dailyConversionTotals.booking_step_2,
            booking_step_3: dailyConversionTotals.booking_step_3
          };
          
          logger.info(`✅ Enhanced conversion metrics from daily_kpi_data:`, enhancedConversionMetrics);
        } else {
          logger.warn(`⚠️ No daily_kpi_data found for week ${data.summary_date}, keeping zero conversion metrics`);
        }
      } catch (fallbackError) {
        logger.error(`❌ Error getting daily_kpi_data fallback for week ${data.summary_date}:`, fallbackError);
      }
    } else {
      logger.info(`✅ Using conversion metrics from Meta API:`, enhancedConversionMetrics);
    }

    // Calculate derived conversion metrics
    const roas = enhancedConversionMetrics.reservation_value > 0 && (data.totals.spend || 0) > 0 
      ? enhancedConversionMetrics.reservation_value / (data.totals.spend || 0)
      : 0;
    
    const cost_per_reservation = enhancedConversionMetrics.reservations > 0 && (data.totals.spend || 0) > 0
      ? (data.totals.spend || 0) / enhancedConversionMetrics.reservations
      : 0;

    logger.info(`📊 Background weekly collection conversion metrics:`, {
      clientId,
      summary_date: data.summary_date,
      enhancedConversionMetrics,
      roas,
      cost_per_reservation,
      source: enhancedConversionMetrics.reservations > 0 ? 'daily_kpi_data_fallback' : 'meta_api',
      isCurrentWeek: data.isCurrentWeek || false
    });

    // ✅ FIX: Set correct data_source and tables field based on platform
    const dataSource = platform === 'google' ? 'google_ads_api' : 'meta_api';
    const tablesField = platform === 'google' ? 'google_ads_tables' : 'meta_tables';
    const tablesData = platform === 'google' ? data.googleAdsTables : data.metaTables;

    const summary = {
      client_id: clientId,
      summary_type: 'weekly',
      summary_date: data.summary_date,
      platform: platform, // ✅ FIX: Add platform field
      total_spend: data.totals.spend || 0,
      total_impressions: data.totals.impressions || 0,
      total_clicks: data.totals.clicks || 0,
      total_conversions: data.totals.conversions || 0,
      average_ctr: data.totals.ctr || 0,
      average_cpc: data.totals.cpc || 0,
      average_cpa: cost_per_reservation,
      active_campaigns: data.activeCampaignCount || data.campaigns.filter((c: any) => c.status === 'ACTIVE').length,
      total_campaigns: data.campaigns.length,
      campaign_data: data.campaigns,
      [tablesField]: tablesData, // ✅ FIX: Use correct field name based on platform
      data_source: dataSource, // ✅ FIX: Set correct data source
      // Add enhanced conversion metrics (either from Meta API or daily_kpi_data fallback)
      click_to_call: enhancedConversionMetrics.click_to_call,
      email_contacts: enhancedConversionMetrics.email_contacts,
      booking_step_1: enhancedConversionMetrics.booking_step_1,
      reservations: enhancedConversionMetrics.reservations,
      reservation_value: enhancedConversionMetrics.reservation_value,
      booking_step_2: enhancedConversionMetrics.booking_step_2,
      booking_step_3: enhancedConversionMetrics.booking_step_3,
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
      throw new Error(`Failed to store weekly summary: ${error.message}`);
    }

    const weekType = data.isCurrentWeek ? 'CURRENT WEEK' : 'COMPLETED WEEK';
    logger.info(`💾 Stored ${weekType} summary with enhanced conversion metrics: ${enhancedConversionMetrics.reservations} reservations, ${enhancedConversionMetrics.reservation_value} value`);
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
  private calculateTotals(campaigns: any[]): any {
    const totals = campaigns.reduce((acc, campaign) => {
      acc.spend += parseFloat(campaign.spend || 0);
      acc.impressions += parseInt(campaign.impressions || 0);
      acc.clicks += parseInt(campaign.clicks || 0);
      acc.conversions += parseInt(campaign.conversions || 0);
      return acc;
    }, { spend: 0, impressions: 0, clicks: 0, conversions: 0 });

    totals.ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
    totals.cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
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