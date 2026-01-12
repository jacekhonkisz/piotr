/**
 * URGENT FIX: Check Reports Page Platform Filter
 * 
 * This will show exactly what platform data is being loaded for December
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkReportsPagePlatform() {
  console.log('🔍 CHECKING REPORTS PAGE PLATFORM FILTER\n');
  console.log('='.repeat(80));
  
  const { data: client } = await supabase
    .from('clients')
    .select('id, name')
    .eq('name', 'Havet')
    .single();
  
  console.log(`Client: ${client.name}\n`);
  
  // Check what StandardizedDataFetcher would return for each platform
  console.log('📊 DECEMBER 2024 DATA BY PLATFORM:');
  console.log('-'.repeat(80));
  
  const dateRange = { start: '2024-12-01', end: '2024-12-31' };
  
  // Meta platform
  const { data: metaSummary } = await supabase
    .from('campaign_summaries')
    .select('click_to_call, campaign_data')
    .eq('client_id', client.id)
    .eq('summary_type', 'monthly')
    .eq('platform', 'meta')
    .eq('summary_date', dateRange.start)
    .single();
  
  console.log(`\nMETA PLATFORM:`);
  console.log(`  click_to_call: ${metaSummary?.click_to_call || 0}`);
  console.log(`  campaigns: ${metaSummary?.campaign_data?.length || 0}`);
  
  // Google platform
  const { data: googleSummary } = await supabase
    .from('campaign_summaries')
    .select('click_to_call, campaign_data')
    .eq('client_id', client.id)
    .eq('summary_type', 'monthly')
    .eq('platform', 'google')
    .eq('summary_date', dateRange.start)
    .single();
  
  console.log(`\nGOOGLE PLATFORM:`);
  console.log(`  click_to_call: ${googleSummary?.click_to_call || 0}`);
  console.log(`  campaigns: ${googleSummary?.campaign_data?.length || 0}`);
  
  // Check if there's a summary WITHOUT platform filter (bug)
  const { data: allSummaries } = await supabase
    .from('campaign_summaries')
    .select('platform, click_to_call')
    .eq('client_id', client.id)
    .eq('summary_type', 'monthly')
    .eq('summary_date', dateRange.start);
  
  console.log(`\n` + '='.repeat(80));
  console.log('🔍 DIAGNOSIS:');
  console.log('='.repeat(80));
  
  const totalWithoutFilter = allSummaries.reduce((sum, s) => sum + (s.click_to_call || 0), 0);
  
  console.log(`\nIf platform filter IS working:`);
  console.log(`  - Meta tab should show: ${metaSummary?.click_to_call || 0} clicks`);
  console.log(`  - Google tab should show: ${googleSummary?.click_to_call || 0} clicks`);
  
  console.log(`\nIf platform filter IS NOT working:`);
  console.log(`  - Shows combined total: ${totalWithoutFilter} clicks ❌`);
  
  if (totalWithoutFilter === 39) {
    console.log(`\n❌ YOU'RE SEEING: 39 clicks (combined!)`);
    console.log(`\n🐛 THE BUG: The reports page is not filtering by platform!`);
    console.log(`\n🔧 FIX NEEDED: Ensure activeAdsProvider state is used when fetching data`);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('📝 ACTION ITEMS:');
  console.log('='.repeat(80));
  console.log('1. Check browser console for which platform is being requested');
  console.log('2. Add console.log to see activeAdsProvider value when loading December');
  console.log('3. Verify fetchReportDataUnified receives correct platform parameter');
}

checkReportsPagePlatform().then(() => {
  console.log('\n✅ Check complete');
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});

