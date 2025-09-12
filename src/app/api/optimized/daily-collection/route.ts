import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { GoogleAdsAPIService } from '../../../../lib/google-ads-api';
import logger from '../../../../lib/logger';

/**
 * OPTIMIZED DAILY COLLECTION
 * 
 * Schedule: Daily at 02:00 AM
 * API Calls: 20 clients × 1 call = 20 calls/day
 * Purpose: Collect yesterday's data for all clients
 */

export async function GET() {
  return NextResponse.json({ 
    message: 'OPTIMIZED Daily Collection API - Use POST method',
    schedule: 'Daily at 02:00 AM',
    expectedCalls: '20 calls/day (20 clients)'
  });
}

export async function POST() {
  const startTime = Date.now();
  
  try {
    logger.info('🔄 OPTIMIZED daily collection started', { 
      endpoint: '/api/optimized/daily-collection',
      timestamp: new Date().toISOString()
    });
    
    // Get target date (yesterday by default)
    const targetDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    logger.info(`📅 Collecting data for: ${targetDate}`);

    // Get all active clients with Google Ads configured
    const { data: clients, error: clientsError } = await supabaseAdmin!
      .from('clients')
      .select('*')
      .not('google_ads_customer_id', 'is', null)
      .eq('api_status', 'valid');

    if (clientsError) {
      throw new Error(`Failed to get clients: ${clientsError.message}`);
    }

    if (!clients || clients.length === 0) {
      logger.info('No active Google Ads clients found for daily collection');
      return NextResponse.json({
        success: true,
        message: 'No active Google Ads clients found for daily collection',
        processed: 0,
        apiCalls: 0,
        responseTime: Date.now() - startTime
      });
    }

    console.log(`🔄 Starting OPTIMIZED daily collection for ${clients.length} clients`);
    console.log(`📅 Target date: ${targetDate}`);

    // Get Google Ads system settings
    const { data: settingsData, error: settingsError } = await supabaseAdmin!
      .from('system_settings')
      .select('key, value')
      .in('key', ['google_ads_client_id', 'google_ads_client_secret', 'google_ads_developer_token', 'google_ads_manager_refresh_token', 'google_ads_manager_customer_id']);

    if (settingsError) {
      throw new Error(`Failed to get Google Ads system settings: ${settingsError.message}`);
    }

    const settings = settingsData.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {} as Record<string, any>);

    let successCount = 0;
    let errorCount = 0;
    let apiCalls = 0;
    const results: any[] = [];

    // Process clients in batches of 5
    const batchSize = 5;
    for (let i = 0; i < clients.length; i += batchSize) {
      const batch = clients.slice(i, i + batchSize);
      
      console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(clients.length / batchSize)} (${batch.length} clients)`);
      
      // Process batch in parallel
      const batchPromises = batch.map(async (client) => {
        const clientStartTime = Date.now();
        
        try {
          console.log(`📊 Processing daily collection for: ${client.name} (${client.id})`);
          
          // Determine refresh token (manager token takes priority)
          let refreshToken = null;
          if (settings.google_ads_manager_refresh_token) {
            refreshToken = settings.google_ads_manager_refresh_token;
          } else if (client.google_ads_refresh_token) {
            refreshToken = client.google_ads_refresh_token;
          }

          if (!refreshToken) {
            throw new Error('No Google Ads refresh token available');
          }

          const googleAdsCredentials = {
            refreshToken,
            clientId: settings.google_ads_client_id,
            clientSecret: settings.google_ads_client_secret,
            developmentToken: settings.google_ads_developer_token,
            customerId: client.google_ads_customer_id,
            managerCustomerId: settings.google_ads_manager_customer_id,
          };

          // Create Google Ads API service
          const googleAdsAPI = new GoogleAdsAPIService(googleAdsCredentials);

          // Fetch campaigns data for the target date
          const campaigns = await googleAdsAPI.getCampaignData(targetDate, targetDate);
          
          if (!campaigns || campaigns.length === 0) {
            console.warn(`⚠️ No Google Ads campaign data for ${client.name}`);
            results.push({
              clientId: client.id,
              clientName: client.name,
              status: 'warning',
              message: 'No Google Ads campaign data available',
              responseTime: Date.now() - clientStartTime
            });
            return;
          }

          console.log(`📊 Found ${campaigns.length} Google Ads campaigns for ${client.name}`);

          // Store daily data (simplified for testing)
          const dailyData = {
            client_id: client.id,
            date: targetDate,
            campaigns_count: campaigns.length,
            total_spend: campaigns.reduce((sum, c) => sum + (c.cost || 0), 0),
            total_clicks: campaigns.reduce((sum, c) => sum + (c.clicks || 0), 0),
            total_impressions: campaigns.reduce((sum, c) => sum + (c.impressions || 0), 0),
            created_at: new Date().toISOString()
          };

          // Store in daily_kpi_data table
          const { error: insertError } = await supabaseAdmin!
            .from('daily_kpi_data')
            .upsert(dailyData, {
              onConflict: 'client_id,date'
            });

          if (insertError) {
            throw new Error(`Failed to store daily data: ${insertError.message}`);
          }

          apiCalls++;
          successCount++;
          
          results.push({
            clientId: client.id,
            clientName: client.name,
            status: 'success',
            campaigns: campaigns.length,
            responseTime: Date.now() - clientStartTime
          });

          console.log(`✅ Daily collection completed for ${client.name}`);

        } catch (error) {
          errorCount++;
          console.error(`❌ Error processing ${client.name}:`, error);
          results.push({
            clientId: client.id,
            clientName: client.name,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
            responseTime: Date.now() - clientStartTime
          });
        }
      });
      
      // Wait for batch to complete
      await Promise.all(batchPromises);
      
      // Rate limiting: 2 second delay between batches
      if (i + batchSize < clients.length) {
        console.log('⏳ Waiting 2 seconds before next batch...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    const responseTime = Date.now() - startTime;
    
    console.log(`✅ OPTIMIZED daily collection completed:`, {
      totalClients: clients.length,
      successful: successCount,
      errors: errorCount,
      apiCalls: apiCalls,
      responseTime: `${responseTime}ms`
    });
    
    logger.info('OPTIMIZED daily collection completed', {
      totalClients: clients.length,
      successful: successCount,
      errors: errorCount,
      apiCalls: apiCalls,
      responseTime: responseTime
    });
    
    return NextResponse.json({
      success: true,
      message: `OPTIMIZED daily collection completed for ${clients.length} clients`,
      summary: {
        totalClients: clients.length,
        successful: successCount,
        errors: errorCount,
        apiCalls: apiCalls,
        responseTime: responseTime
      },
      results: results,
      apiCalls: apiCalls
    });
    
  } catch (error) {
    console.error('❌ OPTIMIZED daily collection failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - startTime
    });
    
    logger.error('OPTIMIZED daily collection failed', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - startTime
    });
    
    return NextResponse.json({
      success: false,
      error: 'OPTIMIZED daily collection failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - startTime
    }, { status: 500 });
  }
}
