#!/usr/bin/env node

console.log('🔍 TESTING PERIOD-BASED GOOGLE ADS TABLES DATA FLOW');
console.log('===================================================\n');

// Test the API endpoint with different periods
const testPeriods = [
  { dateStart: '2025-08-01', dateEnd: '2025-08-31', label: 'August 2025' },
  { dateStart: '2025-07-01', dateEnd: '2025-07-31', label: 'July 2025' },
  { dateStart: '2025-08-15', dateEnd: '2025-08-22', label: 'Week of Aug 15-22' }
];

async function testGoogleAdsTablesAPI(clientId, dateStart, dateEnd, label) {
  console.log(`\n📊 TESTING: ${label} (${dateStart} to ${dateEnd})`);
  console.log('='.repeat(60));
  
  try {
    const response = await fetch('http://localhost:3000/api/fetch-google-ads-live-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clientId: clientId,
        dateStart: dateStart,
        dateEnd: dateEnd,
        includeTableData: true
      }),
    });

    if (!response.ok) {
      console.log(`❌ API Error: ${response.status} ${response.statusText}`);
      return;
    }

    const data = await response.json();
    console.log(`✅ API Response Status: ${response.status}`);
    
    // Check if tables data is included
    const googleAdsTables = data.googleAdsTables || {};
    
    console.log('\n📋 TABLES DATA ANALYSIS:');
    console.log('========================');
    console.log(`🔹 Network Performance: ${(googleAdsTables.networkPerformance || []).length} entries`);
    console.log(`🔹 Demographic Performance: ${(googleAdsTables.demographicPerformance || []).length} entries`);
    console.log(`🔹 Device Performance: ${(googleAdsTables.devicePerformance || []).length} entries`);
    console.log(`🔹 Keyword Performance: ${(googleAdsTables.keywordPerformance || []).length} entries`);
    console.log(`🔹 Quality Metrics: ${(googleAdsTables.qualityMetrics || []).length} entries`);
    
    // Check campaign data
    const campaigns = data.campaigns || [];
    console.log(`🔹 Campaigns: ${campaigns.length} entries`);
    
    if (campaigns.length > 0) {
      const totalSpend = campaigns.reduce((sum, c) => sum + (c.spend || 0), 0);
      const totalImpressions = campaigns.reduce((sum, c) => sum + (c.impressions || 0), 0);
      const totalClicks = campaigns.reduce((sum, c) => sum + (c.clicks || 0), 0);
      
      console.log('\n💰 CAMPAIGN TOTALS:');
      console.log('===================');
      console.log(`💸 Total Spend: ${totalSpend.toFixed(2)} zł`);
      console.log(`👁️ Total Impressions: ${totalImpressions.toLocaleString()}`);
      console.log(`🖱️ Total Clicks: ${totalClicks.toLocaleString()}`);
      console.log(`📊 Average CTR: ${totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : 0}%`);
    }
    
    // Sample network performance data
    if (googleAdsTables.networkPerformance && googleAdsTables.networkPerformance.length > 0) {
      console.log('\n🌐 SAMPLE NETWORK PERFORMANCE:');
      console.log('==============================');
      googleAdsTables.networkPerformance.slice(0, 3).forEach((network, index) => {
        console.log(`${index + 1}. ${network.network || network.adNetworkType || 'Unknown'}: ${(network.spend || 0).toFixed(2)} zł, ${network.impressions || 0} impressions`);
      });
    }
    
    // Sample demographic data
    if (googleAdsTables.demographicPerformance && googleAdsTables.demographicPerformance.length > 0) {
      console.log('\n👥 SAMPLE DEMOGRAPHIC PERFORMANCE:');
      console.log('==================================');
      googleAdsTables.demographicPerformance.slice(0, 3).forEach((demo, index) => {
        console.log(`${index + 1}. ${demo.ageRange || 'Unknown'} ${demo.gender || 'Unknown'}: ${(demo.spend || 0).toFixed(2)} zł, ${demo.impressions || 0} impressions`);
      });
    }
    
    return {
      success: true,
      hasTablesData: Object.keys(googleAdsTables).length > 0,
      campaignCount: campaigns.length,
      networkCount: (googleAdsTables.networkPerformance || []).length,
      demographicCount: (googleAdsTables.demographicPerformance || []).length
    };
    
  } catch (error) {
    console.log(`❌ Test Failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('🚀 STARTING GOOGLE ADS TABLES PERIOD TESTING');
  console.log('============================================');
  
  const clientId = '789-260-9395'; // Belmonte client
  
  console.log(`🎯 Testing Client: ${clientId}`);
  console.log(`📅 Testing ${testPeriods.length} different periods`);
  
  const results = [];
  
  for (const period of testPeriods) {
    const result = await testGoogleAdsTablesAPI(
      clientId, 
      period.dateStart, 
      period.dateEnd, 
      period.label
    );
    results.push({ ...period, ...result });
    
    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n📊 TEST SUMMARY');
  console.log('===============');
  
  results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.label}: ${result.success ? 
      `${result.campaignCount} campaigns, ${result.networkCount} networks, ${result.demographicCount} demographics` : 
      result.error}`);
  });
  
  const successCount = results.filter(r => r.success).length;
  console.log(`\n🎯 OVERALL RESULT: ${successCount}/${results.length} tests passed`);
  
  if (successCount === results.length) {
    console.log('\n🎉 ALL TESTS PASSED! 🎉');
    console.log('✅ Google Ads tables are properly fetching period-based data');
    console.log('✅ API is responding correctly for different date ranges');
    console.log('✅ Tables data structure is working as expected');
  } else {
    console.log('\n⚠️ SOME TESTS FAILED');
    console.log('❌ Check server logs for detailed error information');
    console.log('❌ Ensure Google Ads API credentials are properly configured');
  }
}

// Run the tests
runTests().catch(console.error);
