const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function testAdAccounts() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('📋 Usage: node scripts/test-ad-accounts.js <your_token>');
    console.log('   Example: node scripts/test-ad-accounts.js "EAABwzLixnjYBO..."');
    return;
  }

  const token = args[0];
  console.log('🏢 Testing ad account access...\n');

  // Test specific ad accounts from your database
  const adAccounts = [
    { name: 'jacek', id: '703853679965014' },
    { name: 'TechCorp', id: '123456789' }
  ];

  for (const account of adAccounts) {
    console.log(`🔍 Testing access to ${account.name} (${account.id})...`);
    
    try {
      const response = await fetch(
        `https://graph.facebook.com/v18.0/act_${account.id}?fields=id,name,account_id,account_status,currency,timezone_name&access_token=${token}`
      );
      
      if (response.status === 403) {
        console.log(`❌ Access denied to ${account.name} (${account.id})`);
        console.log('💡 This ad account is not accessible with this token');
      } else if (response.status === 404) {
        console.log(`❌ Ad account not found: ${account.name} (${account.id})`);
        console.log('💡 Check if the ad account ID is correct');
      } else {
        const data = await response.json();
        
        if (data.error) {
          console.log(`❌ Error accessing ${account.name}: ${data.error.message}`);
        } else {
          console.log(`✅ Successfully accessed ${account.name}!`);
          console.log(`   Account Name: ${data.name}`);
          console.log(`   Account ID: ${data.account_id}`);
          console.log(`   Status: ${data.account_status}`);
          console.log(`   Currency: ${data.currency}`);
        }
      }
    } catch (error) {
      console.log(`❌ Network error testing ${account.name}: ${error.message}`);
    }
    
    console.log('');
  }

  console.log('📋 **Next Steps:**');
  console.log('1. If you see "Access denied" errors, you need to:');
  console.log('   - Make sure you\'re logged in with the account that owns the ad accounts');
  console.log('   - Generate a new token from Graph API Explorer');
  console.log('   - Ensure the token has ads_read and ads_management permissions');
  console.log('');
  console.log('2. If you see "Ad account not found" errors:');
  console.log('   - Check if the ad account IDs in your database are correct');
  console.log('   - Verify the ad accounts still exist');
}

testAdAccounts(); 