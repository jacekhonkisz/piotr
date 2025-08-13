const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function auditDataLifecycleCleanup() {
  console.log('🚨 AUDITING DATA LIFECYCLE CLEANUP SYSTEM\n');

  try {
    // 1. Check the cleanup logic from the code
    console.log('1️⃣ ANALYZING CLEANUP LOGIC');
    
    // Simulate the cleanup calculation from the code
    function calculateCleanupCutoff() {
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - 12);
      return cutoffDate.toISOString().split('T')[0];
    }

    const cutoffDate = calculateCleanupCutoff();
    const today = new Date().toISOString().split('T')[0];
    
    console.log('📅 Cleanup logic analysis:');
    console.log(`   Today: ${today}`);
    console.log(`   Cutoff (12 months ago): ${cutoffDate}`);
    console.log(`   Data older than ${cutoffDate} gets DELETED`);

    // 2. Check what data would be affected
    console.log('\n2️⃣ CHECKING WHAT DATA WOULD BE DELETED');
    
    const { data: allSummaries } = await supabase
      .from('campaign_summaries')
      .select('summary_date, summary_type, client_id, total_spend')
      .eq('summary_type', 'monthly')
      .order('summary_date', { ascending: false });

    const { data: clients } = await supabase
      .from('clients')
      .select('id, name');

    if (allSummaries) {
      const wouldBeDeleted = allSummaries.filter(s => s.summary_date < cutoffDate);
      const wouldBeKept = allSummaries.filter(s => s.summary_date >= cutoffDate);

      console.log('📊 Data analysis:');
      console.log(`   Total monthly summaries: ${allSummaries.length}`);
      console.log(`   Would be DELETED (< ${cutoffDate}): ${wouldBeDeleted.length}`);
      console.log(`   Would be KEPT (>= ${cutoffDate}): ${wouldBeKept.length}`);

      if (wouldBeDeleted.length > 0) {
        console.log('\n🗑️ Data that WOULD BE DELETED:');
        wouldBeDeleted.forEach(summary => {
          const client = clients?.find(c => c.id === summary.client_id);
          console.log(`   ${summary.summary_date} - ${client?.name || 'Unknown'}: ${summary.total_spend} zł`);
        });
      }

      console.log('\n✅ Data that WOULD BE KEPT:');
      wouldBeKept.slice(0, 10).forEach(summary => {
        const client = clients?.find(c => c.id === summary.client_id);
        console.log(`   ${summary.summary_date} - ${client?.name || 'Unknown'}: ${summary.total_spend} zł`);
      });
    }

    // 3. Check year-over-year impact
    console.log('\n3️⃣ YEAR-OVER-YEAR COMPARISON IMPACT');
    
    const currentYearMonths = allSummaries?.filter(s => s.summary_date.startsWith('2025')) || [];
    
    console.log('📈 Year-over-year comparison analysis:');
    console.log('Current year months (2025) and their needed comparisons:');
    
    const analysisResults = [];
    
    currentYearMonths.forEach(summary => {
      const [year, month] = summary.summary_date.split('-');
      const neededComparisonDate = `${parseInt(year) - 1}-${month}-01`;
      const hasComparison = allSummaries?.some(s => s.summary_date === neededComparisonDate && s.client_id === summary.client_id);
      const wouldComparisonBeDeleted = neededComparisonDate < cutoffDate;
      
      const client = clients?.find(c => c.id === summary.client_id);
      const result = {
        current: summary.summary_date,
        client: client?.name || 'Unknown',
        needed: neededComparisonDate,
        hasComparison,
        wouldBeDeleted: wouldComparisonBeDeleted
      };
      
      analysisResults.push(result);
      
      const status = hasComparison 
        ? (wouldComparisonBeDeleted ? '🚨 WILL BE DELETED' : '✅ Available') 
        : '❌ Not available';
      
      console.log(`   ${summary.summary_date} (${client?.name}) needs ${neededComparisonDate}: ${status}`);
    });

    // 4. Check cron schedule
    console.log('\n4️⃣ CHECKING AUTOMATED CLEANUP SCHEDULE');
    
    console.log('📅 Cleanup schedule analysis:');
    console.log('   From cron: "0 4 1 * *" = Monthly on 1st at 04:00');
    console.log('   This means cleanup runs EVERY MONTH on the 1st');
    console.log('   Each month, data older than 12 months gets deleted');

    // 5. Check when cleanup last ran
    console.log('\n5️⃣ CHECKING CLEANUP EXECUTION HISTORY');
    
    // Check logs table if it exists
    const { data: logs, error: logsError } = await supabase
      .from('system_logs')
      .select('*')
      .ilike('message', '%cleanup%')
      .order('created_at', { ascending: false })
      .limit(10);

    if (!logsError && logs) {
      console.log('📋 Recent cleanup logs:');
      logs.forEach(log => {
        console.log(`   ${log.created_at}: ${log.message}`);
      });
    } else {
      console.log('📋 No cleanup logs found (system_logs table might not exist)');
    }

    // 6. Impact assessment
    console.log('\n6️⃣ IMPACT ASSESSMENT');
    
    const impactedComparisons = analysisResults.filter(r => r.hasComparison && r.wouldBeDeleted);
    const missingComparisons = analysisResults.filter(r => !r.hasComparison);
    const workingComparisons = analysisResults.filter(r => r.hasComparison && !r.wouldBeDeleted);

    console.log('🎯 Year-over-year comparison status:');
    console.log(`   Working comparisons: ${workingComparisons.length}`);
    console.log(`   Missing comparisons: ${missingComparisons.length}`);
    console.log(`   Will be broken by cleanup: ${impactedComparisons.length}`);

    if (impactedComparisons.length > 0) {
      console.log('\n🚨 CRITICAL ISSUE IDENTIFIED:');
      console.log('   The 12-month cleanup is TOO AGGRESSIVE for year-over-year comparisons!');
      console.log('   It deletes data exactly when we need it for comparisons.');
      console.log('\n💡 RECOMMENDED FIX:');
      console.log('   Change cleanup retention from 12 months to 24+ months');
      console.log('   This allows for proper year-over-year comparisons');
    }

    // 7. Check if cleanup is currently enabled
    console.log('\n7️⃣ CHECKING IF CLEANUP IS CURRENTLY ACTIVE');
    
    // Check vercel.json for cron configuration
    const fs = require('fs');
    const path = require('path');
    
    try {
      const vercelPath = path.join(process.cwd(), 'vercel.json');
      if (fs.existsSync(vercelPath)) {
        const vercelConfig = JSON.parse(fs.readFileSync(vercelPath, 'utf8'));
        const cleanupCron = vercelConfig.crons?.find(cron => 
          cron.path.includes('cleanup-old-data')
        );
        
        if (cleanupCron) {
          console.log('⚠️ CLEANUP IS ACTIVE:');
          console.log(`   Path: ${cleanupCron.path}`);
          console.log(`   Schedule: ${cleanupCron.schedule}`);
          console.log('   This cron job will delete data every month!');
        } else {
          console.log('✅ No active cleanup cron found in vercel.json');
        }
      }
    } catch (error) {
      console.log('❓ Could not check vercel.json configuration');
    }

    console.log('\n🔍 AUDIT COMPLETE');

  } catch (error) {
    console.error('💥 Audit error:', error);
  }
}

auditDataLifecycleCleanup(); 