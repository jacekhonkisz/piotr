#!/usr/bin/env node
/**
 * TEST BACKFILL - Single Month, Single Client
 * 
 * This is a small test version to verify the backfill works correctly
 * before running on all historical data.
 * 
 * Usage: 
 *   npx tsx scripts/test-backfill-november-havet.ts
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

// Test with November 2025 and Havet only
const TEST_MONTH = '2025-11';
const TEST_START = '2025-11-01';
const TEST_END = '2025-11-30';

async function main() {
  console.log('🧪 TEST BACKFILL');
  console.log(`📅 Month: ${TEST_MONTH}`);
  console.log(`🏨 Client: Havet only`);
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

  console.log('📊 Fetching campaign data from Google Ads API...');
  const googleAdsService = new GoogleAdsAPIService(googleAdsCredentials);
  const campaigns = await googleAdsService.getCampaignData(TEST_START, TEST_END);

  if (!campaigns || campaigns.length === 0) {
    console.log('⚠️  No campaigns found for this period');
    process.exit(0);
  }

  const totalSpend = campaigns.reduce((sum, c) => sum + (c.spend || 0), 0);
  const totalStep1 = campaigns.reduce((sum, c) => sum + (c.booking_step_1 || 0), 0);
  const totalStep2 = campaigns.reduce((sum, c) => sum + (c.booking_step_2 || 0), 0);
  const totalStep3 = campaigns.reduce((sum, c) => sum + (c.booking_step_3 || 0), 0);

  console.log(`✅ Fetched ${campaigns.length} campaigns`);
  console.log(`💰 Spend: ${totalSpend.toFixed(2)} PLN`);
  console.log(`📊 Booking Steps:`);
  console.log(`   Step 1: ${Math.round(totalStep1).toLocaleString()}`);
  console.log(`   Step 2: ${Math.round(totalStep2).toLocaleString()}`);
  console.log(`   Step 3: ${Math.round(totalStep3).toLocaleString()}`);

  // Prepare campaigns for google_ads_campaigns table
  console.log('\n📝 Preparing data for database...');
  const campaignsToInsert = campaigns.map((campaign: any) => ({
    client_id: client.id,
    campaign_id: campaign.campaignId,
    campaign_name: campaign.campaignName,
    status: campaign.status || 'UNKNOWN',
    date_range_start: TEST_START,
    date_range_end: TEST_END,
    spend: campaign.spend || 0,
    impressions: Math.round(campaign.impressions || 0),
    clicks: Math.round(campaign.clicks || 0),
    cpc: campaign.cpc || 0,
    ctr: campaign.ctr || 0,
    form_submissions: 0,
    phone_calls: 0,
    email_clicks: campaign.email_contacts || 0,
    phone_clicks: campaign.click_to_call || 0,
    booking_step_1: Math.round(campaign.booking_step_1 || 0),
    booking_step_2: Math.round(campaign.booking_step_2 || 0),
    booking_step_3: Math.round(campaign.booking_step_3 || 0),
    reservations: Math.round(campaign.reservations || 0),
    reservation_value: campaign.reservation_value || 0,
    roas: campaign.roas || 0,
  }));

  console.log('\n💾 Storing in google_ads_campaigns table...');
  const { error: campaignsError } = await supabase
    .from('google_ads_campaigns')
    .upsert(campaignsToInsert, {
      onConflict: 'client_id,campaign_id,date_range_start,date_range_end'
    });

  if (campaignsError) {
    console.error('❌ Failed to store campaigns:', campaignsError);
    process.exit(1);
  }

  console.log(`✅ Stored ${campaignsToInsert.length} campaigns in google_ads_campaigns`);

  // Now update campaign_summaries
  console.log('\n📊 Updating campaign_summaries...');
  
  // ✅ FIX: Round all bigint fields to integers
  const totalImpressions = Math.round(campaigns.reduce((sum, c) => sum + (c.impressions || 0), 0));
  const totalClicks = Math.round(campaigns.reduce((sum, c) => sum + (c.clicks || 0), 0));
  const totalConversions = Math.round(campaigns.reduce((sum, c) => sum + (c.conversions || 0), 0));
  
  const summary = {
    client_id: client.id,
    summary_type: 'monthly',
    summary_date: TEST_START,
    platform: 'google',
    total_spend: totalSpend,
    total_impressions: totalImpressions,
    total_clicks: totalClicks,
    total_conversions: totalConversions,
    average_ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
    average_cpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
    booking_step_1: Math.round(totalStep1),
    booking_step_2: Math.round(totalStep2),
    booking_step_3: Math.round(totalStep3),
    reservations: Math.round(campaigns.reduce((sum, c) => sum + (c.reservations || 0), 0)),
    reservation_value: campaigns.reduce((sum, c) => sum + (c.reservation_value || 0), 0),
    click_to_call: Math.round(campaigns.reduce((sum, c) => sum + (c.click_to_call || 0), 0)),
    email_contacts: Math.round(campaigns.reduce((sum, c) => sum + (c.email_contacts || 0), 0)),
    roas: campaigns.reduce((sum, c) => sum + (c.roas || 0), 0) / campaigns.length || 0,
    active_campaigns: campaigns.filter(c => c.status === 'ENABLED').length,
    total_campaigns: campaigns.length,
    campaign_data: campaigns.map(c => ({
      campaignId: c.campaignId,
      campaignName: c.campaignName,
      status: c.status,
      spend: c.spend,
      impressions: Math.round(c.impressions || 0),
      clicks: Math.round(c.clicks || 0),
      cpc: c.cpc,
      ctr: c.ctr,
      booking_step_1: Math.round(c.booking_step_1 || 0),
      booking_step_2: Math.round(c.booking_step_2 || 0),
      booking_step_3: Math.round(c.booking_step_3 || 0),
      reservations: Math.round(c.reservations || 0),
      reservation_value: c.reservation_value,
      roas: c.roas
    })),
    data_source: `test_backfill_${new Date().toISOString().split('T')[0]}`,
    last_updated: new Date().toISOString()
  };

  console.log('\n🔍 Summary data to insert:');
  console.log(`   total_impressions (${typeof summary.total_impressions}): ${summary.total_impressions}`);
  console.log(`   total_clicks (${typeof summary.total_clicks}): ${summary.total_clicks}`);
  console.log(`   booking_step_1 (${typeof summary.booking_step_1}): ${summary.booking_step_1}`);
  console.log(`   booking_step_2 (${typeof summary.booking_step_2}): ${summary.booking_step_2}`);
  console.log(`   booking_step_3 (${typeof summary.booking_step_3}): ${summary.booking_step_3}`);

  const { error: summaryError } = await supabase
    .from('campaign_summaries')
    .upsert(summary, {
      onConflict: 'client_id,summary_type,summary_date,platform'
    });

  if (summaryError) {
    console.error('❌ Failed to update campaign_summaries:', summaryError);
    process.exit(1);
  }

  console.log(`✅ Updated campaign_summaries for ${TEST_MONTH}`);

  // Verify the data
  console.log('\n✅ Verifying stored data...');
  const { data: verifyData } = await supabase
    .from('campaign_summaries')
    .select('*')
    .eq('client_id', client.id)
    .eq('summary_type', 'monthly')
    .eq('summary_date', TEST_START)
    .eq('platform', 'google')
    .single();

  if (verifyData) {
    console.log('\n📊 Stored Summary:');
    console.log(`   Spend: ${verifyData.total_spend} PLN`);
    console.log(`   Impressions: ${verifyData.total_impressions?.toLocaleString()}`);
    console.log(`   Clicks: ${verifyData.total_clicks?.toLocaleString()}`);
    console.log(`   Booking Step 1: ${verifyData.booking_step_1?.toLocaleString()}`);
    console.log(`   Booking Step 2: ${verifyData.booking_step_2?.toLocaleString()}`);
    console.log(`   Booking Step 3: ${verifyData.booking_step_3?.toLocaleString()}`);
    console.log(`   Reservations: ${verifyData.reservations}`);
    console.log(`   Data Source: ${verifyData.data_source}`);
  }

  console.log('\n✅ TEST COMPLETE!');
  console.log('💡 If these numbers match Google Ads Console, you can run the full backfill.');
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

