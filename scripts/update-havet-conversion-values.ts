#!/usr/bin/env tsx
/**
 * Update Havet's conversion values in database with correct "Wartość konwersji"
 * Updates reservation_value column which displays as "łączna wartość rezerwacji"
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
  console.log('🔄 Updating Havet conversion values in database');
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
  
  console.log(`✅ Found client: ${client.name} (${client.id})`);
  console.log('');
  
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
  
  // Update November and December 2025
  const periods = [
    { month: '2025-11', start: '2025-11-01', end: '2025-11-30', expected: 184865.28 },
    { month: '2025-12', start: '2025-12-01', end: '2025-12-31', expected: 149126.00 }
  ];
  
  for (const period of periods) {
    console.log(`📊 Processing ${period.month}...`);
    console.log(`   Date range: ${period.start} to ${period.end}`);
    
    try {
      // Fetch fresh data from API
      const campaigns = await googleAdsService.getCampaignData(period.start, period.end);
      
      // Calculate total conversion_value (Wartość konwersji)
      const totalConversionValue = campaigns.reduce((sum, c) => sum + (c.conversion_value || 0), 0);
      
      console.log(`   ✅ Fetched ${campaigns.length} campaigns`);
      console.log(`   conversion_value (Wartość konwersji): ${totalConversionValue.toFixed(2)} PLN`);
      console.log(`   Expected: ${period.expected.toFixed(2)} PLN`);
      
      if (Math.abs(totalConversionValue - period.expected) > 1) {
        console.log(`   ⚠️  Warning: Value differs from expected by ${Math.abs(totalConversionValue - period.expected).toFixed(2)} PLN`);
      } else {
        console.log(`   ✅ Matches expected value!`);
      }
      
      // Update monthly summary
      const { error: monthlyError } = await supabase
        .from('campaign_summaries')
        .update({
          reservation_value: totalConversionValue, // This is displayed as "łączna wartość rezerwacji"
          last_updated: new Date().toISOString()
        })
        .eq('client_id', client.id)
        .eq('platform', 'google')
        .eq('summary_type', 'monthly')
        .eq('summary_date', period.start);
      
      if (monthlyError) {
        console.error(`   ❌ Error updating monthly: ${monthlyError.message}`);
      } else {
        console.log(`   ✅ Updated monthly summary: reservation_value = ${totalConversionValue.toFixed(2)} PLN`);
      }
      
      // Also update campaign_data with correct values
      const { data: existingSummary } = await supabase
        .from('campaign_summaries')
        .select('campaign_data')
        .eq('client_id', client.id)
        .eq('platform', 'google')
        .eq('summary_type', 'monthly')
        .eq('summary_date', period.start)
        .single();
      
      if (existingSummary && existingSummary.campaign_data) {
        // Update campaign_data with correct conversion_value
        const updatedCampaignData = Array.isArray(existingSummary.campaign_data)
          ? existingSummary.campaign_data.map((campaign: any) => {
              const matchingCampaign = campaigns.find(c => c.campaignId === String(campaign.campaignId || campaign.id));
              if (matchingCampaign) {
                return {
                  ...campaign,
                  conversion_value: matchingCampaign.conversion_value || 0,
                  total_conversion_value: matchingCampaign.conversion_value || 0
                };
              }
              return campaign;
            })
          : campaigns;
        
        const { error: updateError } = await supabase
          .from('campaign_summaries')
          .update({
            campaign_data: updatedCampaignData,
            last_updated: new Date().toISOString()
          })
          .eq('client_id', client.id)
          .eq('platform', 'google')
          .eq('summary_type', 'monthly')
          .eq('summary_date', period.start);
        
        if (updateError) {
          console.error(`   ⚠️  Error updating campaign_data: ${updateError.message}`);
        } else {
          console.log(`   ✅ Updated campaign_data with correct conversion values`);
        }
      }
      
      console.log('');
      
    } catch (error: any) {
      console.error(`   ❌ Error processing ${period.month}:`, error.message);
      console.log('');
    }
  }
  
  console.log('✅ Update complete!');
  console.log('');
  console.log('📊 Verification:');
  console.log('-'.repeat(80));
  
  // Verify the update
  const { data: summaries } = await supabase
    .from('campaign_summaries')
    .select('summary_date, reservation_value, last_updated')
    .eq('client_id', client.id)
    .eq('platform', 'google')
    .eq('summary_type', 'monthly')
    .in('summary_date', ['2025-11-01', '2025-12-01'])
    .order('summary_date', { ascending: true });
  
  if (summaries) {
    summaries.forEach(summary => {
      const date = new Date(summary.summary_date).toLocaleDateString('pl-PL', { year: 'numeric', month: 'long' });
      console.log(`${date}: ${(summary.reservation_value || 0).toFixed(2)} PLN (updated: ${new Date(summary.last_updated).toLocaleString('pl-PL')})`);
    });
  }
  
  console.log('');
  console.log('✅ These values will now appear in "łączna wartość rezerwacji" column');
}

main().catch(console.error);

