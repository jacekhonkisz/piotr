import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, createErrorResponse } from '../../../../lib/auth-middleware';
import { createClient } from '@supabase/supabase-js';
import logger from '../../../../lib/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface GoogleAdsSettings {
  google_ads_client_id: string;
  google_ads_client_secret: string;
  google_ads_developer_token: string;
  google_ads_manager_refresh_token: string;
  google_ads_manager_customer_id: string;
  google_ads_system_user_token?: string;
}

async function checkTokenHealth(settings: GoogleAdsSettings) {
  try {
    // Test OAuth token refresh
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: settings.google_ads_client_id,
        client_secret: settings.google_ads_client_secret,
        refresh_token: settings.google_ads_manager_refresh_token,
        grant_type: 'refresh_token'
      })
    });

    if (response.ok) {
      const tokenData = await response.json();
      
      // Test Google Ads API access
      const adsResponse = await fetch('https://googleads.googleapis.com/v14/customers:listAccessibleCustomers', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'developer-token': settings.google_ads_developer_token
        }
      });

      if (adsResponse.ok) {
        const customersData = await adsResponse.json();
        const customerCount = customersData.resourceNames?.length || 0;
        
        return {
          status: 'healthy' as const,
          message: `✅ Wszystkie tokeny działają poprawnie. Dostęp do ${customerCount} kont klientów.`,
          lastChecked: new Date().toISOString(),
          details: {
            refreshTokenValid: true,
            developerTokenValid: true,
            accessibleCustomers: customerCount,
            lastSuccessfulCall: new Date().toISOString(),
            errorCount: 0
          }
        };
      } else {
        const errorText = await adsResponse.text();
        
        if (errorText.includes('test accounts')) {
          return {
            status: 'warning' as const,
            message: '⚠️ Developer token ma dostęp tylko do kont testowych. Aplikuj o Basic access.',
            lastChecked: new Date().toISOString(),
            details: {
              refreshTokenValid: true,
              developerTokenValid: false,
              accessibleCustomers: 0,
              lastSuccessfulCall: '',
              errorCount: 1
            }
          };
        } else {
          return {
            status: 'error' as const,
            message: `❌ Błąd Google Ads API: ${errorText}`,
            lastChecked: new Date().toISOString(),
            details: {
              refreshTokenValid: true,
              developerTokenValid: false,
              accessibleCustomers: 0,
              lastSuccessfulCall: '',
              errorCount: 1
            }
          };
        }
      }
    } else {
      const errorText = await response.text();
      
      if (errorText.includes('invalid_grant')) {
        return {
          status: 'error' as const,
          message: '❌ Refresh token wygasł lub został unieważniony. Wymagana regeneracja.',
          lastChecked: new Date().toISOString(),
          details: {
            refreshTokenValid: false,
            developerTokenValid: true,
            accessibleCustomers: 0,
            lastSuccessfulCall: '',
            errorCount: 1
          }
        };
      } else {
        return {
          status: 'error' as const,
          message: `❌ Błąd OAuth: ${errorText}`,
          lastChecked: new Date().toISOString(),
          details: {
            refreshTokenValid: false,
            developerTokenValid: true,
            accessibleCustomers: 0,
            lastSuccessfulCall: '',
            errorCount: 1
          }
        };
      }
    }
  } catch (error) {
    logger.error('Error checking Google Ads token health:', error);
    return {
      status: 'error' as const,
      message: `❌ Błąd połączenia: ${error instanceof Error ? error.message : 'Unknown error'}`,
      lastChecked: new Date().toISOString(),
      details: {
        refreshTokenValid: false,
        developerTokenValid: false,
        accessibleCustomers: 0,
        lastSuccessfulCall: '',
        errorCount: 1
      }
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    // Authenticate the request
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createErrorResponse(authResult.error || 'Authentication failed', 401);
    }

    // Get Google Ads settings from system_settings table
    const { data: settingsData, error: settingsError } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', [
        'google_ads_client_id',
        'google_ads_client_secret', 
        'google_ads_developer_token',
        'google_ads_manager_refresh_token',
        'google_ads_manager_customer_id',
        'google_ads_system_user_token'
      ]);

    if (settingsError) {
      logger.error('Error fetching Google Ads settings:', settingsError);
      return createErrorResponse('Failed to fetch settings', 500);
    }

    // Convert to object
    const settings: GoogleAdsSettings = {
      google_ads_client_id: '',
      google_ads_client_secret: '',
      google_ads_developer_token: '',
      google_ads_manager_refresh_token: '',
      google_ads_manager_customer_id: '',
      google_ads_system_user_token: ''
    };

    settingsData?.forEach(setting => {
      if (setting.key in settings) {
        // Parse JSON values from system_settings
        let value = setting.value || '';
        if (typeof value === 'string' && value.startsWith('"') && value.endsWith('"')) {
          try {
            value = JSON.parse(value);
          } catch {
            // If parsing fails, use the original value
          }
        }
        (settings as any)[setting.key] = value;
      }
    });

    // Check token health
    const health = await checkTokenHealth(settings);

    // Get last update timestamp
    const { data: lastUpdateData } = await supabase
      .from('system_settings')
      .select('updated_at')
      .in('key', ['google_ads_manager_refresh_token'])
      .order('updated_at', { ascending: false })
      .limit(1);

    const lastUpdate = lastUpdateData?.[0]?.updated_at || '';

    return NextResponse.json({
      success: true,
      settings,
      health,
      lastUpdate
    });

  } catch (error) {
    logger.error('Error in Google Ads settings GET:', error);
    return createErrorResponse('Internal server error', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createErrorResponse(authResult.error || 'Authentication failed', 401);
    }

    const body = await request.json();

    // Check if this is a system user token update
    if (body.google_ads_system_user_token && body.token_type === 'system_user') {
      const systemUserToken = body.google_ads_system_user_token;

      // Validate system user token format (typically long alphanumeric strings with various characters)
      if (systemUserToken.length < 20) {
        return createErrorResponse('System User Token should be at least 20 characters long', 400);
      }

      // Update system user token (store as JSON string)
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          key: 'google_ads_system_user_token',
          value: JSON.stringify(systemUserToken),
          description: 'Google Ads System User Token',
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'key'
        });

      if (error) {
        logger.error('Error updating system user token:', error);
        return createErrorResponse('Failed to update system user token', 500);
      }

      // Also update the token preference (store as JSON string)
      await supabase
        .from('system_settings')
        .upsert({
          key: 'google_ads_token_preference',
          value: JSON.stringify('system_user'),
          description: 'Preferred Google Ads token type',
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'key'
        });

      logger.info('Google Ads system user token updated successfully', {
        user: authResult.user.email,
        clientName: body.client_name
      });

      return NextResponse.json({
        success: true,
        message: 'System user token updated successfully',
        tokenType: 'system_user'
      });
    }

    // Check if this is a simple refresh token update or full settings update
    if (body.google_ads_manager_refresh_token && Object.keys(body).length === 1) {
      // Simple token update
      const refreshToken = body.google_ads_manager_refresh_token;

      // Allow both refresh tokens (1//) and developer tokens (for testing)
      if (!refreshToken.startsWith('1//') && refreshToken !== 'WCX04VxQqB0fsV0YDX0w1g') {
        return createErrorResponse('Refresh token should start with "1//" or be developer token for testing', 400);
      }

      // Update only the refresh token
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          key: 'google_ads_manager_refresh_token',
          value: refreshToken,
          description: 'Google Ads Manager Refresh Token',
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'key'
        });

      if (error) {
        logger.error('Error updating refresh token:', error);
        return createErrorResponse('Failed to update refresh token', 500);
      }

      // Get current settings for health check
      const { data: currentSettings } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', [
          'google_ads_client_id',
          'google_ads_client_secret',
          'google_ads_developer_token',
          'google_ads_manager_customer_id'
        ]);

      const settings: GoogleAdsSettings = {
        google_ads_client_id: '',
        google_ads_client_secret: '',
        google_ads_developer_token: '',
        google_ads_manager_refresh_token: refreshToken,
        google_ads_manager_customer_id: ''
      };

      currentSettings?.forEach(setting => {
        if (setting.key in settings) {
          (settings as any)[setting.key] = setting.value || '';
        }
      });

      // Test the new token
      const health = await checkTokenHealth(settings);

      logger.info('Google Ads refresh token updated', {
        tokenHealth: health.status
      });

      return NextResponse.json({
        success: true,
        message: 'Refresh token updated successfully',
        health
      });
    } else {
      // Full settings update (existing logic)
      const settings: GoogleAdsSettings = body;

      // Validate required fields
      const requiredFields = [
        'google_ads_client_id',
        'google_ads_client_secret',
        'google_ads_developer_token',
        'google_ads_manager_refresh_token',
        'google_ads_manager_customer_id'
      ];

      for (const field of requiredFields) {
        if (!settings[field as keyof GoogleAdsSettings]) {
          return createErrorResponse(`Missing required field: ${field}`, 400);
        }
      }

      // Validate formats
      if (!settings.google_ads_manager_customer_id.match(/^\d{3}-\d{3}-\d{4}$/)) {
        return createErrorResponse('Manager Customer ID should be in format XXX-XXX-XXXX', 400);
      }

      if (!settings.google_ads_manager_refresh_token.startsWith('1//')) {
        return createErrorResponse('Refresh token should start with "1//"', 400);
      }

      // Update settings in database
      const settingsToUpdate = [
        { key: 'google_ads_client_id', value: settings.google_ads_client_id },
        { key: 'google_ads_client_secret', value: settings.google_ads_client_secret },
        { key: 'google_ads_developer_token', value: settings.google_ads_developer_token },
        { key: 'google_ads_manager_refresh_token', value: settings.google_ads_manager_refresh_token },
        { key: 'google_ads_manager_customer_id', value: settings.google_ads_manager_customer_id }
      ];

      for (const setting of settingsToUpdate) {
        const { error } = await supabase
          .from('system_settings')
          .upsert({
            key: setting.key,
            value: setting.value,
            description: `Google Ads ${setting.key.replace('google_ads_', '').replace('_', ' ')}`,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'key'
          });

        if (error) {
          logger.error(`Error updating setting ${setting.key}:`, error);
          return createErrorResponse(`Failed to update ${setting.key}`, 500);
        }
      }
      // Test the new settings
      const health = await checkTokenHealth(settings);

      logger.info('Google Ads settings updated successfully', {
        user: authResult.user.email,
        tokenHealth: health.status
      });

      return NextResponse.json({
        success: true,
        message: 'Settings updated successfully',
        health
      });
    }

  } catch (error) {
    logger.error('Error in Google Ads settings POST:', error);
    return createErrorResponse('Internal server error', 500);
  }
}
