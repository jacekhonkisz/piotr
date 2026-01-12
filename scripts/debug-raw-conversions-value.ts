#!/usr/bin/env tsx
/**
 * Debug: Log raw metrics.conversions_value for each campaign
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
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
  
  // Query for each campaign's conversions_value
  const query = `
    SELECT
      campaign.id,
      campaign.name,
      metrics.conversions_value
    FROM campaign
    WHERE segments.date BETWEEN '2025-11-01' AND '2025-11-30'
    ORDER BY metrics.conversions_value DESC
  `;
  
  console.log('📊 Raw conversions_value for each campaign:');
  console.log('='.repeat(80));
  
  try {
    const response = await customer.query(query);
    
    let totalFromAPI = 0;
    const campaigns: any[] = [];
    
    response.forEach((row: any) => {
      const cv = parseFloat(row.metrics.conversions_value || '0') || 0;
      totalFromAPI += cv;
      
      if (cv > 0) {
        campaigns.push({
          id: row.campaign.id,
          name: row.campaign.name,
          conversions_value: cv
        });
      }
    });
    
    // Sort by value
    campaigns.sort((a, b) => b.conversions_value - a.conversions_value);
    
    console.log(`Total campaigns with conversion_value > 0: ${campaigns.length}`);
    console.log('');
    
    // Show top 20
    campaigns.slice(0, 20).forEach((c, index) => {
      console.log(`${(index + 1).toString().padStart(2)}. ${c.name.substring(0, 50).padEnd(50)} ${c.conversions_value.toFixed(2).padStart(12)} PLN`);
    });
    
    console.log('');
    console.log('='.repeat(80));
    console.log(`TOTAL from API: ${totalFromAPI.toFixed(2)} PLN`);
    console.log(`Expected (UI):  184,865.28 PLN`);
    console.log(`Difference:     ${(totalFromAPI - 184865.28).toFixed(2)} PLN`);
    
    if (Math.abs(totalFromAPI - 184865.28) < 0.01) {
      console.log('✅ MATCHES UI EXACTLY!');
    } else {
      console.log('❌ DOES NOT MATCH!');
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error);
  }
}

main().catch(console.error);

