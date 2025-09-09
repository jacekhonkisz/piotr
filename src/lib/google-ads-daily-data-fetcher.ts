import { createClient } from '@supabase/supabase-js';
import { GoogleAdsAPIService } from './google-ads-api';
import logger from './logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface GoogleAdsDailyAggregatedData {
  date: string;
  total_spend: number;
  total_impressions: number;
  total_clicks: number;
  total_conversions: number;
  campaigns_count: number;
  
  // Conversion tracking data
  click_to_call: number;
  email_contacts: number;
  booking_step_1: number;
  reservations: number;
  reservation_value: number;
  roas: number;
  cost_per_reservation: number;
  booking_step_2: number;
  booking_step_3: number;
}

export class GoogleAdsDailyDataFetcher {
  
  /**
   * Fetch REAL daily data from Google Ads API for the last 7 days
   */
  static async fetchRealDailyData(clientId: string): Promise<GoogleAdsDailyAggregatedData[]> {
    try {
      logger.info('🔄 FETCHING REAL DAILY DATA FROM GOOGLE ADS API');
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

      if (!client.google_ads_enabled || !client.google_ads_customer_id) {
        throw new Error(`Client ${clientId} has no Google Ads configuration`);
      }

      // Get Google Ads system settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', ['google_ads_client_id', 'google_ads_client_secret', 'google_ads_developer_token', 'google_ads_manager_refresh_token', 'google_ads_manager_customer_id']);

      if (settingsError) {
        throw new Error(`Failed to get Google Ads system settings: ${settingsError.message}`);
      }

      const settings = settingsData.reduce((acc, setting) => {
        acc[setting.key] = setting.value;
        return acc;
      }, {} as Record<string, string>);

      // Determine refresh token (manager token takes priority)
      let refreshToken = null;
      if (settings.google_ads_manager_refresh_token) {
        refreshToken = settings.google_ads_manager_refresh_token;
      } else if (client.google_ads_refresh_token) {
        refreshToken = client.google_ads_refresh_token;
      }

      if (!refreshToken) {
        throw new Error('No Google Ads refresh token available');
      }

      const googleAdsCredentials = {
        refreshToken,
        clientId: settings.google_ads_client_id || '',
        clientSecret: settings.google_ads_client_secret || '',
        developmentToken: settings.google_ads_developer_token || '',
        customerId: client.google_ads_customer_id,
        managerCustomerId: settings.google_ads_manager_customer_id || '',
      };

      // Initialize Google Ads API service
      const googleAdsService = new GoogleAdsAPIService(googleAdsCredentials);

      // Calculate date range for last 7 completed days (excluding today)
      const today = new Date();
      const endDate = new Date(today);
      endDate.setDate(today.getDate() - 1); // Yesterday
      
      const startDate = new Date(endDate);
      startDate.setDate(endDate.getDate() - 6); // 7 days total including yesterday
      
      const dateStart = startDate.toISOString().split('T')[0];
      const dateEnd = endDate.toISOString().split('T')[0];
      
      logger.info(`📅 Fetching REAL daily data from ${dateStart} to ${dateEnd}`);

      // CRITICAL: Fetch daily campaign data with date segmentation
      logger.info('🎯 Using Google Ads API with daily segmentation for REAL daily data');
      
      const dailyInsights = await googleAdsService.getCampaignDataWithDateSegments(
        dateStart!,
        dateEnd!
      );

      logger.info(`✅ Received ${dailyInsights.length} daily insight records from Google Ads API`);

      // Group insights by date and aggregate
      const dailyAggregated = this.aggregateDailyInsights(dailyInsights);
      
      logger.info(`📊 Aggregated into ${dailyAggregated.length} daily data points:`);
      dailyAggregated.forEach(day => {
        logger.info(`   ${day.date}: ${day.total_spend.toFixed(2)} PLN, ${day.total_clicks} clicks (${day.campaigns_count} campaigns)`);
      });

      return dailyAggregated;

    } catch (error) {
      logger.error('❌ Error fetching real Google Ads daily data:', error);
      throw error;
    }
  }

  /**
   * Aggregate daily insights by date
   */
  private static aggregateDailyInsights(insights: any[]): GoogleAdsDailyAggregatedData[] {
    
    const dailyMap = new Map<string, GoogleAdsDailyAggregatedData>();
    
    insights.forEach(insight => {
      const date = insight.date || insight.segments?.date || new Date().toISOString().split('T')[0];
      
      if (!dailyMap.has(date)) {
        dailyMap.set(date, {
          date,
          total_spend: 0,
          total_impressions: 0,
          total_clicks: 0,
          total_conversions: 0,
          campaigns_count: 0,
          click_to_call: 0,
          email_contacts: 0,
          booking_step_1: 0,
          reservations: 0,
          reservation_value: 0,
          roas: 0,
          cost_per_reservation: 0,
          booking_step_2: 0,
          booking_step_3: 0
        });
      }
      
      const dayData = dailyMap.get(date)!;
      
      // Aggregate core metrics
      dayData.total_spend += insight.spend || 0;
      dayData.total_impressions += insight.impressions || 0;
      dayData.total_clicks += insight.clicks || 0;
      dayData.total_conversions += insight.conversions || 0;
      dayData.campaigns_count += 1;
      
      // Aggregate conversion metrics
      dayData.click_to_call += insight.click_to_call || 0;
      dayData.email_contacts += insight.email_contacts || 0;
      dayData.booking_step_1 += insight.booking_step_1 || 0;
      dayData.reservations += insight.reservations || 0;
      dayData.reservation_value += insight.reservation_value || 0;
      dayData.booking_step_2 += insight.booking_step_2 || 0;
      dayData.booking_step_3 += insight.booking_step_3 || 0;
    });
    
    // Calculate derived metrics for each day
    dailyMap.forEach(dayData => {
      dayData.roas = dayData.total_spend > 0 ? dayData.reservation_value / dayData.total_spend : 0;
      dayData.cost_per_reservation = dayData.reservations > 0 ? dayData.total_spend / dayData.reservations : 0;
    });
    
    // Convert to array and sort by date
    return Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Get cached daily data from database
   */
  static async getCachedDailyData(clientId: string): Promise<GoogleAdsDailyAggregatedData[]> {
    try {
      // Calculate date range for last 7 days
      const today = new Date();
      const endDate = new Date(today);
      endDate.setDate(today.getDate() - 1); // Yesterday
      
      const startDate = new Date(endDate);
      startDate.setDate(endDate.getDate() - 6); // 7 days total
      
      const dateStart = startDate.toISOString().split('T')[0];
      const dateEnd = endDate.toISOString().split('T')[0];

      logger.info(`📅 Getting cached Google Ads daily data from ${dateStart} to ${dateEnd}`);

      // Query daily_kpi_data table for Google Ads data
      const { data: dailyData, error } = await supabase
        .from('daily_kpi_data')
        .select('*')
        .eq('client_id', clientId)
        .eq('platform', 'google')
        .gte('date', dateStart)
        .lte('date', dateEnd)
        .order('date', { ascending: true });

      if (error) {
        logger.error('❌ Error fetching cached Google Ads daily data:', error);
        return [];
      }

      if (!dailyData || dailyData.length === 0) {
        logger.info('ℹ️ No cached Google Ads daily data found');
        return [];
      }

      logger.info(`✅ Found ${dailyData.length} cached Google Ads daily data points`);

      // Transform database records to our format
      return dailyData.map(record => ({
        date: record.date,
        total_spend: record.total_spend || 0,
        total_impressions: record.total_impressions || 0,
        total_clicks: record.total_clicks || 0,
        total_conversions: record.total_conversions || 0,
        campaigns_count: record.campaigns_count || 0,
        click_to_call: record.click_to_call || 0,
        email_contacts: record.email_contacts || 0,
        booking_step_1: record.booking_step_1 || 0,
        reservations: record.reservations || 0,
        reservation_value: record.reservation_value || 0,
        roas: record.roas || 0,
        cost_per_reservation: record.cost_per_reservation || 0,
        booking_step_2: record.booking_step_2 || 0,
        booking_step_3: record.booking_step_3 || 0
      }));

    } catch (error) {
      logger.error('❌ Error getting cached Google Ads daily data:', error);
      return [];
    }
  }
}
