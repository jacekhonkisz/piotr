#!/usr/bin/env node
/**
 * FETCH HAVET DEMOGRAPHIC DATA FROM GOOGLE ADS API
 * 
 * This script fetches demographic data (age and gender breakdown) from Google Ads API for Havet
 * 
 * Usage: npx tsx scripts/fetch-havet-demographic-data.ts
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { GoogleAdsAPIService } from '../src/lib/google-ads-api';
import logger from '../src/lib/logger';

// Load environment variables
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchHavetDemographicData() {
  console.log('📊 FETCHING HAVET DEMOGRAPHIC DATA FROM GOOGLE ADS API\n');
  console.log('='.repeat(70));

  try {
    // 1. Get Havet client
    console.log('1️⃣ Finding Havet client...');
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name, google_ads_customer_id, google_ads_refresh_token')
      .ilike('name', '%havet%')
      .single();

    if (clientError || !client) {
      console.error('❌ Error finding Havet client:', clientError?.message);
      return;
    }

    console.log(`✅ Client found: ${client.name}`);
    console.log(`   ID: ${client.id}`);
    console.log(`   Google Ads Customer ID: ${client.google_ads_customer_id || 'NOT SET'}`);
    console.log(`   Has Refresh Token: ${client.google_ads_refresh_token ? '✅ YES' : '❌ NO'}`);
    console.log('-'.repeat(70));

    if (!client.google_ads_customer_id) {
      console.error('❌ Google Ads Customer ID not configured for Havet');
      return;
    }

    // Check for client-specific refresh token in client_settings
    const { data: clientSettings } = await supabase
      .from('client_settings')
      .select('google_ads_refresh_token')
      .eq('client_id', client.id)
      .single();

    console.log(`   Client Settings Token: ${clientSettings?.google_ads_refresh_token ? '✅ YES' : '❌ NO'}`);

    // 2. Get system settings
    console.log('\n2️⃣ Getting system settings...');
    const { data: settingsData, error: settingsError } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', [
        'google_ads_client_id',
        'google_ads_client_secret',
        'google_ads_developer_token',
        'google_ads_manager_customer_id',
        'google_ads_manager_refresh_token'
      ]);

    if (settingsError || !settingsData) {
      console.error('❌ Error fetching system settings:', settingsError?.message);
      return;
    }

    const settings: Record<string, string> = {};
    settingsData.forEach((item: any) => {
      settings[item.key] = item.value;
    });

    if (!settings.google_ads_client_id || !settings.google_ads_client_secret || !settings.google_ads_developer_token) {
      console.error('❌ Missing required Google Ads system settings');
      return;
    }

    console.log('✅ System settings retrieved');
    console.log(`   Manager Refresh Token: ${settings.google_ads_manager_refresh_token ? '✅ YES' : '❌ NO'}`);
    console.log('-'.repeat(70));

    // Use client-specific token, client table token, or manager token as fallback
    const finalRefreshToken = clientSettings?.google_ads_refresh_token || 
                              client.google_ads_refresh_token || 
                              settings.google_ads_manager_refresh_token;
    
    if (!finalRefreshToken) {
      console.error('❌ No refresh token available (neither client-specific nor manager token)');
      console.log('   Please configure a refresh token in:');
      console.log('   - client_settings.google_ads_refresh_token');
      console.log('   - clients.google_ads_refresh_token');
      console.log('   - system_settings.google_ads_manager_refresh_token');
      return;
    }

    console.log(`✅ Using refresh token: ${finalRefreshToken ? '✅ FOUND' : '❌ NOT FOUND'}`);

    // 3. Initialize Google Ads API service
    console.log('\n3️⃣ Initializing Google Ads API service...');
    const googleAdsService = new GoogleAdsAPIService({
      customerId: client.google_ads_customer_id,
      refreshToken: finalRefreshToken,
      clientId: settings.google_ads_client_id,
      clientSecret: settings.google_ads_client_secret,
      developmentToken: settings.google_ads_developer_token,
      managerCustomerId: settings.google_ads_manager_customer_id
    });

    console.log('✅ Google Ads API service initialized');
    console.log('-'.repeat(70));

    // 4. Fetch demographic data for last 30 days
    console.log('\n4️⃣ Fetching demographic data...');
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const dateStart = startDate.toISOString().split('T')[0];
    const dateEnd = endDate.toISOString().split('T')[0];

    console.log(`   Date range: ${dateStart} to ${dateEnd}`);

    const demographicData = await googleAdsService.getDemographicPerformance(dateStart, dateEnd);

    console.log(`✅ Fetched ${demographicData.length} demographic segments`);
    console.log('-'.repeat(70));

    // 5. Display results
    console.log('\n📊 DEMOGRAPHIC DATA RESULTS FOR HAVET\n');
    console.log('='.repeat(70));

    if (demographicData.length === 0) {
      console.log('⚠️  No demographic data available for the selected period');
      console.log('   This could mean:');
      console.log('   - No campaigns running in this period');
      console.log('   - Demographic data not available for this account');
      console.log('   - Date range has no data');
      return;
    }

    // Group by age and gender for summary
    const ageSummary: Record<string, {
      spend: number;
      impressions: number;
      clicks: number;
      conversions: number;
      conversion_value: number;
    }> = {};
    const genderSummary: Record<string, {
      spend: number;
      impressions: number;
      clicks: number;
      conversions: number;
      conversion_value: number;
    }> = {};
    let totalSpend = 0;
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalConversions = 0;
    let totalConversionValue = 0;

    demographicData.forEach(item => {
      // Age summary
      if (!ageSummary[item.age_range]) {
        ageSummary[item.age_range] = {
          spend: 0,
          impressions: 0,
          clicks: 0,
          conversions: 0,
          conversion_value: 0
        };
      }
      ageSummary[item.age_range].spend += item.spend;
      ageSummary[item.age_range].impressions += item.impressions;
      ageSummary[item.age_range].clicks += item.clicks;
      ageSummary[item.age_range].conversions += item.conversions;
      ageSummary[item.age_range].conversion_value += item.conversion_value;

      // Gender summary
      if (!genderSummary[item.gender]) {
        genderSummary[item.gender] = {
          spend: 0,
          impressions: 0,
          clicks: 0,
          conversions: 0,
          conversion_value: 0
        };
      }
      genderSummary[item.gender].spend += item.spend;
      genderSummary[item.gender].impressions += item.impressions;
      genderSummary[item.gender].clicks += item.clicks;
      genderSummary[item.gender].conversions += item.conversions;
      genderSummary[item.gender].conversion_value += item.conversion_value;

      // Totals
      totalSpend += item.spend;
      totalImpressions += item.impressions;
      totalClicks += item.clicks;
      totalConversions += item.conversions;
      totalConversionValue += item.conversion_value;
    });

    // Display age breakdown
    console.log('\n📈 AGE BREAKDOWN:');
    console.log('-'.repeat(70));
    const ageEntries = Object.entries(ageSummary).sort((a, b) => b[1].spend - a[1].spend);
    ageEntries.forEach(([age, stats]) => {
      const ctr = stats.impressions > 0 ? ((stats.clicks / stats.impressions) * 100).toFixed(2) : '0.00';
      const cpc = stats.clicks > 0 ? (stats.spend / stats.clicks).toFixed(2) : '0.00';
      const roas = stats.spend > 0 ? (stats.conversion_value / stats.spend).toFixed(2) : '0.00';
      const spendPercent = totalSpend > 0 ? ((stats.spend / totalSpend) * 100).toFixed(1) : '0.0';
      
      console.log(`\n${age}:`);
      console.log(`  Spend: ${stats.spend.toFixed(2)} PLN (${spendPercent}%)`);
      console.log(`  Impressions: ${stats.impressions.toLocaleString()}`);
      console.log(`  Clicks: ${stats.clicks.toLocaleString()}`);
      console.log(`  CTR: ${ctr}%`);
      console.log(`  CPC: ${cpc} PLN`);
      console.log(`  Conversions: ${stats.conversions.toFixed(0)}`);
      console.log(`  Conversion Value: ${stats.conversion_value.toFixed(2)} PLN`);
      console.log(`  ROAS: ${roas}x`);
    });

    // Display gender breakdown
    console.log('\n\n👥 GENDER BREAKDOWN:');
    console.log('-'.repeat(70));
    const genderEntries = Object.entries(genderSummary).sort((a, b) => b[1].spend - a[1].spend);
    genderEntries.forEach(([gender, stats]) => {
      const ctr = stats.impressions > 0 ? ((stats.clicks / stats.impressions) * 100).toFixed(2) : '0.00';
      const cpc = stats.clicks > 0 ? (stats.spend / stats.clicks).toFixed(2) : '0.00';
      const roas = stats.spend > 0 ? (stats.conversion_value / stats.spend).toFixed(2) : '0.00';
      const spendPercent = totalSpend > 0 ? ((stats.spend / totalSpend) * 100).toFixed(1) : '0.0';
      
      console.log(`\n${gender}:`);
      console.log(`  Spend: ${stats.spend.toFixed(2)} PLN (${spendPercent}%)`);
      console.log(`  Impressions: ${stats.impressions.toLocaleString()}`);
      console.log(`  Clicks: ${stats.clicks.toLocaleString()}`);
      console.log(`  CTR: ${ctr}%`);
      console.log(`  CPC: ${cpc} PLN`);
      console.log(`  Conversions: ${stats.conversions.toFixed(0)}`);
      console.log(`  Conversion Value: ${stats.conversion_value.toFixed(2)} PLN`);
      console.log(`  ROAS: ${roas}x`);
    });

    // Display totals
    console.log('\n\n📊 TOTALS:');
    console.log('-'.repeat(70));
    const totalCTR = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0.00';
    const totalCPC = totalClicks > 0 ? (totalSpend / totalClicks).toFixed(2) : '0.00';
    const totalROAS = totalSpend > 0 ? (totalConversionValue / totalSpend).toFixed(2) : '0.00';
    
    console.log(`Total Spend: ${totalSpend.toFixed(2)} PLN`);
    console.log(`Total Impressions: ${totalImpressions.toLocaleString()}`);
    console.log(`Total Clicks: ${totalClicks.toLocaleString()}`);
    console.log(`Total CTR: ${totalCTR}%`);
    console.log(`Total CPC: ${totalCPC} PLN`);
    console.log(`Total Conversions: ${totalConversions.toFixed(0)}`);
    console.log(`Total Conversion Value: ${totalConversionValue.toFixed(2)} PLN`);
    console.log(`Total ROAS: ${totalROAS}x`);

    // Display detailed breakdown
    console.log('\n\n📋 DETAILED BREAKDOWN (Age × Gender):');
    console.log('-'.repeat(70));
    demographicData
      .sort((a, b) => b.spend - a.spend)
      .forEach((item, index) => {
        console.log(`\n${index + 1}. ${item.age_range} × ${item.gender}:`);
        console.log(`   Spend: ${item.spend.toFixed(2)} PLN`);
        console.log(`   Impressions: ${item.impressions.toLocaleString()}`);
        console.log(`   Clicks: ${item.clicks.toLocaleString()}`);
        console.log(`   CTR: ${item.ctr.toFixed(2)}%`);
        console.log(`   CPC: ${item.cpc.toFixed(2)} PLN`);
        console.log(`   Conversions: ${item.conversions.toFixed(0)}`);
        console.log(`   Conversion Value: ${item.conversion_value.toFixed(2)} PLN`);
        console.log(`   ROAS: ${item.roas.toFixed(2)}x`);
      });

    console.log('\n' + '='.repeat(70));
    console.log('✅ Demographic data fetch completed successfully!');
    console.log('='.repeat(70));

  } catch (error: any) {
    console.error('\n❌ Error fetching demographic data:', error);
    console.error('Stack:', error.stack);
  }
}

// Run the script
fetchHavetDemographicData()
  .then(() => {
    console.log('\n✨ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

