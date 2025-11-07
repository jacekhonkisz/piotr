#!/usr/bin/env node

/**
 * Check if October 2025 data collection is working
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BELMONTE_ID = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';

async function checkOctoberData() {
  console.log('🔍 CHECKING OCTOBER 2025 DATA IN DATABASE\n');

  // Check monthly summaries
  const { data: monthlySummaries, error: monthlyError } = await supabase
    .from('campaign_summaries')
    .select('*')
    .eq('client_id', BELMONTE_ID)
    .eq('platform', 'google')
    .eq('summary_type', 'monthly')
    .gte('summary_date', '2025-10-01')
    .lte('summary_date', '2025-10-31');

  if (monthlyError) {
    console.error('❌ Error querying monthly summaries:', monthlyError.message);
    return;
  }

  console.log(`📅 October 2025 Monthly Records: ${monthlySummaries?.length || 0}\n`);

  if (monthlySummaries && monthlySummaries.length > 0) {
    monthlySummaries.forEach(record => {
      console.log('✅ FOUND RECORD:');
      console.log('   Date:', record.summary_date);
      console.log('   Spend:', record.total_spend);
      console.log('   Impressions:', record.total_impressions);
      console.log('   Clicks:', record.total_clicks);
      console.log('   Campaigns:', record.active_campaigns);
      console.log('   Source:', record.data_source);
      console.log('   Saved:', new Date(record.last_updated).toLocaleString());
      console.log('');
    });
  } else {
    console.log('❌ NO OCTOBER DATA FOUND');
    console.log('');
    console.log('📊 Let me check what data we DO have:\n');

    const { data: allGoogle } = await supabase
      .from('campaign_summaries')
      .select('summary_date, summary_type, total_spend, data_source, last_updated')
      .eq('client_id', BELMONTE_ID)
      .eq('platform', 'google')
      .order('last_updated', { ascending: false })
      .limit(10);

    if (allGoogle && allGoogle.length > 0) {
      console.log('Recent Google Ads records:');
      allGoogle.forEach(r => {
        console.log(`   ${r.summary_date} (${r.summary_type}) - $${r.total_spend} - ${r.data_source}`);
      });
    } else {
      console.log('❌ NO GOOGLE DATA AT ALL!');
    }
  }

  // Check weekly summaries for October
  const { data: weeklySummaries } = await supabase
    .from('campaign_summaries')
    .select('*')
    .eq('client_id', BELMONTE_ID)
    .eq('platform', 'google')
    .eq('summary_type', 'weekly')
    .gte('summary_date', '2025-10-01')
    .lte('summary_date', '2025-10-31');

  console.log(`\n📅 October 2025 Weekly Records: ${weeklySummaries?.length || 0}`);

  if (weeklySummaries && weeklySummaries.length > 0) {
    console.log('   Dates:', weeklySummaries.map(r => r.summary_date).join(', '));
  }
}

checkOctoberData()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  });

