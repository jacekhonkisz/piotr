/**
 * ⚠️ DESTRUCTIVE OPERATION ⚠️
 * 
 * This script will:
 * 1. Backup existing Google Ads data
 * 2. Delete all Google Ads summaries from campaign_summaries
 * 3. Re-fetch ALL historical data from Google Ads API
 * 4. Store fresh data for all clients, all periods
 * 
 * Use case: Fix stale/incomplete historical data
 * 
 * Usage:
 *   npx ts-node scripts/refresh-all-google-ads-data.ts [--dry-run] [--skip-backup]
 */

import { createClient } from '@supabase/supabase-js';
import { GoogleAdsAPIService } from '../src/lib/google-ads-api';
import { getMonthBoundaries } from '../src/lib/date-range-utils';
import { getMondayOfWeek, getSundayOfWeek, formatDateISO, getLastNWeeks } from '../src/lib/week-helpers';
import * as fs from 'fs';
import * as path from 'path';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Client {
  id: string;
  name: string;
  google_ads_customer_id: string;
  google_ads_refresh_token?: string;
  google_ads_enabled: boolean;
}

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const skipBackup = args.includes('--skip-backup');

console.log('🔧 Google Ads Data Refresh Script');
console.log('═══════════════════════════════════════════════════════════');
console.log(`Mode: ${isDryRun ? '🧪 DRY RUN (no changes will be made)' : '⚠️ LIVE MODE (data will be modified)'}`);
console.log(`Backup: ${skipBackup ? '❌ DISABLED' : '✅ ENABLED'}`);
console.log('═══════════════════════════════════════════════════════════\n');

async function main() {
  try {
    // Step 1: Get all Google Ads clients
    console.log('📋 Step 1: Fetching Google Ads clients...\n');
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, google_ads_customer_id, google_ads_refresh_token, google_ads_enabled')
      .eq('google_ads_enabled', true)
      .not('google_ads_customer_id', 'is', null);

    if (clientsError || !clients || clients.length === 0) {
      console.error('❌ No Google Ads clients found or error:', clientsError);
      process.exit(1);
    }

    console.log(`✅ Found ${clients.length} Google Ads clients:\n`);
    clients.forEach((client, index) => {
      console.log(`   ${index + 1}. ${client.name} (${client.google_ads_customer_id})`);
    });
    console.log();

    // Step 2: Check for manager refresh token
    console.log('🔑 Step 2: Checking Google Ads authentication...\n');
    const { data: settings, error: settingsError } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', [
        'google_ads_manager_refresh_token',
        'google_ads_client_id',
        'google_ads_client_secret',
        'google_ads_developer_token',
        'google_ads_manager_customer_id'
      ]);

    if (settingsError || !settings) {
      console.error('❌ Failed to get Google Ads settings:', settingsError);
      process.exit(1);
    }

    const settingsMap = settings.reduce((acc, s) => {
      acc[s.key] = s.value;
      return acc;
    }, {} as Record<string, any>);

    const hasManagerToken = !!settingsMap.google_ads_manager_refresh_token;
    
    if (!hasManagerToken) {
      console.error('❌ No manager refresh token found in system_settings!');
      console.error('   Run: node scripts/generate-new-refresh-token.js');
      process.exit(1);
    }

    console.log('✅ Manager refresh token found');
    console.log(`   Client ID: ${settingsMap.google_ads_client_id ? '✅' : '❌'}`);
    console.log(`   Client Secret: ${settingsMap.google_ads_client_secret ? '✅' : '❌'}`);
    console.log(`   Developer Token: ${settingsMap.google_ads_developer_token ? '✅' : '❌'}`);
    console.log();

    // Step 3: Backup existing data
    if (!skipBackup && !isDryRun) {
      console.log('💾 Step 3: Backing up existing Google Ads data...\n');
      
      const { data: existingData, error: backupError } = await supabase
        .from('campaign_summaries')
        .select('*')
        .eq('platform', 'google');

      if (backupError) {
        console.error('❌ Backup failed:', backupError);
        process.exit(1);
      }

      const backupDir = path.join(process.cwd(), 'backups');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = path.join(backupDir, `google-ads-backup-${timestamp}.json`);
      
      fs.writeFileSync(backupFile, JSON.stringify(existingData, null, 2));
      
      console.log(`✅ Backed up ${existingData?.length || 0} records to:`);
      console.log(`   ${backupFile}\n`);
    }

    // Step 4: Delete existing Google Ads data
    console.log('🗑️  Step 4: Deleting existing Google Ads summaries...\n');
    
    const { data: existingCount } = await supabase
      .from('campaign_summaries')
      .select('id', { count: 'exact', head: true })
      .eq('platform', 'google');

    console.log(`   Found ${existingCount?.length || 0} existing Google Ads summaries`);

    if (!isDryRun) {
      const { error: deleteError } = await supabase
        .from('campaign_summaries')
        .delete()
        .eq('platform', 'google');

      if (deleteError) {
        console.error('❌ Failed to delete existing data:', deleteError);
        process.exit(1);
      }

      console.log('✅ Deleted all existing Google Ads summaries\n');
    } else {
      console.log('🧪 DRY RUN: Would delete all Google Ads summaries\n');
    }

    // Step 5: Re-fetch all data
    console.log('🔄 Step 5: Re-fetching fresh data from Google Ads API...\n');
    console.log('   This will take a while due to rate limits (~2-3s between API calls)\n');

    const startTime = Date.now();
    let totalMonthsCollected = 0;
    let totalWeeksCollected = 0;
    let failedClients: string[] = [];

    for (let i = 0; i < clients.length; i++) {
      const client = clients[i] as Client;
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📊 Client ${i + 1}/${clients.length}: ${client.name}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

      try {
        // Initialize Google Ads service
        const credentials = {
          refreshToken: settingsMap.google_ads_manager_refresh_token,
          clientId: settingsMap.google_ads_client_id,
          clientSecret: settingsMap.google_ads_client_secret,
          developmentToken: settingsMap.google_ads_developer_token,
          customerId: client.google_ads_customer_id,
          managerCustomerId: settingsMap.google_ads_manager_customer_id
        };

        const googleAdsService = new GoogleAdsAPIService(credentials);

        // Collect monthly data (last 12 complete months)
        console.log('📅 Collecting monthly summaries (last 12 months)...\n');
        const monthlyResults = await collectMonthlyData(
          client,
          googleAdsService,
          isDryRun
        );
        totalMonthsCollected += monthlyResults;
        console.log(`✅ Collected ${monthlyResults} monthly summaries\n`);

        // Collect weekly data (last 53 weeks)
        console.log('📅 Collecting weekly summaries (last 53 weeks)...\n');
        const weeklyResults = await collectWeeklyData(
          client,
          googleAdsService,
          isDryRun
        );
        totalWeeksCollected += weeklyResults;
        console.log(`✅ Collected ${weeklyResults} weekly summaries\n`);

        // Small delay between clients to respect rate limits
        if (i < clients.length - 1) {
          console.log('⏳ Waiting 2s before next client...');
          await delay(2000);
        }

      } catch (error) {
        console.error(`❌ Failed to collect data for ${client.name}:`, error);
        failedClients.push(client.name);
      }
    }

    // Final summary
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n\n═══════════════════════════════════════════════════════════');
    console.log('🎉 DATA REFRESH COMPLETE!');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`✅ Successfully processed: ${clients.length - failedClients.length}/${clients.length} clients`);
    console.log(`📊 Total monthly summaries: ${totalMonthsCollected}`);
    console.log(`📊 Total weekly summaries: ${totalWeeksCollected}`);
    console.log(`⏱️  Total time: ${totalTime}s\n`);

    if (failedClients.length > 0) {
      console.log('⚠️  Failed clients:');
      failedClients.forEach(name => console.log(`   - ${name}`));
      console.log();
    }

    if (isDryRun) {
      console.log('🧪 DRY RUN MODE: No data was actually stored\n');
    } else {
      console.log('✅ All data has been stored in campaign_summaries table\n');
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

async function collectMonthlyData(
  client: Client,
  googleAdsService: GoogleAdsAPIService,
  isDryRun: boolean
): Promise<number> {
  const currentDate = new Date();
  const monthsToCollect = [];

  // Last 12 complete months (skip current month)
  for (let i = 1; i <= 12; i++) {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const monthRange = getMonthBoundaries(year, month);
    
    monthsToCollect.push({
      year,
      month,
      startDate: monthRange.start,
      endDate: monthRange.end
    });
  }

  let collected = 0;

  for (const monthData of monthsToCollect) {
    try {
      console.log(`   📅 ${monthData.year}-${String(monthData.month).padStart(2, '0')}... `);

      // Fetch campaigns from Google Ads API
      const campaigns = await googleAdsService.getCampaignData(
        monthData.startDate,
        monthData.endDate
      );

      if (!campaigns || campaigns.length === 0) {
        console.log(`      ⚠️  No campaigns found`);
        continue;
      }

      // Calculate totals
      const totals = campaigns.reduce((acc: any, campaign: any) => ({
        spend: acc.spend + (campaign.spend || 0),
        impressions: acc.impressions + (campaign.impressions || 0),
        clicks: acc.clicks + (campaign.clicks || 0),
        conversions: acc.conversions + (campaign.conversions || 0),
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

      const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
      const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
      const cost_per_reservation = totals.reservations > 0 ? totals.spend / totals.reservations : 0;
      const roas = totals.spend > 0 ? totals.reservation_value / totals.spend : 0;

      if (!isDryRun) {
        // Store in database
        const summary = {
          client_id: client.id,
          summary_type: 'monthly',
          summary_date: monthData.startDate,
          platform: 'google',
          total_spend: totals.spend,
          total_impressions: Math.round(totals.impressions),
          total_clicks: Math.round(totals.clicks),
          total_conversions: Math.round(totals.conversions),
          average_ctr: ctr,
          average_cpc: cpc,
          active_campaigns: campaigns.filter((c: any) => c.status === 'ENABLED').length,
          total_campaigns: campaigns.length,
          campaign_data: campaigns,
          click_to_call: Math.round(totals.click_to_call),
          email_contacts: Math.round(totals.email_contacts),
          booking_step_1: Math.round(totals.booking_step_1),
          booking_step_2: Math.round(totals.booking_step_2),
          booking_step_3: Math.round(totals.booking_step_3),
          reservations: Math.round(totals.reservations),
          reservation_value: totals.reservation_value,
          cost_per_reservation: cost_per_reservation,
          roas: roas,
          data_source: 'google_ads_api',
          last_updated: new Date().toISOString()
        };

        const { error } = await supabase
          .from('campaign_summaries')
          .insert(summary);

        if (error) {
          console.log(`      ❌ Failed to store: ${error.message}`);
          continue;
        }
      }

      console.log(`      ✅ ${campaigns.length} campaigns, ${totals.spend.toFixed(2)} zł`);
      collected++;

      // Rate limiting delay
      await delay(100);

    } catch (error: any) {
      console.log(`      ❌ Error: ${error.message}`);
    }
  }

  return collected;
}

async function collectWeeklyData(
  client: Client,
  googleAdsService: GoogleAdsAPIService,
  isDryRun: boolean
): Promise<number> {
  // Get last 53 weeks (excluding current week)
  const allWeekMondays = getLastNWeeks(53, false);
  
  let collected = 0;

  for (let i = 0; i < allWeekMondays.length; i++) {
    try {
      const weekMonday = allWeekMondays[i];
      if (!weekMonday) {
        console.log(`      ⚠️  Invalid week data at index ${i}, skipping...`);
        continue;
      }
      
      const weekSunday = getSundayOfWeek(weekMonday);
      const startDate = formatDateISO(weekMonday);
      const endDate = formatDateISO(weekSunday);

      console.log(`   📅 Week ${i + 1}/53 (${startDate})... `);

      // Fetch campaigns from Google Ads API
      const campaigns = await googleAdsService.getCampaignData(startDate, endDate);

      if (!campaigns || campaigns.length === 0) {
        console.log(`      ⚠️  No campaigns found`);
        continue;
      }

      // Calculate totals (same logic as monthly)
      const totals = campaigns.reduce((acc: any, campaign: any) => ({
        spend: acc.spend + (campaign.spend || 0),
        impressions: acc.impressions + (campaign.impressions || 0),
        clicks: acc.clicks + (campaign.clicks || 0),
        conversions: acc.conversions + (campaign.conversions || 0),
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

      const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
      const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
      const cost_per_reservation = totals.reservations > 0 ? totals.spend / totals.reservations : 0;
      const roas = totals.spend > 0 ? totals.reservation_value / totals.spend : 0;

      if (!isDryRun) {
        const summary = {
          client_id: client.id,
          summary_type: 'weekly',
          summary_date: startDate,
          platform: 'google',
          total_spend: totals.spend,
          total_impressions: Math.round(totals.impressions),
          total_clicks: Math.round(totals.clicks),
          total_conversions: Math.round(totals.conversions),
          average_ctr: ctr,
          average_cpc: cpc,
          active_campaigns: campaigns.filter((c: any) => c.status === 'ENABLED').length,
          total_campaigns: campaigns.length,
          campaign_data: campaigns,
          click_to_call: Math.round(totals.click_to_call),
          email_contacts: Math.round(totals.email_contacts),
          booking_step_1: Math.round(totals.booking_step_1),
          booking_step_2: Math.round(totals.booking_step_2),
          booking_step_3: Math.round(totals.booking_step_3),
          reservations: Math.round(totals.reservations),
          reservation_value: totals.reservation_value,
          cost_per_reservation: cost_per_reservation,
          roas: roas,
          data_source: 'google_ads_api',
          last_updated: new Date().toISOString()
        };

        const { error } = await supabase
          .from('campaign_summaries')
          .insert(summary);

        if (error) {
          console.log(`      ❌ Failed to store: ${error.message}`);
          continue;
        }
      }

      console.log(`      ✅ ${campaigns.length} campaigns, ${totals.spend.toFixed(2)} zł`);
      collected++;

      // Rate limiting delay (100ms between weeks)
      await delay(100);

    } catch (error: any) {
      console.log(`      ❌ Error: ${error.message}`);
    }
  }

  return collected;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

