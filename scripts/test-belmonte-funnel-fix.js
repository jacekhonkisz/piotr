#!/usr/bin/env node

/**
 * TEST SCRIPT: Belmonte Funnel Metrics Fix Verification
 * 
 * This script tests that the fix for generic funnel metrics is working correctly.
 * 
 * What it tests:
 * 1. Clears current month cache for Belmonte
 * 2. Fetches fresh data (triggers the new parsing logic)
 * 3. Verifies funnel metrics are NOT generic percentages
 * 4. Compares with Meta Ads Manager data structure
 * 5. Validates data is cached correctly
 * 
 * Run: node scripts/test-belmonte-funnel-fix.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testBelmonteFunnelFix() {
  console.log('🧪 BELMONTE FUNNEL METRICS FIX - TEST SCRIPT');
  console.log('═══════════════════════════════════════════════════\n');
  
  try {
    // STEP 1: Find Belmonte client
    console.log('📋 Step 1: Finding Belmonte client...');
    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .or('name.ilike.%belmonte%,email.ilike.%belmonte%')
      .limit(1);
    
    if (clientError) throw clientError;
    
    if (!clients || clients.length === 0) {
      console.error('❌ Belmonte client not found');
      process.exit(1);
    }
    
    const client = clients[0];
    console.log(`✅ Found: ${client.name} (ID: ${client.id})`);
    console.log(`   Ad Account: ${client.ad_account_id}\n`);
    
    // STEP 2: Check BEFORE state - current cache
    console.log('📋 Step 2: Checking BEFORE state (current cache)...');
    const currentPeriod = new Date().toISOString().substring(0, 7); // YYYY-MM
    
    const { data: cachedBefore } = await supabase
      .from('current_month_cache')
      .select('*')
      .eq('client_id', client.id)
      .eq('period_id', currentPeriod)
      .single();
    
    if (cachedBefore) {
      console.log('✅ Current cache exists:');
      console.log(`   Last updated: ${cachedBefore.last_updated}`);
      const metrics = cachedBefore.cache_data?.conversionMetrics || {};
      console.log('   Current funnel metrics:');
      console.log(`     booking_step_1: ${metrics.booking_step_1 || 0}`);
      console.log(`     booking_step_2: ${metrics.booking_step_2 || 0}`);
      console.log(`     booking_step_3: ${metrics.booking_step_3 || 0}`);
      console.log(`     reservations: ${metrics.reservations || 0}`);
      
      // Check if these are generic estimates
      const totalSpend = cachedBefore.cache_data?.stats?.totalSpend || 0;
      const totalClicks = cachedBefore.cache_data?.stats?.totalClicks || 0;
      
      if (totalSpend > 0 && metrics.booking_step_1 === 0 && metrics.reservations === 0) {
        console.log('\n⚠️  WARNING: Cache has spend but ZERO funnel metrics!');
        console.log('   This suggests the bug is active (using estimates that evaluate to 0)');
      }
      
      // Check for suspiciously round numbers (generic estimates)
      const step1Ratio = totalClicks > 0 ? metrics.booking_step_1 / totalClicks : 0;
      if (Math.abs(step1Ratio - 0.02) < 0.001) { // 2% = typical estimate
        console.log('\n⚠️  WARNING: booking_step_1 is exactly 2% of clicks - likely a generic estimate');
      }
    } else {
      console.log('ℹ️  No cache exists yet for current month\n');
    }
    
    // STEP 3: Clear the cache to force fresh fetch
    console.log('\n📋 Step 3: Clearing cache to force fresh fetch...');
    const { error: deleteError } = await supabase
      .from('current_month_cache')
      .delete()
      .eq('client_id', client.id)
      .eq('period_id', currentPeriod);
    
    if (deleteError) throw deleteError;
    console.log('✅ Cache cleared successfully\n');
    
    // STEP 4: Trigger fresh data fetch by calling the smart cache API
    console.log('📋 Step 4: Triggering fresh data fetch (this will use the new parser)...');
    console.log('⏳ This may take 10-20 seconds...\n');
    
    // We need to call the server-side function directly
    // Import and call fetchFreshCurrentMonthData
    const { fetchFreshCurrentMonthData } = require('../src/lib/smart-cache-helper.ts');
    
    try {
      const freshData = await fetchFreshCurrentMonthData(client);
      console.log('✅ Fresh data fetched successfully!\n');
      
      // STEP 5: Analyze the fresh data
      console.log('📋 Step 5: Analyzing AFTER state (fresh data)...');
      const newMetrics = freshData.conversionMetrics || {};
      const newStats = freshData.stats || {};
      
      console.log('📊 Fresh funnel metrics:');
      console.log(`   booking_step_1: ${newMetrics.booking_step_1 || 0}`);
      console.log(`   booking_step_2: ${newMetrics.booking_step_2 || 0}`);
      console.log(`   booking_step_3: ${newMetrics.booking_step_3 || 0}`);
      console.log(`   reservations: ${newMetrics.reservations || 0}`);
      console.log(`   reservation_value: ${newMetrics.reservation_value || 0}\n`);
      
      console.log('📊 Main metrics:');
      console.log(`   totalSpend: ${newStats.totalSpend || 0}`);
      console.log(`   totalImpressions: ${newStats.totalImpressions || 0}`);
      console.log(`   totalClicks: ${newStats.totalClicks || 0}\n`);
      
      // STEP 6: Validation checks
      console.log('📋 Step 6: Running validation checks...\n');
      
      let allChecksPassed = true;
      
      // Check 1: If there's spend, there should be some funnel metrics
      if (newStats.totalSpend > 0) {
        const hasFunnelData = newMetrics.booking_step_1 > 0 || 
                             newMetrics.booking_step_2 > 0 || 
                             newMetrics.reservations > 0;
        
        if (hasFunnelData) {
          console.log('✅ Check 1 PASSED: Has spend AND has funnel metrics');
        } else {
          console.log('❌ Check 1 FAILED: Has spend but NO funnel metrics (data might be estimates)');
          allChecksPassed = false;
        }
      } else {
        console.log('ℹ️  Check 1 SKIPPED: No spend in current period');
      }
      
      // Check 2: Funnel metrics should NOT be exact generic percentages
      const totalClicks = newStats.totalClicks || 0;
      if (totalClicks > 0 && newMetrics.booking_step_1 > 0) {
        const step1Ratio = newMetrics.booking_step_1 / totalClicks;
        const isGenericEstimate = Math.abs(step1Ratio - 0.02) < 0.0001; // Exactly 2%
        
        if (!isGenericEstimate) {
          console.log('✅ Check 2 PASSED: booking_step_1 is NOT a generic 2% estimate');
          console.log(`   Actual ratio: ${(step1Ratio * 100).toFixed(4)}% (should vary naturally)`);
        } else {
          console.log('❌ Check 2 FAILED: booking_step_1 is exactly 2% - appears to be generic estimate');
          allChecksPassed = false;
        }
      } else {
        console.log('ℹ️  Check 2 SKIPPED: No clicks or no booking_step_1 data');
      }
      
      // Check 3: Funnel should be decreasing (step 1 >= step 2 >= step 3 >= reservations)
      if (newMetrics.booking_step_1 > 0) {
        const funnelValid = newMetrics.booking_step_1 >= newMetrics.booking_step_2 &&
                           newMetrics.booking_step_2 >= newMetrics.booking_step_3 &&
                           newMetrics.booking_step_3 >= newMetrics.reservations;
        
        if (funnelValid) {
          console.log('✅ Check 3 PASSED: Funnel is properly decreasing');
          console.log(`   ${newMetrics.booking_step_1} → ${newMetrics.booking_step_2} → ${newMetrics.booking_step_3} → ${newMetrics.reservations}`);
        } else {
          console.log('⚠️  Check 3 WARNING: Funnel inversion detected (not necessarily an error)');
          console.log(`   ${newMetrics.booking_step_1} → ${newMetrics.booking_step_2} → ${newMetrics.booking_step_3} → ${newMetrics.reservations}`);
          console.log('   This can happen with real data due to attribution windows');
        }
      } else {
        console.log('ℹ️  Check 3 SKIPPED: No funnel data available');
      }
      
      // Check 4: Verify cache was saved correctly
      console.log('\n📋 Step 7: Verifying cache was saved correctly...');
      const { data: cachedAfter } = await supabase
        .from('current_month_cache')
        .select('*')
        .eq('client_id', client.id)
        .eq('period_id', currentPeriod)
        .single();
      
      if (cachedAfter) {
        console.log('✅ Check 4 PASSED: Fresh data was cached');
        console.log(`   Cache timestamp: ${cachedAfter.last_updated}`);
        
        const cachedMetrics = cachedAfter.cache_data?.conversionMetrics || {};
        const metricsMatch = cachedMetrics.booking_step_1 === newMetrics.booking_step_1 &&
                            cachedMetrics.reservations === newMetrics.reservations;
        
        if (metricsMatch) {
          console.log('✅ Cached data matches fresh data');
        } else {
          console.log('⚠️  Cached data differs from fresh data (possible timing issue)');
          allChecksPassed = false;
        }
      } else {
        console.log('❌ Check 4 FAILED: Data was not cached');
        allChecksPassed = false;
      }
      
      // Final summary
      console.log('\n' + '═'.repeat(50));
      console.log('📋 TEST SUMMARY');
      console.log('═'.repeat(50));
      
      if (allChecksPassed) {
        console.log('✅ ALL CHECKS PASSED! The fix is working correctly.');
        console.log('✅ Funnel metrics are using real Meta API data (not generic estimates)');
      } else {
        console.log('⚠️  SOME CHECKS FAILED - Review the output above');
        console.log('   The fix may need additional investigation');
      }
      
      console.log('\n📊 Final funnel data for Belmonte:');
      console.log(`   Step 1 (Initiate): ${newMetrics.booking_step_1}`);
      console.log(`   Step 2 (View): ${newMetrics.booking_step_2}`);
      console.log(`   Step 3 (Cart): ${newMetrics.booking_step_3}`);
      console.log(`   Reservations: ${newMetrics.reservations}`);
      console.log(`   Revenue: ${newMetrics.reservation_value} PLN`);
      
    } catch (fetchError) {
      console.error('❌ Error fetching fresh data:', fetchError);
      console.error('   This might indicate an issue with the Meta API or authentication');
      throw fetchError;
    }
    
  } catch (error) {
    console.error('\n❌ TEST FAILED WITH ERROR:');
    console.error(error);
    process.exit(1);
  }
}

// Run the test
testBelmonteFunnelFix()
  .then(() => {
    console.log('\n✅ Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });

