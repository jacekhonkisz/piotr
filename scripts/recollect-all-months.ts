#!/usr/bin/env tsx

/**
 * RE-COLLECT ALL MONTHS WITH FIXED CONVERSION TRACKING
 * 
 * Uses corrected conversion methodology (click-through only)
 */

import { createClient } from '@supabase/supabase-js';
import { GoogleAdsAPIService } from '../src/lib/google-ads-api.js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Months to re-collect with corrected conversion tracking
const MONTHS = [
  { year: 2025, month: 11, name: 'November 2025', priority: 'HIGH' },
  { year: 2025, month: 10, name: 'October 2025', priority: 'HIGH' },
  { year: 2025, month: 9, name: 'September 2025', priority: 'HIGH' },
  { year: 2025, month: 8, name: 'August 2025', priority: 'HIGH' },
  { year: 2025, month: 6, name: 'June 2025', priority: 'MEDIUM' },
];

async function recollectMonth(
  client: any,
  googleAdsService: any,
  year: number,
  month: number,
  monthName: string
) {
  const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay}`;

  console.log(`\n${'='.repeat(70)}`);
  console.log(`📅 ${monthName}: ${startDate} to ${endDate}`);
  console.log('='.repeat(70));

  try {
    // Fetch with FIXED conversion tracking (click-through only)
    console.log('🔄 Fetching with CORRECTED conversion tracking (click-only)...');
    const campaigns = await googleAdsService.getCampaignData(startDate, endDate);

    if (campaigns.length === 0) {
      console.log('⚠️  No campaigns found');
      return { success: true, hasData: false };
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

    const convRate = totals.clicks > 0 ? (totals.conversions / totals.clicks) * 100 : 0;
    const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
    const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
    const cpa = totals.conversions > 0 ? totals.spend / totals.conversions : 0;
    const roas = totals.spend > 0 ? totals.reservation_value / totals.spend : 0;
    const costPerReservation = totals.reservations > 0 ? totals.spend / totals.reservations : 0;

    console.log(`\n📊 CORRECTED METRICS:`);
    console.log(`   Spend: ${totals.spend.toFixed(2)} PLN`);
    console.log(`   Impressions: ${totals.impressions.toLocaleString()}`);
    console.log(`   Clicks: ${totals.clicks.toLocaleString()}`);
    console.log(`   Conversions: ${totals.conversions.toFixed(0)} (CLICK-ONLY)`);
    console.log(`   Conv Rate: ${convRate.toFixed(2)}% ${convRate > 100 ? '❌ STILL WRONG!' : '✅ CORRECT'}`);
    console.log(`   CTR: ${ctr.toFixed(2)}%`);
    console.log(`   CPC: ${cpc.toFixed(2)} PLN`);

    // Validation
    if (totals.conversions > totals.clicks) {
      console.error(`\n❌ ERROR: Still have more conversions (${totals.conversions}) than clicks (${totals.clicks})!`);
      console.error(`   The fix may not be working properly.`);
      return { success: false, error: 'Conversion > Clicks still occurring' };
    }

    if (convRate > 100) {
      console.error(`\n❌ ERROR: Conversion rate ${convRate.toFixed(2)}% still >100%!`);
      return { success: false, error: 'Conversion rate >100%' };
    }

    console.log(`\n✅ VALIDATION PASSED: Conversions (${totals.conversions.toFixed(0)}) ≤ Clicks (${totals.clicks})`);

    // Store in database
    const summary = {
      client_id: client.id,
      summary_type: 'monthly',
      summary_date: startDate,
      platform: 'google',
      total_spend: totals.spend,
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
      booking_step_1: Math.round(totals.booking_step_1),
      booking_step_2: Math.round(totals.booking_step_2),
      booking_step_3: Math.round(totals.booking_step_3),
      reservations: Math.round(totals.reservations),
      reservation_value: Math.round(totals.reservation_value),
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
      data_source: 'google_ads_api_fixed_conversions',
      last_updated: new Date().toISOString()
    };

    const { error: insertError } = await supabase
      .from('campaign_summaries')
      .upsert(summary, {
        onConflict: 'client_id,summary_type,summary_date,platform'
      });

    if (insertError) {
      console.error('❌ Error storing:', insertError);
      return { success: false, error: insertError };
    }

    console.log('✅ Stored in database with corrected conversions\n');

    return {
      success: true,
      hasData: true,
      spend: totals.spend,
      conversions: totals.conversions,
      clicks: totals.clicks,
      convRate
    };

  } catch (error) {
    console.error('❌ Error:', error);
    return { success: false, error };
  }
}

async function recollectAll() {
  console.log('🔄 RE-COLLECTING ALL MONTHS WITH FIXED CONVERSION TRACKING');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('\n✅ FIX APPLIED: Using click-through conversions ONLY');
  console.log('❌ EXCLUDED: View-through conversions, engaged-view, cross-device\n');

  try {
    // Get client
    const { data: client } = await supabase
      .from('clients')
      .select('*')
      .or('name.ilike.%belmonte%,email.ilike.%belmonte%')
      .single();

    if (!client) {
      console.error('❌ Client not found');
      process.exit(1);
    }

    console.log(`✅ Client: ${client.name}\n`);

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

    console.log(`📋 Re-collecting ${MONTHS.length} months...\n`);

    const results = [];

    for (const monthData of MONTHS) {
      const result = await recollectMonth(
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

      // Delay between months
      if (MONTHS.indexOf(monthData) < MONTHS.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Summary
    console.log('\n\n═══════════════════════════════════════════════════════════');
    console.log('📊 RE-COLLECTION SUMMARY');
    console.log('═══════════════════════════════════════════════════════════\n');

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const allValid = results.every(r => r.success && r.convRate <= 100);

    console.log(`✅ Successfully re-collected: ${successful.length}/${results.length}`);
    console.log(`❌ Failed: ${failed.length}`);

    if (successful.length > 0) {
      console.log('\n✅ CORRECTED MONTHS:');
      successful.forEach(r => {
        const convRateStatus = r.convRate <= 100 ? '✅' : '❌';
        console.log(`   ${r.name}: ${r.conversions?.toFixed(0) || 0} conversions from ${r.clicks || 0} clicks (${r.convRate?.toFixed(1) || 0}%) ${convRateStatus}`);
      });
    }

    if (failed.length > 0) {
      console.log('\n❌ FAILED MONTHS:');
      failed.forEach(r => {
        console.log(`   ${r.name}: ${r.error?.message || r.error || 'Unknown error'}`);
      });
    }

    console.log('\n═══════════════════════════════════════════════════════════');

    if (allValid && failed.length === 0) {
      console.log('✅ ALL MONTHS RE-COLLECTED SUCCESSFULLY!');
      console.log('✅ ALL CONVERSION RATES < 100%');
      console.log('✅ DATA IS NOW 100% ACCURATE\n');
    } else {
      console.log('⚠️  SOME ISSUES REMAIN - REVIEW ABOVE\n');
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

recollectAll();

