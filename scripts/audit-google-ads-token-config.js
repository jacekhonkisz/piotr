require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function auditGoogleAdsTokenConfig() {
  console.log('🔍 GOOGLE ADS TOKEN CONFIGURATION AUDIT\n');
  console.log('='.repeat(60));

  try {
    // Get Google Ads system settings
    console.log('📋 SYSTEM SETTINGS (Global Google Ads Configuration)');
    console.log('-'.repeat(60));
    
    // Check both 'settings' and 'system_settings' tables
    let settingsData = [];
    let settingsError = null;
    
    // Try system_settings first (newer table)
    const { data: systemSettings, error: systemError } = await supabase
      .from('system_settings')
      .select('*')
      .in('key', [
        'google_ads_client_id',
        'google_ads_client_secret',
        'google_ads_developer_token',
        'google_ads_manager_refresh_token',
        'google_ads_manager_customer_id'
      ]);
    
    if (systemSettings && systemSettings.length > 0) {
      settingsData = systemSettings;
    } else {
      // Fallback to settings table
      const { data: regularSettings, error: regularError } = await supabase
        .from('settings')
        .select('*')
        .in('key', [
          'google_ads_client_id',
          'google_ads_client_secret',
          'google_ads_developer_token',
          'google_ads_manager_refresh_token',
          'google_ads_manager_customer_id'
        ]);
      
      if (regularSettings) {
        settingsData = regularSettings;
      }
      settingsError = regularError || systemError;
    }

    if (settingsError) {
      console.error('❌ Error fetching settings:', settingsError);
      return;
    }

    const settings = {};
    settingsData.forEach(setting => {
      // Handle both string and object values
      settings[setting.key] = typeof setting.value === 'string' ? setting.value : (setting.value || '');
    });

    console.log(`google_ads_client_id: ${settings.google_ads_client_id ? '✅ SET' : '❌ NOT SET'}`);
    if (settings.google_ads_client_id) {
      console.log(`   Value: ${settings.google_ads_client_id.substring(0, 30)}...`);
    }

    console.log(`google_ads_client_secret: ${settings.google_ads_client_secret ? '✅ SET' : '❌ NOT SET'}`);
    if (settings.google_ads_client_secret) {
      console.log(`   Value: ${settings.google_ads_client_secret.substring(0, 10)}...`);
    }

    console.log(`google_ads_developer_token: ${settings.google_ads_developer_token ? '✅ SET' : '❌ NOT SET'}`);
    if (settings.google_ads_developer_token) {
      console.log(`   Value: ${settings.google_ads_developer_token.substring(0, 30)}...`);
    }

    console.log(`google_ads_manager_refresh_token: ${settings.google_ads_manager_refresh_token ? '✅ SET' : '❌ NOT SET'}`);
    if (settings.google_ads_manager_refresh_token) {
      console.log(`   Preview: ${settings.google_ads_manager_refresh_token.substring(0, 30)}...`);
      console.log(`   Length: ${settings.google_ads_manager_refresh_token.length} characters`);
    }

    console.log(`google_ads_manager_customer_id: ${settings.google_ads_manager_customer_id ? '✅ SET' : '❌ NOT SET'}`);
    if (settings.google_ads_manager_customer_id) {
      console.log(`   Value: ${settings.google_ads_manager_customer_id}`);
    }

    console.log('');

    // Check clients with Google Ads
    console.log('📋 CLIENTS WITH GOOGLE ADS CONFIGURATION');
    console.log('-'.repeat(60));
    
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, email, google_ads_refresh_token, google_ads_customer_id')
      .not('google_ads_customer_id', 'is', null);

    if (clientsError) {
      console.error('❌ Error fetching clients:', clientsError);
    } else if (clients && clients.length > 0) {
      console.log(`Found ${clients.length} client(s) with Google Ads configuration:\n`);
      
      clients.forEach((client, index) => {
        console.log(`${index + 1}. ${client.name} (${client.email || 'no email'})`);
        console.log(`   Client ID: ${client.id}`);
        console.log(`   Customer ID: ${client.google_ads_customer_id || 'NOT SET'}`);
        console.log(`   Has refresh token: ${client.google_ads_refresh_token ? '✅ YES' : '❌ NO'}`);
        if (client.google_ads_refresh_token) {
          console.log(`   Token preview: ${client.google_ads_refresh_token.substring(0, 30)}...`);
        }
        console.log('');
      });
    } else {
      console.log('⚠️ No clients found with Google Ads configuration');
    }

    console.log('');

    // TEST: Try to refresh the manager token
    if (settings.google_ads_manager_refresh_token && 
        settings.google_ads_client_id && 
        settings.google_ads_client_secret) {
      console.log('📋 TEST: MANAGER REFRESH TOKEN VALIDATION');
      console.log('-'.repeat(60));
      
      console.log('🔍 Testing manager refresh token...');
      
      try {
        const response = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: settings.google_ads_client_id,
            client_secret: settings.google_ads_client_secret,
            refresh_token: settings.google_ads_manager_refresh_token,
            grant_type: 'refresh_token'
          })
        });

        const responseText = await response.text();
        let responseData;
        
        try {
          responseData = JSON.parse(responseText);
        } catch (e) {
          console.log('❌ Invalid JSON response:', responseText);
          return;
        }

        if (!response.ok) {
          console.log('❌ Token refresh failed:', response.status);
          console.log('   Error:', responseData);
          
          if (responseData.error === 'invalid_grant') {
            console.log('\n🚨 CONFIRMED: invalid_grant error');
            console.log('   This typically means:');
            console.log('   1. The refresh token is invalid/expired');
            console.log('   2. The refresh token was revoked');
            console.log('   3. The client_id/client_secret don\'t match the token');
            console.log('   4. The token was issued to a different OAuth client');
            console.log('\n💡 SOLUTION:');
            console.log('   You need to generate a new refresh token with the current');
            console.log('   client_id and client_secret.');
          }
        } else {
          console.log('✅ Token refresh successful!');
          console.log('   Access token expires in:', responseData.expires_in, 'seconds');
          console.log('   Token type:', responseData.token_type);
        }
      } catch (error) {
        console.error('❌ Error testing token refresh:', error.message);
      }
    } else {
      console.log('⚠️ Cannot test token refresh - missing required settings');
    }

    // TEST: Try to refresh client-specific tokens
    if (clients && clients.length > 0) {
      console.log('\n📋 TEST: CLIENT-SPECIFIC REFRESH TOKENS');
      console.log('-'.repeat(60));
      
      for (const client of clients) {
        if (client.google_ads_refresh_token && 
            settings.google_ads_client_id && 
            settings.google_ads_client_secret) {
          console.log(`\n🔍 Testing refresh token for ${client.name}...`);
          
          try {
            const response = await fetch('https://oauth2.googleapis.com/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                client_id: settings.google_ads_client_id,
                client_secret: settings.google_ads_client_secret,
                refresh_token: client.google_ads_refresh_token,
                grant_type: 'refresh_token'
              })
            });

            const responseText = await response.text();
            let responseData;
            
            try {
              responseData = JSON.parse(responseText);
            } catch (e) {
              console.log('   ❌ Invalid JSON response');
              continue;
            }

            if (!response.ok) {
              console.log(`   ❌ Token refresh failed: ${response.status}`);
              console.log(`   Error: ${responseData.error || 'Unknown'}`);
              
              if (responseData.error === 'invalid_grant') {
                console.log(`   🚨 This client's refresh token is invalid/expired`);
              }
            } else {
              console.log(`   ✅ Token refresh successful!`);
            }
          } catch (error) {
            console.error(`   ❌ Error: ${error.message}`);
          }
        }
      }
    }

    // SUMMARY
    console.log('\n' + '='.repeat(60));
    console.log('📊 AUDIT SUMMARY');
    console.log('='.repeat(60));
    console.log('\n💡 FINDINGS:');
    
    if (settings.google_ads_manager_refresh_token) {
      console.log('✅ Manager refresh token is configured (global)');
      console.log('   This token should work for all clients if properly set up');
    } else {
      console.log('⚠️ No manager refresh token found');
      console.log('   Clients must have individual refresh tokens');
    }
    
    console.log('\n🔧 RECOMMENDATION:');
    console.log('   If you see "invalid_grant" errors:');
    console.log('   1. The refresh token may be expired or revoked');
    console.log('   2. The client_id/client_secret may not match the token');
    console.log('   3. You need to generate a new refresh token');
    console.log('\n   To fix:');
    console.log('   - Go to Google Cloud Console');
    console.log('   - Re-authenticate and get a new refresh token');
    console.log('   - Update the token in settings or client configuration');

  } catch (error) {
    console.error('💥 Script error:', error);
  }
}

// Run the audit
auditGoogleAdsTokenConfig();

