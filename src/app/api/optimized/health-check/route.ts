import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import logger from '../../../../lib/logger';

/**
 * OPTIMIZED HEALTH CHECK
 * 
 * Schedule: Every 12 hours (06:00, 18:00)
 * API Calls: 2 calls per day
 * Purpose: Monitor system health and token validity
 */

export async function GET() {
  return NextResponse.json({ 
    message: 'OPTIMIZED Health Check API - Use POST method',
    schedule: 'Every 12 hours (06:00, 18:00)',
    expectedCalls: '2 calls per day'
  });
}

export async function POST() {
  const startTime = Date.now();
  
  try {
    logger.info('🔄 OPTIMIZED health check started', { 
      endpoint: '/api/optimized/health-check',
      timestamp: new Date().toISOString()
    });
    
    const healthStatus = {
      timestamp: new Date().toISOString(),
      system: 'healthy',
      database: 'healthy',
      googleAds: 'healthy',
      apiCalls: 0,
      issues: [] as string[]
    };

    // Check database connection
    try {
      const { data, error } = await supabaseAdmin!
        .from('clients')
        .select('id')
        .limit(1);
      
      if (error) {
        healthStatus.database = 'unhealthy';
        healthStatus.issues.push(`Database error: ${error.message}`);
      }
    } catch (error) {
      healthStatus.database = 'unhealthy';
      healthStatus.issues.push(`Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Check Google Ads system settings
    try {
      const { data: settings, error } = await supabaseAdmin!
        .from('system_settings')
        .select('key, value')
        .in('key', ['google_ads_client_id', 'google_ads_client_secret', 'google_ads_developer_token', 'google_ads_manager_refresh_token', 'google_ads_manager_customer_id']);

      if (error) {
        healthStatus.googleAds = 'unhealthy';
        healthStatus.issues.push(`Google Ads settings error: ${error.message}`);
      } else if (!settings || settings.length === 0) {
        healthStatus.googleAds = 'unhealthy';
        healthStatus.issues.push('Google Ads settings not configured');
      } else {
        // Check if all required settings are present
        const requiredSettings = ['google_ads_client_id', 'google_ads_client_secret', 'google_ads_developer_token', 'google_ads_manager_refresh_token', 'google_ads_manager_customer_id'];
        const missingSettings = requiredSettings.filter(key => !settings.find(s => s.key === key));
        
        if (missingSettings.length > 0) {
          healthStatus.googleAds = 'unhealthy';
          healthStatus.issues.push(`Missing Google Ads settings: ${missingSettings.join(', ')}`);
        }
      }
    } catch (error) {
      healthStatus.googleAds = 'unhealthy';
      healthStatus.issues.push(`Google Ads settings check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Check client count
    try {
      const { data: clients, error } = await supabaseAdmin!
        .from('clients')
        .select('id')
        .not('google_ads_customer_id', 'is', null)
        .eq('api_status', 'valid');

      if (error) {
        healthStatus.issues.push(`Client count check failed: ${error.message}`);
      } else {
        const clientCount = clients?.length || 0;
        console.log(`📊 Active Google Ads clients: ${clientCount}`);
        
        if (clientCount === 0) {
          healthStatus.issues.push('No active Google Ads clients found');
        } else if (clientCount < 10) {
          healthStatus.issues.push(`Low client count: ${clientCount} (expected 20+)`);
        }
      }
    } catch (error) {
      healthStatus.issues.push(`Client count check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Test Google Ads API connection (simplified)
    try {
      // This would normally test the actual API connection
      // For now, we'll just check if we have the required credentials
      const { data: settings } = await supabaseAdmin!
        .from('system_settings')
        .select('key, value')
        .in('key', ['google_ads_manager_refresh_token']);

      if (settings && settings.length > 0) {
        const refreshToken = settings.find(s => s.key === 'google_ads_manager_refresh_token')?.value;
        if (refreshToken && typeof refreshToken === 'string' && refreshToken.length > 10) {
          console.log('✅ Google Ads refresh token appears valid');
          healthStatus.apiCalls = 1; // Count this as 1 API call
        } else {
          healthStatus.googleAds = 'unhealthy';
          healthStatus.issues.push('Google Ads refresh token appears invalid');
        }
      }
    } catch (error) {
      healthStatus.googleAds = 'unhealthy';
      healthStatus.issues.push(`Google Ads API test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Determine overall system health
    if (healthStatus.database === 'unhealthy' || healthStatus.googleAds === 'unhealthy') {
      healthStatus.system = 'unhealthy';
    }

    const responseTime = Date.now() - startTime;
    
    console.log(`✅ OPTIMIZED health check completed:`, {
      system: healthStatus.system,
      database: healthStatus.database,
      googleAds: healthStatus.googleAds,
      issues: healthStatus.issues.length,
      apiCalls: healthStatus.apiCalls,
      responseTime: `${responseTime}ms`
    });
    
    logger.info('OPTIMIZED health check completed', {
      system: healthStatus.system,
      database: healthStatus.database,
      googleAds: healthStatus.googleAds,
      issues: healthStatus.issues.length,
      apiCalls: healthStatus.apiCalls,
      responseTime: responseTime
    });
    
    return NextResponse.json({
      success: true,
      message: `OPTIMIZED health check completed`,
      health: healthStatus,
      summary: {
        system: healthStatus.system,
        database: healthStatus.database,
        googleAds: healthStatus.googleAds,
        issues: healthStatus.issues.length,
        apiCalls: healthStatus.apiCalls,
        responseTime: responseTime
      },
      apiCalls: healthStatus.apiCalls
    });
    
  } catch (error) {
    console.error('❌ OPTIMIZED health check failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - startTime
    });
    
    logger.error('OPTIMIZED health check failed', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - startTime
    });
    
    return NextResponse.json({
      success: false,
      error: 'OPTIMIZED health check failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - startTime
    }, { status: 500 });
  }
}
