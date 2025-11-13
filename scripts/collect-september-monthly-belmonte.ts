#!/usr/bin/env tsx

/**
 * COLLECT SEPTEMBER 2025 MONTHLY DATA FOR BELMONTE
 * 
 * This script collects data from Sept 1-30 as ONE monthly record
 * Using production GoogleAdsAPIService with ALL conversion metrics
 */

import { createClient } from '@supabase/supabase-js';
import { GoogleAdsAPIService } from '../src/lib/google-ads-api.js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function collectSeptemberMonthlyData() {
  console.log('🗓️  COLLECTING SEPTEMBER 2025 MONTHLY DATA');
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
    console.log(`   Client ID: ${client.id}\n`);

    // Step 2: Get credentials
    console.log('📋 Step 2: Getting Google Ads credentials...');
    const { data: settings } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', [
        'google_ads_client_id',
        'google_ads_client_secret',
        'google_ads_developer_token',
        'google_ads_manager_refresh_token'
      ]);

    const creds: Record<string, string> = {};
    settings?.forEach(s => {
      creds[s.key] = s.value;
    });

    console.log('✅ All credentials found\n');

    // Step 3: Fetch September data with GoogleAdsAPIService
    const startDate = '2025-09-01';
    const endDate = '2025-09-30';

    console.log('📋 Step 3: Fetching September 2025 data...');
    console.log(`   Period: ${startDate} to ${endDate} (FULL MONTH)\n`);

    const googleAdsService = new GoogleAdsAPIService({
      refreshToken: creds.google_ads_manager_refresh_token!,
      clientId: creds.google_ads_client_id!,
      clientSecret: creds.google_ads_client_secret!,
      developmentToken: creds.google_ads_developer_token!,
      customerId: client.google_ads_customer_id,
    });

    const campaigns = await googleAdsService.getCampaignData(startDate, endDate);

    console.log(`✅ Retrieved ${campaigns.length} campaigns with full conversion data\n`);

    // Step 4: Calculate totals
    console.log('📋 Step 4: Calculating totals with ALL conversion metrics...');

    const totals = campaigns.reduce((acc: any, campaign: any) => {
      acc.impressions += parseInt(campaign.impressions || 0);
      acc.clicks += parseInt(campaign.clicks || 0);
      acc.spend += parseFloat(campaign.spend || 0);
      acc.conversions += parseFloat(campaign.conversions || 0);
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

    // Step 5: Store as MONTHLY summary
    console.log('📋 Step 5: Storing as MONTHLY summary...');

    const summary = {
      client_id: client.id,
      summary_type: 'monthly',
      summary_date: startDate,
      platform: 'google',
      total_spend: spend,
      total_impressions: totals.impressions,
      total_clicks: totals.clicks,
      total_conversions: Math.round(totals.conversions),
      average_ctr: ctr,
      average_cpc: cpc,
      average_cpa: cpa,
      roas: roas,
      cost_per_reservation: costPerReservation,
      click_to_call: totals.click_to_call,
      email_contacts: totals.email_contacts,
      booking_step_1: totals.booking_step_1,
      booking_step_2: totals.booking_step_2,
      booking_step_3: totals.booking_step_3,
      reservations: totals.reservations,
      reservation_value: totals.reservation_value,
      active_campaigns: campaigns.filter((c: any) => c.status === 'ENABLED').length,
      total_campaigns: campaigns.length,
      campaign_data: campaigns.map((c: any) => ({
        id: c.campaignId,
        name: c.campaignName,
        status: c.status,
        impressions: c.impressions,
        clicks: c.clicks,
        spend: c.spend,
        conversions: c.conversions,
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
      console.error('❌ Error storing summary:', insertError);
      throw insertError;
    }

    console.log('✅ Stored in campaign_summaries table\n');

    console.log('═══════════════════════════════════════════════════');
    console.log('✅ COLLECTION COMPLETE!');
    console.log('═══════════════════════════════════════════════════');
    console.log(`\n📊 BEFORE: Dashboard showed 814.34 PLN (1 week only)`);
    console.log(`📊 AFTER:  Dashboard will show ${spend.toFixed(2)} PLN (full month)\n`);
    console.log(`💡 Refresh your dashboard to see the updated September data!\n`);

  } catch (error) {
    console.error('❌ Error during collection:', error);
    process.exit(1);
  }
}

collectSeptemberMonthlyData();

