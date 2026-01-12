#!/usr/bin/env tsx
/**
 * Test script to verify we're fetching "Wartość konwersji" correctly for Havet December 2025
 */

import { createClient } from '@supabase/supabase-js';
import { GoogleAdsAPIService } from '../src/lib/google-ads-api';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('🔍 Testing Havet December 2025 - Wartość konwersji');
  console.log('='.repeat(80));
  
  // Get Havet client
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id, name, google_ads_customer_id, google_ads_refresh_token')
    .eq('name', 'Havet')
    .single();
  
  if (clientError || !client) {
    console.error('❌ Client not found:', clientError);
    return;
  }
  
  console.log(`✅ Found client: ${client.name}`);
  console.log(`   Customer ID: ${client.google_ads_customer_id}`);
  console.log('');
  
  // Get system settings (key-value format)
  const { data: settingsRows } = await supabase
    .from('system_settings')
    .select('key, value');
  
  const settings: any = {};
  if (settingsRows) {
    settingsRows.forEach((row: any) => {
      settings[row.key] = row.value;
    });
  }
  
  // Initialize Google Ads service
  const refreshToken = settings.google_ads_manager_refresh_token || client.google_ads_refresh_token;
  
  if (!refreshToken) {
    console.error('❌ No refresh token available');
    return;
  }
  
  const googleAdsService = new GoogleAdsAPIService({
    refreshToken,
    clientId: settings.google_ads_client_id || process.env.GOOGLE_ADS_CLIENT_ID!,
    clientSecret: settings.google_ads_client_secret || process.env.GOOGLE_ADS_CLIENT_SECRET!,
    developmentToken: settings.google_ads_developer_token || process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
    customerId: client.google_ads_customer_id!,
    managerCustomerId: settings.google_ads_manager_customer_id
  });
  
  // Fetch December 2025 data
  const dateStart = '2025-12-01';
  const dateEnd = '2025-12-31';
  
  console.log(`📊 Fetching data from ${dateStart} to ${dateEnd}...`);
  console.log('');
  
  try {
    const campaigns = await googleAdsService.getCampaignData(dateStart, dateEnd);
    
    console.log(`✅ Fetched ${campaigns.length} campaigns`);
    console.log('');
    
    // Calculate totals
    const totals = campaigns.reduce((acc, campaign) => ({
      spend: acc.spend + (campaign.spend || 0),
      impressions: acc.impressions + (campaign.impressions || 0),
      clicks: acc.clicks + (campaign.clicks || 0),
      conversions: acc.conversions + (campaign.conversions || 0),
      // ✅ Check conversion_value (Wartość konwersji)
      conversion_value: acc.conversion_value + (campaign.conversion_value || 0),
      total_conversion_value: acc.total_conversion_value + (campaign.total_conversion_value || 0),
      reservation_value: acc.reservation_value + (campaign.reservation_value || 0),
      reservations: acc.reservations + (campaign.reservations || 0),
    }), {
      spend: 0,
      impressions: 0,
      clicks: 0,
      conversions: 0,
      conversion_value: 0,
      total_conversion_value: 0,
      reservation_value: 0,
      reservations: 0
    });
    
    console.log('📊 TOTALS:');
    console.log('='.repeat(80));
    console.log(`Spend:                    ${totals.spend.toFixed(2)} PLN`);
    console.log(`Impressions:              ${totals.impressions.toLocaleString()}`);
    console.log(`Clicks:                   ${totals.clicks.toLocaleString()}`);
    console.log(`Conversions:              ${totals.conversions.toFixed(2)}`);
    console.log('');
    console.log('💰 CONVERSION VALUES:');
    console.log('-'.repeat(80));
    console.log(`conversion_value:         ${totals.conversion_value.toFixed(2)} PLN  ← "Wartość konwersji" from API`);
    console.log(`total_conversion_value:  ${totals.total_conversion_value.toFixed(2)} PLN  ← Should match conversion_value`);
    console.log(`reservation_value:       ${totals.reservation_value.toFixed(2)} PLN  ← Only from "Rezerwacja" actions`);
    console.log(`Reservations:            ${totals.reservations}`);
    console.log('');
    
    // Show top campaigns by conversion_value
    console.log('🏆 TOP 10 CAMPAIGNS BY "Wartość konwersji" (conversion_value):');
    console.log('-'.repeat(80));
    const topCampaigns = campaigns
      .filter(c => (c.conversion_value || 0) > 0)
      .sort((a, b) => (b.conversion_value || 0) - (a.conversion_value || 0))
      .slice(0, 10);
    
    topCampaigns.forEach((campaign, index) => {
      console.log(`${(index + 1).toString().padStart(2)}. ${campaign.campaignName.substring(0, 50).padEnd(50)}`);
      console.log(`    conversion_value: ${(campaign.conversion_value || 0).toFixed(2).padStart(12)} PLN`);
      console.log(`    reservation_value: ${(campaign.reservation_value || 0).toFixed(2).padStart(11)} PLN`);
      console.log(`    reservations: ${(campaign.reservations || 0).toString().padStart(15)}`);
      console.log('');
    });
    
    // Expected value check
    const expectedValue = 149126.00;
    const actualValue = totals.conversion_value;
    const difference = Math.abs(actualValue - expectedValue);
    const percentDiff = (difference / expectedValue) * 100;
    
    console.log('✅ VERIFICATION:');
    console.log('='.repeat(80));
    console.log(`Expected "Wartość konwersji":  ${expectedValue.toFixed(2)} PLN`);
    console.log(`Actual conversion_value:        ${actualValue.toFixed(2)} PLN`);
    console.log(`Difference:                    ${difference.toFixed(2)} PLN (${percentDiff.toFixed(2)}%)`);
    
    if (difference < 1) {
      console.log('✅ MATCH! Values are correct.');
    } else if (percentDiff < 5) {
      console.log('⚠️  Close match, but not exact. Checking...');
    } else {
      console.log('❌ MISMATCH! Need to investigate.');
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

main().catch(console.error);

