import { GoogleAdsApi } from 'google-ads-api';
import logger from './logger';
import { RateLimiter } from './rate-limiter';
import { parseGoogleAdsConversions } from './google-ads-actions-parser';

// Cache duration for API responses
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Token cache
interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

// Quota tracking
interface QuotaTracker {
  dailyCallCount: number;
  quotaResetTime: number;
}

interface GoogleAdsCredentials {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  developmentToken: string;
  customerId: string;
  managerCustomerId?: string;
}

interface GoogleAdsCampaignData {
  // Core metrics (matching Meta exactly)
  campaignId: string;
  campaignName: string;
  status: string;
  date?: string; // For daily segmentation
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  conversions: number;

  search_impression_share?: number; // Google's relevance equivalent
  view_through_conversions?: number; // Landing page view equivalent
  
  // Conversion tracking (exact Meta mapping)
  click_to_call: number;        // Phone click conversions
  email_contacts: number;       // Email contact conversions
  booking_step_1: number;       // Booking initiation
  reservations: number;         // Completed bookings
  reservation_value: number;    // Booking revenue value (only from "PBM - Rezerwacja" actions)
  total_conversion_value?: number; // ✅ Total conversion value (all_conversions_value) - matches Google Ads "Wartość konwersji"
  roas: number;                 // Return on ad spend
  cost_per_reservation: number; // Cost per booking
  booking_step_2: number;       // Booking step 2
  booking_step_3: number;       // Booking step 3
  
  // Google-specific additional metrics
  search_budget_lost_impression_share?: number;
  quality_score?: number;
  expected_ctr?: string;
  ad_relevance?: string;
  landing_page_experience?: string;
}

interface GoogleAdsNetworkPerformance {
  network: string; // Search, Display, YouTube, etc.
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  conversions: number;
  conversion_value: number;
  roas: number;
  // Additional Google-specific metrics
  search_impression_share?: number;
  display_impression_share?: number;
}

interface GoogleAdsDemographicPerformance {
  age_range: string;
  gender: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  conversions: number;
  conversion_value: number;
  roas: number;
}

interface GoogleAdsQualityMetrics {
  campaign_name: string;
  ad_group_name: string;
  keyword_text?: string;
  quality_score: number;
  expected_ctr: string;
  ad_relevance: string;
  landing_page_experience: string;
  impressions: number;
  clicks: number;
  spend: number;
}

interface GoogleAdsDevicePerformance {
  device: string; // Mobile, Desktop, Tablet
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  conversions: number;
  conversion_value: number;
  roas: number;
}

interface GoogleAdsKeywordPerformance {
  keyword: string;
  matchType: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  conversions: number;
  conversionValue: number;
  qualityScore: number;
  roas: number;
}

// RMF R.10: Account-level performance (Customer totals)
interface GoogleAdsAccountPerformance {
  customerId: string;
  customerName: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  conversions: number;
  conversion_value: number;
  roas: number;
  cost_per_conversion: number;
}

// RMF R.30: Ad Group-level performance
interface GoogleAdsAdGroupPerformance {
  adGroupId: string;
  adGroupName: string;
  campaignId: string;
  campaignName: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  conversions: number;
  conversion_value: number;
  roas: number;
}

// RMF R.40: Ad-level performance
interface GoogleAdsAdPerformance {
  adId: string;
  adGroupId: string;
  adGroupName: string;
  campaignId: string;
  campaignName: string;
  adType: string;
  headline: string;
  description: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  conversions: number;
  conversion_value: number;
  roas: number;
}

export class GoogleAdsAPIService {
  private credentials: GoogleAdsCredentials;
  private client: GoogleAdsApi;
  private customer: any;
  private rateLimiter: RateLimiter;
  private tokenCache: TokenCache | null = null;
  private quotaTracker: QuotaTracker;

  constructor(credentials: GoogleAdsCredentials) {
    this.credentials = credentials;
    
    // Initialize rate limiter with safe defaults
    this.rateLimiter = new RateLimiter({
      minDelay: 2000, // 2 seconds between calls
      maxCallsPerMinute: 25, // Stay under 30 to be safe
      backoffMultiplier: 2,
      maxBackoffDelay: 60000 // 1 minute max
    });
    
    // Initialize quota tracker
    this.quotaTracker = {
      dailyCallCount: 0,
      quotaResetTime: Date.now() + 86400000 // 24 hours
    };
    
    // Validate required credentials
    if (!credentials.customerId) {
      throw new Error('Google Ads Customer ID is required');
    }
    if (!credentials.refreshToken) {
      throw new Error('Google Ads refresh token is required');
    }
    if (!credentials.clientId || !credentials.clientSecret) {
      throw new Error('Google Ads OAuth credentials are required');
    }
    if (!credentials.developmentToken) {
      throw new Error('Google Ads developer token is required');
    }
    
    // Initialize Google Ads API client
    this.client = new GoogleAdsApi({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      developer_token: credentials.developmentToken
    });

    // Create customer instance with manager customer ID if provided
    const customerConfig: any = {
      customer_id: credentials.customerId.replace(/-/g, ''),
      refresh_token: credentials.refreshToken
    };

    // Add login customer ID (manager account) if provided
    if (credentials.managerCustomerId) {
      customerConfig.login_customer_id = credentials.managerCustomerId.replace(/-/g, '');
      logger.info('🏢 Using manager customer ID:', credentials.managerCustomerId);
    }

    logger.info('🔧 Creating Google Ads customer instance:', {
      customerId: credentials.customerId,
      hasRefreshToken: !!credentials.refreshToken,
      hasManagerId: !!credentials.managerCustomerId
    });

    this.customer = this.client.Customer(customerConfig);
  }

  /**
   * Execute Google Ads query using official library with rate limiting and error handling
   */
  private async executeQuery(query: string, retries = 3): Promise<any> {
    try {
      // Check and reset quota if needed
      const now = Date.now();
      if (now > this.quotaTracker.quotaResetTime) {
        this.quotaTracker.dailyCallCount = 0;
        this.quotaTracker.quotaResetTime = now + 86400000;
        logger.info('🔄 Daily quota reset');
      }
      
      // Check quota limit (warn at 80%)
      if (this.quotaTracker.dailyCallCount >= 20) {
        logger.warn(`⚠️ High API usage: ${this.quotaTracker.dailyCallCount} calls today`);
      }
      
      // Apply rate limiting - wait before making call
      await this.rateLimiter.waitForNextCall();
      
      logger.info('📊 Executing Google Ads query', {
        dailyCallCount: this.quotaTracker.dailyCallCount + 1,
        retriesLeft: retries
      });
      
      // Add timeout protection to prevent hanging
      const queryPromise = this.customer.query(query);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Google Ads query timeout after 30 seconds')), 30000);
      });
      
      const response = await Promise.race([queryPromise, timeoutPromise]);
      
      // Increment quota counter on success
      this.quotaTracker.dailyCallCount++;
      
      logger.info('✅ Google Ads query executed successfully', {
        dailyCallCount: this.quotaTracker.dailyCallCount
      });
      
      return response;
    } catch (error: any) {
      logger.error('❌ Error executing Google Ads query:', error);
      
      // Handle rate limit errors (429)
      if (error.status === 429 || error.code === 'RATE_EXCEEDED' || 
          error.message?.includes('RATE_EXCEEDED') || 
          error.message?.includes('429')) {
        
        if (retries > 0) {
          const backoffDelay = Math.min(
            1000 * Math.pow(2, 4 - retries), // Exponential: 2s, 4s, 8s
            60000 // Max 60 seconds
          );
          
          logger.warn(`⚠️ Rate limit hit, retrying in ${backoffDelay}ms (${retries} retries left)`);
          
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
          return this.executeQuery(query, retries - 1);
        }
        
        throw new Error('Rate limit exceeded after retries. Please try again later.');
      }
      
      // Handle quota errors (403)
      if (error.status === 403 && error.message?.includes('quota')) {
        logger.error('❌ API quota exhausted for today');
        throw new Error('Google Ads API quota exhausted. Data collection will resume tomorrow.');
      }
      
      // Handle authentication errors (401)
      if (error.status === 401 || error.code === 'AUTHENTICATION_ERROR') {
        logger.error('❌ Authentication failed - token may be expired or invalid');
        // Clear token cache to force refresh on next call
        this.tokenCache = null;
        
        if (retries > 0) {
          logger.info('🔄 Retrying after authentication error...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          return this.executeQuery(query, retries - 1);
        }
        
        throw new Error('Authentication failed. Please check your Google Ads credentials.');
      }
      
      throw error;
    }
  }

  /**
   * Get cached access token or refresh if needed
   */
  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    
    // Return cached token if still valid (with 5 minute buffer)
    if (this.tokenCache && now < this.tokenCache.expiresAt - 300000) {
      logger.info('✅ Using cached access token');
      return this.tokenCache.accessToken;
    }
    
    // Need to refresh token
    logger.info('🔄 Refreshing access token');
    
    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.credentials.clientId,
          client_secret: this.credentials.clientSecret,
          refresh_token: this.credentials.refreshToken,
          grant_type: 'refresh_token'
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        logger.error('❌ Token refresh failed:', response.status, errorText);
        throw new Error(`Token refresh failed: ${response.status}`);
      }
      
      const tokenData = await response.json();
      
      // Cache the token
      this.tokenCache = {
        accessToken: tokenData.access_token,
        expiresAt: now + (tokenData.expires_in * 1000)
      };
      
      logger.info('✅ Access token refreshed and cached', {
        expiresIn: `${Math.floor(tokenData.expires_in / 60)} minutes`
      });
      
      return tokenData.access_token;
    } catch (error) {
      logger.error('❌ Error refreshing access token:', error);
      this.tokenCache = null;
      throw error;
    }
  }
  
  /**
   * Test token refresh manually
   */
  async testTokenRefresh(): Promise<{ success: boolean; error?: string }> {
    try {
      logger.info('🔄 Testing Google Ads token refresh');
      
      // Clear cache to force refresh
      this.tokenCache = null;
      
      // Try to get access token (will refresh)
      await this.getAccessToken();
      
      logger.info('✅ Token refresh successful');
      return { success: true };
    } catch (error) {
      logger.error('❌ Token refresh failed:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get current quota usage stats
   */
  getQuotaStats(): { dailyCallCount: number; quotaResetIn: number } {
    const now = Date.now();
    const resetIn = Math.max(0, this.quotaTracker.quotaResetTime - now);
    
    return {
      dailyCallCount: this.quotaTracker.dailyCallCount,
      quotaResetIn: Math.floor(resetIn / 1000 / 60) // minutes
    };
  }
  
  /**
   * Validate Google Ads credentials
   */
  async validateCredentials(): Promise<{ valid: boolean; error?: string }> {
    try {
      logger.info('🔍 Validating Google Ads credentials');
      
      // First test token refresh
      const tokenTest = await this.testTokenRefresh();
      if (!tokenTest.success) {
        return { valid: false, error: `Token refresh failed: ${tokenTest.error}` };
      }
      
      // Test with a simple customer query (will use rate limiting)
      const query = `
        SELECT 
          customer.id,
          customer.descriptive_name
        FROM customer
        LIMIT 1
      `;

      const response = await this.executeQuery(query);
      
      if (response && response.length >= 0) {
        logger.info('✅ Google Ads credentials validated successfully');
        return { valid: true };
      } else {
        logger.error('❌ Google Ads credentials validation failed: No response');
        return { valid: false, error: 'No response from Google Ads API' };
      }
    } catch (error) {
      logger.error('❌ Error validating Google Ads credentials:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Check for specific error types
      if (errorMessage.includes('invalid_grant')) {
        return { valid: false, error: 'Google Ads credentials invalid: invalid_grant. Please check your Google Ads configuration.' };
      } else if (errorMessage.includes('test accounts')) {
        logger.info('ℹ️ Developer token is test-account only (expected)');
        return { valid: false, error: 'Developer token is test-account only. Apply for Basic access.' };
      }
      
      return { valid: false, error: errorMessage };
    }
  }

  /**
   * Get campaign data with conversion metrics (Meta Ads equivalent)
   */
  async getCampaignData(dateStart: string, dateEnd: string): Promise<GoogleAdsCampaignData[]> {
    try {
      logger.info(`📊 Fetching Google Ads campaign data from ${dateStart} to ${dateEnd}`);

      // 🔧 FIX: Query WITHOUT segments.date to get aggregated data per campaign
      // Using segments.date in WHERE causes date segmentation (one row per campaign per day)
      // Instead, we filter by date separately to get ONE aggregated row per campaign
      const query = `
        SELECT
          campaign.id,
          campaign.name,
          campaign.status,
          campaign.advertising_channel_type,
          
          -- Core performance metrics
          metrics.cost_micros,
          metrics.impressions,
          metrics.clicks,
          metrics.ctr,
          metrics.average_cpc,
          
          -- Interaction metrics
          metrics.conversions_from_interactions_rate,
          metrics.interactions,
          metrics.interaction_rate,
          
          -- Conversion metrics
          metrics.conversions,
          metrics.all_conversions,
          metrics.cost_per_conversion,
          metrics.search_impression_share,
          metrics.view_through_conversions,
          
          -- Conversion values
          metrics.conversions_value,
          metrics.all_conversions_value,
          
          -- Quality metrics
          metrics.search_budget_lost_impression_share
          
        FROM campaign
        WHERE segments.date BETWEEN '${dateStart}' AND '${dateEnd}'
        ORDER BY metrics.cost_micros DESC
      `;

      const response = await this.executeQuery(query);
      
      // 🔧 DEBUG: Log raw response sample to check data types
      if (response && response.length > 0) {
        const sample = response[0];
        logger.info(`🔧 DEBUG RAW: First row metrics types: all_conversions=${typeof sample.metrics?.all_conversions} value="${sample.metrics?.all_conversions}"`);
        logger.info(`🔧 DEBUG RAW: Total rows from API: ${response.length}`);
        
        // Calculate raw total before aggregation
        let rawTotal = 0;
        response.forEach((row: any) => {
          const val = parseFloat(row.metrics?.all_conversions || '0') || 0;
          rawTotal += val;
        });
        logger.info(`🔧 DEBUG RAW: Raw sum of all_conversions (all ${response.length} rows): ${rawTotal.toFixed(2)}`);
      }
      
      // 🔧 FIX: Aggregate rows by campaign.id since date segmentation returns multiple rows
      // Group by campaign and sum metrics to get one result per campaign
      const campaignMap = new Map<string, any>();
      
      response?.forEach((row: any) => {
        const campaignId = row.campaign.id;
        const existing = campaignMap.get(campaignId);
        
        if (!existing) {
          // 🔧 CRITICAL FIX: Parse string values to numbers on first encounter
          // Google Ads API returns some metrics as strings!
          const metrics = row.metrics;
          metrics.cost_micros = parseFloat(metrics.cost_micros || '0') || 0;
          metrics.impressions = parseFloat(metrics.impressions || '0') || 0;
          metrics.clicks = parseFloat(metrics.clicks || '0') || 0;
          metrics.interactions = parseFloat(metrics.interactions || '0') || 0;
          metrics.conversions = parseFloat(metrics.conversions || '0') || 0;
          metrics.all_conversions = parseFloat(metrics.all_conversions || '0') || 0;
          metrics.conversions_value = parseFloat(metrics.conversions_value || '0') || 0;
          metrics.all_conversions_value = parseFloat(metrics.all_conversions_value || '0') || 0;
          metrics.view_through_conversions = parseFloat(metrics.view_through_conversions || '0') || 0;
          campaignMap.set(campaignId, row);
        } else {
          // Aggregate metrics for same campaign across different days
          const metrics = existing.metrics;
          const newMetrics = row.metrics;
          
          // 🔧 CRITICAL FIX: Parse string values to numbers before adding
          // Google Ads API returns metrics as STRINGS - must use parseFloat!
          metrics.cost_micros = metrics.cost_micros + (parseFloat(newMetrics.cost_micros || '0') || 0);
          metrics.impressions = metrics.impressions + (parseFloat(newMetrics.impressions || '0') || 0);
          metrics.clicks = metrics.clicks + (parseFloat(newMetrics.clicks || '0') || 0);
          metrics.interactions = metrics.interactions + (parseFloat(newMetrics.interactions || '0') || 0);
          metrics.conversions = metrics.conversions + (parseFloat(newMetrics.conversions || '0') || 0);
          metrics.all_conversions = metrics.all_conversions + (parseFloat(newMetrics.all_conversions || '0') || 0);
          metrics.conversions_value = metrics.conversions_value + (parseFloat(newMetrics.conversions_value || '0') || 0);
          metrics.all_conversions_value = metrics.all_conversions_value + (parseFloat(newMetrics.all_conversions_value || '0') || 0);
          metrics.view_through_conversions = metrics.view_through_conversions + (parseFloat(newMetrics.view_through_conversions || '0') || 0);
          
          // For averages like ctr, cpc - recalculate after aggregation
          // These will be recalculated below from the summed values
        }
      });
      
      const aggregatedResponse = Array.from(campaignMap.values());
      logger.info(`📊 Aggregated ${response?.length || 0} rows into ${aggregatedResponse.length} campaigns`);
      
      // 🔧 DEBUG: Log total all_conversions after aggregation
      const debugTotalAllConversions = aggregatedResponse.reduce((sum, row) => {
        return sum + (row.metrics.all_conversions || 0);
      }, 0);
      logger.info(`🔧 DEBUG: Total all_conversions after aggregation: ${debugTotalAllConversions.toFixed(2)}`);
      logger.info(`🔧 DEBUG: Expected ~998 based on Google Console data`);
      
      // Get conversion breakdown for proper mapping
      const conversionBreakdown = await this.getConversionBreakdown(dateStart, dateEnd);
      
      const campaigns: GoogleAdsCampaignData[] = aggregatedResponse?.map((row: any, index: number) => {
        const campaign = row.campaign;
        const metrics = row.metrics;
        
        const spend = (metrics.cost_micros || metrics.cost_micros || metrics.costMicros || 0) / 1000000;
        const impressions = metrics.impressions || 0;
        const clicks = metrics.clicks || 0;
        
        // ✅ PRODUCTION FIX: Use ALL conversions from Google Ads API
        // metrics.conversions = cross-platform comparable (often 0 or low)
        // metrics.all_conversions = ALL conversion types including view-through, cross-device
        const reportedConversions = metrics.conversions || 0;
        const allConversions = metrics.all_conversions || metrics.allConversions || 0;
        
        // 🔧 FIX: Prefer all_conversions over cross-platform conversions
        // Cross-platform conversions are stricter and often show 0 when conversions exist
        let conversions = allConversions > 0 ? allConversions : reportedConversions;
        
        // Log attribution info for debugging
        const interactions = metrics.interactions || clicks;
        if (allConversions !== reportedConversions) {
          logger.info(`📊 Campaign ${campaign.name}: all_conversions=${allConversions.toFixed(1)}, cross-platform=${reportedConversions.toFixed(1)} (using all_conversions)`);
        }
        
        // 🔧 FIX: Use conversions_value to match Google Ads "Wartość konwersji"
        // Google Ads has two metrics:
        // - conversions_value = "Wartość konwersji" (cross-platform comparable) ← USE THIS
        // - all_conversions_value = "Wartość wszystkich konw." (includes view-through, cross-device)
        // Values are already in PLN (not micros)
        const crossPlatformValue = metrics.conversions_value || metrics.conversionsValue || 0;
        const allConversionsValue = metrics.all_conversions_value || metrics.allConversionsValue || 0;
        // ✅ FIXED: Use conversions_value to match Google Ads "Wartość konwersji" (107,231 PLN)
        // Previously used all_conversions_value which was higher (110,302 PLN)
        const conversionValue = crossPlatformValue > 0 ? crossPlatformValue : allConversionsValue;
        
        // 🔍 DEBUG: Log conversion value details for first campaign only
        if (index === 0) {
          logger.info(`🔍 DEBUG First Campaign Conversion Values:
            - metrics.conversions_value (Wartość konwersji): ${metrics.conversions_value}
            - metrics.all_conversions_value (Wartość wszystkich konw.): ${metrics.all_conversions_value}
            - Using: ${conversionValue.toFixed(2)} PLN (conversions_value)`);
        }
        
        // Get conversion breakdown for this campaign - REAL DATA ONLY
        let campaignConversions = conversionBreakdown[campaign.id] || {
          click_to_call: 0,
          email_contacts: 0,
          booking_step_1: 0,
          booking_step_2: 0,
          booking_step_3: 0,
          reservations: 0,
          reservation_value: 0
        };
        
        // ✅ PRODUCTION FIX: Use ONLY real conversion data from Google Ads API
        // NO ESTIMATES - if no conversion breakdown data exists, keep zeros
        const hasConversionData = Object.values(campaignConversions).some((val: unknown) => Number(val) > 0);
        
        if (!hasConversionData && allConversions > 0) {
          // No breakdown data available - keep zeros for specific metrics
          // ⚠️ CRITICAL: Do NOT use all_conversions as reservations!
          // all_conversions includes ALL types (micro-conversions, booking steps, etc.)
          // reservations should ONLY count actual "Rezerwacja"/"Purchase" conversions
          logger.info(`⚠️ Campaign ${campaign.name}: No conversion breakdown available, keeping zeros`);
          logger.info(`   Raw all_conversions: ${allConversions.toFixed(0)} (NOT used as reservations)`);
          
          // Keep all zeros - we don't know what types these conversions are
          // The all_conversions total is available in the campaign.conversions field
          campaignConversions = {
            click_to_call: 0, // Unknown - needs proper conversion tracking
            email_contacts: 0, // Unknown - needs proper conversion tracking
            booking_step_1: 0, // Unknown - needs proper conversion tracking
            booking_step_2: 0, // Unknown - needs proper conversion tracking
            booking_step_3: 0, // Unknown - needs proper conversion tracking
            reservations: 0, // ⚠️ FIXED: Do NOT use all_conversions here!
            reservation_value: 0 // Only set when we have actual reservation data
          };
          
          logger.info(`⚠️ Campaign ${campaign.name}: No specific conversion actions found, all metrics set to 0`);
        }
        
        logger.info(`📊 Using conversion data for campaign ${campaign.name}: ${JSON.stringify(campaignConversions)}`);
        
        const finalConversions = campaignConversions;
        
        return {
          // Core metrics (matching Meta exactly)
          campaignId: campaign.id,
          campaignName: campaign.name,
          status: campaign.status,
          spend,
          impressions,
          clicks,
          ctr: metrics.ctr || 0,
          cpc: (metrics.average_cpc || metrics.average_cpc || metrics.averageCpc || 0) / 1000000,
          conversions: conversions,  // ✅ Uses all_conversions (includes view-through, cross-device)

          search_impression_share: metrics.searchImpressionShare || 0,
          view_through_conversions: metrics.viewThroughConversions || 0,
          
          // Conversion tracking (mapped from Google conversion actions)
          click_to_call: finalConversions.click_to_call || 0,
          email_contacts: finalConversions.email_contacts || 0,
          booking_step_1: finalConversions.booking_step_1 || 0,
          reservations: finalConversions.reservations || 0,
          reservation_value: finalConversions.reservation_value || 0,
          // ✅ Two separate conversion value metrics:
          // - conversion_value = "Wartość konwersji" in Google Ads (cross-platform comparable)
          // - total_conversion_value = "Łączna wartość konwersji" (all_conversions_value, includes view-through, cross-device)
          conversion_value: conversionValue, // conversions_value - "Wartość konwersji" (107,231 PLN)
          total_conversion_value: allConversionsValue, // all_conversions_value - "Łączna wartość konwersji" (110,302 PLN)
          // ✅ ROAS calculated using "Łączna wartość konwersji" (total_conversion_value)
          roas: spend > 0 ? allConversionsValue / spend : 0,
          cost_per_reservation: (finalConversions.reservations || 0) > 0 ? spend / (finalConversions.reservations || 0) : 0,
          booking_step_2: finalConversions.booking_step_2 || 0,
          booking_step_3: finalConversions.booking_step_3 || 0,
          
          // Google-specific metrics
          search_budget_lost_impression_share: metrics.search_budget_lost_impression_share || metrics.searchBudgetLostImpressionShare || 0,
        };
      }) || [];

      logger.info(`✅ Fetched ${campaigns.length} Google Ads campaigns with conversion breakdown`);
      
      // Add debug info about conversion mapping
      const debugInfo = conversionBreakdown._debug || {};
      logger.info(`🔍 Conversion mapping debug: ${debugInfo.totalActions || 0} total actions, ${debugInfo.unmappedCount || 0} unmapped`);
      
      // 🔍 DEBUG: Log conversion value details for first 3 campaigns
      const debugLimit = Math.min(3, campaigns.length);
      for (let i = 0; i < debugLimit; i++) {
        const c = campaigns[i];
        logger.info(`🔍 DEBUG Campaign #${i+1} "${c.campaignName}":
          - total_conversion_value: ${c.total_conversion_value?.toFixed(2) || 'undefined'} PLN
          - reservation_value: ${c.reservation_value?.toFixed(2) || 'undefined'} PLN
          - spend: ${c.spend?.toFixed(2) || 'undefined'} PLN
          - roas: ${c.roas?.toFixed(4) || 'undefined'}x`);
      }
      
      return campaigns as any;
      
    } catch (error) {
      logger.error('❌ Error fetching Google Ads campaign data:', error);
      throw error;
    }
  }

  /**
   * Get conversion breakdown by campaign (maps Google conversion actions to Meta format)
   */
  async getConversionBreakdown(dateStart: string, dateEnd: string): Promise<{ [campaignId: string]: any }> {
    try {
      logger.info('📊 Fetching Google Ads conversion breakdown');
      
      // First, get all conversion actions available in the account
      const conversionActionsQuery = `
        SELECT
          conversion_action.id,
          conversion_action.name,
          conversion_action.category,
          conversion_action.type,
          conversion_action.status
        FROM conversion_action
        WHERE conversion_action.status = 'ENABLED'
        ORDER BY conversion_action.name
      `;
      
      logger.info('🔍 Fetching all conversion actions from account...');
      let conversionActions;
      
      try {
        conversionActions = await this.executeQuery(conversionActionsQuery);
      } catch (error) {
        logger.error('❌ Error fetching conversion actions:', error);
        logger.warn('⚠️  Continuing with empty conversion actions list');
        conversionActions = [];
      }
      
      if (conversionActions && conversionActions.length > 0) {
        logger.info(`📋 Found ${conversionActions.length} conversion actions in account:`);
        conversionActions.forEach((action: any) => {
          logger.info(`   - "${action.conversion_action.name}" (Category: ${action.conversion_action.category}, Type: ${action.conversion_action.type})`);
        });
      } else {
        logger.warn('⚠️  No conversion actions found in account');
      }
      
      // Try a simpler approach - check if conversion actions exist at all
      // If no conversion actions are set up, we'll need to use a different strategy
      if (!conversionActions || conversionActions.length === 0) {
        logger.warn('⚠️  No conversion actions found in Google Ads account - conversion tracking may not be set up');
        logger.info('💡 Will use campaign-level conversion data without action breakdown');
        
        // Return empty breakdown - this will cause campaigns to use zero conversion data
        return {
          _debug: {
            allActionNames: [],
            unmappedActions: [],
            totalActions: 0,
            unmappedCount: 0,
            message: 'No conversion actions configured in Google Ads account'
          }
        };
      }
      
      // Now get conversion data by campaign - include segments for date filtering
      const query = `
        SELECT
          campaign.id,
          campaign.name,
          segments.conversion_action_name,
          segments.date,
          metrics.conversions,
          metrics.conversions_value
        FROM campaign
        WHERE segments.date BETWEEN '${dateStart}' AND '${dateEnd}'
          AND metrics.conversions > 0
        ORDER BY campaign.id, segments.conversion_action_name
      `;
      
      let response;
      
      try {
        response = await this.executeQuery(query);
      } catch (error) {
        logger.error('❌ Error executing conversion query:', error);
        logger.warn('⚠️  Continuing with empty conversion data - will use fallback tracking');
        response = [];
      }
      
      const breakdown: { [campaignId: string]: any } = {};
      
      logger.info(`📊 Conversion query returned ${response?.length || 0} rows`);
      if (response && response.length > 0) {
        logger.info(`🔍 Sample conversion row:`, JSON.stringify(response[0], null, 2));
      } else {
        logger.warn('⚠️  No conversion data returned from query - campaigns will use fallback conversion tracking');
      }
      
      // Conversion action mapping (Google → Meta format)
      // Comprehensive mapping to catch all possible conversion action names
      const conversionMapping = {
        // Phone conversions - expanded patterns
        'click_to_call': [
          'phone_call', 'call_conversion', 'phone_click', 'telefon', 'click_to_call', 
          'telefon click', 'phone_click', 'call', 'phone', 'telephone', 'click_to_call',
          'call_extension', 'call_tracking', 'phone_number_click'
        ],
        // Email conversions - expanded patterns
        'email_contacts': [
          'email', 'contact_form', 'email_click', 'mailto', 'form_submit', 
          'form submit', 'form_submit_success', 'contact', 'email_contact',
          'lead_form', 'contact_us', 'inquiry', 'request_info'
        ],
        // Booking funnel - comprehensive patterns
        'booking_step_1': [
          'engaged user', 'kliknięcia linków na podstronie biznesowej', 
          '[mice] - wejście na stronę biznesową', 'step 1 w be', 'search', 
          'booking_step_1', 'page_view', 'view_item', 'begin_checkout',
          'initiate_checkout', 'start_checkout', 'checkout_started',
          'website_visit', 'landing_page_view', 'page_visit'
        ],
        'booking_step_2': [
          'pobranie oferty mice', 'form_submit', 
          'www.belmonte.com.pl (web) form_submit_success', 'step 2 w be', 
          'view_content', 'booking_step_2', 'add_to_cart', 'add_payment_info',
          'payment_info', 'checkout_progress', 'form_completion',
          'download', 'file_download', 'offer_download'
        ],
        'booking_step_3': [
          'micro-marco conwersje', 'www.belmonte.com.pl (web) micro_conversion', 
          'rezerwacja', 'step 3 w be', 'initiate_checkout', 'booking_step_3',
          'complete_checkout', 'checkout_complete', 'purchase_initiated',
          'micro_conversion', 'micro_conversions', 'conversion'
        ],
        // Final conversions - comprehensive patterns
        'reservations': [
          'purchase', 'booking', 'reservation', 'rezerwacja', 'purchase_conversion',
          'sale', 'transaction', 'order', 'completed_purchase', 'purchase_complete',
          'booking_complete', 'reservation_complete', 'conversion', 'conversions'
        ],
      };
      
      // 🔧 FIX: Aggregate conversions by campaign + conversion_action_name
      // The query with segments.date returns multiple rows per campaign per action per day
      // We need to aggregate to get one total per campaign per conversion action
      const campaignActionTotals: { [key: string]: { campaignId: string; campaignName: string; conversionName: string; conversions: number; conversionValue: number } } = {};
      
      response?.forEach((row: any) => {
        // Add null safety checks for segments
        if (!row.segments) {
          logger.warn(`⚠️  Row missing segments data for campaign ${row.campaign?.name || 'unknown'}`);
          return;
        }
        
        const campaignId = row.campaign.id;
        const campaignName = row.campaign.name;
        const conversionName = row.segments?.conversion_action_name || '';
        // 🔧 CRITICAL FIX: Parse string values to numbers - Google Ads API returns strings!
        const conversions = parseFloat(row.metrics.conversions || '0') || 0;
        const conversionValue = (parseFloat(row.metrics.conversions_value || '0') || 0) / 1000000;
        
        // Create unique key for campaign + conversion action
        const key = `${campaignId}:${conversionName}`;
        
        if (!campaignActionTotals[key]) {
          campaignActionTotals[key] = {
            campaignId,
            campaignName,
            conversionName,
            conversions: 0,
            conversionValue: 0
          };
        }
        
        // Aggregate values
        campaignActionTotals[key].conversions += conversions;
        campaignActionTotals[key].conversionValue += conversionValue;
      });
      
      // Now group aggregated data by campaign for parser
      const campaignConversionData: { [campaignId: string]: any[] } = {};
      
      Object.values(campaignActionTotals).forEach((data) => {
        const { campaignId, campaignName, conversionName, conversions, conversionValue } = data;
        
        // DEBUG: Log aggregated conversion action names
        if (conversions > 0) {
          logger.info(`🔍 Campaign ${campaignName} (${campaignId}) - Action: "${conversionName}" (${conversions.toFixed(1)} conversions, ${conversionValue.toFixed(2)} value)`);
        }
        
        // Group conversions by campaign
        if (!campaignConversionData[campaignId]) {
          campaignConversionData[campaignId] = [];
        }
        
        campaignConversionData[campaignId].push({
          conversion_name: conversionName,
          name: conversionName,
          conversions: conversions, // Now aggregated across all days
          value: conversions,
          conversion_value: conversionValue // Now aggregated across all days
        });
      });
      
      // ✅ NEW: Use the parser for each campaign
      Object.entries(campaignConversionData).forEach(([campaignId, conversions]) => {
        const campaignName = conversions[0]?.name || campaignId;
        
        // Parse conversions using our new parser
        const parsed = parseGoogleAdsConversions(conversions, campaignName);
        
        breakdown[campaignId] = parsed;
        
        logger.info(`✅ Parsed conversions for campaign ${campaignName}:`, {
          booking_step_1: parsed.booking_step_1,
          booking_step_2: parsed.booking_step_2,
          booking_step_3: parsed.booking_step_3,
          reservations: parsed.reservations,
          reservation_value: parsed.reservation_value
        });
      });
      
      logger.info(`✅ Processed conversion breakdown for ${Object.keys(breakdown).length} campaigns`);
      
      // DEBUG: Log all conversion action names found and return them for debugging
      const allActionNames = new Set();
      const unmappedActions = new Set();
      
      response?.forEach((row: any) => {
        if (row.segments?.conversion_action_name) {
          allActionNames.add(row.segments.conversion_action_name);
          
          // Check if this action was mapped
          const actionName = (row.segments?.conversion_action_name || '').toLowerCase();
          let mapped = false;
          Object.entries(conversionMapping).forEach(([metaType, googleTypes]) => {
            if (googleTypes.some(googleType => actionName.includes(googleType))) {
              mapped = true;
            }
          });
          
          if (!mapped) {
            unmappedActions.add(row.segments.conversion_action_name);
          }
        }
      });
      
      if (allActionNames.size > 0) {
        logger.info(`🔍 DEBUG: Found ${allActionNames.size} unique conversion action names:`);
        Array.from(allActionNames).forEach(name => logger.info(`   - "${name}"`));
      }
      
      if (unmappedActions.size > 0) {
        logger.warn(`⚠️  UNMAPPED ACTIONS (${unmappedActions.size}):`);
        Array.from(unmappedActions).forEach(name => logger.warn(`   - "${name}"`));
      }
      
      // Add debug info to breakdown for API response
      breakdown._debug = {
        allActionNames: Array.from(allActionNames),
        unmappedActions: Array.from(unmappedActions),
        totalActions: allActionNames.size,
        unmappedCount: unmappedActions.size
      };
      
      return breakdown;
      
    } catch (error) {
      logger.error('❌ Error fetching conversion breakdown:', error);
      
      // Graceful degradation: return empty breakdown with debug info
      // This allows the system to continue functioning with fallback conversion tracking
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      logger.warn('⚠️  Returning empty conversion breakdown due to error - campaigns will use fallback conversion tracking');
      logger.info('💡 Error details:', { message: errorMessage, stack: errorStack?.substring(0, 200) });
      
      return {
        _debug: {
          error: true,
          errorMessage: errorMessage,
          allActionNames: [],
          unmappedActions: [],
          totalActions: 0,
          unmappedCount: 0,
          message: 'Error fetching conversion breakdown - using fallback tracking'
        }
      };
    }
  }

  /**
   * Get network performance data (equivalent to Meta's placement performance)
   */
  async getNetworkPerformance(dateStart: string, dateEnd: string): Promise<GoogleAdsNetworkPerformance[]> {
    try {
      const query = `
        SELECT
          segments.ad_network_type,
          metrics.cost_micros,
          metrics.impressions,
          metrics.clicks,
          metrics.ctr,
          metrics.average_cpc,
          metrics.conversions,
          metrics.conversions_value
        FROM campaign
        WHERE segments.date BETWEEN '${dateStart}' AND '${dateEnd}'
        AND metrics.impressions > 0
      `;

      const response = await this.executeQuery(query);

      // Group by network type and aggregate metrics
      const networkStats: { [network: string]: any } = {};
      
      response?.forEach((row: any) => {
        const networkType = row.segments?.ad_network_type || 'UNKNOWN';
        const networkName = this.getNetworkDisplayName(networkType);
        const metrics = row.metrics;
        
        if (!networkStats[networkName]) {
          networkStats[networkName] = {
            spend: 0,
            impressions: 0,
            clicks: 0,
            conversions: 0,
            conversion_value: 0
          };
        }
        
        networkStats[networkName].spend += (metrics.cost_micros || metrics.costMicros || 0) / 1000000;
        networkStats[networkName].impressions += metrics.impressions || 0;
        networkStats[networkName].clicks += metrics.clicks || 0;
        networkStats[networkName].conversions += metrics.conversions || 0;
        networkStats[networkName].conversion_value += (metrics.conversions_value || metrics.conversionsValue || 0) / 1000000;
      });

      const networks: GoogleAdsNetworkPerformance[] = Object.entries(networkStats).map(([network, stats]) => ({
        network,
        spend: stats.spend,
        impressions: stats.impressions,
        clicks: stats.clicks,
        ctr: stats.impressions > 0 ? (stats.clicks / stats.impressions) * 100 : 0,
        cpc: stats.clicks > 0 ? stats.spend / stats.clicks : 0,
        conversions: stats.conversions,
        conversion_value: stats.conversion_value,
        roas: stats.spend > 0 ? stats.conversion_value / stats.spend : 0,
        search_impression_share: 0, // Not available in aggregated data
        display_impression_share: 0, // Not available in aggregated data
      }));

      logger.info(`✅ Fetched ${networks.length} real network performance segments from Google Ads`);
      return networks;
    } catch (error) {
      logger.error('❌ Error fetching network performance:', error);
      logger.info('ℹ️ No network data available - returning empty array');
      return [];
    }
  }



  /**
   * Get device performance data
   */
  async getDevicePerformance(dateStart: string, dateEnd: string): Promise<GoogleAdsDevicePerformance[]> {
    try {
      const query = `
        SELECT
          segments.device,
          metrics.cost_micros,
          metrics.impressions,
          metrics.clicks,
          metrics.ctr,
          metrics.average_cpc,
          metrics.conversions,
          metrics.conversions_value
        FROM campaign
        WHERE segments.date BETWEEN '${dateStart}' AND '${dateEnd}'
        AND metrics.impressions > 0
        ORDER BY metrics.cost_micros DESC
      `;

      const response = await this.executeQuery(query);

      // Group by device and aggregate metrics
      const deviceStats: { [device: string]: any } = {};
      
      response?.forEach((row: any) => {
        const rawDevice = row.segments?.device || 'UNKNOWN';
        const deviceName = this.getDeviceDisplayName(rawDevice);
        const metrics = row.metrics;
        
        if (!deviceStats[deviceName]) {
          deviceStats[deviceName] = {
            spend: 0,
            impressions: 0,
            clicks: 0,
            conversions: 0,
            conversion_value: 0
          };
        }
        
        deviceStats[deviceName].spend += (metrics.cost_micros || metrics.costMicros || 0) / 1000000;
        deviceStats[deviceName].impressions += metrics.impressions || 0;
        deviceStats[deviceName].clicks += metrics.clicks || 0;
        deviceStats[deviceName].conversions += metrics.conversions || 0;
        deviceStats[deviceName].conversion_value += (metrics.conversions_value || metrics.conversionsValue || 0) / 1000000;
      });

      const devices: GoogleAdsDevicePerformance[] = Object.entries(deviceStats).map(([device, stats]) => ({
        device,
        spend: stats.spend,
        impressions: stats.impressions,
        clicks: stats.clicks,
        ctr: stats.impressions > 0 ? (stats.clicks / stats.impressions) * 100 : 0,
        cpc: stats.clicks > 0 ? stats.spend / stats.clicks : 0,
        conversions: stats.conversions,
        conversion_value: stats.conversion_value,
        roas: stats.spend > 0 ? stats.conversion_value / stats.spend : 0,
      }));

      logger.info(`✅ Fetched ${devices.length} real device performance segments from Google Ads`);
      return devices;
    } catch (error) {
      logger.error('❌ Error fetching device performance:', error);
      logger.info('ℹ️ No device data available - returning empty array');
      return [];
    }
  }

  /**
   * Get campaign data with date segments for daily analysis
   */
  async getCampaignDataWithDateSegments(dateStart: string, dateEnd: string): Promise<GoogleAdsCampaignData[]> {
    try {
      logger.info(`🔄 Fetching Google Ads campaign data with date segments from ${dateStart} to ${dateEnd}`);

      const customer = this.client.Customer({
        customer_id: this.credentials.customerId,
        refresh_token: this.credentials.refreshToken,
        ...(this.credentials.managerCustomerId && { manager_customer_id: this.credentials.managerCustomerId }),
      });

      // Query with date segmentation for daily breakdowns
      // 🔧 FIX: Include all_conversions for accurate conversion data
      const query = `
        SELECT
          campaign.id,
          campaign.name,
          campaign.status,
          segments.date,
          metrics.cost_micros,
          metrics.impressions,
          metrics.clicks,
          metrics.ctr,
          metrics.average_cpc,
          metrics.conversions,
          metrics.all_conversions,
          metrics.conversions_value,
          metrics.all_conversions_value,
          metrics.view_through_conversions
        FROM campaign
        WHERE segments.date BETWEEN '${dateStart}' AND '${dateEnd}'
        AND campaign.status != 'REMOVED'
        ORDER BY segments.date DESC, campaign.name ASC
      `;

      logger.info('🔍 Google Ads Query:', query);

      const response = await customer.query(query);
      
      logger.info(`✅ Google Ads API returned ${response.length} campaign-day records`);

      // Transform response to our format
      const campaigns: GoogleAdsCampaignData[] = response.map((row: any) => {
        const costMicros = parseInt(row.metrics?.cost_micros || '0');
        const spend = costMicros / 1_000_000; // Convert from micros to currency units
        const impressions = parseInt(row.metrics?.impressions || '0');
        const clicks = parseInt(row.metrics?.clicks || '0');
        
        // 🔧 FIX: Use all_conversions for accurate conversion data
        const crossPlatformConversions = parseFloat(row.metrics?.conversions || '0');
        const allConversions = parseFloat(row.metrics?.all_conversions || '0');
        const conversions = allConversions > 0 ? allConversions : crossPlatformConversions;
        
        const crossPlatformValue = parseFloat(row.metrics?.conversions_value || '0');
        const allConversionsValue = parseFloat(row.metrics?.all_conversions_value || '0');
        const conversionsValue = allConversionsValue > 0 ? allConversionsValue : crossPlatformValue;
        
        const ctr = parseFloat(row.metrics?.ctr || '0') * 100; // Convert to percentage
        const averageCpc = parseFloat(row.metrics?.average_cpc || '0') / 1_000_000; // Convert from micros

        return {
          campaignId: row.campaign?.id || '',
          campaignName: row.campaign?.name || 'Unknown Campaign',
          status: row.campaign?.status || 'UNKNOWN',
          date: row.segments?.date || dateStart, // Include date for daily aggregation
          spend,
          impressions,
          clicks,
          ctr,
          cpc: averageCpc,
          conversions, // Now uses all_conversions
          
          // Conversion tracking - specific actions require breakdown data
          // ⚠️ CRITICAL: Do NOT use all_conversions as reservations!
          click_to_call: 0, // Requires "Click to Call" conversion action in Google Ads
          email_contacts: 0, // Requires "Email/Contact" conversion action in Google Ads
          booking_step_1: 0, // Requires "Booking Step 1" conversion action in Google Ads
          booking_step_2: 0, // Requires "Booking Step 2" conversion action in Google Ads
          booking_step_3: 0, // Requires "Booking Step 3" conversion action in Google Ads
          reservations: 0, // ⚠️ FIXED: Only set from specific "Rezerwacja" conversion actions
          reservation_value: 0, // ⚠️ FIXED: Only set from specific reservation conversions
          roas: 0, // Will be calculated from actual reservations
          cost_per_reservation: 0, // Will be calculated from actual reservations
          
          // Google-specific metrics
          view_through_conversions: parseFloat(row.metrics?.view_through_conversions || '0'),
        };
      });

      logger.info(`📊 Processed ${campaigns.length} campaign-day records with daily segments`);
      
      return campaigns;

    } catch (error) {
      logger.error('❌ Error fetching Google Ads campaign data with date segments:', error);
      throw error;
    }
  }

  /**
   * Get keyword performance data
   */
  async getKeywordPerformance(dateStart: string, dateEnd: string): Promise<GoogleAdsKeywordPerformance[]> {
    try {
      // Try to fetch actual keyword data from keyword_view
      const keywordQuery = `
        SELECT
          ad_group_criterion.keyword.text,
          ad_group_criterion.keyword.match_type,
          campaign.name,
          ad_group.name,
          metrics.cost_micros,
          metrics.impressions,
          metrics.clicks,
          metrics.ctr,
          metrics.average_cpc,
          metrics.conversions,
          metrics.conversions_value
        FROM keyword_view
        WHERE segments.date BETWEEN '${dateStart}' AND '${dateEnd}'
        AND metrics.impressions > 0
        ORDER BY metrics.cost_micros DESC
        LIMIT 50
      `;

      let response;
      try {
        response = await this.executeQuery(keywordQuery);
      } catch (keywordError) {
        logger.warn('⚠️ Keyword view not available, falling back to search terms');
        
        // Fallback to search terms query
        const searchTermsQuery = `
          SELECT
            segments.search_term_match_type,
            segments.search_term,
            campaign.name,
            metrics.cost_micros,
            metrics.impressions,
            metrics.clicks,
            metrics.ctr,
            metrics.average_cpc,
            metrics.conversions,
            metrics.conversions_value
          FROM search_term_view
          WHERE segments.date BETWEEN '${dateStart}' AND '${dateEnd}'
          AND metrics.impressions > 0
          ORDER BY metrics.cost_micros DESC
          LIMIT 50
        `;
        
        try {
          response = await this.executeQuery(searchTermsQuery);
          
          const keywords: GoogleAdsKeywordPerformance[] = response?.map((row: any) => {
            const segments = row.segments || {};
            const campaign = row.campaign || {};
            const metrics = row.metrics || {};
            
            const spend = (metrics.cost_micros || metrics.costMicros || 0) / 1000000;
            const conversions = metrics.conversions || 0;
            const conversionValue = (metrics.conversions_value || metrics.conversionsValue || 0) / 1000000;
            
            return {
              keyword: segments.search_term || 'Unknown Search Term',
              matchType: this.getMatchTypeDisplayName(segments.search_term_match_type || 'UNKNOWN'),
              spend,
              impressions: metrics.impressions || 0,
              clicks: metrics.clicks || 0,
              ctr: metrics.ctr || 0,
              cpc: (metrics.average_cpc || metrics.averageCpc || 0) / 1000000,
              conversions,
              conversionValue,
              qualityScore: 0, // Not available in search terms view
              roas: spend > 0 ? conversionValue / spend : 0,
            };
          }) || [];

          logger.info(`✅ Fetched ${keywords.length} search terms from Google Ads`);
          return keywords;
          
        } catch (searchTermsError) {
          logger.warn('⚠️ Search terms view also not available, using campaign data');
          throw searchTermsError;
        }
      }

      // Process keyword view response
      const keywords: GoogleAdsKeywordPerformance[] = response?.map((row: any) => {
        const keyword = row.ad_group_criterion?.keyword || {};
        const campaign = row.campaign || {};
        const adGroup = row.ad_group || {};
        const metrics = row.metrics || {};
        
        const spend = (metrics.cost_micros || metrics.costMicros || 0) / 1000000;
        const conversions = metrics.conversions || 0;
        const conversionValue = (metrics.conversions_value || metrics.conversionsValue || 0) / 1000000;
        
        return {
          keyword: keyword.text || 'Unknown Keyword',
          matchType: this.getMatchTypeDisplayName(keyword.match_type || 'UNKNOWN'),
          spend,
          impressions: metrics.impressions || 0,
          clicks: metrics.clicks || 0,
          ctr: metrics.ctr || 0,
          cpc: (metrics.average_cpc || metrics.averageCpc || 0) / 1000000,
          conversions,
          conversionValue,
          qualityScore: 0, // Not available in current API version
          roas: spend > 0 ? conversionValue / spend : 0,
        };
      }) || [];

      logger.info(`✅ Fetched ${keywords.length} keywords from Google Ads`);
      return keywords;
      
    } catch (error) {
      logger.error('❌ Error fetching keyword performance, falling back to campaign data:', error);
      
      // Final fallback - use campaign names as "keywords"
      const campaignQuery = `
        SELECT
          campaign.name,
          metrics.cost_micros,
          metrics.impressions,
          metrics.clicks,
          metrics.ctr,
          metrics.average_cpc,
          metrics.conversions,
          metrics.conversions_value
        FROM campaign
        WHERE segments.date BETWEEN '${dateStart}' AND '${dateEnd}'
        AND metrics.impressions > 0
        ORDER BY metrics.cost_micros DESC
        LIMIT 20
      `;

      try {
        const campaignResponse = await this.executeQuery(campaignQuery);
        
        const campaignKeywords: GoogleAdsKeywordPerformance[] = campaignResponse?.map((row: any) => {
          const campaign = row.campaign || {};
          const metrics = row.metrics || {};
          
          const spend = (metrics.cost_micros || metrics.costMicros || 0) / 1000000;
          const conversions = metrics.conversions || 0;
          const conversionValue = (metrics.conversions_value || metrics.conversionsValue || 0) / 1000000;
          
          return {
            keyword: `${campaign.name || 'Unknown Campaign'} (Campaign)`,
            matchType: 'Campaign Level',
            spend,
            impressions: metrics.impressions || 0,
            clicks: metrics.clicks || 0,
            ctr: metrics.ctr || 0,
            cpc: (metrics.average_cpc || metrics.averageCpc || 0) / 1000000,
            conversions,
            conversionValue,
            qualityScore: 0,
            roas: spend > 0 ? conversionValue / spend : 0,
          };
        }) || [];

        logger.info(`✅ Fetched ${campaignKeywords.length} campaign-level keywords from Google Ads`);
        return campaignKeywords;
        
      } catch (campaignError) {
        logger.error('❌ All keyword fetching methods failed:', campaignError);
      return [];
      }
    }
  }

  /**
   * Get quality score metrics (equivalent to Meta's ad relevance results)
   */
  async getQualityScoreMetrics(dateStart: string, dateEnd: string): Promise<GoogleAdsQualityMetrics[]> {
    try {
      // Simplified query using only campaign data since keyword_view has compatibility issues
      const query = `
        SELECT
          campaign.name,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros
        FROM campaign
        WHERE segments.date BETWEEN '${dateStart}' AND '${dateEnd}'
        ORDER BY metrics.impressions DESC
        LIMIT 100
      `;

      const response = await this.executeQuery(query);

      const qualityMetrics: GoogleAdsQualityMetrics[] = response?.map((row: any) => {
        const campaign = row.campaign || {};
        const metrics = row.metrics || {};
        
        return {
          campaign_name: campaign.name || 'Unknown',
          ad_group_name: 'Campaign Level', // Simplified to campaign level
          keyword_text: 'All Keywords', // Simplified to campaign level
          quality_score: 0, // Field not available in current API version
          expected_ctr: 'Unknown', // Field not available in current API version
          ad_relevance: 'Unknown', // Field not available in current API version
          landing_page_experience: 'Unknown', // Field not available in current API version
          impressions: metrics.impressions || 0,
          clicks: metrics.clicks || 0,
          spend: (metrics.cost_micros || metrics.costMicros || 0) / 1000000,
        };
      }) || [];

      return qualityMetrics;
    } catch (error) {
      logger.error('❌ Error fetching quality score metrics:', error);
      // Return empty array instead of throwing to prevent breaking the main flow
      return [];
    }
  }

  /**
   * Get account info (equivalent to Meta's account info)
   */
  async getAccountInfo(): Promise<any> {
    try {
      const query = `
        SELECT 
          customer.id,
          customer.descriptive_name,
          customer.currency_code,
          customer.time_zone,
          customer.auto_tagging_enabled
        FROM customer
      `;
      
      const response = await this.executeQuery(query);
      
      if (response && response.length > 0) {
        const customer = response[0].customer;
        return {
          id: customer.id,
          name: customer.descriptive_name || customer.descriptiveName || 'Unknown',
          currency: customer.currency_code || customer.currencyCode || 'USD',
          timezone: customer.time_zone || customer.timeZone || 'UTC',
          auto_tagging_enabled: customer.auto_tagging_enabled || customer.autoTaggingEnabled || false,
          status: 'ACTIVE'
        };
      }
      
      return {
        currency: 'USD',
        timezone: 'UTC',
        status: 'ACTIVE'
      };
    } catch (error) {
      logger.error('❌ Error fetching account info:', error);
      return {
        currency: 'USD',
        timezone: 'UTC', 
        status: 'ACTIVE'
      };
    }
  }

  /**
   * Helper method to convert quality score to rating
   */
  private getQualityRating(score: number): string {
    if (score >= 8) return 'Above average';
    if (score >= 6) return 'Average';
    if (score >= 4) return 'Below average';
    return 'Poor';
  }

  /**
   * Helper method to convert network type to display name
   */
  private getNetworkDisplayName(networkType: string | number): string {
    const networkMap: { [key: string]: string } = {
      // String constants (official API documentation)
      'SEARCH': 'Google Search',
      'SEARCH_PARTNERS': 'Search Partners',
      'CONTENT': 'Google Display Network',
      'YOUTUBE_SEARCH': 'YouTube Search',
      'YOUTUBE_WATCH': 'YouTube Videos',
      'MIXED': 'Mixed',
      
      // Numeric values (actual API response format)
      '1': 'Google Search Network',
      '2': 'Google Search Network', 
      '3': 'Search Partners',
      '4': 'Google Display Network',
      '5': 'YouTube Search',
      '6': 'YouTube Videos',
      '7': 'Mixed',
    };
    
    const key = String(networkType);
    return networkMap[key] || `Network ${networkType}`;
  }

  /**
   * Helper method to convert device type to display name
   */
  private getDeviceDisplayName(deviceType: string): string {
    const deviceMap: { [key: string]: string } = {
      'MOBILE': 'Mobile',
      'DESKTOP': 'Desktop',
      'TABLET': 'Tablet',
      'CONNECTED_TV': 'Connected TV',
      'OTHER': 'Other',
      // Handle numeric device IDs that might come from API
      '1': 'Desktop',
      '2': 'Mobile', 
      '3': 'Tablet',
      '4': 'Connected TV',
      'UNKNOWN': 'Unknown',
    };
    
    return deviceMap[deviceType] || deviceType;
  }

  /**
   * Helper method to convert match type to display name
   */
  private getMatchTypeDisplayName(matchType: string): string {
    const matchTypeMap: { [key: string]: string } = {
      'EXACT': 'Exact Match',
      'PHRASE': 'Phrase Match',
      'BROAD': 'Broad Match',
      'BROAD_MATCH_MODIFIER': 'Broad Match Modifier',
      'UNKNOWN': 'Unknown',
    };
    
    return matchTypeMap[matchType] || matchType;
  }

  /**
   * Get Google Ads tables data (equivalent to Meta tables)
   * Each table is fetched independently to avoid one failure affecting others
   * Note: Demographics removed as it's not available through Google Ads API
   */
  async getGoogleAdsTables(dateStart: string, dateEnd: string): Promise<any> {
    logger.info('📊 Fetching Google Ads tables data');
    
    // Fetch each table independently with individual error handling and detailed logging
    logger.info('🚀 Starting Network Performance fetch...');
    const networkPromise = this.getNetworkPerformance(dateStart, dateEnd).then(result => {
      logger.info('✅ Network Performance completed');
      return result;
    }).catch(error => {
      logger.error('❌ Network Performance failed:', error);
      throw error;
    });
    
    logger.info('🚀 Starting Quality Metrics fetch...');
    const qualityPromise = this.getQualityScoreMetrics(dateStart, dateEnd).then(result => {
      logger.info('✅ Quality Metrics completed');
      return result;
    }).catch(error => {
      logger.error('❌ Quality Metrics failed:', error);
      throw error;
    });
    
    logger.info('🚀 Starting Device Performance fetch...');
    const devicePromise = this.getDevicePerformance(dateStart, dateEnd).then(result => {
      logger.info('✅ Device Performance completed');
      return result;
    }).catch(error => {
      logger.error('❌ Device Performance failed:', error);
      throw error;
    });
    
    logger.info('🚀 Starting Keyword Performance fetch...');
    const keywordPromise = this.getKeywordPerformance(dateStart, dateEnd).then(result => {
      logger.info('✅ Keyword Performance completed');
      return result;
    }).catch(error => {
      logger.error('❌ Keyword Performance failed:', error);
      throw error;
    });
    
    logger.info('🚀 Starting Search Term Performance fetch...');
    const searchTermPromise = this.getSearchTermPerformance(dateStart, dateEnd).then(result => {
      logger.info('✅ Search Term Performance completed');
      return result;
    }).catch(error => {
      logger.error('❌ Search Term Performance failed:', error);
      throw error;
    });
    
    // Demographics removed as it's not supported by Google Ads API
    const results = await Promise.allSettled([
      networkPromise,
      qualityPromise,
      devicePromise,
      keywordPromise,
      searchTermPromise
    ]);
    
    // Extract results, using empty arrays for failed requests
    const [networkResult, qualityResult, deviceResult, keywordResult, searchTermResult] = results;
    
    const networkPerformance = networkResult.status === 'fulfilled' ? networkResult.value : [];
    const qualityMetrics = qualityResult.status === 'fulfilled' ? qualityResult.value : [];
    const devicePerformance = deviceResult.status === 'fulfilled' ? deviceResult.value : [];
    const keywordPerformance = keywordResult.status === 'fulfilled' ? keywordResult.value : [];
    const searchTermPerformance = searchTermResult.status === 'fulfilled' ? searchTermResult.value : [];
    
    // Log individual results
    logger.info(`📊 Google Ads tables results:`, {
      networkPerformance: networkPerformance.length,
      qualityMetrics: qualityMetrics.length,
      devicePerformance: devicePerformance.length,
      keywordPerformance: keywordPerformance.length,
      searchTermPerformance: searchTermPerformance.length
    });
    
    // Log any failures
    results.forEach((result, index) => {
      const tableNames = ['Network', 'Quality', 'Device', 'Keyword', 'SearchTerm'];
      if (result.status === 'rejected') {
        logger.warn(`⚠️ ${tableNames[index]} performance fetch failed:`, result.reason?.message || result.reason);
      }
    });
    
    return {
      networkPerformance,       // Equivalent to Meta's placementPerformance (Sieci Reklamowe)
      qualityMetrics,           // Equivalent to Meta's adRelevanceResults
      devicePerformance,        // Device breakdown (Urządzenia)
      keywordPerformance,       // Keyword breakdown (Słowa Kluczowe)
      searchTermPerformance     // RMF R.70: Search Term performance (Wyszukiwane hasła)
    };
  }

  /**
   * RMF R.10: Get Account-level performance (Customer totals)
   * Required metrics: clicks, cost_micros, impressions, conversions, conversions_value
   */
  async getAccountPerformance(dateStart: string, dateEnd: string): Promise<GoogleAdsAccountPerformance> {
    try {
      logger.info(`📊 Fetching Google Ads account performance from ${dateStart} to ${dateEnd}`);

      const query = `
        SELECT
          customer.id,
          customer.descriptive_name,
          metrics.cost_micros,
          metrics.impressions,
          metrics.clicks,
          metrics.ctr,
          metrics.average_cpc,
          metrics.conversions,
          metrics.conversions_value,
          metrics.cost_per_conversion
        FROM customer
        WHERE segments.date BETWEEN '${dateStart}' AND '${dateEnd}'
      `;

      const response = await this.executeQuery(query);
      
      if (!response || response.length === 0) {
        throw new Error('No account data returned');
      }

      // Aggregate all rows (typically there's one row per day)
      let totalCostMicros = 0;
      let totalImpressions = 0;
      let totalClicks = 0;
      let totalConversions = 0;
      let totalConversionsValue = 0;
      let customerId = '';
      let customerName = '';

      response.forEach((row: any) => {
        if (!customerId) {
          customerId = row.customer?.id || this.credentials.customerId;
          customerName = row.customer?.descriptive_name || 'Account';
        }
        
        totalCostMicros += parseInt(row.metrics?.cost_micros || '0');
        totalImpressions += parseInt(row.metrics?.impressions || '0');
        totalClicks += parseInt(row.metrics?.clicks || '0');
        totalConversions += parseFloat(row.metrics?.conversions || '0');
        totalConversionsValue += parseFloat(row.metrics?.conversions_value || '0');
      });

      const spend = totalCostMicros / 1000000;
      const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
      const cpc = totalClicks > 0 ? spend / totalClicks : 0;
      const roas = spend > 0 ? totalConversionsValue / spend : 0;
      const costPerConversion = totalConversions > 0 ? spend / totalConversions : 0;

      const accountPerformance: GoogleAdsAccountPerformance = {
        customerId,
        customerName,
        spend,
        impressions: totalImpressions,
        clicks: totalClicks,
        ctr,
        cpc,
        conversions: totalConversions,
        conversion_value: totalConversionsValue,
        roas,
        cost_per_conversion: costPerConversion
      };

      logger.info(`✅ Account performance: ${spend.toFixed(2)} spend, ${totalClicks} clicks, ${totalConversions} conversions`);
      
      return accountPerformance;

    } catch (error) {
      logger.error('❌ Error fetching account performance:', error);
      throw error;
    }
  }

  /**
   * RMF R.30: Get Ad Group-level performance
   * Required metrics: clicks, cost_micros, impressions
   */
  async getAdGroupPerformance(campaignId: string, dateStart: string, dateEnd: string): Promise<GoogleAdsAdGroupPerformance[]> {
    try {
      logger.info(`📊 Fetching ad groups for campaign ${campaignId}`);

      const query = `
        SELECT
          ad_group.id,
          ad_group.name,
          ad_group.status,
          campaign.id,
          campaign.name,
          metrics.cost_micros,
          metrics.impressions,
          metrics.clicks,
          metrics.ctr,
          metrics.average_cpc,
          metrics.conversions,
          metrics.conversions_value
        FROM ad_group
        WHERE campaign.id = ${campaignId}
        AND segments.date BETWEEN '${dateStart}' AND '${dateEnd}'
        AND ad_group.status != 'REMOVED'
        ORDER BY metrics.cost_micros DESC
      `;

      const response = await this.executeQuery(query);

      // Group by ad group and aggregate metrics
      const adGroupStats: { [adGroupId: string]: any } = {};
      
      response?.forEach((row: any) => {
        const adGroupId = row.ad_group?.id || '';
        const metrics = row.metrics || {};
        
        if (!adGroupStats[adGroupId]) {
          adGroupStats[adGroupId] = {
            adGroupId,
            adGroupName: row.ad_group?.name || 'Unknown Ad Group',
            campaignId: row.campaign?.id || campaignId,
            campaignName: row.campaign?.name || 'Unknown Campaign',
            status: row.ad_group?.status || 'UNKNOWN',
            spend: 0,
            impressions: 0,
            clicks: 0,
            conversions: 0,
            conversion_value: 0
          };
        }
        
        adGroupStats[adGroupId].spend += (metrics.cost_micros || 0) / 1000000;
        adGroupStats[adGroupId].impressions += metrics.impressions || 0;
        adGroupStats[adGroupId].clicks += metrics.clicks || 0;
        adGroupStats[adGroupId].conversions += metrics.conversions || 0;
        adGroupStats[adGroupId].conversion_value += (metrics.conversions_value || 0) / 1000000;
      });

      const adGroups: GoogleAdsAdGroupPerformance[] = Object.values(adGroupStats).map((stats: any) => ({
        ...stats,
        ctr: stats.impressions > 0 ? (stats.clicks / stats.impressions) * 100 : 0,
        cpc: stats.clicks > 0 ? stats.spend / stats.clicks : 0,
        roas: stats.spend > 0 ? stats.conversion_value / stats.spend : 0,
      }));

      logger.info(`✅ Fetched ${adGroups.length} ad groups for campaign ${campaignId}`);
      return adGroups;

    } catch (error) {
      logger.error('❌ Error fetching ad group performance:', error);
      return [];
    }
  }

  /**
   * RMF R.40: Get Ad-level performance
   * Required metrics: clicks, cost_micros, impressions, conversions, conversions_value
   */
  async getAdPerformance(adGroupId: string, dateStart: string, dateEnd: string): Promise<GoogleAdsAdPerformance[]> {
    try {
      logger.info(`📊 Fetching ads for ad group ${adGroupId}`);

      const query = `
        SELECT
          ad_group_ad.ad.id,
          ad_group_ad.ad.type,
          ad_group_ad.ad.responsive_search_ad.headlines,
          ad_group_ad.ad.responsive_search_ad.descriptions,
          ad_group_ad.status,
          ad_group.id,
          ad_group.name,
          campaign.id,
          campaign.name,
          metrics.cost_micros,
          metrics.impressions,
          metrics.clicks,
          metrics.ctr,
          metrics.average_cpc,
          metrics.conversions,
          metrics.conversions_value
        FROM ad_group_ad
        WHERE ad_group.id = ${adGroupId}
        AND segments.date BETWEEN '${dateStart}' AND '${dateEnd}'
        AND ad_group_ad.status != 'REMOVED'
        ORDER BY metrics.cost_micros DESC
      `;

      const response = await this.executeQuery(query);

      // Group by ad and aggregate metrics
      const adStats: { [adId: string]: any } = {};
      
      response?.forEach((row: any) => {
        const adId = row.ad_group_ad?.ad?.id || '';
        const ad = row.ad_group_ad?.ad || {};
        const metrics = row.metrics || {};
        
        if (!adStats[adId]) {
          // Extract headline and description
          let headline = 'Ad';
          let description = '';
          
          if (ad.responsive_search_ad?.headlines && ad.responsive_search_ad.headlines.length > 0) {
            headline = ad.responsive_search_ad.headlines[0]?.text || 'Ad';
          }
          
          if (ad.responsive_search_ad?.descriptions && ad.responsive_search_ad.descriptions.length > 0) {
            description = ad.responsive_search_ad.descriptions[0]?.text || '';
          }
          
          adStats[adId] = {
            adId,
            adGroupId: row.ad_group?.id || adGroupId,
            adGroupName: row.ad_group?.name || 'Unknown Ad Group',
            campaignId: row.campaign?.id || '',
            campaignName: row.campaign?.name || 'Unknown Campaign',
            adType: ad.type || 'UNKNOWN',
            headline,
            description,
            status: row.ad_group_ad?.status || 'UNKNOWN',
            spend: 0,
            impressions: 0,
            clicks: 0,
            conversions: 0,
            conversion_value: 0
          };
        }
        
        adStats[adId].spend += (metrics.cost_micros || 0) / 1000000;
        adStats[adId].impressions += metrics.impressions || 0;
        adStats[adId].clicks += metrics.clicks || 0;
        adStats[adId].conversions += metrics.conversions || 0;
        adStats[adId].conversion_value += (metrics.conversions_value || 0) / 1000000;
      });

      const ads: GoogleAdsAdPerformance[] = Object.values(adStats).map((stats: any) => ({
        ...stats,
        ctr: stats.impressions > 0 ? (stats.clicks / stats.impressions) * 100 : 0,
        cpc: stats.clicks > 0 ? stats.spend / stats.clicks : 0,
        roas: stats.spend > 0 ? stats.conversion_value / stats.spend : 0,
      }));

      logger.info(`✅ Fetched ${ads.length} ads for ad group ${adGroupId}`);
      return ads;

    } catch (error) {
      logger.error('❌ Error fetching ad performance:', error);
      return [];
    }
  }

  /**
   * RMF R.70: Get Search Term performance (improved)
   * Required fields: search_term, search_term_match_type, clicks, cost_micros, impressions
   */
  async getSearchTermPerformance(dateStart: string, dateEnd: string): Promise<any[]> {
    try {
      logger.info(`📊 Fetching search term performance from ${dateStart} to ${dateEnd}`);

      const query = `
        SELECT
          segments.search_term,
          segments.search_term_match_type,
          campaign.name,
          ad_group.name,
          metrics.cost_micros,
          metrics.impressions,
          metrics.clicks,
          metrics.ctr,
          metrics.average_cpc,
          metrics.conversions,
          metrics.conversions_value
        FROM search_term_view
        WHERE segments.date BETWEEN '${dateStart}' AND '${dateEnd}'
        AND metrics.impressions > 0
        ORDER BY metrics.cost_micros DESC
        LIMIT 100
      `;

      const response = await this.executeQuery(query);

      const searchTerms = response?.map((row: any) => {
        const segments = row.segments || {};
        const metrics = row.metrics || {};
        const campaign = row.campaign || {};
        const adGroup = row.ad_group || {};
        
        const spend = (metrics.cost_micros || 0) / 1000000;
        const conversions = metrics.conversions || 0;
        const conversionValue = (metrics.conversions_value || 0) / 1000000;
        
        return {
          search_term: segments.search_term || 'Unknown',
          match_type: this.getMatchTypeDisplayName(segments.search_term_match_type || 'UNKNOWN'),
          campaign_name: campaign.name || 'Unknown Campaign',
          ad_group_name: adGroup.name || 'Unknown Ad Group',
          spend,
          impressions: metrics.impressions || 0,
          clicks: metrics.clicks || 0,
          ctr: metrics.ctr || 0,
          cpc: (metrics.average_cpc || 0) / 1000000,
          conversions,
          conversion_value: conversionValue,
          roas: spend > 0 ? conversionValue / spend : 0,
        };
      }) || [];

      logger.info(`✅ Fetched ${searchTerms.length} search terms`);
      return searchTerms;

    } catch (error) {
      logger.error('❌ Error fetching search term performance:', error);
      return [];
    }
  }

  /**
   * Clear any cached data
   */
  clearCache(): void {
    // Implementation for clearing cache if needed
    logger.info('🧹 Google Ads API cache cleared');
  }
} 