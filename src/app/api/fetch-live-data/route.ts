import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MetaAPIService } from '../../../lib/meta-api';
import { authenticateRequest, canAccessClient, createErrorResponse } from '../../../lib/auth-middleware';
import logger from '../../../lib/logger';
import { performanceMonitor } from '../../../lib/performance';
import { 
  analyzeDateRange, 
  selectMetaAPIMethod, 
  validateDateRange
} from '../../../lib/date-range-utils';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    logger.info('Live data fetch started', { endpoint: '/api/fetch-live-data' });
    // Authenticate the request using centralized middleware
    const authResult = await authenticateRequest(request);
    
    if (!authResult.success || !authResult.user) {
      return createErrorResponse(authResult.error || 'Authentication failed', authResult.statusCode || 401);
    }

    const { user } = authResult;
    
    // Parse request body
    const requestBody = await request.json();
    const { dateRange, clientId } = requestBody;
    
    if (!clientId) {
      return createErrorResponse('Client ID required', 400);
    }
    
    // Get client data
    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();
      
    if (clientError || !clientData) {
      console.error('❌ Client not found:', { clientId, error: clientError });
      return createErrorResponse('Client not found', 404);
    }
    
    console.log('✅ Client found:', {
      id: clientData.id,
      name: clientData.name,
      email: clientData.email,
      hasAdAccountId: !!clientData.ad_account_id,
      hasMetaToken: !!clientData.meta_access_token,
      adAccountId: clientData.ad_account_id
    });
    
    // Check if user can access this client
    if (!canAccessClient(user, clientData.email)) {
      return createErrorResponse('Access denied', 403);
    }
    
    const client = clientData;

    // Use standardized date range strategy
    let startDate: string;
    let endDate: string;
    let rangeAnalysis;
    let apiMethod;
    
    if (dateRange?.start && dateRange?.end) {
      startDate = dateRange.start;
      endDate = dateRange.end;
      
      console.log('📅 Received date range:', { startDate, endDate });
      
      // Check if this is an all-time request (very old start date)
      const startDateObj = new Date(startDate);
      const currentDate = new Date();
      const maxPastDate = new Date();
      maxPastDate.setMonth(maxPastDate.getMonth() - 37); // Meta API limit
      
      const isAllTimeRequest = startDateObj.getFullYear() <= 2010;
      const isWithinAPILimits = startDateObj >= maxPastDate;
      
      console.log('📅 Request type:', { 
        isAllTimeRequest, 
        startYear: startDateObj.getFullYear(),
        isWithinAPILimits,
        maxPastDate: maxPastDate.toISOString().split('T')[0],
        requestedStartDate: startDate
      });
      
      // Only validate date range for requests within API limits
      if (isWithinAPILimits) {
        const validation = validateDateRange(startDate, endDate);
        console.log('📅 Date range validation result:', validation);
        
        if (!validation.isValid) {
          console.log('❌ Date range validation failed:', validation.error);
          return NextResponse.json({ 
            error: 'Invalid date range', 
            details: validation.error
          }, { status: 400 });
        }
      } else if (isAllTimeRequest) {
        console.log('📅 All-time request detected, skipping date range validation');
      } else {
        console.log('⚠️ Date range exceeds Meta API limits (37 months), but proceeding anyway');
      }
      
      // Analyze date range
      rangeAnalysis = analyzeDateRange(startDate, endDate);
      apiMethod = selectMetaAPIMethod({ start: startDate, end: endDate });
      
      console.log(`📅 Date range analysis:`, {
        rangeType: rangeAnalysis.rangeType,
        daysDiff: rangeAnalysis.daysDiff,
        isValidMonthly: rangeAnalysis.isValidMonthly,
        selectedMethod: apiMethod.method
      });
    } else {
      // Default to last 30 days if no date range provided
      const currentDate = new Date();
      endDate = currentDate.toISOString().split('T')[0] || '';
      const defaultStart = new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      startDate = defaultStart.toISOString().split('T')[0] || '';
      
      rangeAnalysis = analyzeDateRange(startDate, endDate);
      apiMethod = selectMetaAPIMethod({ start: startDate, end: endDate });
    }

    console.log('📅 Date range for API call:', { startDate, endDate, method: apiMethod.method });

    // Initialize Meta API service
    const metaService = new MetaAPIService(client.meta_access_token);
    
    // Validate token first
    console.log('🔐 Validating Meta API token...');
    const tokenValidation = await metaService.validateToken();
    console.log('🔐 Token validation result:', tokenValidation);
    
    // Also check token info to see permissions
    try {
      const tokenInfo = await metaService.getTokenInfo();
      console.log('🔐 Token info:', {
        success: tokenInfo.success,
        scopes: tokenInfo.info?.scopes,
        isLongLived: tokenInfo.isLongLived,
        expiresAt: tokenInfo.expiresAt
      });
    } catch (error) {
      console.log('⚠️ Could not get token info:', error);
    }
    
    if (!tokenValidation.valid) {
      return NextResponse.json({ 
        error: 'Invalid Meta Ads token', 
        details: tokenValidation.error
      }, { status: 400 });
    }

    // Fetch live campaign insights from Meta API
    console.log('📈 Fetching campaign insights from Meta API...');
    
    const adAccountId = client.ad_account_id.startsWith('act_') 
      ? client.ad_account_id.substring(4)
      : client.ad_account_id;
    
    console.log('🏢 Using ad account ID:', adAccountId);
    
    let campaignInsights: any[] = [];
    let metaApiError: string | null = null;
    
    try {
      if (apiMethod.method === 'getMonthlyCampaignInsights') {
        console.log(`📅 Using monthly insights method for ${apiMethod.parameters.year}-${apiMethod.parameters.month}...`);
        campaignInsights = await metaService.getMonthlyCampaignInsights(
          adAccountId,
          apiMethod.parameters.year,
          apiMethod.parameters.month
        );
      } else {
        console.log(`📅 Using standard campaign insights method with time increment: ${apiMethod.parameters.timeIncrement}...`);
        campaignInsights = await metaService.getCampaignInsights(
          adAccountId,
          apiMethod.parameters.dateStart,
          apiMethod.parameters.dateEnd,
          apiMethod.parameters.timeIncrement
        );
      }

      console.log('📊 Campaign insights result:', {
        count: campaignInsights.length,
        campaigns: campaignInsights.map(c => ({
          id: c.campaign_id,
          name: c.campaign_name,
          spend: c.spend,
          impressions: c.impressions,
          clicks: c.clicks
        }))
      });
    } catch (error) {
      console.error('❌ Failed to fetch campaign insights:', error);
      metaApiError = error instanceof Error ? error.message : 'Unknown error';
      campaignInsights = [];
    }

    // If no campaign-level insights, try to get basic campaign data
    if (campaignInsights.length === 0) {
      console.log('⚠️ No campaign insights found, trying to get basic campaign data...');
      
      try {
        const allCampaigns = await metaService.getCampaigns(adAccountId);
        console.log('📋 All campaigns found:', allCampaigns.length);

        if (allCampaigns.length > 0) {
          console.log('✅ Creating basic campaign data from campaigns list');
          campaignInsights = allCampaigns.map(campaign => ({
            campaign_id: campaign.id,
            campaign_name: campaign.name,
            impressions: 0,
            clicks: 0,
            spend: 0,
            conversions: 0,
            ctr: 0,
            cpc: 0,
            date_start: startDate,
            date_stop: endDate,
            status: campaign.status,
            objective: campaign.objective
          }));
        }
      } catch (campaignError) {
        console.error('❌ Failed to get basic campaign data:', campaignError);
      }
    }

    // Get account info to include currency
    let accountInfo = null;
    try {
      console.log('🔍 Fetching account info for adAccountId:', adAccountId);
      accountInfo = await metaService.getAccountInfo(adAccountId);
      console.log('💰 Account info fetched successfully:', {
        currency: accountInfo.currency,
        timezone: accountInfo.timezone_name,
        status: accountInfo.account_status,
        fullResponse: accountInfo
      });
    } catch (error) {
      console.log('⚠️ Could not fetch account info:', error);
      console.log('⚠️ Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace'
      });
    }

    // Calculate summary stats
    const totalSpend = campaignInsights.reduce((sum, campaign) => sum + campaign.spend, 0);
    const totalImpressions = campaignInsights.reduce((sum, campaign) => sum + campaign.impressions, 0);
    const totalClicks = campaignInsights.reduce((sum, campaign) => sum + campaign.clicks, 0);
    const totalConversions = campaignInsights.reduce((sum, campaign) => sum + campaign.conversions, 0);
    const averageCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const averageCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;

    const responseTime = Date.now() - startTime;
    performanceMonitor.recordAPICall('fetch-live-data', responseTime);
    
    logger.info('Live data fetch completed successfully', {
      clientId: client.id,
      responseTime,
      campaignCount: campaignInsights.length,
      currency: accountInfo?.currency || 'USD'
    });
    
    logger.info('Final calculated stats', {
      totalSpend,
      totalImpressions, 
      totalClicks,
      totalConversions,
      averageCtr,
      averageCpc,
      campaignCount: campaignInsights.length,
      currency: accountInfo?.currency || 'USD'
    });

    return NextResponse.json({
      success: true,
      data: {
        client: {
          ...client,
          currency: accountInfo?.currency || 'USD'
        },
        campaigns: campaignInsights,
        stats: {
          totalSpend,
          totalImpressions,
          totalClicks,
          totalConversions,
          averageCtr,
          averageCpc
        },
        dateRange: {
          start: startDate,
          end: endDate
        },
        accountInfo: accountInfo ? {
          currency: accountInfo.currency,
          timezone: accountInfo.timezone_name,
          status: accountInfo.account_status
        } : null
      },
      debug: {
        tokenValid: tokenValidation.valid,
        campaignInsightsCount: campaignInsights.length,
        dateRange: { startDate, endDate },
        metaApiError: metaApiError,
        hasMetaApiError: !!metaApiError,
        authenticatedUser: user.email,
        currency: accountInfo?.currency || 'USD'
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    console.error('❌ Live data fetch failed with error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      responseTime,
      errorType: error?.constructor?.name
    });
    
    logger.error('Live data fetch failed', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      responseTime
    });
    
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 