import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { fetchFreshCurrentMonthData } from '../../../../lib/smart-cache-helper';
import { fetchFreshGoogleAdsCurrentMonthData } from '../../../../lib/google-ads-smart-cache-helper';
import logger from '../../../../lib/logger';

/**
 * OPTIMIZED SMART CACHE REFRESH
 * 
 * Schedule: Every 4 hours
 * API Calls: Only when cache is stale (>3.5 hours)
 * Purpose: Keep current data fresh with intelligent refresh
 */

export async function GET() {
  return NextResponse.json({ 
    message: 'OPTIMIZED Smart Cache Refresh API - Use POST method',
    schedule: 'Every 4 hours',
    expectedCalls: 'Only when cache is stale'
  });
}

export async function POST() {
  const startTime = Date.now();
  
  try {
    logger.info('🔄 OPTIMIZED smart cache refresh started', { 
      endpoint: '/api/optimized/smart-cache-refresh',
      timestamp: new Date().toISOString()
    });
    
    // Get current month and week info
    const currentMonth = getCurrentMonthInfo();
    const currentWeek = getCurrentWeekInfo();
    
    // Get all active clients
    const { data: clients, error: clientsError } = await supabaseAdmin!
      .from('clients')
      .select('id, name, email, ad_account_id, google_ads_customer_id, api_status')
      .eq('api_status', 'valid');
    
    if (clientsError) {
      throw new Error(`Failed to get clients: ${clientsError.message}`);
    }
    
    if (!clients || clients.length === 0) {
      logger.info('No active clients found for smart cache refresh');
      return NextResponse.json({
        success: true,
        message: 'No active clients found for smart cache refresh',
        processed: 0,
        apiCalls: 0,
        skipped: 0,
        responseTime: Date.now() - startTime
      });
    }
    
    console.log(`🔄 Starting OPTIMIZED smart cache refresh for ${clients.length} active clients`);
    console.log(`📅 Current Month: ${currentMonth.periodId} (${currentMonth.startDate} to ${currentMonth.endDate})`);
    console.log(`📅 Current Week: ${currentWeek.periodId} (${currentWeek.startDate} to ${currentWeek.endDate})`);
    
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    let apiCalls = 0;
    const results: any[] = [];
    
    // Process clients in batches of 5 with rate limiting
    const batchSize = 5;
    for (let i = 0; i < clients.length; i += batchSize) {
      const batch = clients.slice(i, i + batchSize);
      
      console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(clients.length / batchSize)} (${batch.length} clients)`);
      
      // Process batch in parallel
      const batchPromises = batch.map(async (client) => {
      const clientStartTime = Date.now();
      
      try {
        console.log(`📊 Processing smart cache refresh for: ${client.name} (${client.id})`);
        
        // Check cache age for both Meta and Google Ads
        const { data: metaCache } = await supabaseAdmin!
          .from('current_month_cache')
          .select('last_updated')
          .eq('client_id', client.id)
          .eq('period_id', currentMonth.periodId)
          .maybeSingle();
        
        const { data: googleCache } = await supabaseAdmin!
          .from('google_ads_current_month_cache')
          .select('last_updated')
          .eq('client_id', client.id)
          .eq('period_id', currentMonth.periodId)
          .maybeSingle();
        
        const now = new Date().getTime();
        const metaAge = metaCache ? (now - new Date(metaCache.last_updated).getTime()) / (1000 * 60 * 60) : 999;
        const googleAge = googleCache ? (now - new Date(googleCache.last_updated).getTime()) / (1000 * 60 * 60) : 999;
        
        // Skip if both caches are fresh (less than 3.5 hours old)
        if (metaAge < 3.5 && googleAge < 3.5) {
          console.log(`⏭️ Skipping ${client.name} - caches are fresh (Meta: ${metaAge.toFixed(1)}h, Google: ${googleAge.toFixed(1)}h)`);
          skippedCount++;
          results.push({
            clientId: client.id,
            clientName: client.name,
            status: 'skipped',
            reason: 'cache-fresh',
            metaAge: metaAge.toFixed(1),
            googleAge: googleAge.toFixed(1),
            responseTime: Date.now() - clientStartTime
          });
          return;
        }
        
        // Refresh Meta cache if needed
        if (metaAge >= 3.5 && client.ad_account_id) {
          console.log(`🔄 Refreshing Meta cache for ${client.name} (age: ${metaAge.toFixed(1)}h)`);
          try {
            await fetchFreshCurrentMonthData(client);
            apiCalls++;
            console.log(`✅ Meta cache refreshed for ${client.name}`);
          } catch (error) {
            console.error(`❌ Meta cache refresh failed for ${client.name}:`, error);
          }
        }
        
        // Refresh Google Ads cache if needed
        if (googleAge >= 3.5 && client.google_ads_customer_id) {
          console.log(`🔄 Refreshing Google Ads cache for ${client.name} (age: ${googleAge.toFixed(1)}h)`);
          try {
            await fetchFreshGoogleAdsCurrentMonthData(client);
            apiCalls++;
            console.log(`✅ Google Ads cache refreshed for ${client.name}`);
          } catch (error) {
            console.error(`❌ Google Ads cache refresh failed for ${client.name}:`, error);
          }
        }
        
        successCount++;
        results.push({
          clientId: client.id,
          clientName: client.name,
          status: 'success',
          metaAge: metaAge.toFixed(1),
          googleAge: googleAge.toFixed(1),
          responseTime: Date.now() - clientStartTime
        });
        
        // Rate limiting: 1 second delay between clients
        await new Promise(resolve => setTimeout(resolve, 1000));
        
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
    
    console.log(`✅ OPTIMIZED smart cache refresh completed:`, {
      totalClients: clients.length,
      successful: successCount,
      skipped: skippedCount,
      errors: errorCount,
      apiCalls: apiCalls,
      responseTime: `${responseTime}ms`
    });
    
    logger.info('OPTIMIZED smart cache refresh completed', {
      totalClients: clients.length,
      successful: successCount,
      skipped: skippedCount,
      errors: errorCount,
      apiCalls: apiCalls,
      responseTime: responseTime
    });
    
    return NextResponse.json({
      success: true,
      message: `OPTIMIZED smart cache refresh completed for ${clients.length} active clients`,
      summary: {
        totalClients: clients.length,
        successful: successCount,
        skipped: skippedCount,
        errors: errorCount,
        apiCalls: apiCalls,
        responseTime: responseTime
      },
      results: results,
      apiCalls: apiCalls,
      skipped: skippedCount
    });
    
  } catch (error) {
    console.error('❌ OPTIMIZED smart cache refresh failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - startTime
    });
    
    logger.error('OPTIMIZED smart cache refresh failed', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - startTime
    });
    
    return NextResponse.json({
      success: false,
      error: 'OPTIMIZED smart cache refresh failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - startTime
    }, { status: 500 });
  }
}

// Helper functions
function getCurrentMonthInfo() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  
  return {
    periodId: `${year}-${month.toString().padStart(2, '0')}`,
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0]
  };
}

function getCurrentWeekInfo() {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Monday
  startOfWeek.setHours(0, 0, 0, 0);
  
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday
  endOfWeek.setHours(23, 59, 59, 999);
  
  const year = startOfWeek.getFullYear();
  const weekNumber = Math.ceil((startOfWeek - new Date(year, 0, 1)) / (7 * 24 * 60 * 60 * 1000));
  
  return {
    periodId: `${year}-W${weekNumber.toString().padStart(2, '0')}`,
    startDate: startOfWeek.toISOString().split('T')[0],
    endDate: endOfWeek.toISOString().split('T')[0]
  };
}
