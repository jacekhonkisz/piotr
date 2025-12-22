/**
 * Test Meta API for a single client to see what's actually returned
 * This will help us understand why collection is "succeeding" but storing empty data
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testMetaAPI() {
  console.log('🔍 Testing Meta API for one client...\n');
  
  // Get one client (Hotel Lambert as an example)
  const { data: client, error } = await supabase
    .from('clients')
    .select('*')
    .eq('name', 'Hotel Lambert Ustronie Morskie')
    .single();
  
  if (error || !client) {
    console.error('❌ Client not found:', error);
    return;
  }
  
  console.log('✅ Client found:', client.name);
  console.log('   Ad Account ID:', client.ad_account_id);
  console.log('   Has Meta Token:', !!client.meta_access_token);
  console.log('');
  
  // Test Meta API call
  try {
    const { MetaAPIService } = require('./src/lib/meta-api-optimized');
    const metaService = new MetaAPIService(client.meta_access_token);
    
    const adAccountId = client.ad_account_id.startsWith('act_') 
      ? client.ad_account_id.substring(4)
      : client.ad_account_id;
    
    console.log('📡 Calling Meta API for Week 46 (2025-11-10 to 2025-11-16)...\n');
    
    const insights = await metaService.getCampaignInsights(
      adAccountId,
      '2025-11-10',
      '2025-11-16',
      0
    );
    
    console.log('📊 Meta API Response:');
    console.log('   Campaigns returned:', insights.length);
    
    if (insights.length > 0) {
      console.log('\n   Sample campaign:');
      console.log('   ', JSON.stringify(insights[0], null, 2));
    } else {
      console.log('\n   ⚠️  NO CAMPAIGNS RETURNED!');
      console.log('   This means either:');
      console.log('   1. No campaigns ran during this week');
      console.log('   2. Meta access token is invalid/expired');
      console.log('   3. Ad account ID is incorrect');
    }
    
  } catch (apiError) {
    console.error('\n❌ Meta API Error:', apiError.message);
    console.error('   Full error:', apiError);
  }
}

testMetaAPI();



