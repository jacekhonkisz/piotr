/**
 * Manually test Meta API for the specific client
 * Client ID: f0cf586c-402a-4466-9722-d8fd62f22dcb
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function testMetaAPI() {
  console.log('🔍 TESTING META API FOR CLIENT\n');
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  const clientId = 'f0cf586c-402a-4466-9722-d8fd62f22dcb';
  
  // 1. Get client info
  console.log('Step 1: Fetching client info...');
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single();
  
  if (clientError || !client) {
    console.error('❌ Client not found:', clientError);
    process.exit(1);
  }
  
  console.log('✅ Client found:', client.name);
  console.log('   Ad Account ID:', client.ad_account_id);
  console.log('   Has Meta Token:', !!client.meta_access_token);
  console.log('');
  
  if (!client.meta_access_token) {
    console.error('❌ Client has no Meta access token configured!');
    process.exit(1);
  }
  
  // 2. Test Meta API directly
  console.log('Step 2: Testing Meta API for demographics...\n');
  
  const adAccountId = client.ad_account_id.startsWith('act_') 
    ? client.ad_account_id.substring(4)
    : client.ad_account_id;
  
  const dateStart = '2025-11-01';
  const dateEnd = '2025-11-30';
  
  const baseUrl = 'https://graph.facebook.com/v21.0';
  const endpoint = `act_${adAccountId}/insights`;
  
  // Test 1: Demographics
  console.log('📊 Test 1: Demographic Performance');
  const demographicUrl = `${baseUrl}/${endpoint}?time_range={"since":"${dateStart}","until":"${dateEnd}"}&fields=impressions,clicks,spend,cpm,cpc,ctr,actions,action_values&breakdowns=age,gender&limit=500&access_token=${client.meta_access_token}`;
  
  try {
    const demoResponse = await fetch(demographicUrl);
    const demoData = await demoResponse.json();
    
    if (demoData.error) {
      console.error('❌ Demographic API Error:', JSON.stringify(demoData.error, null, 2));
    } else {
      console.log('✅ Demographic data received:');
      console.log('   Records:', demoData.data?.length || 0);
      if (demoData.data && demoData.data.length > 0) {
        console.log('   Sample:', JSON.stringify(demoData.data[0], null, 2));
      }
    }
  } catch (err) {
    console.error('❌ Demographic fetch failed:', err.message);
  }
  
  console.log('');
  
  // Test 2: Placements
  console.log('📊 Test 2: Placement Performance');
  const placementUrl = `${baseUrl}/${endpoint}?time_range={"since":"${dateStart}","until":"${dateEnd}"}&fields=impressions,clicks,spend,ctr,cpc,actions,action_values&breakdowns=publisher_platform,platform_position&limit=500&access_token=${client.meta_access_token}`;
  
  try {
    const placeResponse = await fetch(placementUrl);
    const placeData = await placeResponse.json();
    
    if (placeData.error) {
      console.error('❌ Placement API Error:', JSON.stringify(placeData.error, null, 2));
    } else {
      console.log('✅ Placement data received:');
      console.log('   Records:', placeData.data?.length || 0);
      if (placeData.data && placeData.data.length > 0) {
        console.log('   Sample:', JSON.stringify(placeData.data[0], null, 2));
      }
    }
  } catch (err) {
    console.error('❌ Placement fetch failed:', err.message);
  }
  
  console.log('');
  
  // Test 3: Campaign Insights (to see if there are ANY campaigns)
  console.log('📊 Test 3: Campaign Insights (checking for active campaigns)');
  const campaignUrl = `${baseUrl}/${endpoint}?time_range={"since":"${dateStart}","until":"${dateEnd}"}&fields=campaign_id,campaign_name,impressions,clicks,spend&level=campaign&limit=500&access_token=${client.meta_access_token}`;
  
  try {
    const campResponse = await fetch(campaignUrl);
    const campData = await campResponse.json();
    
    if (campData.error) {
      console.error('❌ Campaign API Error:', JSON.stringify(campData.error, null, 2));
    } else {
      console.log('✅ Campaign data received:');
      console.log('   Campaigns:', campData.data?.length || 0);
      if (campData.data && campData.data.length > 0) {
        console.log('   Campaigns:');
        campData.data.forEach((c, i) => {
          console.log(`   ${i + 1}. ${c.campaign_name} (${c.campaign_id}) - Spend: ${c.spend}`);
        });
      } else {
        console.log('   ⚠️ NO CAMPAIGNS found for this period!');
      }
    }
  } catch (err) {
    console.error('❌ Campaign fetch failed:', err.message);
  }
}

testMetaAPI().catch(console.error);
