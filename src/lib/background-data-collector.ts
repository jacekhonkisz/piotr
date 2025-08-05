// @ts-ignore - processedAdAccountId is guaranteed to be string after null check
import { createClient } from '@supabase/supabase-js';
import { MetaAPIService } from './meta-api';
import { SmartDataLoader } from './smart-data-loader';
import { getMonthBoundaries, getWeekBoundaries } from './date-range-utils';

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
      console.log('⚠️ Background data collection already running');
      return;
    }

    this.isRunning = true;
    console.log('📅 Starting monthly data collection...');

    try {
      const clients = await this.getAllActiveClients();
      console.log(`📊 Found ${clients.length} active clients for monthly collection`);

      for (const client of clients) {
        try {
          await this.collectMonthlySummaryForClient(client);
          // Add delay between clients to avoid rate limiting
          await this.delay(2000);
        } catch (error) {
          console.error(`❌ Failed to collect monthly summary for ${client.name}:`, error);
        }
      }

      console.log('✅ Monthly data collection completed');
    } catch (error) {
      console.error('❌ Error in monthly data collection:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Collect and store weekly summaries for all active clients
   */
  async collectWeeklySummaries(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Background data collection already running');
      return;
    }

    this.isRunning = true;
    console.log('📅 Starting weekly data collection...');

    try {
      const clients = await this.getAllActiveClients();
      console.log(`📊 Found ${clients.length} active clients for weekly collection`);

      for (const client of clients) {
        try {
          await this.collectWeeklySummaryForClient(client);
          // Add delay between clients to avoid rate limiting
          await this.delay(2000);
        } catch (error) {
          console.error(`❌ Failed to collect weekly summary for ${client.name}:`, error);
        }
      }

      console.log('✅ Weekly data collection completed');
    } catch (error) {
      console.error('❌ Error in weekly data collection:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Collect monthly summary for a specific client
   */
  private async collectMonthlySummaryForClient(client: Client): Promise<void> {
    console.log(`📊 Collecting monthly summary for ${client.name}...`);

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

    // Initialize Meta API service
    if (!client.meta_access_token || !client.ad_account_id) {
      console.warn(`⚠️ Missing token or ad account ID for ${client.name}, skipping`);
      return;
    }

    // At this point, we know both values are defined
    const metaAccessToken = client.meta_access_token as string;
    const adAccountId = client.ad_account_id as string;

    const metaService = new MetaAPIService(metaAccessToken);
    
    // Validate token
    const tokenValidation = await metaService.validateToken();
    if (!tokenValidation.valid) {
      console.warn(`⚠️ Invalid token for ${client.name}, skipping`);
      return;
    }

    const processedAdAccountId = (adAccountId.startsWith('act_') 
      ? adAccountId.substring(4)
      : adAccountId) as string;

    for (const monthData of monthsToCollect) {
      try {
        console.log(`📅 Collecting ${monthData.year}-${monthData.month.toString().padStart(2, '0')} for ${client.name}`);

        // Fetch monthly campaign insights
        // @ts-ignore - processedAdAccountId is guaranteed to be string after null check
        const campaignInsights = await metaService.getMonthlyCampaignInsights(
          processedAdAccountId,
          monthData.year,
          monthData.month
        );

        // Calculate totals
        const totals = this.calculateTotals(campaignInsights);

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
          console.warn(`⚠️ Failed to fetch meta tables for ${client.name} ${monthData.year}-${monthData.month}:`, error);
        }

        // Store the summary
        await this.storeMonthlySummary(client.id, {
          summary_date: monthData.startDate,
          campaigns: campaignInsights,
          totals,
          metaTables
        });

        console.log(`✅ Stored monthly summary for ${client.name} ${monthData.year}-${monthData.month}`);

        // Add delay between months to avoid rate limiting
        await this.delay(1000);

      } catch (error) {
        console.error(`❌ Failed to collect ${monthData.year}-${monthData.month} for ${client.name}:`, error);
      }
    }
  }

  /**
   * Collect weekly summary for a specific client
   */
  private async collectWeeklySummaryForClient(client: Client): Promise<void> {
    console.log(`📊 Collecting weekly summary for ${client.name}...`);

    // Get the last 52 weeks using standardized utilities
    const currentDate = new Date();
    const weeksToCollect = [];

    for (let i = 0; i < 52; i++) {
      const weekEndDate = new Date(currentDate.getTime() - (i * 7 * 24 * 60 * 60 * 1000));
      const weekStartDate = new Date(weekEndDate.getTime() - (6 * 24 * 60 * 60 * 1000)); // 7 days before
      const weekRange = getWeekBoundaries(weekStartDate);
      
      weeksToCollect.push({
        startDate: weekRange.start,
        endDate: weekRange.end,
        weekNumber: Math.ceil((weekEndDate.getTime() - new Date(weekEndDate.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))
      });
    }

    // Initialize Meta API service
    if (!client.meta_access_token || !client.ad_account_id) {
      console.warn(`⚠️ Missing token or ad account ID for ${client.name}, skipping`);
      return;
    }

    // At this point, we know both values are defined
    const metaAccessToken = client.meta_access_token as string;
    const adAccountId = client.ad_account_id as string;

    const metaService = new MetaAPIService(metaAccessToken);
    
    // Validate token
    const tokenValidation = await metaService.validateToken();
    if (!tokenValidation.valid) {
      console.warn(`⚠️ Invalid token for ${client.name}, skipping`);
      return;
    }

    const processedAdAccountId: string = adAccountId.startsWith('act_') 
      ? adAccountId.substring(4)
      : adAccountId;

    for (const weekData of weeksToCollect) {
      try {
        console.log(`📅 Collecting week ${weekData.weekNumber} (${weekData.startDate} to ${weekData.endDate}) for ${client.name}`);

        // Fetch weekly campaign insights
        const campaignInsights = await metaService.getCampaignInsights(
          processedAdAccountId,
          weekData.startDate,
          weekData.endDate
        );

        // Calculate totals
        const totals = this.calculateTotals(campaignInsights);

        // Fetch meta tables
        let metaTables = null;
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
          console.warn(`⚠️ Failed to fetch meta tables for ${client.name} week ${weekData.weekNumber}:`, error);
        }

        // Store the summary
        await this.storeWeeklySummary(client.id, {
          summary_date: weekData.startDate,
          campaigns: campaignInsights,
          totals,
          metaTables
        });

        console.log(`✅ Stored weekly summary for ${client.name} week ${weekData.weekNumber}`);

        // Add delay between weeks to avoid rate limiting
        await this.delay(1000);

      } catch (error) {
        console.error(`❌ Failed to collect week ${weekData.weekNumber} for ${client.name}:`, error);
      }
    }
  }

  /**
   * Store monthly summary in database
   */
  private async storeMonthlySummary(clientId: string, data: any): Promise<void> {
    const summary = {
      client_id: clientId,
      summary_type: 'monthly',
      summary_date: data.summary_date,
      total_spend: data.totals.spend || 0,
      total_impressions: data.totals.impressions || 0,
      total_clicks: data.totals.clicks || 0,
      total_conversions: data.totals.conversions || 0,
      average_ctr: data.totals.ctr || 0,
      average_cpc: data.totals.cpc || 0,
      average_cpa: data.totals.cpa || 0,
      active_campaigns: data.campaigns.filter((c: any) => c.status === 'ACTIVE').length,
      total_campaigns: data.campaigns.length,
      campaign_data: data.campaigns,
      meta_tables: data.metaTables,
      data_source: 'meta_api',
      last_updated: new Date().toISOString()
    };

    const { error } = await supabase
      .from('campaign_summaries')
      .upsert(summary, {
        onConflict: 'client_id,summary_type,summary_date'
      });

    if (error) {
      throw new Error(`Failed to store monthly summary: ${error.message}`);
    }
  }

  /**
   * Store weekly summary in database
   */
  private async storeWeeklySummary(clientId: string, data: any): Promise<void> {
    const summary = {
      client_id: clientId,
      summary_type: 'weekly',
      summary_date: data.summary_date,
      total_spend: data.totals.spend || 0,
      total_impressions: data.totals.impressions || 0,
      total_clicks: data.totals.clicks || 0,
      total_conversions: data.totals.conversions || 0,
      average_ctr: data.totals.ctr || 0,
      average_cpc: data.totals.cpc || 0,
      average_cpa: data.totals.cpa || 0,
      active_campaigns: data.campaigns.filter((c: any) => c.status === 'ACTIVE').length,
      total_campaigns: data.campaigns.length,
      campaign_data: data.campaigns,
      meta_tables: data.metaTables,
      data_source: 'meta_api',
      last_updated: new Date().toISOString()
    };

    const { error } = await supabase
      .from('campaign_summaries')
      .upsert(summary, {
        onConflict: 'client_id,summary_type,summary_date'
      });

    if (error) {
      throw new Error(`Failed to store weekly summary: ${error.message}`);
    }
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
    console.log('🧹 Starting cleanup of old data...');
    
    try {
      const smartLoader = SmartDataLoader.getInstance();
      await smartLoader.cleanupOldData();
      console.log('✅ Cleanup completed');
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
    }
  }
} 