import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { GoogleAdsAPIService } from '../../../../lib/google-ads-api';
import logger from '../../../../lib/logger';

// This endpoint is for automated daily Google Ads collection - no authentication required
// Should only be called from internal scripts or cron jobs

export async function GET() {
  // For Vercel cron jobs - they only support GET requests
  return POST(new NextRequest('http://localhost:3000/api/automated/google-ads-daily-collection'));
}

export async function POST(request: NextRequest) {
  try {
    logger.info('🤖 Automated Google Ads daily KPI collection started');
    
    const startTime = Date.now();
    
    // Get target date (yesterday by default, or from query params)
    const url = new URL(request.url);
    const targetDateParam = url.searchParams.get('date');
    const targetDate = targetDateParam || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    logger.info(`📅 Collecting Google Ads data for: ${targetDate}`);

    // Get all clients with Google Ads configured
    const { data: clients, error: clientsError } = await supabaseAdmin!
      .from('clients')
      .select('*')
      .not('google_ads_customer_id', 'is', null)
      .eq('api_status', 'valid');

    if (clientsError) {
      throw new Error(`Failed to get clients: ${clientsError.message}`);
    }

    if (!clients || clients.length === 0) {
      logger.info('ℹ️ No clients with Google Ads configuration found');
      return NextResponse.json({
        success: true,
        message: 'No clients with Google Ads configuration found',
        processed: 0,
        responseTime: Date.now() - startTime
      });
    }

    logger.info(`📊 Found ${clients.length} clients with Google Ads configuration`);

    const results: any[] = [];
    let successCount = 0;
    let failureCount = 0;
    let skippedCount = 0;

    // Get Google Ads system settings
    const { data: settingsData, error: settingsError } = await supabaseAdmin!
      .from('system_settings')
      .select('key, value')
      .in('key', ['google_ads_client_id', 'google_ads_client_secret', 'google_ads_developer_token', 'google_ads_manager_refresh_token', 'google_ads_manager_customer_id']);

    if (settingsError) {
      throw new Error(`Failed to get Google Ads system settings: ${settingsError.message}`);
    }

    const settings = settingsData.reduce((acc: any, setting: any) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {});

    // Process each client with retry logic
    for (const client of clients) {
      // Skip clients without required Google Ads credentials
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
      
      // Add retry logic for each client
      const maxRetries = 3;
      let clientSuccess = false;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`\n📝 Processing Google Ads: ${client.name} (attempt ${attempt})`);

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
          const campaigns = await googleAdsAPI.getCampaignData(targetDate!, targetDate!);
          
          if (!campaigns || campaigns.length === 0) {
            console.warn(`⚠️ No Google Ads campaign data for ${client.name}`);
            failureCount++;
            results.push({
              clientId: client.id,
              clientName: client.name,
              success: false,
              error: 'No Google Ads campaign data available',
              attempts: attempt
            });
            break; // No point retrying if no data
          }

          console.log(`📊 Found ${campaigns.length} Google Ads campaigns for ${client.name}`);

          // Aggregate daily totals
          const dailyTotals = campaigns.reduce((acc: any, campaign: any) => ({
            spend: acc.spend + (campaign.spend || 0),
            impressions: acc.impressions + (campaign.impressions || 0),
            clicks: acc.clicks + (campaign.clicks || 0),
            conversions: acc.conversions + (campaign.conversions || 0),
            // Google Ads specific conversions
            click_to_call: acc.click_to_call + (campaign.click_to_call || 0),
            email_contacts: acc.email_contacts + (campaign.email_contacts || 0),
            booking_step_1: acc.booking_step_1 + (campaign.booking_step_1 || 0),
            booking_step_2: acc.booking_step_2 + (campaign.booking_step_2 || 0),
            booking_step_3: acc.booking_step_3 + (campaign.booking_step_3 || 0),
            reservations: acc.reservations + (campaign.reservations || 0),
            reservation_value: acc.reservation_value + (campaign.reservation_value || 0),
          }), {
            spend: 0, impressions: 0, clicks: 0, conversions: 0,
            click_to_call: 0, email_contacts: 0, booking_step_1: 0,
            booking_step_2: 0, booking_step_3: 0, reservations: 0, reservation_value: 0
          });

          // Calculate derived metrics
          const ctr = dailyTotals.clicks > 0 ? (dailyTotals.clicks / dailyTotals.impressions) * 100 : 0;
          const cpc = dailyTotals.clicks > 0 ? dailyTotals.spend / dailyTotals.clicks : 0;

          // Store in campaign_summaries table with platform="google"
          // Store both weekly and monthly summaries for better lookup compatibility
          const summaryData = {
            client_id: client.id,
            platform: 'google', // Important: Mark as Google Ads data
            summary_date: targetDate,
            total_spend: Math.round(dailyTotals.spend * 100) / 100, // Round to 2 decimal places
            total_impressions: Math.round(dailyTotals.impressions), // Ensure integer
            total_clicks: Math.round(dailyTotals.clicks), // Ensure integer
            total_conversions: Math.round(dailyTotals.conversions), // Ensure integer
            average_ctr: Math.round(ctr * 100) / 100, // Round to 2 decimal places
            average_cpc: Math.round(cpc * 100) / 100, // Round to 2 decimal places
            // Google Ads specific conversion fields (ensure integers)
            click_to_call: Math.round(dailyTotals.click_to_call || 0),
            email_contacts: Math.round(dailyTotals.email_contacts || 0),
            booking_step_1: Math.round(dailyTotals.booking_step_1 || 0),
            booking_step_2: Math.round(dailyTotals.booking_step_2 || 0),
            booking_step_3: Math.round(dailyTotals.booking_step_3 || 0),
            reservations: Math.round(dailyTotals.reservations || 0),
            reservation_value: Math.round(dailyTotals.reservation_value * 100) / 100, // Round to 2 decimal places
            campaign_data: campaigns as any, // Type assertion for JSON compatibility
            last_updated: new Date().toISOString()
          };

          // Store as both weekly and monthly for better compatibility
          const weeklyInsert = await supabaseAdmin!
            .from('campaign_summaries')
            .upsert({
              ...summaryData,
              summary_type: 'weekly',
              summary_date: targetDate || new Date().toISOString().split('T')[0]
            } as any, {
              onConflict: 'client_id,summary_type,summary_date'
            });

          // Also store as monthly summary (using first day of month as date)
          const monthDate = new Date(targetDate!);
          const monthlyDate = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}-01`;
          
          const monthlyInsert = await supabaseAdmin!
            .from('campaign_summaries')
            .upsert({
              ...summaryData,
              summary_type: 'monthly',
              summary_date: monthlyDate
            } as any, {
              onConflict: 'client_id,summary_type,summary_date'
            });

          const insertError = weeklyInsert.error || monthlyInsert.error;

          if (insertError) {
            throw new Error(`Failed to store Google Ads summary: ${insertError.message}`);
          }

          // 🔧 FIX: Also store in daily_kpi_data for consistency with Meta data
          const dailyKpiRecord = {
            client_id: client.id,
            date: targetDate!,
            total_clicks: dailyTotals.clicks,
            total_impressions: dailyTotals.impressions,
            total_spend: Math.round(dailyTotals.spend * 100) / 100,
            total_conversions: dailyTotals.conversions,
            average_ctr: Math.round(ctr * 100) / 100,
            average_cpc: Math.round(cpc * 100) / 100,
            campaigns_count: campaigns.length,
            data_source: 'google_ads_api',
            created_at: new Date().toISOString(),
            // Include conversion metrics
            click_to_call: dailyTotals.click_to_call,
            email_contacts: dailyTotals.email_contacts,
            booking_step_1: dailyTotals.booking_step_1,
            booking_step_2: dailyTotals.booking_step_2,
            booking_step_3: dailyTotals.booking_step_3 || 0,
            reservations: dailyTotals.reservations,
            reservation_value: Math.round(dailyTotals.reservation_value * 100) / 100
          };

          const { error: dailyKpiError } = await supabaseAdmin!
            .from('daily_kpi_data')
            .upsert(dailyKpiRecord, {
              onConflict: 'client_id,date,data_source'
            });

          if (dailyKpiError) {
            console.warn(`⚠️ Failed to store Google Ads daily KPI data: ${dailyKpiError.message}`);
          } else {
            console.log(`✅ Also stored Google Ads data in daily_kpi_data table`);
          }

          console.log(`✅ Successfully stored Google Ads daily summary for ${client.name}`);
          console.log(`   Spend: ${dailyTotals.spend}, Impressions: ${dailyTotals.impressions}, Clicks: ${dailyTotals.clicks}`);
          console.log(`   Conversions: ${dailyTotals.reservations} reservations, ${dailyTotals.reservation_value} PLN value`);
          
          successCount++;
          clientSuccess = true;
          results.push({
            clientId: client.id,
            clientName: client.name,
            success: true,
            campaigns: campaigns.length,
            totals: dailyTotals,
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
              attempts: attempt
            });
          } else {
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
          }
        }
      }
      
      if (!clientSuccess) {
        console.error(`❌ All attempts failed for ${client.name}`);
      }
    }

    // Clean up old Google Ads daily data (7-day rolling window)
    logger.info('\n🧹 Cleaning up old Google Ads daily KPI data (7-day rolling window)...');
    
    const today = new Date();
    const cutoffDate = new Date(today);
    cutoffDate.setDate(cutoffDate.getDate() - 7); // Keep 7 days of data
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    console.log(`🗑️ Removing Google Ads daily_kpi_data older than: ${cutoffDateStr}`);

    const { data: deletedRows, error: cleanupError } = await supabaseAdmin!
      .from('daily_kpi_data')
      .delete()
      .lt('date', cutoffDateStr)
      .like('data_source', '%google%') // Only clean up Google Ads data
      .select('date, client_id');

    if (cleanupError) {
      console.warn('⚠️ Google Ads cleanup warning:', cleanupError);
    } else {
      const deletedCount = deletedRows?.length || 0;
      console.log(`✅ Cleaned up ${deletedCount} old Google Ads daily KPI records older than ${cutoffDateStr}`);
    }

    const responseTime = Date.now() - startTime;
    
    logger.info('✅ Google Ads automated daily collection completed', {
      totalClients: clients.length,
      successful: successCount,
      failed: failureCount,
      skipped: skippedCount,
      responseTime,
      targetDate
    });

    return NextResponse.json({
      success: true,
      message: 'Google Ads daily collection completed',
      summary: {
        totalClients: clients.length,
        successful: successCount,
        failed: failureCount,
        skipped: skippedCount,
        targetDate,
        responseTime
      },
      results
    });

  } catch (error) {
    const responseTime = Date.now() - (Date.now());
    logger.error('❌ Error in Google Ads automated daily collection:', {
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
