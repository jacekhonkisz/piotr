/**
 * Meta (Facebook/Instagram) Ads API Integration
 * Fetches real campaign data using Meta Business API
 */

interface MetaAPIResponse {
  data: any[];
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
    dateEnd: string
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

      const response = await fetch(
        `${this.baseUrl}/act_${adAccountId}/insights?${params.toString()}`
      );

      const data: MetaAPIResponse = await response.json();

      if (data.data) {
        return data.data.map(insight => ({
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
      }

      return [];
    } catch (error) {
      console.error('Error fetching campaign insights:', error);
      return [];
    }
  }

  /**
   * Get campaigns for an ad account
   */
  async getCampaigns(adAccountId: string): Promise<any[]> {
    const cacheKey = this.getCacheKey('campaigns', adAccountId);
    const cached = this.getCachedResponse(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const fields = [
        'id',
        'name',
        'status',
        'objective',
        'created_time',
        'updated_time',
      ].join(',');

      const params = new URLSearchParams({
        access_token: this.accessToken,
        fields: fields,
        limit: '100',
      });

      const response = await fetch(
        `${this.baseUrl}/act_${adAccountId}/campaigns?${params.toString()}`
      );

      const data: MetaAPIResponse = await response.json();
      const campaigns = data.data || [];
      
      this.setCachedResponse(cacheKey, campaigns);
      return campaigns;
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      return [];
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

      const response = await fetch(
        `${this.baseUrl}/act_${adAccountId}/insights?${params.toString()}`
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
}

export default MetaAPIService; 