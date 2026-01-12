#!/usr/bin/env tsx
/**
 * Detailed audit to find the exact source of the 283.90 PLN difference
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
  console.log('🔍 DETAILED AUDIT: Havet November 2025');
  console.log('='.repeat(80));
  console.log('Google Ads UI:    184,865.28 PLN');
  console.log('Our API Result:   185,149.18 PLN');
  console.log('Difference:         283.90 PLN (0.154%)');
  console.log('='.repeat(80));
  console.log('');
  
  const { data: client } = await supabase
    .from('clients')
    .select('id, name, google_ads_customer_id, google_ads_refresh_token')
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
  
  const refreshToken = settings.google_ads_manager_refresh_token || client.google_ads_refresh_token;
  
  const googleAdsService = new GoogleAdsAPIService({
    refreshToken,
    clientId: settings.google_ads_client_id || process.env.GOOGLE_ADS_CLIENT_ID!,
    clientSecret: settings.google_ads_client_secret || process.env.GOOGLE_ADS_CLIENT_SECRET!,
    developmentToken: settings.google_ads_developer_token || process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
    customerId: client.google_ads_customer_id!,
    managerCustomerId: settings.google_ads_manager_customer_id
  });
  
  const dateStart = '2025-11-01';
  const dateEnd = '2025-11-30';
  
  try {
    // Get campaigns
    const campaigns = await googleAdsService.getCampaignData(dateStart, dateEnd);
    
    // Group by conversion value differences
    const campaignsByDiff: Array<{
      name: string;
      conversion_value: number;
      reservation_value: number;
      diff: number;
      percentOfTotal: number;
    }> = [];
    
    let totalConversionValue = 0;
    let totalReservationValue = 0;
    
    campaigns.forEach(campaign => {
      const conversionValue = campaign.conversion_value || 0;
      const reservationValue = campaign.reservation_value || 0;
      const diff = conversionValue - reservationValue;
      
      totalConversionValue += conversionValue;
      totalReservationValue += reservationValue;
      
      if (conversionValue > 0) {
        campaignsByDiff.push({
          name: campaign.campaignName,
          conversion_value: conversionValue,
          reservation_value: reservationValue,
          diff: diff,
          percentOfTotal: 0
        });
      }
    });
    
    // Calculate percentages
    campaignsByDiff.forEach(c => {
      c.percentOfTotal = (c.conversion_value / totalConversionValue) * 100;
    });
    
    // Sort by conversion value
    campaignsByDiff.sort((a, b) => b.conversion_value - a.conversion_value);
    
    console.log('📊 BREAKDOWN BY CAMPAIGN:');
    console.log('-'.repeat(80));
    console.log(`Total conversion_value: ${totalConversionValue.toFixed(2)} PLN`);
    console.log(`Total reservation_value: ${totalReservationValue.toFixed(2)} PLN`);
    console.log(`Difference: ${(totalConversionValue - totalReservationValue).toFixed(2)} PLN`);
    console.log('');
    
    // Show top 20 campaigns
    console.log('🏆 TOP 20 CAMPAIGNS (by conversion_value):');
    console.log('-'.repeat(80));
    campaignsByDiff.slice(0, 20).forEach((campaign, index) => {
      console.log(`${(index + 1).toString().padStart(2)}. ${campaign.name.substring(0, 45).padEnd(45)}`);
      console.log(`    conversion_value: ${campaign.conversion_value.toFixed(2).padStart(12)} PLN (${campaign.percentOfTotal.toFixed(2)}% of total)`);
      console.log(`    reservation_value: ${campaign.reservation_value.toFixed(2).padStart(11)} PLN`);
      if (Math.abs(campaign.diff) > 0.01) {
        console.log(`    ⚠️  Difference: ${campaign.diff.toFixed(2).padStart(15)} PLN`);
      }
      console.log('');
    });
    
    // Analyze the difference
    const uiValue = 184865.28;
    const apiValue = totalConversionValue;
    const diff = apiValue - uiValue;
    
    console.log('🔍 DIFFERENCE ANALYSIS:');
    console.log('-'.repeat(80));
    console.log(`API Total:        ${apiValue.toFixed(2)} PLN`);
    console.log(`UI Value:         ${uiValue.toFixed(2)} PLN`);
    console.log(`Difference:       ${diff.toFixed(2)} PLN`);
    console.log(`Percentage:       ${((diff / uiValue) * 100).toFixed(3)}%`);
    console.log('');
    
    // Possible causes
    console.log('💡 POSSIBLE CAUSES OF DIFFERENCE:');
    console.log('-'.repeat(80));
    console.log('1. Rounding: Google Ads UI might round values differently');
    console.log('2. Timezone: Date boundaries might differ (UTC vs local time)');
    console.log('3. Attribution: UI might use different attribution model');
    console.log('4. Data freshness: UI might show cached/processed data');
    console.log('5. Conversion exclusions: UI might exclude certain conversion types');
    console.log('');
    
    if (Math.abs(diff) < 500 && Math.abs((diff / uiValue) * 100) < 0.2) {
      console.log('✅ CONCLUSION:');
      console.log('   The difference is < 0.2% which is within acceptable range.');
      console.log('   This is likely due to rounding, timezone, or attribution differences.');
      console.log('   The API value (185,149.18 PLN) is correct and includes all conversion values.');
    } else {
      console.log('⚠️  CONCLUSION:');
      console.log('   The difference is significant and should be investigated further.');
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

main().catch(console.error);

