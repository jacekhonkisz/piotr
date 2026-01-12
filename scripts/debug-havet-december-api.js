/**
 * Debug Havet December API Response
 * 
 * This script simulates what the reports page does and shows exactly what data is being returned
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugHavetDecember() {
  console.log('🔍 DEBUGGING HAVET DECEMBER API RESPONSE\n');
  console.log('='.repeat(80));
  
  // Get Havet client
  const { data: client } = await supabase
    .from('clients')
    .select('id, name')
    .eq('name', 'Havet')
    .single();
  
  console.log(`Client: ${client.name} (${client.id})\n`);
  
  // Simulate what StandardizedDataFetcher.fetchFromCachedSummaries does
  const dateRange = { start: '2024-12-01', end: '2024-12-31' };
  
  // Test with Meta platform
  console.log('📊 TESTING META PLATFORM:');
  console.log('-'.repeat(80));
  
  const { data: metaSummary, error: metaError } = await supabase
    .from('campaign_summaries')
    .select('*')
    .eq('client_id', client.id)
    .eq('summary_type', 'monthly')
    .eq('platform', 'meta')
    .eq('summary_date', dateRange.start)
    .limit(1);
  
  if (metaError) {
    console.error('❌ Meta Error:', metaError.message);
  } else if (!metaSummary || metaSummary.length === 0) {
    console.log('⚠️ No Meta summary found');
  } else {
    const summary = metaSummary[0];
    console.log(`✅ Found Meta summary:`);
    console.log(`  Summary Date: ${summary.summary_date}`);
    console.log(`  Platform: ${summary.platform}`);
    console.log(`  Phone Clicks (click_to_call): ${summary.click_to_call}`);
    console.log(`  Total Spend: ${summary.total_spend}`);
    console.log(`  Campaigns: ${summary.campaign_data?.length || 0}`);
  }
  
  // Test with Google platform
  console.log('\n📊 TESTING GOOGLE PLATFORM:');
  console.log('-'.repeat(80));
  
  const { data: googleSummary, error: googleError } = await supabase
    .from('campaign_summaries')
    .select('*')
    .eq('client_id', client.id)
    .eq('summary_type', 'monthly')
    .eq('platform', 'google')
    .eq('summary_date', dateRange.start)
    .limit(1);
  
  if (googleError) {
    console.error('❌ Google Error:', googleError.message);
  } else if (!googleSummary || googleSummary.length === 0) {
    console.log('⚠️ No Google summary found');
  } else {
    const summary = googleSummary[0];
    console.log(`✅ Found Google summary:`);
    console.log(`  Summary Date: ${summary.summary_date}`);
    console.log(`  Platform: ${summary.platform}`);
    console.log(`  Phone Clicks (click_to_call): ${summary.click_to_call}`);
    console.log(`  Total Spend: ${summary.total_spend}`);
    console.log(`  Campaigns: ${summary.campaign_data?.length || 0}`);
  }
  
  // Test without platform filter (what might be happening?)
  console.log('\n📊 TESTING WITHOUT PLATFORM FILTER (POTENTIAL BUG):');
  console.log('-'.repeat(80));
  
  const { data: allSummaries, error: allError } = await supabase
    .from('campaign_summaries')
    .select('platform, click_to_call, total_spend')
    .eq('client_id', client.id)
    .eq('summary_type', 'monthly')
    .eq('summary_date', dateRange.start);
  
  if (allError) {
    console.error('❌ Error:', allError.message);
  } else {
    console.log(`Found ${allSummaries.length} summaries:`);
    let totalPhoneClicks = 0;
    allSummaries.forEach(s => {
      console.log(`  ${s.platform}: ${s.click_to_call} phone clicks`);
      totalPhoneClicks += s.click_to_call || 0;
    });
    console.log(`  Combined total: ${totalPhoneClicks} phone clicks`);
    
    if (totalPhoneClicks === 39) {
      console.log('\n❌ FOUND THE BUG: If not filtering by platform, returns 39!');
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('🎯 CONCLUSION:');
  console.log('='.repeat(80));
  console.log('If the API is NOT passing the platform parameter correctly,');
  console.log('it will aggregate both Meta (21) and Google (18) = 39');
  console.log('\nCheck browser console for API calls to see which platform is being requested.');
}

debugHavetDecember().then(() => {
  console.log('\n✅ Debug complete');
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});

