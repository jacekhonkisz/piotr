require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function auditBelmonteTokenConfig() {
  console.log('🔍 BELMONTE HOTEL TOKEN CONFIGURATION AUDIT\n');
  console.log('='.repeat(60));

  try {
    // Find Belmonte client
    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .ilike('name', '%belmonte%');

    if (clientError || !clients || clients.length === 0) {
      console.error('❌ Belmonte client not found:', clientError);
      return;
    }

    const belmonte = clients[0];
    console.log('✅ Belmonte Hotel found');
    console.log('📧 Email:', belmonte.email);
    console.log('🆔 Client ID:', belmonte.id);
    console.log('🔑 Ad Account ID:', belmonte.ad_account_id);
    console.log('');

    // Check token configuration
    console.log('📋 TOKEN CONFIGURATION');
    console.log('-'.repeat(60));
    
    const hasSystemUserToken = !!belmonte.system_user_token;
    const hasMetaAccessToken = !!belmonte.meta_access_token;
    
    console.log(`system_user_token: ${hasSystemUserToken ? '✅ SET' : '❌ NOT SET'}`);
    if (hasSystemUserToken) {
      console.log(`   Preview: ${belmonte.system_user_token.substring(0, 30)}...`);
      console.log(`   Length: ${belmonte.system_user_token.length} characters`);
    }
    
    console.log(`meta_access_token: ${hasMetaAccessToken ? '✅ SET' : '❌ NOT SET'}`);
    if (hasMetaAccessToken) {
      console.log(`   Preview: ${belmonte.meta_access_token.substring(0, 30)}...`);
      console.log(`   Length: ${belmonte.meta_access_token.length} characters`);
    }
    
    console.log('');
    
    // Determine which token is being used
    const tokenToUse = belmonte.system_user_token || belmonte.meta_access_token;
    const tokenType = belmonte.system_user_token ? 'system_user_token (PERMANENT)' : 'meta_access_token (60-day)';
    
    if (!tokenToUse) {
      console.log('❌ ERROR: No Meta token found for Belmonte!');
      return;
    }
    
    console.log(`🎯 Token being used: ${tokenType}`);
    console.log(`   Token preview: ${tokenToUse.substring(0, 30)}...`);
    console.log('');

    // Check global system user token in settings
    console.log('📋 GLOBAL SYSTEM USER TOKEN (Settings Table)');
    console.log('-'.repeat(60));
    
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('*')
      .eq('key', 'meta_system_user_token')
      .single();

    if (settingsError && settingsError.code !== 'PGRST116') {
      console.error('❌ Error checking settings:', settingsError);
    } else if (settings) {
      const hasGlobalToken = !!settings.value;
      console.log(`Global meta_system_user_token: ${hasGlobalToken ? '✅ SET' : '❌ NOT SET'}`);
      if (hasGlobalToken) {
        console.log(`   Preview: ${settings.value.substring(0, 30)}...`);
        console.log(`   Last updated: ${settings.updated_at || 'N/A'}`);
      }
      
      // Check if Belmonte's token matches global token
      if (hasGlobalToken && belmonte.system_user_token) {
        const tokensMatch = settings.value === belmonte.system_user_token;
        console.log(`   Matches Belmonte's token: ${tokensMatch ? '✅ YES' : '❌ NO'}`);
      }
    } else {
      console.log('⚠️ No global system user token found in settings table');
    }
    
    console.log('');

    // TEST: Check token permissions
    console.log('📋 TEST: TOKEN PERMISSIONS CHECK');
    console.log('-'.repeat(60));
    
    const permissionsUrl = `https://graph.facebook.com/v18.0/me/permissions?access_token=${tokenToUse}`;
    
    try {
      const response = await fetch(permissionsUrl);
      const data = await response.json();

      if (data.error) {
        console.error('❌ Error checking permissions:', data.error);
      } else {
        const permissions = data.data || [];
        const requiredPermissions = ['ads_read', 'ads_management', 'business_management', 'read_insights'];
        const grantedPermissions = permissions
          .filter(p => p.status === 'granted')
          .map(p => p.permission);

        console.log('🎯 Required permissions check:');
        requiredPermissions.forEach(permission => {
          const hasPermission = grantedPermissions.includes(permission);
          const status = hasPermission ? '✅' : '❌';
          console.log(`   ${status} ${permission}`);
        });
      }
    } catch (error) {
      console.error('❌ Error checking permissions:', error.message);
    }
    
    console.log('');

    // TEST: Check ad account access
    if (belmonte.ad_account_id) {
      console.log('📋 TEST: AD ACCOUNT ACCESS');
      console.log('-'.repeat(60));
      
      const adAccountId = belmonte.ad_account_id.startsWith('act_') 
        ? belmonte.ad_account_id.substring(4)
        : belmonte.ad_account_id;

      console.log('🔍 Testing access to ad account:', adAccountId);
      
      const accountInfoUrl = `https://graph.facebook.com/v18.0/act_${adAccountId}?fields=id,name,account_status&access_token=${tokenToUse}`;
      
      try {
        const accountResponse = await fetch(accountInfoUrl);
        const accountData = await accountResponse.json();

        if (accountData.error) {
          console.log('❌ Account info error:', accountData.error.message);
          console.log('   Error type:', accountData.error.type);
          console.log('   Error code:', accountData.error.code);
          
          if (accountData.error.message?.includes('ads_management') || 
              accountData.error.message?.includes('ads_read')) {
            console.log('\n🚨 CONFIRMED: Ad account owner has NOT granted access!');
            console.log('   Even though the token has permissions, the ad account owner');
            console.log('   needs to grant access in Meta Business Manager.');
          }
        } else {
          console.log('✅ Account info accessible');
          console.log('   Account name:', accountData.name);
          console.log('   Account status:', accountData.account_status);
        }
      } catch (error) {
        console.error('❌ Error testing account access:', error.message);
      }
    }

    // SUMMARY
    console.log('\n' + '='.repeat(60));
    console.log('📊 AUDIT SUMMARY');
    console.log('='.repeat(60));
    console.log('\n💡 FINDINGS:');
    
    if (belmonte.system_user_token) {
      console.log('✅ Belmonte is using system_user_token (PERMANENT)');
      console.log('   This is the RECOMMENDED approach!');
      
      if (settings?.value && settings.value === belmonte.system_user_token) {
        console.log('✅ Belmonte\'s token matches the global system user token');
        console.log('   This means other clients can use the same token!');
      } else if (settings?.value) {
        console.log('⚠️ Belmonte has a different token than the global one');
        console.log('   Consider using the global token for consistency');
      }
    } else if (belmonte.meta_access_token) {
      console.log('⚠️ Belmonte is using meta_access_token (60-day, expires)');
      console.log('   Consider migrating to system_user_token for permanent access');
    }
    
    console.log('\n🔧 RECOMMENDATION:');
    console.log('   If Belmonte\'s token works, you can use the SAME token for all clients!');
    console.log('   Just ensure the system user has access to all ad accounts in Meta Business Manager.');

  } catch (error) {
    console.error('💥 Script error:', error);
  }
}

// Run the audit
auditBelmonteTokenConfig();




