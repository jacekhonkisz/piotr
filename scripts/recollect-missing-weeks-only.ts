/**
 * Re-collect ONLY the missing November 2025 weeks (0-5)
 * 
 * This script will collect just the recent weeks that are missing:
 * - Week 0: 2025-11-10
 * - Week 1: 2025-11-03
 * - Week 2: 2025-10-27
 * - Week 3: 2025-10-20
 * - Week 4: 2025-10-13
 * - Week 5: 2025-10-06
 * 
 * Run: npx tsx scripts/recollect-missing-weeks-only.ts --client=belmonte
 */

// ✅ Load environment variables FIRST
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

import { BackgroundDataCollector } from '../src/lib/background-data-collector';
import { createClient } from '@supabase/supabase-js';

const args = process.argv.slice(2);
const targetClient = args.find(a => a.startsWith('--client='))?.split('=')[1] || 'belmonte';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('🚀 RECOLLECTING MISSING NOVEMBER WEEKS ONLY\n');
  console.log('='.repeat(70));
  console.log(`Target client: ${targetClient}`);
  console.log(`Weeks to collect: 0-5 (Nov 2025)`);
  console.log('='.repeat(70));
  
  try {
    const collector = BackgroundDataCollector.getInstance();
    
    // Collect only weeks 0-5 (the missing recent weeks)
    // startWeek=0 means include current week
    // endWeek=5 means collect up to week 5
    await collector.collectWeeklySummaries(
      targetClient,
      0, // Start from week 0 (current week)
      5  // End at week 5 (6 weeks total: 0, 1, 2, 3, 4, 5)
    );
    
    console.log(`\n✅ Collection completed`);
    
  } catch (error: any) {
    console.error(`❌ Collection failed:`, error.message);
    console.error(error);
    process.exit(1);
  }
}

main();



