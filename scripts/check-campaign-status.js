const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkCampaignStatus() {
  try {
    console.log('🔍 Checking campaign status and spend data...\n');

    // Get jacek client data
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('email', 'jac.honkisz@gmail.com')
      .single();

    if (clientError || !client) {
      console.error('❌ Client not found:', clientError);
      return;
    }

    const accessToken = client.meta_access_token;
    const adAccountId = client.ad_account_id.replace('act_', '');

    // Get detailed campaign information
    console.log('🎯 Getting detailed campaign information...');
    const campaignsResponse = await fetch(`https://graph.facebook.com/v18.0/act_${adAccountId}/campaigns?fields=id,name,status,objective,created_time,updated_time,start_time,stop_time,spend_cap,spend_cap_amount&access_token=${accessToken}`);
    const campaignsData = await campaignsResponse.json();
    
    if (campaignsData.data) {
      console.log(`📊 Found ${campaignsData.data.length} campaigns:\n`);
      
      for (const campaign of campaignsData.data) {
        console.log(`🎯 Campaign: ${campaign.name}`);
        console.log(`   ID: ${campaign.id}`);
        console.log(`   Status: ${campaign.status}`);
        console.log(`   Objective: ${campaign.objective}`);
        console.log(`   Created: ${campaign.created_time}`);
        console.log(`   Updated: ${campaign.updated_time}`);
        console.log(`   Start: ${campaign.start_time || 'Not set'}`);
        console.log(`   Stop: ${campaign.stop_time || 'Not set'}`);
        console.log(`   Spend Cap: ${campaign.spend_cap || 'Not set'}`);
        console.log(`   Spend Cap Amount: ${campaign.spend_cap_amount || 'Not set'}`);
        console.log('');
      }
    }

    // Check account-level insights (overall spend)
    console.log('💰 Checking account-level spend data...');
    const accountInsightsUrl = `https://graph.facebook.com/v18.0/act_${adAccountId}/insights?fields=spend,impressions,clicks&time_range={"since":"2024-01-01","until":"2025-12-31"}&level=account&access_token=${accessToken}`;
    
    const accountInsightsResponse = await fetch(accountInsightsUrl);
    const accountInsightsData = await accountInsightsResponse.json();
    
    if (accountInsightsData.data && accountInsightsData.data.length > 0) {
      console.log('✅ Account has spend data:');
      accountInsightsData.data.forEach((insight, index) => {
        console.log(`   Record ${index + 1}:`);
        console.log(`      💰 Spend: $${insight.spend || 0}`);
        console.log(`      👁️  Impressions: ${insight.impressions || 0}`);
        console.log(`      🖱️  Clicks: ${insight.clicks || 0}`);
      });
    } else {
      console.log('❌ No account-level spend data found');
      if (accountInsightsData.error) {
        console.log(`   Error: ${accountInsightsData.error.message}`);
      }
    }
    console.log('');

    // Check if there are any adsets or ads
    console.log('📋 Checking for adsets and ads...');
    const adsetsResponse = await fetch(`https://graph.facebook.com/v18.0/act_${adAccountId}/adsets?fields=id,name,status,campaign_id&access_token=${accessToken}`);
    const adsetsData = await adsetsResponse.json();
    
    if (adsetsData.data && adsetsData.data.length > 0) {
      console.log(`✅ Found ${adsetsData.data.length} adsets:`);
      adsetsData.data.forEach((adset, index) => {
        console.log(`   ${index + 1}. ${adset.name} (${adset.status}) - Campaign: ${adset.campaign_id}`);
      });
    } else {
      console.log('❌ No adsets found');
    }
    console.log('');

    // Check for ads
    const adsResponse = await fetch(`https://graph.facebook.com/v18.0/act_${adAccountId}/ads?fields=id,name,status,adset_id&access_token=${accessToken}`);
    const adsData = await adsResponse.json();
    
    if (adsData.data && adsData.data.length > 0) {
      console.log(`✅ Found ${adsData.data.length} ads:`);
      adsData.data.forEach((ad, index) => {
        console.log(`   ${index + 1}. ${ad.name} (${ad.status}) - Adset: ${ad.adset_id}`);
      });
    } else {
      console.log('❌ No ads found');
    }

  } catch (error) {
    console.error('❌ Error checking campaign status:', error);
  }
}

checkCampaignStatus(); 