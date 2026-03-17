import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { MetaAPIService } from '../../../../lib/meta-api-optimized';
import { enhanceCampaignsWithConversions } from '../../../../lib/meta-actions-parser';
import logger from '../../../../lib/logger';
import { DataValidator } from '../../../../lib/data-validation';
import { withRetry } from '../../../../lib/retry-helper';
import { verifyCronAuth, createUnauthorizedResponse } from '../../../../lib/cron-auth';

// 🔒 SECURITY: This endpoint is PROTECTED with CRON_SECRET authentication
// Only authorized cron jobs can call this endpoint

export async function GET(request: NextRequest) {
  // 🔒 SECURITY: Verify cron authentication
  if (!verifyCronAuth(request)) {
    return createUnauthorizedResponse();
  }
  
  // For Vercel cron jobs - they only support GET requests
  return await POST(request);
}

export async function POST(request: NextRequest) {
  // 🔒 SECURITY: Verify cron authentication
  if (!verifyCronAuth(request)) {
    return createUnauthorizedResponse();
  }
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
    // ✅ FIX: Select BOTH meta_access_token AND system_user_token
    const { data: clients, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('id, name, email, ad_account_id, meta_access_token, system_user_token, api_status')
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
      // ✅ FIX: Check for EITHER system_user_token OR meta_access_token
      const metaToken = (client as any).system_user_token || client.meta_access_token;
      const tokenType = (client as any).system_user_token ? 'system_user (permanent)' : 'access_token (60-day)';
      
      // Skip clients without required Meta credentials
      if (!metaToken || !client.ad_account_id) {
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
      
      // 🔄 STEP 4: ENHANCED RETRY LOGIC with exponential backoff
      console.log(`\n📝 Processing: ${client.name} (using ${tokenType})`);
      
      const result = await withRetry(async () => {
        // ✅ FIX: Use the correct token (system_user_token preferred)
        const metaAPI = new MetaAPIService(metaToken!);

        // Fetch campaigns data for the target date
        const rawCampaigns = await metaAPI.getCampaignInsights(
          client.ad_account_id,
          targetDate,
          targetDate
        );
        
        if (!rawCampaigns || rawCampaigns.length === 0) {
          // Throw non-retryable error (no point retrying if no data)
          throw new Error('No campaign data available - not retrying');
        }

        // Parse actions arrays into structured funnel metrics
        const campaigns = enhanceCampaignsWithConversions(rawCampaigns);

        console.log(`📊 Found ${campaigns.length} campaigns for ${client.name}`);

        // Aggregate daily totals INCLUDING conversion metrics
        const dailyTotals = campaigns.reduce((totals: any, campaign: any) => ({
            totalClicks: totals.totalClicks + (parseInt(campaign.clicks) || 0),
            totalImpressions: totals.totalImpressions + (parseInt(campaign.impressions) || 0),
            totalSpend: totals.totalSpend + (parseFloat(campaign.spend) || 0),
            totalConversions: totals.totalConversions + (parseInt(campaign.conversions) || 0),
            campaignsCount: totals.campaignsCount + 1,
            // 🔧 FIX: Add conversion metrics aggregation INCLUDING reach and booking_step_3
            clickToCall: totals.clickToCall + (parseInt(campaign.click_to_call) || 0),
            emailContacts: totals.emailContacts + (parseInt(campaign.email_contacts) || 0),
            bookingStep1: totals.bookingStep1 + (parseInt(campaign.booking_step_1) || 0),
            bookingStep2: totals.bookingStep2 + (parseInt(campaign.booking_step_2) || 0),
            bookingStep3: totals.bookingStep3 + (parseInt(campaign.booking_step_3) || 0),
            reservations: totals.reservations + (parseInt(campaign.reservations) || 0),
            reservationValue: totals.reservationValue + (parseFloat(campaign.reservation_value) || 0),
            reach: totals.reach + (parseInt(campaign.reach) || 0)
          }), {
            totalClicks: 0,
            totalImpressions: 0,
            totalSpend: 0,
            totalConversions: 0,
            campaignsCount: 0,
            // 🔧 FIX: Initialize conversion metrics INCLUDING reach and booking_step_3
            clickToCall: 0,
            emailContacts: 0,
            bookingStep1: 0,
            bookingStep2: 0,
            bookingStep3: 0,
            reservations: 0,
            reservationValue: 0,
            reach: 0
          });

          // Calculate derived metrics
          const averageCTR = dailyTotals.totalImpressions > 0 ? 
            (dailyTotals.totalClicks / dailyTotals.totalImpressions) * 100 : 0;
          const averageCPC = dailyTotals.totalClicks > 0 ? 
            dailyTotals.totalSpend / dailyTotals.totalClicks : 0;

          // Prepare database record
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
            created_at: new Date().toISOString(),
            // 🔧 FIX: Include conversion metrics in database record INCLUDING reach and booking_step_3
            click_to_call: dailyTotals.clickToCall,
            email_contacts: dailyTotals.emailContacts,
            booking_step_1: dailyTotals.bookingStep1,
            booking_step_2: dailyTotals.bookingStep2,
            booking_step_3: dailyTotals.bookingStep3,
            reservations: dailyTotals.reservations,
            reservation_value: Math.round(dailyTotals.reservationValue * 100) / 100,
            reach: dailyTotals.reach
          };

          // 🛡️ STEP 1: VALIDATE DATA BEFORE SAVING
          // This prevents split data issues (August/September problem)
          console.log(`🛡️ Validating data for ${client.name}...`);
          const validation = DataValidator.validate(dailyRecord);
          
          if (!validation.isValid) {
            const errorMsg = validation.errors.map(e => `${e.field}: ${e.message}`).join('; ');
            throw new Error(`Data validation failed: ${errorMsg}`);
          }
          
          if (validation.warnings.length > 0) {
            console.warn(`⚠️ Validation warnings for ${client.name}:`, validation.warnings);
          }
          
        console.log(`✅ Data validation passed for ${client.name}`);

        // Store in database
        const { error: insertError } = await supabaseAdmin!
          .from('daily_kpi_data')
          .upsert(dailyRecord, {
            onConflict: 'client_id,date'
          });

        if (insertError) {
          throw new Error(`Failed to store daily KPI: ${insertError.message}`);
        }

        console.log(`✅ Successfully processed ${client.name}: ${dailyTotals.campaignsCount} campaigns, $${dailyTotals.totalSpend.toFixed(2)} spend`);
        
        // Return data for result tracking
        return {
          clientId: client.id,
          clientName: client.name,
          campaigns: dailyTotals.campaignsCount,
          spend: dailyTotals.totalSpend,
          clicks: dailyTotals.totalClicks,
          impressions: dailyTotals.totalImpressions,
          conversions: dailyTotals.totalConversions
        };
      }, {
        maxRetries: 3,
        baseDelay: 2000, // 2s, 4s, 8s delays
        enableJitter: true, // Add randomness to prevent thundering herd
        onRetry: (attempt, error, delay) => {
          console.log(`⏳ ${client.name} retry #${attempt} in ${Math.round(delay/1000)}s: ${error.message}`);
        }
      });

      // Handle retry result
      if (result.success && result.data) {
        successCount++;
        results.push({
          ...result.data,
          success: true,
          attempts: result.attempts,
          totalTime: `${Math.round(result.totalTime/1000)}s`
        });
      } else {
        failureCount++;
        results.push({
          clientId: client.id,
          clientName: client.name,
          success: false,
          error: result.error?.message || 'Unknown error',
          attempts: result.attempts,
          totalTime: `${Math.round((result.totalTime || 0)/1000)}s`
        });
      }
      
      // Add delay between clients to avoid rate limiting
      if (clients.indexOf(client) < clients.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // 🏭 PRODUCTION: Use production data manager for cleanup (90 days retention)
    logger.info('\n🏭 Using production data retention policy (90 days)...');
    
    const { ProductionDataManager } = await import('../../../../lib/production-data-manager');
    const cleanupResults = await ProductionDataManager.cleanupOldData();
    
    console.log(`✅ Production cleanup completed:`, {
      dailyDeleted: cleanupResults.dailyDeleted,
      monthlyDeleted: cleanupResults.monthlyDeleted
    });

    // Also check current data completeness (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: currentData, error: checkError } = await supabaseAdmin
      .from('daily_kpi_data')
      .select('date, client_id')
      .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
      .order('date', { ascending: false });

    if (!checkError && currentData) {
      const uniqueDates = [...new Set(currentData.map(d => d.date))];
      console.log(`📊 Current daily_kpi_data coverage: ${uniqueDates.length} days, ${currentData.length} total records`);
      console.log(`📅 Date range: ${uniqueDates[uniqueDates.length - 1]} to ${uniqueDates[0]}`);
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