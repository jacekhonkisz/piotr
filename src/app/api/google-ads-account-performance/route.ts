import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleAdsAPIService } from '../../../lib/google-ads-api';
import logger from '../../../lib/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * RMF R.10: Account-level performance endpoint
 * Required metrics: clicks, cost_micros, impressions, conversions, conversions_value
 */
export async function POST(request: NextRequest) {
  try {
    logger.info('📊 Fetching Google Ads account performance');

    const body = await request.json();
    const { clientId, dateStart, dateEnd } = body;

    // Validate required fields
    if (!clientId || !dateStart || !dateEnd) {
      return NextResponse.json(
        { error: 'Missing required fields: clientId, dateStart, dateEnd' },
        { status: 400 }
      );
    }

    // Get client credentials
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('google_ads_customer_id, google_ads_refresh_token')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      logger.error('❌ Client not found:', clientError);
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    if (!client.google_ads_customer_id || !client.google_ads_refresh_token) {
      return NextResponse.json(
        { error: 'Google Ads credentials not configured for this client' },
        { status: 400 }
      );
    }

    // Get system settings
    const { data: settings, error: settingsError } = await supabase
      .from('system_settings')
      .select('google_ads_client_id, google_ads_client_secret, google_ads_developer_token, google_ads_manager_customer_id')
      .single();

    if (settingsError || !settings) {
      logger.error('❌ System settings not found:', settingsError);
      return NextResponse.json(
        { error: 'Google Ads system settings not configured' },
        { status: 500 }
      );
    }

    // Initialize Google Ads API service
    const googleAdsService = new GoogleAdsAPIService({
      customerId: client.google_ads_customer_id,
      refreshToken: client.google_ads_refresh_token,
      clientId: settings.google_ads_client_id,
      clientSecret: settings.google_ads_client_secret,
      developmentToken: settings.google_ads_developer_token,
      managerCustomerId: settings.google_ads_manager_customer_id
    });

    // Fetch account performance
    const accountPerformance = await googleAdsService.getAccountPerformance(dateStart, dateEnd);

    logger.info('✅ Account performance fetched successfully');

    return NextResponse.json({
      success: true,
      data: accountPerformance
    });

  } catch (error: any) {
    logger.error('❌ Error fetching account performance:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch account performance', 
        details: error.message 
      },
      { status: 500 }
    );
  }
}



