import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { MetaAPIService } from '../../../../lib/meta-api';
import logger from '../../../../lib/logger';

// This endpoint is for automated daily collection - no authentication required
// Should only be called from internal scripts or cron jobs

export async function GET() {
  // For Vercel cron jobs - they only support GET requests
  return await POST({} as NextRequest);
}

export async function POST(request: NextRequest) {
  try {
    logger.info('🚀 Starting automated daily KPI collection...');
    
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection error' }, { status: 500 });
    }

    // Get target date from request body or default to yesterday
    const body = await request.json().catch(() => ({}));
    const targetDate = body.date || (() => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday.toISOString().split('T')[0];
    })();

    console.log(`📅 Collecting data for: ${targetDate}`);

    // Get all active clients
    const { data: clients, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('id, name, email, ad_account_id, meta_access_token, api_status')
      .eq('api_status', 'valid'); // Include ALL valid clients

    if (clientError) {
      console.error('❌ Error fetching clients:', clientError);
      return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 });
    }

    if (!clients || clients.length === 0) {
      logger.info('⚠️ No active clients found');
      return NextResponse.json({ 
        success: true, 
        message: 'No active clients to process',
        processed: 0 
      });
    }

    console.log(`👥 Found ${clients.length} active clients to process`);

    const results = [];
    let successCount = 0;
    let failureCount = 0;
    let skippedCount = 0;

    // Process each client with retry logic
    for (const client of clients) {
      // Skip clients without required Meta credentials
      if (!client.meta_access_token || !client.ad_account_id) {
        console.log(`⏭️ Skipping ${client.name} - missing Meta credentials`);
        skippedCount++;
        results.push({
          clientId: client.id,
          clientName: client.name,
          success: false,
          error: 'Missing Meta credentials',
          skipped: true
        });
        continue;
      }
      
      // Add retry logic for each client
      const maxRetries = 3;
      let clientSuccess = false;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`\n📝 Processing: ${client.name} (attempt ${attempt})`);

          // Create MetaAPI service for this client
          const metaAPI = new MetaAPIService(client.meta_access_token);

          // Fetch campaigns data for the target date
          const campaigns = await metaAPI.getCampaignInsights(
            client.ad_account_id,
            targetDate,
            targetDate
          );
          
          if (!campaigns || campaigns.length === 0) {
            console.warn(`⚠️ No campaign data for ${client.name}`);
            failureCount++;
            results.push({
              clientId: client.id,
              clientName: client.name,
              success: false,
              error: 'No campaign data available',
              attempts: attempt
            });
            break; // No point retrying if no data
          }

          console.log(`📊 Found ${campaigns.length} campaigns for ${client.name}`);

          // Aggregate daily totals
          const dailyTotals = campaigns.reduce((totals: any, campaign: any) => ({
            totalClicks: totals.totalClicks + (parseInt(campaign.clicks) || 0),
            totalImpressions: totals.totalImpressions + (parseInt(campaign.impressions) || 0),
            totalSpend: totals.totalSpend + (parseFloat(campaign.spend) || 0),
            totalConversions: totals.totalConversions + (parseInt(campaign.conversions) || 0),
            campaignsCount: totals.campaignsCount + 1
          }), {
            totalClicks: 0,
            totalImpressions: 0,
            totalSpend: 0,
            totalConversions: 0,
            campaignsCount: 0
          });

          // Calculate derived metrics
          const averageCTR = dailyTotals.totalImpressions > 0 ? 
            (dailyTotals.totalClicks / dailyTotals.totalImpressions) * 100 : 0;
          const averageCPC = dailyTotals.totalClicks > 0 ? 
            dailyTotals.totalSpend / dailyTotals.totalClicks : 0;

          // Store in database
          const dailyRecord = {
            client_id: client.id,
            date: targetDate,
            total_clicks: dailyTotals.totalClicks,
            total_impressions: dailyTotals.totalImpressions,
            total_spend: Math.round(dailyTotals.totalSpend * 100) / 100,
            total_conversions: dailyTotals.totalConversions,
            average_ctr: Math.round(averageCTR * 100) / 100,
            average_cpc: Math.round(averageCPC * 100) / 100,
            campaigns_count: dailyTotals.campaignsCount,
            data_source: 'meta_api',
            created_at: new Date().toISOString()
          };

          const { error: insertError } = await supabaseAdmin
            .from('daily_kpi_data')
            .upsert(dailyRecord, {
              onConflict: 'client_id,date'
            });

          if (insertError) {
            throw new Error(`Failed to store daily KPI: ${insertError.message}`);
          }

          console.log(`✅ Successfully processed ${client.name}: ${dailyTotals.campaignsCount} campaigns, $${dailyTotals.totalSpend.toFixed(2)} spend`);
          successCount++;
          clientSuccess = true;
          
          results.push({
            clientId: client.id,
            clientName: client.name,
            success: true,
            campaigns: dailyTotals.campaignsCount,
            spend: dailyTotals.totalSpend,
            clicks: dailyTotals.totalClicks,
            impressions: dailyTotals.totalImpressions,
            conversions: dailyTotals.totalConversions,
            attempts: attempt
          });
          
          break; // Success, no need to retry
          
        } catch (error) {
          console.error(`❌ Attempt ${attempt} failed for ${client.name}:`, error);
          
          if (attempt === maxRetries) {
            failureCount++;
            results.push({
              clientId: client.id,
              clientName: client.name,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
              attempts: maxRetries
            });
          } else {
            // Wait before retry with exponential backoff
            const delayMs = Math.pow(2, attempt) * 1000;
            console.log(`⏳ Waiting ${delayMs}ms before retry for ${client.name}`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }
        }
      }
      
      // Add delay between clients to avoid rate limiting
      if (clients.indexOf(client) < clients.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Clean up old data
    logger.info('\n🧹 Cleaning up old daily KPI data...');
    const today = new Date();
    const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const cutoffDate = new Date(currentMonthStart);
    cutoffDate.setDate(cutoffDate.getDate() - 7);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    const { error: cleanupError } = await supabaseAdmin
      .from('daily_kpi_data')
      .delete()
      .lt('date', cutoffDateStr);

    if (cleanupError) {
      console.warn('⚠️ Cleanup warning:', cleanupError);
    } else {
      console.log(`✅ Cleaned up data older than ${cutoffDateStr}`);
    }

    logger.info('\n📊 Collection Summary:');
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${failureCount}`);
    console.log(`📈 Total clients: ${clients.length}`);

    return NextResponse.json({
      success: true,
      targetDate,
      totalClients: clients.length,
      successCount,
      failureCount,
      results
    });

  } catch (error) {
    console.error('❌ Daily collection failed:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 