#!/usr/bin/env node
/**
 * TEST: January 2026 Current Month & Week with Corrected all_conversions
 * 
 * Tests both monthly and weekly data fetching for January 2026
 * to verify the all_conversions fix works for current periods.
 * 
 * Usage: npx tsx scripts/test-january-2026-both-periods.ts
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { GoogleAdsAPIService } from '../src/lib/google-ads-api';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// January 2026 dates
const JANUARY_START = '2026-01-01';
const JANUARY_END = '2026-01-31';
// Current week (Jan 6-12, 2026)
const WEEK_START = '2026-01-06';
const WEEK_END = '2026-01-12';

async function testPeriod(periodName: string, startDate: string, endDate: string, client: any, googleAdsService: GoogleAdsAPIService) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 Testing ${periodName}: ${startDate} to ${endDate}`);
  console.log('='.repeat(80));

  try {
    const campaigns = await googleAdsService.getCampaignData(startDate, endDate);

    if (!campaigns || campaigns.length === 0) {
      console.log(`⚠️  No campaigns found for ${periodName}`);
      return null;
    }

    const totals = campaigns.reduce((acc, campaign: any) => {
      acc.total_spend += campaign.spend || 0;
      acc.total_impressions += campaign.impressions || 0;
      acc.total_clicks += campaign.clicks || 0;
      acc.booking_step_1 += campaign.booking_step_1 || 0;
      acc.booking_step_2 += campaign.booking_step_2 || 0;
      acc.booking_step_3 += campaign.booking_step_3 || 0;
      acc.reservations += campaign.reservations || 0;
      acc.reservation_value += campaign.reservation_value || 0;
      return acc;
    }, {
      total_spend: 0,
      total_impressions: 0,
      total_clicks: 0,
      booking_step_1: 0,
      booking_step_2: 0,
      booking_step_3: 0,
      reservations: 0,
      reservation_value: 0
    });

    // Round to integers
    totals.booking_step_1 = Math.round(totals.booking_step_1);
    totals.booking_step_2 = Math.round(totals.booking_step_2);
    totals.booking_step_3 = Math.round(totals.booking_step_3);
    totals.reservations = Math.round(totals.reservations);

    console.log(`✅ Fetched ${campaigns.length} campaigns`);
    console.log(`\n📊 Results:`);
    console.log(`  Total Spend: ${totals.total_spend.toFixed(2)} PLN`);
    console.log(`  Total Impressions: ${totals.total_impressions.toLocaleString()}`);
    console.log(`  Total Clicks: ${totals.total_clicks.toLocaleString()}`);
    console.log(`\n🎯 Booking Steps (using all_conversions):`);
    console.log(`  Booking Step 1: ${totals.booking_step_1.toLocaleString()}`);
    console.log(`  Booking Step 2: ${totals.booking_step_2.toLocaleString()}`);
    console.log(`  Booking Step 3: ${totals.booking_step_3.toLocaleString()}`);
    console.log(`\n📈 Reservations:`);
    console.log(`  Reservations: ${totals.reservations.toLocaleString()}`);
    console.log(`  Reservation Value: ${totals.reservation_value.toFixed(2)} PLN`);

    // Check if numbers look realistic (not zeros if there's spend)
    if (totals.total_spend > 0 && totals.booking_step_1 === 0) {
      console.log(`\n⚠️  WARNING: Has spend (${totals.total_spend.toFixed(2)} PLN) but booking_step_1 is 0`);
      console.log(`   This might indicate the all_conversions fix isn't working or no conversions exist.`);
    } else if (totals.total_spend > 0 && totals.booking_step_1 > 0) {
      console.log(`\n✅ GOOD: Has spend and booking steps - fix is working!`);
    }

    return totals;
  } catch (error) {
    console.error(`❌ Error testing ${periodName}:`, error);
    return null;
  }
}

async function main() {
  console.log('🚀 Testing January 2026: Current Month & Week');
  console.log(`📅 Today: ${new Date().toISOString().split('T')[0]}`);
  console.log(`📅 Month: ${JANUARY_START} to ${JANUARY_END}`);
  console.log(`📅 Week: ${WEEK_START} to ${WEEK_END}`);
  console.log(`✅ Using corrected all_conversions metric\n`);

  // Get Havet client
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('*')
    .ilike('name', '%havet%')
    .limit(1);

  if (clientsError || !clients || clients.length === 0) {
    console.error('❌ Failed to find Havet client:', clientsError);
    process.exit(1);
  }

  const client = clients[0];
  console.log(`✅ Found client: ${client.name} (${client.google_ads_customer_id})\n`);

  // Get Google Ads settings
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

  const { data: clientSettings } = await supabase
    .from('client_settings')
    .select('google_ads_refresh_token')
    .eq('client_id', client.id)
    .single();

  const refreshToken = clientSettings?.google_ads_refresh_token || settings.google_ads_manager_refresh_token;

  if (!refreshToken) {
    console.error('❌ No refresh token available');
    process.exit(1);
  }

  const googleAdsCredentials = {
    refreshToken,
    clientId: settings.google_ads_client_id || '',
    clientSecret: settings.google_ads_client_secret || '',
    developmentToken: settings.google_ads_developer_token || '',
    customerId: client.google_ads_customer_id,
    managerCustomerId: settings.google_ads_manager_customer_id || '',
  };

  const googleAdsService = new GoogleAdsAPIService(googleAdsCredentials);

  // Test monthly data
  const monthlyResults = await testPeriod('JANUARY 2026 (MONTH)', JANUARY_START, JANUARY_END, client, googleAdsService);

  // Test weekly data
  const weeklyResults = await testPeriod('CURRENT WEEK (Jan 6-12)', WEEK_START, WEEK_END, client, googleAdsService);

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));

  if (monthlyResults) {
    console.log(`\n✅ Monthly Data: Working`);
    console.log(`   Step 1: ${monthlyResults.booking_step_1.toLocaleString()}`);
    console.log(`   Step 2: ${monthlyResults.booking_step_2.toLocaleString()}`);
    console.log(`   Step 3: ${monthlyResults.booking_step_3.toLocaleString()}`);
  } else {
    console.log(`\n❌ Monthly Data: Failed or no data`);
  }

  if (weeklyResults) {
    console.log(`\n✅ Weekly Data: Working`);
    console.log(`   Step 1: ${weeklyResults.booking_step_1.toLocaleString()}`);
    console.log(`   Step 2: ${weeklyResults.booking_step_2.toLocaleString()}`);
    console.log(`   Step 3: ${weeklyResults.booking_step_3.toLocaleString()}`);
  } else {
    console.log(`\n❌ Weekly Data: Failed or no data`);
  }

  console.log('\n💡 Compare these numbers with Google Ads Console to verify accuracy!');
  console.log('   The numbers should match "Wszystkie konwersje" (All conversions) in console.');
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

