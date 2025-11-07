/**
 * Monitor collection progress in real-time
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

let lastCount = 0;

async function checkProgress() {
  try {
    // Get current counts by 4 categories
    const { data: records } = await supabase
      .from('campaign_summaries')
      .select('platform, summary_type');

    const metaWeekly = records.filter(r => r.platform === 'meta' && r.summary_type === 'weekly').length;
    const metaMonthly = records.filter(r => r.platform === 'meta' && r.summary_type === 'monthly').length;
    const googleWeekly = records.filter(r => r.platform === 'google' && r.summary_type === 'weekly').length;
    const googleMonthly = records.filter(r => r.platform === 'google' && r.summary_type === 'monthly').length;
    const total = records.length;

    const change = total - lastCount;
    const changeIndicator = change > 0 ? `+${change}` : '';

    console.clear();
    console.log('🔄 MONITORING COLLECTION PROGRESS\n');
    console.log('═'.repeat(70));
    console.log('');
    console.log('  Category          | Current | Target | Progress');
    console.log('  ─────────────────────────────────────────────────');
    console.log(`  Meta Weekly       |    ${String(metaWeekly).padStart(4)} |    848 | ${((metaWeekly/848)*100).toFixed(1)}%`);
    console.log(`  Meta Monthly      |    ${String(metaMonthly).padStart(4)} |    192 | ${((metaMonthly/192)*100).toFixed(1)}%`);
    console.log(`  Google Weekly     |    ${String(googleWeekly).padStart(4)} |    742 | ${((googleWeekly/742)*100).toFixed(1)}%`);
    console.log(`  Google Monthly    |    ${String(googleMonthly).padStart(4)} |    168 | ${((googleMonthly/168)*100).toFixed(1)}%`);
    console.log('  ─────────────────────────────────────────────────');
    console.log(`  TOTAL             |   ${String(total).padStart(5)} |   1950 | ${((total/1950)*100).toFixed(1)}% ${changeIndicator}`);
    console.log('');
    console.log('═'.repeat(70));
    console.log('');
    console.log('  Last Update: ' + new Date().toLocaleTimeString());
    console.log('  Refreshing every 5 seconds... (Press Ctrl+C to stop)');
    console.log('');

    lastCount = total;

    if (total >= 1950) {
      console.log('🎉 COLLECTION COMPLETE! All 1,950 records collected!\n');
      process.exit(0);
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Initial check
checkProgress();

// Then check every 5 seconds
setInterval(checkProgress, 5000);

