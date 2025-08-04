import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MetaAPIService } from '../../../lib/meta-api';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  console.log('🔄 /api/fetch-live-data called - SIMPLIFIED VERSION', new Date().toISOString());
  
  try {
    // Extract the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    console.log('🔑 Token received:', token.substring(0, 20) + '...');
    
    // Parse request body first
    const requestBody = await request.json();
    const { dateRange, clientId } = requestBody;
    
    console.log('🔍 Request data:', { clientId, dateRange });
    
    let authenticatedUser = null;
    let client = null;
    
    // Try to verify the token
    try {
      const { data: { user: verifiedUser }, error: verifyError } = await supabase.auth.getUser(token);
      
      if (!verifyError && verifiedUser) {
        authenticatedUser = verifiedUser;
        console.log('✅ User authenticated:', verifiedUser.email);
      } else {
        console.log('⚠️ Token verification failed, trying direct client access...');
      }
    } catch (error) {
      console.log('⚠️ Token verification error, trying direct client access...');
    }
    
    // Get client data
    if (clientId) {
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();
        
      if (clientError || !clientData) {
        return NextResponse.json({ error: 'Client not found' }, { status: 404 });
      }
      
      client = clientData;
      console.log('✅ Client found:', client.name);
      
      // Security check: If user is authenticated, ensure they can access this client
      if (authenticatedUser && authenticatedUser.email !== client.email) {
        // Check if user is admin
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', authenticatedUser.id)
          .single();
          
        if (profile?.role !== 'admin') {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }
      }
    } else {
      return NextResponse.json({ error: 'Client ID required' }, { status: 400 });
    }

    console.log('📊 Client data loaded:', {
      id: client.id,
      name: client.name,
      email: client.email,
      adAccountId: client.ad_account_id,
      hasMetaToken: !!client.meta_access_token
    });

    // Use a more flexible date range strategy
    let startDate, endDate;
    let isMonthlyRequest = false;
    
    if (dateRange?.start && dateRange?.end) {
      startDate = dateRange.start;
      endDate = dateRange.end;
      
      const start = new Date(startDate);
      const end = new Date(endDate);
      const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysDiff >= 25 && daysDiff <= 35) {
        isMonthlyRequest = true;
        console.log(`📅 Detected monthly request: ${startDate} to ${endDate} (${daysDiff} days)`);
      }
    } else {
      endDate = new Date().toISOString().split('T')[0];
      const defaultStart = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      startDate = defaultStart.toISOString().split('T')[0];
    }

    console.log('📅 Date range for API call:', { startDate, endDate });

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
      if (isMonthlyRequest) {
        console.log('📅 Using monthly insights method...');
        const startDateObj = new Date(startDate);
        campaignInsights = await metaService.getMonthlyCampaignInsights(
          adAccountId,
          startDateObj.getFullYear(),
          startDateObj.getMonth() + 1
        );
      } else {
        console.log('📅 Using standard campaign insights method...');
        campaignInsights = await metaService.getCampaignInsights(
          adAccountId,
          startDate,
          endDate
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

    console.log('📊 Final calculated stats:', {
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
        authenticatedUser: authenticatedUser?.email || 'direct-access',
        currency: accountInfo?.currency || 'USD'
      }
    });

  } catch (error) {
    console.error('💥 Error in fetch-live-data API:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 