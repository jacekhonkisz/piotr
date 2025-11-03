const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkBelmonteCampaignData() {
  console.log('🔍 Checking Belmonte Google Ads data...\n');
  
  // Get Belmonte client
  const { data: client } = await supabase
    .from('clients')
    .select('id, name, email')
    .eq('email', 'belmonte@hotel.com')
    .single();
    
  if (!client) {
    console.log('❌ Belmonte not found');
    return;
  }
  
  console.log(`✅ Client: ${client.name}\n`);
  
  // Check campaign_summaries for Google Ads
  const { data: campaigns } = await supabase
    .from('campaign_summaries')
    .select('*')
    .eq('client_id', client.id)
    .eq('platform', 'google')
    .limit(3);
    
  if (campaigns && campaigns.length > 0) {
    console.log(`✅ Found ${campaigns.length} Google Ads campaigns`);
    console.log('Sample data:', JSON.stringify(campaigns[0], null, 2));
  } else {
    console.log('⚠️  No Google Ads campaigns in campaign_summaries');
  }
  
  // Check Google Ads cache
  const { data: cache } = await supabase
    .from('google_ads_current_month_cache')
    .select('*')
    .eq('client_id', client.id)
    .limit(1);
    
  if (cache && cache.length > 0) {
    console.log('\n✅ Google Ads cache exists');
    const cacheData = cache[0];
    if (cacheData.campaigns) {
      console.log(`   Cached campaigns: ${Object.keys(cacheData.campaigns).length}`);
    }
    if (cacheData.adgroups) {
      console.log(`   Cached ad groups: ${cacheData.adgroups.length || 'N/A'}`);
    }
  } else {
    console.log('\n⚠️  No Google Ads cache found');
  }
}

checkBelmonteCampaignData().catch(console.error);
