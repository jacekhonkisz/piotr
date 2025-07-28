const { createClient } = require('@supabase/supabase-js');
const { MetaAPIService } = require('../src/lib/meta-api');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testLiveData() {
  try {
    console.log('🔍 Testing Live Data Fetching...\n');

    // Get a test client
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*')
      .limit(1);

    if (clientsError || !clients || clients.length === 0) {
      console.log('❌ No clients found in database');
      return;
    }

    const client = clients[0];
    console.log(`📋 Testing with client: ${client.name} (${client.email})`);
    console.log(`🔑 Ad Account ID: ${client.ad_account_id}`);
    console.log(`📊 Meta Token: ${client.meta_access_token ? 'Present' : 'Missing'}\n`);

    if (!client.meta_access_token) {
      console.log('❌ No Meta access token found for client');
      return;
    }

    // Test Meta API service
    const metaService = new MetaAPIService(client.meta_access_token);
    
    console.log('🔐 Validating Meta token...');
    const tokenValidation = await metaService.validateToken();
    console.log(`Token valid: ${tokenValidation.valid}`);
    if (!tokenValidation.valid) {
      console.log(`Error: ${tokenValidation.error}`);
      return;
    }

    console.log('✅ Token validation successful\n');

    // Test ad account validation
    console.log('🏢 Validating ad account...');
    const accountValidation = await metaService.validateAdAccount(client.ad_account_id);
    console.log(`Account valid: ${accountValidation.valid}`);
    if (accountValidation.valid) {
      console.log(`Account name: ${accountValidation.account?.name}`);
    } else {
      console.log(`Error: ${accountValidation.error}`);
      return;
    }

    console.log('✅ Account validation successful\n');

    // Fetch live campaign data
    console.log('📈 Fetching live campaign data...');
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = new Date().toISOString().split('T')[0];
    
    const campaignInsights = await metaService.getCampaignInsights(
      client.ad_account_id.replace('act_', ''),
      startDate,
      endDate
    );

    console.log(`📊 Found ${campaignInsights.length} campaigns`);
    
    if (campaignInsights.length > 0) {
      const totalSpend = campaignInsights.reduce((sum, campaign) => sum + campaign.spend, 0);
      const totalImpressions = campaignInsights.reduce((sum, campaign) => sum + campaign.impressions, 0);
      const totalClicks = campaignInsights.reduce((sum, campaign) => sum + campaign.clicks, 0);
      
      console.log('\n📈 Summary Stats:');
      console.log(`💰 Total Spend: $${totalSpend.toLocaleString()}`);
      console.log(`👁️  Total Impressions: ${totalImpressions.toLocaleString()}`);
      console.log(`🖱️  Total Clicks: ${totalClicks.toLocaleString()}`);
      console.log(`📊 Average CTR: ${totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : 0}%`);
      
      console.log('\n🎯 Top Campaigns:');
      campaignInsights.slice(0, 3).forEach((campaign, index) => {
        console.log(`${index + 1}. ${campaign.campaign_name}`);
        console.log(`   💰 Spend: $${campaign.spend.toLocaleString()}`);
        console.log(`   👁️  Impressions: ${campaign.impressions.toLocaleString()}`);
        console.log(`   🖱️  Clicks: ${campaign.clicks.toLocaleString()}`);
        console.log(`   📊 CTR: ${campaign.ctr.toFixed(2)}%`);
        console.log('');
      });
    } else {
      console.log('⚠️  No campaign data found for the specified date range');
    }

    console.log('✅ Live data test completed successfully!');

  } catch (error) {
    console.error('❌ Error testing live data:', error);
  }
}

// Run the test
testLiveData(); 