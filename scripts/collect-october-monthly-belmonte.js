#!/usr/bin/env tsx

/**
 * COLLECT OCTOBER 2025 MONTHLY DATA FOR BELMONTE
 * 
 * This script collects data from Oct 1-31 as ONE monthly record
 * (Not aggregating weekly data - that's a separate system)
 * 
 * USAGE: npx tsx scripts/collect-october-monthly-belmonte.js
 */

import { createClient } from '@supabase/supabase-js';
import { GoogleAdsApi } from 'google-ads-api';
import { GoogleAdsAPIService } from '../src/lib/google-ads-api.js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function collectOctoberMonthlyData() {
  console.log('🗓️  COLLECTING OCTOBER 2025 MONTHLY DATA');
  console.log('═══════════════════════════════════════════════════\n');

  try {
    // Step 1: Get Belmonte client
    console.log('📋 Step 1: Finding Belmonte client...');
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .or('name.ilike.%belmonte%,email.ilike.%belmonte%')
      .single();

    if (clientError || !client) {
      console.error('❌ Belmonte client not found');
      process.exit(1);
    }

    console.log(`✅ Found: ${client.name}`);
    console.log(`   Client ID: ${client.id}`);
    console.log(`   Google Ads Customer ID: ${client.google_ads_customer_id}\n`);

    // Step 2: Get Google Ads credentials
    console.log('📋 Step 2: Getting Google Ads credentials...');
    const { data: settings, error: settingsError } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', [
        'google_ads_client_id',
        'google_ads_client_secret',
        'google_ads_developer_token',
        'google_ads_manager_refresh_token'
      ]);

    if (settingsError) throw settingsError;

    const creds: Record<string, string> = {};
    settings?.forEach(s => {
      creds[s.key] = s.value;
    });

    console.log('✅ All credentials found\n');

    // Step 3: Initialize Google Ads API
    console.log('📋 Step 3: Initializing Google Ads API...');
    const googleAdsClient = new GoogleAdsApi({
      client_id: creds.google_ads_client_id,
      client_secret: creds.google_ads_client_secret,
      developer_token: creds.google_ads_developer_token
    });

    const customer = googleAdsClient.Customer({
      customer_id: client.google_ads_customer_id.replace(/-/g, ''),
      refresh_token: creds.google_ads_manager_refresh_token
    });

    console.log('✅ Google Ads API initialized\n');

    // Step 4: Fetch October data (FULL MONTH: Oct 1-31) WITH ALL CONVERSION METRICS
    const startDate = '2025-10-01';
    const endDate = '2025-10-31';

    console.log('📋 Step 4: Fetching October 2025 data from Google Ads API...');
    console.log(`   Period: ${startDate} to ${endDate} (FULL MONTH)\n`);
    console.log('🔧 Using PRODUCTION-READY GoogleAdsAPIService for all metrics\n');

    // ✅ USE PRODUCTION GoogleAdsAPIService - Gets ALL metrics including conversions
    const googleAdsService = new GoogleAdsAPIService({
      refreshToken: creds.google_ads_manager_refresh_token!,
      clientId: creds.google_ads_client_id!,
      clientSecret: creds.google_ads_client_secret!,
      developmentToken: creds.google_ads_developer_token!,
      customerId: client.google_ads_customer_id,
    });

    // This method fetches ALL metrics including conversion breakdown
    const campaigns = await googleAdsService.getCampaignData(startDate, endDate);

    console.log(`✅ Retrieved ${campaigns.length} campaigns with full conversion data\n`);

    // Step 5: Calculate totals FROM FULL CAMPAIGN DATA
    console.log('📋 Step 5: Calculating totals with ALL conversion metrics...');

    const totals = campaigns.reduce((acc, campaign) => {
      acc.impressions += parseInt(campaign.impressions || 0);
      acc.clicks += parseInt(campaign.clicks || 0);
      acc.spend += parseFloat(campaign.spend || 0);
      acc.conversions += parseFloat(campaign.conversions || 0);
      // ✅ CONVERSION FUNNEL METRICS
      acc.click_to_call += parseInt(campaign.click_to_call || 0);
      acc.email_contacts += parseInt(campaign.email_contacts || 0);
      acc.booking_step_1 += parseInt(campaign.booking_step_1 || 0);
      acc.booking_step_2 += parseInt(campaign.booking_step_2 || 0);
      acc.booking_step_3 += parseInt(campaign.booking_step_3 || 0);
      acc.reservations += parseInt(campaign.reservations || 0);
      acc.reservation_value += parseFloat(campaign.reservation_value || 0);
      return acc;
    }, {
      impressions: 0,
      clicks: 0,
      spend: 0,
      conversions: 0,
      click_to_call: 0,
      email_contacts: 0,
      booking_step_1: 0,
      booking_step_2: 0,
      booking_step_3: 0,
      reservations: 0,
      reservation_value: 0
    });

    const spend = totals.spend;
    const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
    const cpc = totals.clicks > 0 ? spend / totals.clicks : 0;
    const cpa = totals.conversions > 0 ? spend / totals.conversions : 0;
    const roas = spend > 0 ? totals.reservation_value / spend : 0;
    const costPerReservation = totals.reservations > 0 ? spend / totals.reservations : 0;

    console.log('✅ Totals calculated (ALL METRICS):');
    console.log(`   Spend: ${spend.toFixed(2)} PLN`);
    console.log(`   Impressions: ${totals.impressions.toLocaleString()}`);
    console.log(`   Clicks: ${totals.clicks.toLocaleString()}`);
    console.log(`   Conversions: ${totals.conversions.toFixed(2)}`);
    console.log(`   CTR: ${ctr.toFixed(2)}%`);
    console.log(`   CPC: ${cpc.toFixed(2)} PLN`);
    console.log(`   CPA: ${cpa.toFixed(2)} PLN`);
    console.log(`\n🎯 CONVERSION FUNNEL:`);
    console.log(`   Click to Call: ${totals.click_to_call}`);
    console.log(`   Email Contacts: ${totals.email_contacts}`);
    console.log(`   Booking Step 1: ${totals.booking_step_1}`);
    console.log(`   Booking Step 2: ${totals.booking_step_2}`);
    console.log(`   Booking Step 3: ${totals.booking_step_3}`);
    console.log(`   Reservations: ${totals.reservations}`);
    console.log(`   Reservation Value: ${totals.reservation_value.toFixed(2)} PLN`);
    console.log(`   ROAS: ${roas.toFixed(2)}`);
    console.log(`   Cost per Reservation: ${costPerReservation.toFixed(2)} PLN\n`);

    // Step 6: Store as MONTHLY summary
    console.log('📋 Step 6: Storing as MONTHLY summary...');
    console.log('   ⚠️  Important: summary_type = "monthly" (NOT weekly)\n');

    const summary = {
      client_id: client.id,
      summary_type: 'monthly',  // ✅ MONTHLY (not weekly)
      summary_date: startDate,  // ✅ First day of month
      platform: 'google',
      total_spend: spend,
      total_impressions: totals.impressions,
      total_clicks: totals.clicks,
      total_conversions: totals.conversions,
      average_ctr: ctr,
      average_cpc: cpc,
      average_cpa: cpa,
      roas: roas,
      cost_per_reservation: costPerReservation,
      // ✅ CONVERSION FUNNEL METRICS
      click_to_call: totals.click_to_call,
      email_contacts: totals.email_contacts,
      booking_step_1: totals.booking_step_1,
      booking_step_2: totals.booking_step_2,
      booking_step_3: totals.booking_step_3,
      reservations: totals.reservations,
      reservation_value: totals.reservation_value,
      active_campaigns: campaigns.filter(c => c.status === 'ENABLED').length,
      total_campaigns: campaigns.length,
      campaign_data: campaigns.map(c => ({
        id: c.campaignId,
        name: c.campaignName,
        status: c.status,
        impressions: c.impressions,
        clicks: c.clicks,
        spend: c.spend,
        conversions: c.conversions,
        // ✅ Include conversion funnel for each campaign
        click_to_call: c.click_to_call,
        email_contacts: c.email_contacts,
        booking_step_1: c.booking_step_1,
        booking_step_2: c.booking_step_2,
        booking_step_3: c.booking_step_3,
        reservations: c.reservations,
        reservation_value: c.reservation_value
      })),
      data_source: 'google_ads_api',
      last_updated: new Date().toISOString()
    };

    const { error: insertError } = await supabase
      .from('campaign_summaries')
      .upsert(summary, {
        onConflict: 'client_id,summary_type,summary_date,platform'
      });

    if (insertError) {
      console.error('❌ Failed to store monthly summary:', insertError);
      throw insertError;
    }

    console.log('✅ Monthly summary stored successfully!\n');

    // Step 7: Verify
    console.log('📋 Step 7: Verifying stored data...');

    const { data: verified, error: verifyError } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', client.id)
      .eq('summary_type', 'monthly')
      .eq('summary_date', startDate)
      .eq('platform', 'google')
      .single();

    if (verifyError || !verified) {
      console.error('❌ Verification failed');
      throw verifyError;
    }

    console.log('✅ Verification successful:');
    console.log(`   Summary Type: ${verified.summary_type}`);
    console.log(`   Summary Date: ${verified.summary_date}`);
    console.log(`   Platform: ${verified.platform}`);
    console.log(`   Total Spend: ${verified.total_spend} PLN`);
    console.log(`   Total Impressions: ${verified.total_impressions}`);
    console.log(`   Total Clicks: ${verified.total_clicks}`);
    console.log(`   Campaigns: ${verified.total_campaigns}\n`);

    console.log('═══════════════════════════════════════════════════');
    console.log('🎉 SUCCESS! October 2025 monthly data collected');
    console.log('═══════════════════════════════════════════════════\n');
    console.log('📊 Summary:');
    console.log(`   Period: October 1-31, 2025 (FULL MONTH)`);
    console.log(`   Type: summary_type='monthly'`);
    console.log(`   Date: summary_date='2025-10-01'`);
    console.log(`   Total: ${spend.toFixed(2)} PLN`);
    console.log(`   Campaigns: ${campaigns.length}`);
    console.log('\n✅ Dashboard should now show correct October data!\n');

  } catch (error) {
    console.error('\n❌ Error collecting October data:', error);
    if (error.errors) {
      error.errors.forEach(err => {
        console.error(`   Error: ${err.message}`);
      });
    }
    process.exit(1);
  }
}

// Run the collection
collectOctoberMonthlyData().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

