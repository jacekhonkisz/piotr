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

async function convertExistingTokens() {
  console.log('🔄 Converting existing Meta API tokens to long-lived tokens...\n');

  try {
    // Get all clients
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*');

    if (clientsError) {
      console.error('❌ Error fetching clients:', clientsError);
      return;
    }

    if (!clients || clients.length === 0) {
      console.log('ℹ️ No clients found in database.');
      return;
    }

    console.log(`📋 Found ${clients.length} client(s) to process.\n`);

    for (const client of clients) {
      console.log(`🔍 Processing client: ${client.name} (${client.email})`);
      
      try {
        // Test current token
        const testResponse = await fetch(`https://graph.facebook.com/v18.0/me?access_token=${client.meta_access_token}`);
        const testData = await testResponse.json();

        if (testData.error) {
          console.log(`❌ Token for ${client.name} is invalid: ${testData.error.message}`);
          continue;
        }

        // Try to convert to long-lived token
        const appId = process.env.META_APP_ID;
        const appSecret = process.env.META_APP_SECRET;

        if (!appId || !appSecret) {
          console.log('❌ Missing META_APP_ID or META_APP_SECRET environment variables');
          console.log('💡 Please add these to your .env.local file to enable token conversion');
          return;
        }

        const conversionResponse = await fetch(
          `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${client.meta_access_token}`
        );

        if (!conversionResponse.ok) {
          const errorData = await conversionResponse.json();
          console.log(`❌ Token conversion failed for ${client.name}: ${errorData.error?.message || 'Unknown error'}`);
          continue;
        }

        const conversionData = await conversionResponse.json();

        if (!conversionData.access_token) {
          console.log(`❌ No access token received for ${client.name}`);
          continue;
        }

        // Update client with new long-lived token
        const { error: updateError } = await supabase
          .from('clients')
          .update({ 
            meta_access_token: conversionData.access_token,
            updated_at: new Date().toISOString()
          })
          .eq('id', client.id);

        if (updateError) {
          console.log(`❌ Error updating token for ${client.name}:`, updateError.message);
          continue;
        }

        console.log(`✅ Successfully converted token for ${client.name}`);
        console.log(`   Old token: ${client.meta_access_token.substring(0, 20)}...`);
        console.log(`   New token: ${conversionData.access_token.substring(0, 20)}...`);
        console.log(`   Expires in: ${conversionData.expires_in} seconds (${Math.floor(conversionData.expires_in / 86400)} days)`);

      } catch (error) {
        console.log(`❌ Error processing ${client.name}:`, error.message);
      }

      console.log(''); // Empty line for readability
    }

    console.log('🎉 Token conversion process completed!');
    console.log('📊 All valid tokens have been converted to long-lived tokens.');
    console.log('🌐 Your clients can now use the application without token expiration issues.');

  } catch (error) {
    console.error('❌ Error in token conversion process:', error);
  }
}

convertExistingTokens(); 