/**
 * CONCURRENT CLIENT TEST
 * 
 * Tests what happens when multiple clients request data simultaneously.
 * This simulates production load with multiple users accessing the dashboard.
 * 
 * Run with: npx tsx scripts/test_concurrent_clients.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConcurrentClients() {
  console.log('🧪 CONCURRENT CLIENT TEST');
  console.log('=========================\n');

  try {
    // Get multiple clients
    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .limit(3);

    if (clientError || !clients || clients.length === 0) {
      console.error('❌ Error fetching clients:', clientError);
      return;
    }

    console.log(`📊 Testing with ${clients.length} clients simultaneously\n`);

    // Clear all Meta caches first
    console.log('Step 1: Clear all existing caches');
    console.log('─'.repeat(60));
    
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const periodId = `${year}-${String(month).padStart(2, '0')}`;

    for (const client of clients) {
      const { error: deleteError } = await supabase
        .from('current_month_cache')
        .delete()
        .eq('client_id', client.id)
        .eq('period_id', periodId);

      if (deleteError) {
        console.log(`   ⚠️  Error clearing cache for ${client.company}:`, deleteError.message);
      } else {
        console.log(`   ✅ Cleared cache for ${client.company}`);
      }
    }

    console.log();
    console.log('Step 2: Trigger concurrent data fetches');
    console.log('─'.repeat(60));
    console.log('📡 Fetching data for all clients simultaneously...\n');

    // Import the smart cache function
    const { fetchFreshCurrentMonthData } = await import('../src/lib/smart-cache-helper');

    // Start all fetches concurrently
    const startTime = Date.now();
    
    const promises = clients.map(async (client, index) => {
      const clientStartTime = Date.now();
      console.log(`🚀 [Client ${index + 1}] Starting fetch for ${client.company || client.name}...`);
      
      try {
        const data = await fetchFreshCurrentMonthData(client);
        const clientEndTime = Date.now();
        const duration = clientEndTime - clientStartTime;
        
        return {
          success: true,
          client: client.company || client.name,
          clientId: client.id,
          duration,
          stats: data?.stats,
          conversionMetrics: data?.conversionMetrics
        };
      } catch (error) {
        const clientEndTime = Date.now();
        const duration = clientEndTime - clientStartTime;
        
        return {
          success: false,
          client: client.company || client.name,
          clientId: client.id,
          duration,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Wait for all to complete
    const results = await Promise.all(promises);
    const endTime = Date.now();
    const totalDuration = endTime - startTime;

    console.log();
    console.log('Step 3: Analyze results');
    console.log('─'.repeat(60));
    console.log(`⏱️  Total time: ${totalDuration}ms\n`);

    // Analyze each result
    results.forEach((result, index) => {
      console.log(`📊 Client ${index + 1}: ${result.client}`);
      console.log(`   Duration: ${result.duration}ms`);
      
      if (result.success) {
        console.log(`   ✅ Success`);
        console.log(`   Spend: ${result.stats?.totalSpend || 0}`);
        console.log(`   Impressions: ${result.stats?.totalImpressions || 0}`);
        console.log(`   Clicks: ${result.stats?.totalClicks || 0}`);
        
        // Check for zero data
        if (result.stats?.totalSpend === 0 && 
            result.stats?.totalImpressions === 0 && 
            result.stats?.totalClicks === 0) {
          console.log(`   🚨 WARNING: All metrics are ZERO!`);
        }
      } else {
        console.log(`   ❌ Failed: ${result.error}`);
      }
      console.log();
    });

    // Check for race condition indicators
    console.log('🔍 Race Condition Analysis');
    console.log('─'.repeat(60));
    
    const successfulResults = results.filter(r => r.success);
    const failedResults = results.filter(r => !r.success);
    const zeroDataResults = successfulResults.filter(r => 
      r.stats?.totalSpend === 0 && 
      r.stats?.totalImpressions === 0 && 
      r.stats?.totalClicks === 0
    );

    console.log(`Total requests: ${results.length}`);
    console.log(`Successful: ${successfulResults.length}`);
    console.log(`Failed: ${failedResults.length}`);
    console.log(`Zero data: ${zeroDataResults.length}`);
    console.log();

    if (failedResults.length > 0) {
      console.log('🚨 FAILURES DETECTED:');
      failedResults.forEach(r => {
        console.log(`   - ${r.client}: ${r.error}`);
      });
      console.log();
    }

    if (zeroDataResults.length > 0) {
      console.log('🚨 ZERO DATA DETECTED:');
      zeroDataResults.forEach(r => {
        console.log(`   - ${r.client}`);
      });
      console.log();
    }

    // Performance analysis
    console.log('⚡ Performance Analysis');
    console.log('─'.repeat(60));
    
    const durations = results.map(r => r.duration);
    const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const maxDuration = Math.max(...durations);
    const minDuration = Math.min(...durations);

    console.log(`Average duration: ${avgDuration.toFixed(0)}ms`);
    console.log(`Min duration: ${minDuration}ms`);
    console.log(`Max duration: ${maxDuration}ms`);
    console.log(`Duration spread: ${maxDuration - minDuration}ms`);
    console.log();

    // Final verdict
    console.log('🎯 VERDICT');
    console.log('─'.repeat(60));
    
    if (failedResults.length === 0 && zeroDataResults.length === 0) {
      console.log('✅ PASSED: No race conditions detected');
      console.log('✅ All clients received correct data concurrently');
    } else {
      console.log('🚨 FAILED: Issues detected in concurrent execution');
      if (failedResults.length > 0) {
        console.log(`   - ${failedResults.length} clients failed to fetch data`);
      }
      if (zeroDataResults.length > 0) {
        console.log(`   - ${zeroDataResults.length} clients received zero data`);
      }
    }

    console.log();
    console.log('=' .repeat(60));

  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

// Run the test
testConcurrentClients().then(() => {
  console.log('\n✅ Test completed');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});


