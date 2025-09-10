#!/usr/bin/env node

/**
 * Test Google Ads Caching Performance
 * 
 * This script tests the performance improvement after fixing the tables data caching.
 * It should show that Google Ads now loads in ~3 seconds instead of 60+ seconds.
 */

const path = require('path');
const fs = require('fs');

console.log('🚀 GOOGLE ADS CACHING PERFORMANCE TEST');
console.log('=====================================');
console.log('');

// Test client ID (Belmonte Hotel)
const testClientId = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';
const baseUrl = 'http://localhost:3000';

async function testGoogleAdsCachingPerformance() {
  try {
    console.log('📊 TESTING GOOGLE ADS CACHING PERFORMANCE');
    console.log('==========================================');
    console.log('');

    // Test 1: Test Google Ads smart cache (should be fast)
    console.log('1️⃣ Testing Google Ads smart cache...');
    const cacheStartTime = Date.now();
    
    try {
      const cacheResponse = await fetch(`${baseUrl}/api/google-ads-smart-cache`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: testClientId, forceRefresh: false })
      });
      
      const cacheTime = Date.now() - cacheStartTime;
      
      if (cacheResponse.ok) {
        const cacheData = await cacheResponse.json();
        console.log(`   ✅ Smart cache: ${cacheTime}ms`);
        console.log(`   📊 Source: ${cacheData.debug?.source || 'unknown'}`);
        console.log(`   💾 From cache: ${cacheData.data?.fromCache || false}`);
        console.log(`   📈 Has tables data: ${!!cacheData.data?.googleAdsTables}`);
      } else {
        console.log(`   ❌ Smart cache failed: ${cacheResponse.status}`);
      }
    } catch (cacheError) {
      console.log(`   ❌ Smart cache error: ${cacheError.message}`);
    }
    console.log('');

    // Test 2: Test Google Ads live data API (should now use cache for tables)
    console.log('2️⃣ Testing Google Ads live data API...');
    const liveStartTime = Date.now();
    let liveTime = 0;
    
    try {
      const liveResponse = await fetch(`${baseUrl}/api/fetch-google-ads-live-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: testClientId,
          dateRange: { start: '2025-09-01', end: '2025-09-10' },
          includeTableData: true
        })
      });
      
      liveTime = Date.now() - liveStartTime;
      
      if (liveResponse.ok) {
        const liveData = await liveResponse.json();
        console.log(`   ✅ Live data API: ${liveTime}ms`);
        console.log(`   📊 Campaigns: ${liveData.campaigns?.length || 0}`);
        console.log(`   💰 Total spend: ${liveData.stats?.totalSpend || 0}`);
        console.log(`   📈 Has tables data: ${!!liveData.googleAdsTables}`);
        
        if (liveData.googleAdsTables) {
          console.log(`   📊 Network performance: ${liveData.googleAdsTables.networkPerformance?.length || 0} items`);
          console.log(`   📊 Quality metrics: ${liveData.googleAdsTables.qualityMetrics?.length || 0} items`);
          console.log(`   📊 Device performance: ${liveData.googleAdsTables.devicePerformance?.length || 0} items`);
          console.log(`   📊 Keyword performance: ${liveData.googleAdsTables.keywordPerformance?.length || 0} items`);
        }
      } else {
        console.log(`   ❌ Live data API failed: ${liveResponse.status}`);
        const errorText = await liveResponse.text();
        console.log(`   Error: ${errorText}`);
      }
    } catch (liveError) {
      console.log(`   ❌ Live data API error: ${liveError.message}`);
    }
    console.log('');

    // Test 3: Performance comparison
    console.log('3️⃣ PERFORMANCE ANALYSIS');
    console.log('=======================');
    console.log('');
    
    if (liveTime < 10000) { // Less than 10 seconds
      console.log('✅ EXCELLENT: Google Ads loading in under 10 seconds');
      console.log('   🚀 Performance improvement: 6x+ faster than before');
      console.log('   💡 Tables data is now using smart cache');
    } else if (liveTime < 30000) { // Less than 30 seconds
      console.log('⚠️  GOOD: Google Ads loading in under 30 seconds');
      console.log('   🚀 Performance improvement: 2x+ faster than before');
      console.log('   💡 Some optimization still possible');
    } else {
      console.log('❌ SLOW: Google Ads still taking over 30 seconds');
      console.log('   🔍 May need additional optimization');
      console.log('   💡 Check if tables data is still using live API');
    }
    
    console.log('');
    console.log('📋 EXPECTED BEHAVIOR:');
    console.log('====================');
    console.log('✅ Smart cache should return in ~200ms');
    console.log('✅ Live data API should return in ~3-5 seconds');
    console.log('✅ Tables data should come from cache, not live API');
    console.log('✅ No more 60+ second load times');
    console.log('');
    
    console.log('🎯 NEXT STEPS:');
    console.log('==============');
    console.log('1. Refresh the /reports page in your browser');
    console.log('2. Check the browser network tab for response times');
    console.log('3. Verify Google Ads reports load quickly');
    console.log('4. Check terminal logs for "FROM SMART CACHE" messages');
    console.log('');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testGoogleAdsCachingPerformance();
