#!/usr/bin/env tsx

/**
 * Controlled Weekly Data Re-Collection
 * 
 * This script re-collects weekly data for all clients with:
 * - Progress tracking
 * - Error handling
 * - Rate limiting
 * - Detailed logging
 * 
 * Run: npx tsx scripts/recollect-weeks-controlled.ts [--weeks=53] [--client=name]
 */

import { createClient } from '@supabase/supabase-js';
import { getLastNWeeks, formatDateISO, validateIsMonday } from '../src/lib/week-helpers';

require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const apiUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://piotr-gamma.vercel.app';
const cronSecret = process.env.CRON_SECRET!;

if (!supabaseUrl || !supabaseKey || !cronSecret) {
  console.error('❌ Missing environment variables');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Parse command line arguments
const args = process.argv.slice(2);
const weeksToCollect = parseInt(args.find(a => a.startsWith('--weeks='))?.split('=')[1] || '53');
const targetClient = args.find(a => a.startsWith('--client='))?.split('=')[1];

interface CollectionResult {
  client: string;
  week: string;
  success: boolean;
  duration: number;
  error?: string;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function collectWeekForClient(
  clientId: string, 
  clientName: string,
  weekMonday: Date
): Promise<CollectionResult> {
  const weekStr = formatDateISO(weekMonday);
  const startTime = Date.now();
  
  try {
    // Validate week is Monday
    validateIsMonday(weekMonday);
    
    console.log(`   📅 ${weekStr} - Triggering collection...`);
    
    // Trigger collection via API
    const response = await fetch(
      `${apiUrl}/api/automated/collect-weekly-summaries?testClient=${encodeURIComponent(clientName)}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cronSecret}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const duration = Date.now() - startTime;
    
    if (response.ok) {
      console.log(`   ✅ ${weekStr} - Collected (${(duration / 1000).toFixed(1)}s)`);
      return {
        client: clientName,
        week: weekStr,
        success: true,
        duration
      };
    } else {
      const error = await response.text();
      console.log(`   ⚠️  ${weekStr} - Failed: ${response.status}`);
      return {
        client: clientName,
        week: weekStr,
        success: false,
        duration,
        error: `HTTP ${response.status}: ${error}`
      };
    }
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.log(`   ❌ ${weekStr} - Error: ${error.message}`);
    return {
      client: clientName,
      week: weekStr,
      success: false,
      duration,
      error: error.message
    };
  }
}

async function recollectAllWeeks() {
  console.log('🚀 CONTROLLED WEEKLY DATA RE-COLLECTION\n');
  console.log('=' .repeat(70));
  console.log(`\nConfiguration:`);
  console.log(`  Weeks to collect: ${weeksToCollect}`);
  console.log(`  Target client: ${targetClient || 'ALL'}`);
  console.log(`  API URL: ${apiUrl}`);
  console.log('');
  console.log('=' .repeat(70));
  
  // Get all clients
  const { data: clients, error: clientError } = await supabase
    .from('clients')
    .select('id, name')
    .order('name');
  
  if (clientError || !clients) {
    console.error('❌ Failed to fetch clients:', clientError);
    return;
  }
  
  // Filter to target client if specified
  const targetClients = targetClient 
    ? clients.filter(c => c.name.toLowerCase().includes(targetClient.toLowerCase()))
    : clients;
  
  if (targetClients.length === 0) {
    console.error(`❌ No clients found matching: ${targetClient}`);
    return;
  }
  
  console.log(`\n✅ Found ${targetClients.length} client(s) to process\n`);
  
  // Generate ISO week Mondays
  const weekMondays = getLastNWeeks(weeksToCollect, false); // Don't include current week
  console.log(`📅 Generated ${weekMondays.length} ISO week dates (all Mondays)\n`);
  
  // Validate all weeks are Mondays
  let invalidWeeks = 0;
  weekMondays.forEach(week => {
    try {
      validateIsMonday(week);
    } catch (error) {
      console.error(`❌ Invalid week: ${formatDateISO(week)} - ${error.message}`);
      invalidWeeks++;
    }
  });
  
  if (invalidWeeks > 0) {
    console.error(`❌ Found ${invalidWeeks} invalid weeks. Aborting.`);
    return;
  }
  
  console.log(`✅ All ${weekMondays.length} weeks validated as Mondays\n`);
  console.log('=' .repeat(70));
  
  // Collection statistics
  const results: CollectionResult[] = [];
  let successCount = 0;
  let failCount = 0;
  
  const totalOperations = targetClients.length * weekMondays.length;
  let completedOperations = 0;
  
  // Process each client
  for (const client of targetClients) {
    console.log(`\n\n📊 Processing: ${client.name}`);
    console.log('-'.repeat(70));
    
    // Check existing weeks
    const { data: existing } = await supabase
      .from('campaign_summaries')
      .select('summary_date, platform')
      .eq('client_id', client.id)
      .eq('summary_type', 'weekly');
    
    const existingWeeks = new Set(
      (existing || []).map(e => e.summary_date)
    );
    
    console.log(`   Found ${existingWeeks.size} existing weeks in database`);
    console.log(`   Will collect ${weekMondays.length} weeks\n`);
    
    // Collect each week
    for (let i = 0; i < weekMondays.length; i++) {
      const weekMonday = weekMondays[i];
      const weekStr = formatDateISO(weekMonday);
      
      completedOperations++;
      const progress = ((completedOperations / totalOperations) * 100).toFixed(1);
      
      console.log(`   [${completedOperations}/${totalOperations}] (${progress}%)`);
      
      // Check if week already exists
      if (existingWeeks.has(weekStr)) {
        console.log(`   ⏭️  ${weekStr} - Already exists, skipping`);
        continue;
      }
      
      // Collect the week
      const result = await collectWeekForClient(client.id, client.name, weekMonday);
      results.push(result);
      
      if (result.success) {
        successCount++;
      } else {
        failCount++;
      }
      
      // Rate limiting: Wait between requests
      if (i < weekMondays.length - 1) {
        await sleep(2000); // 2 seconds between requests
      }
    }
    
    // Wait between clients
    if (targetClients.indexOf(client) < targetClients.length - 1) {
      console.log(`\n   ⏸️  Waiting 5 seconds before next client...`);
      await sleep(5000);
    }
  }
  
  // Summary
  console.log('\n\n' + '='.repeat(70));
  console.log('📊 COLLECTION SUMMARY');
  console.log('='.repeat(70));
  console.log(`\n✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📊 Total operations: ${totalOperations}`);
  console.log(`⏭️  Skipped (existing): ${totalOperations - results.length}`);
  console.log(`🔄 Attempted: ${results.length}`);
  
  if (failCount > 0) {
    console.log(`\n⚠️  Failed weeks:`);
    results
      .filter(r => !r.success)
      .forEach(r => {
        console.log(`   - ${r.client} / ${r.week}: ${r.error}`);
      });
  }
  
  const avgDuration = results.length > 0
    ? (results.reduce((sum, r) => sum + r.duration, 0) / results.length / 1000).toFixed(1)
    : 0;
  
  console.log(`\n⏱️  Average duration: ${avgDuration}s per week`);
  console.log(`📊 Total time: ${(results.reduce((sum, r) => sum + r.duration, 0) / 1000 / 60).toFixed(1)} minutes`);
  
  console.log('\n' + '='.repeat(70));
  
  if (failCount === 0) {
    console.log('🎉 All collections completed successfully!');
  } else {
    console.log('⚠️  Some collections failed. Review errors above.');
  }
  
  console.log('\nNext steps:');
  console.log('  1. Verify: npx tsx scripts/check-weekly-duplicates.ts');
  console.log('  2. Check database: All weeks should start on Monday');
  console.log('  3. Review reports to confirm data accuracy');
  
  console.log('\n' + '='.repeat(70));
}

// Run the collection
recollectAllWeeks().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});

