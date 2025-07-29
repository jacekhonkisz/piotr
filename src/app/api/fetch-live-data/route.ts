import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MetaAPIService } from '../../../lib/meta-api';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  console.log('🔄 /api/fetch-live-data called - RECREATED VERSION', new Date().toISOString());
  try {
    // Extract the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    console.log('🔑 Token received:', token.substring(0, 20) + '...');
    
    // Try to decode the JWT payload to see what's inside
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      console.log('🔍 JWT payload:', {
        sub: payload.sub,
        email: payload.email,
        aud: payload.aud,
        exp: payload.exp,
        iss: payload.iss
      });
    } catch (e) {
      console.log('❌ Failed to decode JWT:', e.message);
    }

    // Try to verify the JWT token using the admin client
    console.log('🔍 Attempting to verify JWT token with admin client...');
    console.log('🔧 Environment check:', {
      hasPublicUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
    });
    
    // Create a client with the JWT token
    const jwtClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    );
    
    // Get user from the JWT token
    const { data: { user: jwtUser }, error: authError } = await jwtClient.auth.getUser();
    
    let authenticatedUser = jwtUser;
    
    // If the JWT client fails, try with manual JWT verification
    if (authError || !jwtUser) {
      console.log('❌ JWT client failed, trying manual verification...');
      console.error('Token verification failed:', authError);
      console.error('Auth error details:', JSON.stringify(authError, null, 2));
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    } else {
      console.log('✅ User authenticated via JWT client:', jwtUser.email);
      authenticatedUser = jwtUser;
    }

    // Get user profile to check role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', authenticatedUser.id)
      .single();

    if (profile?.role !== 'client') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get client data
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('email', authenticatedUser.email)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    console.log('📊 Client data loaded:', {
      id: client.id,
      name: client.name,
      email: client.email,
      adAccountId: client.ad_account_id,
      hasMetaToken: !!client.meta_access_token,
      tokenPreview: client.meta_access_token ? client.meta_access_token.substring(0, 20) + '...' : 'none'
    });

    // Parse request body for date range (optional)
    const { dateRange } = await request.json();
    
    // Use a more flexible date range strategy
    let startDate, endDate;
    let isMonthlyRequest = false;
    
    if (dateRange?.start && dateRange?.end) {
      // If specific date range is provided, use it
      startDate = dateRange.start;
      endDate = dateRange.end;
      
      // Check if this is a monthly request (25-35 days)
      const start = new Date(startDate);
      const end = new Date(endDate);
      const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysDiff >= 25 && daysDiff <= 35) {
        isMonthlyRequest = true;
        console.log(`📅 Detected monthly request: ${startDate} to ${endDate} (${daysDiff} days)`);
      } else if (daysDiff < 90) {
        // For shorter periods, extend the range to get more data
        const extendedStart = new Date(start);
        extendedStart.setMonth(extendedStart.getMonth() - 3); // Go back 3 months
        startDate = extendedStart.toISOString().split('T')[0];
        console.log(`📅 Extended date range from ${dateRange.start} to ${startDate} to get more data`);
      }
    } else {
      // Default to last 90 days to ensure we get data
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
    
    if (!tokenValidation.valid) {
      return NextResponse.json({ 
        error: 'Invalid Meta Ads token', 
        details: tokenValidation.error,
        debug: {
          clientId: client.id,
          hasToken: !!client.meta_access_token
        }
      }, { status: 400 });
    }

    // Fetch live campaign insights from Meta API
    console.log('📈 Fetching campaign insights from Meta API...');
    
    // Ensure ad account ID has 'act_' prefix for Meta API
    const adAccountId = client.ad_account_id.startsWith('act_') 
      ? client.ad_account_id.substring(4) // Remove 'act_' if present
      : client.ad_account_id; // Use as-is if no prefix
    
    console.log('🏢 Using ad account ID:', adAccountId, '(will be used as act_' + adAccountId + ')');
    
    // First, get account information to find creation date
    let accountCreationDate: Date | null = null;
    try {
      console.log('🔍 Getting account information...');
      const accountInfo = await metaService.getAccountInfo(adAccountId);
      console.log('📊 Account info:', accountInfo);
      
      if (accountInfo && accountInfo.created_time) {
        accountCreationDate = new Date(accountInfo.created_time);
        console.log('📅 Account created:', accountCreationDate.toISOString());
      }
    } catch (error) {
      console.warn('⚠️ Could not get account creation date:', error);
    }
    
    let campaignInsights: any[] = [];
    let metaApiError: string | null = null;
    
    try {
      // Use monthly insights method only for true monthly requests
      if (isMonthlyRequest) {
        console.log('📅 Using monthly insights method with daily breakdown...');
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
      campaignInsights = []; // Set to empty array to continue with fallback
    }

    // If no campaign-level insights, try to get basic campaign data
    if (campaignInsights.length === 0) {
      console.log('⚠️ No campaign insights found, trying to get basic campaign data...');
      
      try {
        // Get basic campaigns list
        const allCampaigns = await metaService.getCampaigns(adAccountId);
        console.log('📋 All campaigns found:', {
          count: allCampaigns.length,
          campaigns: allCampaigns.map(c => ({
            id: c.id,
            name: c.name,
            status: c.status,
            objective: c.objective
          }))
        });

        // Create basic campaign data from campaigns list
        if (allCampaigns.length > 0) {
          console.log('✅ Creating basic campaign data from campaigns list');
          campaignInsights = allCampaigns.map(campaign => ({
            campaign_id: campaign.id,
            campaign_name: campaign.name,
            impressions: 0, // No insights data available
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

    // If still no data, try account-level insights as final fallback
    if (campaignInsights.length === 0) {
      console.log('⚠️ No campaign data found, trying account-level insights...');
      try {
        const accountInsights = await metaService.getAccountInsights(
          adAccountId,
          startDate,
          endDate
        );
      
        console.log('🏢 Account insights result:', accountInsights);
        
        if (accountInsights && accountInsights.spend) {
          console.log('✅ Creating synthetic campaign from account data');
          // Create a synthetic campaign from account data
          campaignInsights = [{
            campaign_id: 'account_total',
            campaign_name: 'Account Total',
            impressions: parseInt(accountInsights.impressions || '0'),
            clicks: parseInt(accountInsights.clicks || '0'),
            spend: parseFloat(accountInsights.spend || '0'),
            conversions: parseInt(accountInsights.conversions?.[0]?.value || '0'),
            ctr: parseFloat(accountInsights.ctr || '0'),
            cpc: parseFloat(accountInsights.cpc || '0'),
            date_start: startDate,
            date_stop: endDate,
          }];
        }
      } catch (accountError) {
        console.error('❌ Failed to get account insights:', accountError);
      }
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
      campaignCount: campaignInsights.length
    });

    return NextResponse.json({
      success: true,
      data: {
        client,
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
        }
      },
      debug: {
        tokenValid: tokenValidation.valid,
        campaignInsightsCount: campaignInsights.length,
        dateRange: { startDate, endDate },
        metaApiError: metaApiError,
        hasMetaApiError: !!metaApiError,
        accountCreationDate: accountCreationDate?.toISOString() || null
      }
    });

  } catch (error) {
    console.error('💥 Error in fetch-live-data API:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
} 