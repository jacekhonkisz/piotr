import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { GoogleAdsAPIService } from '../../../../lib/google-ads-api';
import logger from '../../../../lib/logger';

/**
 * OPTIMIZED WEEKLY COLLECTION
 * 
 * Schedule: Monday at 03:00 AM
 * API Calls: 20 clients × 1 call = 20 calls/week (2.9 calls/day average)
 * Purpose: Collect previous week's data for all clients
 */

export async function GET() {
  return NextResponse.json({ 
    message: 'OPTIMIZED Weekly Collection API - Use POST method',
    schedule: 'Monday at 03:00 AM',
    expectedCalls: '20 calls/week (2.9 calls/day average)'
  });
}

export async function POST() {
  const startTime = Date.now();
  
  try {
    logger.info('🔄 OPTIMIZED weekly collection started', { 
      endpoint: '/api/optimized/weekly-collection',
      timestamp: new Date().toISOString()
    });
    
    // Calculate previous week period (Monday to Sunday)
    const now = new Date();
    const currentDayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const daysToLastMonday = currentDayOfWeek === 0 ? 7 : currentDayOfWeek; // If Sunday, go back 7 days
    
    // Get last Monday (start of previous week)
    const lastMonday = new Date(now);
    lastMonday.setDate(now.getDate() - daysToLastMonday - 7); // Go back to previous week's Monday
    lastMonday.setHours(0, 0, 0, 0);
    
    // Get last Sunday (end of previous week)
    const lastSunday = new Date(lastMonday);
    lastSunday.setDate(lastMonday.getDate() + 6);
    lastSunday.setHours(23, 59, 59, 999);
    
    const periodStart = lastMonday.toISOString().split('T')[0];
    const periodEnd = lastSunday.toISOString().split('T')[0];
    
    logger.info(`📅 Collecting weekly data for period: ${periodStart} to ${periodEnd}`);

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
      logger.info('No active Google Ads clients found for weekly collection');
      return NextResponse.json({
        success: true,
        message: 'No active Google Ads clients found for weekly collection',
        processed: 0,
        apiCalls: 0,
        responseTime: Date.now() - startTime
      });
    }

    console.log(`🔄 Starting OPTIMIZED weekly collection for ${clients.length} clients`);
    console.log(`📅 Period: ${periodStart} to ${periodEnd}`);

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
          console.log(`📊 Processing weekly collection for: ${client.name} (${client.id})`);
          
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

          if (!client.google_ads_customer_id) {
            throw new Error('No Google Ads customer ID available');
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

          // Fetch campaigns data for the week
          const campaigns = await googleAdsAPI.getCampaignData(periodStart, periodEnd);
          
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

          // Store weekly data (simplified for testing)
          const weeklyData = {
            client_id: client.id,
            summary_date: periodStart,
            summary_type: 'weekly',
            platform: 'google',
            campaigns_count: campaigns.length,
            total_spend: campaigns.reduce((sum, c) => sum + (c.cost || 0), 0),
            total_clicks: campaigns.reduce((sum, c) => sum + (c.clicks || 0), 0),
            total_impressions: campaigns.reduce((sum, c) => sum + (c.impressions || 0), 0),
            created_at: new Date().toISOString()
          };

          // Store in campaign_summaries table
          const { error: insertError } = await supabaseAdmin!
            .from('campaign_summaries')
            .upsert(weeklyData, {
              onConflict: 'client_id,summary_date,summary_type,platform'
            });

          if (insertError) {
            throw new Error(`Failed to store weekly data: ${insertError.message}`);
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

          console.log(`✅ Weekly collection completed for ${client.name}`);

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
    
    console.log(`✅ OPTIMIZED weekly collection completed:`, {
      totalClients: clients.length,
      successful: successCount,
      errors: errorCount,
      apiCalls: apiCalls,
      responseTime: `${responseTime}ms`
    });
    
    logger.info('OPTIMIZED weekly collection completed', {
      totalClients: clients.length,
      successful: successCount,
      errors: errorCount,
      apiCalls: apiCalls,
      responseTime: responseTime
    });
    
    return NextResponse.json({
      success: true,
      message: `OPTIMIZED weekly collection completed for ${clients.length} clients`,
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
    console.error('❌ OPTIMIZED weekly collection failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - startTime
    });
    
    logger.error('OPTIMIZED weekly collection failed', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - startTime
    });
    
    return NextResponse.json({
      success: false,
      error: 'OPTIMIZED weekly collection failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - startTime
    }, { status: 500 });
  }
}
