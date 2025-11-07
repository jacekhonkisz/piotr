#!/usr/bin/env node

/**
 * Google Ads Tables Data Cache Verification Script
 * 
 * This script verifies that:
 * 1. Smart cache is storing tables data correctly
 * 2. Cache is fresh (< 6 hours old)
 * 3. Cron jobs are running
 * 4. Tables data structure is complete
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyGoogleAdsTablesCache() {
  console.log('🔍 Google Ads Tables Data Cache Verification\n');
  console.log('='.repeat(60));
  
  // Get current month period ID
  const now = new Date();
  const currentPeriodId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  console.log(`📅 Current Period: ${currentPeriodId}\n`);
  
  // 1. Check if cache table exists and has data
  console.log('1️⃣ Checking google_ads_current_month_cache table...');
  const { data: cacheData, error: cacheError } = await supabase
    .from('google_ads_current_month_cache')
    .select('*')
    .eq('period_id', currentPeriodId);
  
  if (cacheError) {
    console.log('❌ Error querying cache:', cacheError.message);
    return;
  }
  
  if (!cacheData || cacheData.length === 0) {
    console.log(`⚠️ No cache data found for period ${currentPeriodId}`);
    console.log('   This could mean:');
    console.log('   - Cron job hasn\'t run yet');
    console.log('   - No clients configured for Google Ads');
    console.log('   - Cache refresh is failing\n');
    
    // Check if there's any cache data at all
    const { data: anyCacheData } = await supabase
      .from('google_ads_current_month_cache')
      .select('period_id, last_updated')
      .order('last_updated', { ascending: false })
      .limit(5);
    
    if (anyCacheData && anyCacheData.length > 0) {
      console.log('   Recent cache entries found:');
      anyCacheData.forEach(entry => {
        console.log(`   - Period: ${entry.period_id}, Updated: ${entry.last_updated}`);
      });
    }
    return;
  }
  
  console.log(`✅ Found ${cacheData.length} cache entries for current period\n`);
  
  // 2. Check each cache entry
  let allGood = true;
  
  for (const cache of cacheData) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`📊 Cache Entry: ${cache.client_id}`);
    console.log(`${'─'.repeat(60)}`);
    
    // Check last updated time
    const lastUpdated = new Date(cache.last_updated);
    const hoursSinceUpdate = (now - lastUpdated) / (1000 * 60 * 60);
    
    console.log(`⏰ Last Updated: ${lastUpdated.toISOString()}`);
    console.log(`⏱️  Hours Since Update: ${hoursSinceUpdate.toFixed(2)} hours`);
    
    if (hoursSinceUpdate > 6) {
      console.log(`⚠️ Cache is STALE (> 6 hours old)`);
      console.log(`   Cron job may not be running properly`);
      allGood = false;
    } else if (hoursSinceUpdate > 3) {
      console.log(`⚠️ Cache is AGING (> 3 hours old)`);
      console.log(`   Will refresh soon, but within acceptable range`);
    } else {
      console.log(`✅ Cache is FRESH (< 3 hours old)`);
    }
    
    // Check cache_data structure
    const cacheDataJson = cache.cache_data;
    
    // Check if googleAdsTables exists
    if (!cacheDataJson.googleAdsTables) {
      console.log(`❌ googleAdsTables NOT FOUND in cache_data`);
      console.log(`   Tables data is missing - optimization not working!`);
      allGood = false;
      continue;
    }
    
    console.log(`✅ googleAdsTables exists in cache`);
    
    // Check individual table components
    const tables = cacheDataJson.googleAdsTables;
    const requiredTables = [
      'networkPerformance',
      'qualityMetrics',
      'devicePerformance',
      'keywordPerformance'
    ];
    
    console.log(`\n📋 Tables Data Structure:`);
    
    for (const tableName of requiredTables) {
      if (tables[tableName]) {
        const count = Array.isArray(tables[tableName]) ? tables[tableName].length : 'N/A';
        console.log(`   ✅ ${tableName}: ${count} records`);
      } else {
        console.log(`   ❌ ${tableName}: MISSING`);
        allGood = false;
      }
    }
    
    // Check main campaign data
    if (cacheDataJson.campaigns) {
      console.log(`\n📊 Campaign Data:`);
      console.log(`   ✅ Campaigns: ${cacheDataJson.campaigns.length} campaigns`);
    }
    
    if (cacheDataJson.stats) {
      console.log(`   ✅ Stats: Total Spend = ${cacheDataJson.stats.totalSpend?.toFixed(2) || 0}`);
    }
    
    if (cacheDataJson.conversionMetrics) {
      console.log(`   ✅ Conversion Metrics: ${Object.keys(cacheDataJson.conversionMetrics).length} metrics`);
    }
  }
  
  // 3. Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 VERIFICATION SUMMARY');
  console.log('='.repeat(60));
  
  if (allGood) {
    console.log('✅ ALL CHECKS PASSED');
    console.log('');
    console.log('   Your Google Ads tables data caching is working correctly!');
    console.log('   - Cache is fresh and up-to-date');
    console.log('   - Tables data is properly stored');
    console.log('   - All required table components present');
    console.log('');
    console.log('   Expected Performance: 2-3 seconds load time ⚡');
  } else {
    console.log('⚠️ ISSUES DETECTED');
    console.log('');
    console.log('   Some problems were found with the cache:');
    console.log('   - Check if cron jobs are running');
    console.log('   - Verify cache refresh endpoint is working');
    console.log('   - Review logs for errors');
    console.log('');
    console.log('   Manual refresh: POST /api/automated/refresh-google-ads-current-month-cache');
  }
  
  console.log('='.repeat(60));
  
  // 4. Check cron job execution (optional - if you have a cron_jobs_log table)
  console.log('\n4️⃣ Checking recent cron job executions...');
  
  // Try to get system health if available
  try {
    const { data: systemData } = await supabase
      .from('system_settings')
      .select('key, value')
      .eq('key', 'last_google_ads_cache_refresh');
    
    if (systemData && systemData.length > 0) {
      console.log(`✅ Last cache refresh recorded: ${systemData[0].value}`);
    } else {
      console.log('ℹ️  No cron job tracking found (this is optional)');
    }
  } catch (e) {
    console.log('ℹ️  Cron job tracking not available (this is normal)');
  }
}

// Run verification
verifyGoogleAdsTablesCache()
  .then(() => {
    console.log('\n✅ Verification complete\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  });

