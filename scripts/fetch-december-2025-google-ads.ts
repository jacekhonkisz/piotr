#!/usr/bin/env node
/**
 * FETCH DECEMBER 2025 GOOGLE ADS DATA FROM API
 * 
 * This script fetches December 2025 data from Google Ads API and stores it
 * in google_ads_campaigns table with proper booking_step_1, booking_step_2, booking_step_3 values.
 * 
 * The data was never collected during December because the refresh token was missing.
 * Now that the token is fixed, we can fetch historical data from the API.
 * 
 * Usage: npx tsx scripts/fetch-december-2025-google-ads.ts [--dry-run]
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

const DECEMBER_START = '2025-12-01';
const DECEMBER_END = '2025-12-31';

async function main() {
  console.log('🚀 Starting December 2025 Google Ads data fetch...');
  console.log(`📅 Date range: ${DECEMBER_START} to ${DECEMBER_END}`);
  console.log(`🔧 Mode: ${isDryRun ? 'DRY RUN (no database writes)' : 'LIVE (will write to database)'}`);
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

  let successCount = 0;
  let failureCount = 0;
  let skippedCount = 0;

  for (const client of clients) {
    try {
      console.log(`\n📊 Processing: ${client.name} (${client.google_ads_customer_id})`);

      // Get client-specific refresh token (if exists) or use manager token
      const { data: clientSettings } = await supabase
        .from('client_settings')
        .select('google_ads_refresh_token')
        .eq('client_id', client.id)
        .single();

      const refreshToken = clientSettings?.google_ads_refresh_token || settings.google_ads_manager_refresh_token;

      if (!refreshToken) {
        console.log(`⚠️  Skipping ${client.name}: No refresh token available`);
        skippedCount++;
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

      // Fetch campaign data for December 2025
      console.log(`  🔄 Fetching campaign data from Google Ads API...`);
      const campaigns = await googleAdsService.getCampaignData(DECEMBER_START, DECEMBER_END);

      if (!campaigns || campaigns.length === 0) {
        console.log(`  ⚠️  No campaigns found for ${client.name} in December 2025`);
        skippedCount++;
        continue;
      }

      console.log(`  ✅ Fetched ${campaigns.length} campaigns`);

      // Check if any campaigns have booking steps
      const hasBookingSteps = campaigns.some(c => 
        (c.booking_step_1 || 0) > 0 || 
        (c.booking_step_2 || 0) > 0 || 
        (c.booking_step_3 || 0) > 0
      );

      if (hasBookingSteps) {
        const totalStep1 = campaigns.reduce((sum, c) => sum + (c.booking_step_1 || 0), 0);
        const totalStep2 = campaigns.reduce((sum, c) => sum + (c.booking_step_2 || 0), 0);
        const totalStep3 = campaigns.reduce((sum, c) => sum + (c.booking_step_3 || 0), 0);
        console.log(`  📊 Booking steps found: Step1=${totalStep1}, Step2=${totalStep2}, Step3=${totalStep3}`);
      } else {
        console.log(`  ⚠️  No booking steps found in API data (may not be available for December)`);
      }

      if (isDryRun) {
        console.log(`  🔧 DRY RUN: Would store ${campaigns.length} campaigns`);
        successCount++;
        continue;
      }

      // Prepare campaigns for database insertion
      const campaignsToInsert = campaigns.map((campaign: any) => ({
        client_id: client.id,
        campaign_id: campaign.campaignId,
        campaign_name: campaign.campaignName,
        status: campaign.status || 'UNKNOWN',
        date_range_start: DECEMBER_START,
        date_range_end: DECEMBER_END,
        spend: campaign.spend || 0,
        impressions: Math.round(campaign.impressions || 0),
        clicks: Math.round(campaign.clicks || 0),
        cpc: campaign.cpc || 0,
        ctr: campaign.ctr || 0,
        form_submissions: 0, // Not tracked separately
        phone_calls: 0, // Not tracked separately
        email_clicks: campaign.email_contacts || 0,
        phone_clicks: campaign.click_to_call || 0,
        booking_step_1: Math.round(campaign.booking_step_1 || 0),
        booking_step_2: Math.round(campaign.booking_step_2 || 0),
        booking_step_3: Math.round(campaign.booking_step_3 || 0),
        reservations: Math.round(campaign.reservations || 0),
        reservation_value: campaign.reservation_value || 0,
        roas: campaign.roas || 0,
      }));

      // Upsert campaigns (will replace existing December data)
      const { error: upsertError } = await supabase
        .from('google_ads_campaigns')
        .upsert(campaignsToInsert, {
          onConflict: 'client_id,campaign_id,date_range_start,date_range_end'
        });

      if (upsertError) {
        console.error(`  ❌ Failed to store campaigns:`, upsertError);
        failureCount++;
        continue;
      }

      console.log(`  ✅ Stored ${campaignsToInsert.length} campaigns in database`);
      successCount++;

    } catch (error) {
      console.error(`  ❌ Error processing ${client.name}:`, error);
      failureCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Failed: ${failureCount}`);
  console.log(`⚠️  Skipped: ${skippedCount}`);
  console.log(`\n${isDryRun ? '🔧 DRY RUN - No data was written' : '✅ Data has been written to database'}`);
  console.log('\n💡 Next step: Run BACKFILL_ALL_CLIENTS_DECEMBER_COMPLETE.sql to update campaign_summaries');
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

