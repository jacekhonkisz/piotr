import { MetaAPIService } from './meta-api';
import { supabase } from './supabase';
import logger from './logger';

interface DailyInsight {
  date: string;
  campaign_id: string;
  campaign_name: string;
  spend: number;
  clicks: number;
  impressions: number;
  conversions: number;
  ctr: number;
  cpc: number;
  // Conversion metrics
  click_to_call?: number;
  email_contacts?: number;
  booking_step_1?: number;
  reservations?: number;
  reservation_value?: number;
  booking_step_2?: number;
}

interface DailyAggregatedData {
  date: string;
  total_spend: number;
  total_clicks: number;
  total_impressions: number;
  total_conversions: number;
  campaigns_count: number;
  click_to_call: number;
  email_contacts: number;
  booking_step_1: number;
  reservations: number;
  reservation_value: number;
  booking_step_2: number;
  booking_step_3: number;
}

export class DailyDataFetcher {
  
  /**
   * Fetch REAL daily data from Meta API for the last 7 days
   */
  static async fetchRealDailyData(clientId: string): Promise<DailyAggregatedData[]> {
    try {
      logger.info('🔄 FETCHING REAL DAILY DATA FROM META API');
      logger.info('==========================================');
      
      // Get client data
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();

      if (clientError || !client) {
        throw new Error(`Client not found: ${clientId}`);
      }

      if (!client.meta_access_token) {
        throw new Error(`Client ${clientId} has no Meta API access token`);
      }

      // Initialize Meta API service
      const metaService = new MetaAPIService(client.meta_access_token);
      
      // Validate token
      const tokenValidation = await metaService.validateToken();
      if (!tokenValidation.valid) {
        throw new Error(`Invalid Meta API token: ${tokenValidation.error}`);
      }

      // Calculate date range for last 7 completed days (excluding today)
      const today = new Date();
      const endDate = new Date(today);
      endDate.setDate(today.getDate() - 1); // Yesterday
      
      const startDate = new Date(endDate);
      startDate.setDate(endDate.getDate() - 6); // 7 days total including yesterday
      
      const dateStart = startDate.toISOString().split('T')[0];
      const dateEnd = endDate.toISOString().split('T')[0];
      
      logger.info(`📅 Fetching REAL daily data from ${dateStart} to ${dateEnd}`);

      // Prepare ad account ID
      if (!client.ad_account_id) {
        throw new Error(`Client ${clientId} has no ad account ID`);
      }

      const adAccountId = (client.ad_account_id as string).startsWith('act_') 
        ? (client.ad_account_id as string).substring(4)
        : (client.ad_account_id as string);

      // CRITICAL: Use time_increment=1 to get ACTUAL daily breakdowns
      logger.info('🎯 Using Meta API with time_increment=1 for REAL daily data');
      
      const dailyInsights = await metaService.getCampaignInsights(
        adAccountId,
        dateStart!,
        dateEnd!,
        1 // time_increment=1 means DAILY breakdowns
      );

      logger.info(`✅ Received ${dailyInsights.length} daily insight records from Meta API`);

      // Group insights by date and aggregate
      const dailyAggregated = this.aggregateDailyInsights(dailyInsights);
      
      logger.info(`📊 Aggregated into ${dailyAggregated.length} daily data points:`);
      dailyAggregated.forEach(day => {
        logger.info(`   ${day.date}: ${day.total_spend.toFixed(2)} PLN, ${day.total_clicks} clicks (${day.campaigns_count} campaigns)`);
      });

      return dailyAggregated;

    } catch (error) {
      logger.error('❌ Error fetching real daily data:', error);
      throw error;
    }
  }

  /**
   * Aggregate daily insights by date
   */
  private static aggregateDailyInsights(insights: any[]): DailyAggregatedData[] {
    const dailyData = new Map<string, DailyAggregatedData>();

    insights.forEach(insight => {
      const date = insight.date_start; // Meta API returns daily data with date_start as the specific day
      
      if (!dailyData.has(date)) {
        dailyData.set(date, {
          date: date,
          total_spend: 0,
          total_clicks: 0,
          total_impressions: 0,
          total_conversions: 0,
          campaigns_count: 0,
          click_to_call: 0,
          email_contacts: 0,
          booking_step_1: 0,
          reservations: 0,
          reservation_value: 0,
          booking_step_2: 0,
          booking_step_3: 0
        });
      }

      const dayData = dailyData.get(date)!;
      
      // Aggregate the metrics
      dayData.total_spend += Number(insight.spend || 0);
      dayData.total_clicks += Number(insight.clicks || 0);
      dayData.total_impressions += Number(insight.impressions || 0);
      dayData.total_conversions += Number(insight.conversions || 0);
      dayData.campaigns_count += 1;
      
      // Aggregate conversion metrics
      dayData.click_to_call += Number(insight.click_to_call || 0);
      dayData.email_contacts += Number(insight.email_contacts || 0);
      dayData.booking_step_1 += Number(insight.booking_step_1 || 0);
      dayData.reservations += Number(insight.reservations || 0);
      dayData.reservation_value += Number(insight.reservation_value || 0);
      dayData.booking_step_2 += Number(insight.booking_step_2 || 0);
      dayData.booking_step_3 += Number(insight.booking_step_3 || 0);
    });

    // Convert to array and sort by date
    return Array.from(dailyData.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Store real daily data in the database
   */
  static async storeRealDailyData(clientId: string, dailyData: DailyAggregatedData[]): Promise<void> {
    try {
      logger.info(`📊 Storing ${dailyData.length} REAL daily data records in database`);
      
      for (const dayData of dailyData) {
        // Calculate derived metrics
        const average_ctr = dayData.total_impressions > 0 
          ? (dayData.total_clicks / dayData.total_impressions) * 100 
          : 0;
        
        const average_cpc = dayData.total_clicks > 0 
          ? dayData.total_spend / dayData.total_clicks 
          : 0;
        
        const roas = dayData.total_spend > 0 
          ? dayData.reservation_value / dayData.total_spend 
          : 0;
        
        const cost_per_reservation = dayData.reservations > 0 
          ? dayData.total_spend / dayData.reservations 
          : 0;

        // Upsert the record
        const { error } = await supabase
          .from('daily_kpi_data')
          .upsert({
            client_id: clientId,
            date: dayData.date,
            total_clicks: dayData.total_clicks,
            total_impressions: dayData.total_impressions,
            total_spend: dayData.total_spend,
            total_conversions: dayData.total_conversions,
            click_to_call: dayData.click_to_call,
            email_contacts: dayData.email_contacts,
            booking_step_1: dayData.booking_step_1,
            reservations: dayData.reservations,
            reservation_value: dayData.reservation_value,
            booking_step_2: dayData.booking_step_2,
            booking_step_3: dayData.booking_step_3,
            average_ctr: average_ctr,
            average_cpc: average_cpc,
            roas: roas,
            cost_per_reservation: cost_per_reservation,
            campaigns_count: dayData.campaigns_count,
            data_source: 'meta-api-daily', // REAL Meta API daily data
            platform: 'meta', // Add platform field
            last_updated: new Date().toISOString()
          });

        if (error) {
          logger.error(`❌ Error storing daily data for ${dayData.date}:`, error);
        } else {
          logger.info(`✅ Stored REAL daily data for ${dayData.date}: ${dayData.total_spend.toFixed(2)} PLN`);
        }
      }

    } catch (error) {
      logger.error('❌ Error storing real daily data:', error);
      throw error;
    }
  }

  /**
   * Fetch and store real daily data for a client
   */
  static async updateRealDailyData(clientId: string): Promise<DailyAggregatedData[]> {
    try {
      logger.info('🔄 UPDATING WITH REAL DAILY DATA FROM META API');
      
      // Fetch real daily data from Meta API
      const dailyData = await this.fetchRealDailyData(clientId);
      
      // Store it in the database
      await this.storeRealDailyData(clientId, dailyData);
      
      logger.info('✅ REAL daily data update complete');
      return dailyData;
      
    } catch (error) {
      logger.error('❌ Error updating real daily data:', error);
      throw error;
    }
  }
} 