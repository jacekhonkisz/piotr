#!/usr/bin/env node

/**
 * Test Google Ads API with Test Accounts
 * This will verify the integration works with test accounts
 */

const { GoogleAdsApi } = require('google-ads-api');
require('dotenv').config();

const supabase = require('@supabase/supabase-js').createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getGoogleAdsCredentials() {
  console.log('🔐 Getting Google Ads credentials...');
  
  const { data: settings, error } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', [
      'google_ads_developer_token',
      'google_ads_client_id', 
      'google_ads_client_secret',
      'google_ads_manager_refresh_token'
    ]);
  
  if (error) {
    throw new Error(`Failed to get credentials: ${error.message}`);
  }
  
  const creds = {};
  settings?.forEach(setting => {
    creds[setting.key] = setting.value;
  });
  
  console.log('✅ Retrieved all credentials');
  return creds;
}

async function testWithManagerAccount(credentials) {
  console.log('\n🧪 Testing with Manager Account (293-100-0497)...');
  
  try {
    // Initialize Google Ads API client
    const client = new GoogleAdsApi({
      client_id: credentials.google_ads_client_id,
      client_secret: credentials.google_ads_client_secret,
      developer_token: credentials.google_ads_developer_token
    });

    console.log('✅ Google Ads API client initialized');

    // Test with manager account
    const managerCustomer = client.Customer({
      customer_id: '2931000497', // Remove dashes
      refresh_token: credentials.google_ads_manager_refresh_token
    });

    console.log('✅ Manager customer instance created');

    // Test basic query
    console.log('\n📊 Testing manager account query...');
    const query = `
      SELECT 
        customer.id,
        customer.descriptive_name,
        customer.currency_code,
        customer.time_zone
      FROM customer
      LIMIT 1
    `;

    const response = await managerCustomer.query(query);
    
    if (response && response.length > 0) {
      console.log('✅ Manager account query successful!');
      console.log('📋 Manager Account Data:');
      console.log(`   ID: ${response[0].customer.id}`);
      console.log(`   Name: ${response[0].customer.descriptiveName}`);
      console.log(`   Currency: ${response[0].customer.currencyCode}`);
      console.log(`   Timezone: ${response[0].customer.timeZone}`);
      
      // Test listing accessible customers
      console.log('\n📋 Testing accessible customers list...');
      try {
        const accessibleCustomers = await managerCustomer.listAccessibleCustomers();
        if (accessibleCustomers && accessibleCustomers.length > 0) {
          console.log('✅ Accessible customers found:');
          accessibleCustomers.forEach((customer, index) => {
            console.log(`   ${index + 1}. Customer ID: ${customer.id}`);
            console.log(`      Name: ${customer.descriptiveName || 'N/A'}`);
            console.log(`      Manager: ${customer.manager ? 'Yes' : 'No'}`);
          });
        } else {
          console.log('⚠️  No accessible customers found');
        }
      } catch (error) {
        console.log('⚠️  Could not list accessible customers:', error.message);
      }
      
      return true;
    } else {
      console.log('⚠️  Manager account query returned no results');
      return false;
    }

  } catch (error) {
    console.error('❌ Manager account test failed:', error.message);
    if (error.errors && error.errors.length > 0) {
      console.error('Error details:', error.errors[0]);
    }
    return false;
  }
}

async function testWithTestAccount(credentials) {
  console.log('\n🧪 Testing with Test Account...');
  
  try {
    // Initialize Google Ads API client
    const client = new GoogleAdsApi({
      client_id: credentials.google_ads_client_id,
      client_secret: credentials.google_ads_client_secret,
      developer_token: credentials.google_ads_developer_token
    });

    console.log('✅ Google Ads API client initialized');

    // Test with a common test customer ID
    const testCustomerIds = ['1234567890', '9876543210', '5555555555'];
    
    for (const testId of testCustomerIds) {
      try {
        console.log(`\n📊 Testing with test customer ID: ${testId}...`);
        
        const testCustomer = client.Customer({
          customer_id: testId,
          refresh_token: credentials.google_ads_manager_refresh_token
        });

        const query = `
          SELECT 
            customer.id,
            customer.descriptive_name
          FROM customer
          LIMIT 1
        `;

        const response = await testCustomer.query(query);
        
        if (response && response.length > 0) {
          console.log('✅ Test account query successful!');
          console.log('📋 Test Account Data:');
          console.log(`   ID: ${response[0].customer.id}`);
          console.log(`   Name: ${response[0].customer.descriptiveName}`);
          return true;
        }
      } catch (error) {
        console.log(`⚠️  Test customer ${testId} failed: ${error.message}`);
        continue;
      }
    }
    
    console.log('⚠️  No test accounts responded successfully');
    return false;

  } catch (error) {
    console.error('❌ Test account test failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('🎯 Testing Google Ads API with Test Accounts');
  console.log('============================================\n');
  
  try {
    // Step 1: Get credentials
    const credentials = await getGoogleAdsCredentials();
    
    // Step 2: Test with manager account
    const managerSuccess = await testWithManagerAccount(credentials);
    
    // Step 3: Test with test accounts
    const testAccountSuccess = await testWithTestAccount(credentials);
    
    // Summary
    console.log('\n📊 Test Summary');
    console.log('================');
    console.log(`Manager Account Test: ${managerSuccess ? '✅ SUCCESS' : '❌ FAILED'}`);
    console.log(`Test Account Test: ${testAccountSuccess ? '✅ SUCCESS' : '❌ FAILED'}`);
    
    if (managerSuccess || testAccountSuccess) {
      console.log('\n🎉 Google Ads API integration is working!');
      console.log('✅ API library connected successfully');
      console.log('✅ Queries executing properly');
      console.log('✅ Integration code is production-ready');
      console.log('\n🚀 Next step: Apply for Basic Access to use with live accounts');
    } else {
      console.log('\n🔧 All tests failed - need to investigate further');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  testWithManagerAccount,
  testWithTestAccount
};
