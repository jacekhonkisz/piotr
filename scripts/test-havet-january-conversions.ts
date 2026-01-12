#!/usr/bin/env node
/**
 * TEST LIVE FETCH: Havet January 2026 Conversions
 * 
 * This script fetches January 2026 data from Google Ads API for Havet
 * and shows the conversions value to verify what the API returns.
 * 
 * Usage: npx tsx scripts/test-havet-january-conversions.ts
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

const JANUARY_START = '2026-01-01';
const JANUARY_END = '2026-01-31';

async function main() {
  console.log('🔍 Testing Live Fetch: Havet January 2026 Conversions\n');
  console.log(`📅 Date range: ${JANUARY_START} to ${JANUARY_END}\n`);

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

  // Get client-specific refresh token (if exists) or use manager token
  const { data: clientSettings } = await supabase
    .from('client_settings')
    .select('google_ads_refresh_token')
    .eq('client_id', client.id)
    .single();

  const refreshToken = clientSettings?.google_ads_refresh_token || settings.google_ads_manager_refresh_token;

  if (!refreshToken) {
    console.error('❌ No refresh token available for Havet');
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

  console.log('🔄 Fetching data from Google Ads API...\n');

  try {
    // Initialize Google Ads API service
    const googleAdsService = new GoogleAdsAPIService(googleAdsCredentials);

    // Fetch campaign data for January 2026
    const campaigns = await googleAdsService.getCampaignData(JANUARY_START, JANUARY_END);

    if (!campaigns || campaigns.length === 0) {
      console.log('⚠️  No campaigns found for January 2026');
      process.exit(0);
    }

    console.log(`✅ Fetched ${campaigns.length} campaigns from Google Ads API\n`);

    // Aggregate all metrics including conversions
    const totals = campaigns.reduce((acc, campaign: any) => {
      acc.total_spend += campaign.spend || 0;
      acc.total_impressions += campaign.impressions || 0;
      acc.total_clicks += campaign.clicks || 0;
      acc.total_conversions += campaign.conversions || 0; // This is the conversions field
      acc.booking_step_1 += campaign.booking_step_1 || 0;
      acc.booking_step_2 += campaign.booking_step_2 || 0;
      acc.booking_step_3 += campaign.booking_step_3 || 0;
      acc.reservations += campaign.reservations || 0; // This is ilość rezerwacji
      acc.reservation_value += campaign.reservation_value || 0;
      return acc;
    }, {
      total_spend: 0,
      total_impressions: 0,
      total_clicks: 0,
      total_conversions: 0,
      booking_step_1: 0,
      booking_step_2: 0,
      booking_step_3: 0,
      reservations: 0,
      reservation_value: 0
    });

    // Round values
    totals.total_conversions = Math.round(totals.total_conversions);
    totals.booking_step_1 = Math.round(totals.booking_step_1);
    totals.booking_step_2 = Math.round(totals.booking_step_2);
    totals.booking_step_3 = Math.round(totals.booking_step_3);
    totals.reservations = Math.round(totals.reservations);

    console.log('='.repeat(70));
    console.log('📊 JANUARY 2026 CONVERSIONS (LIVE API FETCH)');
    console.log('='.repeat(70));
    console.log(`Client: ${client.name}`);
    console.log(`Date Range: ${JANUARY_START} to ${JANUARY_END}`);
    console.log(`Campaigns: ${campaigns.length}`);
    console.log('');
    console.log('Core Metrics:');
    console.log(`  Total Spend: ${totals.total_spend.toFixed(2)} PLN`);
    console.log(`  Total Impressions: ${totals.total_impressions.toLocaleString()}`);
    console.log(`  Total Clicks: ${totals.total_clicks.toLocaleString()}`);
    console.log('');
    console.log('🎯 CONVERSIONS (from API - metrics.conversions):');
    console.log(`  Total Conversions: ${totals.total_conversions.toLocaleString()}`);
    console.log('');
    console.log('📋 RESERVATIONS (ilość rezerwacji):');
    console.log(`  Reservations: ${totals.reservations.toLocaleString()}`);
    console.log(`  Reservation Value: ${totals.reservation_value.toFixed(2)} PLN`);
    console.log('');
    console.log('Booking Steps:');
    console.log(`  Booking Step 1: ${totals.booking_step_1.toLocaleString()}`);
    console.log(`  Booking Step 2: ${totals.booking_step_2.toLocaleString()}`);
    console.log(`  Booking Step 3: ${totals.booking_step_3.toLocaleString()}`);
    console.log('='.repeat(70));
    console.log('');

    // Show detailed breakdown for top campaigns
    const topCampaigns = campaigns
      .sort((a: any, b: any) => (b.conversions || 0) - (a.conversions || 0))
      .slice(0, 10);

    if (topCampaigns.length > 0) {
      console.log('📋 Top 10 Campaigns by Conversions:');
      console.log('-'.repeat(70));
      topCampaigns.forEach((campaign: any, index: number) => {
        console.log(`${index + 1}. ${campaign.campaignName}`);
        console.log(`   Spend: ${(campaign.spend || 0).toFixed(2)} PLN`);
        console.log(`   Clicks: ${(campaign.clicks || 0).toLocaleString()}`);
        console.log(`   Conversions: ${Math.round(campaign.conversions || 0).toLocaleString()}`);
        console.log(`   Reservations: ${Math.round(campaign.reservations || 0).toLocaleString()}`);
        console.log('');
      });
    }

    // Compare with database
    console.log('='.repeat(70));
    console.log('📊 COMPARISON: Live API vs Database');
    console.log('='.repeat(70));

    const { data: dbSummary } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', client.id)
      .eq('summary_date', '2026-01-01')
      .eq('platform', 'google')
      .eq('summary_type', 'monthly')
      .single();

    if (dbSummary) {
      console.log('\nDatabase (campaign_summaries):');
      console.log(`  Total Conversions: ${Math.round(dbSummary.total_conversions || 0).toLocaleString()}`);
      console.log(`  Reservations: ${Math.round(dbSummary.reservations || 0).toLocaleString()}`);
      console.log(`  Data Source: ${dbSummary.data_source || 'unknown'}`);
      console.log(`  Last Updated: ${dbSummary.last_updated || 'unknown'}`);
      console.log('');

      // Compare
      const conversionsMatch = totals.total_conversions === Math.round(dbSummary.total_conversions || 0);
      const reservationsMatch = totals.reservations === Math.round(dbSummary.reservations || 0);

      console.log('Comparison:');
      console.log(`  Conversions: ${conversionsMatch ? '✅ MATCH' : '❌ MISMATCH'}`);
      console.log(`    API: ${totals.total_conversions.toLocaleString()}`);
      console.log(`    DB:  ${Math.round(dbSummary.total_conversions || 0).toLocaleString()}`);
      console.log(`  Reservations: ${reservationsMatch ? '✅ MATCH' : '❌ MISMATCH'}`);
      console.log(`    API: ${totals.reservations.toLocaleString()}`);
      console.log(`    DB:  ${Math.round(dbSummary.reservations || 0).toLocaleString()}`);

      if (conversionsMatch && reservationsMatch) {
        console.log('\n✅ ALL VALUES MATCH - System is working correctly!');
      } else {
        console.log('\n⚠️  MISMATCH DETECTED - Database may need update');
      }
    } else {
      console.log('\n⚠️  No database record found for January 2026');
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ Test complete!');
    console.log('');
    console.log('📝 Summary:');
    console.log(`   - Conversions (metrics.conversions): ${totals.total_conversions.toLocaleString()}`);
    console.log(`   - Reservations (ilość rezerwacji): ${totals.reservations.toLocaleString()}`);
    console.log('='.repeat(70));

  } catch (error) {
    console.error('❌ Error fetching data:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

