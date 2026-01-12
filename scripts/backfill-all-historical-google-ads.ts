#!/usr/bin/env node
/**
 * BACKFILL ALL HISTORICAL GOOGLE ADS DATA WITH CORRECTED all_conversions METRIC
 * 
 * This script fetches ALL historical months from Google Ads API using the corrected
 * all_conversions metric (instead of conversions) to match Google Ads Console numbers.
 * 
 * It will:
 * 1. Fetch data for all months from January 2024 to current month
 * 2. Store in google_ads_campaigns table
 * 3. Update campaign_summaries table
 * 4. Work for all clients automatically
 * 
 * Usage: 
 *   npx tsx scripts/backfill-all-historical-google-ads.ts --dry-run  # Check first
 *   npx tsx scripts/backfill-all-historical-google-ads.ts            # Run for real
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { GoogleAdsAPIService } from '../src/lib/google-ads-api';
import logger from '../src/lib/logger';

// Load environment variables
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Parse command line args
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const startFromArg = args.find(a => a.startsWith('--start='));
const startFromMonth = startFromArg ? startFromArg.split('=')[1] : '2024-01';

// Configuration
const START_YEAR = parseInt(startFromMonth.split('-')[0]);
const START_MONTH = parseInt(startFromMonth.split('-')[1]);

function getMonthsToBackfill(): Array<{ startDate: string; endDate: string; label: string }> {
  const months: Array<{ startDate: string; endDate: string; label: string }> = [];
  
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  
  let year = START_YEAR;
  let month = START_MONTH;
  
  // Go up to but not including current month (current month uses smart cache)
  while (year < currentYear || (year === currentYear && month < currentMonth)) {
    const lastDay = new Date(year, month, 0).getDate();
    months.push({
      startDate: `${year}-${String(month).padStart(2, '0')}-01`,
      endDate: `${year}-${String(month).padStart(2, '0')}-${lastDay}`,
      label: `${year}-${String(month).padStart(2, '0')}`
    });
    
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }
  
  return months;
}

async function main() {
  console.log('🚀 Starting comprehensive historical data backfill...');
  console.log(`📅 Start: ${startFromMonth}, End: Current month (exclusive)`);
  console.log(`🔧 Mode: ${isDryRun ? 'DRY RUN (no database writes)' : 'LIVE (will write to database)'}`);
  console.log('✅ Using corrected all_conversions metric (matches Google Ads Console)\n');

  const monthsToBackfill = getMonthsToBackfill();
  
  if (monthsToBackfill.length === 0) {
    console.log('ℹ️  No months to backfill');
    process.exit(0);
  }

  console.log(`📊 Will backfill ${monthsToBackfill.length} months:`);
  monthsToBackfill.forEach(m => console.log(`   - ${m.label}`));
  console.log('');

  // Get all clients with Google Ads configured
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('*')
    .not('google_ads_customer_id', 'is', null)
    .eq('api_status', 'valid');

  if (clientsError) {
    console.error('❌ Failed to get clients:', clientsError);
    process.exit(1);
  }

  if (!clients || clients.length === 0) {
    console.log('ℹ️ No clients with Google Ads configuration found');
    process.exit(0);
  }

  console.log(`📊 Found ${clients.length} clients with Google Ads configuration\n`);

  // Get Google Ads system settings
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

  if (settingsError) {
    console.error('❌ Failed to get system settings:', settingsError);
    process.exit(1);
  }

  const settings: Record<string, string> = {};
  settingsData?.forEach((row: any) => {
    settings[row.key] = row.value;
  });

  if (!settings.google_ads_manager_refresh_token) {
    console.error('❌ Missing google_ads_manager_refresh_token in system_settings');
    process.exit(1);
  }

  let totalSuccess = 0;
  let totalFailures = 0;
  let totalSkipped = 0;

  // Process each month
  for (const month of monthsToBackfill) {
    console.log('\n' + '='.repeat(80));
    console.log(`📅 Processing: ${month.label} (${month.startDate} to ${month.endDate})`);
    console.log('='.repeat(80));

    let monthSuccess = 0;
    let monthFailures = 0;
    let monthSkipped = 0;

    // Process each client for this month
    for (const client of clients) {
      try {
        console.log(`\n  📊 ${client.name} (${client.google_ads_customer_id})`);

        // Get client-specific refresh token or use manager token
        const { data: clientSettings } = await supabase
          .from('client_settings')
          .select('google_ads_refresh_token')
          .eq('client_id', client.id)
          .single();

        const refreshToken = clientSettings?.google_ads_refresh_token || settings.google_ads_manager_refresh_token;

        if (!refreshToken) {
          console.log(`     ⚠️  Skipping: No refresh token available`);
          monthSkipped++;
          continue;
        }

        const googleAdsCredentials = {
          refreshToken,
          clientId: settings.google_ads_client_id || '',
          clientSecret: settings.google_ads_client_secret || '',
          developmentToken: settings.google_ads_developer_token || '',
          customerId: client.google_ads_customer_id,
          managerCustomerId: settings.google_ads_manager_customer_id || '',
        };

        // Initialize Google Ads API service
        const googleAdsService = new GoogleAdsAPIService(googleAdsCredentials);

        // Fetch campaign data (now uses all_conversions!)
        const campaigns = await googleAdsService.getCampaignData(month.startDate, month.endDate);

        if (!campaigns || campaigns.length === 0) {
          console.log(`     ⚠️  No campaigns found for this period`);
          monthSkipped++;
          continue;
        }

        const totalSpend = campaigns.reduce((sum, c) => sum + (c.spend || 0), 0);
        const totalStep1 = campaigns.reduce((sum, c) => sum + (c.booking_step_1 || 0), 0);
        const totalStep2 = campaigns.reduce((sum, c) => sum + (c.booking_step_2 || 0), 0);
        const totalStep3 = campaigns.reduce((sum, c) => sum + (c.booking_step_3 || 0), 0);

        console.log(`     ✅ Fetched ${campaigns.length} campaigns`);
        console.log(`     💰 Spend: ${totalSpend.toFixed(2)} PLN`);
        console.log(`     📊 Steps: ${Math.round(totalStep1)}, ${Math.round(totalStep2)}, ${Math.round(totalStep3)}`);

        if (isDryRun) {
          console.log(`     🔧 DRY RUN: Would store ${campaigns.length} campaigns`);
          monthSuccess++;
          continue;
        }

        // Prepare campaigns for google_ads_campaigns table
        const campaignsToInsert = campaigns.map((campaign: any) => ({
          client_id: client.id,
          campaign_id: campaign.campaignId,
          campaign_name: campaign.campaignName,
          status: campaign.status || 'UNKNOWN',
          date_range_start: month.startDate,
          date_range_end: month.endDate,
          spend: campaign.spend || 0,
          impressions: Math.round(campaign.impressions || 0),
          clicks: Math.round(campaign.clicks || 0),
          cpc: campaign.cpc || 0,
          ctr: campaign.ctr || 0,
          form_submissions: 0,
          phone_calls: 0,
          email_clicks: campaign.email_contacts || 0,
          phone_clicks: campaign.click_to_call || 0,
          booking_step_1: Math.round(campaign.booking_step_1 || 0),
          booking_step_2: Math.round(campaign.booking_step_2 || 0),
          booking_step_3: Math.round(campaign.booking_step_3 || 0),
          reservations: Math.round(campaign.reservations || 0),
          reservation_value: campaign.reservation_value || 0,
          roas: campaign.roas || 0,
        }));

        // Upsert to google_ads_campaigns
        const { error: campaignsError } = await supabase
          .from('google_ads_campaigns')
          .upsert(campaignsToInsert, {
            onConflict: 'client_id,campaign_id,date_range_start,date_range_end'
          });

        if (campaignsError) {
          console.error(`     ❌ Failed to store campaigns:`, campaignsError);
          monthFailures++;
          continue;
        }

        console.log(`     ✅ Stored ${campaignsToInsert.length} campaigns in google_ads_campaigns`);

        // Now update campaign_summaries
        // ✅ FIX: Round all bigint fields to integers
        const totalImpressions = Math.round(campaigns.reduce((sum, c) => sum + (c.impressions || 0), 0));
        const totalClicks = Math.round(campaigns.reduce((sum, c) => sum + (c.clicks || 0), 0));
        const totalConversions = Math.round(campaigns.reduce((sum, c) => sum + (c.conversions || 0), 0));
        
        const summary = {
          client_id: client.id,
          summary_type: 'monthly',
          summary_date: month.startDate,
          platform: 'google',
          total_spend: totalSpend,
          total_impressions: totalImpressions,
          total_clicks: totalClicks,
          total_conversions: totalConversions,
          average_ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
          average_cpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
          booking_step_1: Math.round(totalStep1),
          booking_step_2: Math.round(totalStep2),
          booking_step_3: Math.round(totalStep3),
          reservations: Math.round(campaigns.reduce((sum, c) => sum + (c.reservations || 0), 0)),
          reservation_value: campaigns.reduce((sum, c) => sum + (c.reservation_value || 0), 0),
          click_to_call: Math.round(campaigns.reduce((sum, c) => sum + (c.click_to_call || 0), 0)),
          email_contacts: Math.round(campaigns.reduce((sum, c) => sum + (c.email_contacts || 0), 0)),
          roas: campaigns.reduce((sum, c) => sum + (c.roas || 0), 0) / campaigns.length || 0,
          active_campaigns: campaigns.filter(c => c.status === 'ENABLED').length,
          total_campaigns: campaigns.length,
          campaign_data: campaigns.map(c => ({
            campaignId: c.campaignId,
            campaignName: c.campaignName,
            status: c.status,
            spend: c.spend,
            impressions: Math.round(c.impressions || 0),
            clicks: Math.round(c.clicks || 0),
            cpc: c.cpc,
            ctr: c.ctr,
            booking_step_1: Math.round(c.booking_step_1 || 0),
            booking_step_2: Math.round(c.booking_step_2 || 0),
            booking_step_3: Math.round(c.booking_step_3 || 0),
            reservations: Math.round(c.reservations || 0),
            reservation_value: c.reservation_value,
            roas: c.roas
          })),
          data_source: `backfill_all_conversions_${new Date().toISOString().split('T')[0]}`,
          last_updated: new Date().toISOString()
        };

        const { error: summaryError } = await supabase
          .from('campaign_summaries')
          .upsert(summary, {
            onConflict: 'client_id,summary_type,summary_date,platform'
          });

        if (summaryError) {
          console.error(`     ❌ Failed to update campaign_summaries:`, summaryError);
          monthFailures++;
          continue;
        }

        console.log(`     ✅ Updated campaign_summaries for ${month.label}`);
        monthSuccess++;

      } catch (error) {
        console.error(`     ❌ Error:`, error);
        monthFailures++;
      }
    }

    console.log(`\n  📊 Month ${month.label} Summary: ${monthSuccess} success, ${monthFailures} failures, ${monthSkipped} skipped`);
    totalSuccess += monthSuccess;
    totalFailures += monthFailures;
    totalSkipped += monthSkipped;
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 FINAL SUMMARY');
  console.log('='.repeat(80));
  console.log(`✅ Total Success: ${totalSuccess}`);
  console.log(`❌ Total Failures: ${totalFailures}`);
  console.log(`⚠️  Total Skipped: ${totalSkipped}`);
  console.log(`📅 Months Processed: ${monthsToBackfill.length}`);
  console.log(`👥 Clients: ${clients.length}`);
  console.log(`\n${isDryRun ? '🔧 DRY RUN - No data was written' : '✅ Data has been written to database'}`);
  console.log('✅ All historical data now uses all_conversions metric (matches Google Ads Console)');
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

