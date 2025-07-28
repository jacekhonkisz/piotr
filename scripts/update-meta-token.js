const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables. Please check your .env.local file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function updateMetaToken() {
  console.log('🔑 Meta API Token Update Tool\n');

  // Get the new token from command line argument
  const newToken = process.argv[2];
  
  if (!newToken) {
    console.log('❌ Please provide your new Meta API token as an argument.');
    console.log('Usage: node scripts/update-meta-token.js YOUR_NEW_TOKEN');
    console.log('\nExample:');
    console.log('node scripts/update-meta-token.js EAAKeJ0iYczYBPECzH7j...');
    process.exit(1);
  }

  try {
    // Get client data for jacek
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('email', 'jac.honkisz@gmail.com')
      .single();

    if (clientError || !client) {
      console.error('❌ Client not found:', clientError);
      return;
    }

    console.log(`📋 Updating token for client: ${client.name} (${client.email})`);
    console.log(`🆔 Client ID: ${client.id}`);
    console.log(`📊 Ad Account ID: ${client.ad_account_id}`);
    console.log(`🔄 Current token: ${client.meta_access_token.substring(0, 20)}...`);

    // Update the token
    const { error: updateError } = await supabase
      .from('clients')
      .update({ 
        meta_access_token: newToken,
        updated_at: new Date().toISOString()
      })
      .eq('id', client.id);

    if (updateError) {
      console.error('❌ Error updating token:', updateError);
      return;
    }

    console.log('\n✅ Token updated successfully!');
    console.log(`🆕 New token: ${newToken.substring(0, 20)}...`);

    // Test the new token
    console.log('\n🧪 Testing new token...');
    
    try {
      // Test basic token validity
      const testResponse = await fetch(`https://graph.facebook.com/v18.0/me?access_token=${newToken}`);
      const testData = await testResponse.json();

      if (testData.error) {
        console.log('❌ Token validation failed:', testData.error.message);
        return;
      }

      console.log('✅ Token is valid!');
      console.log(`👤 User ID: ${testData.id}`);

      // Test ad accounts access
      const adAccountsResponse = await fetch(
        `https://graph.facebook.com/v18.0/me/adaccounts?fields=id,name,account_id&access_token=${newToken}`
      );
      
      if (adAccountsResponse.status === 403) {
        console.log('❌ Token lacks ads_read permission');
        console.log('💡 Make sure your token has these permissions:');
        console.log('   - ads_read');
        console.log('   - ads_management');
        console.log('   - business_management');
        return;
      }

      const adAccountsData = await adAccountsResponse.json();
      
      if (adAccountsData.error) {
        console.log('❌ Ad accounts access failed:', adAccountsData.error.message);
        return;
      }

      console.log('✅ Ad accounts access successful!');
      console.log(`📊 Found ${adAccountsData.data?.length || 0} ad accounts`);

      // Test specific ad account
      const cleanAccountId = client.ad_account_id.replace('act_', '');
      const accountResponse = await fetch(
        `https://graph.facebook.com/v18.0/act_${cleanAccountId}?fields=id,name,account_id,account_status&access_token=${newToken}`
      );

      if (accountResponse.status === 403) {
        console.log('❌ No access to ad account', cleanAccountId);
        console.log('💡 Make sure the token has access to this specific ad account');
        return;
      }

      if (accountResponse.status === 404) {
        console.log('❌ Ad account not found:', cleanAccountId);
        console.log('💡 Check if the ad account ID is correct');
        return;
      }

      const accountData = await accountResponse.json();
      
      if (accountData.error) {
        console.log('❌ Ad account access failed:', accountData.error.message);
        return;
      }

      console.log('✅ Ad account access successful!');
      console.log(`🏢 Account: ${accountData.name} (${accountData.account_id})`);
      console.log(`📈 Status: ${accountData.account_status}`);

      console.log('\n🎉 All tests passed! Your new token is working correctly.');
      console.log('🌐 You can now use the application with real Meta data.');

    } catch (testError) {
      console.error('❌ Error testing token:', testError.message);
    }

  } catch (error) {
    console.error('❌ Error updating Meta token:', error);
  }
}

updateMetaToken(); 