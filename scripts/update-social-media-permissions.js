require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Test if a token has the required social media permissions
 */
async function testTokenPermissions(accessToken) {
  try {
    console.log('🔍 Testing token permissions...');
    
    // Test if we can access pages
    const pagesResponse = await fetch(`https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}`);
    const pagesData = await pagesResponse.json();
    
    if (pagesData.error) {
      console.log('❌ Pages access failed:', pagesData.error.message);
      return false;
    }
    
    console.log('✅ Pages access working');
    console.log('📋 Available pages:', pagesData.data?.map(p => ({ id: p.id, name: p.name })) || []);
    
    // Test if we can get page insights for the first page
    if (pagesData.data && pagesData.data.length > 0) {
      const pageId = pagesData.data[0].id;
      const pageToken = pagesData.data[0].access_token;
      
      console.log(`🧪 Testing page insights for: ${pagesData.data[0].name} (${pageId})`);
      
      const insightsResponse = await fetch(
        `https://graph.facebook.com/v18.0/${pageId}/insights/page_follows?access_token=${pageToken || accessToken}`
      );
      const insightsData = await insightsResponse.json();
      
      if (insightsData.error) {
        console.log('❌ Page insights failed:', insightsData.error.message);
        return false;
      }
      
      console.log('✅ Page insights working');
      return true;
    }
    
    return false;
  } catch (error) {
    console.log('💥 Permission test error:', error.message);
    return false;
  }
}

/**
 * Update client token with new social media permissions
 */
async function updateClientToken(clientId, newToken) {
  try {
    console.log(`\n🔄 Updating token for client: ${clientId}`);
    
    // Test the new token first
    const hasPermissions = await testTokenPermissions(newToken);
    
    if (!hasPermissions) {
      console.log('❌ New token does not have required social media permissions!');
      return false;
    }
    
    // Update the database
    const { data, error } = await supabase
      .from('clients')
      .update({ meta_access_token: newToken })
      .eq('id', clientId)
      .select();
    
    if (error) {
      console.log('❌ Database update failed:', error.message);
      return false;
    }
    
    console.log('✅ Token updated successfully!');
    return true;
    
  } catch (error) {
    console.log('💥 Update failed:', error.message);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 SOCIAL MEDIA PERMISSIONS UPDATE SCRIPT\n');
  
  // Get client ID from command line or use default
  const clientId = process.argv[2] || 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'; // Belmonte default
  const newToken = process.argv[3];
  
  if (!newToken) {
    console.log(`
📋 USAGE:
node scripts/update-social-media-permissions.js [CLIENT_ID] [NEW_TOKEN]

🎯 REQUIRED PERMISSIONS FOR NEW TOKEN:
- pages_read_engagement
- pages_show_list  
- instagram_basic
- instagram_manage_insights

📖 HOW TO GET NEW TOKEN:

1. Go to Meta Graph API Explorer:
   https://developers.facebook.com/tools/explorer/

2. Select your Meta app

3. Add these permissions:
   ✅ pages_read_engagement
   ✅ pages_show_list
   ✅ instagram_basic  
   ✅ instagram_manage_insights

4. Generate access token

5. Convert to long-lived token:
   curl -X GET "https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=YOUR_APP_ID&client_secret=YOUR_APP_SECRET&fb_exchange_token=YOUR_SHORT_LIVED_TOKEN"

6. Run this script with the long-lived token:
   node scripts/update-social-media-permissions.js ${clientId} YOUR_LONG_LIVED_TOKEN

🔍 TESTING CURRENT TOKEN:
Just run this to test existing token:
node scripts/update-social-media-permissions.js ${clientId}
`);
    
    // Test current token if no new token provided
    if (clientId) {
      console.log(`\n🧪 Testing current token for client: ${clientId}\n`);
      
      const { data: client } = await supabase
        .from('clients')
        .select('meta_access_token, name')
        .eq('id', clientId)
        .single();
      
      if (client && client.meta_access_token) {
        console.log(`📋 Client: ${client.name}`);
        await testTokenPermissions(client.meta_access_token);
      } else {
        console.log('❌ Client not found or no token available');
      }
    }
    
    return;
  }
  
  // Update token
  const success = await updateClientToken(clientId, newToken);
  
  if (success) {
    console.log('\n🎉 SUCCESS! Social media permissions updated.');
    console.log('🔄 Refresh your dashboard to see Facebook followers data!');
  } else {
    console.log('\n❌ FAILED! Please check the token permissions and try again.');
  }
}

main().catch(console.error); 