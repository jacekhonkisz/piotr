/**
 * 🧪 Manual Token Testing Script
 * 
 * This script tests if a Meta API token works for multiple ad accounts
 * Run this with Node.js to verify token validity
 * 
 * Usage:
 *   1. Get token from database (from audit_token_migration.sql output)
 *   2. Replace TOKEN and AD_ACCOUNT_IDS below
 *   3. Run: node test_belmonte_token_manually.js
 */

const TOKEN = 'YOUR_TOKEN_HERE'; // Replace with actual token from database

// Replace with your actual ad account IDs
const AD_ACCOUNT_IDS = [
  '123456789',      // Belmonte
  '987654321',      // Lambert
  '555666777',      // Another client
  // Add more...
];

async function testToken(token, adAccountId) {
  const url = `https://graph.facebook.com/v18.0/act_${adAccountId}?fields=id,name,account_status,currency&access_token=${token}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.error) {
      return {
        adAccountId,
        success: false,
        error: data.error.message,
        errorCode: data.error.code,
        errorType: data.error.type
      };
    }
    
    return {
      adAccountId,
      success: true,
      accountId: data.id,
      accountName: data.name,
      status: data.account_status
    };
    
  } catch (error) {
    return {
      adAccountId,
      success: false,
      error: error.message
    };
  }
}

async function testAllAccounts() {
  console.log('🧪 Testing Meta API Token...\n');
  console.log(`Token: ${TOKEN.substring(0, 20)}...\n`);
  
  const results = [];
  
  for (const adAccountId of AD_ACCOUNT_IDS) {
    console.log(`Testing ad account: ${adAccountId}...`);
    const result = await testToken(TOKEN, adAccountId);
    results.push(result);
    
    if (result.success) {
      console.log(`  ✅ SUCCESS - ${result.accountName || 'Unknown'}`);
    } else {
      console.log(`  ❌ FAILED - ${result.error}`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY\n');
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`✅ Successful: ${successful}/${results.length}`);
  console.log(`❌ Failed: ${failed}/${results.length}`);
  
  if (failed > 0) {
    console.log('\n❌ Failed Accounts:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  • ${r.adAccountId}: ${r.error}`);
    });
  }
  
  console.log('\n' + '='.repeat(60));
  
  // Check for common error patterns
  const errors = results.filter(r => !r.success).map(r => r.error);
  const hasPermissionErrors = errors.some(e => e && e.includes('permission'));
  const hasTokenErrors = errors.some(e => e && (e.includes('token') || e.includes('OAuthException')));
  
  if (hasPermissionErrors) {
    console.log('\n⚠️  DIAGNOSIS: Permission Errors Detected');
    console.log('   The token works, but doesn\'t have access to some ad accounts.');
    console.log('   FIX: In Meta Business Manager, grant your system user access to these accounts.');
  }
  
  if (hasTokenErrors) {
    console.log('\n⚠️  DIAGNOSIS: Token Invalid or Expired');
    console.log('   The token itself is not valid.');
    console.log('   FIX: Generate a new system user token in Meta Business Manager.');
  }
}

// Check if token is set
if (TOKEN === 'YOUR_TOKEN_HERE') {
  console.log('❌ ERROR: Please set the TOKEN variable in the script first!');
  console.log('\nSteps:');
  console.log('1. Run audit_token_migration.sql to get the token');
  console.log('2. Copy the token value');
  console.log('3. Replace TOKEN = \'YOUR_TOKEN_HERE\' in this file');
  console.log('4. Run: node test_belmonte_token_manually.js');
  process.exit(1);
}

// Run tests
testAllAccounts().catch(console.error);







