#!/usr/bin/env tsx
/**
 * Test to find what's adding the extra 283.90 PLN
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
  console.log('🔍 Finding what adds the extra 283.90 PLN');
  console.log('='.repeat(80));
  
  const { data: client } = await supabase
    .from('clients')
    .select('id, name, google_ads_customer_id, google_ads_refresh_token')
    .eq('name', 'Havet')
    .single();
  
  if (!client) return;
  
  const { data: settingsRows } = await supabase
    .from('system_settings')
    .select('key, value');
  
  const settings: any = {};
  if (settingsRows) {
    settingsRows.forEach((row: any) => {
      settings[row.key] = row.value;
    });
  }
  
  const googleAdsService = new GoogleAdsAPIService({
    refreshToken: settings.google_ads_manager_refresh_token || client.google_ads_refresh_token,
    clientId: settings.google_ads_client_id || process.env.GOOGLE_ADS_CLIENT_ID!,
    clientSecret: settings.google_ads_client_secret || process.env.GOOGLE_ADS_CLIENT_SECRET!,
    developmentToken: settings.google_ads_developer_token || process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
    customerId: client.google_ads_customer_id!,
    managerCustomerId: settings.google_ads_manager_customer_id
  });
  
  const dateStart = '2025-11-01';
  const dateEnd = '2025-11-30';
  
  console.log('📊 Fetching via getCampaignData()...');
  
  try {
    const campaigns = await googleAdsService.getCampaignData(dateStart, dateEnd);
    
    console.log(`✅ Got ${campaigns.length} campaigns`);
    console.log('');
    
    // Check conversion_value vs total_conversion_value
    let totalConversionValue = 0;
    let totalTotalConversionValue = 0;
    let totalReservationValue = 0;
    
    const campaignsWithDiff: any[] = [];
    
    campaigns.forEach(campaign => {
      const cv = campaign.conversion_value || 0;
      const tcv = campaign.total_conversion_value || 0;
      const rv = campaign.reservation_value || 0;
      
      totalConversionValue += cv;
      totalTotalConversionValue += tcv;
      totalReservationValue += rv;
      
      if (Math.abs(tcv - cv) > 0.01) {
        campaignsWithDiff.push({
          name: campaign.campaignName,
          conversion_value: cv,
          total_conversion_value: tcv,
          reservation_value: rv,
          diff: tcv - cv
        });
      }
    });
    
    console.log('📊 TOTALS:');
    console.log(`conversion_value (from API):       ${totalConversionValue.toFixed(2)} PLN`);
    console.log(`total_conversion_value (our calc): ${totalTotalConversionValue.toFixed(2)} PLN`);
    console.log(`reservation_value (from breakdown): ${totalReservationValue.toFixed(2)} PLN`);
    console.log('');
    console.log(`Expected (UI):                      184,865.28 PLN`);
    console.log(`Difference:                         ${(totalTotalConversionValue - 184865.28).toFixed(2)} PLN`);
    console.log('');
    
    if (campaignsWithDiff.length > 0) {
      console.log(`⚠️  Found ${campaignsWithDiff.length} campaigns where total_conversion_value ≠ conversion_value:`);
      console.log('-'.repeat(80));
      
      campaignsWithDiff.forEach((c, index) => {
        console.log(`${(index + 1).toString().padStart(2)}. ${c.name.substring(0, 45).padEnd(45)}`);
        console.log(`    conversion_value (API):       ${c.conversion_value.toFixed(2).padStart(12)} PLN`);
        console.log(`    total_conversion_value (calc): ${c.total_conversion_value.toFixed(2).padStart(12)} PLN`);
        console.log(`    reservation_value (breakdown): ${c.reservation_value.toFixed(2).padStart(12)} PLN`);
        console.log(`    difference:                   ${c.diff.toFixed(2).padStart(12)} PLN`);
        console.log('');
      });
    } else {
      console.log('✅ All campaigns: total_conversion_value = conversion_value');
    }
    
    console.log('🔬 DIAGNOSIS:');
    console.log('='.repeat(80));
    
    if (Math.abs(totalConversionValue - 184865.28) < 0.01) {
      console.log('✅ conversion_value (from API) matches UI exactly: 184,865.28 PLN');
      console.log('');
      if (Math.abs(totalTotalConversionValue - totalConversionValue) > 0.01) {
        console.log('❌ PROBLEM: Our total_conversion_value is ADDING extra values!');
        console.log(`   Extra added: ${(totalTotalConversionValue - totalConversionValue).toFixed(2)} PLN`);
        console.log('');
        console.log('🔧 FIX: Change line 731-735 in google-ads-api.ts to:');
        console.log('   total_conversion_value: conversionValue');
        console.log('   (Don\'t add reservation_value or allConversionsValue)');
      } else {
        console.log('✅ Our total_conversion_value matches conversion_value');
      }
    } else {
      console.log('⚠️  conversion_value from API doesn\'t match UI');
      console.log(`   API: ${totalConversionValue.toFixed(2)} PLN`);
      console.log(`   UI:  184,865.28 PLN`);
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

main().catch(console.error);

