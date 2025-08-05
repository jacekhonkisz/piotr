// Test script to check Meta API directly
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testMetaAPIDirect() {
  console.log('🔍 Testing Meta API directly...\n');

  try {
    // 1. Get a client
    console.log('📋 Step 1: Getting client data...');
    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('id, name, email, created_at, ad_account_id, meta_access_token')
      .limit(1);

    if (clientError) {
      console.error('❌ Error fetching clients:', clientError);
      return;
    }

    if (!clients || clients.length === 0) {
      console.error('❌ No clients found');
      return;
    }

    const client = clients[0];
    console.log('✅ Client found:', {
      id: client.id,
      name: client.name,
      email: client.email,
      created_at: client.created_at,
      ad_account_id: client.ad_account_id,
      hasToken: !!client.meta_access_token,
      tokenLength: client.meta_access_token?.length || 0
    });

    if (!client.meta_access_token) {
      console.error('❌ No Meta API token found for client');
      return;
    }

    // 2. Test Meta API token validation
    console.log('\n🔐 Step 2: Testing Meta API token...');
    
    const tokenValidationUrl = `https://graph.facebook.com/v18.0/me?access_token=${client.meta_access_token}`;
    
    try {
      const response = await fetch(tokenValidationUrl);
      const data = await response.json();
      
      console.log('📡 Token validation response:', {
        status: response.status,
        hasError: !!data.error,
        error: data.error,
        data: data
      });
      
      if (data.error) {
        console.log('❌ Meta API token is invalid:', data.error);
        return;
      }
      
      console.log('✅ Meta API token is valid');
    } catch (error) {
      console.log('❌ Error validating token:', error.message);
      return;
    }

    // 3. Test getting ad accounts
    console.log('\n🏢 Step 3: Testing ad accounts...');
    
    const adAccountsUrl = `https://graph.facebook.com/v18.0/me/adaccounts?access_token=${client.meta_access_token}`;
    
    try {
      const response = await fetch(adAccountsUrl);
      const data = await response.json();
      
      console.log('📡 Ad accounts response:', {
        status: response.status,
        hasError: !!data.error,
        error: data.error,
        accountsCount: data.data?.length || 0
      });
      
      if (data.data) {
        console.log('📊 Ad accounts found:', data.data.map(account => ({
          id: account.id,
          name: account.name,
          account_id: account.account_id,
          account_status: account.account_status
        })));
      }
    } catch (error) {
      console.log('❌ Error getting ad accounts:', error.message);
    }

    // 4. Test getting campaigns for the specific ad account
    console.log('\n📊 Step 4: Testing campaigns...');
    
    const adAccountId = client.ad_account_id.startsWith('act_') 
      ? client.ad_account_id.substring(4)
      : client.ad_account_id;
    
    const campaignsUrl = `https://graph.facebook.com/v18.0/act_${adAccountId}/campaigns?access_token=${client.meta_access_token}&fields=id,name,status,objective,created_time,start_time,stop_time`;
    
    try {
      const response = await fetch(campaignsUrl);
      const data = await response.json();
      
      console.log('📡 Campaigns response:', {
        status: response.status,
        hasError: !!data.error,
        error: data.error,
        campaignsCount: data.data?.length || 0
      });
      
      if (data.data) {
        console.log('📊 Campaigns found:', data.data.map(campaign => ({
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          objective: campaign.objective,
          created_time: campaign.created_time,
          start_time: campaign.start_time,
          stop_time: campaign.stop_time
        })));
      }
    } catch (error) {
      console.log('❌ Error getting campaigns:', error.message);
    }

    // 5. Test getting insights for a specific month
    console.log('\n📈 Step 5: Testing insights...');
    
    const insightsUrl = `https://graph.facebook.com/v18.0/act_${adAccountId}/insights?access_token=${client.meta_access_token}&fields=campaign_id,campaign_name,impressions,clicks,spend,conversions&time_range={"since":"2024-01-01","until":"2024-01-31"}&level=campaign`;
    
    try {
      const response = await fetch(insightsUrl);
      const data = await response.json();
      
      console.log('📡 Insights response:', {
        status: response.status,
        hasError: !!data.error,
        error: data.error,
        insightsCount: data.data?.length || 0
      });
      
      if (data.data) {
        console.log('📊 Insights found:', data.data.map(insight => ({
          campaign_id: insight.campaign_id,
          campaign_name: insight.campaign_name,
          impressions: insight.impressions,
          clicks: insight.clicks,
          spend: insight.spend,
          conversions: insight.conversions
        })));
      }
    } catch (error) {
      console.log('❌ Error getting insights:', error.message);
    }

    console.log('\n🔍 Summary:');
    console.log('- Check if Meta API token is valid');
    console.log('- Check if ad account exists and is accessible');
    console.log('- Check if campaigns exist in the ad account');
    console.log('- Check if campaigns have data for the specified date range');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testMetaAPIDirect(); 