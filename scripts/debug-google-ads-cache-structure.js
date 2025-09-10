#!/usr/bin/env node

/**
 * Debug Google Ads Cache Structure
 * 
 * This script helps debug what's actually stored in the Google Ads smart cache
 * and why the tables data might not be getting through properly.
 */

const path = require('path');
const fs = require('fs');

console.log('🔍 GOOGLE ADS CACHE STRUCTURE DEBUG');
console.log('===================================');
console.log('');

// Test client ID (Belmonte Hotel)
const testClientId = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';
const baseUrl = 'http://localhost:3000';

async function debugGoogleAdsCacheStructure() {
  try {
    console.log('📊 DEBUGGING GOOGLE ADS CACHE STRUCTURE');
    console.log('=======================================');
    console.log('');

    // Test 1: Get smart cache data and inspect structure
    console.log('1️⃣ Fetching smart cache data...');
    
    try {
      const cacheResponse = await fetch(`${baseUrl}/api/google-ads-smart-cache`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: testClientId, forceRefresh: false })
      });
      
      if (cacheResponse.ok) {
        const cacheData = await cacheResponse.json();
        console.log('   ✅ Smart cache response received');
        console.log('');
        
        console.log('📋 CACHE DATA STRUCTURE:');
        console.log('========================');
        console.log(`   📊 Success: ${cacheData.success}`);
        console.log(`   📊 Source: ${cacheData.debug?.source || 'unknown'}`);
        console.log(`   📊 From cache: ${cacheData.data?.fromCache || false}`);
        console.log('');
        
        if (cacheData.data) {
          console.log('📋 DATA PROPERTIES:');
          console.log('==================');
          console.log(`   📊 Has campaigns: ${!!cacheData.data.campaigns}`);
          console.log(`   📊 Has stats: ${!!cacheData.data.stats}`);
          console.log(`   📊 Has conversionMetrics: ${!!cacheData.data.conversionMetrics}`);
          console.log(`   📊 Has googleAdsTables: ${!!cacheData.data.googleAdsTables}`);
          console.log('');
          
          if (cacheData.data.googleAdsTables) {
            console.log('📋 GOOGLE ADS TABLES STRUCTURE:');
            console.log('==============================');
            const tables = cacheData.data.googleAdsTables;
            console.log(`   📊 networkPerformance: ${Array.isArray(tables.networkPerformance) ? tables.networkPerformance.length : 'not array'}`);
            console.log(`   📊 qualityMetrics: ${Array.isArray(tables.qualityMetrics) ? tables.qualityMetrics.length : 'not array'}`);
            console.log(`   📊 devicePerformance: ${Array.isArray(tables.devicePerformance) ? tables.devicePerformance.length : 'not array'}`);
            console.log(`   📊 keywordPerformance: ${Array.isArray(tables.keywordPerformance) ? tables.keywordPerformance.length : 'not array'}`);
            console.log('');
            
            // Show sample data
            if (tables.networkPerformance && tables.networkPerformance.length > 0) {
              console.log('📋 SAMPLE NETWORK PERFORMANCE:');
              console.log('==============================');
              console.log(JSON.stringify(tables.networkPerformance[0], null, 2));
              console.log('');
            }
          } else {
            console.log('❌ No googleAdsTables in cache data');
            console.log('');
          }
        } else {
          console.log('❌ No data property in cache response');
          console.log('');
        }
      } else {
        console.log(`   ❌ Smart cache failed: ${cacheResponse.status}`);
        const errorText = await cacheResponse.text();
        console.log(`   Error: ${errorText}`);
      }
    } catch (cacheError) {
      console.log(`   ❌ Smart cache error: ${cacheError.message}`);
    }
    
    console.log('');

    // Test 2: Test live data API and see what it receives
    console.log('2️⃣ Testing live data API...');
    
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
      
      if (liveResponse.ok) {
        const liveData = await liveResponse.json();
        console.log('   ✅ Live data API response received');
        console.log('');
        
        console.log('📋 LIVE DATA STRUCTURE:');
        console.log('=======================');
        console.log(`   📊 Has campaigns: ${!!liveData.campaigns}`);
        console.log(`   📊 Has stats: ${!!liveData.stats}`);
        console.log(`   📊 Has conversionMetrics: ${!!liveData.conversionMetrics}`);
        console.log(`   📊 Has googleAdsTables: ${!!liveData.googleAdsTables}`);
        console.log('');
        
        if (liveData.googleAdsTables) {
          console.log('📋 LIVE API GOOGLE ADS TABLES:');
          console.log('==============================');
          const tables = liveData.googleAdsTables;
          console.log(`   📊 networkPerformance: ${Array.isArray(tables.networkPerformance) ? tables.networkPerformance.length : 'not array'}`);
          console.log(`   📊 qualityMetrics: ${Array.isArray(tables.qualityMetrics) ? tables.qualityMetrics.length : 'not array'}`);
          console.log(`   📊 devicePerformance: ${Array.isArray(tables.devicePerformance) ? tables.devicePerformance.length : 'not array'}`);
          console.log(`   📊 keywordPerformance: ${Array.isArray(tables.keywordPerformance) ? tables.keywordPerformance.length : 'not array'}`);
        } else {
          console.log('❌ No googleAdsTables in live data response');
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
    console.log('🎯 ANALYSIS:');
    console.log('============');
    console.log('1. Check if googleAdsTables exists in smart cache');
    console.log('2. Check if the structure matches what live API expects');
    console.log('3. Check if the live API is properly using cached data');
    console.log('');

  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

// Run the debug
debugGoogleAdsCacheStructure();
