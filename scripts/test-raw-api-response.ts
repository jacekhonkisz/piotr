#!/usr/bin/env tsx
/**
 * Test: Get RAW Google Ads API response before our aggregation logic
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('🔍 Testing RAW API response before aggregation');
  console.log('='.repeat(80));
  
  const { data: client } = await supabase
    .from('clients')
    .select('id, name, google_ads_customer_id')
    .eq('name', 'Havet')
    .single();
  
  const { data: settingsRows } = await supabase
    .from('system_settings')
    .select('key, value');
  
  const settings: any = {};
  if (settingsRows) {
    settingsRows.forEach((row: any) => {
      settings[row.key] = row.value;
    });
  }
  
  const { GoogleAdsApi } = await import('google-ads-api');
  
  const googleAdsClient = new GoogleAdsApi({
    client_id: settings.google_ads_client_id,
    client_secret: settings.google_ads_client_secret,
    developer_token: settings.google_ads_developer_token
  });
  
  const customer = googleAdsClient.Customer({
    customer_id: client!.google_ads_customer_id!.replace(/-/g, ''),
    refresh_token: settings.google_ads_manager_refresh_token,
    login_customer_id: settings.google_ads_manager_customer_id?.replace(/-/g, '')
  });
  
  // Same query as our code uses
  const query = `
    SELECT
      campaign.id,
      campaign.name,
      metrics.cost_micros,
      metrics.conversions_value,
      metrics.all_conversions_value
    FROM campaign
    WHERE segments.date BETWEEN '2025-11-01' AND '2025-11-30'
    ORDER BY metrics.cost_micros DESC
  `;
  
  console.log('📊 Query (same as our code):');
  console.log(query);
  console.log('');
  
  try {
    const response = await customer.query(query);
    
    console.log(`✅ Got ${response.length} rows from API`);
    console.log('');
    
    // Calculate raw sum WITHOUT any aggregation
    let rawSum_conversions_value = 0;
    let rawSum_all_conversions_value = 0;
    
    response.forEach((row: any) => {
      const cv = parseFloat(row.metrics.conversions_value || '0') || 0;
      const acv = parseFloat(row.metrics.all_conversions_value || '0') || 0;
      rawSum_conversions_value += cv;
      rawSum_all_conversions_value += acv;
    });
    
    console.log('📊 RAW SUM (no aggregation, just adding all rows):');
    console.log(`conversions_value: ${rawSum_conversions_value.toFixed(2)} PLN`);
    console.log(`all_conversions_value: ${rawSum_all_conversions_value.toFixed(2)} PLN`);
    console.log('');
    
    // Now aggregate by campaign ID (what our code does)
    const campaignMap = new Map();
    
    response.forEach((row: any) => {
      const campaignId = row.campaign.id;
      const cv = parseFloat(row.metrics.conversions_value || '0') || 0;
      const acv = parseFloat(row.metrics.all_conversions_value || '0') || 0;
      
      if (!campaignMap.has(campaignId)) {
        campaignMap.set(campaignId, {
          name: row.campaign.name,
          conversions_value: cv,
          all_conversions_value: acv
        });
      } else {
        const existing = campaignMap.get(campaignId);
        existing.conversions_value += cv;
        existing.all_conversions_value += acv;
      }
    });
    
    let aggSum_conversions_value = 0;
    let aggSum_all_conversions_value = 0;
    
    campaignMap.forEach(campaign => {
      aggSum_conversions_value += campaign.conversions_value;
      aggSum_all_conversions_value += campaign.all_conversions_value;
    });
    
    console.log('📊 AGGREGATED BY CAMPAIGN (what our code does):');
    console.log(`Unique campaigns: ${campaignMap.size}`);
    console.log(`conversions_value: ${aggSum_conversions_value.toFixed(2)} PLN`);
    console.log(`all_conversions_value: ${aggSum_all_conversions_value.toFixed(2)} PLN`);
    console.log('');
    
    console.log('📊 COMPARISON:');
    console.log('='.repeat(80));
    console.log(`Google Ads UI:              184,865.28 PLN`);
    console.log(`Raw sum (no agg):           ${rawSum_conversions_value.toFixed(2)} PLN`);
    console.log(`Aggregated by campaign:     ${aggSum_conversions_value.toFixed(2)} PLN`);
    console.log('');
    
    if (Math.abs(rawSum_conversions_value - 184865.28) < 0.01) {
      console.log('✅ RAW SUM MATCHES UI!');
      console.log('   Problem: We should NOT aggregate, just use raw sum');
    } else if (Math.abs(aggSum_conversions_value - 184865.28) < 0.01) {
      console.log('✅ AGGREGATED SUM MATCHES UI!');
      console.log('   Our current logic is correct');
    } else {
      console.log('❌ NEITHER MATCHES! Investigating...');
      
      // Show a sample of rows
      console.log('');
      console.log('Sample rows:');
      response.slice(0, 5).forEach((row: any) => {
        console.log(`Campaign: ${row.campaign.name}`);
        console.log(`  conversions_value: ${row.metrics.conversions_value}`);
        console.log(`  all_conversions_value: ${row.metrics.all_conversions_value}`);
      });
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

main().catch(console.error);

