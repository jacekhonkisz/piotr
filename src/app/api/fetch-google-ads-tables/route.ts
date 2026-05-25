import { NextRequest, NextResponse } from 'next/server';
import logger from '../../../lib/logger';
import { supabase } from '../../../lib/supabase';
import { GoogleAdsAPIService } from '../../../lib/google-ads-api';

export async function POST(request: NextRequest) {
  try {
    logger.info('🚀 Starting Google Ads tables data fetch');
    
    const body = await request.json();
    const { dateStart, dateEnd, clientId } = body;

    if (!dateStart || !dateEnd) {
      return NextResponse.json({ 
        success: false, 
        error: 'Date range is required' 
      }, { status: 400 });
    }

    logger.info(`📅 Fetching Google Ads data for period: ${dateStart} to ${dateEnd}`);

    // Get authorization token from request headers
    const authorization = request.headers.get('authorization');
    if (!authorization) {
      return NextResponse.json({ 
        success: false, 
        error: 'No authorization token provided' 
      }, { status: 401 });
    }

    // Extract the token (remove "Bearer " prefix)
    const token = authorization.replace('Bearer ', '');

    // Validate the session with Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      logger.error('❌ Authentication failed:', authError);
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid authentication token' 
      }, { status: 401 });
    }

    // Get client data
    let client;
    if (clientId) {
      // Fetch specific client
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .eq('admin_id', user.id)
        .single();

      if (clientError || !clientData) {
        logger.error('❌ Client not found or access denied:', clientError);
        return NextResponse.json({ 
          success: false, 
          error: 'Client not found or access denied' 
        }, { status: 404 });
      }
      client = clientData;
    } else {
      // Get the first client for this admin user
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('*')
        .eq('admin_id', user.id)
        .eq('google_ads_enabled', true)
        .limit(1);

      if (clientsError || !clientsData?.length) {
        logger.error('❌ No Google Ads enabled clients found:', clientsError);
        return NextResponse.json({ 
          success: false, 
          error: 'No Google Ads enabled clients found' 
        }, { status: 404 });
      }
      client = clientsData[0];
    }

    // Ensure client exists
    if (!client) {
      return NextResponse.json({ 
        success: false, 
        error: 'Client not found' 
      }, { status: 404 });
    }

    // Check if client has Google Ads enabled and configured
    if (!client.google_ads_enabled) {
      return NextResponse.json({ 
        success: false, 
        error: 'Google Ads is not enabled for this client' 
      }, { status: 400 });
    }

    if (!client.google_ads_customer_id || !client.google_ads_refresh_token) {
      return NextResponse.json({ 
        success: false, 
        error: 'Google Ads credentials not configured for this client' 
      }, { status: 400 });
    }

    // Get Google Ads API credentials from system settings (including manager refresh token)
    const { data: settingsData, error: settingsError } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', ['google_ads_client_id', 'google_ads_client_secret', 'google_ads_developer_token', 'google_ads_manager_refresh_token', 'google_ads_manager_customer_id']);

    if (settingsError || !settingsData) {
      logger.error('❌ Failed to get Google Ads system settings:', settingsError);
      return NextResponse.json({ 
        success: false, 
        error: 'Google Ads system configuration not found' 
      }, { status: 500 });
    }

    const settings = settingsData.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {} as Record<string, any>);

    // Use the same token priority logic as the main API route
    let refreshToken = null;
    if (settings.google_ads_manager_refresh_token) {
      refreshToken = settings.google_ads_manager_refresh_token;
    } else if (client.google_ads_refresh_token) {
      refreshToken = client.google_ads_refresh_token;
    }

    if (!refreshToken) {
      logger.error('❌ No Google Ads refresh token found');
      return NextResponse.json({ 
        success: false, 
        error: 'Google Ads refresh token not found. Please configure Google Ads authentication.' 
      }, { status: 400 });
    }

    const googleAdsCredentials = {
      refreshToken,
      clientId: settings.google_ads_client_id,
      clientSecret: settings.google_ads_client_secret,
      developmentToken: settings.google_ads_developer_token,
      customerId: client.google_ads_customer_id!,
      managerCustomerId: settings.google_ads_manager_customer_id,
    };

    // Initialize Google Ads API service
    const googleAdsService = new GoogleAdsAPIService(googleAdsCredentials);

    // Validate credentials first
    const validation = await googleAdsService.validateCredentials();
    if (!validation.valid) {
      logger.error('❌ Google Ads credentials validation failed:', validation.error);
      return NextResponse.json({ 
        success: false, 
        error: `Google Ads credentials invalid: ${validation.error}` 
      }, { status: 400 });
    }

    logger.info('✅ Google Ads credentials validated successfully');

    // Check if we have cached data first
    const { data: cachedData } = await supabase
      .from('google_ads_tables_data')
      .select('*')
      .eq('client_id', client.id)
      .eq('date_range_start', dateStart)
      .eq('date_range_end', dateEnd)
      .single();

    if (cachedData && cachedData.last_updated) {
      const cacheAge = Date.now() - new Date(cachedData.last_updated).getTime();
      const cacheMaxAge = 60 * 60 * 1000; // 1 hour

      if (cacheAge < cacheMaxAge) {
        logger.info('📦 Returning cached Google Ads tables data');
        return NextResponse.json({
          success: true,
          data: {
            placementPerformance: (cachedData as any).network_performance || [],
            devicePerformance: cachedData.device_performance || [],
            keywordPerformance: (cachedData as any).keyword_performance || [],
            searchTermPerformance: (cachedData as any).search_term_performance || [],
            demographicPerformance: cachedData.demographic_performance || [],
            geographicPerformance: (cachedData as any).geographic_performance || [],
          },
          cached: true,
          lastUpdated: cachedData.last_updated,
        });
      }
    }

    logger.info('🔄 Fetching fresh Google Ads tables data from API');

    // Use the unified getGoogleAdsTables() so this endpoint stays in sync with
    // smart-cache-helper, fetch-google-ads-live-data, and the PDF generator.
    const tables = await googleAdsService.getGoogleAdsTables(dateStart, dateEnd);

    const data = {
      placementPerformance: tables?.networkPerformance || [],
      devicePerformance: tables?.devicePerformance || [],
      keywordPerformance: tables?.keywordPerformance || [],
      searchTermPerformance: tables?.searchTermPerformance || [],
      demographicPerformance: tables?.demographicPerformance || [],
      geographicPerformance: tables?.geographicPerformance || [],
    };

    const cacheData = {
      client_id: client.id,
      date_range_start: dateStart,
      date_range_end: dateEnd,
      network_performance: data.placementPerformance as any,
      device_performance: data.devicePerformance as any,
      keyword_performance: data.keywordPerformance as any,
      search_term_performance: data.searchTermPerformance as any,
      demographic_performance: data.demographicPerformance as any,
      geographic_performance: data.geographicPerformance as any,
      quality_score_metrics: tables?.qualityMetrics || [],
      last_updated: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error: cacheError } = await supabase
      .from('google_ads_tables_data')
      .upsert(cacheData, {
        onConflict: 'client_id,date_range_start,date_range_end'
      });

    if (cacheError) {
      logger.warn('⚠️ Failed to cache Google Ads tables data:', cacheError);
    } else {
      logger.info('✅ Google Ads tables data cached successfully');
    }

    logger.info('✅ Google Ads tables data fetch completed successfully');

    return NextResponse.json({
      success: true,
      data,
      cached: false,
      lastUpdated: new Date().toISOString(),
      summary: {
        placementCount: data.placementPerformance.length,
        deviceCount: data.devicePerformance.length,
        keywordCount: data.keywordPerformance.length,
        demographicCount: data.demographicPerformance.length,
        geographicCount: data.geographicPerformance.length,
      }
    });

  } catch (error) {
    logger.error('❌ Error in Google Ads tables fetch:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      details: process.env.NODE_ENV === 'development' ? error : undefined
    }, { status: 500 });
  }
} 