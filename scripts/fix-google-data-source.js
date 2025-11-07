#!/usr/bin/env node

/**
 * Fix data_source for all Google Ads records
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixGoogleDataSource() {
  console.log('🔧 FIXING GOOGLE ADS DATA SOURCE\n');

  // 1. Check current state
  console.log('1️⃣ BEFORE FIX:');
  const { data: beforeData } = await supabase
    .from('campaign_summaries')
    .select('platform, data_source, total_spend')
    .eq('platform', 'google');

  if (beforeData) {
    const bySource = {};
    beforeData.forEach(r => {
      bySource[r.data_source] = (bySource[r.data_source] || 0) + 1;
    });
    console.log('   Records by data_source:', bySource);
    console.log(`   Total Google records: ${beforeData.length}`);
  }

  // 2. Update all Google records
  console.log('\n2️⃣ UPDATING RECORDS...');
  const { data: updated, error } = await supabase
    .from('campaign_summaries')
    .update({ 
      data_source: 'google_ads_api',
      last_updated: new Date().toISOString()
    })
    .eq('platform', 'google')
    .neq('data_source', 'google_ads_api')
    .select();

  if (error) {
    console.error('❌ Update failed:', error.message);
    return;
  }

  console.log(`   ✅ Updated ${updated?.length || 0} records`);

  // 3. Verify fix
  console.log('\n3️⃣ AFTER FIX:');
  const { data: afterData } = await supabase
    .from('campaign_summaries')
    .select('platform, data_source, total_spend')
    .eq('platform', 'google');

  if (afterData) {
    const bySource = {};
    afterData.forEach(r => {
      bySource[r.data_source] = (bySource[r.data_source] || 0) + 1;
    });
    console.log('   Records by data_source:', bySource);
    console.log(`   Total Google records: ${afterData.length}`);
  }

  // 4. Check for any remaining issues
  console.log('\n4️⃣ VERIFICATION:');
  const { data: wrongSource } = await supabase
    .from('campaign_summaries')
    .select('*')
    .eq('platform', 'google')
    .eq('data_source', 'meta_api');

  if (wrongSource && wrongSource.length > 0) {
    console.log(`   ❌ Still found ${wrongSource.length} Google records with meta_api source!`);
    wrongSource.forEach(r => {
      console.log(`      - ${r.summary_date} (${r.summary_type})`);
    });
  } else {
    console.log('   ✅ All Google records now have correct data_source!');
  }

  // 5. Show summary by platform and source
  console.log('\n5️⃣ FINAL STATE BY PLATFORM:');
  const { data: allData } = await supabase
    .from('campaign_summaries')
    .select('platform, data_source')
    .order('platform');

  if (allData) {
    const summary = {};
    allData.forEach(r => {
      const key = `${r.platform}:${r.data_source}`;
      summary[key] = (summary[key] || 0) + 1;
    });
    
    Object.entries(summary).sort().forEach(([key, count]) => {
      const [platform, source] = key.split(':');
      const status = 
        (platform === 'google' && source === 'google_ads_api') ||
        (platform === 'meta' && source === 'meta_api') ||
        source.includes('archive')
        ? '✅' : '❌';
      console.log(`   ${status} ${platform.padEnd(8)} → ${source.padEnd(25)} (${count} records)`);
    });
  }
}

fixGoogleDataSource()
  .then(() => {
    console.log('\n🏁 Data source fix completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n💥 Fatal error:', err);
    process.exit(1);
  });

