/**
 * Unified Data Fetcher for Meta Ads and Google Ads
 * This service fetches data from both platforms and combines them into unified reports
 */

import logger from './logger';
import {
  UnifiedReport,
  UnifiedCampaign,
  PlatformTotals,
  convertMetaCampaignToUnified,
  convertGoogleCampaignToUnified,
  calculatePlatformTotals,
  combinePlatformTotals
} from './unified-campaign-types';

export interface UnifiedDataFetchOptions {
  clientId: string;
  dateStart: string;
  dateEnd: string;
  authToken: string;
}

export class UnifiedDataFetcher {
  
  /**
   * Fetch unified report data combining Meta and Google Ads
   */
  static async fetchUnifiedReport(options: UnifiedDataFetchOptions): Promise<UnifiedReport> {
    const { clientId, dateStart, dateEnd, authToken } = options;
    
    logger.info(`🔄 Fetching unified report data for client ${clientId} from ${dateStart} to ${dateEnd}`);
    
    try {
      // Fetch both Meta and Google Ads data in parallel
      const [metaData, googleData] = await Promise.allSettled([
        this.fetchMetaAdsData(options),
        this.fetchGoogleAdsData(options)
      ]);
      
      // Process Meta Ads data
      let metaCampaigns: UnifiedCampaign[] = [];
      if (metaData.status === 'fulfilled' && metaData.value) {
        metaCampaigns = metaData.value.map(convertMetaCampaignToUnified);
        logger.info(`✅ Fetched ${metaCampaigns.length} Meta campaigns`);
      } else {
        logger.warn('⚠️ Failed to fetch Meta Ads data:', metaData.status === 'rejected' ? metaData.reason : 'No data');
      }
      
      // Process Google Ads data
      let googleCampaigns: UnifiedCampaign[] = [];
      if (googleData.status === 'fulfilled' && googleData.value) {
        googleCampaigns = googleData.value.map(convertGoogleCampaignToUnified);
        logger.info(`✅ Fetched ${googleCampaigns.length} Google campaigns`);
      } else {
        logger.warn('⚠️ Failed to fetch Google Ads data:', googleData.status === 'rejected' ? googleData.reason : 'No data');
      }
      
      // Calculate totals for each platform
      const metaTotals = calculatePlatformTotals(metaCampaigns);
      const googleTotals = calculatePlatformTotals(googleCampaigns);
      const combinedTotals = combinePlatformTotals(metaTotals, googleTotals);
      
      const unifiedReport: UnifiedReport = {
        id: `unified-${clientId}-${dateStart}-${dateEnd}`,
        date_range_start: dateStart,
        date_range_end: dateEnd,
        generated_at: new Date().toISOString(),
        metaCampaigns,
        googleCampaigns,
        totals: {
          meta: metaTotals,
          google: googleTotals,
          combined: combinedTotals
        }
      };
      
      logger.info(`🎉 Successfully created unified report with ${metaCampaigns.length} Meta + ${googleCampaigns.length} Google campaigns`);
      return unifiedReport;
      
    } catch (error) {
      logger.error('❌ Error fetching unified report data:', error);
      throw error;
    }
  }
  
  /**
   * Fetch Meta Ads data using direct database query
   */
  private static async fetchMetaAdsData(options: UnifiedDataFetchOptions): Promise<any[]> {
    const { clientId, dateStart, dateEnd } = options;
    
    try {
      // Import supabase here to avoid circular dependencies
      const { supabase } = await import('./supabase');
      
      // Fetch Meta campaigns from database
      const { data: campaigns, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('client_id', clientId)
        .gte('date_range_start', dateStart)
        .lte('date_range_end', dateEnd);
      
      if (error) {
        logger.error('❌ Error fetching Meta campaigns from database:', error);
        throw error;
      }
      
      logger.info(`✅ Fetched ${campaigns?.length || 0} Meta campaigns from database`);
      return campaigns || [];
      
    } catch (error) {
      logger.error('❌ Error fetching Meta Ads data:', error);
      throw error;
    }
  }
  
  /**
   * Fetch Google Ads data using direct database query
   */
  private static async fetchGoogleAdsData(options: UnifiedDataFetchOptions): Promise<any[]> {
    const { clientId, dateStart, dateEnd } = options;
    
    try {
      // Import supabase here to avoid circular dependencies
      const { supabase } = await import('./supabase');
      
      // Check if client has Google Ads enabled
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('google_ads_enabled, google_ads_customer_id, google_ads_refresh_token')
        .eq('id', clientId)
        .single();
      
      if (clientError || !client) {
        logger.warn(`⚠️ Client ${clientId} not found or error:`, clientError);
        return [];
      }
      
      if (!client.google_ads_enabled || !client.google_ads_customer_id || !client.google_ads_refresh_token) {
        logger.info(`ℹ️ Google Ads not enabled for client ${clientId}`);
        return [];
      }
      
      // Fetch from google_ads_campaigns table (cached data)
      const { data: cachedCampaigns, error: cacheError } = await supabase
        .from('google_ads_campaigns')
        .select('*')
        .eq('client_id', clientId)
        .gte('date_range_start', dateStart)
        .lte('date_range_end', dateEnd);
      
      if (cacheError) {
        logger.error('❌ Error fetching Google Ads campaigns from database:', cacheError);
        return [];
      }
      
      logger.info(`✅ Fetched ${cachedCampaigns?.length || 0} Google Ads campaigns from database`);
      return cachedCampaigns || [];
      
    } catch (error) {
      logger.error('❌ Error fetching Google Ads data:', error);
      return []; // Return empty array instead of throwing to allow Meta-only reports
    }
  }
  
  /**
   * Fetch unified data for a specific month
   */
  static async fetchUnifiedMonthlyData(
    clientId: string, 
    year: number, 
    month: number, 
    authToken: string
  ): Promise<UnifiedReport> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // Last day of month
    
    const dateStart = startDate.toISOString().split('T')[0];
    const dateEnd = endDate.toISOString().split('T')[0];
    
    return this.fetchUnifiedReport({
      clientId,
      dateStart,
      dateEnd,
      authToken
    });
  }
  
  /**
   * Fetch unified data for a specific week
   */
  static async fetchUnifiedWeeklyData(
    clientId: string, 
    year: number, 
    week: number, 
    authToken: string
  ): Promise<UnifiedReport> {
    // Calculate week boundaries using ISO week standard
    const jan4 = new Date(year, 0, 4);
    const startOfWeek1 = new Date(jan4);
    startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
    
    const weekStartDate = new Date(startOfWeek1);
    weekStartDate.setDate(startOfWeek1.getDate() + (week - 1) * 7);
    
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setUTCDate(weekStartDate.getUTCDate() + 6);
    
    const dateStart = weekStartDate.toISOString().split('T')[0];
    const dateEnd = weekEndDate.toISOString().split('T')[0];
    
    return this.fetchUnifiedReport({
      clientId,
      dateStart,
      dateEnd,
      authToken
    });
  }
  
  /**
   * Fetch unified data for custom date range
   */
  static async fetchUnifiedCustomData(
    clientId: string, 
    dateStart: string, 
    dateEnd: string, 
    authToken: string
  ): Promise<UnifiedReport> {
    return this.fetchUnifiedReport({
      clientId,
      dateStart,
      dateEnd,
      authToken
    });
  }
  
  /**
   * Check if client has both platforms enabled
   */
  static async getClientPlatformStatus(clientId: string): Promise<{
    metaEnabled: boolean;
    googleEnabled: boolean;
    bothEnabled: boolean;
  }> {
    try {
      // Import supabase here to avoid circular dependencies
      const { supabase } = await import('./supabase');
      
      const { data: client, error } = await supabase
        .from('clients')
        .select('meta_access_token, google_ads_enabled, google_ads_customer_id')
        .eq('id', clientId)
        .single();
      
      if (error || !client) {
        return { metaEnabled: false, googleEnabled: false, bothEnabled: false };
      }
      
      const metaEnabled = !!client.meta_access_token;
      const googleEnabled = !!(client.google_ads_enabled && client.google_ads_customer_id);
      
      return {
        metaEnabled,
        googleEnabled,
        bothEnabled: metaEnabled && googleEnabled
      };
      
    } catch (error) {
      logger.error('❌ Error checking client platform status:', error);
      return { metaEnabled: false, googleEnabled: false, bothEnabled: false };
    }
  }
}
