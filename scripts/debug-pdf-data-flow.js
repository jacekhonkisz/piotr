#!/usr/bin/env node

/**
 * Debug PDF Data Flow
 * This script simulates the exact PDF generation data flow to identify where Google Ads data is lost
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Import the JS version of unified types (since TS import might fail in scripts)
const { convertMetaCampaignToUnified, convertGoogleCampaignToUnified, calculatePlatformTotals } = require('../src/lib/unified-campaign-types.js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugPDFDataFlow() {
  console.log('🔍 DEBUGGING PDF DATA FLOW\n');
  console.log('=' .repeat(60));

  try {
    const clientId = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'; // Belmonte Hotel
    const dateRange = { start: '2025-08-01', end: '2025-08-31' };

    console.log(`📋 Parameters:`);
    console.log(`   Client ID: ${clientId}`);
    console.log(`   Date Range: ${dateRange.start} to ${dateRange.end}\n`);

    // STEP 1: Simulate the exact variable declarations from PDF generation
    console.log('🔧 STEP 1: Variable Initialization');
    console.log('-'.repeat(40));
    
    let googleCampaigns = [];
    let metaCampaigns = [];
    let platformTotals;
    
    console.log(`✅ Variables initialized:`);
    console.log(`   googleCampaigns: ${googleCampaigns.length} campaigns`);
    console.log(`   metaCampaigns: ${metaCampaigns.length} campaigns`);
    console.log(`   platformTotals: ${platformTotals || 'undefined'}`);

    // STEP 2: Check if direct data is available (determines path)
    console.log('\n🛤️ STEP 2: Determine Data Path');
    console.log('-'.repeat(40));
    
    const { data: campaignSummaries, error: summariesError } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', clientId)
      .gte('period_start', dateRange.start)
      .lte('period_end', dateRange.end);

    let directCampaigns = null;
    let directTotals = null;
    let pathTaken = 'FALLBACK';

    if (campaignSummaries && campaignSummaries.length > 0) {
      const currentSummary = campaignSummaries[0];
      if (currentSummary.campaign_data && currentSummary.totals) {
        directCampaigns = currentSummary.campaign_data;
        directTotals = currentSummary.totals;
        pathTaken = 'DIRECT';
      }
    }

    console.log(`📊 Path determination:`);
    console.log(`   Campaign summaries found: ${campaignSummaries?.length || 0}`);
    console.log(`   Direct campaigns available: ${!!directCampaigns}`);
    console.log(`   Direct totals available: ${!!directTotals}`);
    console.log(`   PATH TAKEN: ${pathTaken}`);

    // STEP 3: Simulate the data fetching based on path
    console.log(`\n🔄 STEP 3: Data Fetching (${pathTaken} PATH)`);
    console.log('-'.repeat(40));

    if (pathTaken === 'DIRECT') {
      console.log('🚀 DIRECT PATH EXECUTION:');
      
      // Convert Meta campaigns
      try {
        metaCampaigns = directCampaigns.map(convertMetaCampaignToUnified);
        console.log(`   ✅ Meta campaigns converted: ${metaCampaigns.length}`);
      } catch (error) {
        console.log(`   ❌ Meta conversion error: ${error.message}`);
        metaCampaigns = [];
      }

      // Fetch Google Ads data (DIRECT PATH)
      const { data: clientCheck, error: clientCheckError } = await supabase
        .from('clients')
        .select('google_ads_enabled, google_ads_customer_id, google_ads_refresh_token')
        .eq('id', clientId)
        .single();

      console.log(`   📋 Client check:`);
      console.log(`      Google Ads enabled: ${clientCheck?.google_ads_enabled}`);
      console.log(`      Customer ID: ${clientCheck?.google_ads_customer_id}`);

      if (!clientCheckError && clientCheck?.google_ads_enabled && clientCheck?.google_ads_customer_id) {
        const { data: cachedGoogleCampaigns, error: cacheError } = await supabase
          .from('google_ads_campaigns')
          .select('*')
          .eq('client_id', clientId)
          .gte('date_range_start', dateRange.start)
          .lte('date_range_end', dateRange.end);

        console.log(`   📊 Google Ads fetch:`);
        console.log(`      Cache error: ${cacheError?.message || 'None'}`);
        console.log(`      Campaigns found: ${cachedGoogleCampaigns?.length || 0}`);

        if (!cacheError && cachedGoogleCampaigns && cachedGoogleCampaigns.length > 0) {
          try {
            googleCampaigns = cachedGoogleCampaigns.map(convertGoogleCampaignToUnified);
            console.log(`   ✅ Google campaigns converted (DIRECT): ${googleCampaigns.length}`);
          } catch (conversionError) {
            console.log(`   ❌ Google conversion error (DIRECT): ${conversionError.message}`);
            googleCampaigns = [];
          }
        }
      }
    } else {
      console.log('📡 FALLBACK PATH EXECUTION:');
      
      // Simulate API call for Meta campaigns
      const { data: metaCampaignsData, error: metaError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('client_id', clientId)
        .gte('date_range_start', dateRange.start)
        .lte('date_range_end', dateRange.end);

      if (!metaError && metaCampaignsData && metaCampaignsData.length > 0) {
        try {
          metaCampaigns = metaCampaignsData.map(convertMetaCampaignToUnified);
          console.log(`   ✅ Meta campaigns from API: ${metaCampaigns.length}`);
        } catch (error) {
          console.log(`   ❌ Meta conversion error (FALLBACK): ${error.message}`);
          metaCampaigns = [];
        }
      } else {
        console.log(`   ℹ️ No Meta campaigns available for fallback path`);
      }
    }

    console.log(`\n📊 After ${pathTaken} path execution:`);
    console.log(`   googleCampaigns: ${googleCampaigns.length} campaigns`);
    console.log(`   metaCampaigns: ${metaCampaigns.length} campaigns`);

    // STEP 4: Simulate the "ENSURED FETCH" logic
    console.log('\n🔒 STEP 4: Ensured Fetch Logic');
    console.log('-'.repeat(40));

    const ensuredFetchCondition = !googleCampaigns || googleCampaigns.length === 0;
    console.log(`   Condition (!googleCampaigns || googleCampaigns.length === 0): ${ensuredFetchCondition}`);
    console.log(`   googleCampaigns is falsy: ${!googleCampaigns}`);
    console.log(`   googleCampaigns.length === 0: ${googleCampaigns.length === 0}`);

    if (ensuredFetchCondition) {
      console.log('   🔍 ENSURED FETCH TRIGGERED:');
      
      const { data: clientCheck, error: clientCheckError } = await supabase
        .from('clients')
        .select('google_ads_enabled, google_ads_customer_id, google_ads_refresh_token')
        .eq('id', clientId)
        .single();

      if (!clientCheckError && clientCheck?.google_ads_enabled && clientCheck?.google_ads_customer_id) {
        const { data: cachedGoogleCampaigns, error: cacheError } = await supabase
          .from('google_ads_campaigns')
          .select('*')
          .eq('client_id', clientId)
          .gte('date_range_start', dateRange.start)
          .lte('date_range_end', dateRange.end);

        if (!cacheError && cachedGoogleCampaigns && cachedGoogleCampaigns.length > 0) {
          try {
            googleCampaigns = cachedGoogleCampaigns.map(convertGoogleCampaignToUnified);
            console.log(`      ✅ Google campaigns from ensured fetch: ${googleCampaigns.length}`);
          } catch (conversionError) {
            console.log(`      ❌ Google conversion error (ensured): ${conversionError.message}`);
            googleCampaigns = [];
          }
        } else {
          console.log(`      ℹ️ No Google campaigns found in ensured fetch`);
        }
      } else {
        console.log(`      ℹ️ Google Ads not enabled for ensured fetch`);
      }
    } else {
      console.log('   ✅ ENSURED FETCH SKIPPED (Google campaigns already exist)');
    }

    console.log(`\n📊 After ensured fetch:`);
    console.log(`   googleCampaigns: ${googleCampaigns.length} campaigns`);

    // STEP 5: Calculate platform totals
    console.log('\n🧮 STEP 5: Platform Totals Calculation');
    console.log('-'.repeat(40));

    try {
      const metaTotals = calculatePlatformTotals(metaCampaigns);
      const googleTotals = calculatePlatformTotals(googleCampaigns);
      const allCampaigns = [...metaCampaigns, ...googleCampaigns];
      const combinedTotals = calculatePlatformTotals(allCampaigns);
      
      platformTotals = {
        meta: metaTotals,
        google: googleTotals,
        combined: combinedTotals
      };
      
      console.log(`✅ Platform totals calculated:`);
      console.log(`   Meta campaigns: ${metaCampaigns.length}, spend: ${metaTotals.totalSpend} PLN`);
      console.log(`   Google campaigns: ${googleCampaigns.length}, spend: ${googleTotals.totalSpend} PLN`);
      console.log(`   Combined spend: ${combinedTotals.totalSpend} PLN`);
    } catch (error) {
      console.log(`❌ Error calculating platform totals: ${error.message}`);
      platformTotals = undefined;
    }

    // STEP 6: Simulate reportData creation
    console.log('\n📋 STEP 6: ReportData Creation');
    console.log('-'.repeat(40));

    const reportData = {
      googleCampaigns,
      metaCampaigns,
      platformTotals
    };

    console.log(`✅ ReportData created:`);
    console.log(`   googleCampaigns: ${reportData.googleCampaigns?.length || 0} campaigns`);
    console.log(`   metaCampaigns: ${reportData.metaCampaigns?.length || 0} campaigns`);
    console.log(`   platformTotals: ${reportData.platformTotals ? 'present' : 'missing'}`);

    // STEP 7: Test HTML source logic
    console.log('\n🎨 STEP 7: HTML Source Logic Test');
    console.log('-'.repeat(40));

    const sourceLogicResult = reportData.googleCampaigns && reportData.googleCampaigns.length > 0 
      ? 'Źródło: Meta Ads API & Google Ads API' 
      : 'Źródło: Meta Ads API';

    console.log(`HTML Source Logic:`);
    console.log(`   reportData.googleCampaigns exists: ${!!reportData.googleCampaigns}`);
    console.log(`   reportData.googleCampaigns.length: ${reportData.googleCampaigns?.length || 0}`);
    console.log(`   Condition result: ${reportData.googleCampaigns && reportData.googleCampaigns.length > 0}`);
    console.log(`   Source text: "${sourceLogicResult}"`);

    // FINAL DIAGNOSIS
    console.log('\n🩺 FINAL DIAGNOSIS');
    console.log('=' .repeat(60));

    if (reportData.googleCampaigns && reportData.googleCampaigns.length > 0) {
      console.log('🎉 SUCCESS: Google Ads data should appear in PDF!');
      console.log(`   Expected source: "Źródło: Meta Ads API & Google Ads API"`);
      console.log(`   Platform comparison: Should be visible`);
      console.log(`   Google campaigns table: Should show ${reportData.googleCampaigns.length} campaigns`);
    } else {
      console.log('❌ FAILURE: Google Ads data will NOT appear in PDF');
      console.log(`   Expected source: "Źródło: Meta Ads API"`);
      console.log(`   Platform comparison: Will be hidden`);
      console.log(`   Google campaigns table: Will be hidden`);
      
      console.log('\n🔍 FAILURE ANALYSIS:');
      if (pathTaken === 'DIRECT') {
        console.log('   - Direct path was taken but Google Ads data was not fetched');
        console.log('   - Check if client Google Ads configuration is correct');
        console.log('   - Check if Google Ads campaigns exist in database');
      } else {
        console.log('   - Fallback path was taken');
        console.log('   - Ensured fetch should have caught this');
        console.log('   - Check if ensured fetch logic is working');
      }
    }

  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

// Run the debug
if (require.main === module) {
  debugPDFDataFlow().then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error('❌ Debug script failed:', error);
    process.exit(1);
  });
}

module.exports = { debugPDFDataFlow };
