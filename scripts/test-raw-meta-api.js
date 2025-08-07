const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testRawMetaAPI() {
  console.log('🔍 Testing Raw Meta API Response\n');

  try {
    // Get Havet client
    const { data: havetClient } = await supabase
      .from('clients')
      .select('*')
      .eq('email', 'havet@magialubczyku.pl')
      .single();

    if (!havetClient) {
      console.error('❌ Havet client not found');
      return;
    }

    console.log(`🏨 Testing with Havet client: ${havetClient.name}`);
    console.log(`   Ad Account: ${havetClient.ad_account_id}`);
    console.log(`   Token: ${havetClient.meta_access_token.substring(0, 20)}...`);

    // Make direct Meta API call
    const fields = [
      'campaign_id',
      'campaign_name',
      'impressions',
      'clicks',
      'spend',
      'conversions',
      'ctr',
      'cpc',
      'actions',
      'action_values',
      'cost_per_action_type',
      'cost_per_conversion',
      'conversion_values',
    ].join(',');

    const params = new URLSearchParams({
      access_token: havetClient.meta_access_token,
      fields: fields,
      time_range: JSON.stringify({
        since: '2025-08-01',
        until: '2025-08-07',
      }),
      level: 'campaign',
      limit: '5', // Just get 5 campaigns for testing
    });

    const accountIdWithPrefix = havetClient.ad_account_id.startsWith('act_') 
      ? havetClient.ad_account_id 
      : `act_${havetClient.ad_account_id}`;
    
    const url = `https://graph.facebook.com/v18.0/${accountIdWithPrefix}/insights?${params.toString()}`;
    
    console.log('\n🔗 Meta API URL (without token):', url.replace(havetClient.meta_access_token, 'HIDDEN_TOKEN'));

    const response = await fetch(url);
    const data = await response.json();

    console.log('\n📡 Meta API Response Status:', response.status);
    console.log('\n📊 Meta API Response Structure:');
    console.log(`   Has Data: ${!!data.data}`);
    console.log(`   Data Length: ${data.data?.length || 0}`);
    console.log(`   Has Error: ${!!data.error}`);
    console.log(`   Error: ${data.error?.message || 'None'}`);

    if (data.error) {
      console.log('\n❌ Meta API Error Details:');
      console.log(`   Type: ${data.error.type}`);
      console.log(`   Code: ${data.error.code}`);
      console.log(`   Message: ${data.error.message}`);
      return;
    }

    if (data.data && data.data.length > 0) {
      const firstCampaign = data.data[0];
      console.log('\n🔍 First Campaign Raw Data:');
      console.log(`   Campaign ID: ${firstCampaign.campaign_id}`);
      console.log(`   Campaign Name: ${firstCampaign.campaign_name}`);
      console.log(`   Impressions: ${firstCampaign.impressions}`);
      console.log(`   Clicks: ${firstCampaign.clicks}`);
      console.log(`   Spend: ${firstCampaign.spend}`);
      console.log(`   Conversions: ${JSON.stringify(firstCampaign.conversions)}`);
      
      console.log('\n📈 Conversion Tracking Fields:');
      console.log(`   Actions: ${JSON.stringify(firstCampaign.actions)}`);
      console.log(`   Action Values: ${JSON.stringify(firstCampaign.action_values)}`);
      console.log(`   Cost Per Action Type: ${JSON.stringify(firstCampaign.cost_per_action_type)}`);
      console.log(`   Cost Per Conversion: ${JSON.stringify(firstCampaign.cost_per_conversion)}`);
      console.log(`   Conversion Values: ${JSON.stringify(firstCampaign.conversion_values)}`);

      // Check if actions array exists and has data
      if (firstCampaign.actions && Array.isArray(firstCampaign.actions)) {
        console.log('\n🎯 Actions Array Details:');
        console.log(`   Actions Count: ${firstCampaign.actions.length}`);
        firstCampaign.actions.forEach((action, index) => {
          console.log(`   Action ${index + 1}: ${action.action_type} = ${action.value}`);
        });
      } else {
        console.log('\n❌ No actions array or empty actions array');
      }

      // Check if action_values array exists and has data
      if (firstCampaign.action_values && Array.isArray(firstCampaign.action_values)) {
        console.log('\n💰 Action Values Array Details:');
        console.log(`   Action Values Count: ${firstCampaign.action_values.length}`);
        firstCampaign.action_values.forEach((actionValue, index) => {
          console.log(`   Action Value ${index + 1}: ${actionValue.action_type} = ${actionValue.value}`);
        });
      } else {
        console.log('\n❌ No action_values array or empty action_values array');
      }

      // Check all available fields
      console.log('\n📋 All Available Fields:');
      Object.keys(firstCampaign).forEach(key => {
        console.log(`   ${key}: ${JSON.stringify(firstCampaign[key])}`);
      });
    } else {
      console.log('\n❌ No campaign data returned from Meta API');
    }

    console.log('\n✅ Raw Meta API test completed');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testRawMetaAPI(); 