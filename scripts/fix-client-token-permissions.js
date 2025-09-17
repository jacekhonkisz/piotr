require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixClientTokenPermissions() {
  try {
    console.log('🔧 Fixing client token permissions...\n');
    
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
    
    console.log('📋 Current client:', {
      id: client.id,
      name: client.name,
      email: client.email,
      ad_account_id: client.ad_account_id
    });
    
    if (!client.meta_access_token) {
      console.error('❌ No Meta access token found for this client');
      return;
    }
    
    const token = client.meta_access_token;
    
    // Step 1: Check what ad accounts this token can access
    console.log('\n🔍 Step 1: Checking accessible ad accounts...');
    try {
      const adAccountsResponse = await fetch(`https://graph.facebook.com/v18.0/me/adaccounts?access_token=${token}&fields=id,name,account_id,account_status,account_type`);
      const adAccounts = await adAccountsResponse.json();
      
      if (adAccounts.error) {
        console.error('❌ Cannot access ad accounts:', adAccounts.error);
        console.log('💡 The token needs ads_read permission');
        return;
      }
      
      console.log('✅ Found accessible ad accounts:');
      const accessibleAccounts = adAccounts.data || [];
      
      if (accessibleAccounts.length === 0) {
        console.log('❌ No accessible ad accounts found');
        return;
      }
      
      // Display all accessible accounts
      accessibleAccounts.forEach((account, index) => {
        console.log(`   ${index + 1}. ${account.name} (${account.account_id})`);
        console.log(`      - ID: ${account.id}`);
        console.log(`      - Status: ${account.account_status}`);
        console.log(`      - Type: ${account.account_type}`);
      });
      
      // Step 2: Test each account for campaign access
      console.log('\n🔍 Step 2: Testing campaign access for each account...');
      
      for (const account of accessibleAccounts) {
        console.log(`\n🎯 Testing account: ${account.name} (${account.account_id})`);
        
        try {
          // Test account info access
          const accountInfoResponse = await fetch(`https://graph.facebook.com/v18.0/${account.id}?access_token=${token}&fields=id,name,account_id,account_status`);
          const accountInfo = await accountInfoResponse.json();
          
          if (accountInfo.error) {
            console.log(`   ❌ Account info error: ${accountInfo.error.message}`);
            continue;
          }
          
          console.log(`   ✅ Account info accessible`);
          
          // Test campaigns access
          const campaignsResponse = await fetch(`https://graph.facebook.com/v18.0/${account.id}/campaigns?access_token=${token}&fields=id,name,status&limit=5`);
          const campaigns = await campaignsResponse.json();
          
          if (campaigns.error) {
            console.log(`   ❌ Campaigns error: ${campaigns.error.message}`);
            continue;
          }
          
          console.log(`   ✅ Campaigns accessible: ${campaigns.data?.length || 0} campaigns found`);
          
          // This account works! Update the client
          console.log(`\n🎉 Found working account: ${account.name} (${account.account_id})`);
          
          const { error: updateError } = await supabase
            .from('clients')
            .update({ 
              ad_account_id: account.account_id,
              updated_at: new Date().toISOString()
            })
            .eq('id', client.id);
          
          if (updateError) {
            console.error('❌ Failed to update client:', updateError);
          } else {
            console.log('✅ Successfully updated client with working ad account');
            console.log(`   New ad_account_id: ${account.account_id}`);
            
            // Test the generate-report API with the new account
            console.log('\n🧪 Testing generate-report API with new account...');
            await testGenerateReport(client.id, account.account_id);
            return;
          }
          
        } catch (error) {
          console.log(`   ❌ Error testing account: ${error.message}`);
        }
      }
      
      console.log('\n❌ No working ad accounts found');
      console.log('💡 Solution: Update the Meta access token with proper permissions');
      
    } catch (error) {
      console.error('❌ Error checking ad accounts:', error.message);
    }
    
  } catch (error) {
    console.error('💥 Error fixing token permissions:', error);
  }
}

async function testGenerateReport(clientId, adAccountId) {
  try {
    // Get admin user for testing
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'admin')
      .limit(1);
    
    if (usersError || !users || users.length === 0) {
      console.error('❌ No admin users found');
      return;
    }
    
    const user = users[0];
    
    // Create session
    const { data: { session }, error: sessionError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: 'password123'
    });
    
    if (sessionError || !session) {
      console.error('❌ Failed to create session:', sessionError);
      return;
    }
    
    // Test the API
    const response = await fetch('http://localhost:3000/api/generate-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        clientId: clientId,
        dateRange: {
          start: '2024-01-01',
          end: '2024-12-31'
        }
      })
    });
    
    console.log('📡 Generate Report API Response Status:', response.status);
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ API Error:', errorData);
    } else {
      const data = await response.json();
      console.log('✅ API Success:', data);
    }
    
  } catch (error) {
    console.error('❌ Error testing generate-report:', error.message);
  }
}

// Run the fix
fixClientTokenPermissions(); 