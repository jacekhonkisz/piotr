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

async function updateAllTokens() {
  console.log('🔄 Meta API Token Update Tool\n');

  // Check environment variables
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;

  if (!appId || !appSecret) {
    console.log('❌ Missing Meta App credentials in .env.local file');
    console.log('💡 Please add META_APP_ID and META_APP_SECRET to your .env.local file');
    return;
  }

  // Get command line arguments
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('📋 Usage: node scripts/update-all-tokens.js <client_email> <new_token>');
    console.log('   Example: node scripts/update-all-tokens.js jac.honkisz@gmail.com "EAABwzLixnjYBO..."');
    console.log('\n📋 Or update all clients with the same token:');
    console.log('   node scripts/update-all-tokens.js --all <new_token>');
    return;
  }

  const isUpdateAll = args[0] === '--all';
  const clientEmail = isUpdateAll ? null : args[0];
  const newToken = isUpdateAll ? args[1] : args[1];

  if (!newToken) {
    console.log('❌ Missing new token parameter');
    return;
  }

  console.log(`🔑 New token: ${newToken.substring(0, 20)}...`);
  console.log('');

  // Validate the new token first
  console.log('🔐 Validating new token...');
  try {
    const validateResponse = await fetch(`https://graph.facebook.com/v18.0/me?access_token=${newToken}`);
    const validateData = await validateResponse.json();

    if (validateData.error) {
      console.log(`❌ Token validation failed: ${validateData.error.message}`);
      return;
    }

    console.log('✅ Token is valid!');
    console.log(`👤 User ID: ${validateData.id}`);

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
      console.log(`❌ Ad accounts access failed: ${adAccountsData.error.message}`);
      return;
    }

    console.log(`✅ Ad accounts access successful! Found ${adAccountsData.data?.length || 0} ad accounts`);
    console.log('');

  } catch (error) {
    console.log(`❌ Token validation error: ${error.message}`);
    return;
  }

  // Convert to long-lived token
  console.log('🔄 Converting to long-lived token...');
  try {
    const conversionResponse = await fetch(
      `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${newToken}`
    );

    if (!conversionResponse.ok) {
      const errorData = await conversionResponse.json();
      console.log(`❌ Token conversion failed: ${errorData.error?.message || 'Unknown error'}`);
      return;
    }

    const conversionData = await conversionResponse.json();
    const longLivedToken = conversionData.access_token;

    console.log('✅ Token converted to long-lived!');
    console.log(`📅 Expires in: ${conversionData.expires_in} seconds (${Math.floor(conversionData.expires_in / 86400)} days)`);
    console.log('');

    // Update client(s)
    if (isUpdateAll) {
      console.log('🔄 Updating all clients...');
      
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('*');

      if (clientsError) {
        console.log(`❌ Error fetching clients: ${clientsError.message}`);
        return;
      }

      for (const client of clients) {
        console.log(`📝 Updating ${client.name} (${client.email})...`);
        
        const { error: updateError } = await supabase
          .from('clients')
          .update({ 
            meta_access_token: longLivedToken,
            updated_at: new Date().toISOString()
          })
          .eq('id', client.id);

        if (updateError) {
          console.log(`❌ Error updating ${client.name}: ${updateError.message}`);
        } else {
          console.log(`✅ Successfully updated ${client.name}`);
        }
      }

    } else {
      console.log(`🔄 Updating client: ${clientEmail}...`);
      
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('email', clientEmail)
        .single();

      if (clientError || !client) {
        console.log(`❌ Client not found: ${clientEmail}`);
        return;
      }

      const { error: updateError } = await supabase
        .from('clients')
        .update({ 
          meta_access_token: longLivedToken,
          updated_at: new Date().toISOString()
        })
        .eq('id', client.id);

      if (updateError) {
        console.log(`❌ Error updating client: ${updateError.message}`);
        return;
      }

      console.log(`✅ Successfully updated ${client.name}`);
    }

    console.log('\n🎉 Token update completed successfully!');
    console.log('🌐 Your clients can now use the application with permanent API access.');

  } catch (error) {
    console.log(`❌ Error during token conversion: ${error.message}`);
  }
}

updateAllTokens(); 