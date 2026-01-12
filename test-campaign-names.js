// Quick test to check if campaign names are being retrieved correctly
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testCampaignNames() {
  console.log('🔍 Testing Campaign Names Retrieval...\n');
  
  // Test 1: Check current month cache
  console.log('1️⃣ CURRENT MONTH CACHE:');
  const { data: cacheData, error: cacheError } = await supabase
    .from('google_ads_current_month_cache')
    .select('cache_data, period_id')
    .limit(1)
    .single();
    
  if (cacheError) {
    console.error('❌ Cache error:', cacheError);
  } else if (cacheData?.cache_data?.campaigns) {
    const campaigns = cacheData.cache_data.campaigns.slice(0, 3);
    console.log(`✅ Found ${cacheData.cache_data.campaigns.length} campaigns in cache`);
    console.log('Sample campaigns:');
    campaigns.forEach((c, i) => {
      console.log(`  ${i + 1}. campaignName: "${c.campaignName}"`);
      console.log(`     campaign_name: "${c.campaign_name}"`);
      console.log(`     name: "${c.name}"`);
      console.log(`     Has name? ${!!c.campaignName || !!c.campaign_name || !!c.name}`);
    });
  }
  
  console.log('\n2️⃣ HISTORICAL DATA (campaign_summaries):');
  const { data: summaries, error: summariesError } = await supabase
    .from('campaign_summaries')
    .select('campaign_data, summary_date')
    .eq('platform', 'google')
    .eq('summary_type', 'monthly')
    .gte('summary_date', '2025-12-01')
    .limit(1)
    .single();
    
  if (summariesError) {
    console.error('❌ Summaries error:', summariesError);
  } else if (summaries?.campaign_data) {
    const campaigns = summaries.campaign_data.slice(0, 3);
    console.log(`✅ Found ${summaries.campaign_data.length} campaigns in campaign_data JSONB`);
    console.log('Sample campaigns:');
    campaigns.forEach((c, i) => {
      console.log(`  ${i + 1}. campaignName: "${c.campaignName}"`);
      console.log(`     campaign_name: "${c.campaign_name}"`);
      console.log(`     name: "${c.name}"`);
      console.log(`     Has name? ${!!c.campaignName || !!c.campaign_name || !!c.name}`);
    });
  }
  
  console.log('\n✅ Test complete!');
}

testCampaignNames().catch(console.error);

