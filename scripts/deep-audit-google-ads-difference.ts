#!/usr/bin/env tsx
/**
 * DEEP AUDIT: Find exact reason why API differs from Google Ads UI
 * UI shows: 184,865.28 PLN
 * API shows: 185,149.18 PLN
 * Difference: 283.90 PLN
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('🔍 DEEP AUDIT: Havet November 2025 - Finding exact difference');
  console.log('='.repeat(80));
  
  const { data: client } = await supabase
    .from('clients')
    .select('id, name, google_ads_customer_id')
    .eq('name', 'Havet')
    .single();
  
  if (!client) {
    console.error('❌ Client not found');
    return;
  }
  
  const { data: settingsRows } = await supabase
    .from('system_settings')
    .select('key, value');
  
  const settings: any = {};
  if (settingsRows) {
    settingsRows.forEach((row: any) => {
      settings[row.key] = row.value;
    });
  }
  
  // Import Google Ads library dynamically
  const { GoogleAdsApi } = await import('google-ads-api');
  
  const client_id = settings.google_ads_client_id || process.env.GOOGLE_ADS_CLIENT_ID!;
  const client_secret = settings.google_ads_client_secret || process.env.GOOGLE_ADS_CLIENT_SECRET!;
  const developer_token = settings.google_ads_developer_token || process.env.GOOGLE_ADS_DEVELOPER_TOKEN!;
  const refresh_token = settings.google_ads_manager_refresh_token;
  
  const googleAdsClient = new GoogleAdsApi({
    client_id,
    client_secret,
    developer_token
  });
  
  const customer = googleAdsClient.Customer({
    customer_id: client.google_ads_customer_id!.replace(/-/g, ''), // Remove dashes
    refresh_token,
    login_customer_id: settings.google_ads_manager_customer_id?.replace(/-/g, '')
  });
  
  console.log(`✅ Customer: ${client.name}`);
  console.log(`   ID: ${client.google_ads_customer_id}`);
  console.log('');
  
  // Method 1: Query WITHOUT date segmentation (aggregated)
  console.log('📊 METHOD 1: Query WITHOUT date segmentation (what we use)');
  console.log('-'.repeat(80));
  
  const query1 = `
    SELECT
      campaign.id,
      campaign.name,
      metrics.conversions_value,
      metrics.all_conversions_value,
      metrics.conversions,
      metrics.all_conversions
    FROM campaign
    WHERE segments.date BETWEEN '2025-11-01' AND '2025-11-30'
    ORDER BY metrics.conversions_value DESC
  `;
  
  try {
    const response1 = await customer.query(query1);
    
    let total1_conversions_value = 0;
    let total1_all_conversions_value = 0;
    
    // Aggregate by campaign
    const campaignMap = new Map();
    response1.forEach((row: any) => {
      const campaignId = row.campaign.id;
      const conversionsValue = parseFloat(row.metrics.conversions_value || '0') || 0;
      const allConversionsValue = parseFloat(row.metrics.all_conversions_value || '0') || 0;
      
      if (!campaignMap.has(campaignId)) {
        campaignMap.set(campaignId, {
          name: row.campaign.name,
          conversions_value: conversionsValue,
          all_conversions_value: allConversionsValue
        });
      } else {
        const existing = campaignMap.get(campaignId);
        existing.conversions_value += conversionsValue;
        existing.all_conversions_value += allConversionsValue;
      }
    });
    
    campaignMap.forEach((campaign) => {
      total1_conversions_value += campaign.conversions_value;
      total1_all_conversions_value += campaign.all_conversions_value;
    });
    
    console.log(`Total campaigns: ${campaignMap.size}`);
    console.log(`Total rows from API: ${response1.length}`);
    console.log(`conversions_value total: ${total1_conversions_value.toFixed(2)} PLN`);
    console.log(`all_conversions_value total: ${total1_all_conversions_value.toFixed(2)} PLN`);
    console.log('');
    
    // Method 2: Query WITH date segmentation, then aggregate
    console.log('📊 METHOD 2: Query WITH date segmentation (daily), then aggregate');
    console.log('-'.repeat(80));
    
    const query2 = `
      SELECT
        campaign.id,
        campaign.name,
        segments.date,
        metrics.conversions_value,
        metrics.all_conversions_value
      FROM campaign
      WHERE segments.date BETWEEN '2025-11-01' AND '2025-11-30'
      ORDER BY segments.date, campaign.id
    `;
    
    const response2 = await customer.query(query2);
    
    let total2_conversions_value = 0;
    let total2_all_conversions_value = 0;
    const dailyBreakdown: any[] = [];
    
    response2.forEach((row: any) => {
      const conversionsValue = parseFloat(row.metrics.conversions_value || '0') || 0;
      const allConversionsValue = parseFloat(row.metrics.all_conversions_value || '0') || 0;
      
      total2_conversions_value += conversionsValue;
      total2_all_conversions_value += allConversionsValue;
      
      dailyBreakdown.push({
        date: row.segments.date,
        campaign: row.campaign.name,
        conversions_value: conversionsValue,
        all_conversions_value: allConversionsValue
      });
    });
    
    console.log(`Total rows from API: ${response2.length}`);
    console.log(`conversions_value total: ${total2_conversions_value.toFixed(2)} PLN`);
    console.log(`all_conversions_value total: ${total2_all_conversions_value.toFixed(2)} PLN`);
    console.log('');
    
    // Method 3: Account-level aggregation
    console.log('📊 METHOD 3: Account-level query (no campaign breakdown)');
    console.log('-'.repeat(80));
    
    const query3 = `
      SELECT
        metrics.conversions_value,
        metrics.all_conversions_value,
        metrics.conversions,
        metrics.all_conversions
      FROM customer
      WHERE segments.date BETWEEN '2025-11-01' AND '2025-11-30'
    `;
    
    const response3 = await customer.query(query3);
    
    let total3_conversions_value = 0;
    let total3_all_conversions_value = 0;
    
    response3.forEach((row: any) => {
      const conversionsValue = parseFloat(row.metrics.conversions_value || '0') || 0;
      const allConversionsValue = parseFloat(row.metrics.all_conversions_value || '0') || 0;
      
      total3_conversions_value += conversionsValue;
      total3_all_conversions_value += allConversionsValue;
    });
    
    console.log(`Total rows from API: ${response3.length}`);
    console.log(`conversions_value total: ${total3_conversions_value.toFixed(2)} PLN`);
    console.log(`all_conversions_value total: ${total3_all_conversions_value.toFixed(2)} PLN`);
    console.log('');
    
    // Compare all methods
    console.log('📊 COMPARISON:');
    console.log('='.repeat(80));
    const uiValue = 184865.28;
    console.log(`Google Ads UI:              ${uiValue.toFixed(2)} PLN`);
    console.log(`Method 1 (campaign agg):    ${total1_conversions_value.toFixed(2)} PLN (diff: ${(total1_conversions_value - uiValue).toFixed(2)} PLN)`);
    console.log(`Method 2 (daily agg):       ${total2_conversions_value.toFixed(2)} PLN (diff: ${(total2_conversions_value - uiValue).toFixed(2)} PLN)`);
    console.log(`Method 3 (account level):   ${total3_conversions_value.toFixed(2)} PLN (diff: ${(total3_conversions_value - uiValue).toFixed(2)} PLN)`);
    console.log('');
    
    // Check which matches
    const methods = [
      { name: 'Method 1 (campaign agg)', value: total1_conversions_value },
      { name: 'Method 2 (daily agg)', value: total2_conversions_value },
      { name: 'Method 3 (account level)', value: total3_conversions_value }
    ];
    
    let bestMatch = methods[0];
    let bestDiff = Math.abs(methods[0].value - uiValue);
    
    methods.forEach(method => {
      const diff = Math.abs(method.value - uiValue);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestMatch = method;
      }
    });
    
    console.log(`🎯 BEST MATCH: ${bestMatch.name}`);
    console.log(`   Value: ${bestMatch.value.toFixed(2)} PLN`);
    console.log(`   Difference from UI: ${(bestMatch.value - uiValue).toFixed(2)} PLN`);
    console.log('');
    
    // Analyze daily breakdown to find anomalies
    console.log('📅 DAILY BREAKDOWN (top 10 days by conversion value):');
    console.log('-'.repeat(80));
    const dailyTotals = new Map();
    dailyBreakdown.forEach(entry => {
      if (!dailyTotals.has(entry.date)) {
        dailyTotals.set(entry.date, 0);
      }
      dailyTotals.set(entry.date, dailyTotals.get(entry.date) + entry.conversions_value);
    });
    
    const sortedDays = Array.from(dailyTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    sortedDays.forEach(([date, value]) => {
      console.log(`${date}: ${value.toFixed(2)} PLN`);
    });
    console.log('');
    
    // Final diagnosis
    console.log('🔬 DIAGNOSIS:');
    console.log('='.repeat(80));
    
    if (bestDiff < 1) {
      console.log('✅ EXACT MATCH FOUND!');
      console.log(`   Use ${bestMatch.name} to get ${bestMatch.value.toFixed(2)} PLN`);
    } else if (bestDiff < 100) {
      console.log('⚠️  Close match, but not exact.');
      console.log('   Possible reasons:');
      console.log('   1. Timezone differences (UTC vs CET)');
      console.log('   2. Rounding in Google Ads UI');
      console.log('   3. Data processing delays');
      console.log('   4. Conversion settings filters in UI');
    } else {
      console.log('❌ Significant difference.');
      console.log('   Need to investigate:');
      console.log('   1. Check Google Ads UI filters');
      console.log('   2. Check conversion tracking settings');
      console.log('   3. Check attribution model settings');
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

main().catch(console.error);

