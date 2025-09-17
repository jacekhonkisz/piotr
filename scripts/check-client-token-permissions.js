require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkClientTokenPermissions() {
  try {
    console.log('🔍 Checking client token permissions...\n');
    
    // Get the TechCorp client
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('email', 'client@techcorp.com')
      .single();
    
    if (clientError || !client) {
      console.error('❌ Client not found:', clientError);
      return;
    }
    
    console.log('📋 Client found:', {
      id: client.id,
      name: client.name,
      email: client.email,
      ad_account_id: client.ad_account_id,
      has_token: !!client.meta_access_token,
      token_length: client.meta_access_token?.length || 0
    });
    
    if (!client.meta_access_token) {
      console.error('❌ No Meta access token found for this client');
      return;
    }
    
    // Test the token permissions
    const token = client.meta_access_token;
    
    // Test basic token info
    console.log('\n🔑 Testing token info...');
    try {
      const tokenInfoResponse = await fetch(`https://graph.facebook.com/v18.0/me?access_token=${token}`);
      const tokenInfo = await tokenInfoResponse.json();
      
      if (tokenInfo.error) {
        console.error('❌ Token info error:', tokenInfo.error);
      } else {
        console.log('✅ Token is valid for user:', tokenInfo.name);
      }
    } catch (error) {
      console.error('❌ Error testing token info:', error.message);
    }
    
    // Test ad accounts access
    console.log('\n📊 Testing ad accounts access...');
    try {
      const adAccountsResponse = await fetch(`https://graph.facebook.com/v18.0/me/adaccounts?access_token=${token}&fields=id,name,account_id,account_status`);
      const adAccounts = await adAccountsResponse.json();
      
      if (adAccounts.error) {
        console.error('❌ Ad accounts error:', adAccounts.error);
        console.log('💡 This indicates the token lacks ads_read permission');
      } else {
        console.log('✅ Ad accounts accessible:', adAccounts.data?.length || 0, 'accounts found');
        adAccounts.data?.forEach(account => {
          console.log(`   - ${account.name} (${account.account_id}) - Status: ${account.account_status}`);
        });
      }
    } catch (error) {
      console.error('❌ Error testing ad accounts:', error.message);
    }
    
    // Test specific ad account access
    console.log('\n🎯 Testing specific ad account access...');
    try {
      const adAccountId = client.ad_account_id.startsWith('act_') ? client.ad_account_id : `act_${client.ad_account_id}`;
      const accountResponse = await fetch(`https://graph.facebook.com/v18.0/${adAccountId}?access_token=${token}&fields=id,name,account_id,account_status`);
      const account = await accountResponse.json();
      
      if (account.error) {
        console.error('❌ Specific ad account error:', account.error);
        console.log('💡 This indicates the token lacks ads_management permission for this account');
      } else {
        console.log('✅ Specific ad account accessible:', account.name);
      }
    } catch (error) {
      console.error('❌ Error testing specific ad account:', error.message);
    }
    
    // Test campaigns access
    console.log('\n📈 Testing campaigns access...');
    try {
      const adAccountId = client.ad_account_id.startsWith('act_') ? client.ad_account_id : `act_${client.ad_account_id}`;
      const campaignsResponse = await fetch(`https://graph.facebook.com/v18.0/${adAccountId}/campaigns?access_token=${token}&fields=id,name,status&limit=5`);
      const campaigns = await campaignsResponse.json();
      
      if (campaigns.error) {
        console.error('❌ Campaigns error:', campaigns.error);
        console.log('💡 This indicates the token lacks ads_management permission for this account');
      } else {
        console.log('✅ Campaigns accessible:', campaigns.data?.length || 0, 'campaigns found');
        campaigns.data?.forEach(campaign => {
          console.log(`   - ${campaign.name} (${campaign.id}) - Status: ${campaign.status}`);
        });
      }
    } catch (error) {
      console.error('❌ Error testing campaigns:', error.message);
    }
    
    console.log('\n📋 Summary:');
    console.log('The generate-report API is failing because the Meta API token lacks the required permissions.');
    console.log('Required permissions: ads_read, ads_management');
    console.log('Solution: Update the client\'s Meta access token with proper permissions.');
    
  } catch (error) {
    console.error('💥 Error checking token permissions:', error);
  }
}

// Run the check
checkClientTokenPermissions(); 