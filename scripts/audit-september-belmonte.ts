#!/usr/bin/env tsx

/**
 * AUDIT SEPTEMBER 2025 DATA FOR BELMONTE
 * 
 * Compare:
 * 1. What's in the database (campaign_summaries)
 * 2. What Google Ads API returns (live data)
 * 3. What the dashboard displays
 */

import { createClient } from '@supabase/supabase-js';
import { GoogleAdsAPIService } from '../src/lib/google-ads-api.js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function auditSeptemberData() {
  console.log('🔍 AUDITING SEPTEMBER 2025 DATA FOR BELMONTE');
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

    const startDate = '2025-09-01';
    const endDate = '2025-09-30';

    // Step 2: Check what's in the database
    console.log('📋 Step 2: Checking database (campaign_summaries)...');
    
    // Monthly summary
    const { data: monthlyData, error: monthlyError } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', client.id)
      .eq('summary_type', 'monthly')
      .eq('platform', 'google')
      .eq('summary_date', startDate);

    console.log('\n📊 MONTHLY SUMMARY FROM DATABASE:');
    if (monthlyData && monthlyData.length > 0) {
      const summary = monthlyData[0];
      console.log(`   Spend: ${parseFloat(summary.total_spend).toFixed(2)} PLN`);
      console.log(`   Impressions: ${summary.total_impressions}`);
      console.log(`   Clicks: ${summary.total_clicks}`);
      console.log(`   Conversions: ${summary.total_conversions}`);
      console.log(`   Data Source: ${summary.data_source}`);
      console.log(`   Last Updated: ${summary.last_updated}`);
      console.log(`   Campaign Count: ${summary.total_campaigns}`);
    } else {
      console.log('   ❌ No monthly summary found');
    }

    // Weekly summaries
    const { data: weeklyData, error: weeklyError } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', client.id)
      .eq('summary_type', 'weekly')
      .eq('platform', 'google')
      .gte('summary_date', startDate)
      .lte('summary_date', endDate)
      .order('summary_date', { ascending: true });

    console.log('\n📊 WEEKLY SUMMARIES FROM DATABASE:');
    if (weeklyData && weeklyData.length > 0) {
      console.log(`   Found ${weeklyData.length} weekly summaries:`);
      let weeklyTotal = {
        spend: 0,
        impressions: 0,
        clicks: 0,
        conversions: 0
      };
      weeklyData.forEach((week: any) => {
        const spend = parseFloat(week.total_spend);
        weeklyTotal.spend += spend;
        weeklyTotal.impressions += week.total_impressions;
        weeklyTotal.clicks += week.total_clicks;
        weeklyTotal.conversions += week.total_conversions;
        console.log(`   - ${week.summary_date}: ${spend.toFixed(2)} PLN, ${week.total_impressions} impressions, ${week.total_clicks} clicks`);
      });
      console.log(`\n   WEEKLY TOTALS (aggregated):`);
      console.log(`   Spend: ${weeklyTotal.spend.toFixed(2)} PLN`);
      console.log(`   Impressions: ${weeklyTotal.impressions}`);
      console.log(`   Clicks: ${weeklyTotal.clicks}`);
      console.log(`   Conversions: ${weeklyTotal.conversions}`);
    } else {
      console.log('   ❌ No weekly summaries found');
    }

    // Step 3: Fetch live data from Google Ads API
    console.log('\n📋 Step 3: Fetching live data from Google Ads API...');
    
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

    const campaigns = await googleAdsService.getCampaignData(startDate, endDate);

    const apiTotals = campaigns.reduce((acc: any, campaign: any) => ({
      spend: acc.spend + (campaign.spend || 0),
      impressions: acc.impressions + (campaign.impressions || 0),
      clicks: acc.clicks + (campaign.clicks || 0),
      conversions: acc.conversions + (campaign.conversions || 0),
      click_to_call: acc.click_to_call + (campaign.click_to_call || 0),
      booking_step_1: acc.booking_step_1 + (campaign.booking_step_1 || 0),
      reservations: acc.reservations + (campaign.reservations || 0),
    }), {
      spend: 0,
      impressions: 0,
      clicks: 0,
      conversions: 0,
      click_to_call: 0,
      booking_step_1: 0,
      reservations: 0,
    });

    console.log('\n📊 LIVE DATA FROM GOOGLE ADS API:');
    console.log(`   Spend: ${apiTotals.spend.toFixed(2)} PLN`);
    console.log(`   Impressions: ${apiTotals.impressions}`);
    console.log(`   Clicks: ${apiTotals.clicks}`);
    console.log(`   Conversions: ${apiTotals.conversions}`);
    console.log(`   Campaigns: ${campaigns.length}`);
    console.log(`\n   Conversion Funnel:`);
    console.log(`   - Click to Call: ${apiTotals.click_to_call}`);
    console.log(`   - Booking Step 1: ${apiTotals.booking_step_1}`);
    console.log(`   - Reservations: ${apiTotals.reservations}`);

    // Step 4: Compare all three sources
    console.log('\n\n═══════════════════════════════════════════════════');
    console.log('📊 COMPARISON SUMMARY');
    console.log('═══════════════════════════════════════════════════\n');

    const monthlySpend = monthlyData && monthlyData.length > 0 ? parseFloat(monthlyData[0].total_spend) : 0;
    const weeklySpend = weeklyData && weeklyData.length > 0 
      ? weeklyData.reduce((sum: number, w: any) => sum + parseFloat(w.total_spend), 0) 
      : 0;

    console.log('💰 SPEND COMPARISON:');
    console.log(`   Database (Monthly):  ${monthlySpend.toFixed(2)} PLN`);
    console.log(`   Database (Weekly):   ${weeklySpend.toFixed(2)} PLN`);
    console.log(`   Google Ads API:      ${apiTotals.spend.toFixed(2)} PLN`);
    console.log(`   Dashboard shows:     814.34 PLN`);

    console.log('\n👁️  IMPRESSIONS COMPARISON:');
    const monthlyImpressions = monthlyData && monthlyData.length > 0 ? monthlyData[0].total_impressions : 0;
    const weeklyImpressions = weeklyData && weeklyData.length > 0 
      ? weeklyData.reduce((sum: number, w: any) => sum + w.total_impressions, 0) 
      : 0;
    console.log(`   Database (Monthly):  ${monthlyImpressions}`);
    console.log(`   Database (Weekly):   ${weeklyImpressions}`);
    console.log(`   Google Ads API:      ${apiTotals.impressions}`);
    console.log(`   Dashboard shows:     166`);

    console.log('\n🖱️  CLICKS COMPARISON:');
    const monthlyClicks = monthlyData && monthlyData.length > 0 ? monthlyData[0].total_clicks : 0;
    const weeklyClicks = weeklyData && weeklyData.length > 0 
      ? weeklyData.reduce((sum: number, w: any) => sum + w.total_clicks, 0) 
      : 0;
    console.log(`   Database (Monthly):  ${monthlyClicks}`);
    console.log(`   Database (Weekly):   ${weeklyClicks}`);
    console.log(`   Google Ads API:      ${apiTotals.clicks}`);
    console.log(`   Dashboard shows:     19`);

    // Identify the issue
    console.log('\n\n═══════════════════════════════════════════════════');
    console.log('🔍 DIAGNOSIS');
    console.log('═══════════════════════════════════════════════════\n');

    if (monthlySpend === 0 && weeklySpend > 0) {
      console.log('❌ ISSUE: No monthly summary in database');
      console.log('   Monthly data collection has not run for September 2025');
      console.log('   Only weekly summaries exist');
      console.log('   Dashboard may be showing incomplete data\n');
      console.log('✅ SOLUTION: Run monthly collection for September');
    } else if (Math.abs(monthlySpend - apiTotals.spend) > 50) {
      console.log('❌ ISSUE: Significant difference between database and API');
      console.log(`   Difference: ${Math.abs(monthlySpend - apiTotals.spend).toFixed(2)} PLN`);
      console.log('   Monthly summary may be stale or incomplete\n');
      console.log('✅ SOLUTION: Re-collect September monthly data');
    } else {
      console.log('✅ Database and API data match within acceptable range');
    }

    if (Math.abs(monthlySpend - 814.34) < 10 && monthlySpend > 0) {
      console.log('\n⚠️  Dashboard is showing database monthly summary');
      console.log('   This value is significantly lower than API data');
      console.log('   Suggests monthly collection was incomplete or partial');
    }

    console.log('\n═══════════════════════════════════════════════════');
    console.log('✅ AUDIT COMPLETE');
    console.log('═══════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error during audit:', error);
    process.exit(1);
  }
}

auditSeptemberData();








