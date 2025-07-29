/**
 * Meta (Facebook/Instagram) Ads API Integration
 * Fetches real campaign data using Meta Business API
 */

interface MetaAPIResponse {
  data?: any[];
  error?: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
  paging?: {
    cursors?: {
      before?: string;
      after?: string;
    };
    next?: string;
    previous?: string;
  };
}

interface CampaignInsights {
  campaign_id: string;
  campaign_name: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpp?: number;
  frequency?: number;
  reach?: number;
  date_start: string;
  date_stop: string;
}

interface AdAccount {
  id: string;
  name: string;
  account_id: string;
  currency: string;
  timezone_name: string;
}

interface AccountSummary {
  total_spend: number;
  total_impressions: number;
  total_clicks: number;
  total_conversions: number;
  average_ctr: number;
  average_cpc: number;
  average_cpa: number;
  active_campaigns: number;
  total_campaigns: number;
}

interface ClientReport {
  account_summary: AccountSummary;
  campaigns: CampaignInsights[];
  date_range: {
    start: string;
    end: string;
  };
  generated_at: string;
}

interface LongLivedTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

// Cache for Meta API responses
const apiCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export class MetaAPIService {
  private accessToken: string;
  private baseUrl = 'https://graph.facebook.com/v18.0';

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private getCacheKey(endpoint: string, params?: string): string {
    return `${this.accessToken}_${endpoint}_${params || ''}`;
  }

  private getCachedResponse(cacheKey: string): any | null {
    const cached = apiCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }
    return null;
  }

  private setCachedResponse(cacheKey: string, data: any): void {
    apiCache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Convert a short-lived token to a long-lived token
   * This is essential for permanent API access
   */
  async convertToLongLivedToken(): Promise<{ success: boolean; token?: string; error?: string }> {
    try {
      const appId = process.env.META_APP_ID;
      const appSecret = process.env.META_APP_SECRET;

      if (!appId || !appSecret) {
        return {
          success: false,
          error: 'Meta App ID and App Secret are required for token conversion. Please check your environment variables.'
        };
      }

      const response = await fetch(
        `${this.baseUrl}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${this.accessToken}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: `Token conversion failed: ${errorData.error?.message || 'Unknown error'}`
        };
      }

      const data: LongLivedTokenResponse = await response.json();

      if (!data.access_token) {
        return {
          success: false,
          error: 'No access token received from Meta API'
        };
      }

      return {
        success: true,
        token: data.access_token
      };

    } catch (error) {
      return {
        success: false,
        error: `Token conversion error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Validate and optionally convert token to long-lived
   */
  async validateAndConvertToken(): Promise<{ 
    valid: boolean; 
    error?: string; 
    permissions?: string[];
    convertedToken?: string;
    isLongLived?: boolean;
  }> {
    try {
      // First, test basic token validity
      const response = await fetch(`${this.baseUrl}/me?access_token=${this.accessToken}`);
      const data = await response.json();

      if (data.error) {
        return { valid: false, error: data.error.message };
      }

      // Test if token has ads_read permission by trying to get ad accounts
      try {
        const adAccountsResponse = await fetch(
          `${this.baseUrl}/me/adaccounts?fields=id,name,account_id&access_token=${this.accessToken}`
        );
        
        if (adAccountsResponse.status === 403) {
          return { 
            valid: false, 
            error: 'Access token does not have required permissions. Need: ads_read, ads_management' 
          };
        }
        
        const adAccountsData = await adAccountsResponse.json();
        
        if (adAccountsData.error) {
          return { 
            valid: false, 
            error: `Ad accounts access error: ${adAccountsData.error.message}` 
          };
        }

        // Token is valid, now try to convert to long-lived
        const conversionResult = await this.convertToLongLivedToken();
        
        if (conversionResult.success && conversionResult.token) {
          return { 
            valid: true, 
            permissions: ['ads_read'],
            convertedToken: conversionResult.token,
            isLongLived: true
          };
        } else {
          // Token is valid but conversion failed - might already be long-lived
          return { 
            valid: true, 
            permissions: ['ads_read'],
            isLongLived: false
          };
        }

      } catch (adAccountsError) {
        return { 
          valid: false, 
          error: 'Cannot access ad accounts. Token may lack required permissions.' 
        };
      }

    } catch (error) {
      return { valid: false, error: 'Network error or invalid token' };
    }
  }

  /**
   * Test if the access token is valid and has required permissions
   */
  async validateToken(): Promise<{ valid: boolean; error?: string; permissions?: string[] }> {
    try {
      // First, test basic token validity
      const response = await fetch(`${this.baseUrl}/me?access_token=${this.accessToken}`);
      const data = await response.json();

      if (data.error) {
        return { valid: false, error: data.error.message };
      }

      // Test if token has ads_read permission by trying to get ad accounts
      try {
        const adAccountsResponse = await fetch(
          `${this.baseUrl}/me/adaccounts?fields=id,name,account_id&access_token=${this.accessToken}`
        );
        
        if (adAccountsResponse.status === 403) {
          return { 
            valid: false, 
            error: 'Access token does not have required permissions. Need: ads_read, ads_management' 
          };
        }
        
        const adAccountsData = await adAccountsResponse.json();
        
        if (adAccountsData.error) {
          return { 
            valid: false, 
            error: `Ad accounts access error: ${adAccountsData.error.message}` 
          };
        }

        return { valid: true, permissions: ['ads_read'] };
      } catch (adAccountsError) {
        return { 
          valid: false, 
          error: 'Cannot access ad accounts. Token may lack required permissions.' 
        };
      }

    } catch (error) {
      return { valid: false, error: 'Network error or invalid token' };
    }
  }

  /**
   * Validate a specific ad account ID with the current token
   */
  async validateAdAccount(adAccountId: string): Promise<{ valid: boolean; error?: string; account?: any }> {
    try {
      // Remove 'act_' prefix if present
      const cleanAccountId = adAccountId.replace('act_', '');
      
      const response = await fetch(
        `${this.baseUrl}/act_${cleanAccountId}?fields=id,name,account_id,account_status,currency,timezone_name&access_token=${this.accessToken}`
      );
      
      if (response.status === 403) {
        return { 
          valid: false, 
          error: 'Access denied to this ad account. Check permissions or account ID.' 
        };
      }
      
      if (response.status === 404) {
        return { 
          valid: false, 
          error: 'Ad account not found. Please check the account ID.' 
        };
      }
      
      const data = await response.json();
      
      if (data.error) {
        return { 
          valid: false, 
          error: `Ad account error: ${data.error.message}` 
        };
      }
      
      return { 
        valid: true, 
        account: {
          id: data.id,
          name: data.name,
          account_id: data.account_id,
          account_status: data.account_status,
          currency: data.currency,
          timezone_name: data.timezone_name
        }
      };
      
    } catch (error) {
      return { 
        valid: false, 
        error: 'Network error or invalid ad account ID' 
      };
    }
  }

  /**
   * Get ad accounts accessible with this token
   */
  async getAdAccounts(): Promise<AdAccount[]> {
    const cacheKey = this.getCacheKey('adaccounts');
    const cached = this.getCachedResponse(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/me/adaccounts?fields=id,name,account_id,currency,timezone_name&access_token=${this.accessToken}`
      );
      const data: MetaAPIResponse = await response.json();

      if (data.data) {
        const accounts = data.data.map(account => ({
          id: account.id,
          name: account.name,
          account_id: account.account_id,
          currency: account.currency,
          timezone_name: account.timezone_name,
        }));
        
        this.setCachedResponse(cacheKey, accounts);
        return accounts;
      }

      return [];
    } catch (error) {
      console.error('Error fetching ad accounts:', error);
      return [];
    }
  }

  /**
   * Get campaign insights for a specific ad account and date range
   */
  async getCampaignInsights(
    adAccountId: string,
    dateStart: string,
    dateEnd: string,
    timeIncrement: number = 0
  ): Promise<CampaignInsights[]> {
    try {
      const fields = [
        'campaign_id',
        'campaign_name',
        'impressions',
        'clicks',
        'spend',
        'conversions',
        'ctr',
        'cpc',
        'cpp',
        'frequency',
        'reach',
        'date_start',
        'date_stop',
      ].join(',');

      const params = new URLSearchParams({
        access_token: this.accessToken,
        fields: fields,
        time_range: JSON.stringify({
          since: dateStart,
          until: dateEnd,
        }),
        level: 'campaign',
        limit: '100',
      });

      // Add time_increment if specified (1 for daily, 7 for weekly, 30 for monthly)
      if (timeIncrement > 0) {
        params.append('time_increment', timeIncrement.toString());
      }

      // Ensure we have the act_ prefix for the API call
      const accountIdWithPrefix = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
      const url = `${this.baseUrl}/${accountIdWithPrefix}/insights?${params.toString()}`;
      console.log('🔗 Meta API URL:', url.replace(this.accessToken, 'HIDDEN_TOKEN'));

      const response = await fetch(url);
      const data: MetaAPIResponse = await response.json();

      console.log('📥 Meta API Response Status:', response.status);
      console.log('📥 Meta API Response Data:', {
        hasData: !!data.data,
        dataLength: data.data?.length || 0,
        hasError: !!data.error,
        error: data.error,
        paging: data.paging
      });

      if (!response.ok) {
        console.error('❌ Meta API Error Response:', data);
        throw new Error(`Meta API Error: ${data.error?.message || 'Unknown error'} (Code: ${data.error?.code || response.status})`);
      }

      if (data.error) {
        console.error('❌ Meta API returned error:', data.error);
        throw new Error(`Meta API Error: ${data.error.message} (Code: ${data.error.code})`);
      }

      if (data.data) {
        const insights = data.data.map(insight => ({
          campaign_id: insight.campaign_id || 'unknown',
          campaign_name: insight.campaign_name || 'Unknown Campaign',
          impressions: parseInt(insight.impressions || '0'),
          clicks: parseInt(insight.clicks || '0'),
          spend: parseFloat(insight.spend || '0'),
          conversions: parseInt(insight.conversions?.[0]?.value || '0'),
          ctr: parseFloat(insight.ctr || '0'),
          cpc: parseFloat(insight.cpc || '0'),
          ...(insight.cpp && { cpp: parseFloat(insight.cpp) }),
          ...(insight.frequency && { frequency: parseFloat(insight.frequency) }),
          ...(insight.reach && { reach: parseInt(insight.reach) }),
          date_start: insight.date_start || dateStart,
          date_stop: insight.date_stop || dateEnd,
        }));

        console.log('✅ Parsed campaign insights:', insights.length, 'campaigns');
        return insights;
      }

      console.log('⚠️ No campaign insights data in response');
      return [];
    } catch (error) {
      console.error('💥 Error fetching campaign insights:', error);
      console.error('💥 Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        adAccountId,
        dateRange: { dateStart, dateEnd }
      });
      throw error; // Re-throw the error instead of returning empty array
    }
  }

  /**
   * Get monthly campaign insights with daily breakdown
   */
  async getMonthlyCampaignInsights(
    adAccountId: string,
    year: number,
    month: number
  ): Promise<CampaignInsights[]> {
    try {
      const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];
      
      console.log(`📅 Fetching monthly insights for ${year}-${month.toString().padStart(2, '0')} (${startDate} to ${endDate})`);
      
      // Use time_increment=1 to get daily breakdown
      const insights = await this.getCampaignInsights(adAccountId, startDate, endDate, 1);
      
      // Group by campaign and aggregate daily data
      const campaignMap = new Map<string, CampaignInsights>();
      
      insights.forEach(insight => {
        const campaignId = insight.campaign_id;
        
        if (!campaignMap.has(campaignId)) {
          campaignMap.set(campaignId, {
            campaign_id: campaignId,
            campaign_name: insight.campaign_name,
            impressions: 0,
            clicks: 0,
            spend: 0,
            conversions: 0,
            ctr: 0,
            cpc: 0,
            date_start: startDate,
            date_stop: endDate,
          });
        }
        
        const campaign = campaignMap.get(campaignId)!;
        campaign.impressions += insight.impressions;
        campaign.clicks += insight.clicks;
        campaign.spend += insight.spend;
        campaign.conversions += insight.conversions;
      });
      
      // Calculate aggregated metrics
      const aggregatedInsights = Array.from(campaignMap.values()).map(campaign => ({
        ...campaign,
        ctr: campaign.impressions > 0 ? (campaign.clicks / campaign.impressions) * 100 : 0,
        cpc: campaign.clicks > 0 ? campaign.spend / campaign.clicks : 0,
      }));
      
      console.log(`✅ Aggregated ${aggregatedInsights.length} campaigns for ${year}-${month.toString().padStart(2, '0')}`);
      return aggregatedInsights;
    } catch (error) {
      console.error('💥 Error fetching monthly campaign insights:', error);
      throw error;
    }
  }

  /**
   * Get campaigns for an ad account
   */
  async getCampaigns(adAccountId: string): Promise<any[]> {
    const endpoint = `act_${adAccountId}/campaigns`;
    const params = new URLSearchParams({
      access_token: this.accessToken,
      fields: 'id,name,status,objective,created_time,updated_time,start_time,stop_time',
      limit: '100'
    });

    const cacheKey = this.getCacheKey(endpoint, params.toString());
    const cached = this.getCachedResponse(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const url = `${this.baseUrl}/${endpoint}?${params}`;
      console.log('🔗 Meta API URL:', url.replace(this.accessToken, 'HIDDEN_TOKEN'));
      
      const response = await fetch(url);
      const data: MetaAPIResponse = await response.json();
      
      console.log('📥 Meta API Response Status:', response.status);
      console.log('📥 Meta API Response Data:', {
        hasData: !!data.data,
        dataLength: data.data?.length || 0,
        hasError: !!data.error,
        error: data.error,
        paging: data.paging
      });

      if (data.error) {
        throw new Error(`Meta API Error: ${data.error.message} (Code: ${data.error.code})`);
      }

      if (!data.data) {
        return [];
      }

      const campaigns = data.data.map(campaign => ({
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        objective: campaign.objective,
        created_time: campaign.created_time,
        updated_time: campaign.updated_time,
        start_time: campaign.start_time,
        stop_time: campaign.stop_time
      }));

      // Cache the response
      apiCache.set(cacheKey, { data: campaigns, timestamp: Date.now() });

      return campaigns;
    } catch (error) {
      console.error('❌ Error fetching campaigns:', error);
      throw error;
    }
  }

  async getAccountInfo(adAccountId: string): Promise<any> {
    const endpoint = `act_${adAccountId}`;
    const params = new URLSearchParams({
      access_token: this.accessToken,
      fields: 'id,name,account_id,currency,timezone_name,created_time,updated_time,account_status,disable_reason'
    });

    const cacheKey = this.getCacheKey(endpoint, params.toString());
    const cached = this.getCachedResponse(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const url = `${this.baseUrl}/${endpoint}?${params}`;
      console.log('🔗 Meta API URL:', url.replace(this.accessToken, 'HIDDEN_TOKEN'));
      
      const response = await fetch(url);
      const data = await response.json();
      
      console.log('📥 Meta API Response Status:', response.status);
      console.log('📥 Meta API Response Data:', data);

      if (data.error) {
        throw new Error(`Meta API Error: ${data.error.message} (Code: ${data.error.code})`);
      }

      // Cache the response
      apiCache.set(cacheKey, { data, timestamp: Date.now() });

      return data;
    } catch (error) {
      console.error('❌ Error fetching account info:', error);
      throw error;
    }
  }

  /**
   * Get account-level insights (summary data)
   */
  async getAccountInsights(
    adAccountId: string,
    dateStart: string,
    dateEnd: string
  ): Promise<any> {
    try {
      const fields = [
        'impressions',
        'clicks',
        'spend',
        'conversions',
        'ctr',
        'cpc',
        'frequency',
        'reach',
      ].join(',');

      const params = new URLSearchParams({
        access_token: this.accessToken,
        fields: fields,
        time_range: JSON.stringify({
          since: dateStart,
          until: dateEnd,
        }),
        level: 'account',
      });

      // Ensure we have the act_ prefix for the API call
      const accountIdWithPrefix = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
      const response = await fetch(
        `${this.baseUrl}/${accountIdWithPrefix}/insights?${params.toString()}`
      );

      const data: MetaAPIResponse = await response.json();
      return data.data?.[0] || {};
    } catch (error) {
      console.error('Error fetching account insights:', error);
      return {};
    }
  }

  /**
   * Generate comprehensive client report
   */
  async generateClientReport(
    adAccountId: string,
    dateStart: string,
    dateEnd: string
  ): Promise<ClientReport> {
    try {
      // Get account insights (not used in current implementation but kept for future use)
      await this.getAccountInsights(adAccountId, dateStart, dateEnd);
      
      // Get campaign insights
      const campaigns = await this.getCampaignInsights(adAccountId, dateStart, dateEnd);
      
      // Get all campaigns for status count
      const allCampaigns = await this.getCampaigns(adAccountId);
      
      // Calculate summary metrics
      const totalSpend = campaigns.reduce((sum, campaign) => sum + campaign.spend, 0);
      const totalImpressions = campaigns.reduce((sum, campaign) => sum + campaign.impressions, 0);
      const totalClicks = campaigns.reduce((sum, campaign) => sum + campaign.clicks, 0);
      const totalConversions = campaigns.reduce((sum, campaign) => sum + campaign.conversions, 0);
      
      const averageCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
      const averageCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
      const averageCpa = totalConversions > 0 ? totalSpend / totalConversions : 0;
      
      const activeCampaigns = allCampaigns.filter(campaign => campaign.status === 'ACTIVE').length;
      
      const accountSummary: AccountSummary = {
        total_spend: totalSpend,
        total_impressions: totalImpressions,
        total_clicks: totalClicks,
        total_conversions: totalConversions,
        average_ctr: averageCtr,
        average_cpc: averageCpc,
        average_cpa: averageCpa,
        active_campaigns: activeCampaigns,
        total_campaigns: allCampaigns.length,
      };

      return {
        account_summary: accountSummary,
        campaigns: campaigns,
        date_range: {
          start: dateStart,
          end: dateEnd,
        },
        generated_at: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error generating client report:', error);
      throw error;
    }
  }

  /**
   * Get placement performance data for Top Placement Performance table
   */
  async getPlacementPerformance(
    adAccountId: string,
    dateStart: string,
    dateEnd: string
  ): Promise<any[]> {
    try {
      const fields = [
        'spend',
        'impressions',
        'clicks',
        'ctr',
        'cpc',
        'cpp'
      ].join(',');

      const params = new URLSearchParams({
        access_token: this.accessToken,
        fields: fields,
        time_range: JSON.stringify({
          since: dateStart,
          until: dateEnd,
        }),
        breakdowns: 'publisher_platform',
        level: 'campaign',
        limit: '100',
      });

      const accountIdWithPrefix = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
      const url = `${this.baseUrl}/${accountIdWithPrefix}/insights?${params.toString()}`;
      
      console.log('🔗 Meta API Placement Performance URL:', url.replace(this.accessToken, 'HIDDEN_TOKEN'));

      const response = await fetch(url);
      const data: MetaAPIResponse = await response.json();

      if (!response.ok || data.error) {
        console.error('❌ Meta API Placement Performance Error:', data.error);
        throw new Error(`Meta API Error: ${data.error?.message || 'Unknown error'}`);
      }

      if (data.data) {
        const placements = data.data.map(insight => ({
          placement: insight.publisher_platform || 'Unknown',
          spend: parseFloat(insight.spend || '0'),
          impressions: parseInt(insight.impressions || '0'),
          clicks: parseInt(insight.clicks || '0'),
          ctr: parseFloat(insight.ctr || '0'),
          cpc: parseFloat(insight.cpc || '0'),
          cpp: insight.cpp ? parseFloat(insight.cpp) : null,
        }));

        console.log('✅ Parsed placement performance:', placements.length, 'placements');
        return placements;
      }

      return [];
    } catch (error) {
      console.error('💥 Error fetching placement performance:', error);
      throw error;
    }
  }

  /**
   * Get demographic performance data for Demographic Performance table
   */
  async getDemographicPerformance(
    adAccountId: string,
    dateStart: string,
    dateEnd: string
  ): Promise<any[]> {
    try {
      const fields = [
        'spend',
        'impressions',
        'clicks',
        'ctr',
        'cpc',
        'cpp'
      ].join(',');

      const params = new URLSearchParams({
        access_token: this.accessToken,
        fields: fields,
        time_range: JSON.stringify({
          since: dateStart,
          until: dateEnd,
        }),
        breakdowns: 'age,gender',
        level: 'campaign',
        limit: '100',
      });

      const accountIdWithPrefix = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
      const url = `${this.baseUrl}/${accountIdWithPrefix}/insights?${params.toString()}`;
      
      console.log('🔗 Meta API Demographic Performance URL:', url.replace(this.accessToken, 'HIDDEN_TOKEN'));

      const response = await fetch(url);
      const data: MetaAPIResponse = await response.json();

      if (!response.ok || data.error) {
        console.error('❌ Meta API Demographic Performance Error:', data.error);
        throw new Error(`Meta API Error: ${data.error?.message || 'Unknown error'}`);
      }

      if (data.data) {
        const demographics = data.data.map(insight => ({
          age: insight.age || 'Unknown',
          gender: insight.gender || 'Unknown',
          spend: parseFloat(insight.spend || '0'),
          impressions: parseInt(insight.impressions || '0'),
          clicks: parseInt(insight.clicks || '0'),
          ctr: parseFloat(insight.ctr || '0'),
          cpc: parseFloat(insight.cpc || '0'),
          cpp: insight.cpp ? parseFloat(insight.cpp) : null,
        }));

        console.log('✅ Parsed demographic performance:', demographics.length, 'demographics');
        return demographics;
      }

      return [];
    } catch (error) {
      console.error('💥 Error fetching demographic performance:', error);
      throw error;
    }
  }

  /**
   * Get ad relevance and results data for Ad Relevance & Results table
   */
  async getAdRelevanceResults(
    adAccountId: string,
    dateStart: string,
    dateEnd: string
  ): Promise<any[]> {
    try {
      const fields = [
        'ad_name',
        'spend',
        'impressions',
        'clicks',
        'cpp',
        'quality_ranking',
        'engagement_rate_ranking',
        'conversion_rate_ranking'
      ].join(',');

      const params = new URLSearchParams({
        access_token: this.accessToken,
        fields: fields,
        time_range: JSON.stringify({
          since: dateStart,
          until: dateEnd,
        }),
        level: 'ad',
        limit: '100',
      });

      const accountIdWithPrefix = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
      const url = `${this.baseUrl}/${accountIdWithPrefix}/insights?${params.toString()}`;
      
      console.log('🔗 Meta API Ad Relevance Results URL:', url.replace(this.accessToken, 'HIDDEN_TOKEN'));

      const response = await fetch(url);
      const data: MetaAPIResponse = await response.json();

      if (!response.ok || data.error) {
        console.error('❌ Meta API Ad Relevance Results Error:', data.error);
        throw new Error(`Meta API Error: ${data.error?.message || 'Unknown error'}`);
      }

      if (data.data) {
        const ads = data.data.map(insight => ({
          ad_name: insight.ad_name || 'Unknown Ad',
          spend: parseFloat(insight.spend || '0'),
          impressions: parseInt(insight.impressions || '0'),
          clicks: parseInt(insight.clicks || '0'),
          cpp: insight.cpp ? parseFloat(insight.cpp) : null,
          quality_ranking: insight.quality_ranking || 'UNKNOWN',
          engagement_rate_ranking: insight.engagement_rate_ranking || 'UNKNOWN',
          conversion_rate_ranking: insight.conversion_rate_ranking || 'UNKNOWN',
        }));

        console.log('✅ Parsed ad relevance results:', ads.length, 'ads');
        return ads;
      }

      return [];
    } catch (error) {
      console.error('💥 Error fetching ad relevance results:', error);
      throw error;
    }
  }
}

export default MetaAPIService; 