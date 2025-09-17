require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function updateHortelsTokens() {
  console.log('🔧 Updating Hortels client tokens...\n');

  // ⚠️ IMPORTANT: Replace these with actual new tokens that have proper permissions
  const newTokens = {
    'Havet': 'NEW_HAVET_TOKEN_HERE', // Replace with actual token
    'Belmonte Hotel': 'NEW_BELMONTE_TOKEN_HERE' // Replace with actual token
  };

  console.log('📋 Tokens to update:');
  Object.entries(newTokens).forEach(([clientName, token]) => {
    console.log(`   ${clientName}: ${token.substring(0, 20)}...`);
  });
  console.log('');

  // Check if tokens are still placeholder values
  const hasPlaceholders = Object.values(newTokens).some(token => 
    token.includes('NEW_') || token.includes('HERE')
  );

  if (hasPlaceholders) {
    console.log('❌ ERROR: Please replace the placeholder tokens with actual Meta API tokens!');
    console.log('');
    console.log('🔧 To get new tokens:');
    console.log('1. Go to https://developers.facebook.com/');
    console.log('2. Select your app: API Raporty');
    console.log('3. Navigate to Tools → Graph API Explorer');
    console.log('4. Add permissions: ads_read, ads_management, business_management');
    console.log('5. Generate Access Token');
    console.log('6. Replace the placeholder values in this script');
    console.log('');
    return;
  }

  for (const [clientName, newToken] of Object.entries(newTokens)) {
    console.log(`🔄 Updating ${clientName}...`);
    
    try {
      // First, validate the new token
      const tokenTestResponse = await fetch(`https://graph.facebook.com/v18.0/me?access_token=${newToken}`);
      const tokenTestData = await tokenTestResponse.json();
      
      if (tokenTestData.error) {
        console.log(`   ❌ Token validation failed: ${tokenTestData.error.message}`);
        continue;
      }
      
      console.log(`   ✅ Token valid for: ${tokenTestData.name}`);
      
      // Update the client token
      const { error } = await supabase
        .from('clients')
        .update({ 
          meta_access_token: newToken,
          updated_at: new Date().toISOString(),
          api_status: 'valid'
        })
        .eq('name', clientName);

      if (error) {
        console.log(`   ❌ Database update failed: ${error.message}`);
      } else {
        console.log(`   ✅ Successfully updated ${clientName} token`);
        
        // Test the updated token permissions
        const client = await supabase
          .from('clients')
          .select('ad_account_id')
          .eq('name', clientName)
          .single();
        
        if (client.data) {
          const accountIdWithPrefix = client.data.ad_account_id.startsWith('act_') 
            ? client.data.ad_account_id 
            : `act_${client.data.ad_account_id}`;
          
          const insightsTestResponse = await fetch(
            `https://graph.facebook.com/v18.0/${accountIdWithPrefix}/insights?fields=campaign_id,campaign_name&limit=1&access_token=${newToken}`
          );
          const insightsTestData = await insightsTestResponse.json();
          
          if (insightsTestData.error) {
            console.log(`   ⚠️ Campaign insights still not accessible: ${insightsTestData.error.message}`);
            console.log(`   🔧 Token may still need additional permissions`);
          } else {
            console.log(`   ✅ Campaign insights access confirmed`);
            console.log(`   📊 Found ${insightsTestData.data?.length || 0} campaigns`);
          }
        }
      }
    } catch (error) {
      console.log(`   ❌ Error updating ${clientName}: ${error.message}`);
    }
    
    console.log('');
  }

  console.log('🎯 Update complete!');
  console.log('');
  console.log('📋 Next steps:');
  console.log('1. Run: node scripts/check-hortels-permissions.js');
  console.log('2. Check the conversion tracking in the dashboard');
  console.log('3. Verify that "Nie skonfigurowane" is replaced with real data');
}

updateHortelsTokens(); 