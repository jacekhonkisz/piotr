#!/usr/bin/env node

/**
 * Daily KPI Data Cleanup Script
 * 
 * This script cleans up old daily KPI data, keeping only:
 * - Current month data
 * - Previous 7 days from current month start
 * 
 * Run this daily via cron job: 0 1 * * * /path/to/cleanup-daily-kpi-data.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function cleanupOldDailyKpiData() {
  try {
    console.log('🧹 Starting daily KPI data cleanup...');
    
    // Calculate cutoff date (current month start - 7 days)
    const currentDate = new Date();
    const currentMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const cutoffDate = new Date(currentMonthStart);
    cutoffDate.setDate(cutoffDate.getDate() - 7);
    
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
    
    console.log(`📅 Cutoff date: ${cutoffDateStr}`);
    console.log(`📊 Keeping data from: ${cutoffDateStr} onwards`);
    
    // Count records to be deleted
    const { count: recordsToDelete, error: countError } = await supabase
      .from('daily_kpi_data')
      .select('*', { count: 'exact', head: true })
      .lt('date', cutoffDateStr);
    
    if (countError) {
      console.error('❌ Error counting records to delete:', countError);
      return;
    }
    
    console.log(`🗑️ Found ${recordsToDelete || 0} records to delete`);
    
    if (!recordsToDelete || recordsToDelete === 0) {
      console.log('✅ No old data to clean up');
      return;
    }
    
    // Delete old records
    const { error: deleteError } = await supabase
      .from('daily_kpi_data')
      .delete()
      .lt('date', cutoffDateStr);
    
    if (deleteError) {
      console.error('❌ Error deleting old records:', deleteError);
      return;
    }
    
    console.log(`✅ Successfully deleted ${recordsToDelete} old daily KPI records`);
    
    // Get remaining record count for verification
    const { count: remainingRecords, error: remainingError } = await supabase
      .from('daily_kpi_data')
      .select('*', { count: 'exact', head: true });
    
    if (remainingError) {
      console.warn('⚠️ Error counting remaining records:', remainingError);
    } else {
      console.log(`📊 Remaining daily KPI records: ${remainingRecords || 0}`);
    }
    
    console.log('🎉 Daily KPI data cleanup completed successfully');
    
  } catch (error) {
    console.error('❌ Daily KPI data cleanup failed:', error);
    process.exit(1);
  }
}

// Run the cleanup
cleanupOldDailyKpiData()
  .then(() => {
    console.log('👋 Cleanup script finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  }); 