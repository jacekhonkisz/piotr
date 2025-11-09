/**
 * Quick Collection Status Check
 * Bypasses the 1000 record limit to show real progress
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkStatus() {
  console.log('📊 COLLECTION STATUS CHECK\n');
  console.log('═'.repeat(60) + '\n');

  // Get real count
  const { count: total } = await supabase
    .from('campaign_summaries')
    .select('*', { count: 'exact', head: true });

  const previous = 1290;
  const target = 1950;
  const progress = ((total / target) * 100).toFixed(1);
  const newRecords = total - previous;

  console.log(`Current: ${total} / ${target} records (${progress}%)`);
  console.log(`Previous: ${previous}`);
  console.log(`New: +${newRecords} records\n`);

  if (newRecords > 0) {
    console.log('✅ Collection is working!\n');
    
    // Show most recent
    const { data: recent } = await supabase
      .from('campaign_summaries')
      .select('platform, summary_type, google_ads_tables, last_updated')
      .order('last_updated', { ascending: false })
      .limit(3);

    console.log('Most recent records:');
    recent.forEach((r, i) => {
      const ago = Math.floor((Date.now() - new Date(r.last_updated).getTime()) / 1000);
      const hasGoogleTables = r.google_ads_tables ? '✅' : '❌';
      console.log(`  ${i+1}. ${r.platform}:${r.summary_type} ${hasGoogleTables} (${ago}s ago)`);
    });
  } else {
    console.log('⏳ Collection may still be starting...');
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`\n💡 Remaining: ${target - total} records`);
  console.log(`⏰ Estimated time: ${Math.ceil((target - total) / 10)} more minutes\n`);
}

checkStatus().catch(console.error);

