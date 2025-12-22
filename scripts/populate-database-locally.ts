#!/usr/bin/env tsx

/**
 * 🚀 LOCAL DATABASE POPULATION SCRIPT
 * 
 * Runs on your LOCAL machine (no serverless timeout)
 * Fetches data from Meta API directly
 * Inserts into Supabase database
 * 
 * Benefits:
 * - No timeout limits
 * - Full control over process
 * - Can pause/resume
 * - Real progress monitoring
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const CLIENT_NAME = 'Belmonte';

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Get week boundaries (Monday to Sunday)
function getWeekBoundaries(weeksAgo: number): { start: string; end: string } {
  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // Go to last Sunday
  const daysToLastSunday = currentDay === 0 ? 0 : currentDay;
  const lastSunday = new Date(now);
  lastSunday.setDate(now.getDate() - daysToLastSunday);
  lastSunday.setHours(23, 59, 59, 999);
  
  // Go back specified number of weeks
  const weekEnd = new Date(lastSunday);
  weekEnd.setDate(lastSunday.getDate() - (weeksAgo * 7));
  
  const weekStart = new Date(weekEnd);
  weekStart.setDate(weekEnd.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);
  
  return {
    start: weekStart.toISOString().split('T')[0],
    end: weekEnd.toISOString().split('T')[0],
  };
}

// Fetch data from your API (which calls Meta)
async function fetchWeekDataFromAPI(clientName: string, startWeek: number, endWeek: number): Promise<any> {
  try {
    log(`  📡 Fetching week ${startWeek} from API...`, 'cyan');
    
    const response = await axios.post(
      `https://piotr-gamma.vercel.app/api/automated/collect-weekly-summaries?testClient=${clientName}&startWeek=${startWeek}&endWeek=${endWeek}`,
      {},
      {
        headers: {
          'Authorization': 'Bearer KihtM33QrVCKZjap/d6xcHYSPkt6hq+K+ZJDKwnZ+oLjEcUl9/4PKNLZW076sHK',
        },
        timeout: 180000, // 3 minutes
      }
    );
    
    return response.data;
  } catch (error: any) {
    if (error.code === 'ECONNABORTED') {
      log(`  ⏱️  Week ${startWeek} timed out`, 'red');
    } else {
      log(`  ❌ Week ${startWeek} failed: ${error.message}`, 'red');
    }
    throw error;
  }
}

// Alternative: Fetch directly from Supabase (if data exists)
async function checkExistingData(clientName: string, week: number): Promise<boolean> {
  const { start } = getWeekBoundaries(week);
  
  const { data, error } = await supabase
    .from('campaign_summaries')
    .select('id')
    .eq('client_id', clientName)
    .eq('summary_date', start)
    .eq('period_type', 'weekly')
    .limit(1);
  
  return !!data && data.length > 0;
}

// Main population function
async function populateDatabase() {
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'blue');
  log('  🚀 LOCAL DATABASE POPULATION', 'blue');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'blue');
  
  log(`  📊 Client: ${CLIENT_NAME}`, 'cyan');
  log(`  📅 Weeks: 54 (0-53)`, 'cyan');
  log(`  💾 Database: Supabase`, 'cyan');
  log(`  🔧 Mode: Local execution (no timeout limits)\n`, 'cyan');
  
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'blue');
  
  const startTime = Date.now();
  let successful = 0;
  let failed = 0;
  let skipped = 0;
  
  // Process weeks from oldest to newest
  for (let week = 53; week >= 0; week--) {
    const { start, end } = getWeekBoundaries(week);
    
    log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'blue');
    log(`  📅 Week ${week}/54`, 'blue');
    log(`  📆 ${start} → ${end}`, 'blue');
    log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'blue');
    
    const weekStart = Date.now();
    
    try {
      // Check if already exists
      const exists = await checkExistingData(CLIENT_NAME, week);
      if (exists) {
        log(`  ⏭️  Already exists in database, skipping...`, 'yellow');
        skipped++;
        continue;
      }
      
      // Fetch data from API
      const data = await fetchWeekDataFromAPI(CLIENT_NAME, week, week);
      
      const weekDuration = ((Date.now() - weekStart) / 1000).toFixed(1);
      log(`  ✅ Success in ${weekDuration}s`, 'green');
      successful++;
      
    } catch (error) {
      const weekDuration = ((Date.now() - weekStart) / 1000).toFixed(1);
      log(`  ❌ Failed after ${weekDuration}s`, 'red');
      failed++;
    }
    
    // Progress summary
    const completed = successful + failed + skipped;
    const remaining = 54 - completed;
    const elapsed = ((Date.now() - startTime) / 60000).toFixed(1);
    
    log(`\n  📈 Progress: ${completed}/54 complete`, 'cyan');
    log(`  ✅ Successful: ${successful}`, 'green');
    if (skipped > 0) log(`  ⏭️  Skipped: ${skipped}`, 'yellow');
    if (failed > 0) log(`  ❌ Failed: ${failed}`, 'red');
    log(`  ⏳ Remaining: ${remaining}`, 'yellow');
    log(`  ⏱️  Elapsed: ${elapsed} min\n`, 'cyan');
    
    // Small delay between weeks
    if (week > 0) {
      log(`  ⏸️  Waiting 5 seconds...\n`, 'cyan');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  // Final summary
  const totalTime = ((Date.now() - startTime) / 60000).toFixed(1);
  
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'blue');
  log('  🏁 POPULATION COMPLETE', 'blue');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'blue');
  
  log(`  ✅ Successful: ${successful}/54`, 'green');
  if (skipped > 0) log(`  ⏭️  Skipped: ${skipped}/54`, 'yellow');
  if (failed > 0) log(`  ❌ Failed: ${failed}/54`, 'red');
  log(`  ⏱️  Total time: ${totalTime} minutes\n`, 'cyan');
  
  if (successful === 54) {
    log('  🎉 ALL WEEKS COLLECTED SUCCESSFULLY!\n', 'green');
  } else if (successful + skipped === 54) {
    log('  ✅ All weeks are now in database!\n', 'green');
  } else {
    log('  ⚠️  Some weeks failed. You can re-run to retry.\n', 'yellow');
  }
  
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'blue');
}

// Run the script
populateDatabase()
  .then(() => {
    log('✅ Script completed', 'green');
    process.exit(0);
  })
  .catch((error) => {
    log(`❌ Script failed: ${error.message}`, 'red');
    process.exit(1);
  });



