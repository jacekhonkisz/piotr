import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, createErrorResponse } from '../../../../lib/auth-middleware';
import { createClient } from '@supabase/supabase-js';
import logger from '../../../../lib/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createErrorResponse(authResult.error || 'Authentication failed', 401);
    }

    logger.info('Google Ads health test initiated by:', authResult.user.email);

    // Get current Google Ads settings
    const { data: settingsData, error: settingsError } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', [
        'google_ads_client_id',
        'google_ads_client_secret', 
        'google_ads_developer_token',
        'google_ads_manager_refresh_token',
        'google_ads_manager_customer_id'
      ]);

    if (settingsError || !settingsData) {
      return createErrorResponse('Failed to fetch Google Ads settings', 500);
    }

    const settings: Record<string, string> = {};
    settingsData.forEach(setting => {
      settings[setting.key] = setting.value || '';
    });

    // Check if all required settings are present
    const requiredSettings = [
      'google_ads_client_id',
      'google_ads_client_secret',
      'google_ads_developer_token',
      'google_ads_manager_refresh_token',
      'google_ads_manager_customer_id'
    ];

    const missingSettings = requiredSettings.filter(key => !settings[key]);
    if (missingSettings.length > 0) {
      return NextResponse.json({
        success: false,
        health: {
          status: 'error',
          message: `❌ Brakujące ustawienia: ${missingSettings.join(', ')}`,
          lastChecked: new Date().toISOString(),
          details: {
            refreshTokenValid: false,
            developerTokenValid: false,
            accessibleCustomers: 0,
            lastSuccessfulCall: '',
            errorCount: 1
          }
        }
      });
    }

    // Comprehensive health test
    const testResults = {
      oauthTest: { success: false, message: '', accessToken: '' },
      googleAdsTest: { success: false, message: '', customers: 0 },
      clientsTest: { success: false, message: '', clientCount: 0 }
    };

    // Test 1: OAuth Token Refresh
    try {
      logger.info('Testing OAuth token refresh...');
      
      const oauthResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: settings.google_ads_client_id || '',
          client_secret: settings.google_ads_client_secret || '',
          refresh_token: settings.google_ads_manager_refresh_token || '',
          grant_type: 'refresh_token'
        })
      });

      if (oauthResponse.ok) {
        const tokenData = await oauthResponse.json();
        testResults.oauthTest = {
          success: true,
          message: '✅ OAuth refresh successful',
          accessToken: tokenData.access_token
        };
        logger.info('OAuth test passed');
      } else {
        const errorText = await oauthResponse.text();
        testResults.oauthTest = {
          success: false,
          message: `❌ OAuth failed: ${errorText}`,
          accessToken: ''
        };
        logger.error('OAuth test failed:', errorText);
      }
    } catch (error) {
      testResults.oauthTest = {
        success: false,
        message: `❌ OAuth error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        accessToken: ''
      };
      logger.error('OAuth test error:', error);
    }

    // Test 2: Google Ads API Access (only if OAuth succeeded)
    if (testResults.oauthTest.success) {
      try {
        logger.info('Testing Google Ads API access...');
        
        const adsResponse = await fetch('https://googleads.googleapis.com/v14/customers:listAccessibleCustomers', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${testResults.oauthTest.accessToken}`,
            'developer-token': settings.google_ads_developer_token || ''
          }
        });

        if (adsResponse.ok) {
          const customersData = await adsResponse.json();
          const customerCount = customersData.resourceNames?.length || 0;
          
          testResults.googleAdsTest = {
            success: true,
            message: `✅ Google Ads API access successful`,
            customers: customerCount
          };
          logger.info('Google Ads API test passed, customers:', customerCount);
        } else {
          const errorText = await adsResponse.text();
          testResults.googleAdsTest = {
            success: false,
            message: `❌ Google Ads API failed: ${errorText}`,
            customers: 0
          };
          logger.error('Google Ads API test failed:', errorText);
        }
      } catch (error) {
        testResults.googleAdsTest = {
          success: false,
          message: `❌ Google Ads API error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          customers: 0
        };
        logger.error('Google Ads API test error:', error);
      }
    }

    // Test 3: Check configured clients
    try {
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('id, name, google_ads_customer_id')
        .not('google_ads_customer_id', 'is', null);

      if (clientsError) {
        testResults.clientsTest = {
          success: false,
          message: `❌ Database error: ${clientsError.message}`,
          clientCount: 0
        };
      } else {
        const clientCount = clientsData?.length || 0;
        testResults.clientsTest = {
          success: true,
          message: `✅ Found ${clientCount} Google Ads clients in database`,
          clientCount
        };
      }
    } catch (error) {
      testResults.clientsTest = {
        success: false,
        message: `❌ Clients test error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        clientCount: 0
      };
    }

    // Determine overall health status
    let overallStatus: 'healthy' | 'warning' | 'error';
    let overallMessage: string;
    
    if (testResults.oauthTest.success && testResults.googleAdsTest.success) {
      overallStatus = 'healthy';
      overallMessage = `✅ Wszystkie testy przeszły pomyślnie! Dostęp do ${testResults.googleAdsTest.customers} kont Google Ads, ${testResults.clientsTest.clientCount} klientów w bazie.`;
    } else if (testResults.oauthTest.success && !testResults.googleAdsTest.success) {
      overallStatus = 'warning';
      overallMessage = `⚠️ OAuth działa, ale Google Ads API ma problemy. ${testResults.googleAdsTest.message}`;
    } else {
      overallStatus = 'error';
      overallMessage = `❌ Krytyczne problemy z tokenami. ${testResults.oauthTest.message}`;
    }

    // Store test results for monitoring
    const healthData = {
      status: overallStatus,
      message: overallMessage,
      lastChecked: new Date().toISOString(),
      details: {
        refreshTokenValid: testResults.oauthTest.success,
        developerTokenValid: testResults.googleAdsTest.success,
        accessibleCustomers: testResults.googleAdsTest.customers,
        lastSuccessfulCall: testResults.oauthTest.success ? new Date().toISOString() : '',
        errorCount: [testResults.oauthTest, testResults.googleAdsTest, testResults.clientsTest]
          .filter(test => !test.success).length
      }
    };

    logger.info('Google Ads health test completed', {
      status: overallStatus,
      oauthSuccess: testResults.oauthTest.success,
      adsApiSuccess: testResults.googleAdsTest.success,
      clientCount: testResults.clientsTest.clientCount
    });

    return NextResponse.json({
      success: true,
      health: healthData,
      testResults
    });

  } catch (error) {
    logger.error('Error in Google Ads health test:', error);
    return createErrorResponse('Health test failed', 500);
  }
}
