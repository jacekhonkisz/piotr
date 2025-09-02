#!/usr/bin/env node

/**
 * Production Maintenance Script
 * 
 * Maintains rolling data windows:
 * - 13 months of historical data
 * - 53 weeks of historical data
 * - Removes older data automatically
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function getCurrentRequiredPeriods() {
  const currentDate = new Date();
  const periods = {
    months: [],
    weeks: []
  };

  // Generate exactly 13 months backwards (rolling)
  for (let i = 0; i < 13; i++) {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
    const summaryDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
    periods.months.push(summaryDate);
  }

  // Generate exactly 53 weeks backwards (rolling)
  for (let i = 0; i < 53; i++) {
    const weekDate = new Date(currentDate);
    weekDate.setDate(weekDate.getDate() - (i * 7));
    
    // Get Monday of that week
    const monday = new Date(weekDate);
    const dayOfWeek = weekDate.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    monday.setDate(weekDate.getDate() - daysToMonday);
    
    const summaryDate = monday.toISOString().split('T')[0];
    periods.weeks.push(summaryDate);
  }

  return periods;
}

async function removeOldData() {
  console.log('🧹 AUTOMATED DATA CLEANUP - MAINTAINING ROLLING WINDOWS');
  console.log(`📅 ${new Date().toISOString()}`);
  
  try {
    const requiredPeriods = getCurrentRequiredPeriods();
    
    console.log(`📊 Keeping ${requiredPeriods.months.length} months, ${requiredPeriods.weeks.length} weeks`);
    
    // Remove old monthly data (keep only required months)
    const { count: oldMonthlyCount } = await supabase
      .from('campaign_summaries')
      .delete({ count: 'exact' })
      .eq('summary_type', 'monthly')
      .not('summary_date', 'in', `(${requiredPeriods.months.map(d => `'${d}'`).join(',')})`);
    
    console.log(`🗑️ Removed ${oldMonthlyCount || 0} old monthly records`);
    
    // Remove old weekly data (keep only required weeks)
    const { count: oldWeeklyCount } = await supabase
      .from('campaign_summaries')
      .delete({ count: 'exact' })
      .eq('summary_type', 'weekly')
      .not('summary_date', 'in', `(${requiredPeriods.weeks.map(d => `'${d}'`).join(',')})`);
    
    console.log(`🗑️ Removed ${oldWeeklyCount || 0} old weekly records`);
    
    // Verify current counts
    const { count: currentMonthly } = await supabase
      .from('campaign_summaries')
      .select('id', { count: 'exact' })
      .eq('summary_type', 'monthly');
    
    const { count: currentWeekly } = await supabase
      .from('campaign_summaries')
      .select('id', { count: 'exact' })
      .eq('summary_type', 'weekly');
    
    console.log(`📊 Current data: ${currentMonthly || 0} monthly, ${currentWeekly || 0} weekly records`);
    console.log('✅ Automated cleanup completed\n');
    
  } catch (error) {
    console.error('❌ Automated cleanup failed:', error);
  }
}

// Run cleanup
if (require.main === module) {
  removeOldData()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Maintenance failed:', error);
      process.exit(1);
    });
}

module.exports = { removeOldData };