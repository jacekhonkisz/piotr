import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleAdsAPIService } from '../../../lib/google-ads-api';
import logger from '../../../lib/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * RMF R.30: Ad Group-level performance endpoint
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientId, campaignId, dateStart, dateEnd } = body;

    if (!clientId || !campaignId || !dateStart || !dateEnd) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get client credentials
    const { data: client } = await supabase
      .from('clients')
      .select('google_ads_customer_id, google_ads_refresh_token')
      .eq('id', clientId)
      .single();

    if (!client?.google_ads_customer_id || !client?.google_ads_refresh_token) {
      return NextResponse.json(
        { error: 'Google Ads credentials not configured' },
        { status: 400 }
      );
    }

    // Get system settings
    const { data: settings } = await supabase
      .from('system_settings')
      .select('google_ads_client_id, google_ads_client_secret, google_ads_developer_token, google_ads_manager_customer_id')
      .single();

    if (!settings) {
      return NextResponse.json(
        { error: 'System settings not configured' },
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

    // Fetch ad groups
    const adGroups = await googleAdsService.getAdGroupPerformance(
      campaignId,
      dateStart,
      dateEnd
    );

    return NextResponse.json({
      success: true,
      data: adGroups
    });

  } catch (error: any) {
    logger.error('❌ Error fetching ad groups:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ad groups', details: error.message },
      { status: 500 }
    );
  }
}





