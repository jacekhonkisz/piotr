import { createClient } from '@supabase/supabase-js';
import { MetaAPIService } from './meta-api';
import { 
  analyzeDateRange, 
  selectMetaAPIMethod, 
  validateDateRange,
  type DateRange 
} from './date-range-utils';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface CampaignSummary {
  id?: string;
  client_id: string;
  summary_type: 'weekly' | 'monthly';
  summary_date: string;
  total_spend: number;
  total_impressions: number;
  total_clicks: number;
  total_conversions: number;
  average_ctr: number;
  average_cpc: number;
  average_cpa: number;
  active_campaigns: number;
  total_campaigns: number;
  campaign_data: any[];
  meta_tables?: any;
  data_source: string;
  last_updated: string;
}

interface DataLoadResult {
  data: any;
  source: 'stored' | 'api';
  lastUpdated: Date;
  isHistorical: boolean;
  dataAge?: string;
}

export class SmartDataLoader {
  private static instance: SmartDataLoader;
  private cache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  static getInstance(): SmartDataLoader {
    if (!SmartDataLoader.instance) {
      SmartDataLoader.instance = new SmartDataLoader();
    }
    return SmartDataLoader.instance;
  }

  /**
   * Main method to load data with smart storage strategy
   */
  async loadData(clientId: string, dateRange: DateRange): Promise<DataLoadResult> {
    const currentDate = new Date();
    const twelveMonthsAgo = new Date(currentDate);
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    
    const startDate = new Date(dateRange.start);
    const isRecentData = startDate >= twelveMonthsAgo;
    
    console.log(`🔍 Smart data loading for client ${clientId}:`, {
      dateRange,
      isRecentData,
      twelveMonthsAgo: twelveMonthsAgo.toISOString().split('T')[0]
    });

    if (isRecentData) {
      // Try to load from storage first for recent data
      const storedResult = await this.loadFromStorage(clientId, dateRange);
      if (storedResult) {
        return storedResult;
      }
    }

    // Fallback to live API fetch
    const apiResult = await this.loadFromAPI(clientId, dateRange);
    
    // Store the data if it's recent
    if (isRecentData) {
      await this.storeData(clientId, apiResult.data, dateRange);
    }

    return {
      data: apiResult.data,
      source: 'api',
      lastUpdated: new Date(),
      isHistorical: !isRecentData,
      dataAge: isRecentData ? 'Live data' : 'Historical data'
    };
  }

  /**
   * Load data from storage (last 12 months)
   */
  private async loadFromStorage(clientId: string, dateRange: DateRange): Promise<DataLoadResult | null> {
    try {
      const cacheKey = `storage_${clientId}_${dateRange.start}_${dateRange.end}`;
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
        console.log(`📦 Using cached storage data for ${clientId}`);
        return {
          data: cached.data,
          source: 'stored',
          lastUpdated: new Date(cached.timestamp),
          isHistorical: false,
          dataAge: `${Math.floor((Date.now() - cached.timestamp) / (1000 * 60 * 60))} hours old`
        };
      }

      // Determine summary type using standardized analysis
      const rangeAnalysis = analyzeDateRange(dateRange.start, dateRange.end);
      const summaryType = rangeAnalysis.isValidMonthly ? 'monthly' : 'weekly';
      
      // Get stored summary
      const { data: storedSummary, error } = await supabase
        .from('campaign_summaries')
        .select('*')
        .eq('client_id', clientId)
        .eq('summary_type', summaryType)
        .eq('summary_date', dateRange.start)
        .single();

      if (error || !storedSummary) {
        console.log(`📦 No stored data found for ${clientId} on ${dateRange.start}`);
        return null;
      }

      // Check if data is fresh (within 24 hours for weekly, 7 days for monthly)
      const dataAge = Date.now() - new Date(storedSummary.last_updated).getTime();
      const maxAge = summaryType === 'weekly' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
      
      if (dataAge > maxAge) {
        console.log(`📦 Stored data is stale for ${clientId}, will fetch fresh data`);
        return null;
      }

      // Cache the result
      this.cache.set(cacheKey, {
        data: storedSummary,
        timestamp: Date.now()
      });

      console.log(`📦 Using stored data for ${clientId} (${summaryType})`);
      
      return {
        data: storedSummary,
        source: 'stored',
        lastUpdated: new Date(storedSummary.last_updated),
        isHistorical: false,
        dataAge: `${Math.floor(dataAge / (1000 * 60 * 60))} hours old`
      };

    } catch (error) {
      console.error('❌ Error loading from storage:', error);
      return null;
    }
  }

  /**
   * Load data from Meta API
   */
  private async loadFromAPI(clientId: string, dateRange: DateRange): Promise<{ data: any }> {
    try {
      console.log(`🌐 Fetching live data from Meta API for ${clientId}`);
      
      // Validate date range first
      const validation = validateDateRange(dateRange.start, dateRange.end);
      if (!validation.isValid) {
        throw new Error(`Invalid date range: ${validation.error}`);
      }

      // Analyze date range to determine best API method
      const rangeAnalysis = analyzeDateRange(dateRange.start, dateRange.end);
      const apiMethod = selectMetaAPIMethod(dateRange);
      
      console.log(`📅 Date range analysis:`, {
        rangeType: rangeAnalysis.rangeType,
        daysDiff: rangeAnalysis.daysDiff,
        isValidMonthly: rangeAnalysis.isValidMonthly,
        selectedMethod: apiMethod.method
      });
      
      // Get client data
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();

      if (clientError || !client) {
        throw new Error(`Client not found: ${clientId}`);
      }

      // Initialize Meta API service
      const metaService = new MetaAPIService(client.meta_access_token);
      
      // Validate token
      const tokenValidation = await metaService.validateToken();
      if (!tokenValidation.valid) {
        throw new Error(`Invalid Meta API token: ${tokenValidation.error}`);
      }

      // Fetch campaign insights using standardized method selection
      const adAccountId = client.ad_account_id.startsWith('act_') 
        ? client.ad_account_id.substring(4)
        : client.ad_account_id;

      let campaignInsights: any[] = [];
      
      if (apiMethod.method === 'getMonthlyCampaignInsights') {
        console.log(`📅 Using monthly insights method for ${apiMethod.parameters.year}-${apiMethod.parameters.month}`);
        campaignInsights = await metaService.getMonthlyCampaignInsights(
          adAccountId,
          apiMethod.parameters.year,
          apiMethod.parameters.month
        );
      } else {
        console.log(`📅 Using standard insights method with time increment: ${apiMethod.parameters.timeIncrement}`);
        campaignInsights = await metaService.getCampaignInsights(
          adAccountId,
          apiMethod.parameters.dateStart,
          apiMethod.parameters.dateEnd,
          apiMethod.parameters.timeIncrement
        );
      }

      // Calculate totals
      const totals = this.calculateTotals(campaignInsights);

      // Fetch meta tables if needed
      let metaTables = null;
      try {
        const placementData = await metaService.getPlacementPerformance(adAccountId, dateRange.start, dateRange.end);
        const demographicData = await metaService.getDemographicPerformance(adAccountId, dateRange.start, dateRange.end);
        const adRelevanceData = await metaService.getAdRelevanceResults(adAccountId, dateRange.start, dateRange.end);
        
        metaTables = {
          placementPerformance: placementData,
          demographicPerformance: demographicData,
          adRelevanceResults: adRelevanceData
        };
      } catch (error) {
        console.warn('⚠️ Failed to fetch meta tables:', error);
      }

      const result = {
        client: {
          id: client.id,
          name: client.name,
          email: client.email,
          ad_account_id: client.ad_account_id,
          currency: 'PLN' // Default currency
        },
        dateRange,
        campaigns: campaignInsights,
        totals,
        metaTables
      };

      console.log(`✅ Live data fetched successfully for ${clientId}`);
      return { data: result };

    } catch (error) {
      console.error('❌ Error loading from API:', error);
      throw error;
    }
  }

  /**
   * Store data in the database
   */
  private async storeData(clientId: string, data: any, dateRange: DateRange): Promise<void> {
    try {
      const startDate = new Date(dateRange.start);
      const endDate = new Date(dateRange.end);
      const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
      
      const summaryType = daysDiff >= 25 && daysDiff <= 35 ? 'monthly' : 'weekly';
      
      const summary: CampaignSummary = {
        client_id: clientId,
        summary_type: summaryType,
        summary_date: dateRange.start,
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

      // Upsert the summary
      const { error } = await supabase
        .from('campaign_summaries')
        .upsert(summary, {
          onConflict: 'client_id,summary_type,summary_date'
        });

      if (error) {
        console.error('❌ Error storing summary:', error);
      } else {
        console.log(`💾 Stored ${summaryType} summary for ${clientId} on ${dateRange.start}`);
      }

    } catch (error) {
      console.error('❌ Error storing data:', error);
    }
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
   * Clean up old data (older than 12 months)
   */
  async cleanupOldData(): Promise<void> {
    try {
      const { error } = await supabase.rpc('cleanup_old_campaign_summaries');
      
      if (error) {
        console.error('❌ Error cleaning up old data:', error);
      } else {
        console.log('🧹 Cleaned up old campaign summaries');
      }
    } catch (error) {
      console.error('❌ Error in cleanup:', error);
    }
  }

  /**
   * Get data source indicator for UI
   */
  getDataSourceIndicator(result: DataLoadResult): { text: string; color: string; icon: string } {
    if (result.source === 'stored') {
      return {
        text: `Cached data • Updated ${result.dataAge}`,
        color: 'text-green-600',
        icon: '📊'
      };
    }
    
    if (result.isHistorical) {
      return {
        text: 'Live historical data • Fetched from Meta API',
        color: 'text-blue-600',
        icon: '🔄'
      };
    }
    
    return {
      text: 'Live data • Just fetched from Meta API',
      color: 'text-orange-600',
      icon: '⚡'
    };
  }
} 