#!/usr/bin/env node
/**
 * Test script to fetch December 2025 data for Havet and check form conversion values
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

async function main() {
  console.log('🔍 Fetching December 2025 data for Havet...\n');
  
  // Get Havet client
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('*')
    .eq('name', 'Havet')
    .single();
  
  if (clientError || !client) {
    console.error('❌ Client not found:', clientError);
    process.exit(1);
  }
  
  console.log(`✅ Found client: ${client.name}`);
  console.log(`   Customer ID: ${client.google_ads_customer_id}\n`);
  
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
    console.error('❌ Error fetching settings:', settingsError);
    process.exit(1);
  }
  
  const settings = settingsData.reduce((acc: any, s: any) => {
    acc[s.key] = s.value;
    return acc;
  }, {});
  
  const refreshToken = settings.google_ads_manager_refresh_token || client.google_ads_refresh_token;
  
  if (!refreshToken) {
    console.error('❌ No refresh token available');
    process.exit(1);
  }
  
  // Initialize Google Ads service
  const googleAdsService = new GoogleAdsAPIService({
    refreshToken,
    clientId: settings.google_ads_client_id,
    clientSecret: settings.google_ads_client_secret,
    developmentToken: settings.google_ads_developer_token,
    customerId: client.google_ads_customer_id,
    managerCustomerId: settings.google_ads_manager_customer_id
  });
  
  // Fetch December 2025 data
  const dateStart = '2025-12-01';
  const dateEnd = '2025-12-31';
  
  console.log(`📅 Fetching data from ${dateStart} to ${dateEnd}...\n`);
  
  const campaigns = await googleAdsService.getCampaignData(dateStart, dateEnd);
  
  console.log(`✅ Fetched ${campaigns.length} campaigns\n`);
  
  // Calculate totals
  const totals = campaigns.reduce((acc, campaign: any) => ({
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
    conversion_value: acc.conversion_value + (campaign.conversion_value || 0),
    total_conversion_value: acc.total_conversion_value + (campaign.total_conversion_value || 0),
  }), {
    spend: 0, impressions: 0, clicks: 0, conversions: 0,
    click_to_call: 0, email_contacts: 0, booking_step_1: 0,
    booking_step_2: 0, booking_step_3: 0, reservations: 0, 
    reservation_value: 0, conversion_value: 0, total_conversion_value: 0
  });
  
  console.log('📊 TOTALS:');
  console.log('='.repeat(80));
  console.log(`Spend: ${totals.spend.toFixed(2)} PLN`);
  console.log(`Impressions: ${totals.impressions.toLocaleString()}`);
  console.log(`Clicks: ${totals.clicks.toLocaleString()}`);
  console.log(`Conversions: ${totals.conversions.toFixed(1)}`);
  console.log(`\n📧 FORM/EMAIL CONVERSIONS:`);
  console.log(`Email Contacts: ${totals.email_contacts}`);
  console.log(`\n💰 CONVERSION VALUES:`);
  console.log(`Reservation Value: ${totals.reservation_value.toFixed(2)} PLN`);
  console.log(`Conversion Value (Wartość konwersji): ${totals.conversion_value.toFixed(2)} PLN`);
  console.log(`Total Conversion Value (Łączna wartość konwersji): ${totals.total_conversion_value.toFixed(2)} PLN`);
  console.log(`\n🎯 BOOKING FUNNEL:`);
  console.log(`Step 1: ${totals.booking_step_1}`);
  console.log(`Step 2: ${totals.booking_step_2}`);
  console.log(`Step 3: ${totals.booking_step_3}`);
  console.log(`Reservations: ${totals.reservations}`);
  console.log(`\n📞 OTHER:`);
  console.log(`Click to Call: ${totals.click_to_call}`);
  
  // Show top campaigns with form conversions
  console.log('\n\n🔍 TOP CAMPAIGNS WITH FORM CONVERSIONS:');
  console.log('='.repeat(80));
  
  const campaignsWithForms = campaigns
    .filter((c: any) => (c.email_contacts || 0) > 0)
    .sort((a: any, b: any) => (b.email_contacts || 0) - (a.email_contacts || 0))
    .slice(0, 10);
  
  if (campaignsWithForms.length === 0) {
    console.log('No campaigns with form conversions found');
  } else {
    campaignsWithForms.forEach((campaign: any, index: number) => {
      console.log(`\n${index + 1}. ${campaign.campaignName}`);
      console.log(`   Email Contacts: ${campaign.email_contacts || 0}`);
      console.log(`   Reservation Value: ${(campaign.reservation_value || 0).toFixed(2)} PLN`);
      console.log(`   Total Conversion Value: ${(campaign.total_conversion_value || 0).toFixed(2)} PLN`);
      console.log(`   Spend: ${(campaign.spend || 0).toFixed(2)} PLN`);
    });
  }
  
  // Check conversion breakdown for form conversions with values
  console.log('\n\n🔍 CHECKING ALL FORM-RELATED CONVERSIONS AND THEIR VALUES:');
  console.log('='.repeat(80));
  
  // Get the raw conversion breakdown query to see all form conversions
  const conversionBreakdown = await googleAdsService.getConversionBreakdown(dateStart, dateEnd);
  
  // We need to check the raw conversion data from the API
  // Let's query directly to see form conversion values
  const customer = googleAdsService['client'].Customer({
    customer_id: client.google_ads_customer_id,
    refresh_token: settings.google_ads_manager_refresh_token || client.google_ads_refresh_token,
    ...(settings.google_ads_manager_customer_id && { manager_customer_id: settings.google_ads_manager_customer_id }),
  });
  
  const formConversionQuery = `
    SELECT
      segments.conversion_action_name,
      metrics.all_conversions,
      metrics.all_conversions_value
    FROM campaign
    WHERE segments.date BETWEEN '${dateStart}' AND '${dateEnd}'
      AND (
        segments.conversion_action_name LIKE '%formularz%' OR
        segments.conversion_action_name LIKE '%form%' OR
        segments.conversion_action_name LIKE '%email%' OR
        segments.conversion_action_name LIKE '%mail%' OR
        segments.conversion_action_name LIKE '%kontakt%'
      )
      AND metrics.all_conversions > 0
    ORDER BY metrics.all_conversions_value DESC
  `;
  
  try {
    const formResponse = await customer.query(formConversionQuery);
    
    console.log(`\n📋 Found ${formResponse.length} form-related conversion records:\n`);
    
    let totalFormValue = 0;
    let totalFormConversions = 0;
    
    formResponse.forEach((row: any) => {
      const actionName = row.segments?.conversion_action_name || 'Unknown';
      const conversions = parseFloat(row.metrics?.all_conversions || '0') || 0;
      const value = parseFloat(row.metrics?.all_conversions_value || '0') || 0;
      
      totalFormConversions += conversions;
      totalFormValue += value;
      
      if (conversions > 0) {
        console.log(`  "${actionName}":`);
        console.log(`    Conversions: ${conversions.toFixed(1)}`);
        console.log(`    Value: ${value.toFixed(2)} PLN`);
        console.log('');
      }
    });
    
    console.log(`\n📊 FORM CONVERSION TOTALS:`);
    console.log(`  Total Form Conversions: ${totalFormConversions.toFixed(1)}`);
    console.log(`  Total Form Conversion Value: ${totalFormValue.toFixed(2)} PLN`);
    console.log(`\n💰 CURRENT RESERVATION VALUE: ${totals.reservation_value.toFixed(2)} PLN`);
    console.log(`   (Should include form conversion values if they exist)`);
    
  } catch (error: any) {
    console.log(`\n⚠️ Could not query form conversions directly: ${error.message}`);
  }
  
  console.log('\n✅ Analysis complete!');
}

main().catch(console.error);

