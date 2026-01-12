#!/usr/bin/env tsx
/**
 * Audit the difference between API value and Google Ads UI value for Havet November 2025
 * API shows: 185,149.18 PLN
 * UI shows: 184,865.28 PLN
 * Difference: 283.90 PLN
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
  console.log('🔍 AUDIT: Havet November 2025 Conversion Value Difference');
  console.log('='.repeat(80));
  console.log('Expected (Google Ads UI): 184,865.28 PLN');
  console.log('API Result:               185,149.18 PLN');
  console.log('Difference:                 283.90 PLN');
  console.log('='.repeat(80));
  console.log('');
  
  // Get Havet client
  const { data: client } = await supabase
    .from('clients')
    .select('id, name, google_ads_customer_id, google_ads_refresh_token')
    .eq('name', 'Havet')
    .single();
  
  if (!client) {
    console.error('❌ Client not found');
    return;
  }
  
  // Get system settings
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
  
  console.log('📊 Fetching raw API data...');
  console.log('');
  
  try {
    // Get raw campaign data to inspect
    const campaigns = await googleAdsService.getCampaignData(dateStart, dateEnd);
    
    // Calculate totals
    let totalConversionValue = 0;
    let totalAllConversionsValue = 0;
    let totalReservationValue = 0;
    let totalConversions = 0;
    let totalAllConversions = 0;
    
    const campaignBreakdown: Array<{
      name: string;
      conversion_value: number;
      all_conversions_value: number;
      reservation_value: number;
      conversions: number;
      all_conversions: number;
      difference: number;
    }> = [];
    
    campaigns.forEach(campaign => {
      const conversionValue = campaign.conversion_value || 0;
      const allConversionsValue = (campaign as any).all_conversions_value || 0;
      const reservationValue = campaign.reservation_value || 0;
      const conversions = campaign.conversions || 0;
      const allConversions = (campaign as any).all_conversions || conversions;
      
      totalConversionValue += conversionValue;
      totalAllConversionsValue += allConversionsValue;
      totalReservationValue += reservationValue;
      totalConversions += conversions;
      totalAllConversions += allConversions;
      
      // Check if this campaign has a difference between conversion_value and reservation_value
      const diff = conversionValue - reservationValue;
      if (Math.abs(diff) > 0.01 || conversionValue > 0) {
        campaignBreakdown.push({
          name: campaign.campaignName,
          conversion_value: conversionValue,
          all_conversions_value: allConversionsValue,
          reservation_value: reservationValue,
          conversions: conversions,
          all_conversions: allConversions,
          difference: diff
        });
      }
    });
    
    console.log('📊 SUMMARY:');
    console.log('-'.repeat(80));
    console.log(`Total conversion_value:      ${totalConversionValue.toFixed(2)} PLN`);
    console.log(`Total all_conversions_value:  ${totalAllConversionsValue.toFixed(2)} PLN`);
    console.log(`Total reservation_value:      ${totalReservationValue.toFixed(2)} PLN`);
    console.log(`Total conversions:           ${totalConversions.toFixed(2)}`);
    console.log(`Total all_conversions:        ${totalAllConversions.toFixed(2)}`);
    console.log('');
    console.log(`Expected (UI):                ${184865.28.toFixed(2)} PLN`);
    console.log(`Actual (API):                 ${totalConversionValue.toFixed(2)} PLN`);
    console.log(`Difference:                  ${(totalConversionValue - 184865.28).toFixed(2)} PLN`);
    console.log('');
    
    // Show campaigns with differences
    console.log('🔍 CAMPAIGNS WITH conversion_value > reservation_value:');
    console.log('(These might include form conversions)');
    console.log('-'.repeat(80));
    const campaignsWithDiff = campaignBreakdown
      .filter(c => Math.abs(c.difference) > 0.01)
      .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
    
    if (campaignsWithDiff.length === 0) {
      console.log('   No campaigns with differences found');
    } else {
      campaignsWithDiff.forEach((campaign, index) => {
        console.log(`${(index + 1).toString().padStart(2)}. ${campaign.name.substring(0, 50).padEnd(50)}`);
        console.log(`    conversion_value: ${campaign.conversion_value.toFixed(2).padStart(12)} PLN`);
        console.log(`    reservation_value: ${campaign.reservation_value.toFixed(2).padStart(11)} PLN`);
        console.log(`    difference: ${campaign.difference.toFixed(2).padStart(15)} PLN`);
        console.log('');
      });
    }
    
    // Check if we're using the right metric
    console.log('🔍 METRIC COMPARISON:');
    console.log('-'.repeat(80));
    console.log(`conversion_value (conversions_value):     ${totalConversionValue.toFixed(2)} PLN`);
    console.log(`all_conversions_value:                    ${totalAllConversionsValue.toFixed(2)} PLN`);
    console.log(`Difference:                               ${(totalAllConversionsValue - totalConversionValue).toFixed(2)} PLN`);
    console.log('');
    console.log('💡 Google Ads UI might be using:');
    console.log('   - A different attribution model');
    console.log('   - A different date range (timezone differences)');
    console.log('   - Filtered data (excluded certain conversion types)');
    console.log('   - Rounded values');
    console.log('');
    
    // Check if the difference matches any specific pattern
    const diff = totalConversionValue - 184865.28;
    const percentDiff = (diff / 184865.28) * 100;
    console.log('📊 DIFFERENCE ANALYSIS:');
    console.log('-'.repeat(80));
    console.log(`Absolute difference: ${Math.abs(diff).toFixed(2)} PLN`);
    console.log(`Percentage difference: ${Math.abs(percentDiff).toFixed(3)}%`);
    
    if (Math.abs(percentDiff) < 0.2) {
      console.log('✅ Difference is < 0.2% - likely due to:');
      console.log('   - Rounding differences');
      console.log('   - Timezone/date boundary differences');
      console.log('   - Attribution model differences');
    } else {
      console.log('⚠️  Difference is > 0.2% - investigating...');
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

main().catch(console.error);

