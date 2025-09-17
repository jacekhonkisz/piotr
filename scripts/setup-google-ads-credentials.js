#!/usr/bin/env node

/**
 * Google Ads Credentials Setup Script
 * 
 * This script sets up the Google Ads API credentials in the system_settings table
 * with the provided developer token and manager account information.
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Supabase client configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Google Ads credentials provided by user
const GOOGLE_ADS_CREDENTIALS = {
  developer_token: 'WCX04VxQqB0fsV0YDX0w1g',
  manager_customer_id: '293-100-0497',
  // These will need to be obtained from Google Ads API setup
  client_id: '', // Will be filled when OAuth app is set up
  client_secret: '', // Will be filled when OAuth app is set up
};

async function setupGoogleAdsCredentials() {
  console.log('🚀 Setting up Google Ads API credentials...');
  
  try {
    // First, ensure the system_settings table has the necessary entries
    const settingsToUpsert = [
      {
        key: 'google_ads_developer_token',
        value: GOOGLE_ADS_CREDENTIALS.developer_token,
        description: 'Google Ads API Developer Token'
      },
      {
        key: 'google_ads_manager_customer_id',
        value: GOOGLE_ADS_CREDENTIALS.manager_customer_id,
        description: 'Google Ads Manager Customer ID'
      },
      {
        key: 'google_ads_client_id',
        value: GOOGLE_ADS_CREDENTIALS.client_id,
        description: 'Google Ads API Client ID (OAuth)'
      },
      {
        key: 'google_ads_client_secret',
        value: GOOGLE_ADS_CREDENTIALS.client_secret,
        description: 'Google Ads API Client Secret (OAuth)'
      },
      {
        key: 'google_ads_enabled',
        value: 'true',
        description: 'Enable/disable Google Ads integration globally'
      }
    ];

    console.log('📝 Upserting Google Ads system settings...');
    
    for (const setting of settingsToUpsert) {
      const { data, error } = await supabase
        .from('system_settings')
        .upsert(setting, {
          onConflict: 'key'
        });
      
      if (error) {
        console.error(`❌ Error upserting setting ${setting.key}:`, error);
        throw error;
      }
      
      console.log(`✅ ${setting.key}: ${setting.value ? '***[SET]***' : '[EMPTY]'}`);
    }

    // Verify the settings were saved correctly
    console.log('\n🔍 Verifying Google Ads settings...');
    
    const { data: settings, error: fetchError } = await supabase
      .from('system_settings')
      .select('key, value, description')
      .like('key', 'google_ads_%')
      .order('key');
    
    if (fetchError) {
      console.error('❌ Error fetching settings:', fetchError);
      throw fetchError;
    }

    console.log('\n📋 Current Google Ads Settings:');
    console.log('=====================================');
    settings?.forEach(setting => {
      const displayValue = setting.value ? (setting.key.includes('secret') || setting.key.includes('token') ? '***[HIDDEN]***' : setting.value) : '[EMPTY]';
      console.log(`${setting.key}: ${displayValue}`);
      console.log(`  Description: ${setting.description}`);
      console.log('');
    });

    console.log('✅ Google Ads credentials setup completed!');
    console.log('\n📝 Next Steps:');
    console.log('1. Set up OAuth application in Google Cloud Console');
    console.log('2. Update google_ads_client_id and google_ads_client_secret');
    console.log('3. Test the Google Ads API connection');
    console.log('4. Configure client accounts with their Customer IDs and refresh tokens');

  } catch (error) {
    console.error('❌ Error setting up Google Ads credentials:', error);
    process.exit(1);
  }
}

async function testGoogleAdsAPIConnection() {
  console.log('\n🔧 Testing Google Ads API connection...');
  
  try {
    // Get the current settings
    const { data: settings, error } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', ['google_ads_developer_token', 'google_ads_manager_customer_id'])
      .order('key');
    
    if (error) throw error;
    
    const developerToken = settings?.find(s => s.key === 'google_ads_developer_token')?.value;
    const managerCustomerId = settings?.find(s => s.key === 'google_ads_manager_customer_id')?.value;
    
    if (!developerToken || !managerCustomerId) {
      console.log('⚠️  Missing required credentials for API test');
      return;
    }
    
    console.log('✅ Developer Token: ***[SET]***');
    console.log('✅ Manager Customer ID:', managerCustomerId);
    
    console.log('\n⚠️  Note: Full API testing requires OAuth credentials');
    console.log('   Complete OAuth setup first, then test with a client account');
    
  } catch (error) {
    console.error('❌ Error testing API connection:', error);
  }
}

// Main execution
async function main() {
  console.log('🎯 Google Ads API Setup Script');
  console.log('===============================\n');
  
  await setupGoogleAdsCredentials();
  await testGoogleAdsAPIConnection();
  
  console.log('\n🎉 Setup complete! Google Ads API is ready for configuration.');
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  setupGoogleAdsCredentials,
  testGoogleAdsAPIConnection,
  GOOGLE_ADS_CREDENTIALS
}; 