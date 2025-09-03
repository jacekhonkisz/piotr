import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchFreshGoogleAdsCurrentWeekData } from '../../../../lib/google-ads-smart-cache-helper';
import logger from '../../../../lib/logger';
import { getCurrentWeekInfo } from '../../../../lib/week-utils';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Using centralized getCurrentWeekInfo from week-utils.ts

export async function GET() {
  // For Vercel cron jobs - they only support GET requests
  return POST();
}

export async function POST() {
  const startTime = Date.now();
  
  try {
    logger.info('🔄 Google Ads current week cache refresh started', { 
      endpoint: '/api/automated/refresh-google-ads-current-week-cache',
      timestamp: new Date().toISOString()
    });
    
    // Get current week info
    const currentWeek = getCurrentWeekInfo();
    
    // Get all active clients with Google Ads configured
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, email, google_ads_customer_id, google_ads_refresh_token, api_status')
      .not('google_ads_customer_id', 'is', null)
      .eq('api_status', 'valid');
    
    if (clientsError) {
      throw new Error(`Failed to get clients: ${clientsError.message}`);
    }
    
    if (!clients || clients.length === 0) {
      logger.info('No active Google Ads clients found for current week cache refresh');
      return NextResponse.json({
        success: true,
        message: 'No active Google Ads clients found for current week cache refresh',
        processed: 0,
        responseTime: Date.now() - startTime
      });
    }
    
    console.log(`🔄 Starting Google Ads current week cache refresh for ${clients.length} clients`);
    console.log(`📅 Current Week: ${currentWeek.periodId} (${currentWeek.startDate} to ${currentWeek.endDate})`);
    
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    const results: any[] = [];
    
    // Process clients sequentially to avoid overwhelming Google Ads API
    for (const client of clients) {
      try {
        console.log(`\n📊 Refreshing Google Ads current week cache for: ${client.name}`);
        
        // Skip clients without Google Ads credentials
        if (!client.google_ads_customer_id) {
          console.log(`⏭️ Skipping ${client.name} - missing Google Ads customer ID`);
          skippedCount++;
          results.push({
            clientId: client.id,
            clientName: client.name,
            success: false,
            error: 'Missing Google Ads customer ID',
            skipped: true
          });
          continue;
        }
        
        // Fetch fresh Google Ads data for current week
        const refreshResult = await fetchFreshGoogleAdsCurrentWeekData(client.id);
        
        if (refreshResult && refreshResult.campaigns) {
          console.log(`✅ Successfully refreshed Google Ads current week cache for ${client.name}`);
          console.log(`   Campaigns: ${refreshResult.campaigns?.length || 0}`);
          console.log(`   Total Spend: ${refreshResult.stats?.totalSpend || 0}`);
          
          successCount++;
          results.push({
            clientId: client.id,
            clientName: client.name,
            success: true,
            campaigns: refreshResult.campaigns?.length || 0,
            totalSpend: refreshResult.stats?.totalSpend || 0,
            cacheKey: `google_ads_${client.id}_current_week`
          });
        } else {
          throw new Error('Failed to refresh Google Ads cache - no data returned');
        }
        
        // Add delay between clients to respect Google Ads API rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`❌ Failed to refresh Google Ads current week cache for ${client.name}:`, error);
        errorCount++;
        results.push({
          clientId: client.id,
          clientName: client.name,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    const responseTime = Date.now() - startTime;
    
    logger.info('✅ Google Ads current week cache refresh completed', {
      totalClients: clients.length,
      successful: successCount,
      errors: errorCount,
      skipped: skippedCount,
      responseTime,
      period: currentWeek.periodId
    });
    
    return NextResponse.json({
      success: true,
      message: 'Google Ads current week cache refresh completed',
      summary: {
        totalClients: clients.length,
        successful: successCount,
        errors: errorCount,
        skipped: skippedCount,
        period: currentWeek.periodId,
        responseTime
      },
      results
    });
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    logger.error('❌ Error in Google Ads current week cache refresh:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime
    });
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime
    }, { status: 500 });
  }
}