#!/usr/bin/env node

/**
 * Comprehensive PDF Generation Audit
 * This script audits the entire PDF generation flow to identify why Google Ads isn't showing
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function comprehensivePDFAudit() {
  console.log('🔍 COMPREHENSIVE PDF GENERATION AUDIT\n');
  console.log('=' .repeat(60));

  try {
    const clientId = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'; // Belmonte Hotel
    const dateRange = { start: '2025-08-01', end: '2025-08-31' };

    // AUDIT 1: Client Configuration
    console.log('\n📋 AUDIT 1: Client Configuration');
    console.log('-'.repeat(40));
    
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      console.error('❌ CRITICAL: Client not found:', clientError);
      return;
    }

    console.log(`✅ Client: ${client.name}`);
    console.log(`   ID: ${client.id}`);
    console.log(`   Google Ads enabled: ${client.google_ads_enabled}`);
    console.log(`   Google Ads customer ID: ${client.google_ads_customer_id}`);
    console.log(`   Google Ads refresh token: ${client.google_ads_refresh_token ? 'Present' : 'Missing'}`);
    console.log(`   Ad account ID: ${client.ad_account_id}`);

    // AUDIT 2: Database Data Availability
    console.log('\n📊 AUDIT 2: Database Data Availability');
    console.log('-'.repeat(40));

    // Check Meta campaigns
    const { data: metaCampaigns, error: metaError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('client_id', clientId)
      .gte('date_range_start', dateRange.start)
      .lte('date_range_end', dateRange.end);

    console.log(`Meta Campaigns (campaigns table):`);
    console.log(`   Found: ${metaCampaigns?.length || 0} campaigns`);
    if (metaError) console.log(`   Error: ${metaError.message}`);

    // Check Google Ads campaigns
    const { data: googleCampaigns, error: googleError } = await supabase
      .from('google_ads_campaigns')
      .select('*')
      .eq('client_id', clientId)
      .gte('date_range_start', dateRange.start)
      .lte('date_range_end', dateRange.end);

    console.log(`Google Ads Campaigns (google_ads_campaigns table):`);
    console.log(`   Found: ${googleCampaigns?.length || 0} campaigns`);
    if (googleError) console.log(`   Error: ${googleError.message}`);

    if (googleCampaigns && googleCampaigns.length > 0) {
      console.log(`   Sample Google campaign:`, {
        name: googleCampaigns[0].campaign_name,
        spend: googleCampaigns[0].spend,
        impressions: googleCampaigns[0].impressions,
        reservations: googleCampaigns[0].reservations
      });
    }

    // Check campaign summaries (for direct data path)
    const { data: campaignSummaries, error: summariesError } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', clientId)
      .gte('period_start', dateRange.start)
      .lte('period_end', dateRange.end);

    console.log(`Campaign Summaries (campaign_summaries table):`);
    console.log(`   Found: ${campaignSummaries?.length || 0} summaries`);
    if (summariesError) console.log(`   Error: ${summariesError.message}`);

    // AUDIT 3: PDF Generation Path Detection
    console.log('\n🛤️ AUDIT 3: PDF Generation Path Detection');
    console.log('-'.repeat(40));

    // Simulate the PDF generation logic to see which path it takes
    let directCampaigns = null;
    let directTotals = null;
    let directMetaTables = null;

    // Check if direct data is available (this determines the path)
    if (campaignSummaries && campaignSummaries.length > 0) {
      const currentSummary = campaignSummaries[0];
      if (currentSummary.campaign_data && currentSummary.totals) {
        directCampaigns = currentSummary.campaign_data;
        directTotals = currentSummary.totals;
        console.log(`✅ DIRECT DATA PATH will be taken`);
        console.log(`   Campaigns from summary: ${directCampaigns.length}`);
        console.log(`   Totals available: ${!!directTotals}`);
      } else {
        console.log(`⚠️ FALLBACK PATH will be taken (summary exists but no campaign_data)`);
      }
    } else {
      console.log(`⚠️ FALLBACK PATH will be taken (no campaign summaries found)`);
    }

    // AUDIT 4: Test Both Data Paths
    console.log('\n🔀 AUDIT 4: Testing Both Data Paths');
    console.log('-'.repeat(40));

    // Test Direct Path Logic
    if (directCampaigns && directTotals) {
      console.log(`\n🚀 TESTING DIRECT PATH:`);
      
      // This is the logic from the PDF generation
      let googleCampaignsFromDirect = [];
      let metaCampaignsFromDirect = [];

      // Convert Meta campaigns
      try {
        const { convertMetaCampaignToUnified } = require('../src/lib/unified-campaign-types');
        metaCampaignsFromDirect = directCampaigns.map(convertMetaCampaignToUnified);
        console.log(`   ✅ Meta campaigns converted: ${metaCampaignsFromDirect.length}`);
      } catch (error) {
        console.log(`   ❌ Meta conversion error: ${error.message}`);
      }

      // Google Ads fetching logic from direct path
      if (client.google_ads_enabled && client.google_ads_customer_id) {
        const { data: cachedGoogleCampaigns, error: cacheError } = await supabase
          .from('google_ads_campaigns')
          .select('*')
          .eq('client_id', clientId)
          .gte('date_range_start', dateRange.start)
          .lte('date_range_end', dateRange.end);
        
        if (!cacheError && cachedGoogleCampaigns && cachedGoogleCampaigns.length > 0) {
          try {
            const { convertGoogleCampaignToUnified } = require('../src/lib/unified-campaign-types');
            googleCampaignsFromDirect = cachedGoogleCampaigns.map(convertGoogleCampaignToUnified);
            console.log(`   ✅ Google campaigns fetched and converted: ${googleCampaignsFromDirect.length}`);
          } catch (conversionError) {
            console.log(`   ❌ Google conversion error: ${conversionError.message}`);
          }
        } else {
          console.log(`   ⚠️ No Google campaigns found or cache error: ${cacheError?.message || 'No data'}`);
        }
      } else {
        console.log(`   ⚠️ Google Ads not enabled for client`);
      }

      console.log(`   DIRECT PATH RESULT:`);
      console.log(`     Meta campaigns: ${metaCampaignsFromDirect.length}`);
      console.log(`     Google campaigns: ${googleCampaignsFromDirect.length}`);
      console.log(`     Should show unified source: ${googleCampaignsFromDirect.length > 0}`);
    }

    // Test Fallback Path Logic
    console.log(`\n📡 TESTING FALLBACK PATH:`);
    
    let googleCampaignsFromFallback = [];
    let metaCampaignsFromFallback = [];

    // Simulate API call result (Meta campaigns)
    if (metaCampaigns && metaCampaigns.length > 0) {
      try {
        const { convertMetaCampaignToUnified } = require('../src/lib/unified-campaign-types');
        metaCampaignsFromFallback = metaCampaigns.map(convertMetaCampaignToUnified);
        console.log(`   ✅ Meta campaigns from API simulation: ${metaCampaignsFromFallback.length}`);
      } catch (error) {
        console.log(`   ❌ Meta conversion error (fallback): ${error.message}`);
      }
    } else {
      console.log(`   ⚠️ No Meta campaigns available for fallback path`);
    }

    // Google Ads fetching logic from fallback path (our new "ensured fetch")
    if (client.google_ads_enabled && client.google_ads_customer_id) {
      const { data: cachedGoogleCampaigns, error: cacheError } = await supabase
        .from('google_ads_campaigns')
        .select('*')
        .eq('client_id', clientId)
        .gte('date_range_start', dateRange.start)
        .lte('date_range_end', dateRange.end);
      
      if (!cacheError && cachedGoogleCampaigns && cachedGoogleCampaigns.length > 0) {
        try {
          const { convertGoogleCampaignToUnified } = require('../src/lib/unified-campaign-types');
          googleCampaignsFromFallback = cachedGoogleCampaigns.map(convertGoogleCampaignToUnified);
          console.log(`   ✅ Google campaigns from ensured fetch: ${googleCampaignsFromFallback.length}`);
        } catch (conversionError) {
          console.log(`   ❌ Google conversion error (fallback): ${conversionError.message}`);
        }
      } else {
        console.log(`   ⚠️ No Google campaigns found in ensured fetch: ${cacheError?.message || 'No data'}`);
      }
    } else {
      console.log(`   ⚠️ Google Ads not enabled for ensured fetch`);
    }

    console.log(`   FALLBACK PATH RESULT:`);
    console.log(`     Meta campaigns: ${metaCampaignsFromFallback.length}`);
    console.log(`     Google campaigns: ${googleCampaignsFromFallback.length}`);
    console.log(`     Should show unified source: ${googleCampaignsFromFallback.length > 0}`);

    // AUDIT 5: Test HTML Generation Logic
    console.log('\n🎨 AUDIT 5: HTML Generation Logic Test');
    console.log('-'.repeat(40));

    // Test the exact logic from the HTML generation
    const testGoogleCampaigns = googleCampaigns || [];
    const sourceLogicResult = testGoogleCampaigns && testGoogleCampaigns.length > 0 
      ? 'Źródło: Meta Ads API & Google Ads API' 
      : 'Źródło: Meta Ads API';

    console.log(`HTML Source Logic Test:`);
    console.log(`   testGoogleCampaigns: ${testGoogleCampaigns.length} campaigns`);
    console.log(`   testGoogleCampaigns && testGoogleCampaigns.length > 0: ${testGoogleCampaigns && testGoogleCampaigns.length > 0}`);
    console.log(`   Result: "${sourceLogicResult}"`);

    // AUDIT 6: Check for Import/Module Issues
    console.log('\n📦 AUDIT 6: Module Import Test');
    console.log('-'.repeat(40));

    try {
      const unifiedTypes = require('../src/lib/unified-campaign-types');
      console.log(`✅ unified-campaign-types module loaded`);
      console.log(`   convertMetaCampaignToUnified: ${typeof unifiedTypes.convertMetaCampaignToUnified}`);
      console.log(`   convertGoogleCampaignToUnified: ${typeof unifiedTypes.convertGoogleCampaignToUnified}`);
      console.log(`   calculatePlatformTotals: ${typeof unifiedTypes.calculatePlatformTotals}`);
    } catch (error) {
      console.log(`❌ Module import error: ${error.message}`);
    }

    // AUDIT 7: Final Diagnosis
    console.log('\n🩺 AUDIT 7: Final Diagnosis');
    console.log('-'.repeat(40));

    const hasGoogleData = googleCampaigns && googleCampaigns.length > 0;
    const hasMetaData = metaCampaigns && metaCampaigns.length > 0;
    const clientConfigured = client.google_ads_enabled && client.google_ads_customer_id;

    console.log(`DIAGNOSIS SUMMARY:`);
    console.log(`   ✅ Client has Google Ads configured: ${clientConfigured}`);
    console.log(`   ✅ Google Ads data exists in database: ${hasGoogleData}`);
    console.log(`   ✅ Meta Ads data exists in database: ${hasMetaData}`);
    console.log(`   📊 Data path that will be taken: ${directCampaigns && directTotals ? 'DIRECT' : 'FALLBACK'}`);

    if (hasGoogleData && clientConfigured) {
      console.log(`\n🚀 EXPECTED RESULT: PDF should show unified source`);
      console.log(`   Cover should show: "Źródło: Meta Ads API & Google Ads API"`);
    } else {
      console.log(`\n⚠️ EXPECTED RESULT: PDF will show Meta only`);
      console.log(`   Cover should show: "Źródło: Meta Ads API"`);
      
      if (!clientConfigured) {
        console.log(`   REASON: Client not configured for Google Ads`);
      }
      if (!hasGoogleData) {
        console.log(`   REASON: No Google Ads data in database`);
      }
    }

    // AUDIT 8: Check for potential race conditions or async issues
    console.log('\n⏱️ AUDIT 8: Async/Race Condition Check');
    console.log('-'.repeat(40));

    console.log(`Checking if Google Ads data fetching might be failing due to timing...`);
    
    // Test multiple rapid fetches to see if there's a race condition
    const rapidFetches = await Promise.all([
      supabase.from('google_ads_campaigns').select('id').eq('client_id', clientId).gte('date_range_start', dateRange.start).lte('date_range_end', dateRange.end),
      supabase.from('google_ads_campaigns').select('id').eq('client_id', clientId).gte('date_range_start', dateRange.start).lte('date_range_end', dateRange.end),
      supabase.from('google_ads_campaigns').select('id').eq('client_id', clientId).gte('date_range_start', dateRange.start).lte('date_range_end', dateRange.end)
    ]);

    const fetchResults = rapidFetches.map((result, index) => ({
      fetch: index + 1,
      success: !result.error,
      count: result.data?.length || 0,
      error: result.error?.message
    }));

    console.log(`Rapid fetch test results:`, fetchResults);

    const allFetchesSuccessful = fetchResults.every(r => r.success && r.count > 0);
    console.log(`   All fetches successful: ${allFetchesSuccessful}`);

  } catch (error) {
    console.error('❌ Audit failed:', error);
  }
}

// Run the audit
if (require.main === module) {
  comprehensivePDFAudit().then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error('❌ Audit script failed:', error);
    process.exit(1);
  });
}

module.exports = { comprehensivePDFAudit };
