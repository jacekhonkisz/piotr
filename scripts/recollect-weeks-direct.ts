/**
 * DIRECT WEEKLY DATA COLLECTION (FIXED VERSION)
 * 
 * This script bypasses the API and calls BackgroundDataCollector directly
 * to ensure each week gets its SPECIFIC date range (not current month)
 * 
 * Fixes the bug where all weeks showed identical current month data
 * 
 * Run: npx tsx scripts/recollect-weeks-direct.ts [--weeks=53] [--client=name]
 */

// ✅ Load environment variables FIRST before importing anything
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local from project root
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// Now import after env vars are loaded
import { BackgroundDataCollector } from '../src/lib/background-data-collector';
import { createClient } from '@supabase/supabase-js';

// Parse command line arguments
const args = process.argv.slice(2);
const weeksToCollect = parseInt(args.find(a => a.startsWith('--weeks='))?.split('=')[1] || '53');
const targetClient = args.find(a => a.startsWith('--client='))?.split('=')[1];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('🚀 DIRECT WEEKLY DATA COLLECTION (FIXED)\n');
  console.log('=' .repeat(70));
  console.log(`\nConfiguration:`);
  console.log(`  Weeks to collect: ${weeksToCollect}`);
  console.log(`  Target client: ${targetClient || 'ALL'}`);
  console.log(`  Method: Direct BackgroundDataCollector call`);
  console.log('');
  console.log('=' .repeat(70));
  
  try {
    // Get clients
    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('id, name, meta_access_token, ad_account_id')
      .eq('api_status', 'valid')
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
    
    // Get the collector instance
    const collector = BackgroundDataCollector.getInstance();
    
    // ✅ FIX: Call collector once with client filter
    // This will:
    // 1. Filter to target client(s)
    // 2. Generate proper ISO weeks (all Mondays)
    // 3. For EACH week, call Meta API with that SPECIFIC week's date range
    // 4. Parse actions array for conversion metrics
    // 5. Store in database with correct week dates
    
    const startTime = Date.now();
    
    try {
      // Pass client name filter to collect only specific client(s)
      // startWeek=1 to exclude current week (handled by smart cache)
      // endWeek=weeksToCollect (e.g., 53 for full year)
      await collector.collectWeeklySummaries(
        targetClient, // Client name filter (undefined = all clients)
        1, // Start from 1 week ago (exclude current week)
        weeksToCollect // End at specified weeks (e.g., 53)
      );
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`\n✅ Collection completed in ${duration}s`);
      
    } catch (error: any) {
      console.error(`❌ Collection failed:`, error.message);
      console.error(error.stack);
      process.exit(1);
    }
    
    console.log('\n\n' + '='.repeat(70));
    console.log('✅ COLLECTION COMPLETE');
    console.log('='.repeat(70));
    
  } catch (error: any) {
    console.error('❌ Collection failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();

