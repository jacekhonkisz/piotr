const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkBelmonteData() {
  console.log('🔍 Checking if Belmonte has Google Ads data...\n');
  
  // Get Belmonte client
  const { data: client } = await supabase
    .from('clients')
    .select('id, name, email')
    .eq('email', 'belmonte@hotel.com')
    .single();
    
  if (!client) {
    console.log('❌ Belmonte client not found');
    return;
  }
  
  console.log(`✅ Client: ${client.name} (${client.email})\n`);
  
  // Check campaign_summaries with Belmonte
  const { data: campaigns, error: campaignsError } = await supabase
    .from('campaign_summaries')
    .select('id, campaign_name, spend, impressions, clicks, conversions')
    .eq('client_id', client.id)
    .eq('platform', 'google')
    .limit(5);
    
  if (campaignsError) {
    console.log('❌ Error checking campaigns:', campaignsError.message);
  } else if (campaigns && campaigns.length > 0) {
    console.log(`✅ Found ${campaigns.length} Google Ads campaigns:\n`);
    campaigns.forEach((c, i) => {
      console.log(`${i+1}. ${c.campaign_name}`);
      console.log(`   Spend: ${c.spend} | Clicks: ${c.clicks} | Conversions: ${c.conversions}`);
    });
  } else {
    console.log('⚠️  No Google Ads campaigns found for Belmonte');
  }
  
  // Check cache
  const { data: cache, error: cacheError } = await supabase
    .from('google_ads_current_month_cache')
    .select('campaigns')
    .eq('client_id', client.id)
    .limit(1);
    
  if (!cacheError && cache && cache.length > 0) {
    console.log('\n✅ Belmonte has cached Google Ads data');
  } else {
    console.log('\n⚠️  No cached Google Ads data found');
  }
}

checkBelmonteData().catch(console.error);
