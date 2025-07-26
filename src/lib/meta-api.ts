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

export class MetaAPIService {
  private accessToken: string;
  private baseUrl = 'https://graph.facebook.com/v18.0';

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  /**
   * Test if the access token is valid
   */
  async validateToken(): Promise<{ valid: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/me?access_token=${this.accessToken}`);
      const data = await response.json();

      if (data.error) {
        return { valid: false, error: data.error.message };
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, error: 'Network error or invalid token' };
    }
  }

  /**
   * Get ad accounts accessible with this token
   */
  async getAdAccounts(): Promise<AdAccount[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/me/adaccounts?fields=id,name,account_id,currency,timezone_name&access_token=${this.accessToken}`
      );
      const data: MetaAPIResponse = await response.json();

      if (data.data) {
        return data.data.map(account => ({
          id: account.id,
          name: account.name,
          account_id: account.account_id,
          currency: account.currency,
          timezone_name: account.timezone_name,
        }));
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
      return data.data || [];
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
}

export default MetaAPIService; 