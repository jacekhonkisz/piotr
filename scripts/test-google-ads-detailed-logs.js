#!/usr/bin/env node

/**
 * Test Google Ads Detailed Logs
 * 
 * This script tests the Google Ads live data API and shows detailed logs
 * to help debug why tables data is not coming through from cache.
 */

const path = require('path');
const fs = require('fs');

console.log('🔍 GOOGLE ADS DETAILED LOGS TEST');
console.log('=================================');
console.log('');

// Test client ID (Belmonte Hotel)
const testClientId = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';
const baseUrl = 'http://localhost:3000';

async function testGoogleAdsDetailedLogs() {
  try {
    console.log('📊 TESTING GOOGLE ADS LIVE DATA API WITH DETAILED LOGS');
    console.log('======================================================');
    console.log('');

    // Test the live data API and capture the response
    console.log('🚀 Calling Google Ads live data API...');
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${baseUrl}/api/fetch-google-ads-live-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: testClientId,
          dateRange: { start: '2025-09-01', end: '2025-09-10' },
          includeTableData: true
        })
      });
      
      const responseTime = Date.now() - startTime;
      
      if (response.ok) {
        const data = await response.json();
        console.log(`   ✅ Response received in ${responseTime}ms`);
        console.log('');
        
        console.log('📋 RESPONSE ANALYSIS:');
        console.log('=====================');
        console.log(`   📊 Success: ${data.success || false}`);
        console.log(`   📊 Has campaigns: ${!!data.campaigns}`);
        console.log(`   📊 Has stats: ${!!data.stats}`);
        console.log(`   📊 Has conversionMetrics: ${!!data.conversionMetrics}`);
        console.log(`   📊 Has googleAdsTables: ${!!data.googleAdsTables}`);
        console.log('');
        
        if (data.googleAdsTables) {
          console.log('📋 GOOGLE ADS TABLES DETAILS:');
          console.log('=============================');
          const tables = data.googleAdsTables;
          console.log(`   📊 networkPerformance: ${Array.isArray(tables.networkPerformance) ? tables.networkPerformance.length : typeof tables.networkPerformance}`);
          console.log(`   📊 qualityMetrics: ${Array.isArray(tables.qualityMetrics) ? tables.qualityMetrics.length : typeof tables.qualityMetrics}`);
          console.log(`   📊 devicePerformance: ${Array.isArray(tables.devicePerformance) ? tables.devicePerformance.length : typeof tables.devicePerformance}`);
          console.log(`   📊 keywordPerformance: ${Array.isArray(tables.keywordPerformance) ? tables.keywordPerformance.length : typeof tables.keywordPerformance}`);
          console.log('');
          
          // Show sample data if available
          if (tables.networkPerformance && Array.isArray(tables.networkPerformance) && tables.networkPerformance.length > 0) {
            console.log('📋 SAMPLE NETWORK PERFORMANCE:');
            console.log('==============================');
            console.log(JSON.stringify(tables.networkPerformance[0], null, 2));
            console.log('');
          }
        } else {
          console.log('❌ No googleAdsTables in response');
          console.log('');
        }
        
        // Check debug info
        if (data.debug) {
          console.log('📋 DEBUG INFO:');
          console.log('==============');
          console.log(`   📊 Source: ${data.debug.source}`);
          console.log(`   📊 Cache policy: ${data.debug.cachePolicy}`);
          console.log(`   📊 Response time: ${data.debug.responseTime}ms`);
          console.log('');
        }
        
      } else {
        console.log(`   ❌ API call failed: ${response.status} ${response.statusText}`);
        const errorText = await response.text();
        console.log(`   Error: ${errorText}`);
      }
    } catch (error) {
      console.log(`   ❌ API call error: ${error.message}`);
    }
    
    console.log('');
    console.log('🎯 WHAT TO LOOK FOR IN SERVER LOGS:');
    console.log('===================================');
    console.log('1. Look for "✅ GOOGLE ADS TABLES DATA FROM SMART CACHE"');
    console.log('2. Look for "📊 Cache tables structure:" with hasNetwork, hasQuality, etc.');
    console.log('3. Look for "⚠️ No cached tables data, fetching from live API..."');
    console.log('4. Check if qualityMetrics is showing as "not array"');
    console.log('');
    
    console.log('💡 EXPECTED BEHAVIOR:');
    console.log('=====================');
    console.log('✅ Should see "FROM SMART CACHE" message');
    console.log('✅ Should see cache tables structure with all true values');
    console.log('✅ Should NOT see "fetching from live API" message');
    console.log('✅ Response should have googleAdsTables: true');
    console.log('');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testGoogleAdsDetailedLogs();
