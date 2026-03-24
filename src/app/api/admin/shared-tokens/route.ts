import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function maskToken(token: string | null | undefined): string {
  if (!token || token.length < 20) return '';
  return token.substring(0, 10) + '••••••••' + token.substring(token.length - 6);
}

export async function GET(request: NextRequest) {
  try {
    // Fetch Meta shared token from settings
    const { data: metaRow } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'meta_system_user_token')
      .single();

    // Fetch Google Ads shared tokens from system_settings
    const { data: googleRows } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', [
        'google_ads_manager_refresh_token',
        'google_ads_manager_customer_id',
        'google_ads_developer_token',
        'google_ads_client_id'
      ]);

    const googleSettings: Record<string, string> = {};
    (googleRows || []).forEach(row => {
      googleSettings[row.key] = row.value || '';
    });

    const metaToken = metaRow?.value || '';
    const googleRefreshToken = googleSettings['google_ads_manager_refresh_token'] || '';

    return NextResponse.json({
      meta: {
        hasToken: metaToken.length > 20,
        tokenPreview: maskToken(metaToken),
        tokenLength: metaToken.length,
        fullToken: metaToken,
      },
      google: {
        hasRefreshToken: googleRefreshToken.length > 10,
        refreshTokenPreview: maskToken(googleRefreshToken),
        refreshTokenLength: googleRefreshToken.length,
        fullRefreshToken: googleRefreshToken,
        managerCustomerId: googleSettings['google_ads_manager_customer_id'] || '',
        hasDeveloperToken: (googleSettings['google_ads_developer_token'] || '').length > 5,
        hasClientId: (googleSettings['google_ads_client_id'] || '').length > 5,
      }
    });
  } catch (err) {
    console.error('Error fetching shared tokens:', err);
    return NextResponse.json({ error: 'Failed to fetch shared tokens' }, { status: 500 });
  }
}
