/**
 * Comprehensive Meta Ads Tables Test for Belmonte - August 2025
 * Tests all table values and compares with displayed results
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Belmonte Hotel Client ID
const BELMONTE_CLIENT_ID = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';
const AUGUST_2025_START = '2025-08-01';
const AUGUST_2025_END = '2025-08-31';

async function testBelmonteMetaTablesAugust() {
  console.log('🧪 COMPREHENSIVE META ADS TABLES TEST - BELMONTE AUGUST 2025');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📅 Testing Period: ${AUGUST_2025_START} to ${AUGUST_2025_END}`);
  console.log(`🏨 Client: Belmonte Hotel`);
  console.log(`🆔 Client ID: ${BELMONTE_CLIENT_ID}`);
  console.log('');

  try {
    // Step 1: Get Belmonte client credentials
    console.log('🔍 STEP 1: Getting Belmonte client credentials...');
    const { data: belmonteClient, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', BELMONTE_CLIENT_ID)
      .single();

    if (clientError || !belmonteClient) {
      console.error('❌ Failed to get Belmonte client:', clientError);
      return;
    }

    console.log(`✅ Client Found: ${belmonteClient.name}`);
    console.log(`📧 Email: ${belmonteClient.email}`);
    console.log(`🎯 Ad Account: ${belmonteClient.ad_account_id}`);
    console.log(`🔑 Has Meta Token: ${!!belmonteClient.meta_access_token}`);
    console.log('');

    if (!belmonteClient.meta_access_token) {
      console.error('❌ No Meta access token found for Belmonte');
      return;
    }

    // Step 2: Initialize Meta API Service
    console.log('🔍 STEP 2: Initializing Meta API service...');
    const { MetaAPIService } = require('../src/lib/meta-api.ts');
    const metaService = new MetaAPIService(belmonteClient.meta_access_token);
    console.log('✅ Meta API service initialized');
    console.log('');

    // Step 3: Test Direct Meta API Calls for August 2025
    console.log('🔍 STEP 3: Testing direct Meta API calls for August 2025...');
    
    const adAccountId = belmonteClient.ad_account_id;
    const results = {
      placementPerformance: null,
      demographicPerformance: null,
      adRelevanceResults: null,
      campaignInsights: null,
      errors: []
    };

    // Test Placement Performance
    try {
      console.log('🎯 Testing Placement Performance...');
      results.placementPerformance = await metaService.getPlacementPerformance(
        adAccountId, 
        AUGUST_2025_START, 
        AUGUST_2025_END
      );
      console.log(`✅ Placement Performance: ${results.placementPerformance.length} records`);
    } catch (error) {
      console.error('❌ Placement Performance failed:', error.message);
      results.errors.push({ type: 'Placement Performance', error: error.message });
    }

    // Test Demographic Performance
    try {
      console.log('👥 Testing Demographic Performance...');
      results.demographicPerformance = await metaService.getDemographicPerformance(
        adAccountId, 
        AUGUST_2025_START, 
        AUGUST_2025_END
      );
      console.log(`✅ Demographic Performance: ${results.demographicPerformance.length} records`);
    } catch (error) {
      console.error('❌ Demographic Performance failed:', error.message);
      results.errors.push({ type: 'Demographic Performance', error: error.message });
    }

    // Test Ad Relevance Results
    try {
      console.log('📊 Testing Ad Relevance Results...');
      results.adRelevanceResults = await metaService.getAdRelevanceResults(
        adAccountId, 
        AUGUST_2025_START, 
        AUGUST_2025_END
      );
      console.log(`✅ Ad Relevance Results: ${results.adRelevanceResults.length} records`);
    } catch (error) {
      console.error('❌ Ad Relevance Results failed:', error.message);
      results.errors.push({ type: 'Ad Relevance Results', error: error.message });
    }

    // Test Campaign Insights (for comparison)
    try {
      console.log('📈 Testing Campaign Insights...');
      results.campaignInsights = await metaService.getCampaignInsights(
        adAccountId, 
        AUGUST_2025_START, 
        AUGUST_2025_END,
        'day'
      );
      console.log(`✅ Campaign Insights: ${results.campaignInsights.length} records`);
    } catch (error) {
      console.error('❌ Campaign Insights failed:', error.message);
      results.errors.push({ type: 'Campaign Insights', error: error.message });
    }

    console.log('');

    // Step 4: Check stored database data
    console.log('🔍 STEP 4: Checking stored database data...');
    
    // Check campaign_summaries table
    const { data: storedSummary, error: summaryError } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', BELMONTE_CLIENT_ID)
      .eq('summary_type', 'monthly')
      .eq('summary_date', AUGUST_2025_START)
      .single();

    if (summaryError || !storedSummary) {
      console.log('⚠️ No stored summary found for August 2025');
    } else {
      console.log('✅ Found stored summary for August 2025');
      console.log(`📊 Total Spend: ${storedSummary.total_spend} PLN`);
      console.log(`👁️ Total Impressions: ${storedSummary.total_impressions}`);
      console.log(`🖱️ Total Clicks: ${storedSummary.total_clicks}`);
      console.log(`🎯 Total Conversions: ${storedSummary.total_conversions}`);
      console.log(`📱 Active Campaigns: ${storedSummary.active_campaigns}`);
      console.log(`📋 Total Campaigns: ${storedSummary.total_campaigns}`);
      console.log(`📅 Last Updated: ${storedSummary.last_updated}`);
      
      if (storedSummary.meta_tables) {
        const metaTables = storedSummary.meta_tables;
        console.log('\n📊 Stored Meta Tables:');
        console.log(`  🎯 Placement Performance: ${metaTables.placementPerformance?.length || 0} records`);
        console.log(`  👥 Demographic Performance: ${metaTables.demographicPerformance?.length || 0} records`);
        console.log(`  📈 Ad Relevance Results: ${metaTables.adRelevanceResults?.length || 0} records`);
      }
    }

    console.log('');

    // Step 5: Detailed Analysis and Comparison
    console.log('🔍 STEP 5: DETAILED ANALYSIS AND COMPARISON');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Analyze Placement Performance
    if (results.placementPerformance && results.placementPerformance.length > 0) {
      console.log('\n🎯 PLACEMENT PERFORMANCE ANALYSIS:');
      
      const totalPlacementSpend = results.placementPerformance.reduce((sum, p) => sum + (p.spend || 0), 0);
      const totalPlacementImpressions = results.placementPerformance.reduce((sum, p) => sum + (p.impressions || 0), 0);
      const totalPlacementClicks = results.placementPerformance.reduce((sum, p) => sum + (p.clicks || 0), 0);
      
      console.log(`📊 Total Records: ${results.placementPerformance.length}`);
      console.log(`💰 Total Spend: ${totalPlacementSpend.toFixed(2)} PLN`);
      console.log(`👁️ Total Impressions: ${totalPlacementImpressions.toLocaleString()}`);
      console.log(`🖱️ Total Clicks: ${totalPlacementClicks.toLocaleString()}`);
      
      console.log('\n📋 Top 5 Placements by Spend:');
      const topPlacements = results.placementPerformance
        .sort((a, b) => (b.spend || 0) - (a.spend || 0))
        .slice(0, 5);
      
      topPlacements.forEach((placement, index) => {
        console.log(`  ${index + 1}. ${placement.placement || 'Unknown'}: ${(placement.spend || 0).toFixed(2)} PLN`);
      });
    } else {
      console.log('\n🎯 PLACEMENT PERFORMANCE: ❌ No data found');
    }

    // Analyze Demographic Performance  
    if (results.demographicPerformance && results.demographicPerformance.length > 0) {
      console.log('\n👥 DEMOGRAPHIC PERFORMANCE ANALYSIS:');
      
      const totalDemoSpend = results.demographicPerformance.reduce((sum, d) => sum + (d.spend || 0), 0);
      const totalReservations = results.demographicPerformance.reduce((sum, d) => sum + (d.reservations || 0), 0);
      const totalReservationValue = results.demographicPerformance.reduce((sum, d) => sum + (d.reservation_value || 0), 0);
      const totalBookingStep1 = results.demographicPerformance.reduce((sum, d) => sum + (d.booking_step_1 || 0), 0);
      const totalBookingStep2 = results.demographicPerformance.reduce((sum, d) => sum + (d.booking_step_2 || 0), 0);
      const totalBookingStep3 = results.demographicPerformance.reduce((sum, d) => sum + (d.booking_step_3 || 0), 0);
      
      console.log(`📊 Total Records: ${results.demographicPerformance.length}`);
      console.log(`💰 Total Spend: ${totalDemoSpend.toFixed(2)} PLN`);
      console.log(`🏨 Total Reservations: ${totalReservations}`);
      console.log(`💎 Total Reservation Value: ${totalReservationValue.toFixed(2)} PLN`);
      console.log(`📝 Booking Step 1: ${totalBookingStep1}`);
      console.log(`💳 Booking Step 2: ${totalBookingStep2}`);
      console.log(`✅ Booking Step 3: ${totalBookingStep3}`);
      
      const avgROAS = totalDemoSpend > 0 ? totalReservationValue / totalDemoSpend : 0;
      console.log(`📈 Average ROAS: ${avgROAS.toFixed(2)}`);
      
      console.log('\n📋 Demographics Breakdown:');
      const demoGroups = {};
      results.demographicPerformance.forEach(demo => {
        const key = `${demo.age || 'Unknown'} ${demo.gender || 'Unknown'}`;
        if (!demoGroups[key]) {
          demoGroups[key] = { spend: 0, reservations: 0, count: 0 };
        }
        demoGroups[key].spend += demo.spend || 0;
        demoGroups[key].reservations += demo.reservations || 0;
        demoGroups[key].count += 1;
      });
      
      Object.entries(demoGroups)
        .sort(([,a], [,b]) => b.spend - a.spend)
        .slice(0, 5)
        .forEach(([demo, data], index) => {
          console.log(`  ${index + 1}. ${demo}: ${data.spend.toFixed(2)} PLN, ${data.reservations} reservations`);
        });
    } else {
      console.log('\n👥 DEMOGRAPHIC PERFORMANCE: ❌ No data found');
    }

    // Analyze Ad Relevance Results
    if (results.adRelevanceResults && results.adRelevanceResults.length > 0) {
      console.log('\n📈 AD RELEVANCE RESULTS ANALYSIS:');
      
      const totalAdSpend = results.adRelevanceResults.reduce((sum, ad) => sum + (ad.spend || 0), 0);
      const totalAdImpressions = results.adRelevanceResults.reduce((sum, ad) => sum + (ad.impressions || 0), 0);
      const totalAdClicks = results.adRelevanceResults.reduce((sum, ad) => sum + (ad.clicks || 0), 0);
      
      console.log(`📊 Total Ads: ${results.adRelevanceResults.length}`);
      console.log(`💰 Total Spend: ${totalAdSpend.toFixed(2)} PLN`);
      console.log(`👁️ Total Impressions: ${totalAdImpressions.toLocaleString()}`);
      console.log(`🖱️ Total Clicks: ${totalAdClicks.toLocaleString()}`);
      
      console.log('\n📋 Top 5 Ads by Spend:');
      const topAds = results.adRelevanceResults
        .sort((a, b) => (b.spend || 0) - (a.spend || 0))
        .slice(0, 5);
      
      topAds.forEach((ad, index) => {
        console.log(`  ${index + 1}. ${(ad.ad_name || 'Unknown Ad').substring(0, 50)}: ${(ad.spend || 0).toFixed(2)} PLN`);
      });
    } else {
      console.log('\n📈 AD RELEVANCE RESULTS: ❌ No data found');
    }

    // Step 6: Compare with Campaign Insights
    if (results.campaignInsights && results.campaignInsights.length > 0) {
      console.log('\n📈 CAMPAIGN INSIGHTS COMPARISON:');
      
      const totalCampaignSpend = results.campaignInsights.reduce((sum, c) => sum + (c.spend || 0), 0);
      const totalCampaignImpressions = results.campaignInsights.reduce((sum, c) => sum + (c.impressions || 0), 0);
      const totalCampaignClicks = results.campaignInsights.reduce((sum, c) => sum + (c.clicks || 0), 0);
      
      console.log(`📊 Total Campaign Records: ${results.campaignInsights.length}`);
      console.log(`💰 Campaign Total Spend: ${totalCampaignSpend.toFixed(2)} PLN`);
      console.log(`👁️ Campaign Total Impressions: ${totalCampaignImpressions.toLocaleString()}`);
      console.log(`🖱️ Campaign Total Clicks: ${totalCampaignClicks.toLocaleString()}`);
      
      // Compare with stored data
      if (storedSummary) {
        console.log('\n🔄 STORED vs LIVE DATA COMPARISON:');
        console.log(`💰 Spend - Stored: ${storedSummary.total_spend} PLN | Live: ${totalCampaignSpend.toFixed(2)} PLN`);
        console.log(`👁️ Impressions - Stored: ${storedSummary.total_impressions} | Live: ${totalCampaignImpressions}`);
        console.log(`🖱️ Clicks - Stored: ${storedSummary.total_clicks} | Live: ${totalCampaignClicks}`);
        
        const spendDiff = Math.abs(storedSummary.total_spend - totalCampaignSpend);
        const impressionsDiff = Math.abs(storedSummary.total_impressions - totalCampaignImpressions);
        const clicksDiff = Math.abs(storedSummary.total_clicks - totalCampaignClicks);
        
        console.log(`\n📊 DIFFERENCES:`);
        console.log(`💰 Spend Difference: ${spendDiff.toFixed(2)} PLN`);
        console.log(`👁️ Impressions Difference: ${impressionsDiff}`);
        console.log(`🖱️ Clicks Difference: ${clicksDiff}`);
        
        const spendMatch = spendDiff < 1; // Within 1 PLN
        const impressionsMatch = impressionsDiff < 100; // Within 100 impressions
        const clicksMatch = clicksDiff < 10; // Within 10 clicks
        
        console.log(`\n✅ DATA ACCURACY CHECK:`);
        console.log(`💰 Spend Match: ${spendMatch ? '✅' : '❌'} (${spendMatch ? 'ACCURATE' : 'MISMATCH'})`);
        console.log(`👁️ Impressions Match: ${impressionsMatch ? '✅' : '❌'} (${impressionsMatch ? 'ACCURATE' : 'MISMATCH'})`);
        console.log(`🖱️ Clicks Match: ${clicksMatch ? '✅' : '❌'} (${clicksMatch ? 'ACCURATE' : 'MISMATCH'})`);
      }
    }

    // Step 7: Error Summary
    if (results.errors.length > 0) {
      console.log('\n❌ ERRORS ENCOUNTERED:');
      results.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error.type}: ${error.error}`);
      });
    }

    // Step 8: Final Summary
    console.log('\n🎯 FINAL TEST SUMMARY:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const successfulTests = [
      results.placementPerformance ? 'Placement Performance' : null,
      results.demographicPerformance ? 'Demographic Performance' : null,
      results.adRelevanceResults ? 'Ad Relevance Results' : null,
      results.campaignInsights ? 'Campaign Insights' : null
    ].filter(Boolean);
    
    const failedTests = results.errors.map(e => e.type);
    
    console.log(`✅ Successful Tests: ${successfulTests.length}/4`);
    console.log(`❌ Failed Tests: ${failedTests.length}/4`);
    
    if (successfulTests.length > 0) {
      console.log(`🎯 Working: ${successfulTests.join(', ')}`);
    }
    
    if (failedTests.length > 0) {
      console.log(`❌ Failed: ${failedTests.join(', ')}`);
    }
    
    console.log(`📊 Database Status: ${storedSummary ? 'Found stored data' : 'No stored data'}`);
    
    const overallHealth = successfulTests.length >= 3 ? '🟢 GOOD' : successfulTests.length >= 2 ? '🟡 FAIR' : '🔴 POOR';
    console.log(`🏥 Overall Health: ${overallHealth}`);
    
    console.log('\n🎉 TEST COMPLETED');

  } catch (error) {
    console.error('\n💥 CRITICAL ERROR:', error);
    console.error('Stack:', error.stack);
  }
}

// Run the test
if (require.main === module) {
  testBelmonteMetaTablesAugust();
}

module.exports = { testBelmonteMetaTablesAugust }; 