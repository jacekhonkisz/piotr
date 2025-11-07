#!/usr/bin/env node

/**
 * Comprehensive audit of data separation for Belmonte
 * Verifies: Periods (weekly/monthly), Platforms (Meta/Google), Past year coverage
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BELMONTE_ID = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';

async function comprehensiveAudit() {
  console.log('🔍 COMPREHENSIVE DATA SEPARATION AUDIT FOR BELMONTE\n');
  console.log('═══════════════════════════════════════════════════\n');

  let passedChecks = 0;
  let failedChecks = 0;
  let warningChecks = 0;

  try {
    // 1. OVERVIEW: Total records by period and platform
    console.log('1️⃣  OVERVIEW BY PERIOD & PLATFORM');
    console.log('─────────────────────────────────────────');
    const { data: overview } = await supabase
      .from('campaign_summaries')
      .select('summary_type, platform, total_spend')
      .eq('client_id', BELMONTE_ID);

    if (overview) {
      const grouped = {};
      overview.forEach(r => {
        const key = `${r.summary_type}_${r.platform}`;
        if (!grouped[key]) grouped[key] = { count: 0, spend: 0 };
        grouped[key].count++;
        grouped[key].spend += r.total_spend || 0;
      });

      Object.entries(grouped).forEach(([key, stats]) => {
        const [type, platform] = key.split('_');
        console.log(`   ${type.padEnd(10)} | ${platform.padEnd(8)} | ${stats.count.toString().padStart(4)} records | $${stats.spend.toFixed(2)}`);
      });

      const hasMonthlyMeta = grouped['monthly_meta'] && grouped['monthly_meta'].count > 0;
      const hasMonthlyGoogle = grouped['monthly_google'] && grouped['monthly_google'].count > 0;
      const hasWeeklyMeta = grouped['weekly_meta'] && grouped['weekly_meta'].count > 0;
      const hasWeeklyGoogle = grouped['weekly_google'] && grouped['weekly_google'].count > 0;

      console.log('');
      console.log('   Checks:');
      if (hasMonthlyMeta && hasMonthlyGoogle) {
        console.log('   ✅ Monthly summaries exist for BOTH platforms');
        passedChecks++;
      } else {
        console.log('   ❌ Monthly summaries missing for one or both platforms');
        failedChecks++;
      }

      if (hasWeeklyMeta) {
        console.log('   ✅ Weekly summaries exist for Meta');
        passedChecks++;
      } else {
        console.log('   ⚠️  Weekly summaries missing for Meta');
        warningChecks++;
      }

      if (hasWeeklyGoogle) {
        console.log('   ✅ Weekly summaries exist for Google');
        passedChecks++;
      } else {
        console.log('   ⚠️  Weekly summaries missing for Google');
        warningChecks++;
      }
    }

    // 2. MONTHLY COVERAGE: Past 12 months
    console.log('\n2️⃣  MONTHLY PLATFORM COVERAGE (Past 12 months)');
    console.log('─────────────────────────────────────────');
    
    const oneYearAgo = new Date();
    oneYearAgo.setMonth(oneYearAgo.getMonth() - 12);
    
    const { data: monthlyData } = await supabase
      .from('campaign_summaries')
      .select('summary_date, platform, total_spend')
      .eq('client_id', BELMONTE_ID)
      .eq('summary_type', 'monthly')
      .gte('summary_date', oneYearAgo.toISOString().split('T')[0])
      .order('summary_date', { ascending: false });

    if (monthlyData) {
      const byMonth = {};
      monthlyData.forEach(r => {
        const month = r.summary_date.substring(0, 7);
        if (!byMonth[month]) byMonth[month] = { meta: 0, google: 0 };
        byMonth[month][r.platform] += r.total_spend || 0;
      });

      console.log('   Month       | Meta Spend    | Google Spend  | Status');
      console.log('   ─────────────────────────────────────────────────────');

      let monthsWithBoth = 0;
      let monthsWithMetaOnly = 0;
      let monthsWithGoogleOnly = 0;

      Object.entries(byMonth).sort().reverse().forEach(([month, spend]) => {
        const metaStr = spend.meta > 0 ? `$${spend.meta.toFixed(2)}`.padStart(12) : '     ---    ';
        const googleStr = spend.google > 0 ? `$${spend.google.toFixed(2)}`.padStart(12) : '     ---    ';
        
        let status = '❌ No data';
        if (spend.meta > 0 && spend.google > 0) {
          status = '✅ Both';
          monthsWithBoth++;
        } else if (spend.meta > 0) {
          status = '⚠️  Meta only';
          monthsWithMetaOnly++;
        } else if (spend.google > 0) {
          status = '⚠️  Google only';
          monthsWithGoogleOnly++;
        }
        
        console.log(`   ${month}    | ${metaStr} | ${googleStr} | ${status}`);
      });

      console.log('');
      console.log(`   Summary: ${monthsWithBoth} months with both, ${monthsWithMetaOnly} Meta-only, ${monthsWithGoogleOnly} Google-only`);
      
      if (monthsWithBoth >= 3) {
        console.log('   ✅ Multiple months have both platforms (good coverage)');
        passedChecks++;
      } else if (monthsWithBoth >= 1) {
        console.log('   ⚠️  Few months have both platforms (partial coverage)');
        warningChecks++;
      } else {
        console.log('   ❌ No months have both platforms');
        failedChecks++;
      }
    }

    // 3. DATA SOURCE VERIFICATION
    console.log('\n3️⃣  DATA SOURCE CORRECTNESS');
    console.log('─────────────────────────────────────────');
    
    const { data: sources } = await supabase
      .from('campaign_summaries')
      .select('platform, data_source')
      .eq('client_id', BELMONTE_ID)
      .gte('summary_date', oneYearAgo.toISOString().split('T')[0]);

    if (sources) {
      const sourceCheck = {};
      sources.forEach(r => {
        const key = `${r.platform}_${r.data_source}`;
        sourceCheck[key] = (sourceCheck[key] || 0) + 1;
      });

      let correctSources = 0;
      let incorrectSources = 0;

      Object.entries(sourceCheck).forEach(([key, count]) => {
        const [platform, source] = key.split('_');
        const isCorrect = 
          (platform === 'google' && source.includes('google')) ||
          (platform === 'meta' && source.includes('meta')) ||
          source.includes('archive');
        
        const status = isCorrect ? '✅' : '❌';
        console.log(`   ${status} ${platform.padEnd(8)} → ${source.padEnd(30)} (${count} records)`);
        
        if (isCorrect) correctSources += count;
        else incorrectSources += count;
      });

      console.log('');
      if (incorrectSources === 0) {
        console.log('   ✅ All data sources are correctly mapped to platforms');
        passedChecks++;
      } else {
        console.log(`   ❌ Found ${incorrectSources} records with incorrect data_source`);
        failedChecks++;
      }
    }

    // 4. OCTOBER 2025 SPECIAL CHECK
    console.log('\n4️⃣  OCTOBER 2025 (Previously Problematic)');
    console.log('─────────────────────────────────────────');
    
    const { data: october } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', BELMONTE_ID)
      .gte('summary_date', '2025-10-01')
      .lte('summary_date', '2025-10-31');

    if (october) {
      const octoberByTypeAndPlatform = {};
      october.forEach(r => {
        const key = `${r.summary_type}_${r.platform}`;
        if (!octoberByTypeAndPlatform[key]) octoberByTypeAndPlatform[key] = [];
        octoberByTypeAndPlatform[key].push(r);
      });

      Object.entries(octoberByTypeAndPlatform).forEach(([key, records]) => {
        const [type, platform] = key.split('_');
        const totalSpend = records.reduce((sum, r) => sum + (r.total_spend || 0), 0);
        const dataSource = records[0].data_source;
        console.log(`   ${type.padEnd(10)} | ${platform.padEnd(8)} | ${records.length.toString().padStart(2)} records | $${totalSpend.toFixed(2).padStart(10)} | ${dataSource}`);
      });

      const hasOctoberMonthlyMeta = octoberByTypeAndPlatform['monthly_meta'];
      const hasOctoberMonthlyGoogle = octoberByTypeAndPlatform['monthly_google'];

      console.log('');
      if (hasOctoberMonthlyMeta && hasOctoberMonthlyGoogle) {
        console.log('   ✅ October has BOTH platforms (constraint fix successful!)');
        passedChecks++;
      } else if (hasOctoberMonthlyMeta || hasOctoberMonthlyGoogle) {
        console.log('   ⚠️  October has only one platform');
        warningChecks++;
      } else {
        console.log('   ❌ October has no data');
        failedChecks++;
      }
    }

    // 5. FINAL STATISTICS
    console.log('\n5️⃣  OVERALL STATISTICS');
    console.log('─────────────────────────────────────────');
    
    const { data: allData } = await supabase
      .from('campaign_summaries')
      .select('summary_date, platform, summary_type, total_spend')
      .eq('client_id', BELMONTE_ID)
      .gte('summary_date', oneYearAgo.toISOString().split('T')[0]);

    if (allData) {
      const platforms = new Set(allData.map(r => r.platform));
      const summaryTypes = new Set(allData.map(r => r.summary_type));
      const months = new Set(allData.map(r => r.summary_date.substring(0, 7)));
      const totalSpend = allData.reduce((sum, r) => sum + (r.total_spend || 0), 0);
      const googleRecords = allData.filter(r => r.platform === 'google').length;
      const metaRecords = allData.filter(r => r.platform === 'meta').length;

      console.log(`   Total Records:     ${allData.length}`);
      console.log(`   Platforms:         ${Array.from(platforms).join(', ')} (${platforms.size})`);
      console.log(`   Summary Types:     ${Array.from(summaryTypes).join(', ')} (${summaryTypes.size})`);
      console.log(`   Months Covered:    ${months.size}`);
      console.log(`   Google Records:    ${googleRecords}`);
      console.log(`   Meta Records:      ${metaRecords}`);
      console.log(`   Total Spend:       $${totalSpend.toFixed(2)}`);
      console.log('');

      if (platforms.size >= 2 && summaryTypes.size >= 2 && months.size >= 6) {
        console.log('   ✅ Good data coverage across platforms, types, and time');
        passedChecks++;
      } else {
        console.log('   ⚠️  Limited data coverage');
        warningChecks++;
      }
    }

    // FINAL SUMMARY
    console.log('\n═══════════════════════════════════════════════════');
    console.log('📊 AUDIT SUMMARY');
    console.log('═══════════════════════════════════════════════════');
    console.log(`   ✅ Passed:   ${passedChecks}`);
    console.log(`   ⚠️  Warnings: ${warningChecks}`);
    console.log(`   ❌ Failed:   ${failedChecks}`);
    console.log('');

    if (failedChecks === 0 && warningChecks === 0) {
      console.log('🎉 PERFECT! Data separation is working flawlessly!');
    } else if (failedChecks === 0) {
      console.log('✅ GOOD! Data separation is working with minor gaps.');
    } else {
      console.log('⚠️  ISSUES FOUND! Review failed checks above.');
    }

  } catch (error) {
    console.error('\n💥 Audit failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

comprehensiveAudit()
  .then(() => {
    console.log('\n🏁 Audit completed\n');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n💥 Fatal error:', err);
    process.exit(1);
  });

