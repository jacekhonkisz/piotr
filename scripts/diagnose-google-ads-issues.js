require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function diagnoseGoogleAdsIssues() {
  console.log('🔍 Google Ads API Issue Diagnosis');
  console.log('==================================\n');

  try {
    // Test 1: Check API endpoint accessibility
    console.log('🧪 Test 1: API Endpoint Accessibility');
    console.log('--------------------------------------');
    
    const endpoints = [
      { version: 'v14', url: 'https://googleads.googleapis.com/v14/customers:listAccessibleCustomers' },
      { version: 'v13', url: 'https://googleads.googleapis.com/v13/customers:listAccessibleCustomers' },
      { version: 'v12', url: 'https://googleads.googleapis.com/v12/customers:listAccessibleCustomers' },
      { version: 'v11', url: 'https://googleads.googleapis.com/v11/customers:listAccessibleCustomers' }
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint.url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'developer-token': 'WCX04VxQqB0fsV0YDX0w1g'
          }
        });
        
        console.log(`   ${endpoint.version}: ${response.status} ${response.statusText}`);
        
        if (response.status === 401) {
          console.log('      ✅ API accessible (401 expected without OAuth)');
        } else if (response.status === 404) {
          console.log('      ❌ API not found - version not supported');
        } else if (response.status === 403) {
          console.log('      ⚠️  Access denied - check permissions');
        }
      } catch (error) {
        console.log(`   ${endpoint.version}: ❌ Network error - ${error.message}`);
      }
    }

    // Test 2: Check credentials
    console.log('\n🔐 Test 2: Credentials Check');
    console.log('------------------------------');
    
    const { data: settings, error } = await supabase
      .from('system_settings')
      .select('key, value')
      .like('key', 'google_ads_%');
    
    if (error) {
      console.log('   ❌ Error fetching credentials:', error.message);
    } else {
      const creds = {};
      settings?.forEach(setting => {
        creds[setting.key] = setting.value;
      });
      
      console.log(`   Developer Token: ${creds.google_ads_developer_token ? '✅ SET' : '❌ NOT SET'}`);
      console.log(`   Manager Customer ID: ${creds.google_ads_manager_customer_id || '❌ NOT SET'}`);
      console.log(`   Client ID: ${creds.google_ads_client_id ? '✅ SET' : '❌ NOT SET'}`);
      console.log(`   Client Secret: ${creds.google_ads_client_secret ? '✅ SET' : '❌ NOT SET'}`);
      console.log(`   Enabled: ${creds.google_ads_enabled}`);
    }

    // Test 3: Check Belmonte client
    console.log('\n👤 Test 3: Belmonte Client Check');
    console.log('--------------------------------');
    
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('email', 'belmonte@hotel.com')
      .single();
    
    if (clientError) {
      console.log('   ❌ Error fetching Belmonte client:', clientError.message);
    } else {
      console.log(`   Name: ${client.name}`);
      console.log(`   Google Ads Customer ID: ${client.google_ads_customer_id || '❌ NOT SET'}`);
      console.log(`   Google Ads Enabled: ${client.google_ads_enabled ? '✅ YES' : '❌ NO'}`);
      console.log(`   Meta Ads Account ID: ${client.ad_account_id || 'NOT SET'}`);
    }

    // Test 4: Test OAuth flow
    console.log('\n🔄 Test 4: OAuth Flow Test');
    console.log('----------------------------');
    
    if (creds.google_ads_client_id && creds.google_ads_client_secret) {
      try {
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            client_id: creds.google_ads_client_id,
            client_secret: creds.google_ads_client_secret,
            grant_type: 'client_credentials'
          })
        });
        
        if (tokenResponse.status === 400) {
          console.log('   ✅ OAuth endpoint accessible (400 expected for client_credentials)');
        } else {
          console.log(`   ⚠️  OAuth response: ${tokenResponse.status}`);
        }
      } catch (error) {
        console.log('   ❌ OAuth error:', error.message);
      }
    } else {
      console.log('   ⚠️  Cannot test OAuth - missing credentials');
    }

    // Summary and recommendations
    console.log('\n📋 Summary & Recommendations');
    console.log('==============================');
    console.log('1. Check Developer Token status at: https://ads.google.com/aw/overview → Tools → API Center');
    console.log('2. Verify Google Ads API is enabled at: https://console.cloud.google.com/apis/dashboard?project=cellular-nuance-469408-b3');
    console.log('3. Ensure Manager Account has sufficient spend ($100+ lifetime)');
    console.log('4. Check if OAuth scopes include: https://www.googleapis.com/auth/adwords');
    console.log('5. Verify account permissions and regional settings');

  } catch (error) {
    console.error('❌ Diagnosis failed:', error);
  }
}

// Run diagnosis
if (require.main === module) {
  diagnoseGoogleAdsIssues().catch(console.error);
} 