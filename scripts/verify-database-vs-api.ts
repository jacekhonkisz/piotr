#!/usr/bin/env tsx

/**
 * VERIFY DATABASE VS GOOGLE ADS API
 * 
 * Fetches live data from Google Ads API and compares with database
 * to ensure they are IDENTICAL after re-collection
 */

import { createClient } from '@supabase/supabase-js';
import { GoogleAdsAPIService } from '../src/lib/google-ads-api.js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Months to verify
const MONTHS = [
  { year: 2025, month: 11, name: 'November 2025' },
  { year: 2025, month: 10, name: 'October 2025' },
  { year: 2025, month: 9, name: 'September 2025' },
  { year: 2025, month: 8, name: 'August 2025' },
  { year: 2025, month: 6, name: 'June 2025' },
];

interface ComparisonResult {
  month: string;
  metric: string;
  api: number;
  database: number;
  difference: number;
  percentDiff: number;
  match: boolean;
}

async function verifyMonth(
  client: any,
  googleAdsService: any,
  year: number,
  month: number,
  monthName: string
): Promise<{ results: ComparisonResult[], allMatch: boolean }> {
  const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay}`;

  console.log(`\n${'='.repeat(80)}`);
  console.log(`📅 VERIFYING: ${monthName} (${startDate} to ${endDate})`);
  console.log('='.repeat(80));

  try {
    // 1. Fetch from Google Ads API (LIVE)
    console.log('🔄 Fetching LIVE data from Google Ads API...');
    const campaigns = await googleAdsService.getCampaignData(startDate, endDate);

    const apiTotals = campaigns.reduce((acc: any, campaign: any) => ({
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

    console.log('✅ API Data fetched');

    // 2. Fetch from Database
    console.log('🔄 Fetching data from DATABASE...');
    const { data: dbData, error } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', client.id)
      .eq('summary_type', 'monthly')
      .eq('summary_date', startDate)
      .eq('platform', 'google')
      .single();

    if (error || !dbData) {
      console.error('❌ Error fetching from database:', error);
      return { results: [], allMatch: false };
    }

    console.log('✅ Database Data fetched');

    // 3. Compare ALL metrics
    const results: ComparisonResult[] = [];
    const tolerance = 0.01; // Allow 1 cent difference for floating point

    const metricsToCompare = [
      { name: 'Spend (PLN)', apiKey: 'spend', dbKey: 'total_spend' },
      { name: 'Impressions', apiKey: 'impressions', dbKey: 'total_impressions' },
      { name: 'Clicks', apiKey: 'clicks', dbKey: 'total_clicks' },
      { name: 'Conversions', apiKey: 'conversions', dbKey: 'total_conversions' },
      { name: 'Click to Call', apiKey: 'click_to_call', dbKey: 'click_to_call' },
      { name: 'Email Contacts', apiKey: 'email_contacts', dbKey: 'email_contacts' },
      { name: 'Booking Step 1', apiKey: 'booking_step_1', dbKey: 'booking_step_1' },
      { name: 'Booking Step 2', apiKey: 'booking_step_2', dbKey: 'booking_step_2' },
      { name: 'Booking Step 3', apiKey: 'booking_step_3', dbKey: 'booking_step_3' },
      { name: 'Reservations', apiKey: 'reservations', dbKey: 'reservations' },
      { name: 'Reservation Value', apiKey: 'reservation_value', dbKey: 'reservation_value' },
    ];

    console.log('\n📊 COMPARISON:\n');
    console.log('Metric'.padEnd(20) + 'API'.padStart(15) + 'Database'.padStart(15) + 'Diff'.padStart(15) + 'Status'.padStart(10));
    console.log('-'.repeat(75));

    let allMatch = true;

    for (const metric of metricsToCompare) {
      const apiValue = apiTotals[metric.apiKey] || 0;
      const dbValue = parseFloat(dbData[metric.dbKey] || 0);
      const diff = Math.abs(apiValue - dbValue);
      const percentDiff = apiValue > 0 ? (diff / apiValue) * 100 : 0;
      const match = diff <= tolerance;

      if (!match) allMatch = false;

      const status = match ? '✅ MATCH' : '❌ MISMATCH';
      const color = match ? '' : '\x1b[31m'; // Red for mismatch
      const reset = '\x1b[0m';

      console.log(
        color +
        metric.name.padEnd(20) +
        apiValue.toFixed(2).padStart(15) +
        dbValue.toFixed(2).padStart(15) +
        diff.toFixed(2).padStart(15) +
        status.padStart(10) +
        reset
      );

      results.push({
        month: monthName,
        metric: metric.name,
        api: apiValue,
        database: dbValue,
        difference: diff,
        percentDiff: percentDiff,
        match: match
      });
    }

    // Special verification: Conversion rate must be < 100%
    const convRate = apiTotals.clicks > 0 ? (apiTotals.conversions / apiTotals.clicks) * 100 : 0;
    console.log('\n📈 CRITICAL CHECKS:');
    console.log(`   Conversion Rate: ${convRate.toFixed(2)}% ${convRate > 100 ? '❌ >100%' : '✅ <100%'}`);
    console.log(`   Conversions ≤ Clicks: ${apiTotals.conversions} ≤ ${apiTotals.clicks} ${apiTotals.conversions <= apiTotals.clicks ? '✅ YES' : '❌ NO'}`);

    if (convRate > 100 || apiTotals.conversions > apiTotals.clicks) {
      allMatch = false;
    }

    console.log(`\n${allMatch ? '✅ ALL METRICS MATCH!' : '❌ SOME METRICS DO NOT MATCH'}`);

    return { results, allMatch };

  } catch (error) {
    console.error('❌ Error:', error);
    return { results: [], allMatch: false };
  }
}

async function verifyAll() {
  console.log('🔍 VERIFICATION: DATABASE VS GOOGLE ADS API');
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('\nComparing stored database values with LIVE Google Ads API data...\n');

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

    console.log(`📋 Verifying ${MONTHS.length} months...\n`);

    const allResults: ComparisonResult[] = [];
    let allMonthsMatch = true;

    for (const monthData of MONTHS) {
      const { results, allMatch } = await verifyMonth(
        client,
        googleAdsService,
        monthData.year,
        monthData.month,
        monthData.name
      );

      allResults.push(...results);
      if (!allMatch) allMonthsMatch = false;

      // Delay between months
      if (MONTHS.indexOf(monthData) < MONTHS.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Final Summary
    console.log('\n\n═══════════════════════════════════════════════════════════════════════════════');
    console.log('📊 FINAL VERIFICATION SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════════════════════\n');

    const mismatches = allResults.filter(r => !r.match);
    const matches = allResults.filter(r => r.match);

    console.log(`✅ Matching Metrics: ${matches.length}/${allResults.length}`);
    console.log(`❌ Mismatched Metrics: ${mismatches.length}/${allResults.length}\n`);

    if (mismatches.length > 0) {
      console.log('❌ MISMATCHES FOUND:\n');
      mismatches.forEach(m => {
        console.log(`   ${m.month} - ${m.metric}:`);
        console.log(`      API: ${m.api.toFixed(2)}`);
        console.log(`      Database: ${m.database.toFixed(2)}`);
        console.log(`      Difference: ${m.difference.toFixed(2)} (${m.percentDiff.toFixed(2)}%)\n`);
      });
    }

    console.log('═══════════════════════════════════════════════════════════════════════════════');

    if (allMonthsMatch && mismatches.length === 0) {
      console.log('✅ ✅ ✅ PERFECT MATCH! DATABASE AND API ARE IDENTICAL! ✅ ✅ ✅');
      console.log('✅ All metrics match across all months');
      console.log('✅ All conversion rates < 100%');
      console.log('✅ All conversions ≤ clicks');
      console.log('✅ Data integrity verified');
      console.log('\n🎉 VERIFICATION PASSED 🎉\n');
    } else {
      console.log('⚠️  VERIFICATION FAILED - MISMATCHES DETECTED');
      console.log('⚠️  Database and API data do not match');
      console.log('⚠️  Review mismatches above\n');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

verifyAll();



