/**
 * Meta (Facebook/Instagram) Ads API Integration
 * Fetches real campaign data using Meta Business API
 */

import logger from './logger';

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
  status?: string;
  cpm?: number;
  
  // Conversion tracking metrics
  click_to_call?: number;
  email_contacts?: number;
  booking_step_1?: number;
  reservations?: number;
  reservation_value?: number;
  roas?: number;
  cost_per_reservation?: number;
  booking_step_2?: number;
  booking_step_3?: number;
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

interface TokenInfo {
  app_id: string;
  type: string;
  application: string;
  data_access_expires_at: number;
  expires_at: number;
  is_valid: boolean;
  scopes: string[];
  user_id: string;
}

// DEPRECATED: Use MetaAPIServiceOptimized instead
// This cache has been replaced with memory-managed cache to prevent memory leaks
const apiCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Memory leak prevention: Limit cache size and add cleanup
const MAX_CACHE_SIZE = 500;
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  const keysToDelete: string[] = [];
  
  for (const [key, entry] of apiCache.entries()) {
    if (now - entry.timestamp > CACHE_DURATION) {
      keysToDelete.push(key);
    }
  }
  
  keysToDelete.forEach(key => apiCache.delete(key));
  
  // If still too large, remove oldest entries
  if (apiCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(apiCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = entries.slice(0, apiCache.size - MAX_CACHE_SIZE);
    toRemove.forEach(([key]) => apiCache.delete(key));
  }
}, 2 * 60 * 1000); // Cleanup every 2 minutes

// Cleanup on process exit
process.on('exit', () => {
  clearInterval(cleanupInterval);
  apiCache.clear();
});

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

  public clearCache(): void {
    apiCache.clear();
    logger.info('🗑️ Meta API cache cleared');
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
   * Get detailed token information including expiration
   */
  async getTokenInfo(): Promise<{ 
    success: boolean; 
    info?: TokenInfo; 
    error?: string;
    expiresAt?: Date | null;
    isLongLived: boolean;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/debug_token?input_token=${this.accessToken}&access_token=${this.accessToken}`);
      const data = await response.json();

      if (data.error) {
        return { success: false, error: data.error.message, isLongLived: false };
      }

      const tokenInfo: TokenInfo = data.data;
      
      // Determine if token is long-lived
      const isLongLived = tokenInfo.expires_at === 0;
      const expiresAt = isLongLived ? null : new Date(tokenInfo.expires_at * 1000);

      return {
        success: true,
        info: tokenInfo,
        expiresAt,
        isLongLived
      };
    } catch (error) {
      return { 
        success: false, 
        error: `Token info error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        isLongLived: false
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
    expiresAt?: Date | null | undefined;
    tokenInfo?: TokenInfo;
  }> {
    try {
      // First, get detailed token information
      const tokenInfoResult = await this.getTokenInfo();
      
      if (!tokenInfoResult.success) {
        return { 
          valid: false, 
          error: tokenInfoResult.error || 'Failed to get token information',
          isLongLived: false
        };
      }

      const { info: tokenInfo, expiresAt, isLongLived } = tokenInfoResult;

      // Check if token is valid
      if (!tokenInfo?.is_valid) {
        return { 
          valid: false, 
          error: 'Token is invalid or has been revoked',
          isLongLived: false
        };
      }

      // Check if token has required permissions
      const requiredScopes = ['ads_read', 'ads_management'];
      const hasRequiredScopes = requiredScopes.every(scope => 
        tokenInfo.scopes?.includes(scope)
      );

      if (!hasRequiredScopes) {
        return { 
          valid: false, 
          error: `Token missing required permissions. Need: ${requiredScopes.join(', ')}. Found: ${tokenInfo.scopes?.join(', ') || 'none'}`,
          isLongLived,
          expiresAt: expiresAt || null,
          tokenInfo
        };
      }

      // Test if token has ads_read permission by trying to get ad accounts
      try {
        const adAccountsResponse = await fetch(
          `${this.baseUrl}/me/adaccounts?fields=id,name,account_id&access_token=${this.accessToken}`
        );
        
        if (adAccountsResponse.status === 403) {
          return { 
            valid: false, 
            error: 'Access token does not have required permissions. Need: ads_read, ads_management',
            isLongLived,
            expiresAt,
            tokenInfo
          };
        }
        
        const adAccountsData = await adAccountsResponse.json();
        
        if (adAccountsData.error) {
          return { 
            valid: false, 
            error: `Ad accounts access error: ${adAccountsData.error.message}`,
            isLongLived,
            expiresAt,
            tokenInfo
          };
        }

        // If token is already long-lived, return success with correct expiration
        if (isLongLived) {
          return { 
            valid: true, 
            permissions: tokenInfo.scopes,
            isLongLived: true,
            expiresAt: expiresAt || null, // Keep the actual expiration date
            tokenInfo
          };
        }

        // Token is short-lived, try to convert to long-lived
        const conversionResult = await this.convertToLongLivedToken();
        
        if (conversionResult.success && conversionResult.token) {
          return { 
            valid: true, 
            permissions: tokenInfo.scopes,
            convertedToken: conversionResult.token,
            isLongLived: true,
            expiresAt: null,
            tokenInfo
          };
        } else {
          // Conversion failed, but token is still valid
          return { 
            valid: true, 
            permissions: tokenInfo.scopes,
            isLongLived: false,
            expiresAt,
            tokenInfo
          };
        }

      } catch (adAccountsError) {
        return { 
          valid: false, 
          error: 'Cannot access ad accounts. Token may lack required permissions.',
          isLongLived,
          expiresAt,
          tokenInfo
        };
      }

    } catch (error) {
      return { 
        valid: false, 
        error: `Network error or invalid token: ${error instanceof Error ? error.message : 'Unknown error'}`,
        isLongLived: false
      };
    }
  }

  /**
   * Test if the access token is valid and has required permissions
   */
  async validateToken(): Promise<{ valid: boolean; error?: string; permissions?: string[] }> {
    try {
      // First, test basic token validity
      logger.info('⏱️ Starting token validation with timeout...');
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Token validation timeout after 10 seconds')), 10000);
      });
      
      const response = await Promise.race([
        fetch(`${this.baseUrl}/me?access_token=${this.accessToken}`),
        timeoutPromise
      ]) as Response;
      
      logger.info('📡 Token validation fetch completed...');
      
      const data = await response.json();

      if (data.error) {
        return { valid: false, error: data.error.message };
      }

      // Test if token has ads_read permission by trying to get ad accounts
      try {
        logger.info('⏱️ Testing ad accounts access with timeout...');
        
        const adAccountsResponse = await Promise.race([
          fetch(
            `${this.baseUrl}/me/adaccounts?fields=id,name,account_id&access_token=${this.accessToken}`
          ),
          timeoutPromise
        ]) as Response;
        
        logger.info('📡 Ad accounts test completed...');
        
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
      
      logger.info('⏱️ Starting ad account validation with timeout...');
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Ad account validation timeout after 10 seconds')), 10000);
      });
      
      const response = await Promise.race([
        fetch(
          `${this.baseUrl}/act_${cleanAccountId}?fields=id,name,account_id,account_status,currency,timezone_name&access_token=${this.accessToken}`
        ),
        timeoutPromise
      ]) as Response;
      
      logger.info('📡 Ad account validation fetch completed...');
      
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
      logger.error('Error fetching ad accounts:', error);
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
      // DISABLED CACHING for live conversion metrics - always fetch fresh data
      logger.info('🔄 LIVE FETCH: Always fetching fresh campaign insights (no cache)');

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
        'actions',
        'action_values',
        'cost_per_action_type',
        'cost_per_conversion',
        'conversion_values',
        'cpm',
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
      logger.info('🔗 Meta API URL:', url.replace(this.accessToken, 'HIDDEN_TOKEN'));
      logger.info('📅 Date Range for API call:', { dateStart, dateEnd, timeIncrement });

      logger.info('⏱️ Starting Meta API fetch with timeout...');
      
      // Create a timeout promise (increased for better reliability)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Meta API call timeout after 25 seconds')), 25000);
      });
      
      // Race between the fetch and timeout
      const response = await Promise.race([
        fetch(url),
        timeoutPromise
      ]) as Response;
      
      logger.info('📡 Meta API fetch completed, processing response...');
      
      const data: MetaAPIResponse = await response.json();

      logger.info('📥 Meta API Response Status:', response.status);
      logger.info('📥 Meta API Response Data:', {
        hasData: !!data.data,
        dataLength: data.data?.length || 0,
        hasError: !!data.error,
        error: data.error,
        paging: data.paging
      });

      if (!response.ok) {
        logger.error('❌ Meta API Error Response:', data);
        throw new Error(`Meta API Error: ${data.error?.message || 'Unknown error'} (Code: ${data.error?.code || response.status})`);
      }

      if (data.error) {
        logger.error('❌ Meta API returned error:', data.error);
        throw new Error(`Meta API Error: ${data.error.message} (Code: ${data.error.code})`);
      }

      // Handle case where no data is returned (common for large date ranges with no campaigns)
      if (!data.data || data.data.length === 0) {
        logger.info('⚠️ No campaign data returned from Meta API - this is normal for date ranges with no active campaigns');
        return [];
      }

      if (data.data) {
        // If campaign names are missing, fetch them separately
        const campaignNames = new Map<string, string>();
        const insightsWithMissingNames = data.data.filter(insight => 
          !insight.campaign_name && !insight.name && insight.campaign_id
        );
        
        if (insightsWithMissingNames.length > 0) {
          logger.info(`🔍 Fetching campaign names for ${insightsWithMissingNames.length} campaigns with missing names`);
          try {
            const campaigns = await this.getCampaigns(adAccountId);
            campaigns.forEach(campaign => {
              if (campaign.id && campaign.name) {
                campaignNames.set(campaign.id, campaign.name);
              }
            });
            logger.info(`✅ Fetched ${campaignNames.size} campaign names`);
          } catch (error) {
            logger.warn('⚠️ Failed to fetch campaign names:', error);
          }
        }

        const insights = data.data.map(insight => {
          // Parse conversion tracking data from actions
          let click_to_call = 0;
          let email_contacts = 0;
          let booking_step_1 = 0;
          let reservations = 0;
          let reservation_value = 0;
          let booking_step_2 = 0;
          let booking_step_3 = 0;

          // Extract action data if available (support both nested insights and fields payloads)
          const actionsArray = (insight.actions && Array.isArray(insight.actions))
            ? insight.actions
            : (insight.action_types && Array.isArray(insight.action_types) ? insight.action_types : []);

          logger.info('🔍 MetaAPI: Campaign', insight.campaign_name, 'has', actionsArray.length, 'total actions');
          if (actionsArray.length === 0) {
            logger.info('🔍 MetaAPI: No actions found for campaign', insight.campaign_name);
            logger.info('🔍 MetaAPI: Available insight keys:', Object.keys(insight));
          }

          if (actionsArray.length > 0) {
            logger.info('🔍 MetaAPI: Found actions array for campaign', insight.campaign_name, 'with', actionsArray.length, 'actions');
            logger.info('🔍 MetaAPI: Action types found:', actionsArray.map((a: any) => a.action_type || a.type));
            
            // 🔧 ENHANCED LOGGING: Show ALL action details for July 2025 debugging
            const dateStart = insight.date_start || '';
            if (dateStart.includes('2025-07')) {
              logger.info('🔍 JULY 2025 DEBUG - ALL ACTIONS for', insight.campaign_name, ':', 
                actionsArray.map((a: any) => ({
                  action_type: a.action_type || a.type,
                  value: a.value || a.count || 0,
                  raw: a
                }))
              );
            }
            
            actionsArray.forEach((action: any) => {
              const actionType = String(action.action_type || action.type || '').toLowerCase();
              const valueNum = Number(action.value ?? action.count ?? 0);
              
              logger.info('🔍 MetaAPI: Processing action:', { actionType, valueNum });

              // 1. Potencjalne kontakty telefoniczne - Enhanced with more action types
              if (actionType.includes('click_to_call') || 
                  actionType.includes('call_confirm') ||
                  actionType.includes('phone_number_clicks') ||
                  actionType.includes('call_placed') ||
                  actionType.includes('phone_number_click') ||
                  actionType.includes('call_button') ||
                  actionType.includes('phone_call')) {
                click_to_call += valueNum;
              }
              // 2. Potencjalne kontakty email
              if (actionType.includes('link_click') || actionType.includes('mailto') || actionType.includes('email')) {
                email_contacts += valueNum;
              }
              // 3. Kroki rezerwacji – Etap 1 (search event in Booking Engine)
              if (actionType.includes('booking_step_1') || actionType === 'search' || actionType.includes('search')) {
                booking_step_1 += valueNum;
              }
              // 4. Rezerwacje (purchase)
              if (actionType === 'purchase' || actionType.includes('fb_pixel_purchase')) {
                reservations += valueNum;
              }
              // 8. Etap 2 rezerwacji - View content event in Booking Engine
              if (actionType.includes('booking_step_2') || 
                  actionType.includes('view_content') ||
                  actionType === 'view_content' ||
                  actionType.includes('offsite_conversion.custom.1150356839010935')) {
                booking_step_2 += valueNum;
                // 🔧 ENHANCED LOGGING: Track when booking_step_2 is found
                logger.info('✅ FOUND booking_step_2:', { actionType, valueNum, campaign: insight.campaign_name });
              }
              // 9. Etap 3 rezerwacji - Initiate checkout event in Booking Engine
              if (actionType.includes('booking_step_3') || 
                  actionType === 'initiate_checkout' ||
                  actionType.includes('initiate_checkout') ||
                  actionType.includes('offsite_conversion.custom.3490904591193350')) {
                booking_step_3 += valueNum;
                // 🔧 ENHANCED LOGGING: Track when booking_step_3 is found
                logger.info('✅ FOUND booking_step_3:', { actionType, valueNum, campaign: insight.campaign_name });
              }
            });
          }

          // 🔍 ENHANCED META API DEBUG - Track all action types and reach data
          logger.info('🔍 META API DEBUG - Campaign Analysis:', {
            campaign: insight.campaign_name,
            date_start: insight.date_start,
            date_stop: insight.date_stop,
            totalActions: actionsArray.length,
            actionTypes: actionsArray.map((a: any) => ({
              type: a.action_type || a.type,
              value: a.value
            })),
            booking_step_3_found: booking_step_3 > 0,
            booking_step_3_value: booking_step_3,
            reach_found: !!insight.reach,
            reach_value: insight.reach,
            impressions: insight.impressions,
            spend: insight.spend
          });

          // 5. Wartość rezerwacji - handle both action_values and value fields
          const actionValuesArray = (insight.action_values && Array.isArray(insight.action_values)) ? insight.action_values : [];
          actionValuesArray.forEach((actionValue: any) => {
            const t = String(actionValue.action_type || '').toLowerCase();
            const v = Number(actionValue.value || 0);
            if (t === 'purchase' || t.includes('fb_pixel_purchase')) {
              reservation_value += v;
            }
          });

          // 6. ROAS (Return on Ad Spend) - Calculate
          const spend = parseFloat(insight.spend || '0');
          const roas = spend > 0 && reservation_value > 0 ? reservation_value / spend : 0;

          // 7. Koszt per rezerwacja (średni koszt za rezerwację) - Calculate
          const cost_per_reservation = reservations > 0 ? spend / reservations : 0;

          // DEBUG: Log final calculations
          logger.info(`📊 FINAL CALCULATIONS for ${insight.campaign_name}:`);
          logger.info(`   💰 Spend: ${spend} zł`);
          logger.info(`   ✅ Reservations: ${reservations}`);
          logger.info(`   💵 Reservation Value: ${reservation_value} zł`);
          logger.info(`   📈 ROAS: ${roas.toFixed(2)}x`);
          logger.info(`   💲 Cost per Reservation: ${cost_per_reservation.toFixed(2)} zł`);
          
          // 🔧 ENHANCED LOGGING: Show booking steps for July 2025
          const dateStart = insight.date_start || '';
          if (dateStart.includes('2025-07')) {
            logger.info(`🎯 JULY 2025 BOOKING STEPS for ${insight.campaign_name}:`);
            logger.info(`   📋 booking_step_1: ${booking_step_1}`);
            logger.info(`   📋 booking_step_2: ${booking_step_2} ← SHOULD NOT BE 0 IF TRACKED`);
            logger.info(`   📋 booking_step_3: ${booking_step_3} ← SHOULD NOT BE 0 IF TRACKED`);
          }

          // Validate conversion funnel logic (Etap 1 should be >= Etap 2)
          if (booking_step_2 > booking_step_1 && booking_step_1 > 0) {
            logger.warn(`⚠️ CONVERSION FUNNEL INVERSION: Campaign "${insight.campaign_name}" has Etap 2 (${booking_step_2}) > Etap 1 (${booking_step_1}). This may indicate misconfigured action types.`);
          }

          // Calculate total conversions from all tracked conversion types
          const totalConversions = click_to_call + email_contacts + booking_step_1 + reservations + booking_step_2;
          
          return {
            campaign_id: insight.campaign_id || 'unknown',
            campaign_name: insight.campaign_name || insight.name || campaignNames.get(insight.campaign_id) || 'Unknown Campaign',
            impressions: parseInt(insight.impressions || '0'),
            clicks: parseInt(insight.clicks || '0'),
            spend: spend,
            conversions: totalConversions || parseInt(insight.conversions?.[0]?.value || '0'),
            ctr: parseFloat(insight.ctr || '0'),
            cpc: parseFloat(insight.cpc || '0'),
            ...(insight.cpp && { cpp: parseFloat(insight.cpp) }),
            ...(insight.frequency && { frequency: parseFloat(insight.frequency) }),
            ...(insight.reach && { reach: parseInt(insight.reach) }),
            ...(insight.cpm && { cpm: parseFloat(insight.cpm) }),
            date_start: insight.date_start || dateStart,
            date_stop: insight.date_stop || dateEnd,
            
            // Conversion tracking metrics
            click_to_call,
            email_contacts,
            booking_step_1,
            reservations,
            reservation_value,
            roas,
            cost_per_reservation,
            booking_step_2,
            booking_step_3,
          } as CampaignInsights;
        });

        logger.info('✅ Parsed campaign insights:', insights.length, 'campaigns');
        
        // CACHING DISABLED - always return fresh data for live conversion metrics
        return insights;
      }

      logger.info('⚠️ No campaign insights data in response');
      return [];
    } catch (error) {
      logger.error('💥 Error fetching campaign insights:', error);
      logger.error('💥 Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        adAccountId,
        dateRange: { dateStart, dateEnd }
      });
      throw error; // Re-throw the error instead of returning empty array
    }
  }

  /**
   * Get COMPLETE campaign insights with pagination to fetch ALL campaigns
   * This is the improved method that ensures no data is missed
   */
  async getCompleteCampaignInsights(
    adAccountId: string,
    dateStart: string,
    dateEnd: string
  ): Promise<CampaignInsights[]> {
    try {
      logger.info('🔄 COMPLETE FETCH: Fetching ALL campaigns with pagination');

      const fields = [
        'campaign_id',
        'campaign_name',
        'impressions',
        'clicks',
        'spend',
        'actions',
        'cost_per_action_type',
        'action_values'
      ].join(',');

      // Ensure we have the act_ prefix for the API call
      const accountIdWithPrefix = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
      
      let allCampaigns: any[] = [];
      let nextUrl: string | null = `${this.baseUrl}/${accountIdWithPrefix}/insights`;
      
      const baseParams = new URLSearchParams({
        access_token: this.accessToken,
        fields: fields,
        time_range: JSON.stringify({
          since: dateStart,
          until: dateEnd,
        }),
        level: 'campaign',
        limit: '200' // Increased limit to reduce API calls
      });

      // Handle pagination to get ALL campaigns
      while (nextUrl) {
        const url = nextUrl.includes('?') ? nextUrl : `${nextUrl}?${baseParams.toString()}`;
        
        logger.info('📡 Fetching campaigns page:', url.replace(this.accessToken, 'HIDDEN_TOKEN'));
        
        const response = await fetch(url);
        const data: MetaAPIResponse = await response.json();

        if (data.error) {
          throw new Error(`Meta API Error: ${data.error.message} (Code: ${data.error.code})`);
        }

        const campaigns = data.data || [];
        allCampaigns = allCampaigns.concat(campaigns);
        
        // Check for pagination
        nextUrl = data.paging && data.paging.next ? data.paging.next : null;
        
        logger.info(`📈 Fetched ${campaigns.length} campaigns (total: ${allCampaigns.length})`);
        
        // Add delay between paginated requests to respect rate limits
        if (nextUrl) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      logger.info(`✅ COMPLETE: Fetched total of ${allCampaigns.length} campaigns`);

      // Process all campaigns using the same logic as getCampaignInsights
      const insights = allCampaigns.map(insight => {
        // Parse conversion tracking data from actions
        let click_to_call = 0;
        let email_contacts = 0;
        let booking_step_1 = 0;
        let reservations = 0;
        let reservation_value = 0;
        let booking_step_2 = 0;
        let booking_step_3 = 0; // Initialize booking_step_3

        // Extract action data (using the same logic as getCampaignInsights)
        const actionsArray = (insight.actions && Array.isArray(insight.actions))
          ? insight.actions
          : (insight.action_types && Array.isArray(insight.action_types) ? insight.action_types : []);

        if (actionsArray.length > 0) {
          actionsArray.forEach((action: any) => {
            const actionType = String(action.action_type || action.type || '').toLowerCase();
            const valueNum = Number(action.value ?? action.count ?? 0);

            // 1. Potencjalne kontakty telefoniczne - Enhanced with more action types
            if (actionType.includes('click_to_call') || 
                actionType.includes('call_confirm') ||
                actionType.includes('phone_number_clicks') ||
                actionType.includes('call_placed') ||
                actionType.includes('phone_number_click') ||
                actionType.includes('call_button') ||
                actionType.includes('phone_call')) {
              click_to_call += valueNum;
            }
            // 2. Potencjalne kontakty email
            if (actionType.includes('link_click') || actionType.includes('mailto') || actionType.includes('email')) {
              email_contacts += valueNum;
            }
            // 3. Kroki rezerwacji – Etap 1 (search event in Booking Engine)
            if (actionType.includes('booking_step_1') || actionType === 'search' || actionType.includes('search')) {
              booking_step_1 += valueNum;
            }
            // 4. Rezerwacje (purchase)
            if (actionType === 'purchase' || actionType.includes('fb_pixel_purchase')) {
              reservations += valueNum;
            }
            // 8. Etap 2 rezerwacji - View content event in Booking Engine
            if (actionType.includes('booking_step_2') || 
                actionType.includes('view_content') ||
                actionType === 'view_content') {
              booking_step_2 += valueNum;
            }
            // 9. Etap 3 rezerwacji - Initiate checkout event in Booking Engine
            if (actionType.includes('booking_step_3') || 
                actionType === 'initiate_checkout' ||
                actionType.includes('initiate_checkout')) {
              booking_step_3 += valueNum;
            }
          });
        }

        // 5. Wartość rezerwacji - handle both action_values and value fields
        const actionValuesArray = (insight.action_values && Array.isArray(insight.action_values)) ? insight.action_values : [];
        actionValuesArray.forEach((actionValue: any) => {
          const t = String(actionValue.action_type || '').toLowerCase();
          const v = Number(actionValue.value || 0);
          if (t === 'purchase' || t.includes('fb_pixel_purchase')) {
            reservation_value += v;
          }
        });

        // Calculate metrics
        const spend = parseFloat(insight.spend || '0');
        const roas = spend > 0 && reservation_value > 0 ? reservation_value / spend : 0;
        const cost_per_reservation = reservations > 0 ? spend / reservations : 0;

        // Validate conversion funnel logic (Etap 1 should be >= Etap 2 >= Etap 3)
        if (booking_step_2 > booking_step_1 && booking_step_1 > 0) {
          logger.warn(`⚠️ CONVERSION FUNNEL INVERSION: Campaign "${insight.campaign_name}" has Etap 2 (${booking_step_2}) > Etap 1 (${booking_step_1}). This may indicate misconfigured action types.`);
        }
        if (booking_step_3 > booking_step_2 && booking_step_2 > 0) {
          logger.warn(`⚠️ CONVERSION FUNNEL INVERSION: Campaign "${insight.campaign_name}" has Etap 3 (${booking_step_3}) > Etap 2 (${booking_step_2}). This may indicate misconfigured action types.`);
        }

        // Calculate total conversions from all tracked conversion types
        const totalConversions = click_to_call + email_contacts + booking_step_1 + reservations + booking_step_2 + booking_step_3;
        
        // Calculate CTR and CPC if not provided
        const impressions = parseInt(insight.impressions || '0');
        const clicks = parseInt(insight.clicks || '0');
        const calculatedCtr = impressions > 0 ? (clicks / impressions) * 100 : 0;
        const calculatedCpc = clicks > 0 ? spend / clicks : 0;

        return {
          campaign_id: insight.campaign_id || 'unknown',
          campaign_name: insight.campaign_name || 'Unknown Campaign',
          impressions: impressions,
          clicks: clicks,
          spend: spend,
          conversions: totalConversions,
          ctr: parseFloat(insight.ctr || calculatedCtr.toString()),
          cpc: parseFloat(insight.cpc || calculatedCpc.toString()),
          ...(insight.cpp && { cpp: parseFloat(insight.cpp) }),
          ...(insight.frequency && { frequency: parseFloat(insight.frequency) }),
          ...(insight.reach && { reach: parseInt(insight.reach) }),
          ...(insight.cpm && { cpm: parseFloat(insight.cpm) }),
          date_start: insight.date_start || dateStart,
          date_stop: insight.date_stop || dateEnd,
          
          // Conversion tracking metrics
          click_to_call,
          email_contacts,
          booking_step_1,
          reservations,
          reservation_value,
          roas,
          cost_per_reservation,
          booking_step_2,
          booking_step_3, // Include booking_step_3 in return object
        } as CampaignInsights;
      });

      logger.info('✅ COMPLETE: Processed all campaigns with full data');
      return insights;

    } catch (error) {
      logger.error('💥 Error in getCompleteCampaignInsights:', error);
      throw error;
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
      const startDate: string = new Date(year, month - 1, 1).toISOString().split('T')[0] || '';
      const endDate: string = new Date(year, month, 0).toISOString().split('T')[0] || '';
      
      logger.info(`📅 Fetching monthly insights for ${year}-${month.toString().padStart(2, '0')} (${startDate} to ${endDate})`);
      
      // Use time_increment=1 to get daily breakdown
      const insights = await this.getCampaignInsights(adAccountId, startDate, endDate, 1);
      
      // Group by campaign and aggregate daily data
      const campaignMap = new Map<string, CampaignInsights>();
      
      insights.forEach(insight => {
        const campaignId = insight.campaign_id;
        
        if (!campaignMap.has(campaignId)) {
          campaignMap.set(campaignId, {
            campaign_id: campaignId,
            campaign_name: insight.campaign_name || 'Unknown Campaign',
            impressions: 0,
            clicks: 0,
            spend: 0,
            conversions: 0,
            ctr: 0,
            cpc: 0,
            date_start: startDate,
            date_stop: endDate,
            // Initialize conversion tracking fields
            click_to_call: 0,
            email_contacts: 0,
            booking_step_1: 0,
            booking_step_2: 0,
            booking_step_3: 0,
            reservations: 0,
            reservation_value: 0,
            roas: 0,
            cost_per_reservation: 0,
          });
        }
        
        const campaign = campaignMap.get(campaignId)!;
        campaign.impressions += insight.impressions;
        campaign.clicks += insight.clicks;
        campaign.spend += insight.spend;
        campaign.conversions += insight.conversions;
        // Aggregate conversion tracking fields
        campaign.click_to_call = (campaign.click_to_call || 0) + (insight.click_to_call || 0);
        campaign.email_contacts = (campaign.email_contacts || 0) + (insight.email_contacts || 0);
        campaign.booking_step_1 = (campaign.booking_step_1 || 0) + (insight.booking_step_1 || 0);
        campaign.booking_step_2 = (campaign.booking_step_2 || 0) + (insight.booking_step_2 || 0);
        campaign.booking_step_3 = (campaign.booking_step_3 || 0) + (insight.booking_step_3 || 0);
        campaign.reservations = (campaign.reservations || 0) + (insight.reservations || 0);
        campaign.reservation_value = (campaign.reservation_value || 0) + (insight.reservation_value || 0);
      });
      
      // Calculate aggregated metrics
      const aggregatedInsights = Array.from(campaignMap.values()).map(campaign => ({
        ...campaign,
        ctr: campaign.impressions > 0 ? (campaign.clicks / campaign.impressions) * 100 : 0,
        cpc: campaign.clicks > 0 ? campaign.spend / campaign.clicks : 0,
        roas: campaign.spend > 0 && (campaign.reservation_value || 0) > 0 ? (campaign.reservation_value || 0) / campaign.spend : 0,
        cost_per_reservation: (campaign.reservations || 0) > 0 ? campaign.spend / (campaign.reservations || 0) : 0,
      }));
      
      logger.info(`✅ Aggregated ${aggregatedInsights.length} campaigns for ${year}-${month.toString().padStart(2, '0')}`);
      return aggregatedInsights;
    } catch (error) {
      logger.error('💥 Error fetching monthly campaign insights:', error);
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
      logger.info('🔗 Meta API URL:', url.replace(this.accessToken, 'HIDDEN_TOKEN'));
      
      logger.info('⏱️ Starting Meta API fetch with timeout...');
      
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Meta API call timeout after 15 seconds')), 15000);
      });
      
      // Race between the fetch and timeout
      const response = await Promise.race([
        fetch(url),
        timeoutPromise
      ]) as Response;
      
      logger.info('📡 Meta API fetch completed, processing response...');
      
      const data: MetaAPIResponse = await response.json();
      
      logger.info('📥 Meta API Response Status:', response.status);
      logger.info('📥 Meta API Response Data:', {
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
      logger.error('❌ Error fetching campaigns:', error);
      throw error;
    }
  }

  async getAccountInfo(adAccountId: string): Promise<any> {
    const endpoint = `act_${adAccountId}`;
    const params = new URLSearchParams({
      access_token: this.accessToken,
      fields: 'id,name,account_id,currency,timezone_name,account_status,disable_reason'
    });

    const cacheKey = this.getCacheKey(endpoint, params.toString());
    const cached = this.getCachedResponse(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const url = `${this.baseUrl}/${endpoint}?${params}`;
      logger.info('🔗 Meta API URL:', url.replace(this.accessToken, 'HIDDEN_TOKEN'));
      
      logger.info('⏱️ Starting account info fetch with timeout...');
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Account info fetch timeout after 10 seconds')), 10000);
      });
      
      const response = await Promise.race([
        fetch(url),
        timeoutPromise
      ]) as Response;
      
      logger.info('📡 Account info fetch completed...');
      
      const data = await response.json();
      
      logger.info('📥 Meta API Response Status:', response.status);
      logger.info('📥 Meta API Response Data:', data);

      if (data.error) {
        throw new Error(`Meta API Error: ${data.error.message} (Code: ${data.error.code})`);
      }

      // Cache the response
      apiCache.set(cacheKey, { data, timestamp: Date.now() });

      return data;
    } catch (error) {
      logger.error('❌ Error fetching account info:', error);
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
      logger.error('Error fetching account insights:', error);
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
      logger.error('Error generating client report:', error);
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
        'cpp',
        'actions',
        'action_values'
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
      
      logger.info('🔗 Meta API Placement Performance URL:', url.replace(this.accessToken, 'HIDDEN_TOKEN'));

      // Add timeout for meta tables (shorter timeout since these are less critical)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Meta API Placement Performance timeout after 10 seconds')), 10000);
      });
      
      const fetchPromise = fetch(url);
      
      const response = await Promise.race([fetchPromise, timeoutPromise]) as Response;
      const data: MetaAPIResponse = await response.json();

      if (!response.ok || data.error) {
        logger.error('❌ Meta API Placement Performance Error:', data.error);
        throw new Error(`Meta API Error: ${data.error?.message || 'Unknown error'}`);
      }

      if (data.data) {
        // First, normalize and map the raw data
        const rawPlacements = data.data.map(insight => {
          // Normalize placement names consistently
          let placement = insight.publisher_platform;
          if (!placement || placement === 'unknown' || placement === 'Unknown') {
            placement = 'Meta Platform';
          } else {
            // Standardize placement names
            switch (placement.toLowerCase()) {
              case 'facebook':
                placement = 'facebook';
                break;
              case 'instagram':
                placement = 'instagram';
                break;
              case 'audience_network':
                placement = 'audience_network';
                break;
              case 'messenger':
                placement = 'messenger';
                break;
              default:
                placement = placement.toLowerCase();
            }
          }
          
          // Extract conversion metrics from actions
          let reservations = 0;
          let reservation_value = 0;
          
          // Process actions array for conversion counts
          const actionsArray = (insight.actions && Array.isArray(insight.actions)) ? insight.actions : [];
          actionsArray.forEach((action: any) => {
            const actionType = String(action.action_type || '').toLowerCase();
            const valueNum = Number(action.value || 0);
            
            // Reservations (purchase events)
            if (actionType === 'purchase' || actionType.includes('fb_pixel_purchase')) {
              reservations += valueNum;
            }
          });
          
          // Process action_values array for conversion values
          const actionValuesArray = (insight.action_values && Array.isArray(insight.action_values)) ? insight.action_values : [];
          actionValuesArray.forEach((actionValue: any) => {
            const actionType = String(actionValue.action_type || '').toLowerCase();
            const value = Number(actionValue.value || 0);
            
            if (actionType === 'purchase' || actionType.includes('fb_pixel_purchase')) {
              reservation_value += value;
            }
          });
          
          return {
            placement: placement,
            spend: parseFloat(insight.spend || '0'),
            impressions: parseInt(insight.impressions || '0'),
            clicks: parseInt(insight.clicks || '0'),
            ctr: parseFloat(insight.ctr || '0'),
            cpc: parseFloat(insight.cpc || '0'),
            cpp: insight.cpp ? parseFloat(insight.cpp) : null,
            reservations: reservations,
            reservation_value: reservation_value,
          };
        });

        // Consolidate by placement (sum metrics for same placement)
        const consolidatedMap = new Map();
        
        rawPlacements.forEach(item => {
          const existing = consolidatedMap.get(item.placement);
          
          if (existing) {
            // Sum the metrics
            existing.spend += item.spend;
            existing.impressions += item.impressions;
            existing.clicks += item.clicks;
            existing.reservations += item.reservations;
            existing.reservation_value += item.reservation_value;
          } else {
            // Add new placement
            consolidatedMap.set(item.placement, { ...item });
          }
        });
        
        // Recalculate derived metrics for consolidated data
        const consolidated = Array.from(consolidatedMap.values()).map(item => ({
          ...item,
          ctr: item.impressions > 0 ? (item.clicks / item.impressions) * 100 : 0,
          cpc: item.clicks > 0 ? item.spend / item.clicks : 0,
          // Calculate CPA (Cost Per Action) - using clicks as proxy for actions
          cpa: item.clicks > 0 ? item.spend / item.clicks : 0,
          // Note: cpp (cost per purchase) is not aggregated since we don't have purchase data here
          cpp: null
        }));

        logger.info('✅ Consolidated placement performance:', consolidated.length, 'unique placements');
        logger.info('   Raw placements before consolidation:', rawPlacements.length);
        logger.info('   Consolidated placement types:', Array.from(new Set(consolidated.map(p => p.placement))));
        logger.info('   Consolidation breakdown:', consolidated.map(p => `${p.placement}: ${p.spend.toFixed(2)} spend, ${p.clicks} clicks`));
        
        return consolidated;
      }

      return [];
    } catch (error) {
      logger.error('💥 Error fetching placement performance:', error);
      throw error;
    }
  }

  /**
   * Get demographic performance data for Demographic Performance table
   * Enhanced with reservations, wartość rezerwacji, ROAS, and booking steps
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
        'cpp',
        'actions',
        'action_values',
        'conversions',
        'conversion_values'
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
      
      logger.info('🔗 Meta API Enhanced Demographic Performance URL:', url.replace(this.accessToken, 'HIDDEN_TOKEN'));

      // Add timeout for meta tables (shorter timeout since these are less critical)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Meta API Demographic Performance timeout after 10 seconds')), 10000);
      });
      
      const fetchPromise = fetch(url);
      
      const response = await Promise.race([fetchPromise, timeoutPromise]) as Response;
      const data: MetaAPIResponse = await response.json();

      if (!response.ok || data.error) {
        logger.error('❌ Meta API Demographic Performance Error:', data.error);
        throw new Error(`Meta API Error: ${data.error?.message || 'Unknown error'}`);
      }

      if (data.data) {
        const demographics = data.data.map(insight => {
          // Basic demographic data
          const age = insight.age || 'Nieznane';
          // Translate gender labels to Polish
          let gender = insight.gender || 'Nieznane';
          if (gender.toLowerCase() === 'female') gender = 'Kobiety';
          else if (gender.toLowerCase() === 'male') gender = 'Mężczyźni';
          else if (gender.toLowerCase() === 'unknown') gender = 'Nieznane';
          const spend = parseFloat(insight.spend || '0');
          const impressions = parseInt(insight.impressions || '0');
          const clicks = parseInt(insight.clicks || '0');
          const ctr = parseFloat(insight.ctr || '0');
          const cpc = parseFloat(insight.cpc || '0');
          const cpp = insight.cpp ? parseFloat(insight.cpp) : null;

          // Initialize conversion metrics
          let reservations = 0;
          let booking_step_1 = 0;
          let booking_step_2 = 0;
          let booking_step_3 = 0;
          let click_to_call = 0;
          let email_contacts = 0;
          let reservation_value = 0;

          // Parse conversion actions by demographics
          const actionsArray = (insight.actions && Array.isArray(insight.actions)) ? insight.actions : [];
          actionsArray.forEach((action: any) => {
            const actionType = String(action.action_type || '').toLowerCase();
            const valueNum = Number(action.value || 0);

            // 1. Click to call events
            if (actionType.includes('phone_number_clicks') || 
                actionType.includes('call') || 
                actionType.includes('phone_call')) {
              click_to_call += valueNum;
            }

            // 2. Email contact events  
            if (actionType.includes('email') || 
                actionType.includes('contact') || 
                actionType.includes('lead')) {
              email_contacts += valueNum;
            }

            // 3. Booking Step 1 - Initial interest
            if (actionType.includes('initiate_checkout') ||
                actionType.includes('begin_checkout') ||
                actionType.includes('view_content') ||
                actionType.includes('landing_page_view')) {
              booking_step_1 += valueNum;
            }

            // 4. Reservations (Conservative: Only specific purchase events)
            if (actionType === 'purchase' ||
                actionType.includes('fb_pixel_purchase') ||
                actionType.includes('offsite_conversion.custom.fb_pixel_purchase')) {
              reservations += valueNum;
            }

            // 5. Booking Step 2 - Conservative: Only payment info (most accurate)
            if (actionType.includes('booking_step_2') ||
                actionType.includes('add_payment_info')) {
              booking_step_2 += valueNum;
            }

            // 6. Booking Step 3 - Conservative: Only checkout completion (most accurate)
            if (actionType.includes('booking_step_3') ||
                actionType === 'complete_checkout') {
              booking_step_3 += valueNum;
            }
          });

          // Parse conversion values by demographics (wartość rezerwacji)
          const actionValuesArray = (insight.action_values && Array.isArray(insight.action_values)) ? insight.action_values : [];
          actionValuesArray.forEach((actionValue: any) => {
            const actionType = String(actionValue.action_type || '').toLowerCase();
            const value = Number(actionValue.value || 0);
            if (actionType === 'purchase' || actionType.includes('fb_pixel_purchase')) {
              reservation_value += value;
            }
          });

          // Calculate derived metrics by demographics
          const roas = spend > 0 && reservation_value > 0 ? reservation_value / spend : 0;
          const cost_per_reservation = reservations > 0 ? spend / reservations : 0;
          const conversion_rate = clicks > 0 ? (reservations / clicks) * 100 : 0;

          // Log demographic conversion data for debugging
          logger.info(`📊 Demographic conversion data for ${age} ${gender}:`, {
            spend,
            reservations,
            reservation_value,
            roas: roas.toFixed(2),
            booking_step_1,
            booking_step_2,
            booking_step_3
          });

          return {
            age,
            gender,
            spend,
            impressions,
            clicks,
            ctr,
            cpc,
            cpp,
            // Enhanced conversion metrics by demographics
            reservations,
            reservation_value,
            roas,
            cost_per_reservation,
            conversion_rate,
            booking_step_1,
            booking_step_2, 
            booking_step_3,
            click_to_call,
            email_contacts
          };
        });

        logger.info('✅ Parsed enhanced demographic performance with conversions:', demographics.length, 'demographics');
        return demographics;
      }

      return [];
    } catch (error) {
      logger.error('💥 Error fetching enhanced demographic performance:', error);
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
        'cpp'
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
      
      logger.info('🔗 Meta API Ad Relevance Results URL:', url.replace(this.accessToken, 'HIDDEN_TOKEN'));

      // Add timeout for meta tables (shorter timeout since these are less critical)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Meta API Ad Relevance Results timeout after 10 seconds')), 10000);
      });
      
      const fetchPromise = fetch(url);
      
      const response = await Promise.race([fetchPromise, timeoutPromise]) as Response;
      const data: MetaAPIResponse = await response.json();

      if (!response.ok || data.error) {
        logger.error('❌ Meta API Ad Relevance Results Error:', data.error);
        throw new Error(`Meta API Error: ${data.error?.message || 'Unknown error'}`);
      }

      if (data.data) {
        const ads = data.data.map(insight => ({
          ad_name: insight.ad_name || 'Unknown Ad',
          spend: parseFloat(insight.spend || '0'),
          impressions: parseInt(insight.impressions || '0'),
          clicks: parseInt(insight.clicks || '0'),
          cpp: insight.cpp ? parseFloat(insight.cpp) : null,
        }));

        logger.info('✅ Parsed ad relevance results:', ads.length, 'ads');
        return ads;
      }

      return [];
    } catch (error) {
      logger.error('💥 Error fetching ad relevance results:', error);
      throw error;
    }
  }

  /**
   * Get Facebook Page insights for organic social metrics
   */
  async getPageInsights(
    pageId: string,
    startDate: string,
    endDate: string,
    metrics: string[] = ['page_fan_adds', 'page_fans', 'page_views'],
    period: 'day' | 'week' | 'days_28' = 'day'
  ): Promise<any> {
    try {
      const url = `${this.baseUrl}/${pageId}/insights?` +
        `metric=${metrics.join(',')}&` +
        `since=${startDate}&` +
        `until=${endDate}&` +
        `period=${period}&` +
        `access_token=${this.accessToken}`;

      logger.info('📘 Fetching Facebook Page insights:', { pageId, startDate, endDate, metrics, period });
      
      const response = await fetch(url);
      const data: MetaAPIResponse = await response.json();

      if (data.error) {
        logger.error('Facebook Page Insights API error:', data.error);
        throw new Error(`Page Insights Error: ${data.error.message} (Code: ${data.error.code})`);
      }

      return data.data || [];

    } catch (error) {
      logger.error('💥 Error fetching Facebook Page insights:', error);
      throw error;
    }
  }

  /**
   * Get Instagram Business Account insights
   */
  async getInstagramInsights(
    instagramAccountId: string,
    startDate: string,
    endDate: string,
    metrics: string[] = ['follower_count', 'profile_views', 'reach'],
    period: 'day' | 'week' | 'days_28' = 'day'
  ): Promise<any> {
    try {
      const url = `${this.baseUrl}/${instagramAccountId}/insights?` +
        `metric=${metrics.join(',')}&` +
        `since=${startDate}&` +
        `until=${endDate}&` +
        `period=${period}&` +
        `access_token=${this.accessToken}`;

      logger.info('📷 Fetching Instagram insights:', { instagramAccountId, startDate, endDate, metrics, period });
      
      const response = await fetch(url);
      const data: MetaAPIResponse = await response.json();

      if (data.error) {
        logger.error('Instagram Insights API error:', data.error);
        throw new Error(`Instagram Insights Error: ${data.error.message} (Code: ${data.error.code})`);
      }

      return data.data || [];

    } catch (error) {
      logger.error('💥 Error fetching Instagram insights:', error);
      throw error;
    }
  }

  /**
   * Get Facebook Pages connected to the access token
   */
  async getPages(): Promise<any[]> {
    try {
      const url = `${this.baseUrl}/me/accounts?access_token=${this.accessToken}`;
      const response = await fetch(url);
      const data: MetaAPIResponse = await response.json();

      if (data.error) {
        logger.error('Error getting Facebook Pages:', data.error);
        throw new Error(`Pages Error: ${data.error.message} (Code: ${data.error.code})`);
      }

      return data.data || [];

    } catch (error) {
      logger.error('💥 Error fetching Facebook Pages:', error);
      throw error;
    }
  }

  /**
   * Get Instagram Business Account connected to a Facebook Page
   */
  async getInstagramAccount(pageId: string): Promise<string | null> {
    try {
      const url = `${this.baseUrl}/${pageId}?fields=instagram_business_account&access_token=${this.accessToken}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.error) {
        logger.error('Error getting Instagram account:', data.error);
        return null;
      }

      return data.instagram_business_account?.id || null;

    } catch (error) {
      logger.error('💥 Error fetching Instagram account:', error);
      return null;
    }
  }

  /**
   * Check token permissions for social insights
   */
  async checkSocialPermissions(): Promise<{ valid: boolean; permissions: string[]; missing: string[] }> {
    try {
      const url = `${this.baseUrl}/me/permissions?access_token=${this.accessToken}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.error) {
        return { valid: false, permissions: [], missing: [] };
      }

      const grantedPermissions = data.data
        .filter((perm: any) => perm.status === 'granted')
        .map((perm: any) => perm.permission);

      const requiredPermissions = [
        'pages_read_engagement',
        'pages_show_list',
        'instagram_basic',
        'instagram_manage_insights'
      ];

      const missing = requiredPermissions.filter(perm => !grantedPermissions.includes(perm));

      return {
        valid: missing.length === 0,
        permissions: grantedPermissions,
        missing
      };

    } catch (error) {
      logger.error('💥 Error checking social permissions:', error);
      return { valid: false, permissions: [], missing: [] };
    }
  }
}

export default MetaAPIService; 