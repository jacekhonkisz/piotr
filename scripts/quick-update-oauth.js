#!/usr/bin/env node

/**
 * Quick Update Google Ads OAuth Credentials
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Credentials to update
const clientId = '77508981337-7kkho8u7mkfs3b2huojbmjt2mi236fps.apps.googleusercontent.com';
const clientSecret = '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';

async function updateCredentials() {
  console.log('🔐 Updating Google OAuth Credentials');
  console.log('=====================================\n');
  
  try {
    // Update Client ID
    console.log('📝 Updating Client ID...');
    const { error: clientIdError } = await supabase
      .from('system_settings')
      .upsert({
        key: 'google_ads_client_id',
        value: clientId,
        description: 'Google Ads API Client ID (OAuth)'
      }, {
        onConflict: 'key'
      });
    
    if (clientIdError) throw clientIdError;
    console.log('✅ Client ID updated');
    
    // Update Client Secret
    console.log('📝 Updating Client Secret...');
    const { error: clientSecretError } = await supabase
      .from('system_settings')
      .upsert({
        key: 'google_ads_client_secret',
        value: clientSecret,
        description: 'Google Ads API Client Secret (OAuth)'
      }, {
        onConflict: 'key'
      });
    
    if (clientSecretError) throw clientSecretError;
    console.log('✅ Client Secret updated');
    
    console.log('\n🎉 OAuth credentials updated successfully!\n');
    
    // Verify
    console.log('🔍 Verifying credentials...');
    const { data: settings, error: fetchError } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', ['google_ads_client_id', 'google_ads_client_secret', 'google_ads_developer_token', 'google_ads_manager_customer_id', 'google_ads_manager_refresh_token']);
    
    if (fetchError) throw fetchError;
    
    console.log('\n📋 Current Google Ads Configuration:');
    console.log('====================================');
    
    settings?.forEach(setting => {
      let displayValue;
      if (setting.value) {
        if (setting.key.includes('secret') || setting.key.includes('token')) {
          displayValue = setting.key.includes('client_id') ? setting.value.substring(0, 40) + '...' : '***[HIDDEN]***';
        } else {
          displayValue = setting.value;
        }
        console.log(`✅ ${setting.key}: ${displayValue}`);
      } else {
        console.log(`❌ ${setting.key}: [NOT SET]`);
      }
    });
    
    // Check if all required credentials are set
    const required = {
      'google_ads_client_id': false,
      'google_ads_client_secret': false,
      'google_ads_developer_token': false,
      'google_ads_manager_customer_id': false,
      'google_ads_manager_refresh_token': false
    };
    
    settings?.forEach(s => {
      if (s.value) {
        required[s.key] = true;
      }
    });
    
    console.log('\n📊 Configuration Status:');
    console.log('========================');
    
    const allSet = Object.values(required).every(v => v === true);
    
    if (allSet) {
      console.log('🎉 ALL CREDENTIALS CONFIGURED!');
      console.log('\n✅ Ready to test Google Ads API connection!');
    } else {
      const missing = Object.entries(required).filter(([k, v]) => !v).map(([k]) => k);
      console.log(`⚠️  Missing: ${missing.join(', ')}`);
    }
    
  } catch (error) {
    console.error('\n❌ Error updating credentials:', error);
    process.exit(1);
  }
}

updateCredentials().catch(console.error);

