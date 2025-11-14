#!/usr/bin/env tsx

/**
 * BACKFILL ALL MISSING MONTHS FOR BELMONTE
 * 
 * Collects data for all months that are missing or have zero spend
 */

import { createClient } from '@supabase/supabase-js';
import { GoogleAdsAPIService } from '../src/lib/google-ads-api.js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Months to collect (year, month)
const MONTHS_TO_COLLECT = [
  { year: 2024, month: 12, name: 'December 2024' },
  { year: 2025, month: 1, name: 'January 2025' },
  { year: 2025, month: 2, name: 'February 2025' },
  { year: 2025, month: 3, name: 'March 2025' },
  { year: 2025, month: 6, name: 'June 2025' },
  { year: 2025, month: 7, name: 'July 2025' },
];

async function collectMonth(client: any, googleAdsService: any, year: number, month: number, monthName: string) {
  const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay}`;

  console.log(`\n📅 ${monthName}: ${startDate} to ${endDate}`);
  console.log('─────────────────────────────────────────');

  try {
    const campaigns = await googleAdsService.getCampaignData(startDate, endDate);

    if (campaigns.length === 0) {
      console.log('⚠️  No campaigns found for this period');
      return { success: true, hasData: false, spend: 0 };
    }

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
      impressions: 0, clicks: 0, spend: 0, conversions: 0,
      click_to_call: 0, email_contacts: 0, booking_step_1: 0,
      booking_step_2: 0, booking_step_3: 0, reservations: 0, reservation_value: 0
    });

    const spend = totals.spend;
    const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
    const cpc = totals.clicks > 0 ? spend / totals.clicks : 0;
    const cpa = totals.conversions > 0 ? spend / totals.conversions : 0;
    const roas = spend > 0 ? totals.reservation_value / spend : 0;
    const costPerReservation = totals.reservations > 0 ? spend / totals.reservations : 0;

    console.log(`   Campaigns: ${campaigns.length}`);
    console.log(`   Spend: ${spend.toFixed(2)} PLN`);
    console.log(`   Impressions: ${totals.impressions.toLocaleString()}`);
    console.log(`   Clicks: ${totals.clicks}`);
    console.log(`   Conversions: ${totals.conversions.toFixed(0)}`);

    if (spend === 0) {
      console.log('⚠️  No spend in this period (campaigns were paused or inactive)');
    }

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
      return { success: false, hasData: true, spend, error: insertError };
    }

    console.log('✅ Stored in database');
    return { success: true, hasData: true, spend };

  } catch (error) {
    console.error('❌ Error:', error);
    return { success: false, hasData: false, spend: 0, error };
  }
}

async function backfillAllMonths() {
  console.log('🔄 BACKFILLING ALL MISSING MONTHS FOR BELMONTE');
  console.log('═══════════════════════════════════════════════════\n');

  try {
    // Get Belmonte client
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .or('name.ilike.%belmonte%,email.ilike.%belmonte%')
      .single();

    if (clientError || !client) {
      console.error('❌ Belmonte client not found');
      process.exit(1);
    }

    console.log(`✅ Client: ${client.name}`);
    console.log(`   Client ID: ${client.id}\n`);

    // Get credentials
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

    const googleAdsService = new GoogleAdsAPIService({
      refreshToken: creds.google_ads_manager_refresh_token!,
      clientId: creds.google_ads_client_id!,
      clientSecret: creds.google_ads_client_secret!,
      developmentToken: creds.google_ads_developer_token!,
      customerId: client.google_ads_customer_id,
    });

    console.log('✅ Google Ads API initialized\n');
    console.log(`📋 Collecting ${MONTHS_TO_COLLECT.length} months...\n`);
    console.log('═══════════════════════════════════════════════════');

    const results = [];

    for (const monthData of MONTHS_TO_COLLECT) {
      const result = await collectMonth(
        client,
        googleAdsService,
        monthData.year,
        monthData.month,
        monthData.name
      );
      
      results.push({
        ...monthData,
        ...result
      });

      // Add delay between months to avoid rate limiting
      if (MONTHS_TO_COLLECT.indexOf(monthData) < MONTHS_TO_COLLECT.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Summary
    console.log('\n\n═══════════════════════════════════════════════════');
    console.log('📊 BACKFILL SUMMARY');
    console.log('═══════════════════════════════════════════════════\n');

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const withData = results.filter(r => r.hasData && r.spend > 0);
    const zeroSpend = results.filter(r => r.hasData && r.spend === 0);

    console.log(`✅ Successfully collected: ${successful.length}/${results.length}`);
    console.log(`   - With spend: ${withData.length}`);
    console.log(`   - Zero spend: ${zeroSpend.length}`);
    console.log(`❌ Failed: ${failed.length}`);

    if (withData.length > 0) {
      console.log('\n💰 MONTHS WITH SPEND:');
      withData.forEach(r => {
        console.log(`   ${r.name}: ${r.spend.toFixed(2)} PLN`);
      });
    }

    if (zeroSpend.length > 0) {
      console.log('\n⚠️  MONTHS WITH ZERO SPEND (campaigns were inactive):');
      zeroSpend.forEach(r => {
        console.log(`   ${r.name}`);
      });
    }

    if (failed.length > 0) {
      console.log('\n❌ FAILED MONTHS:');
      failed.forEach(r => {
        console.log(`   ${r.name}`);
      });
    }

    const totalSpend = withData.reduce((sum, r) => sum + r.spend, 0);
    console.log(`\n💰 Total spend collected: ${totalSpend.toFixed(2)} PLN`);

    console.log('\n═══════════════════════════════════════════════════');
    console.log('✅ BACKFILL COMPLETE!');
    console.log('═══════════════════════════════════════════════════');
    console.log('\n💡 Refresh your dashboard to see all historical data!\n');

  } catch (error) {
    console.error('❌ Error during backfill:', error);
    process.exit(1);
  }
}

backfillAllMonths();



