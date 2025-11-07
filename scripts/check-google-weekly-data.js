/**
 * Check Google Ads weekly data in database
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BELMONTE_ID = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';

async function checkGoogleWeeklyData() {
  console.log('🔍 Checking Google Ads Weekly Data\n');
  console.log('═══════════════════════════════════════════\n');

  // Get Google weekly summaries
  const { data: googleWeekly, error: googleError } = await supabase
    .from('campaign_summaries')
    .select('*')
    .eq('client_id', BELMONTE_ID)
    .eq('platform', 'google')
    .eq('summary_type', 'weekly')
    .order('summary_date', { ascending: false });

  if (googleError) {
    console.error('❌ Error fetching Google weekly data:', googleError.message);
    return;
  }

  // Get Meta weekly summaries for comparison
  const { data: metaWeekly, error: metaError } = await supabase
    .from('campaign_summaries')
    .select('*')
    .eq('client_id', BELMONTE_ID)
    .eq('platform', 'meta')
    .eq('summary_type', 'weekly')
    .order('summary_date', { ascending: false });

  if (metaError) {
    console.error('❌ Error fetching Meta weekly data:', metaError.message);
    return;
  }

  console.log(`📊 WEEKLY DATA SUMMARY\n`);
  console.log(`   Google Ads: ${googleWeekly?.length || 0} weeks`);
  console.log(`   Meta Ads:   ${metaWeekly?.length || 0} weeks\n`);

  if (googleWeekly && googleWeekly.length > 0) {
    console.log('📅 GOOGLE ADS WEEKLY RECORDS:\n');
    
    // Group by month
    const byMonth = {};
    googleWeekly.forEach(record => {
      const month = record.summary_date.substring(0, 7);
      if (!byMonth[month]) {
        byMonth[month] = {
          weeks: 0,
          spend: 0,
          impressions: 0,
          clicks: 0,
          reservations: 0
        };
      }
      byMonth[month].weeks++;
      byMonth[month].spend += record.total_spend || 0;
      byMonth[month].impressions += record.total_impressions || 0;
      byMonth[month].clicks += record.total_clicks || 0;
      byMonth[month].reservations += record.reservations || 0;
    });

    console.log('   Month       | Weeks | Spend     | Impressions | Clicks | Reservations | Source');
    console.log('   ------------|-------|-----------|-------------|--------|--------------|------------------');
    Object.entries(byMonth)
      .sort(([a], [b]) => b.localeCompare(a))
      .forEach(([month, data]) => {
        // Get a sample record for this month to check data source
        const sampleRecord = googleWeekly.find(r => r.summary_date.startsWith(month));
        const source = sampleRecord?.data_source || 'unknown';
        console.log(`   ${month}    |   ${data.weeks}   | $${data.spend.toFixed(2).padStart(8)} | ${String(data.impressions).padStart(11)} | ${String(data.clicks).padStart(6)} | ${String(data.reservations).padStart(12)} | ${source}`);
      });

    console.log('\n📋 Most Recent Google Ads Weekly Records:\n');
    googleWeekly.slice(0, 5).forEach(record => {
      console.log(`   ${record.summary_date} | $${record.total_spend?.toFixed(2) || '0.00'} | ${record.total_impressions || 0} imp | ${record.total_clicks || 0} clicks | ${record.reservations || 0} res | ${record.data_source}`);
    });

    console.log(`\n   Date Range: ${googleWeekly[googleWeekly.length - 1]?.summary_date} to ${googleWeekly[0]?.summary_date}`);
  } else {
    console.log('❌ NO Google Ads weekly data found!');
    console.log('\n💡 To populate Google Ads weekly data:');
    console.log('   Run: node scripts/test-google-weekly-collection.js\n');
  }

  // Check data source consistency
  console.log('\n═══════════════════════════════════════════');
  console.log('🔍 DATA SOURCE VALIDATION\n');

  if (googleWeekly && googleWeekly.length > 0) {
    const sources = {};
    googleWeekly.forEach(r => {
      const src = r.data_source || 'null';
      sources[src] = (sources[src] || 0) + 1;
    });

    console.log('   Google Ads Weekly Sources:');
    Object.entries(sources).forEach(([source, count]) => {
      const status = source === 'google_ads_api' ? '✅' : '⚠️';
      console.log(`     ${status} ${source}: ${count} records`);
    });
  }

  if (metaWeekly && metaWeekly.length > 0) {
    const sources = {};
    metaWeekly.forEach(r => {
      const src = r.data_source || 'null';
      sources[src] = (sources[src] || 0) + 1;
    });

    console.log('\n   Meta Ads Weekly Sources:');
    Object.entries(sources).forEach(([source, count]) => {
      const status = source === 'meta_api' || source === 'smart_cache_archive' ? '✅' : '⚠️';
      console.log(`     ${status} ${source}: ${count} records`);
    });
  }

  console.log('\n═══════════════════════════════════════════\n');
}

checkGoogleWeeklyData().catch(console.error);

