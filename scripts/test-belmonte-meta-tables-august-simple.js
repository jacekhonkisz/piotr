/**
 * Simplified Meta Ads Tables Test for Belmonte - August 2025
 * Uses direct API calls without TypeScript module imports
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

async function makeMetaAPICall(url) {
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (!response.ok || data.error) {
      throw new Error(`Meta API Error: ${data.error?.message || 'Unknown error'}`);
    }
    
    return data;
  } catch (error) {
    console.error('API Call failed:', error.message);
    throw error;
  }
}

async function testBelmonteMetaTablesAugustSimple() {
  console.log('🧪 SIMPLIFIED META ADS TABLES TEST - BELMONTE AUGUST 2025');
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

    const accessToken = belmonteClient.meta_access_token;
    const adAccountId = belmonteClient.ad_account_id.startsWith('act_') 
      ? belmonteClient.ad_account_id 
      : `act_${belmonteClient.ad_account_id}`;

    const baseUrl = 'https://graph.facebook.com/v18.0';
    const timeRange = JSON.stringify({
      since: AUGUST_2025_START,
      until: AUGUST_2025_END,
    });

    // Step 2: Test Campaign Insights (Main Data)
    console.log('🔍 STEP 2: Testing Campaign Insights (Main Data)...');
    
    const campaignFields = [
      'campaign_id',
      'campaign_name',
      'impressions',
      'clicks',
      'spend',
      'ctr',
      'cpc',
      'conversions',
      'actions',
      'action_values',
      'cost_per_action_type'
    ].join(',');

    const campaignParams = new URLSearchParams({
      access_token: accessToken,
      fields: campaignFields,
      time_range: timeRange,
      level: 'campaign',
      limit: '100',
    });

    const campaignUrl = `${baseUrl}/${adAccountId}/insights?${campaignParams.toString()}`;
    
    let campaignResults = null;
    try {
      console.log('📈 Fetching campaign insights...');
      const campaignData = await makeMetaAPICall(campaignUrl);
      campaignResults = campaignData.data || [];
      console.log(`✅ Campaign Insights: ${campaignResults.length} campaigns found`);
      
      // Calculate campaign totals
      const campaignTotals = campaignResults.reduce((totals, campaign) => {
        totals.spend += parseFloat(campaign.spend || '0');
        totals.impressions += parseInt(campaign.impressions || '0');
        totals.clicks += parseInt(campaign.clicks || '0');
        totals.conversions += parseFloat(campaign.conversions || '0');
        return totals;
      }, { spend: 0, impressions: 0, clicks: 0, conversions: 0 });

      console.log(`💰 Total Spend: ${campaignTotals.spend.toFixed(2)} PLN`);
      console.log(`👁️ Total Impressions: ${campaignTotals.impressions.toLocaleString()}`);
      console.log(`🖱️ Total Clicks: ${campaignTotals.clicks.toLocaleString()}`);
      console.log(`🎯 Total Conversions: ${campaignTotals.conversions.toFixed(2)}`);
      
    } catch (error) {
      console.error('❌ Campaign Insights failed:', error.message);
    }

    // Step 3: Test Placement Performance
    console.log('\n🔍 STEP 3: Testing Placement Performance...');
    
    const placementFields = [
      'spend',
      'impressions',
      'clicks',
      'ctr',
      'cpc',
      'actions',
      'conversions'
    ].join(',');

    const placementParams = new URLSearchParams({
      access_token: accessToken,
      fields: placementFields,
      time_range: timeRange,
      breakdowns: 'publisher_platform,platform_position',
      level: 'campaign',
      limit: '100',
    });

    const placementUrl = `${baseUrl}/${adAccountId}/insights?${placementParams.toString()}`;
    
    let placementResults = null;
    try {
      console.log('🎯 Fetching placement performance...');
      const placementData = await makeMetaAPICall(placementUrl);
      placementResults = placementData.data || [];
      console.log(`✅ Placement Performance: ${placementResults.length} placements found`);
      
      if (placementResults.length > 0) {
        const placementTotals = placementResults.reduce((totals, placement) => {
          totals.spend += parseFloat(placement.spend || '0');
          totals.impressions += parseInt(placement.impressions || '0');
          totals.clicks += parseInt(placement.clicks || '0');
          return totals;
        }, { spend: 0, impressions: 0, clicks: 0 });

        console.log(`💰 Placement Total Spend: ${placementTotals.spend.toFixed(2)} PLN`);
        console.log(`👁️ Placement Total Impressions: ${placementTotals.impressions.toLocaleString()}`);
        console.log(`🖱️ Placement Total Clicks: ${placementTotals.clicks.toLocaleString()}`);
        
        // Show top placements
        const topPlacements = placementResults
          .sort((a, b) => parseFloat(b.spend || '0') - parseFloat(a.spend || '0'))
          .slice(0, 5);
        
        console.log('\n📋 Top 5 Placements by Spend:');
        topPlacements.forEach((placement, index) => {
          const platform = placement.publisher_platform || 'Unknown';
          const position = placement.platform_position || 'Unknown';
          const spend = parseFloat(placement.spend || '0').toFixed(2);
          console.log(`  ${index + 1}. ${platform} - ${position}: ${spend} PLN`);
        });
      }
      
    } catch (error) {
      console.error('❌ Placement Performance failed:', error.message);
    }

    // Step 4: Test Demographic Performance
    console.log('\n🔍 STEP 4: Testing Demographic Performance...');
    
    const demographicFields = [
      'spend',
      'impressions',
      'clicks',
      'ctr',
      'cpc',
      'actions',
      'action_values',
      'conversions',
      'conversion_values'
    ].join(',');

    const demographicParams = new URLSearchParams({
      access_token: accessToken,
      fields: demographicFields,
      time_range: timeRange,
      breakdowns: 'age,gender',
      level: 'campaign',
      limit: '100',
    });

    const demographicUrl = `${baseUrl}/${adAccountId}/insights?${demographicParams.toString()}`;
    
    let demographicResults = null;
    try {
      console.log('👥 Fetching demographic performance...');
      const demographicData = await makeMetaAPICall(demographicUrl);
      demographicResults = demographicData.data || [];
      console.log(`✅ Demographic Performance: ${demographicResults.length} demographics found`);
      
      if (demographicResults.length > 0) {
        const demographicTotals = demographicResults.reduce((totals, demo) => {
          totals.spend += parseFloat(demo.spend || '0');
          totals.impressions += parseInt(demo.impressions || '0');
          totals.clicks += parseInt(demo.clicks || '0');
          
          // Count reservations from actions
          const actions = demo.actions || [];
          actions.forEach(action => {
            if (action.action_type === 'purchase' || action.action_type.includes('fb_pixel_purchase')) {
              totals.reservations += parseInt(action.value || '0');
            }
          });
          
          // Count reservation values
          const actionValues = demo.action_values || [];
          actionValues.forEach(actionValue => {
            if (actionValue.action_type === 'purchase' || actionValue.action_type.includes('fb_pixel_purchase')) {
              totals.reservationValue += parseFloat(actionValue.value || '0');
            }
          });
          
          return totals;
        }, { spend: 0, impressions: 0, clicks: 0, reservations: 0, reservationValue: 0 });

        console.log(`💰 Demographic Total Spend: ${demographicTotals.spend.toFixed(2)} PLN`);
        console.log(`👁️ Demographic Total Impressions: ${demographicTotals.impressions.toLocaleString()}`);
        console.log(`🖱️ Demographic Total Clicks: ${demographicTotals.clicks.toLocaleString()}`);
        console.log(`🏨 Total Reservations: ${demographicTotals.reservations}`);
        console.log(`💎 Total Reservation Value: ${demographicTotals.reservationValue.toFixed(2)} PLN`);
        
        const roas = demographicTotals.spend > 0 ? demographicTotals.reservationValue / demographicTotals.spend : 0;
        console.log(`📈 ROAS: ${roas.toFixed(2)}`);
        
        // Show top demographics
        const topDemographics = demographicResults
          .sort((a, b) => parseFloat(b.spend || '0') - parseFloat(a.spend || '0'))
          .slice(0, 5);
        
        console.log('\n📋 Top 5 Demographics by Spend:');
        topDemographics.forEach((demo, index) => {
          const age = demo.age || 'Unknown';
          const gender = demo.gender || 'Unknown';
          const spend = parseFloat(demo.spend || '0').toFixed(2);
          console.log(`  ${index + 1}. ${age} ${gender}: ${spend} PLN`);
        });
      }
      
    } catch (error) {
      console.error('❌ Demographic Performance failed:', error.message);
    }

    // Step 5: Test Ad Level Data
    console.log('\n🔍 STEP 5: Testing Ad Level Data...');
    
    const adFields = [
      'ad_name',
      'spend',
      'impressions',
      'clicks',
      'ctr',
      'cpc'
    ].join(',');

    const adParams = new URLSearchParams({
      access_token: accessToken,
      fields: adFields,
      time_range: timeRange,
      level: 'ad',
      limit: '100',
    });

    const adUrl = `${baseUrl}/${adAccountId}/insights?${adParams.toString()}`;
    
    let adResults = null;
    try {
      console.log('📊 Fetching ad level data...');
      const adData = await makeMetaAPICall(adUrl);
      adResults = adData.data || [];
      console.log(`✅ Ad Level Data: ${adResults.length} ads found`);
      
      if (adResults.length > 0) {
        const adTotals = adResults.reduce((totals, ad) => {
          totals.spend += parseFloat(ad.spend || '0');
          totals.impressions += parseInt(ad.impressions || '0');
          totals.clicks += parseInt(ad.clicks || '0');
          return totals;
        }, { spend: 0, impressions: 0, clicks: 0 });

        console.log(`💰 Ad Total Spend: ${adTotals.spend.toFixed(2)} PLN`);
        console.log(`👁️ Ad Total Impressions: ${adTotals.impressions.toLocaleString()}`);
        console.log(`🖱️ Ad Total Clicks: ${adTotals.clicks.toLocaleString()}`);
        
        // Show top ads
        const topAds = adResults
          .sort((a, b) => parseFloat(b.spend || '0') - parseFloat(a.spend || '0'))
          .slice(0, 5);
        
        console.log('\n📋 Top 5 Ads by Spend:');
        topAds.forEach((ad, index) => {
          const name = ad.ad_name || 'Unknown Ad';
          const spend = parseFloat(ad.spend || '0').toFixed(2);
          console.log(`  ${index + 1}. ${name.substring(0, 50)}: ${spend} PLN`);
        });
      }
      
    } catch (error) {
      console.error('❌ Ad Level Data failed:', error.message);
    }

    // Step 6: Check Stored Database Data
    console.log('\n🔍 STEP 6: Checking stored database data...');
    
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
      console.log('📊 This means data may not be cached yet');
    } else {
      console.log('✅ Found stored summary for August 2025');
      console.log(`💰 Stored Total Spend: ${storedSummary.total_spend} PLN`);
      console.log(`👁️ Stored Total Impressions: ${storedSummary.total_impressions}`);
      console.log(`🖱️ Stored Total Clicks: ${storedSummary.total_clicks}`);
      console.log(`🎯 Stored Total Conversions: ${storedSummary.total_conversions}`);
      console.log(`📱 Stored Active Campaigns: ${storedSummary.active_campaigns}`);
      console.log(`📋 Stored Total Campaigns: ${storedSummary.total_campaigns}`);
      console.log(`📅 Last Updated: ${storedSummary.last_updated}`);
      
      if (storedSummary.meta_tables) {
        const metaTables = storedSummary.meta_tables;
        console.log('\n📊 Stored Meta Tables:');
        console.log(`  🎯 Placement Performance: ${metaTables.placementPerformance?.length || 0} records`);
        console.log(`  👥 Demographic Performance: ${metaTables.demographicPerformance?.length || 0} records`);
        console.log(`  📈 Ad Relevance Results: ${metaTables.adRelevanceResults?.length || 0} records`);
        
        // Compare stored meta tables with live data
        if (placementResults && metaTables.placementPerformance) {
          const storedPlacementCount = metaTables.placementPerformance.length;
          const livePlacementCount = placementResults.length;
          console.log(`\n🔄 Placement Data Comparison:`);
          console.log(`  📊 Stored: ${storedPlacementCount} | Live: ${livePlacementCount}`);
          
          if (storedPlacementCount === livePlacementCount) {
            console.log(`  ✅ Placement counts match!`);
          } else {
            console.log(`  ⚠️ Placement counts differ (${Math.abs(storedPlacementCount - livePlacementCount)} difference)`);
          }
        }
        
        if (demographicResults && metaTables.demographicPerformance) {
          const storedDemoCount = metaTables.demographicPerformance.length;
          const liveDemoCount = demographicResults.length;
          console.log(`\n🔄 Demographic Data Comparison:`);
          console.log(`  📊 Stored: ${storedDemoCount} | Live: ${liveDemoCount}`);
          
          if (storedDemoCount === liveDemoCount) {
            console.log(`  ✅ Demographic counts match!`);
          } else {
            console.log(`  ⚠️ Demographic counts differ (${Math.abs(storedDemoCount - liveDemoCount)} difference)`);
          }
        }
      }
    }

    // Step 7: Final Summary
    console.log('\n🎯 FINAL TEST SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const testResults = [
      { name: 'Campaign Insights', success: !!campaignResults, count: campaignResults?.length || 0 },
      { name: 'Placement Performance', success: !!placementResults, count: placementResults?.length || 0 },
      { name: 'Demographic Performance', success: !!demographicResults, count: demographicResults?.length || 0 },
      { name: 'Ad Level Data', success: !!adResults, count: adResults?.length || 0 }
    ];
    
    const successfulTests = testResults.filter(test => test.success);
    const failedTests = testResults.filter(test => !test.success);
    
    console.log(`✅ Successful API Calls: ${successfulTests.length}/4`);
    console.log(`❌ Failed API Calls: ${failedTests.length}/4`);
    
    successfulTests.forEach(test => {
      console.log(`  ✅ ${test.name}: ${test.count} records`);
    });
    
    failedTests.forEach(test => {
      console.log(`  ❌ ${test.name}: Failed`);
    });
    
    console.log(`📊 Database Status: ${storedSummary ? 'Has cached data' : 'No cached data'}`);
    
    const overallHealth = successfulTests.length >= 3 ? '🟢 EXCELLENT' : successfulTests.length >= 2 ? '🟡 GOOD' : '🔴 POOR';
    console.log(`🏥 Overall API Health: ${overallHealth}`);
    
    if (successfulTests.length === 4) {
      console.log('\n🎉 ALL TESTS PASSED! Meta API is working perfectly for Belmonte in August 2025');
    } else if (successfulTests.length >= 2) {
      console.log('\n⚠️ PARTIAL SUCCESS: Some Meta API calls are working, but not all');
    } else {
      console.log('\n❌ CRITICAL ISSUES: Most Meta API calls are failing');
    }

  } catch (error) {
    console.error('\n💥 CRITICAL ERROR:', error);
    console.error('Stack:', error.stack);
  }
}

// Run the test
if (require.main === module) {
  testBelmonteMetaTablesAugustSimple();
}

module.exports = { testBelmonteMetaTablesAugustSimple }; 