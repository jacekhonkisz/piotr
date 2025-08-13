require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// This script cleans up corrupted weekly data in campaign_summaries table
// The issue: Weekly reports (2025-W33) have wrong date ranges (2025-01-01 to 2025-01-31)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findCorruptedWeeklyData() {
  console.log('🔍 SCANNING for corrupted weekly data in campaign_summaries...');
  console.log('');
  
  try {
    // Find all weekly summaries
    const { data: weeklySummaries, error } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('summary_type', 'weekly')
      .order('summary_date', { ascending: false });
    
    if (error) {
      console.error('❌ Error fetching weekly summaries:', error);
      return;
    }
    
    console.log(`📊 Found ${weeklySummaries.length} weekly summaries in database`);
    console.log('');
    
    // Check each weekly summary for date range issues
    const corruptedRecords = [];
    
    weeklySummaries.forEach((summary, index) => {
      const summaryDate = new Date(summary.summary_date);
      const dayOfWeek = summaryDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
      
      // Check if summary_date is a Monday (proper week start)
      const isMonday = dayOfWeek === 1;
      
      // Check if this looks like a monthly date range (1st of month)
      const isFirstOfMonth = summaryDate.getDate() === 1;
      
      // Extract period info for analysis
      const summaryDateStr = summary.summary_date;
      const year = summaryDate.getFullYear();
      const month = summaryDate.getMonth() + 1;
      
      console.log(`📋 Weekly Summary ${index + 1}:`);
      console.log(`   ID: ${summary.id}`);
      console.log(`   Client: ${summary.client_id}`);
      console.log(`   Summary Date: ${summaryDateStr}`);
      console.log(`   Day of Week: ${dayOfWeek} (${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek]})`);
      console.log(`   Is Monday: ${isMonday}`);
      console.log(`   Is 1st of Month: ${isFirstOfMonth}`);
      console.log(`   Last Updated: ${summary.last_updated}`);
      console.log(`   Data Source: ${summary.data_source}`);
      
      // Flag potential corruption
      if (isFirstOfMonth && !isMonday) {
        console.log(`   🚨 SUSPICIOUS: Weekly data on 1st of month (${summaryDateStr})`);
        corruptedRecords.push({
          ...summary,
          issue: 'Weekly data on 1st of month',
          suspicionLevel: 'HIGH'
        });
      } else if (!isMonday) {
        console.log(`   ⚠️  WARNING: Weekly data not starting on Monday`);
        corruptedRecords.push({
          ...summary,
          issue: 'Weekly data not on Monday',
          suspicionLevel: 'MEDIUM'
        });
      } else {
        console.log(`   ✅ LOOKS OK: Proper Monday start date`);
      }
      
      console.log('');
    });
    
    console.log('📋 CORRUPTION ANALYSIS COMPLETE');
    console.log(`Found ${corruptedRecords.length} potentially corrupted records:`);
    console.log('');
    
    corruptedRecords.forEach((record, index) => {
      console.log(`${index + 1}. ${record.suspicionLevel} SUSPICION:`);
      console.log(`   Summary Date: ${record.summary_date}`);
      console.log(`   Issue: ${record.issue}`);
      console.log(`   Client: ${record.client_id}`);
      console.log(`   Last Updated: ${record.last_updated}`);
      console.log('');
    });
    
    return corruptedRecords;
    
  } catch (error) {
    console.error('❌ Error during corruption scan:', error);
  }
}

async function cleanupCorruptedData(dryRun = true) {
  console.log(`🧹 CLEANUP MODE: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE CLEANUP (will delete data)'}`);
  console.log('');
  
  const corruptedRecords = await findCorruptedWeeklyData();
  
  if (!corruptedRecords || corruptedRecords.length === 0) {
    console.log('✅ No corrupted data found to clean up');
    return;
  }
  
  // Focus on HIGH suspicion records (weekly data on 1st of month)
  const highSuspicionRecords = corruptedRecords.filter(r => r.suspicionLevel === 'HIGH');
  
  if (highSuspicionRecords.length === 0) {
    console.log('ℹ️  No HIGH suspicion records found. Manual review recommended.');
    return;
  }
  
  console.log(`🎯 Targeting ${highSuspicionRecords.length} HIGH suspicion records for cleanup:`);
  
  for (const record of highSuspicionRecords) {
    console.log(`   - ${record.summary_date} (Client: ${record.client_id})`);
  }
  console.log('');
  
  if (dryRun) {
    console.log('🔍 DRY RUN: Would delete these records but not actually doing it');
    console.log('To perform actual cleanup, run: node scripts/cleanup-weekly-database-corruption.js --live');
  } else {
    console.log('🚨 LIVE CLEANUP: Deleting corrupted records...');
    
    for (const record of highSuspicionRecords) {
      try {
        const { error } = await supabase
          .from('campaign_summaries')
          .delete()
          .eq('id', record.id);
        
        if (error) {
          console.error(`❌ Failed to delete record ${record.id}:`, error);
        } else {
          console.log(`✅ Deleted corrupted record: ${record.summary_date} (${record.client_id})`);
        }
      } catch (error) {
        console.error(`❌ Error deleting record ${record.id}:`, error);
      }
    }
    
    console.log('');
    console.log('🎉 CLEANUP COMPLETE');
    console.log('Fresh data will be fetched on next weekly report request.');
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const isLiveMode = args.includes('--live');
  
  console.log('🔧 Weekly Database Corruption Cleanup Tool');
  console.log('==========================================');
  console.log('');
  
  await cleanupCorruptedData(!isLiveMode);
}

// Only run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { findCorruptedWeeklyData, cleanupCorruptedData }; 