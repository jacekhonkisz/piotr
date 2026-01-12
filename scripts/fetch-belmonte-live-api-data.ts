#!/usr/bin/env node
/**
 * FETCH BELMONTE LIVE GOOGLE ADS API DATA
 * 
 * This script fetches live data from Google Ads API for Belmonte Hotel
 * for January 2026 and December 2025 to verify if the API is returning 0s
 * or if there's a data collection/storage issue.
 * 
 * Usage: npx tsx scripts/fetch-belmonte-live-api-data.ts
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

const BELMONTE_CLIENT_ID = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';
const JANUARY_2026_START = '2026-01-01';
const JANUARY_2026_END = '2026-01-31';
const DECEMBER_2025_START = '2025-12-01';
const DECEMBER_2025_END = '2025-12-31';

interface PeriodResults {
  period: string;
  startDate: string;
  endDate: string;
  totalCampaigns: number;
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalBookingStep1: number;
  totalBookingStep2: number;
  totalBookingStep3: number;
  totalReservations: number;
  totalReservationValue: number;
  totalConversions: number;
  campaignsWithFunnel: number;
  campaignsWithReservations: number;
  sampleCampaigns: Array<{
    name: string;
    spend: number;
    step1: number;
    step2: number;
    step3: number;
    reservations: number;
  }>;
}

async function getBelmonteClient() {
  console.log('🔍 Finding Belmonte Hotel client...\n');
  
  const { data: client, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', BELMONTE_CLIENT_ID)
    .single();
  
  if (error) {
    console.error('❌ Failed to find Belmonte client:', error);
    process.exit(1);
  }
  
  if (!client) {
    console.error('❌ Belmonte client not found');
    process.exit(1);
  }
  
  console.log('✅ Found Belmonte Hotel:');
  console.log(`   Name: ${client.name}`);
  console.log(`   Email: ${client.email}`);
  console.log(`   Google Ads Customer ID: ${client.google_ads_customer_id}`);
  console.log(`   Google Ads Enabled: ${client.google_ads_enabled}`);
  console.log('');
  
  return client;
}

async function getGoogleAdsCredentials(client: any) {
  console.log('🔑 Getting Google Ads credentials...\n');
  
  // Get system settings
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
    console.error('❌ No Google Ads refresh token available');
    process.exit(1);
  }

  const credentials = {
    refreshToken,
    clientId: settings.google_ads_client_id || '',
    clientSecret: settings.google_ads_client_secret || '',
    developmentToken: settings.google_ads_developer_token || '',
    customerId: client.google_ads_customer_id,
    managerCustomerId: settings.google_ads_manager_customer_id || '',
  };

  console.log('✅ Google Ads credentials retrieved');
  console.log(`   Customer ID: ${credentials.customerId}`);
  console.log(`   Manager Customer ID: ${credentials.managerCustomerId || 'N/A'}`);
  console.log('');

  return credentials;
}

async function fetchPeriodData(
  googleAdsService: GoogleAdsAPIService,
  periodName: string,
  startDate: string,
  endDate: string
): Promise<PeriodResults> {
  console.log(`\n📊 Fetching ${periodName} data from Google Ads API...`);
  console.log(`   Date range: ${startDate} to ${endDate}`);
  
  const campaigns = await googleAdsService.getCampaignData(startDate, endDate);
  
  if (!campaigns || campaigns.length === 0) {
    console.log(`   ⚠️  No campaigns found for ${periodName}`);
    return {
      period: periodName,
      startDate,
      endDate,
      totalCampaigns: 0,
      totalSpend: 0,
      totalImpressions: 0,
      totalClicks: 0,
      totalBookingStep1: 0,
      totalBookingStep2: 0,
      totalBookingStep3: 0,
      totalReservations: 0,
      totalReservationValue: 0,
      totalConversions: 0,
      campaignsWithFunnel: 0,
      campaignsWithReservations: 0,
      sampleCampaigns: []
    };
  }

  console.log(`   ✅ Fetched ${campaigns.length} campaigns`);

  // Aggregate totals
  const totals = campaigns.reduce((acc, campaign) => {
    acc.spend += campaign.spend || 0;
    acc.impressions += campaign.impressions || 0;
    acc.clicks += campaign.clicks || 0;
    acc.step1 += campaign.booking_step_1 || 0;
    acc.step2 += campaign.booking_step_2 || 0;
    acc.step3 += campaign.booking_step_3 || 0;
    acc.reservations += campaign.reservations || 0;
    acc.reservationValue += campaign.reservation_value || 0;
    acc.conversions += campaign.conversions || 0;
    
    if ((campaign.booking_step_1 || 0) > 0 || (campaign.booking_step_2 || 0) > 0 || (campaign.booking_step_3 || 0) > 0) {
      acc.campaignsWithFunnel++;
    }
    
    if ((campaign.reservations || 0) > 0) {
      acc.campaignsWithReservations++;
    }
    
    return acc;
  }, {
    spend: 0,
    impressions: 0,
    clicks: 0,
    step1: 0,
    step2: 0,
    step3: 0,
    reservations: 0,
    reservationValue: 0,
    conversions: 0,
    campaignsWithFunnel: 0,
    campaignsWithReservations: 0
  });

  // Get sample campaigns with funnel data
  const sampleCampaigns = campaigns
    .filter(c => (c.booking_step_1 || 0) > 0 || (c.reservations || 0) > 0)
    .slice(0, 5)
    .map(c => ({
      name: c.campaignName,
      spend: c.spend || 0,
      step1: c.booking_step_1 || 0,
      step2: c.booking_step_2 || 0,
      step3: c.booking_step_3 || 0,
      reservations: c.reservations || 0
    }));

  return {
    period: periodName,
    startDate,
    endDate,
    totalCampaigns: campaigns.length,
    totalSpend: totals.spend,
    totalImpressions: totals.impressions,
    totalClicks: totals.clicks,
    totalBookingStep1: totals.step1,
    totalBookingStep2: totals.step2,
    totalBookingStep3: totals.step3,
    totalReservations: totals.reservations,
    totalReservationValue: totals.reservationValue,
    totalConversions: totals.conversions,
    campaignsWithFunnel: totals.campaignsWithFunnel,
    campaignsWithReservations: totals.campaignsWithReservations,
    sampleCampaigns
  };
}

function printResults(results: PeriodResults) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 ${results.period.toUpperCase()} - LIVE API RESULTS`);
  console.log(`${'='.repeat(80)}`);
  console.log(`Date Range: ${results.startDate} to ${results.endDate}`);
  console.log(`Total Campaigns: ${results.totalCampaigns}`);
  console.log('');
  
  console.log('💰 SPEND & TRAFFIC:');
  console.log(`   Total Spend: ${results.totalSpend.toFixed(2)} PLN`);
  console.log(`   Total Impressions: ${results.totalImpressions.toLocaleString()}`);
  console.log(`   Total Clicks: ${results.totalClicks.toLocaleString()}`);
  console.log('');
  
  console.log('🎯 FUNNEL METRICS:');
  console.log(`   Booking Step 1: ${results.totalBookingStep1}`);
  console.log(`   Booking Step 2: ${results.totalBookingStep2}`);
  console.log(`   Booking Step 3: ${results.totalBookingStep3}`);
  console.log(`   Reservations: ${results.totalReservations}`);
  console.log(`   Reservation Value: ${results.totalReservationValue.toFixed(2)} PLN`);
  console.log(`   Total Conversions: ${results.totalConversions}`);
  console.log('');
  
  console.log('📈 FUNNEL COVERAGE:');
  console.log(`   Campaigns with Funnel Data: ${results.campaignsWithFunnel} / ${results.totalCampaigns}`);
  console.log(`   Campaigns with Reservations: ${results.campaignsWithReservations} / ${results.totalCampaigns}`);
  console.log('');
  
  if (results.sampleCampaigns.length > 0) {
    console.log('🔍 SAMPLE CAMPAIGNS WITH FUNNEL DATA:');
    results.sampleCampaigns.forEach((campaign, index) => {
      console.log(`   ${index + 1}. ${campaign.name}`);
      console.log(`      Spend: ${campaign.spend.toFixed(2)} PLN`);
      console.log(`      Step 1: ${campaign.step1}, Step 2: ${campaign.step2}, Step 3: ${campaign.step3}`);
      console.log(`      Reservations: ${campaign.reservations}`);
    });
    console.log('');
  } else {
    console.log('⚠️  NO CAMPAIGNS WITH FUNNEL DATA FOUND');
    console.log('');
  }
  
  // Summary
  const hasFunnelData = results.totalBookingStep1 > 0 || results.totalReservations > 0;
  const status = hasFunnelData ? '✅ HAS FUNNEL DATA' : '❌ NO FUNNEL DATA (ALL ZEROS)';
  console.log(`STATUS: ${status}`);
  console.log(`${'='.repeat(80)}\n`);
}

async function main() {
  console.log('🚀 Starting Belmonte Hotel Live API Data Fetch');
  console.log('='.repeat(80));
  console.log('');

  try {
    // Step 1: Get Belmonte client
    const client = await getBelmonteClient();

    // Step 2: Get Google Ads credentials
    const credentials = await getGoogleAdsCredentials(client);

    // Step 3: Initialize Google Ads API service
    const googleAdsService = new GoogleAdsAPIService(credentials);

    // Step 4: Validate credentials
    console.log('🔐 Validating Google Ads credentials...');
    const validation = await googleAdsService.validateCredentials();
    if (!validation.valid) {
      console.error(`❌ Credential validation failed: ${validation.error}`);
      process.exit(1);
    }
    console.log('✅ Credentials validated\n');

    // Step 5: Fetch December 2025 data
    const decemberResults = await fetchPeriodData(
      googleAdsService,
      'December 2025',
      DECEMBER_2025_START,
      DECEMBER_2025_END
    );

    // Step 6: Fetch January 2026 data
    const januaryResults = await fetchPeriodData(
      googleAdsService,
      'January 2026',
      JANUARY_2026_START,
      JANUARY_2026_END
    );

    // Step 7: Print results
    printResults(decemberResults);
    printResults(januaryResults);

    // Step 8: Comparison summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 COMPARISON SUMMARY');
    console.log('='.repeat(80));
    console.log('');
    console.log('December 2025:');
    console.log(`   Funnel Data: ${decemberResults.totalBookingStep1 > 0 || decemberResults.totalReservations > 0 ? '✅ YES' : '❌ NO (ALL ZEROS)'}`);
    console.log(`   Reservations: ${decemberResults.totalReservations}`);
    console.log('');
    console.log('January 2026:');
    console.log(`   Funnel Data: ${januaryResults.totalBookingStep1 > 0 || januaryResults.totalReservations > 0 ? '✅ YES' : '❌ NO (ALL ZEROS)'}`);
    console.log(`   Reservations: ${januaryResults.totalReservations}`);
    console.log('');
    console.log('='.repeat(80));
    console.log('');

    // Final conclusion
    if (decemberResults.totalBookingStep1 === 0 && decemberResults.totalReservations === 0 &&
        januaryResults.totalBookingStep1 === 0 && januaryResults.totalReservations === 0) {
      console.log('🔴 CONCLUSION: API is returning ZEROS for funnel metrics');
      console.log('   This suggests:');
      console.log('   1. Conversion tracking may not be set up in Google Ads');
      console.log('   2. Conversion actions may not be properly configured');
      console.log('   3. No conversions occurred during these periods');
      console.log('   4. Conversion labels may not match expected patterns');
    } else {
      console.log('✅ CONCLUSION: API IS returning funnel data');
      console.log('   If database shows zeros, the issue is in data collection/storage, not the API');
    }
    console.log('');

  } catch (error) {
    console.error('\n❌ Error fetching live API data:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack);
    }
    process.exit(1);
  }
}

main();

